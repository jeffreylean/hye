import { Effect, pipe, Schedule } from "effect"

export class ConfigError extends Error {
  readonly _tag = "ConfigError"
}

export class DatabaseError extends Error {
  readonly _tag = "DatabaseError"
}

export class LLMError extends Error {
  readonly _tag = "LLMError"
}

export class AgentError extends Error {
  readonly _tag = "AgentError"
}

export const safeExecute = <A, E extends Error>(
  computation: () => Promise<A>,
  errorType: new (message: string) => E
) =>
  Effect.tryPromise({
    try: computation,
    catch: (error) =>
      new errorType(
        error instanceof Error ? error.message : "Unknown error occurred"
      ),
  })

export const withRetry = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  maxRetries: number = 3
) =>
  pipe(
    effect,
    Effect.retry(Schedule.recurs(maxRetries))
  )

export const withTimeout = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  timeoutMs: number = 5000
) =>
  pipe(
    effect,
    Effect.timeout(`${timeoutMs} millis`),
    Effect.catchTag("TimeoutException", () =>
      Effect.fail(new AgentError("Operation timed out"))
    )
  )

export * from "effect"
