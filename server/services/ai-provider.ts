import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { xai } from '@ai-sdk/xai';
import { LanguageModel } from 'ai';
import { databaseService } from '../db/database-service.js';
import * as Sentry from '@sentry/node';

export type AIProvider = 'anthropic' | 'openai' | 'xai';

export interface AIModelConfig {
  provider: AIProvider;
  modelName: string;
}

// Model configurations for each provider
const MODEL_CONFIGS = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'o3-mini',
  xai: 'grok-4',
} as const;

// Tool calling fallback models (for when primary model doesn't support tools)
const TOOL_CALLING_FALLBACKS = {
  anthropic: 'claude-sonnet-4-20250514', // Claude already supports tools
  openai: 'gpt-4o-mini', // Use GPT-4o-mini for tool calling when primary is o3-mini
  xai: 'grok-4', // Grok already supports tools
} as const;

export class AIProviderService {
  /**
   * Get the AI model based on user preferences
   */
  static async getModel(userId: string): Promise<LanguageModel> {
    // Get user preferences
    const user = await databaseService.getUserById(userId);
    const provider = user?.aiProvider || 'anthropic';

    // Check if appropriate API key is set
    if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
      throw new Error(`${provider} AI provider is not available. Please configure the required API key.`);
    }
    if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
      throw new Error(`${provider} AI provider is not available. Please configure the required API key.`);
    }
    if (provider === 'xai' && !process.env.XAI_API_KEY) {
      throw new Error(`${provider} AI provider is not available. Please configure the required API key.`);
    }

    // Return the appropriate model
    return this.getModelByProvider(provider);
  }

  /**
   * Get unified tool calling model (GPT-4o-mini with Claude fallback)
   */
  static async getToolCallingModel(userId: string): Promise<{model: LanguageModel, providerOptions: Record<string, any>}> {
    try {
      const model = openai('gpt-4o-mini');
      const providerOptions = this.getProviderOptions('openai', 'tool-calling');
      return { model, providerOptions };
    } catch (error) {
      console.warn('GPT-4o-mini not available, falling back to Claude Sonnet 4');
      const model = anthropic('claude-sonnet-4-20250514');
      const providerOptions = this.getProviderOptions('anthropic', 'tool-calling');
      return { model, providerOptions };
    }
  }

  /**
   * Get MVP generation model (user's selected provider)
   */
  static async getMVPGenerationModel(userId: string): Promise<{model: LanguageModel, providerOptions: Record<string, any>}> {
    const user = await databaseService.getUserById(userId);
    const provider = user?.aiProvider || 'anthropic';
    const model = await this.getModel(userId);
    const providerOptions = this.getProviderOptions(provider, 'mvp-generation');
    return { model, providerOptions };
  }

  /**
   * Get both model and provider options for user preferences
   */
  static async getModelConfig(userId: string, context?: string): Promise<{model: LanguageModel, providerOptions: Record<string, any>}> {
    try {
      // Log model configuration request
      Sentry.addBreadcrumb({
        message: 'Getting AI model configuration',
        category: 'ai.model.config',
        data: { userId },
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
          userId,
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
      if (provider === 'xai' && !process.env.XAI_API_KEY) {
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
          userId,
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
  static getModelByName(provider: AIProvider, modelName: string): LanguageModel {
    try {
      switch (provider) {
        case 'anthropic':
          return anthropic(modelName);
        
        case 'openai':
          return openai(modelName);
        
        case 'xai':
          return xai(modelName);
        
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
        
        // For tool calling contexts, don't use reasoningSummary as it may interfere
        if (context === 'tool-calling' || context === 'mvp-generation') {
          return {};
        }
        
        // For o3 models, use reasoning summaries
        if (actualModel.startsWith('o3')) {
          return {
            openai: {
              reasoningSummary: 'detailed' // Enable reasoning summaries for o3 models
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
  static getModelByProvider(provider: AIProvider): LanguageModel {
    try {
      switch (provider) {
        case 'anthropic':
          return anthropic(MODEL_CONFIGS.anthropic);
        
        case 'openai':
          // Use standard API for o3-mini (responses API only needed for full o3)
          return openai(MODEL_CONFIGS.openai);
        
        case 'xai':
          return xai(MODEL_CONFIGS.xai);
        
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
        return 'Claude 4 Sonnet';
      
      case 'openai':
        return 'o3-mini (Detailed Reasoning) + GPT-4o-mini (Tool Calling)';
      
      case 'xai':
        return 'Grok-4';
      
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
        return 'Claude 4 Sonnet';
      
      case 'openai':
        if (modelName === 'o3-mini') {
          return 'o3-mini (Detailed Reasoning)';
        } else if (modelName === 'gpt-4o-mini') {
          return 'GPT-4o-mini (Tool Calling)';
        }
        return modelName;
      
      case 'xai':
        return 'Grok-4';
      
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
        // Primary model (o3-mini) has limited tool calling, but we have GPT-4o-mini fallback
        return MODEL_CONFIGS.openai !== 'o3-mini';
      case 'xai':
        return true; // Grok supports tool calling
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
      case 'xai':
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
      case 'xai':
        return !!process.env.XAI_API_KEY;
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
    if (this.isProviderAvailable('xai')) providers.push('xai');
    return providers;
  }
}