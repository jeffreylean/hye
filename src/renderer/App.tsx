import { useEffect, useState } from 'react'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { useAssistantRuntime } from '@/hooks/useAssistantRuntime'
import { useUIStore } from '@/store/uiStore'
import { useConfigStore } from '@/store/configStore'
import { useChatStore } from '@/store/chatStore'
import { useMemoryStore } from '@/store/memoryStore'
import { useTheme } from '@/hooks/useTheme'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProviderConfig } from '@/components/ProviderConfig'
import { Thread } from '@/components/assistant-ui/thread'
import { Sidebar } from '@/components/Sidebar'
import { MemorySidebar } from '@/components/MemorySidebar'
import { SaveToMemoryModal } from '@/components/SaveToMemoryModal'
import { NoteViewer } from '@/components/NoteViewer'
import { MessageSquare, FileText } from 'lucide-react'

function App() {
  const runtime = useAssistantRuntime()
  const currentView = useUIStore((s) => s.currentView)
  const loadConfig = useConfigStore((s) => s.loadConfig)
  const loadChats = useChatStore((s) => s.loadChats)
  const { isOpen: memoryOpen, setOpen: setMemoryOpen, activeTab, setActiveTab, selectedNote } =
    useMemoryStore()
  const [memoryWidth, setMemoryWidth] = useState(280)

  useTheme()
  useKeyboardShortcuts()

  useEffect(() => {
    loadConfig()
    loadChats()
  }, [loadConfig, loadChats])

  return (
    <TooltipProvider>
      <AssistantRuntimeProvider runtime={runtime}>
        <div className="h-full w-full flex overflow-hidden bg-background">
          <div className="w-56 shrink-0 h-full">
            <Sidebar />
          </div>

          <main className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
            {currentView === 'chat' && (
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as 'chat' | 'note')}
                className="flex h-full flex-col"
              >
                <div className="flex items-center border-b px-4">
                  <TabsList className="h-10 bg-transparent p-0">
                    <TabsTrigger
                      value="chat"
                      className="gap-1.5 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Chat
                    </TabsTrigger>
                    {selectedNote && (
                      <TabsTrigger
                        value="note"
                        className="gap-1.5 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                      >
                        <FileText className="h-4 w-4" />
                        {selectedNote.title}
                      </TabsTrigger>
                    )}
                  </TabsList>
                </div>
                <TabsContent value="chat" className="mt-0 flex-1 overflow-hidden">
                  <Thread />
                </TabsContent>
                <TabsContent value="note" className="mt-0 flex-1 overflow-hidden">
                  <NoteViewer />
                </TabsContent>
              </Tabs>
            )}
            {currentView === 'settings' && <ProviderConfig />}
          </main>

          {memoryOpen && (
            <MemorySidebar
              width={memoryWidth}
              onWidthChange={setMemoryWidth}
              onClose={() => setMemoryOpen(false)}
            />
          )}
        </div>

        <SaveToMemoryModal />
      </AssistantRuntimeProvider>
    </TooltipProvider>
  )
}

export default App
