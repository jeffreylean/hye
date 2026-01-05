import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

export interface ChatRow {
  id: string
  title: string
  created_at: number
  updated_at: number
}

export interface MessageRow {
  id: number
  chat_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: number
}

export interface Chat {
  id: string
  title: string
  messages: Message[]
  createdAt: number
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (!db) {
    const dbPath = join(app.getPath('userData'), 'hye.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    initSchema()
  }
  return db
}

function initSchema(): void {
  const database = db!
  
  database.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
    CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);
  `)
}

export const DatabaseService = {
  getAllChats(): Chat[] {
    const database = getDb()
    
    const chats = database.prepare(`
      SELECT id, title, created_at as createdAt, updated_at as updatedAt
      FROM chats
      ORDER BY updated_at DESC
    `).all() as Array<{ id: string; title: string; createdAt: number; updatedAt: number }>

    const getMessages = database.prepare(`
      SELECT role, content
      FROM messages
      WHERE chat_id = ?
      ORDER BY created_at ASC
    `)

    return chats.map(chat => ({
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      messages: getMessages.all(chat.id) as Message[],
    }))
  },

  getChat(id: string): Chat | null {
    const database = getDb()
    
    const chat = database.prepare(`
      SELECT id, title, created_at as createdAt
      FROM chats
      WHERE id = ?
    `).get(id) as { id: string; title: string; createdAt: number } | undefined

    if (!chat) return null

    const messages = database.prepare(`
      SELECT role, content
      FROM messages
      WHERE chat_id = ?
      ORDER BY created_at ASC
    `).all(id) as Message[]

    return {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      messages,
    }
  },

  createChat(id: string, title: string): Chat {
    const database = getDb()
    const now = Date.now()

    database.prepare(`
      INSERT INTO chats (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(id, title, now, now)

    return {
      id,
      title,
      createdAt: now,
      messages: [],
    }
  },

  updateChatTitle(id: string, title: string): void {
    const database = getDb()
    database.prepare(`
      UPDATE chats SET title = ?, updated_at = ? WHERE id = ?
    `).run(title, Date.now(), id)
  },

  deleteChat(id: string): void {
    const database = getDb()
    database.prepare('DELETE FROM messages WHERE chat_id = ?').run(id)
    database.prepare('DELETE FROM chats WHERE id = ?').run(id)
  },

  addMessage(chatId: string, role: 'user' | 'assistant', content: string): void {
    const database = getDb()
    const now = Date.now()

    database.prepare(`
      INSERT INTO messages (chat_id, role, content, created_at)
      VALUES (?, ?, ?, ?)
    `).run(chatId, role, content, now)

    database.prepare(`
      UPDATE chats SET updated_at = ? WHERE id = ?
    `).run(now, chatId)
  },

  updateLastMessage(chatId: string, content: string): void {
    const database = getDb()
    
    database.prepare(`
      UPDATE messages
      SET content = ?
      WHERE id = (
        SELECT id FROM messages
        WHERE chat_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      )
    `).run(content, chatId)
  },

  close(): void {
    if (db) {
      db.close()
      db = null
    }
  },
}
