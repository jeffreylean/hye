import { useRef, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useConfigStore } from '@/store/configStore'
import { useChatStore } from '@/store/chatStore'
import { Send, Bot, User, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getApi } from '@/lib/api'

export function Chat() {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const currentProvider = useConfigStore((s) => s.currentProvider)
  const { chats, currentChatId, createChat, addMessage, updateLastMessage } = useChatStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const currentChat = chats.find(c => c.id === currentChatId)
  const messages = currentChat?.messages ?? []

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages.length])

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    let chatId = currentChatId
    if (!chatId) {
      chatId = createChat()
    }

    const userInput = input.trim()
    addMessage(chatId, { role: 'user', content: userInput })
    setInput('')
    setIsLoading(true)
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    addMessage(chatId, { role: 'assistant', content: '' })

    try {
      if (!currentProvider) {
        updateLastMessage(chatId, 'Please configure an AI provider in Settings first.')
        return
      }

      let streamContent = ''
      const api = getApi()

      const result = await api.llm.stream(
        [{ role: 'user', content: userInput }],
        {
          provider: currentProvider.type,
          apiKey: currentProvider.apiKey,
          baseUrl: currentProvider.baseUrl,
          model: currentProvider.model,
        },
        (chunk: string) => {
          streamContent += chunk
          updateLastMessage(chatId!, streamContent)
        }
      )

      if (!result?.success) {
        updateLastMessage(chatId!, `Error: ${result?.error || 'Unknown error'}`)
      }
    } catch (error) {
      updateLastMessage(chatId!, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">How can I help?</h1>
            <p className="text-muted-foreground">
              {currentProvider 
                ? "Start a conversation by typing a message below."
                : "Configure an AI provider in Settings to get started."}
            </p>
            {!currentProvider && (
              <div className="inline-flex items-center gap-2 text-sm text-orange-600 bg-orange-50 dark:bg-orange-950/50 px-3 py-2 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                No provider configured
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((message) => (
              <div key={message.id} className="flex gap-4">
                <div className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                  message.role === 'user' 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted"
                )}>
                  {message.role === 'user' 
                    ? <User className="h-4 w-4" /> 
                    : <Bot className="h-4 w-4" />}
                </div>
                <div className="flex-1 space-y-2 pt-1">
                  <p className="text-sm font-medium">
                    {message.role === 'user' ? 'You' : 'Assistant'}
                  </p>
                  <div className="text-sm text-foreground/90 whitespace-pre-wrap">
                    {message.content || (
                      <span className="text-muted-foreground italic">Thinking...</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      <div className="border-t bg-background p-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-2 rounded-xl border bg-background p-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                adjustTextareaHeight()
              }}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            <Button 
              onClick={sendMessage} 
              disabled={isLoading || !input.trim()}
              size="icon"
              className="h-8 w-8 rounded-lg shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            {currentProvider 
              ? `Using ${currentProvider.model || currentProvider.type}`
              : 'No provider configured'}
          </p>
        </div>
      </div>
    </div>
  )
}
