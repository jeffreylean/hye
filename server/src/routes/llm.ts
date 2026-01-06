import type { ModelMessage } from 'ai'
import type { BunRequest } from 'bun'
import { LLMService } from '../services/llm/index.js'
import type { LLMConfig } from '../services/llm/types.js'
import { jsonResponse, sseResponse, parseJsonBody } from '../lib/http.js'

async function generate(req: BunRequest): Promise<Response> {
  try {
    const body = await parseJsonBody<{ messages: ModelMessage[]; config: LLMConfig }>(req)
    const service = new LLMService(body.config)
    const result = await service.generateResponse(body.messages)
    return jsonResponse({ success: true, data: result })
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

async function stream(req: BunRequest): Promise<Response> {
  try {
    const body = await parseJsonBody<{ messages: ModelMessage[]; config: LLMConfig }>(req)
    const service = new LLMService(body.config)

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of service.streamResponse(body.messages)) {
            const data = JSON.stringify({ chunk, done: false })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: '', done: true })}\n\n`))
        } catch (error) {
          const errorData = JSON.stringify({
            chunk: '',
            done: true,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
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

export const llmRoutes = {
  '/api/llm/providers': {
    GET: () => jsonResponse(LLMService.getSupportedProviders()),
  },
  '/api/llm/generate': {
    POST: generate,
  },
  '/api/llm/stream': {
    POST: stream,
  },
}
