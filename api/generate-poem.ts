// Vercel Serverless Function - 生成诗句
// 保护 AI API Key，不暴露在前端
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 30,
};

interface PoemData {
  content: string;
  poem_title: string;
  author: string;
}

const OPENROUTER_FREE_TEXT_MODELS = [
  'google/gemma-4-31b-it:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'liquid/lfm-2.5-1.2b-instruct:free',
  'openrouter/free',
];
const OPENROUTER_MODEL_TIMEOUT_MS = 8000;
const OPENROUTER_MAX_MODEL_ATTEMPTS = 2;
const DEEPSEEK_TIMEOUT_MS = 12000;
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';

function buildPoemPrompt(moodName: string, shouldMatchMood: boolean): string {
  const mode = shouldMatchMood
    ? `贴合情绪：${moodName}`
    : `不要按情绪选诗；随机选一首好诗中的一句`;

  return `${mode}
真实诗句。必须有明确作者和篇名，不能佚名/未知。中英古今均可。
返回JSON：{"content":"","poem_title":"","author":""}`;
}

function validatePoemData(poemData: PoemData): PoemData {
  const content = String(poemData.content || '')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/[《》]/g, '')
    .trim();
  const poemTitle = String(poemData.poem_title || '').trim();
  const author = String(poemData.author || '').trim();

  if (!content || !poemTitle || !author) {
    throw new Error('返回数据不完整');
  }

  if (/^(未知|佚名|无)$/i.test(content) || content.length < 2) {
    throw new Error('诗句内容无效');
  }

  if (/^(未知|佚名|无|anonymous|unknown)$/i.test(poemTitle)) {
    throw new Error('诗句篇目无效');
  }

  if (/^(未知|佚名|无|anonymous|unknown)$/i.test(author)) {
    throw new Error('诗句作者无效');
  }

  if (content.length > 120) {
    throw new Error('诗句过长');
  }

  return {
    content,
    poem_title: poemTitle,
    author,
  };
}

function parsePoemJson(text: string): PoemData {
  const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    const poemData = JSON.parse(jsonMatch[0]);

    return validatePoemData(poemData);
  }

  throw new Error('无法从响应中提取诗句');
}

function getOpenRouterModels(): string[] {
  const configuredModels = (process.env.OPENROUTER_MODEL || OPENROUTER_FREE_TEXT_MODELS.join(','))
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  const models = configuredModels.length > 0 ? configuredModels : OPENROUTER_FREE_TEXT_MODELS;
  const expandedModels = models.flatMap((model) => (
    model === 'openrouter/free' ? OPENROUTER_FREE_TEXT_MODELS : [model]
  ));
  const uniqueModels = [...new Set([...expandedModels, ...OPENROUTER_FREE_TEXT_MODELS])];

  return uniqueModels;
}

function extractOpenRouterText(data: unknown): string {
  const responseData = data as {
    choices?: Array<{
      message?: {
        content?: unknown;
        reasoning?: unknown;
      };
      text?: unknown;
      finish_reason?: unknown;
      native_finish_reason?: unknown;
    }>;
    output_text?: unknown;
    model?: unknown;
  };
  const choice = responseData?.choices?.[0];
  const message = choice?.message;
  const content = message?.content;

  if (typeof content === 'string' && content.trim()) {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (typeof part?.text === 'string') {
          return part.text;
        }
        if (typeof part?.content === 'string') {
          return part.content;
        }
        return '';
      })
      .join('\n')
      .trim();

    if (text) {
      return text;
    }
  }

  if (typeof message?.reasoning === 'string' && message.reasoning.trim()) {
    return message.reasoning;
  }

  if (typeof choice?.text === 'string' && choice.text.trim()) {
    return choice.text;
  }

  if (typeof responseData?.output_text === 'string' && responseData.output_text.trim()) {
    return responseData.output_text;
  }

  console.error('❌ OpenRouter 响应缺少文本内容:', JSON.stringify({
    model: responseData?.model,
    choiceKeys: choice ? Object.keys(choice) : [],
    messageKeys: message ? Object.keys(message) : [],
    finishReason: choice?.finish_reason,
    nativeFinishReason: choice?.native_finish_reason,
  }));
  throw new Error('无法解析 OpenRouter 响应');
}

function extractChatCompletionText(data: unknown, providerName: string): string {
  const responseData = data as {
    choices?: Array<{
      message?: {
        content?: unknown;
      };
      text?: unknown;
    }>;
  };
  const choice = responseData?.choices?.[0];
  const content = choice?.message?.content;

  if (typeof content === 'string' && content.trim()) {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.content === 'string') return part.content;
        return '';
      })
      .join('\n')
      .trim();

    if (text) return text;
  }

  if (typeof choice?.text === 'string' && choice.text.trim()) {
    return choice.text;
  }

  throw new Error(`无法解析 ${providerName} 响应`);
}

