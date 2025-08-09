import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
// Using a broad model type to support both v1 and v2 language model shapes
type AnyLanguageModel = any;
import { databaseService } from '../db/database-service.js';
import * as Sentry from '@sentry/node';

export type AIProvider = 'anthropic' | 'openai';

export interface AIModelConfig {
  provider: AIProvider;
  modelName: string;
}

// Model configurations for each provider
const MODEL_CONFIGS = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-5', // gpt-5 is a reasoning model
} as const;

// OpenAI responses-v2 models must use the Responses API in AI SDK 5
function isOpenAIResponsesModel(modelName: string): boolean {
  const id = (modelName || '').toLowerCase();
  // o1 and gpt-5 models require responses API
  return id === 'gpt-5' || id === 'gpt-5-mini' || id === 'o1-preview' || id === 'o1-mini';
}

export class AIProviderService {
  /**
   * Get the AI model based on user preferences
   */
  static async getModel(userId: string): Promise<AnyLanguageModel> {
    // Get user preferences
    const user = await databaseService.getUserById(userId);
    const provider = user?.aiProvider || 'anthropic';

    // Check if appropriate API key is set with fallback logic
    if (!this.isProviderAvailable(provider)) {
      console.warn(`Preferred provider ${provider} is not available, checking for fallbacks`);
      
      // Try to find an available provider as fallback
      const availableProviders = this.getAvailableProviders();
      if (availableProviders.length === 0) {
        throw new Error('No AI providers are available. Please configure at least one API key (ANTHROPIC_API_KEY or OPENAI_API_KEY).');
      }
      
      const fallbackProvider = availableProviders[0];
      console.warn(`Using fallback provider: ${fallbackProvider}`);
      
      return this.getModelByProvider(fallbackProvider);
    }

    // Return the appropriate model
    return this.getModelByProvider(provider);
  }

  /**
   * Get unified tool calling model (gpt-5 with Claude fallback)
   */
  static async getToolCallingModel(userId: string): Promise<{model: AnyLanguageModel, providerOptions: Record<string, any>}> {
    // Honor user preference first, fallback to any available
    const user = await databaseService.getUserById(userId);
    const preferred: AIProvider | undefined = user?.aiProvider as AIProvider | undefined;
    const candidates: AIProvider[] = preferred
      ? [preferred, ...(['anthropic','openai'] as AIProvider[]).filter(p => p !== preferred)]
      : (['anthropic','openai'] as AIProvider[]);

    for (const provider of candidates) {
      if (!this.isProviderAvailable(provider)) continue;
      try {
        if (provider === 'openai') {
          // Use gpt-5-mini for tool calling with responses API
          const model = openai.responses('gpt-5-mini');
          const providerOptions = this.getProviderOptions('openai', 'tool-calling');
          return { model, providerOptions };
        }
        if (provider === 'anthropic') {
          const model = anthropic('claude-sonnet-4-20250514');
          const providerOptions = this.getProviderOptions('anthropic', 'tool-calling');
          return { model, providerOptions };
        }
      } catch (err) {
        console.warn(`Error creating ${provider} tool-calling model, trying next`, err);
      }
    }

    // No providers available
    throw new Error('No AI providers are available for tool calling. Please configure at least one API key (ANTHROPIC_API_KEY or OPENAI_API_KEY).');
  }

  /**
   * Get MVP generation model (user's selected provider)
   */
  static async getMVPGenerationModel(userId: string): Promise<{model: AnyLanguageModel, providerOptions: Record<string, any>}> {
    const user = await databaseService.getUserById(userId);
    const provider = user?.aiProvider || 'anthropic';

    // Use gpt-5 for MVP generation with reasoning
    if (provider === 'openai') {
      const modelName = 'gpt-5'; // gpt-5 is a reasoning model
      const model = openai.responses(modelName); // Use responses API for gpt-5
      const providerOptions = this.getProviderOptions('openai', 'mvp-generation', modelName);
      console.log('[AI_PROVIDER] OpenAI MVP generation config:', {
        modelName,
        providerOptions,
        hasReasoningEffort: !!providerOptions?.openai?.reasoningEffort
      });
      return { model, providerOptions };
    }

    const model = await this.getModel(userId);
    const providerOptions = this.getProviderOptions(provider, 'mvp-generation');
    return { model, providerOptions };
  }

