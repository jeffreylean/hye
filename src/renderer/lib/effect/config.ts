import { Effect, Context, Layer } from "effect"
import { ConfigError } from "./index.js"

// Configuration interface
export interface AppConfig {
  readonly database: {
    readonly path: string
  }
  readonly llm: {
    readonly defaultProvider: string
    readonly apiKeys: Record<string, string>
  }
  readonly app: {
    readonly name: string
    readonly version: string
  }
}

// Configuration service tag
export class ConfigService extends Context.Tag("ConfigService")<
  ConfigService,
  {
    readonly config: AppConfig
    readonly getConfig: () => Effect.Effect<AppConfig, ConfigError>
  }
>() {}

// Default configuration
const defaultConfig: AppConfig = {
  database: {
    path: "./data/app.db"
  },
  llm: {
    defaultProvider: "openai",
    apiKeys: {}
  },
  app: {
    name: "Hye",
    version: "1.0.0"
  }
}

// Load configuration from environment or use defaults
const loadConfig = (): Effect.Effect<AppConfig, ConfigError> =>
  Effect.try({
    try: () => {
      const config: AppConfig = {
        ...defaultConfig,
        llm: {
          ...defaultConfig.llm,
          apiKeys: {
            openai: process.env.OPENAI_API_KEY || "",
            anthropic: process.env.ANTHROPIC_API_KEY || "",
            google: process.env.GOOGLE_API_KEY || ""
          }
        }
      }
      return config
    },
    catch: (error) =>
      new ConfigError(
        `Failed to load configuration: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      )
  })

// Configuration service implementation
export const ConfigServiceLive = Layer.effect(
  ConfigService,
  Effect.map(loadConfig(), (config) =>
    ConfigService.of({
      config,
      getConfig: () => Effect.succeed(config)
    })
  )
)
