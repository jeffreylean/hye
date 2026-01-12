import { useEffect } from 'react'
import { useMemoryStore, type ExtractedItem } from '@/store/memoryStore'
import { useChatStore } from '@/store/chatStore'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Brain, Loader2, FileText, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

function ImportanceBadge({ importance }: { importance: ExtractedItem['importance'] }) {
  const colors = {
    high: 'bg-red-500/10 text-red-600 dark:text-red-400',
    medium: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    low: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  }

  return (
    <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', colors[importance])}>
      {importance}
    </span>
  )
}

function ExtractedItemRow({ item }: { item: ExtractedItem }) {
  const { toggleItemSelection } = useMemoryStore()

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 transition-colors',
        item.selected ? 'border-primary/50 bg-primary/5' : 'border-border bg-background'
      )}
    >
      <Checkbox
        id={item.id}
        checked={item.selected}
        onCheckedChange={() => toggleItemSelection(item.id)}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <label
            htmlFor={item.id}
            className="cursor-pointer truncate font-medium text-sm"
          >
            {item.title}
          </label>
          <ImportanceBadge importance={item.importance} />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.suggestedPath}</p>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.summary}</p>
        {item.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {item.tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function SaveToMemoryModal() {
  const currentChatId = useChatStore((s) => s.currentChatId)
  const currentChat = useChatStore((s) => s.chats.find((c) => c.id === s.currentChatId))

  const {
    isSaveModalOpen,
    closeSaveModal,
    extractedItems,
    isAnalyzing,
    isSaving,
    analyzeError,
    analyzeConversation,
    selectAllItems,
    deselectAllItems,
    saveSelectedItems,
  } = useMemoryStore()

  const selectedCount = extractedItems.filter((item) => item.selected).length

  useEffect(() => {
    if (isSaveModalOpen && currentChatId && currentChat && extractedItems.length === 0 && !isAnalyzing) {
      const messages = currentChat.messages
        .filter((m) => m.content.trim().length > 0)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }))

      if (messages.length > 0) {
        analyzeConversation(currentChatId, messages)
      }
    }
  }, [isSaveModalOpen, currentChatId, currentChat, extractedItems.length, isAnalyzing, analyzeConversation])

  const handleSave = () => {
    if (currentChatId) {
      saveSelectedItems(currentChatId)
    }
  }

  return (
    <Dialog open={isSaveModalOpen} onOpenChange={(open) => !open && closeSaveModal()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Save to Memory
          </DialogTitle>
          <DialogDescription>
            Select the items you want to save from this conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="mt-2 text-sm">Analyzing conversation...</p>
            </div>
          )}

          {analyzeError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {analyzeError}
            </div>
          )}

          {!isAnalyzing && !analyzeError && extractedItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8" />
              <p className="mt-2 text-sm">No notable items found in this conversation.</p>
            </div>
          )}

          {!isAnalyzing && extractedItems.length > 0 && (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Found {extractedItems.length} {extractedItems.length === 1 ? 'item' : 'items'}
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAllItems}>
                    Select all
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={deselectAllItems}>
                    Deselect all
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[300px] pr-3">
                <div className="space-y-2">
                  {extractedItems.map((item) => (
                    <ExtractedItemRow key={item.id} item={item} />
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeSaveModal} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || selectedCount === 0}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              `Save Selected (${selectedCount})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
