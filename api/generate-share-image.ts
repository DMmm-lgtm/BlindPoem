import type { VercelRequest, VercelResponse } from '@vercel/node';

type ShareImageRequest = {
  content?: string;
  poem_title?: string;
  author?: string;
};

type CloudflareImageJsonResponse = {
  result?: {
    image?: string;
  } | string;
  image?: string;
  success?: boolean;
  errors?: unknown[];
};

const DEFAULT_CLOUDFLARE_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';
const DEEPSEEK_BRIEF_TIMEOUT_MS = 9000;

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
    text?: unknown;
  }>;
};

type VisualBriefResponse = {
  visual_brief?: unknown;
};

function getStringFromContentPart(part: unknown): string {
  if (typeof part === 'string') return part;
  if (!part || typeof part !== 'object') return '';

  const record = part as Record<string, unknown>;
  if (typeof record.text === 'string') return record.text;
  if (typeof record.content === 'string') return record.content;

  return '';
}

function extractChatCompletionText(data: unknown, providerName: string): string {
  const responseData = data as ChatCompletionResponse;
  const choice = responseData?.choices?.[0];
  const content = choice?.message?.content;

  if (typeof content === 'string' && content.trim()) {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content.map(getStringFromContentPart).join('\n').trim();

    if (text) return text;
  }

  if (typeof choice?.text === 'string' && choice.text.trim()) {
    return choice.text;
  }

  console.error(`❌ ${providerName} 响应缺少可解析文本:`, JSON.stringify({
    choiceKeys: choice ? Object.keys(choice) : [],
    messageKeys: choice?.message ? Object.keys(choice.message) : [],
  }));
  throw new Error(`无法解析 ${providerName} 响应`);
}

function parseVisualBrief(text: string): string {
  const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('无法从响应中提取 visual brief');
  }

  const data = JSON.parse(jsonMatch[0]) as VisualBriefResponse;
  const visualBrief = typeof data.visual_brief === 'string' ? data.visual_brief.trim() : '';

  if (!visualBrief) {
    throw new Error('visual brief 为空');
  }

  return visualBrief
    .replace(/\s+/g, ' ')
    .slice(0, 700);
}

function buildVisualBriefPrompt(content: string, poemTitle: string, author: string): string {
  return [
    'Create a concise English visual brief for an AI image generator.',
    'The image will become a share poster background for a poem, but the generator must not draw any text.',
    'Focus on concrete imagery, mood, season, light, materials, setting, and composition.',
    'Prefer one strong visual subject with graceful negative space for later poem overlay.',
    'Do not include quoted poem text, title text, author text, typography, calligraphy, symbols, watermark, or logo.',
    'Return JSON only: {"visual_brief":""}',
    '',
    `Poem line: ${content}`,
    `Title: ${poemTitle}`,
    `Author: ${author}`,
  ].join('\n');
}

async function buildVisualBrief(content: string, poemTitle: string, author: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;

  if (!apiKey) {
    throw new Error('Missing DEEPSEEK_API_KEY');
  }

  console.log(`🤖 DeepSeek 生成图片 brief，模型: ${model}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEEPSEEK_BRIEF_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'Return valid JSON only. No markdown. Write one visual brief for image generation. The JSON schema is {"visual_brief":""}.',
          },
          {
            role: 'user',
            content: buildVisualBriefPrompt(content, poemTitle, author),
          },
        ],
        temperature: 0.65,
        max_tokens: 220,
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`DeepSeek brief timeout after ${DEEPSEEK_BRIEF_TIMEOUT_MS / 1000}s`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  console.log('📥 收到 DeepSeek 图片 brief 响应，状态码:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ DeepSeek 图片 brief 生成失败 (${model}):`, errorText);
    throw new Error(`DeepSeek brief API Error: ${response.status}`);
  }

  const data = await response.json();
  const text = extractChatCompletionText(data, 'DeepSeek brief');
  const visualBrief = parseVisualBrief(text);

  console.log('🖼️ DeepSeek 图片 brief:', visualBrief);
  return visualBrief;
}

function buildImagePromptFromBrief(visualBrief: string): string {
  return [
    visualBrief,
    'Elegant cinematic composition, natural depth, refined color, emotionally faithful to the brief.',
    'Leave tasteful negative space for a poem overlay added later.',
    'No text, no letters, no words, no captions, no calligraphy, no typography, no watermark, no logo, no signature.',
  ].join('\n');
}

function buildFallbackImagePrompt(content: string, poemTitle: string, author: string): string {
  return [
    'Create a beautiful poetic background image for a share poster.',
    'Use the poem as inspiration for concrete scenery, emotion, light, season, and composition.',
    'Prefer one strong visual subject with graceful negative space for a poem overlay added later.',
    'No text, no letters, no words, no captions, no calligraphy, no typography, no watermark, no logo, no signature.',
    `Poem line: ${content}`,
    `Title: ${poemTitle}`,
    `Author: ${author}`,
  ].join('\n');
}

function getCloudflareImageEndpoint(accountId: string, model: string): string {
  const encodedModel = model
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');

  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${encodedModel}`;
}

function normalizeBase64Image(image: string): string {
  if (image.startsWith('data:image/')) {
    return image;
  }

  return `data:image/png;base64,${image}`;
}

async function readCloudflareImage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const result = await response.json() as CloudflareImageJsonResponse;
    const image = typeof result.result === 'string'
      ? result.result
      : result.result?.image || result.image;

    if (!image) {
      throw new Error(`Cloudflare AI returned JSON without an image: ${JSON.stringify({
        success: result.success,
        errors: result.errors,
      })}`);
    }

    return normalizeBase64Image(image);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return `data:${contentType || 'image/png'};base64,${base64}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const model = process.env.CLOUDFLARE_AI_IMAGE_MODEL || DEFAULT_CLOUDFLARE_IMAGE_MODEL;

  if (!accountId || !apiToken) {
    return res.status(501).json({
      error: 'Cloudflare AI is not configured',
      required: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'],
    });
  }

  const { content, poem_title, author } = req.body as ShareImageRequest;
  if (!content || !poem_title || !author) {
    return res.status(400).json({ error: 'Missing poem fields' });
  }

  let visualBrief: string | null = null;
  let prompt: string;
  try {
    visualBrief = await buildVisualBrief(content, poem_title, author);
    prompt = buildImagePromptFromBrief(visualBrief);
  } catch (briefError) {
    console.error('❌ DeepSeek 图片 brief 失败，回退到原诗句图片 prompt:', briefError);
    prompt = buildFallbackImagePrompt(content, poem_title, author);
  }

  try {
    const response = await fetch(getCloudflareImageEndpoint(accountId, model), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    console.log('📥 收到 Cloudflare AI 图片响应，状态码:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Cloudflare AI 图片生成失败 (${model}):`, errorText);
      return res.status(502).json({
        error: 'Cloudflare AI image generation failed',
        detail: errorText,
        model,
      });
    }

    const image = await readCloudflareImage(response);

    return res.status(200).json({
      image,
      model,
      provider: 'cloudflare-ai',
      visualBrief,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to generate share image',
      detail: error instanceof Error ? error.message : String(error),
      model,
    });
  }
}