  /**
   * Get both model and provider options for user preferences
   */
  static async getModelConfig(userId: string, context?: string): Promise<{model: AnyLanguageModel, providerOptions: Record<string, any>}> {
    try {
      // Log model configuration request
      Sentry.addBreadcrumb({
        message: 'Getting AI model configuration',
        category: 'ai.model.config',
        data: { userIdHash: this.hashUserId(userId) },
        level: 'info'
      });

      // Get user preferences
      const user = await databaseService.getUserById(userId);
      const provider = user?.aiProvider || 'anthropic';


      // Log provider selection
      Sentry.addBreadcrumb({
        message: 'AI provider selected',
        category: 'ai.provider.select',
        data: {
          userIdHash: this.hashUserId(userId),
          provider,
          isUserDefined: !!user?.aiProvider
        },
        level: 'info'
      });

      // Check if appropriate API key is set
      if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
        const error = new Error(`${provider} AI provider is not available. Please configure the required API key.`);
        Sentry.captureException(error, {
          tags: {
            operation: 'ai.config',
            provider: provider,
            userId: userId
          },
          extra: {
            reason: 'missing_api_key'
          }
        });
        throw error;
      }
      if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
        const error = new Error(`${provider} AI provider is not available. Please configure the required API key.`);
        Sentry.captureException(error, {
          tags: {
            operation: 'ai.config',
            provider: provider,
            userId: userId
          },
          extra: {
            reason: 'missing_api_key'
          }
        });
        throw error;
      }

      // For tool calling contexts, use unified model
      let model;
      let actualModelName;
      
      if (context === 'tool-calling') {
        return this.getToolCallingModel(userId);
      } else {
        // Use primary model
        model = this.getModelByProvider(provider);
        actualModelName = MODEL_CONFIGS[provider];
      }
      
      const providerOptions = this.getProviderOptions(provider, context, actualModelName);

      // Log successful configuration
      Sentry.addBreadcrumb({
        message: 'AI model configuration successful',
        category: 'ai.model.config.success',
        data: {
          userIdHash: this.hashUserId(userId),
          provider,
          modelName: actualModelName,
          displayName: this.getModelDisplayName(provider, actualModelName),
          hasProviderOptions: Object.keys(providerOptions).length > 0,
          isToolCallingFallback: context === 'tool-calling' && actualModelName !== MODEL_CONFIGS[provider]
        },
        level: 'info'
      });


