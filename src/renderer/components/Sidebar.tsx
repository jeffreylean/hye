import { useState } from 'react'
import { useUIStore } from '@/store/uiStore'
import { useConfigStore } from '@/store/configStore'
import { useChatStore } from '@/store/chatStore'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MessageSquare, Settings, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const { currentView, setCurrentView } = useUIStore()
  const currentProvider = useConfigStore((s) => s.currentProvider)
  const { chats, currentChatId, createChat, deleteChat, setCurrentChat } = useChatStore()
  const [chatToDelete, setChatToDelete] = useState<string | null>(null)

  const handleNewChat = () => {
    createChat()
    setCurrentView('chat')
  }

  const handleSelectChat = (id: string) => {
    setCurrentChat(id)
    setCurrentView('chat')
  }

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setChatToDelete(id)
  }

  const handleConfirmDelete = () => {
    if (chatToDelete) {
      deleteChat(chatToDelete)
      setChatToDelete(null)
    }
  }

  return (
    <aside className="w-56 border-r bg-muted/30 flex flex-col h-full">
      <div className="p-3 border-b">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={handleNewChat}
        >
          <Plus className="h-4 w-4" />
          New Chat
          <span className="ml-auto text-xs text-muted-foreground">
            {navigator.platform.includes('Mac') ? '⌘N' : 'Ctrl+N'}
          </span>
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={cn(
              "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors",
              currentChatId === chat.id && currentView === 'chat'
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            )}
            onClick={() => handleSelectChat(chat.id)}
          >
            <MessageSquare className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 truncate">{chat.title}</span>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
                currentChatId === chat.id && currentView === 'chat'
                  ? "hover:bg-primary-foreground/20 text-primary-foreground"
                  : "hover:bg-destructive/10 text-destructive"
              )}
              onClick={(e) => handleDeleteClick(e, chat.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {chats.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No chats yet
          </p>
        )}
      </div>

      <div className="mt-auto p-3 border-t flex flex-col gap-2">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2",
            currentView === 'settings' && "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          onClick={() => setCurrentView('settings')}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Button>
        <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
          <div 
            className={cn(
              "h-2 w-2 rounded-full",
              currentProvider ? "bg-green-500" : "bg-orange-400"
            )} 
          />
          {currentProvider ? currentProvider.type : 'No provider'}
        </div>
      </div>

      <Dialog open={chatToDelete !== null} onOpenChange={(open) => !open && setChatToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete chat</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this chat? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChatToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
