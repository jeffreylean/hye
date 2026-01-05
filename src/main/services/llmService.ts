import type { ModelMessage } from "ai";
import { LLMError } from "../lib/effect.js";
import {
  ProviderFactory,
  type LLMConfig,
  type LLMProviderType,
  type LLMProvider,
} from "./providers/index.js";

export type { LLMConfig, LLMProviderType };

export class LLMService {
  private provider: LLMProvider;

  constructor(private config: LLMConfig) {
    this.validateConfig();
    this.provider = ProviderFactory.create(config);
  }

  async generateResponse(messages: ModelMessage[]): Promise<string> {
    try {
      return await this.provider.generateResponse(messages);
    } catch (error) {
      throw new LLMError(
        `LLM generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async *streamResponse(messages: ModelMessage[]): AsyncGenerator<string, void, unknown> {
    try {
      yield* this.provider.streamResponse(messages);
    } catch (error) {
      throw new LLMError(
        `LLM streaming failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private validateConfig(): void {
    if (!this.config.apiKey) {
      throw new LLMError("API key is required");
    }
    if (this.config.provider === "custom" && !this.config.baseUrl) {
      throw new LLMError("Base URL is required for custom providers");
    }
    if (!this.config.model) {
      throw new LLMError("Model name is required");
    }
  }

  static getSupportedProviders() {
    return ProviderFactory.getSupportedProviders();
  }
}
