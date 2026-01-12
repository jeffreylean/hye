import { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useMemoryStore } from '@/store/memoryStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FileText, Folder, Calendar, Tag, Copy, Trash2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

function stripFrontmatter(content: string): string {
  const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n?/
  return content.replace(frontmatterRegex, '').trim()
}

export function NoteViewer() {
  const { selectedNote, noteContent, setSelectedNote, setNoteContent, deleteNote, setActiveTab } =
    useMemoryStore()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [copied, setCopied] = useState(false)

  const markdownContent = useMemo(() => {
    return noteContent ? stripFrontmatter(noteContent) : ''
  }, [noteContent])

  if (!selectedNote || !noteContent) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <FileText className="mb-4 h-12 w-12 opacity-50" />
        <p>Select a note from the Memory panel to view</p>
      </div>
    )
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(noteContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = () => {
    deleteNote(selectedNote.filepath)
    setShowDeleteConfirm(false)
    setActiveTab('chat')
  }

  const handleClose = () => {
    setSelectedNote(null)
    setNoteContent(null)
    setActiveTab('chat')
  }

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{selectedNote.title}</h1>
              <p className="text-sm text-muted-foreground">{selectedNote.summary}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="mr-1.5 h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Back to Chat
            </Button>
          </div>
        </div>

        <div className="flex gap-4 border-b bg-muted/30 px-6 py-3 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Folder className="h-4 w-4" />
            <span>{selectedNote.filepath}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{new Date(selectedNote.createdAt).toLocaleDateString()}</span>
          </div>
          {selectedNote.tags.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <div className="flex gap-1">
                {selectedNote.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-3xl px-6 py-6">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ className, ...props }) => (
                  <h1
                    className={cn(
                      'mb-6 scroll-m-20 text-3xl font-bold tracking-tight',
                      className
                    )}
                    {...props}
                  />
                ),
                h2: ({ className, ...props }) => (
                  <h2
                    className={cn(
                      'mb-4 mt-8 scroll-m-20 text-2xl font-semibold tracking-tight first:mt-0',
                      className
                    )}
                    {...props}
                  />
                ),
                h3: ({ className, ...props }) => (
                  <h3
                    className={cn(
                      'mb-3 mt-6 scroll-m-20 text-xl font-semibold tracking-tight first:mt-0',
                      className
                    )}
                    {...props}
                  />
                ),
                p: ({ className, ...props }) => (
                  <p
                    className={cn('mb-4 leading-7 last:mb-0', className)}
                    {...props}
                  />
                ),
                ul: ({ className, ...props }) => (
                  <ul
                    className={cn('mb-4 ml-6 list-disc [&>li]:mt-2', className)}
                    {...props}
                  />
                ),
                ol: ({ className, ...props }) => (
                  <ol
                    className={cn('mb-4 ml-6 list-decimal [&>li]:mt-2', className)}
                    {...props}
                  />
                ),
                blockquote: ({ className, ...props }) => (
                  <blockquote
                    className={cn('mb-4 border-l-4 border-primary/30 pl-4 italic', className)}
                    {...props}
                  />
                ),
                code: ({ className, children, ...props }) => {
                  const isInline = !className?.includes('language-')
                  if (isInline) {
                    return (
                      <code
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm"
                        {...props}
                      >
                        {children}
                      </code>
                    )
                  }
                  return (
                    <code className={cn('font-mono text-sm', className)} {...props}>
                      {children}
                    </code>
                  )
                },
                pre: ({ className, ...props }) => (
                  <pre
                    className={cn(
                      'mb-4 overflow-x-auto rounded-lg bg-muted p-4',
                      className
                    )}
                    {...props}
                  />
                ),
                a: ({ className, ...props }) => (
                  <a
                    className={cn(
                      'font-medium text-primary underline underline-offset-4',
                      className
                    )}
                    {...props}
                  />
                ),
                table: ({ className, ...props }) => (
                  <div className="mb-4 overflow-x-auto">
                    <table
                      className={cn('w-full border-collapse text-sm', className)}
                      {...props}
                    />
                  </div>
                ),
                th: ({ className, ...props }) => (
                  <th
                    className={cn(
                      'border bg-muted px-3 py-2 text-left font-semibold',
                      className
                    )}
                    {...props}
                  />
                ),
                td: ({ className, ...props }) => (
                  <td className={cn('border px-3 py-2', className)} {...props} />
                ),
                hr: ({ ...props }) => <hr className="my-6 border-border" {...props} />,
              }}
            >
              {markdownContent}
            </ReactMarkdown>
          </div>
        </ScrollArea>
      </div>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete note</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedNote.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
