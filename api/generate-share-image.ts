import type { VercelRequest, VercelResponse } from '@vercel/node';

type ShareImageRequest = {
  content?: string;
  poem_title?: string;
  author?: string;
};

const DEFAULT_CLOUDFLARE_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';

function buildImagePrompt(content: string, poemTitle: string, author: string): string {
  return [
    'A refined poetic image inspired by this poem line.',
    'No text, no watermark, no typography. Leave natural negative space for a poem overlay.',
    'The image should be beautiful first: atmospheric, cinematic, elegant, emotionally faithful.',
    'Avoid busy compositions. Prefer one strong visual subject, subtle depth, and graceful lighting.',
    'It should fit a deep-space poetry website, but the poem imagery is more important than literal stars.',
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

  const prompt = buildImagePrompt(content, poem_title, author);

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

    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return res.status(200).json({
      image: `data:${contentType};base64,${base64}`,
      model,
      provider: 'cloudflare-ai',
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to generate share image',
      detail: error instanceof Error ? error.message : String(error),
      model,
    });
  }
}
