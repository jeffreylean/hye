import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync } from 'fs'
import type { Chat, Message } from '../lib/types.js'
import { DATA_DIR, DB_PATH } from '../lib/paths.js'

let db: Database | null = null

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function getDb(): Database {
  if (!db) {
    ensureDataDir()
    db = new Database(DB_PATH)
    db.run('PRAGMA journal_mode = WAL')
    initSchema()
  }
  return db
}

function initSchema(): void {
  const database = db!
  
  database.run(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    )
  `)

  database.run('CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)')
  database.run('CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC)')
}

export const DatabaseService = {
  getAllChats(): Chat[] {
    const database = getDb()
    
    const chats = database.query(`
      SELECT id, title, created_at as createdAt, updated_at as updatedAt
      FROM chats
      ORDER BY updated_at DESC
    `).all() as Array<{ id: string; title: string; createdAt: number; updatedAt: number }>

    const getMessages = database.query(`
      SELECT id, role, content
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
    
    const chat = database.query(`
      SELECT id, title, created_at as createdAt
      FROM chats
      WHERE id = ?
    `).get(id) as { id: string; title: string; createdAt: number } | null

    if (!chat) return null

    const messages = database.query(`
      SELECT id, role, content
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

    database.run(`
      INSERT INTO chats (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `, [id, title, now, now])

    return {
      id,
      title,
      createdAt: now,
      messages: [],
    }
  },

  updateChatTitle(id: string, title: string): void {
    const database = getDb()
    database.run(`
      UPDATE chats SET title = ?, updated_at = ? WHERE id = ?
    `, [title, Date.now(), id])
  },

  deleteChat(id: string): void {
    const database = getDb()
    database.run('DELETE FROM messages WHERE chat_id = ?', [id])
    database.run('DELETE FROM chats WHERE id = ?', [id])
  },

  addMessage(chatId: string, role: 'user' | 'assistant', content: string): void {
    const database = getDb()
    const now = Date.now()

    database.run(`
      INSERT INTO messages (chat_id, role, content, created_at)
      VALUES (?, ?, ?, ?)
    `, [chatId, role, content, now])

    database.run(`
      UPDATE chats SET updated_at = ? WHERE id = ?
    `, [now, chatId])
  },

  updateLastMessage(chatId: string, content: string): void {
    const database = getDb()
    
    database.run(`
      UPDATE messages
      SET content = ?
      WHERE id = (
        SELECT id FROM messages
        WHERE chat_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      )
    `, [content, chatId])
  },

  close(): void {
    if (db) {
      db.close()
      db = null
    }
  },
}