      return {
        model,
        providerOptions
      };
    } catch (error) {
      // Log model configuration failure
      Sentry.captureException(error, {
        tags: {
          operation: 'ai.model.config',
          userId: userId
        },
        extra: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      throw error;
    }
  }

  /**
   * Get a specific model by provider and model name
   */
  static getModelByName(provider: AIProvider, modelName: string): AnyLanguageModel {
    try {
      switch (provider) {
        case 'anthropic':
          return anthropic(modelName);
        
        case 'openai':
          return isOpenAIResponsesModel(modelName)
            ? openai.responses(modelName)
            : openai(modelName);
        
        default:
          throw new Error(`Unknown AI provider: ${provider}`);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get provider options for detailed reasoning (for OpenAI models)
   */
  static getProviderOptions(provider: AIProvider, context?: string, modelName?: string): Record<string, any> {
    switch (provider) {
      case 'openai':
        const actualModel = modelName || MODEL_CONFIGS.openai;
        
        // For tool calling contexts, explicitly disable parallel tool calls to avoid race conditions
        if (context === 'tool-calling') {
          return {
            openai: {
              parallelToolCalls: false,
              toolChoice: 'auto'
            }
          };
        }

        // For MVP generation, enable reasoning for o1 and gpt-5 models
        if (context === 'mvp-generation') {
          if (actualModel.startsWith('gpt-5') || actualModel.startsWith('o1-')) {
            return {
              openai: {
                reasoningEffort: 'medium' // Enable reasoning for reasoning models
              }
            };
          }
          return {};
        }
        
        // For o1 and gpt-5 models, use reasoning effort
        if (actualModel.startsWith('gpt-5') || actualModel.startsWith('o1-')) {
          return {
            openai: {
              reasoningEffort: 'medium' // Enable reasoning for reasoning models
            }
          };
        }
        
        // For other OpenAI models, no special options needed
        return {};
        
      default:
        return {};
    }
  }

  /**
   * Get a specific model by provider
   */
  static getModelByProvider(provider: AIProvider): AnyLanguageModel {
    try {
      switch (provider) {
        case 'anthropic':
          return anthropic(MODEL_CONFIGS.anthropic);
        
        case 'openai':
          // Use Responses API for v2 models like gpt-5 family
          return isOpenAIResponsesModel(MODEL_CONFIGS.openai)
            ? openai.responses(MODEL_CONFIGS.openai)
            : openai(MODEL_CONFIGS.openai);
        
        default:
          throw new Error(`Unknown AI provider: ${provider}`);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get model name for display
   */
  static getModelName(provider: AIProvider): string {
    switch (provider) {
      case 'anthropic':
        return 'Claude Sonnet 4';
      
      case 'openai':
        return 'GPT-5';
      
      default:
        return 'Claude 4 Sonnet';
    }
  }

  /**
   * Get model display name for specific model
   */
  static getModelDisplayName(provider: AIProvider, modelName: string): string {
    switch (provider) {
      case 'anthropic':
        return 'Claude Sonnet 4';
      
      case 'openai':
        if (modelName === 'gpt-5') {
          return 'GPT-5';
        } else if (modelName === 'gpt-5-mini') {
          return 'GPT-5 Mini';
        } else if (modelName === 'o1-preview') {
          return 'o1-preview';
        } else if (modelName === 'o1-mini') {
          return 'o1-mini';
        }
        return modelName;
      
      default:
        return modelName;
    }
  }

  /**
   * Check if a provider/model supports tool calling
   */
  static supportsToolCalling(provider: AIProvider): boolean {
    switch (provider) {
      case 'anthropic':
        return true; // Claude supports tool calling
      case 'openai':
        // gpt-5 models support tool calling via responses API
        return true; // We have gpt-5-mini for tool calling
      default:
        return false;
    }
  }

  /**
   * Check if a provider supports tool calling (including fallbacks)
   */
  static supportsToolCallingWithFallback(provider: AIProvider): boolean {
    // All providers now support tool calling via fallbacks
    switch (provider) {
      case 'anthropic':
      case 'openai':
        return true;
      default:
        return false;
    }
  }

  /**
   * Update user's AI provider preference
   */
  static async updateUserProvider(userId: string, provider: AIProvider): Promise<void> {
    await databaseService.updateUserAIProvider(userId, provider);
  }

  /**
   * Check if a provider is available (has API key set)
   */
  static isProviderAvailable(provider: AIProvider): boolean {
    switch (provider) {
      case 'anthropic':
        return !!process.env.ANTHROPIC_API_KEY;
      case 'openai':
        return !!process.env.OPENAI_API_KEY;
      default:
        return false;
    }
  }

  /**
   * Get available providers
   */
  static getAvailableProviders(): AIProvider[] {
    const providers: AIProvider[] = [];
    if (this.isProviderAvailable('anthropic')) providers.push('anthropic');
    if (this.isProviderAvailable('openai')) providers.push('openai');
    return providers;
  }

  /**
   * Hash user ID for secure logging (prevents PII exposure in logs)
   */
  static hashUserId(userId: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(userId).digest('hex').substring(0, 8);
  }
}