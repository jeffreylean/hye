import { useEffect } from 'react'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { useAssistantRuntime } from '@/hooks/useAssistantRuntime'
import { useUIStore } from '@/store/uiStore'
import { useConfigStore } from '@/store/configStore'
import { useChatStore } from '@/store/chatStore'
import { useTheme } from '@/hooks/useTheme'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ProviderConfig } from '@/components/ProviderConfig'
import { Thread } from '@/components/assistant-ui/thread'
import { Sidebar } from '@/components/Sidebar'

function App() {
  const runtime = useAssistantRuntime()
  const currentView = useUIStore((s) => s.currentView)
  const loadConfig = useConfigStore((s) => s.loadConfig)
  const loadChats = useChatStore((s) => s.loadChats)

  useTheme()
  useKeyboardShortcuts()

  useEffect(() => {
    loadConfig()
    loadChats()
  }, [loadConfig, loadChats])

  return (
    <TooltipProvider>
      <AssistantRuntimeProvider runtime={runtime}>
        <div className="h-screen flex bg-background">
          <Sidebar />
          <main className="flex-1 flex flex-col overflow-hidden">
            {currentView === 'chat' && <Thread />}
            {currentView === 'settings' && <ProviderConfig />}
          </main>
        </div>
      </AssistantRuntimeProvider>
    </TooltipProvider>
  )
}

export default App
