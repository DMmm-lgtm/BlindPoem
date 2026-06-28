import type { VercelRequest, VercelResponse } from '@vercel/node';

type ShareImageRequest = {
  content?: string;
  poem_title?: string;
  author?: string;
};

type OpenRouterImageModel = {
  id?: string;
  name?: string;
  pricing?: Record<string, string | number | null | undefined>;
};

type OpenRouterImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
};

const OPENROUTER_IMAGE_MODELS_URL = 'https://openrouter.ai/api/v1/images/models';
const OPENROUTER_IMAGES_URL = 'https://openrouter.ai/api/v1/images';

function getOpenRouterHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://blindpoem.vercel.app',
    'X-Title': process.env.OPENROUTER_APP_NAME || 'BlindPoem',
  };
}

function isFreeModel(model: OpenRouterImageModel): boolean {
  if (model.id?.endsWith(':free')) return true;

  const pricingValues = Object.values(model.pricing || {})
    .filter((value) => value !== null && value !== undefined)
    .map((value) => Number(value));

  return pricingValues.length > 0 && pricingValues.every((value) => Number.isFinite(value) && value === 0);
}

async function getOpenRouterImageModels(apiKey: string): Promise<string[]> {
  const configuredModels = (process.env.OPENROUTER_IMAGE_MODEL || '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);

  if (configuredModels.length > 0) {
    return configuredModels;
  }

  try {
    const response = await fetch(OPENROUTER_IMAGE_MODELS_URL, {
      method: 'GET',
      headers: getOpenRouterHeaders(apiKey),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenRouter 图片模型列表读取失败:', errorText);
      return [];
    }

    const result = await response.json() as { data?: OpenRouterImageModel[] };
    const freeModels = (result.data || [])
      .filter((model) => model.id && isFreeModel(model))
      .map((model) => model.id as string);

    return freeModels;
  } catch (error) {
    console.error('❌ OpenRouter 图片模型发现失败:', error);
    return [];
  }
}

function buildImagePrompt(content: string, poemTitle: string, author: string): string {
  return [
    'Create a poetic vertical poster background inspired by this poem line.',
    'No text, no watermark, no typography. Leave clean negative space for text overlay.',
    'The image should feel refined, cinematic, and emotionally faithful to the imagery.',
    'Prefer an elegant art direction that fits a deep-space poetry website.',
    `Poem line: ${content}`,
    `Title: ${poemTitle}`,
    `Author: ${author}`,
  ].join('\n');
}

async function requestOpenRouterImage(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  console.log(`🎨 OpenRouter 尝试图片模型: ${model}`);

  const response = await fetch(OPENROUTER_IMAGES_URL, {
    method: 'POST',
    headers: getOpenRouterHeaders(apiKey),
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    }),
  });

  console.log('📥 收到 OpenRouter 图片响应，状态码:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ OpenRouter 图片模型失败 (${model}):`, errorText);
    throw new Error(`OpenRouter image API error: ${response.status}`);
  }

  const result = await response.json() as OpenRouterImageResponse;
  const imageData = result.data?.[0];

  if (imageData?.b64_json) {
    return `data:image/png;base64,${imageData.b64_json}`;
  }

  if (imageData?.url) {
    return imageData.url;
  }

  throw new Error('OpenRouter image API returned no image');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(501).json({ error: 'OPENROUTER_API_KEY is not configured' });
  }

  const { content, poem_title, author } = req.body as ShareImageRequest;
  if (!content || !poem_title || !author) {
    return res.status(400).json({ error: 'Missing poem fields' });
  }

  const prompt = buildImagePrompt(content, poem_title, author);
  const models = await getOpenRouterImageModels(apiKey);
  let lastError: unknown;

  for (const model of models) {
    try {
      const image = await requestOpenRouterImage(apiKey, model, prompt);
      return res.status(200).json({ image, model });
    } catch (error) {
      lastError = error;
      console.error(`❌ OpenRouter 图片模型不可用 (${model}):`, error);
    }
  }

  return res.status(503).json({
    error: 'No available OpenRouter free image model',
    message: lastError instanceof Error ? lastError.message : 'All OpenRouter image models failed',
  });
}
