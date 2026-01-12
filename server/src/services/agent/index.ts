import { streamText, stepCountIs, type ModelMessage } from 'ai'
import { ConfigService } from '../config.js'
import { ProviderFactory } from '../llm/ProviderFactory.js'
import { SYSTEM_PROMPT } from './prompts/system.js'
import { createTools } from './tools/index.js'

export interface AgentOptions {
  projectRoot?: string
  maxSteps?: number
}

export interface AgentCallbacks {
  onText?: (text: string) => void
  onToolCall?: (id: string, name: string, args: unknown) => void
  onToolResult?: (id: string, name: string, result: unknown, isError?: boolean) => void
  onError?: (error: Error) => void
}

export interface AgentChatResult {
  success: boolean
  text?: string
  error?: string
}

export function createAgentRunner(options: AgentOptions = {}) {
  const { projectRoot, maxSteps = 20 } = options

  const tools = createTools({ projectRoot })
  const history: ModelMessage[] = []

  function getModel() {
    const provider = ConfigService.getCurrentProvider()
    if (!provider) {
      throw new Error('No provider configured. Please configure an LLM provider first.')
    }

    const llmProvider = ProviderFactory.create({
      provider: provider.type,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      model: provider.model,
    })

    return llmProvider.createModel(provider.model)
  }

  return {
    async chat(message: string, callbacks: AgentCallbacks = {}): Promise<AgentChatResult> {
      history.push({ role: 'user', content: message })

      try {
        const model = getModel()

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: history,
          tools,
          stopWhen: stepCountIs(maxSteps),
          onStepFinish: ({ staticToolCalls, staticToolResults }) => {
            if (staticToolCalls?.length) {
              for (const call of staticToolCalls) {
                callbacks.onToolCall?.(call.toolCallId, call.toolName, call.input)
              }
            }
            if (staticToolResults?.length) {
              for (const res of staticToolResults) {
                callbacks.onToolResult?.(res.toolCallId, res.toolName, res.output, res.isError)
              }
            }
          },
          onError: ({ error }) => {
            callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
          },
        })

        let fullText = ''
        for await (const chunk of result.textStream) {
          fullText += chunk
          callbacks.onText?.(chunk)
        }

        if (fullText) {
          history.push({ role: 'assistant', content: fullText })
        }

        return { success: true, text: fullText }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        callbacks.onError?.(err)
        return { success: false, error: err.message }
      }
    },

    clearHistory() {
      history.length = 0
    },

    getHistory(): ModelMessage[] {
      return [...history]
    },
  }
}

export type AgentRunner = ReturnType<typeof createAgentRunner>
