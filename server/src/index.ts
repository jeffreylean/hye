import { DatabaseService } from "./services/database.js";
import { corsHeaders, textResponse, errorResponse } from "./lib/http.js";
import { llmRoutes } from "./routes/llm.js";
import { configRoutes } from "./routes/config.js";
import { chatRoutes } from "./routes/chats.js";

const PORT = parseInt(process.env.HYE_PORT || "9876", 10);

const server = Bun.serve({
  port: PORT,
  routes: {
    "/ping": {
      GET: () => textResponse("pong"),
      OPTIONS: () => new Response(null, { status: 204, headers: corsHeaders }),
    },
    ...llmRoutes,
    ...configRoutes,
    ...chatRoutes,
  },
  fetch(req) {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    return errorResponse("Not found", 404);
  },
  error(error) {
    console.error("Request error:", error);
    return errorResponse(error instanceof Error ? error.message : "Internal server error");
  },
});

console.log(`Hye server running on http://localhost:${server.port}`);

process.on("SIGINT", () => {
  console.log("\nShutting down...");
  DatabaseService.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nShutting down...");
  DatabaseService.close();
  process.exit(0);
});
