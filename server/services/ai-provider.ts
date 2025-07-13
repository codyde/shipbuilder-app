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
  anthropic: 'claude-4-sonnet-20250514',
  openai: 'o3-mini',
  xai: 'grok-4',
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

      console.log(`[AI_MODEL_CONFIG] User: ${userId}, Provider: ${provider}`);

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

      // Return the appropriate model and provider options
      const model = this.getModelByProvider(provider);
      const providerOptions = this.getProviderOptions(provider, context);

      // Log successful configuration
      Sentry.addBreadcrumb({
        message: 'AI model configuration successful',
        category: 'ai.model.config.success',
        data: {
          userId,
          provider,
          modelName: this.getModelName(provider),
          hasProviderOptions: Object.keys(providerOptions).length > 0
        },
        level: 'info'
      });

      console.log(`[AI_MODEL_CONFIG_SUCCESS] User: ${userId}, Provider: ${provider}, Model: ${this.getModelName(provider)}`);

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

      console.error(`[AI_MODEL_CONFIG_FAILED] User: ${userId}, Error:`, error);
      throw error;
    }
  }

  /**
   * Get provider options for detailed reasoning (for OpenAI o3-mini)
   */
  static getProviderOptions(provider: AIProvider, context?: string): Record<string, any> {
    switch (provider) {
      case 'openai':
        // For tool calling contexts, don't use reasoningSummary as it may interfere
        if (context === 'tool-calling') {
          return {};
        }
        return {
          openai: {
            reasoningSummary: 'detailed'
          }
        };
      default:
        return {};
    }
  }

  /**
   * Get a specific model by provider
   */
  static getModelByProvider(provider: AIProvider): LanguageModel {
    switch (provider) {
      case 'anthropic':
        return anthropic(MODEL_CONFIGS.anthropic);
      
      case 'openai':
        return openai(MODEL_CONFIGS.openai);
      
      case 'xai':
        return xai(MODEL_CONFIGS.xai);
      
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
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
        return 'o3-mini (Detailed Reasoning)';
      
      case 'xai':
        return 'Grok-4';
      
      default:
        return 'Claude 4 Sonnet';
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