import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { xai } from '@ai-sdk/xai';
import { LanguageModel } from 'ai';
import { databaseService } from '../db/database-service.js';

export type AIProvider = 'anthropic' | 'openai' | 'xai';

export interface AIModelConfig {
  provider: AIProvider;
  modelName: string;
}

// Model configurations for each provider
const MODEL_CONFIGS = {
  anthropic: {
    default: 'claude-sonnet-4-20250514',
    models: {
      sonnet: 'claude-sonnet-4-20250514',
      opus: 'claude-opus-4-20250514',
    }
  },
  openai: {
    default: 'gpt-4o',
    models: {
      'gpt-4o': 'gpt-4o',
      'gpt-4o-mini': 'gpt-4o-mini',
      'gpt-4-turbo': 'gpt-4-turbo',
    }
  },
  xai: {
    default: 'grok-4',
    models: {
      'grok-4': 'grok-4',
    }
  }
} as const;

export class AIProviderService {
  /**
   * Get the AI model based on user preferences
   */
  static async getModel(userId: string, modelType: 'default' | 'fast' | 'powerful' = 'default'): Promise<LanguageModel> {
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
    return this.getModelByProvider(provider, modelType);
  }

  /**
   * Get a specific model by provider
   */
  static getModelByProvider(provider: AIProvider, modelType: 'default' | 'fast' | 'powerful' = 'default'): LanguageModel {
    switch (provider) {
      case 'anthropic':
        const anthropicModel = modelType === 'powerful' ? MODEL_CONFIGS.anthropic.models.opus : MODEL_CONFIGS.anthropic.models.sonnet;
        return anthropic(anthropicModel);
      
      case 'openai':
        const openaiModel = modelType === 'fast' ? MODEL_CONFIGS.openai.models['gpt-4o-mini'] : MODEL_CONFIGS.openai.models['gpt-4o'];
        return openai(openaiModel);
      
      case 'xai':
        const xaiModel = MODEL_CONFIGS.xai.models['grok-4'];
        return xai(xaiModel);
      
      default:
        // Default to Anthropic if unknown provider
        return anthropic(MODEL_CONFIGS.anthropic.default);
    }
  }

  /**
   * Get model name for display
   */
  static getModelName(provider: AIProvider, modelType: 'default' | 'fast' | 'powerful' = 'default'): string {
    switch (provider) {
      case 'anthropic':
        return modelType === 'powerful' ? 'Claude Opus 4' : 'Claude Sonnet 4';
      
      case 'openai':
        return modelType === 'fast' ? 'GPT-4o Mini' : 'GPT-4o';
      
      case 'xai':
        return 'Grok-4';
      
      default:
        return 'Claude Sonnet 4';
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