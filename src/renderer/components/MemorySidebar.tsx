import { useEffect, useState, useRef, useCallback, memo } from 'react'
import { useMemoryStore, type MemoryTreeEntry } from '@/store/memoryStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Brain,
  Search,
  Folder,
  FileText,
  ChevronRight,
  ChevronDown,
  X,
  GripVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const TreeNode = memo(function TreeNode({ entry, depth = 0 }: { entry: MemoryTreeEntry; depth?: number }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const fetchNote = useMemoryStore((s) => s.fetchNote)
  const selectedFilepath = useMemoryStore((s) => s.selectedNote?.filepath)

  const isSelected = selectedFilepath === entry.path

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  const handleSelect = useCallback(() => {
    fetchNote(entry.path)
  }, [fetchNote, entry.path])

  if (entry.type === 'directory') {
    return (
      <div>
        <button
          className={cn(
            'flex w-full items-center gap-1 rounded px-2 py-1 text-sm hover:bg-muted',
            'text-left'
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={handleToggle}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
          <Folder className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{entry.name}</span>
        </button>
        {isExpanded && entry.children && (
          <div>
            {entry.children.map((child) => (
              <TreeNode key={child.path} entry={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted',
        'text-left',
        isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90'
      )}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
      onClick={handleSelect}
    >
      <FileText className="h-4 w-4 flex-shrink-0" />
      <span className="truncate">{entry.name.replace('.md', '')}</span>
    </button>
  )
})



interface MemorySidebarProps {
  width: number
  onWidthChange: (width: number) => void
  onClose: () => void
}

export function MemorySidebar({ width, onWidthChange, onClose }: MemorySidebarProps) {
  const { tree, isLoading, error, fetchTree } = useMemoryStore()
  const [searchQuery, setSearchQuery] = useState('')
  const isResizing = useRef(false)

  useEffect(() => {
    fetchTree()
  }, [fetchTree])

  const noteCount = countNotes(tree)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const newWidth = window.innerWidth - e.clientX
      const clampedWidth = Math.min(Math.max(newWidth, 200), 500)
      onWidthChange(clampedWidth)
    }

    const handleMouseUp = () => {
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onWidthChange])

  return (
    <aside
      className="relative flex h-full flex-col bg-muted/30"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 z-10 flex h-full w-1 cursor-col-resize items-center justify-center hover:bg-primary/20"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute -left-1 flex h-8 w-3 items-center justify-center rounded-sm bg-border opacity-0 hover:opacity-100">
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4" />
          <span className="font-medium">Memory</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            className="h-8 pl-8 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tree */}
      <ScrollArea className="flex-1 px-1">
        {isLoading && (
          <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
        )}
        {error && <div className="p-4 text-center text-sm text-destructive">{error}</div>}
        {!isLoading && !error && tree.length === 0 && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No notes saved yet
          </div>
        )}
        {!isLoading && !error && tree.length > 0 && (
          <div className="py-1">
            {tree.map((entry) => (
              <TreeNode key={entry.path} entry={entry} />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
        {noteCount} {noteCount === 1 ? 'note' : 'notes'}
      </div>
    </aside>
  )
}

function countNotes(entries: MemoryTreeEntry[]): number {
  let count = 0
  for (const entry of entries) {
    if (entry.type === 'file') {
      count++
    } else if (entry.children) {
      count += countNotes(entry.children)
    }
  }
  return count
}
