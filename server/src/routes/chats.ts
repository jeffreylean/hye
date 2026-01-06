import type { BunRequest } from 'bun'
import { DatabaseService } from '../services/database.js'
import { jsonResponse, errorResponse, parseJsonBody } from '../lib/http.js'

async function createChat(req: BunRequest): Promise<Response> {
  const body = await parseJsonBody<{ id: string; title: string }>(req)
  const chat = DatabaseService.createChat(body.id, body.title)
  return jsonResponse(chat)
}

function getChat(req: BunRequest<'/api/chats/:id'>): Response {
  const { id } = req.params
  const chat = DatabaseService.getChat(id)
  if (!chat) {
    return errorResponse('Chat not found', 404)
  }
  return jsonResponse(chat)
}

function deleteChat(req: BunRequest<'/api/chats/:id'>): Response {
  const { id } = req.params
  DatabaseService.deleteChat(id)
  return jsonResponse({ success: true })
}

async function updateChatTitle(req: BunRequest<'/api/chats/:id/title'>): Promise<Response> {
  const { id } = req.params
  const body = await parseJsonBody<{ title: string }>(req)
  DatabaseService.updateChatTitle(id, body.title)
  return jsonResponse({ success: true })
}

async function addMessage(req: BunRequest<'/api/chats/:chatId/messages'>): Promise<Response> {
  const { chatId } = req.params
  const body = await parseJsonBody<{ role: 'user' | 'assistant'; content: string }>(req)
  DatabaseService.addMessage(chatId, body.role, body.content)
  return jsonResponse({ success: true })
}

async function updateLastMessage(req: BunRequest<'/api/chats/:chatId/messages/last'>): Promise<Response> {
  const { chatId } = req.params
  const body = await parseJsonBody<{ content: string }>(req)
  DatabaseService.updateLastMessage(chatId, body.content)
  return jsonResponse({ success: true })
}

export const chatRoutes = {
  '/api/chats': {
    GET: () => jsonResponse(DatabaseService.getAllChats()),
    POST: createChat,
  },
  '/api/chats/:id': {
    GET: getChat,
    DELETE: deleteChat,
  },
  '/api/chats/:id/title': {
    PUT: updateChatTitle,
  },
  '/api/chats/:chatId/messages': {
    POST: addMessage,
  },
  '/api/chats/:chatId/messages/last': {
    PUT: updateLastMessage,
  },
}
