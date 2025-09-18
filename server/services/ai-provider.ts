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
  openai: 'gpt-5',
  xai: 'grok-4',
} as const;

// Tool calling fallback models (for when primary model doesn't support tools)
const TOOL_CALLING_FALLBACKS = {
  anthropic: 'claude-sonnet-4-20250514', // Claude already supports tools
  openai: 'gpt-5', // Use gpt-5 for tool calling when primary is gpt-5
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

    // Check if appropriate API key is set with fallback logic
    if (!this.isProviderAvailable(provider)) {
      console.warn(`Preferred provider ${provider} is not available, checking for fallbacks`);
      
      // Try to find an available provider as fallback
      const availableProviders = this.getAvailableProviders();
      if (availableProviders.length === 0) {
        throw new Error('No AI providers are available. Please configure at least one API key (ANTHROPIC_API_KEY, OPENAI_API_KEY, or XAI_API_KEY).');
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
  static async getToolCallingModel(userId: string): Promise<{model: LanguageModel, providerOptions: Record<string, any>}> {
    // Check if OpenAI is available first
    if (this.isProviderAvailable('openai')) {
      try {
        const model = openai('gpt-5');
        const providerOptions = this.getProviderOptions('openai', 'tool-calling', 'gpt-5');
        console.log(`🔧 [TOOL_CONFIG] Using gpt-5 with provider options:`, JSON.stringify(providerOptions, null, 2));
        return { model, providerOptions };
      } catch (error) {
        console.warn('Error creating OpenAI model, falling back to Claude:', error);
      }
    }
    
    // Fallback to Claude if OpenAI is not available or failed
    if (this.isProviderAvailable('anthropic')) {
      console.warn('Using Claude Sonnet 4 for tool calling');
      const model = anthropic('claude-sonnet-4-20250514');
      const providerOptions = this.getProviderOptions('anthropic', 'tool-calling', 'claude-sonnet-4-20250514');
      return { model, providerOptions };
    }
    
    // If neither primary providers are available, check for XAI
    if (this.isProviderAvailable('xai')) {
      console.warn('Using XAI Grok for tool calling');
      const model = xai('grok-4');
      const providerOptions = this.getProviderOptions('xai', 'tool-calling', 'grok-4');
      return { model, providerOptions };
    }
    
    // No providers available
    throw new Error('No AI providers are available for tool calling. Please configure at least one API key (ANTHROPIC_API_KEY, OPENAI_API_KEY, or XAI_API_KEY).');
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
      console.debug('Getting AI model configuration', { userIdHash: this.hashUserId(userId) });

      // Get user preferences
      const user = await databaseService.getUserById(userId);
      const provider = user?.aiProvider || 'anthropic';


      // Log provider selection
      console.debug('AI provider selected', {
        userIdHash: this.hashUserId(userId),
        provider,
        isUserDefined: !!user?.aiProvider
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
      console.debug('AI model configuration successful', {
        userIdHash: this.hashUserId(userId),
        provider,
        modelName: actualModelName,
        displayName: this.getModelDisplayName(provider, actualModelName),
        hasProviderOptions: Object.keys(providerOptions).length > 0,
        isToolCallingFallback: context === 'tool-calling' && actualModelName !== MODEL_CONFIGS[provider]
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
        
        // For tool calling contexts, provide specific configuration for better continuation
        if (context === 'tool-calling') {
          return {
            openai: {
              // Encourage tool calling continuation in AI SDK v5
              parallelToolCalls: false, // Ensure sequential execution
              toolChoice: 'auto', // Override any default restrictions
            }
          };
        }
        
        // For MVP generation, also disable parallel tool calls
        if (context === 'mvp-generation') {
          return {
            openai: {
              parallelToolCalls: false
            }
          };
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
          // Use standard API for gpt-5 (responses API only needed for full o3)
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
        return 'gpt-5 (Detailed Reasoning) + gpt-5 (Tool Calling)';
      
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
        if (modelName === 'gpt-5') {
          return 'gpt-5 (Detailed Reasoning)';
        } else if (modelName === 'gpt-5') {
          return 'gpt-5 (Tool Calling)';
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
        // Primary model (gpt-5) has limited tool calling, but we have gpt-5 fallback
        return MODEL_CONFIGS.openai !== 'gpt-5';
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

  /**
   * Hash user ID for secure logging (prevents PII exposure in logs)
   */
  static hashUserId(userId: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(userId).digest('hex').substring(0, 8);
  }
}