async function requestOpenRouterModel(fullPrompt: string, model: string): Promise<PoemData> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('Missing OPENROUTER_API_KEY');
  }

  console.log(`🤖 OpenRouter 尝试模型: ${model}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_MODEL_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://blindpoem.vercel.app',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'BlindPoem',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'Return JSON only. Recommend one real poem line with known title and author.',
          },
          {
            role: 'user',
            content: fullPrompt,
          },
        ],
        temperature: 0.75,
        top_p: 0.9,
        max_tokens: 256,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`OpenRouter model timeout after ${OPENROUTER_MODEL_TIMEOUT_MS / 1000}s`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  console.log('📥 收到 OpenRouter 响应，状态码:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ OpenRouter API 错误 (${model}):`, errorText);
    throw new Error(`OpenRouter API Error: ${response.status}`);
  }

  const data = await response.json();

  if (data.usage) {
    console.log('💰 OpenRouter Token 使用情况:', data.usage);
  }

  if (data.model) {
    console.log('🧭 OpenRouter 实际使用模型:', data.model);
  }

  const text = extractOpenRouterText(data);

  console.log('📄 OpenRouter 原始文本:', text);
  return parsePoemJson(text);
}

async function generateWithOpenRouter(fullPrompt: string): Promise<PoemData> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('Missing OPENROUTER_API_KEY');
  }

  let lastError: unknown;

  const models = getOpenRouterModels().slice(0, OPENROUTER_MAX_MODEL_ATTEMPTS);

  for (const model of models) {
    try {
      return await requestOpenRouterModel(fullPrompt, model);
    } catch (error) {
      lastError = error;
      console.error(`❌ OpenRouter 模型失败 (${model}):`, error);
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(`所有 OpenRouter 模型都不可用（已尝试 ${models.length} 个）`);
}

async function generateWithDeepSeek(fullPrompt: string): Promise<PoemData> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;

  if (!apiKey) {
    throw new Error('Missing DEEPSEEK_API_KEY');
  }

  console.log(`🤖 DeepSeek 尝试模型: ${model}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS);
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
            content: 'Return JSON only. Recommend one real poem line with known title and author. If uncertain, still return the best verified-looking JSON without commentary.',
          },
          {
            role: 'user',
            content: fullPrompt,
          },
        ],
        temperature: 0.55,
        top_p: 0.85,
        max_tokens: 256,
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`DeepSeek timeout after ${DEEPSEEK_TIMEOUT_MS / 1000}s`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  console.log('📥 收到 DeepSeek 响应，状态码:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ DeepSeek API 错误 (${model}):`, errorText);
    throw new Error(`DeepSeek API Error: ${response.status}`);
  }

  const data = await response.json();
  const text = extractChatCompletionText(data, 'DeepSeek');

  console.log('📄 DeepSeek 原始文本:', text);
  return parsePoemJson(text);
}

// Gemini direct provider is intentionally disabled.
// The site currently uses OpenRouter only, so it does not depend on GEMINI_API_KEY.

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.OPENROUTER_API_KEY && !process.env.DEEPSEEK_API_KEY) {
    console.error('❌ 缺少 AI API Key 环境变量');
    return res.status(500).json({ error: 'Missing OPENROUTER_API_KEY or DEEPSEEK_API_KEY configuration' });
  }

  try {
    const { keyword, moodName } = req.body;

    if (!keyword || !moodName) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const shouldMatchMood = Math.random() < 0.5;

    console.log(`🎯 生成诗句 - 关键词: ${keyword}, 心情: ${moodName}, 模式: ${shouldMatchMood ? '情绪相关' : '情绪无关'}`);

    const fullPrompt = buildPoemPrompt(moodName, shouldMatchMood);

    const providers = [
      {
        name: 'OpenRouter',
        enabled: Boolean(process.env.OPENROUTER_API_KEY),
        generate: generateWithOpenRouter,
      },
      {
        name: 'DeepSeek',
        enabled: Boolean(process.env.DEEPSEEK_API_KEY),
        generate: generateWithDeepSeek,
      },
    ];

    let lastError: unknown;

    for (const provider of providers) {
      if (!provider.enabled) {
        continue;
      }

      try {
        console.log(`🤖 尝试使用 ${provider.name} 生成诗句`);
        const poemData = await provider.generate(fullPrompt);
        console.log(`✅ ${provider.name} 诗句生成成功:`, poemData);
        return res.status(200).json(poemData);
      } catch (providerError) {
        lastError = providerError;
        console.error(`❌ ${provider.name} 生成失败:`, providerError);
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error('所有 AI Provider 都不可用');
  } catch (error) {
    console.error('❌ API 调用失败：', error);
    
    return res.status(500).json({
      error: 'Failed to generate poem',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
