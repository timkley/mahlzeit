// OpenRouter API client — OpenAI-compatible endpoint
// Docs: https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'openrouter/auto'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
}

interface JsonSchema {
  name: string
  strict: boolean
  schema: Record<string, unknown>
}

interface OpenRouterResponse {
  model: string
  choices: Array<{
    message: {
      content: string
    }
  }>
}

export async function chatCompletion(
  messages: ChatMessage[],
  options?: {
    model?: string
    temperature?: number
    maxTokens?: number
    responseFormat?: JsonSchema
  },
): Promise<{ content: string; model: string }> {
  const config = useRuntimeConfig()
  const apiKey = config.openrouterApiKey

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: 'OPENROUTER_API_KEY is not configured',
    })
  }

  const body: Record<string, unknown> = {
    model: options?.model || DEFAULT_MODEL,
    messages,
    temperature: options?.temperature ?? 0.3,
    max_tokens: options?.maxTokens ?? 1024,
  }

  // Structured outputs — enforces JSON schema on the response
  if (options?.responseFormat) {
    body.response_format = {
      type: 'json_schema',
      json_schema: options.responseFormat,
    }
  }

  const response = await $fetch<OpenRouterResponse>(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body,
  })

  return {
    content: response.choices[0]?.message?.content || '',
    model: response.model,
  }
}
