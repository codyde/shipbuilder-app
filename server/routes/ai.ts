import express from 'express';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

export const aiRoutes = express.Router();

aiRoutes.post('/generate-details', async (req, res) => {
  try {
    const { prompt, context } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const systemPrompt = `You are a project management assistant helping to generate detailed task information. 
    
Context:
- Task Title: ${context?.title || 'Not provided'}
- Task Description: ${context?.description || 'Not provided'}
- Task Priority: ${context?.priority || 'Not provided'}

Generate detailed task information based on the user's request. Focus on being practical, actionable, and relevant to the task context. Include relevant sections like implementation details, acceptance criteria, technical requirements, or other appropriate information based on the task type.

Keep the response well-structured and professional.`;

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const result = await streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      experimental_telemetry: {
        isEnabled: true,
        functionId: "generate-details"
      },
      system: systemPrompt,
      prompt: prompt,
      maxTokens: 1000,
    });

    // Stream the text chunks to the client
    for await (const chunk of result.textStream) {
      res.write(chunk);
    }

    res.end();
  } catch (error) {
    console.error('AI generation error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate details' });
    } else {
      res.end();
    }
  }
});