# Chat Pagination & Lazy Loading

## Problem

When chat history grows large, loading all messages at once causes:
- Slow initial load times
- High memory usage
- Poor UX for long conversations

## Current State

- Messages stored in SQLite (`messages` table)
- `chatStore.loadChats()` fetches all messages per chat on startup
- assistant-ui's `ThreadHistoryAdapter` loads all messages at once

## assistant-ui Capabilities

### What's Built-in

| Feature | Status |
|---------|--------|
| `ThreadHistoryAdapter` | ✅ Interface for loading/persisting history |
| `isLoading` state | ✅ Tracks when history is loading |
| `Viewport` auto-scroll | ✅ Handles scroll behavior |
| Lazy loading | ❌ Not provided |
| Infinite scroll | ❌ Not provided |
| Message virtualization | ❌ Not provided |

### Key APIs

```typescript
// ThreadHistoryAdapter interface
export type ThreadHistoryAdapter = {
  load(): Promise<ExportedMessageRepository>;
  append(item: ExportedMessageRepositoryItem): Promise<void>;
};

// Access loading state in components
const isLoading = useAssistantState(({ thread }) => thread.isLoading);

// Append older messages to thread
useThreadRuntime().append(olderMessages);
```

### Viewport Configuration

```tsx
<ThreadPrimitive.Viewport
  turnAnchor="bottom"
  autoScroll={true}
  scrollToBottomOnInitialize={true}
  scrollToBottomOnRunStart={true}
  scrollToBottomOnThreadSwitch={true}
>
  <ThreadPrimitive.Messages components={{ Message: MyMessage }} />
</ThreadPrimitive.Viewport>
```

## Proposed Solution

### 1. Database Layer

Add pagination to `DatabaseService`:

```typescript
// src/main/services/database.ts

getMessages(chatId: string, limit: number, offset: number): Message[] {
  return database.prepare(`
    SELECT role, content, created_at
    FROM messages
    WHERE chat_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(chatId, limit, offset).reverse();
}

getMessageCount(chatId: string): number {
  const result = database.prepare(`
    SELECT COUNT(*) as count FROM messages WHERE chat_id = ?
  `).get(chatId);
  return result.count;
}
```

### 2. IPC Bridge

Expose pagination methods:

```typescript
// Main process
ipcMain.handle('db:getMessages', (_event, chatId, limit, offset) => {
  return DatabaseService.getMessages(chatId, limit, offset);
});

ipcMain.handle('db:getMessageCount', (_event, chatId) => {
  return DatabaseService.getMessageCount(chatId);
});
```

### 3. Custom History Adapter

Implement paginated loading:

```typescript
// src/renderer/hooks/useAssistantRuntime.ts

const PAGE_SIZE = 50;

const historyAdapter: ThreadHistoryAdapter = {
  async load() {
    const chatId = useChatStore.getState().currentChatId;
    if (!chatId) return { messages: [] };
    
    // Load most recent messages first
    const messages = await window.electronAPI.db.getMessages(chatId, PAGE_SIZE, 0);
    return { messages: formatMessages(messages) };
  },
  
  async append(message) {
    // Existing append logic
  },
};
```

### 4. Infinite Scroll Component

Create scroll handler to load older messages:

```typescript
// src/renderer/components/ChatScrollHandler.tsx

function ChatScrollHandler() {
  const runtime = useThreadRuntime();
  const { currentChatId } = useChatStore();
  const [offset, setOffset] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(true);
  
  const loadOlder = async () => {
    if (!hasMore || !currentChatId) return;
    
    const older = await window.electronAPI.db.getMessages(
      currentChatId, 
      PAGE_SIZE, 
      offset
    );
    
    if (older.length < PAGE_SIZE) {
      setHasMore(false);
    }
    
    if (older.length > 0) {
      runtime.append(formatMessages(older));
      setOffset(prev => prev + PAGE_SIZE);
    }
  };
  
  return (
    <IntersectionObserver onIntersect={loadOlder}>
      {hasMore && <LoadingSpinner />}
    </IntersectionObserver>
  );
}
```

### 5. Optional: Virtual Scrolling

For very large histories (1000+ messages), consider:
- `react-window` or `@tanstack/virtual`
- Render only visible messages
- Use `ThreadPrimitive.MessageByIndex` for specific indices

## Implementation Order

1. Add pagination queries to `DatabaseService`
2. Expose IPC methods
3. Update `useAssistantRuntime` with paginated `ThreadHistoryAdapter`
4. Add scroll detection component
5. (Optional) Add virtual scrolling for extreme cases

## References

- [assistant-ui ThreadHistoryAdapter](https://github.com/assistant-ui/assistant-ui/blob/main/packages/react/src/legacy-runtime/runtime-cores/adapters/thread-history/ThreadHistoryAdapter.ts)
- [assistant-ui ThreadPrimitive.Viewport](https://github.com/assistant-ui/assistant-ui/blob/main/packages/react/src/primitives/thread/ThreadViewport.tsx)
- [useRemoteThreadListRuntime docs](https://docs.assistant-ui.com/docs/runtimes/custom/local)
