import { useChatStore } from '@/store/chatStore'
import { useMemoryStore } from '@/store/memoryStore'
import { Button } from '@/components/ui/button'
import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button'
import { Brain, Save } from 'lucide-react'

export function ChatHeader() {
  const currentChat = useChatStore((s) => s.chats.find((c) => c.id === s.currentChatId))
  const { openSaveModal, toggleOpen, isOpen } = useMemoryStore()

  const hasMessages = currentChat && currentChat.messages.length > 0

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
      <div className="flex items-center gap-2 truncate">
        <span className="truncate text-sm font-medium text-foreground">
          {currentChat?.title ?? 'New Chat'}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {hasMessages && (
          <TooltipIconButton
            tooltip="Save to Memory"
            variant="ghost"
            className="h-8 w-8"
            onClick={openSaveModal}
          >
            <Save className="h-4 w-4" />
          </TooltipIconButton>
        )}
        <TooltipIconButton
          tooltip={isOpen ? 'Hide Memory' : 'Show Memory'}
          variant="ghost"
          className="h-8 w-8"
          onClick={toggleOpen}
        >
          <Brain className="h-4 w-4" />
        </TooltipIconButton>
      </div>
    </div>
  )
}
