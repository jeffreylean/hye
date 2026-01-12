import type { BunRequest } from 'bun'
import { createAgentRunner, type AgentRunner } from '../services/agent/index.js'
import { jsonResponse, sseResponse, parseJsonBody } from '../lib/http.js'

const agents = new Map<string, AgentRunner>()

interface InitBody {
  sessionId: string
  projectRoot?: string
  maxSteps?: number
}

interface ChatBody {
  sessionId: string
  message: string
}

interface ClearBody {
  sessionId: string
}

async function init(req: BunRequest): Promise<Response> {
  try {
    const body = await parseJsonBody<InitBody>(req)
    const { sessionId, projectRoot, maxSteps } = body

    const agent = createAgentRunner({ projectRoot, maxSteps })
    agents.set(sessionId, agent)

    return jsonResponse({ success: true, sessionId })
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

async function chat(req: BunRequest): Promise<Response> {
  try {
    const body = await parseJsonBody<ChatBody>(req)
    const { sessionId, message } = body

    let agent = agents.get(sessionId)
    if (!agent) {
      agent = createAgentRunner()
      agents.set(sessionId, agent)
    }

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        }

        try {
          const result = await agent.chat(message, {
            onText: (text) => send('text', { text }),
            onToolCall: (id, name, args) => send('tool:call', { id, name, args }),
            onToolResult: (id, name, result, isError) => send('tool:result', { id, name, result, isError }),
            onError: (error) => send('error', { error: error.message }),
          })

          send('complete', { success: result.success, text: result.text, error: result.error })
        } catch (error) {
          send('error', { error: error instanceof Error ? error.message : 'Unknown error' })
        } finally {
          controller.close()
        }
      },
    })

    return sseResponse(readableStream)
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

async function clear(req: BunRequest): Promise<Response> {
  try {
    const body = await parseJsonBody<ClearBody>(req)
    const { sessionId } = body

    const agent = agents.get(sessionId)
    if (agent) {
      agent.clearHistory()
    }

    return jsonResponse({ success: true })
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

function deleteSession(req: BunRequest): Response {
  const url = new URL(req.url)
  const sessionId = url.pathname.split('/').pop()

  if (sessionId) {
    agents.delete(sessionId)
  }

  return jsonResponse({ success: true })
}

export const agentRoutes = {
  '/api/agent/init': {
    POST: init,
  },
  '/api/agent/chat': {
    POST: chat,
  },
  '/api/agent/clear': {
    POST: clear,
  },
  '/api/agent/session/:sessionId': {
    DELETE: deleteSession,
  },
}
