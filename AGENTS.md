# Hye - Electron Desktop Chat App

## Development Guidelines
- For UI, if you need reference. You can always refer to https://codebase.md/assistant-ui/assistant-ui to check for codebase for implementation.

## Commands
- `bun install` - Install dependencies (runs electron-rebuild automatically)
- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run type-check` - TypeScript type checking
- `bun run lint` - ESLint (strict, no warnings allowed)

## Architecture
- **Electron + React + TypeScript** with electron-vite
- `src/main/` - Electron main process (Node.js runtime, IPC handlers, SQLite)
- `src/preload/` - Preload scripts exposing IPC bridge via `window.electronAPI`
- `src/renderer/` - React frontend (components, hooks, stores)
- `src/shared/` - Shared types between main/renderer processes
- **State**: Zustand stores (`configStore`, `chatStore`, `uiStore`)
- **Database**: SQLite via better-sqlite3 (stored in app userData)
- **Chat UI**: assistant-ui library with custom runtime adapter

## Workflow
- Always run `bun run type-check` after generating or modifying code

## Code Style
- Use `bun` as package manager (never npm/pnpm)
- Imports: Use `@/` or `@renderer/` path alias for renderer imports
- TypeScript: Strict mode, no `any`, no `@ts-ignore`
- Components: Functional components with hooks, shadcn/ui primitives
- Naming: camelCase for variables/functions, PascalCase for components/types
- Prefer type inference over explicit typing when clear

## TypeScript Guidelines
- Leverage advanced types: conditional types, mapped types, template literal types
- Use generic constraints for flexible, type-safe APIs
- Create reusable utility types for common patterns
- Design APIs with proper error handling and type safety
