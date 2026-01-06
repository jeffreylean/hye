import { streamText } from "ai";
import type { LanguageModel, ModelMessage } from "ai";
import type { LLMConfig, LLMProvider, ProviderMetadata } from "./types.js";

export abstract class BaseProvider implements LLMProvider {
  protected config: LLMConfig;
  protected defaultTemperature = 0.7;
  protected defaultMaxOutputTokens = 1000;

  abstract readonly metadata: ProviderMetadata;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  protected get apiKey(): string {
    return this.config.apiKey;
  }

  abstract createModel(modelName?: string): LanguageModel;

  async *streamResponse(messages: ModelMessage[]): AsyncGenerator<string, void, unknown> {
    const model = this.createModel(this.config.model);

    let streamError: Error | null = null;

    const result = streamText({
      model,
      messages,
      temperature: this.config.temperature ?? this.defaultTemperature,
      maxOutputTokens: this.config.maxOutputTokens ?? this.defaultMaxOutputTokens,
      onError({ error }) {
        streamError = error instanceof Error ? error : new Error(String(error));
      },
    });

    try {
      for await (const chunk of result.textStream) {
        if (streamError) throw streamError;
        yield chunk;
      }
    } catch (error) {
      throw error;
    }

    if (streamError) throw streamError;
  }

  async generateResponse(messages: ModelMessage[]): Promise<string> {
    let fullText = "";
    for await (const chunk of this.streamResponse(messages)) {
      fullText += chunk;
    }
    return fullText;
  }
}
