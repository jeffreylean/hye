import { useEffect } from 'react'
import { useChatStore } from '@/store/chatStore'
import { useUIStore } from '@/store/uiStore'

export function useKeyboardShortcuts() {
  const createChat = useChatStore((s) => s.createChat)
  const setCurrentView = useUIStore((s) => s.setCurrentView)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.includes('Mac')
      const modifier = isMac ? e.metaKey : e.ctrlKey

      if (modifier && e.key === 'n') {
        e.preventDefault()
        createChat()
        setCurrentView('chat')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [createChat, setCurrentView])
}
