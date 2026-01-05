import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { LLMService } from "./services/llmService.js";
import { ConfigStorage } from "./services/configStorage.js";
import { DatabaseService } from "./services/database.js";

const isDev = process.env.NODE_ENV === "development";

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
};

// IPC handlers for LLM communication
ipcMain.handle("ping", () => "pong");

ipcMain.handle("llm:getSupportedProviders", () => {
  return LLMService.getSupportedProviders();
});

ipcMain.handle("llm:generate", async (event, messages, config) => {
  try {
    const service = new LLMService(config);
    const result = await service.generateResponse(messages);
    return { success: true, data: result };
  } catch (error) {
    console.error("LLM generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

ipcMain.handle("llm:stream", async (event, messages, config) => {
  try {
    const service = new LLMService(config);
    const chunks: string[] = [];

    // Create a unique stream ID for this request
    const streamId = `stream-${Date.now()}`;

    for await (const chunk of service.streamResponse(messages)) {
      chunks.push(chunk);

      // Send each chunk immediately to renderer
      event.sender.send("llm:stream:chunk", {
        streamId,
        chunk,
        isComplete: false,
      });
    }

    // Send completion signal
    event.sender.send("llm:stream:chunk", {
      streamId,
      chunk: "",
      isComplete: true,
    });

    return { success: true, data: chunks.join(""), streamId };
  } catch (error) {
    console.error("LLM streaming error:", error);

    // Send error to renderer
    event.sender.send("llm:stream:error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

// Config storage IPC handlers
ipcMain.handle("config:get", () => {
  return ConfigStorage.getConfig();
});

ipcMain.handle("config:save", (event, config) => {
  ConfigStorage.saveConfig(config);
  return true;
});

ipcMain.handle("config:setCurrentProvider", (event, provider) => {
  ConfigStorage.setCurrentProvider(provider);
  return true;
});

ipcMain.handle("config:saveProvider", (event, name, config) => {
  ConfigStorage.saveProvider(name, config);
  return true;
});

ipcMain.handle("config:removeProvider", (event, name) => {
  ConfigStorage.removeProvider(name);
  return true;
});

ipcMain.handle("config:getStorePath", () => {
  return ConfigStorage.getStorePath();
});

// Database IPC handlers
ipcMain.handle("db:getAllChats", () => {
  return DatabaseService.getAllChats();
});

ipcMain.handle("db:getChat", (_event, id: string) => {
  return DatabaseService.getChat(id);
});

ipcMain.handle("db:createChat", (_event, id: string, title: string) => {
  return DatabaseService.createChat(id, title);
});

ipcMain.handle("db:updateChatTitle", (_event, id: string, title: string) => {
  DatabaseService.updateChatTitle(id, title);
  return true;
});

ipcMain.handle("db:deleteChat", (_event, id: string) => {
  DatabaseService.deleteChat(id);
  return true;
});

ipcMain.handle(
  "db:addMessage",
  (_event, chatId: string, role: "user" | "assistant", content: string) => {
    DatabaseService.addMessage(chatId, role, content);
    return true;
  },
);

ipcMain.handle("db:updateLastMessage", (_event, chatId: string, content: string) => {
  DatabaseService.updateLastMessage(chatId, content);
  return true;
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  DatabaseService.close();
});
