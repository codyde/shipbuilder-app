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
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  xai: 'grok-beta',
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
        // Default to Anthropic if unknown provider
        return anthropic(MODEL_CONFIGS.anthropic);
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
        return 'GPT-4o';
      
      case 'xai':
        return 'Grok Beta';
      
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