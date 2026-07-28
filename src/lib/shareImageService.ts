import type { FavoritePoem } from './favoriteService';
import { isSupabaseConfigured, supabase } from './supabaseClient';

const DAILY_LIMIT_KEY = 'blindpoem.shareImageDailyLimit.v1';
const DAILY_GENERATION_LIMIT = 3;
const POSTER_WIDTH = 1080;
const POSTER_HEIGHT = 1440;
const BACKGROUND_UPLOAD_QUALITY = 0.82;
const SEMANTIC_FALLBACK_LIMIT = 80;
const SHARE_BACKGROUND_BUCKET = 'share-backgrounds';
const WEBSITE_URL = 'https://www.blindpoem.space/';
const WEBSITE_DISPLAY_URL = 'www.blindpoem.space';
const WEBSITE_QR_CODE_PATH = '/blindpoem-site-qr.png';
const ENGLISH_POEM_FONT = '500 italic "Cormorant Garamond", Georgia, serif';
const ENGLISH_META_FONT = '500 italic "Cormorant Garamond", Georgia, serif';
const ENV_BYPASS_SHARE_IMAGE_LIMIT =
  import.meta.env.DEV && import.meta.env.VITE_BYPASS_SHARE_IMAGE_LIMIT === 'true';

export type PosterBrandingOptions = {
  showQRCode: boolean;
  showBranding: boolean;
};

const DEFAULT_BRANDING_OPTIONS: PosterBrandingOptions = {
  showQRCode: true,
  showBranding: true,
};

const POSTER_QR_RESERVED_ZONE = { left: 34, top: 1276, right: 172, bottom: 1414 };
const POSTER_BRAND_RESERVED_ZONE = { left: 790, top: 1310, right: 1052, bottom: 1414 };
const POSTER_BRANDING_CLEARANCE = 18;
const POSTER_LAYOUT_EDGE_PADDING = 18;

type PosterStyle = {
  name: string;
  background: [string, string, string];
  accent: string;
  mist: string;
  text: string;
};

export type PosterLayoutKind = 'bottom-left' | 'bottom-right-small' | 'upper-left-vertical' | 'right-vertical';

export type PosterTextLayout = {
  kind: PosterLayoutKind;
  styleName: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontScale?: number;
};

export type ShareImageResult = {
  image: string;
  backgroundImage: string;
  backgroundSource: 'ai' | 'semantic-fallback' | 'local-fallback';
  layout: PosterTextLayout;
};

export type PosterTextPreviewMetrics = {
  fontSize: number;
  lineHeight: number;
  metaFontSize: number;
  metaLineHeight: number;
  textAlign: 'left' | 'right' | 'center';
  isVertical: boolean;
  verticalCharAdvance?: number;
};

type RemoteShareImageResult = {
  image: string;
  visualBrief: string | null;
};

type ShareBackgroundRecord = {
  image_url: string;
  storage_path?: string | null;
  content?: string | null;
  poem_title?: string | null;
  author?: string | null;
  visual_brief?: string | null;
  tags?: string[] | null;
};

const POSTER_STYLES: PosterStyle[] = [
  {
    name: 'deep-space',
    background: ['#050716', '#101a35', '#3f315f'],
    accent: '#f6d77b',
    mist: 'rgba(105, 123, 214, 0.18)',
    text: '#fff7d6',
  },
  {
    name: 'ink-moon',
    background: ['#071016', '#14272d', '#d8b26b'],
    accent: '#e8d49b',
    mist: 'rgba(228, 236, 226, 0.16)',
    text: '#fff8e7',
  },
  {
    name: 'film-dawn',
    background: ['#160c1a', '#713f4a', '#d2a55f'],
    accent: '#ffd79a',
    mist: 'rgba(255, 213, 154, 0.17)',
    text: '#fff4df',
  },
  {
    name: 'blue-rain',
    background: ['#06111f', '#1f4b66', '#93a8ac'],
    accent: '#c8f0ff',
    mist: 'rgba(170, 221, 232, 0.16)',
    text: '#edfaff',
  },
];

const POSTER_SAFE_AREA = {
  left: 44,
  top: 80,
  right: 44,
  bottom: 190,
};
const POSTER_UNBROKEN_MIN_FONT_SIZE = 12;
const POSTER_VERTICAL_BASE_FONT_SIZE = 52;
const POSTER_EDITOR_MIN_FONT_SIZE = 24;
const POSTER_DEFAULT_MIN_FONT_SCALE = 0.45;

const POSTER_TEXT_BASE_LAYOUTS: Record<PosterLayoutKind, Pick<PosterTextLayout, 'x' | 'y' | 'width' | 'height'>> = {
  'bottom-left': { x: 92, y: 900, width: 690, height: 310 },
  'bottom-right-small': { x: POSTER_WIDTH - 92 - 560, y: 940, width: 560, height: 270 },
  'upper-left-vertical': { x: 92, y: 170, width: 430, height: 850 },
  'right-vertical': { x: POSTER_WIDTH - 92 - 430, y: 170, width: 430, height: 850 },
};

export const SHARE_POSTER_SIZE = {
  width: POSTER_WIDTH,
  height: POSTER_HEIGHT,
};

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getPosterFontScale(layout: PosterTextLayout): number {
  const minScale = layout.kind.includes('vertical')
    ? POSTER_EDITOR_MIN_FONT_SIZE / POSTER_VERTICAL_BASE_FONT_SIZE
    : POSTER_DEFAULT_MIN_FONT_SCALE;
  return clamp(layout.fontScale ?? 1, minScale, 2.8);
}

function getMetaScaleFromFontSize(fontSize: number): number {
  return clamp(fontSize / 48, 0.72, 1.32);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readDailyCount(): { date: string; count: number } {
  if (typeof window === 'undefined') return { date: todayKey(), count: 0 };

  try {
    const raw = window.localStorage.getItem(DAILY_LIMIT_KEY);
    if (!raw) return { date: todayKey(), count: 0 };

    const parsed = JSON.parse(raw) as { date?: string; count?: number };
    return parsed.date === todayKey()
      ? { date: parsed.date, count: parsed.count || 0 }
      : { date: todayKey(), count: 0 };
  } catch {
    return { date: todayKey(), count: 0 };
  }
}

function writeDailyCount(count: number): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DAILY_LIMIT_KEY, JSON.stringify({ date: todayKey(), count }));
}

export function getRemainingShareImageGenerations(bypassLimit = false): number {
  if (ENV_BYPASS_SHARE_IMAGE_LIMIT || bypassLimit) return Number.POSITIVE_INFINITY;
  return Math.max(0, DAILY_GENERATION_LIMIT - readDailyCount().count);
}

export function isShareImageGenerationLimitBypassed(bypassLimit = false): boolean {
  return ENV_BYPASS_SHARE_IMAGE_LIMIT || bypassLimit;
}

function consumeGenerationQuota(bypassLimit = false): boolean {
  if (ENV_BYPASS_SHARE_IMAGE_LIMIT || bypassLimit) return true;

  const dailyCount = readDailyCount();
  if (dailyCount.count >= DAILY_GENERATION_LIMIT) return false;

  writeDailyCount(dailyCount.count + 1);
  return true;
}

function hasAiGenerationQuota(bypassLimit = false): boolean {
  return ENV_BYPASS_SHARE_IMAGE_LIMIT || bypassLimit || readDailyCount().count < DAILY_GENERATION_LIMIT;
}

function assertAndConsumeAiGenerationQuota(bypassLimit = false): void {
  if (!consumeGenerationQuota(bypassLimit)) {
    throw new Error(`今日 AI 分享图生成次数已用完，明天会恢复 ${DAILY_GENERATION_LIMIT} 次。`);
  }
}

function preservePoemLines(
  context: CanvasRenderingContext2D,
  sourceLines: string[],
  maxWidth: number
): string[] | null {
  return sourceLines.every((line) => context.measureText(line).width <= maxWidth)
    ? sourceLines
    : null;
}

function wrapEnglishText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(nextLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

function getEnglishSourceLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function fitEnglishLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  startSize: number,
  minSize: number
): { fontSize: number; lines: string[]; lineHeight: number } {
  const sourceLines = getEnglishSourceLines(text);

  for (let fontSize = startSize; fontSize >= minSize; fontSize -= 2) {
    context.font = `${fontSize}px ${ENGLISH_POEM_FONT}`;
    const lineHeight = Math.round(fontSize * 1.34);
    const tooWide = sourceLines.some((line) => context.measureText(line).width > maxWidth);
    if (sourceLines.length <= maxLines && !tooWide) {
      return { fontSize, lines: sourceLines, lineHeight };
    }
  }

  context.font = `${minSize}px ${ENGLISH_POEM_FONT}`;
  return {
    fontSize: minSize,
    // Explicit poem line breaks are semantic. Never silently rewrap or truncate them.
    lines: sourceLines,
    lineHeight: Math.round(minSize * 1.34),
  };
}

function drawSoftOrb(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string
) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function loadImage(source: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const [header, base64Data] = dataUrl.split(',');
  const mimeMatch = header?.match(/^data:([^;]+);base64$/);
  if (!mimeMatch || !base64Data) return null;

  const binary = window.atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeMatch[1] });
}

function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^\p{Script=Han}a-z0-9]+/gu, '')
    .trim();
}

function extractSemanticTags(...sources: Array<string | null | undefined>): string[] {
  const text = sources.filter(Boolean).join(' ').toLowerCase();
  const tags = new Set<string>();
  const phraseMap: Array<[string, string[]]> = [
    ['月', ['月', 'moon', 'night']],
    ['moon', ['月', 'moon', 'night']],
    ['夜', ['夜', 'night', 'dark']],
    ['星', ['星', 'star', 'night']],
    ['雨', ['雨', 'rain', 'mist']],
    ['雪', ['雪', 'snow', 'winter']],
    ['风', ['风', 'wind']],
    ['云', ['云', 'cloud', 'sky']],
    ['山', ['山', 'mountain']],
    ['水', ['水', 'river', 'lake']],
    ['江', ['水', 'river']],
    ['河', ['水', 'river']],
    ['海', ['海', 'ocean']],
    ['湖', ['湖', 'lake']],
    ['花', ['花', 'flower', 'spring']],
    ['树', ['树', 'forest']],
    ['林', ['林', 'forest']],
    ['春', ['春', 'spring']],
    ['夏', ['夏', 'summer']],
    ['秋', ['秋', 'autumn']],
    ['冬', ['冬', 'winter']],
    ['酒', ['酒', 'wine', 'warmth']],
    ['茶', ['茶', 'tea', 'quiet']],
    ['灯', ['灯', 'lamp', 'night']],
    ['梦', ['梦', 'dream']],
    ['孤', ['孤独', 'solitude']],
    ['愁', ['忧愁', 'melancholy']],
    ['别', ['离别', 'farewell']],
    ['远', ['远方', 'distance']],
    ['归', ['归来', 'homecoming']],
    ['光', ['光', 'light']],
    ['sun', ['sun', 'light']],
    ['dawn', ['dawn', 'light']],
    ['dusk', ['dusk', 'evening']],
    ['rain', ['雨', 'rain', 'mist']],
    ['snow', ['雪', 'snow', 'winter']],
    ['mountain', ['山', 'mountain']],
    ['river', ['水', 'river']],
    ['forest', ['林', 'forest']],
    ['flower', ['花', 'flower']],
    ['solitude', ['孤独', 'solitude']],
    ['melancholy', ['忧愁', 'melancholy']],
    ['quiet', ['安静', 'quiet']],
  ];

  phraseMap.forEach(([needle, values]) => {
    if (text.includes(needle)) {
      values.forEach((value) => tags.add(normalizeTag(value)));
    }
  });

  const tokens = text.match(/[\p{Script=Han}]{1,2}|[a-z0-9]{3,}/gu) || [];
  tokens.slice(0, 80).forEach((token) => {
    const normalized = normalizeTag(token);
    if (normalized.length >= 2) tags.add(normalized);
  });

  return [...tags].filter(Boolean).slice(0, 32);
}

function scoreSemanticBackground(record: ShareBackgroundRecord, targetTags: string[]): number {
  const recordTags = new Set((record.tags || []).map(normalizeTag).filter(Boolean));
  const target = targetTags.map(normalizeTag).filter(Boolean);
  let score = 0;

  target.forEach((tag) => {
    if (recordTags.has(tag)) score += 4;
  });

  const haystack = [
    record.content,
    record.poem_title,
    record.author,
    record.visual_brief,
  ].filter(Boolean).join(' ').toLowerCase();

  target.forEach((tag) => {
    if (tag && haystack.includes(tag)) score += 1;
  });

  return score;
}

async function findSemanticFallbackBackground(poem: FavoritePoem): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const targetTags = extractSemanticTags(poem.content, poem.poem_title, poem.author);
  if (targetTags.length === 0) return null;

  try {
    const { data, error } = await supabase
      .from('share_backgrounds')
      .select('image_url, storage_path, content, poem_title, author, visual_brief, tags')
      .order('created_at', { ascending: false })
      .limit(SEMANTIC_FALLBACK_LIMIT);

    if (error || !data || data.length === 0) {
      if (error) console.warn('⚠️ 读取 Supabase 背景池失败：', error);
      return null;
    }

    const ranked = (data as ShareBackgroundRecord[])
      .map((record) => ({ record, score: scoreSemanticBackground(record, targetTags) }))
      .filter(({ record, score }) => score > 0 && Boolean(record.image_url))
      .sort((a, b) => b.score - a.score);

    return ranked[0]?.record.image_url || null;
  } catch (error) {
    console.warn('⚠️ 语义背景兜底失败：', error);
    return null;
  }
}

async function uploadShareBackground(
  poem: FavoritePoem,
  backgroundImage: string,
  visualBrief: string | null
): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase || !backgroundImage.startsWith('data:image/')) {
    return null;
  }

  const blob = dataUrlToBlob(backgroundImage);
  if (!blob) return null;

  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const date = new Date().toISOString().slice(0, 10);
  const storagePath = `generated/${date}/${id}.jpg`;
  const tags = extractSemanticTags(poem.content, poem.poem_title, poem.author, visualBrief);

  try {
    const { error: uploadError } = await supabase.storage
      .from(SHARE_BACKGROUND_BUCKET)
      .upload(storagePath, blob, {
        contentType: 'image/jpeg',
        cacheControl: '31536000',
        upsert: false,
      });

    if (uploadError) {
      console.warn('⚠️ 上传分享背景到 Supabase Storage 失败：', uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from(SHARE_BACKGROUND_BUCKET)
      .getPublicUrl(storagePath);
    const imageUrl = data.publicUrl;

    const { error: insertError } = await supabase
      .from('share_backgrounds')
      .insert({
        storage_path: storagePath,
        image_url: imageUrl,
        content: poem.content,
        poem_title: poem.poem_title,
        author: poem.author,
        visual_brief: visualBrief,
        tags,
      });

    if (insertError) {
      console.warn('⚠️ 写入分享背景元数据失败：', insertError);
    }

    return imageUrl;
  } catch (error) {
    console.warn('⚠️ 保存分享背景失败：', error);
    return null;
  }
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number
) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  context.drawImage(image, x, y, drawWidth, drawHeight);
}

function drawPosterFooter(
  context: CanvasRenderingContext2D,
  siteQRCode: HTMLImageElement | null,
  options: PosterBrandingOptions
) {
  const margin = 44;
  const qrSize = 92;
  const qrPadding = 8;
  const qrBoxSize = qrSize + qrPadding * 2;
  const qrX = margin;
  const qrY = POSTER_HEIGHT - margin - qrBoxSize;

  context.save();

  if (options.showQRCode && siteQRCode) {
    context.fillStyle = 'rgba(255, 255, 255, 0.9)';
    context.beginPath();
    context.roundRect(qrX, qrY, qrBoxSize, qrBoxSize, 10);
    context.fill();
    context.drawImage(siteQRCode, qrX + qrPadding, qrY + qrPadding, qrSize, qrSize);
  }

  if (options.showBranding) {
    context.textAlign = 'right';
    context.fillStyle = 'rgba(255, 244, 210, 0.66)';
    context.font = '24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    context.fillText('BlindPoem 盲盒诗', POSTER_WIDTH - margin, POSTER_HEIGHT - margin - 26);

    context.fillStyle = 'rgba(255, 244, 210, 0.52)';
    context.font = '20px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    context.fillText(WEBSITE_DISPLAY_URL, POSTER_WIDTH - margin, POSTER_HEIGHT - margin);
  }

  context.restore();
}

export function isEnglishPoem(text: string): boolean {
  const latinChars = text.match(/[A-Za-z]/g)?.length || 0;
  const cjkChars = text.match(/[\u3400-\u9fff]/g)?.length || 0;
  return latinChars > 0 && latinChars >= cjkChars * 2;
}

function getPoemSourceLines(text: string): string[] {
  const explicitLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (explicitLines.length > 0) {
    return explicitLines;
  }

  const compactText = text.trim();
  return compactText.match(/[^，。；！？,.!?;:：]+[，。；！？,.!?;:：]?/g)
    ?.map((line) => line.replace(/[，。；！？,.!?;:：]+$/g, '').trim())
    .filter(Boolean) || (compactText ? [compactText] : []);
}

function createPosterLayoutText(poem: FavoritePoem, layout: PosterTextLayout): string {
  const context = createMeasureContext();
  const scale = getPosterFontScale(layout);

  if (!context) return layout.text || poem.content;

  if (isEnglishPoem(poem.content)) {
    const isRight = layout.kind === 'bottom-right-small';
    const fitted = fitEnglishLines(
      context,
      layout.text || poem.content,
      layout.width,
      Math.max(1, Math.floor(layout.height / 40)),
      Math.round((isRight ? 44 : 54) * scale),
      Math.round(24 * scale)
    );

    return fitted.lines.join('\n') || layout.text || poem.content;
  }

  if (layout.kind === 'upper-left-vertical' || layout.kind === 'right-vertical') {
    const fitted = fitVerticalPoemColumns(
      getPoemSourceLines(layout.text || poem.content),
      layout.width,
      layout.height,
      Math.round(52 * scale),
      Math.round(26 * scale)
    );

    return fitted.columns.join('\n') || layout.text || poem.content;
  }

  const isRight = layout.kind === 'bottom-right-small';
  const fitted = fitPoemLines(
    context,
    getPoemSourceLines(layout.text || poem.content),
    'QianTuBiFeng, serif',
    layout.width,
    layout.height,
    Math.round((isRight ? 42 : 56) * scale),
    Math.round(24 * scale),
    isRight ? 1.45 : 1.48
  );

  return fitted.lines.join('\n') || layout.text || poem.content;
}

function createFormattedPosterLayout(poem: FavoritePoem, layout: PosterTextLayout): PosterTextLayout {
  return {
    ...layout,
    text: createPosterLayoutText(poem, layout),
  };
}

function getPosterTextStartSize(poem: FavoritePoem, layout: PosterTextLayout): number {
  const scale = getPosterFontScale(layout);

  if (isEnglishPoem(poem.content)) {
    return Math.round((layout.kind === 'bottom-right-small' ? 44 : 54) * scale);
  }

  if (layout.kind === 'upper-left-vertical' || layout.kind === 'right-vertical') {
    return Math.round(52 * scale);
  }

  return Math.round((layout.kind === 'bottom-right-small' ? 42 : 56) * scale);
}

function createNaturalPosterTextLayout(poem: FavoritePoem, layout: PosterTextLayout): PosterTextLayout {
  const context = createMeasureContext();
  if (!context) return createFormattedPosterLayout(poem, layout);

  const sourceLines = getPoemSourceLines(layout.text || poem.content);
  const nextLayout = {
    ...layout,
    text: sourceLines.join('\n'),
  };
  const originalRight = layout.x + layout.width;
  const maxWidth = POSTER_WIDTH - POSTER_SAFE_AREA.left - POSTER_SAFE_AREA.right;
  const maxHeight = POSTER_HEIGHT - POSTER_SAFE_AREA.top - POSTER_SAFE_AREA.bottom;
  let fontSize = getPosterTextStartSize(poem, layout);

  if (isEnglishPoem(poem.content)) {
    context.font = `${fontSize}px ${ENGLISH_POEM_FONT}`;
    const lines = sourceLines.length > 0 ? sourceLines : [layout.text || poem.content];
    const lineHeight = Math.round(fontSize * 1.34);
    let measuredWidth = Math.max(1, ...lines.map((line) => context.measureText(line).width));
    let measuredHeight = Math.max(fontSize, (lines.length - 1) * lineHeight + fontSize);
    const fitScale = Math.min(1, maxWidth / measuredWidth, maxHeight / measuredHeight);
    if (fitScale < 1) {
      fontSize = Math.max(POSTER_UNBROKEN_MIN_FONT_SIZE, Math.floor(fontSize * fitScale));
      context.font = `${fontSize}px ${ENGLISH_POEM_FONT}`;
      measuredWidth = Math.max(1, ...lines.map((line) => context.measureText(line).width));
      const fittedLineHeight = Math.round(fontSize * 1.34);
      measuredHeight = Math.max(fontSize, (lines.length - 1) * fittedLineHeight + fontSize);
    }
    nextLayout.text = lines.join('\n');
    nextLayout.width = Math.ceil(measuredWidth);
    nextLayout.height = Math.ceil(measuredHeight);
    nextLayout.fontScale = fontSize / (layout.kind === 'bottom-right-small' ? 44 : 54);
  } else if (layout.kind === 'upper-left-vertical' || layout.kind === 'right-vertical') {
    const columns = sourceLines.map((line) => line.replace(/\s+/g, '')).filter(Boolean);
    const measureVertical = (size: number) => {
      const lineHeight = Math.round(size * 1.22);
      const columnGap = Math.round(size * 0.86);
      return {
        width: Math.max(size, size + Math.max(0, columns.length - 1) * columnGap),
        height: Math.max(
          size,
          (Math.max(1, ...columns.map((column) => [...column].length)) - 1) * lineHeight + size
        ),
      };
    };
    let measured = measureVertical(fontSize);
    const fitScale = Math.min(1, maxWidth / measured.width, maxHeight / measured.height);
    if (fitScale < 1) {
      fontSize = Math.max(POSTER_UNBROKEN_MIN_FONT_SIZE, Math.floor(fontSize * fitScale));
      measured = measureVertical(fontSize);
    }
    nextLayout.text = columns.join('\n');
    nextLayout.width = Math.ceil(measured.width);
    nextLayout.height = Math.ceil(measured.height);
    nextLayout.fontScale = fontSize / 52;
  } else {
    context.font = `${fontSize}px QianTuBiFeng, serif`;
    const lineHeightRatio = layout.kind === 'bottom-right-small' ? 1.45 : 1.48;
    let lineHeight = Math.round(fontSize * lineHeightRatio);
    let measuredWidth = Math.max(1, ...sourceLines.map((line) => context.measureText(line).width));
    let measuredHeight = Math.max(fontSize, (sourceLines.length - 1) * lineHeight + fontSize);
    const fitScale = Math.min(1, maxWidth / measuredWidth, maxHeight / measuredHeight);
    if (fitScale < 1) {
      fontSize = Math.max(POSTER_UNBROKEN_MIN_FONT_SIZE, Math.floor(fontSize * fitScale));
      context.font = `${fontSize}px QianTuBiFeng, serif`;
      lineHeight = Math.round(fontSize * lineHeightRatio);
      measuredWidth = Math.max(1, ...sourceLines.map((line) => context.measureText(line).width));
      measuredHeight = Math.max(fontSize, (sourceLines.length - 1) * lineHeight + fontSize);
    }
    nextLayout.width = Math.ceil(measuredWidth);
    nextLayout.height = Math.ceil(measuredHeight);
    nextLayout.fontScale = fontSize / (layout.kind === 'bottom-right-small' ? 42 : 56);
  }

  nextLayout.width = Math.min(maxWidth, Math.max(80, nextLayout.width));
  nextLayout.height = Math.min(maxHeight, Math.max(80, nextLayout.height));
  if (layout.kind === 'bottom-right-small' || layout.kind === 'right-vertical') {
    nextLayout.x = originalRight - nextLayout.width;
  }
  nextLayout.x = clamp(nextLayout.x, POSTER_SAFE_AREA.left, POSTER_WIDTH - POSTER_SAFE_AREA.right - nextLayout.width);
  nextLayout.y = clamp(nextLayout.y, POSTER_SAFE_AREA.top, POSTER_HEIGHT - POSTER_SAFE_AREA.bottom - nextLayout.height);

  return nextLayout;
}

function fitPosterLayoutBoxToText(poem: FavoritePoem, layout: PosterTextLayout): PosterTextLayout {
  const formattedLayout = createFormattedPosterLayout(poem, layout);
  const metrics = getPosterTextPreviewMetrics(poem, formattedLayout);
  const textLines = formattedLayout.text.split(/\r?\n/).filter(Boolean);
  const nextLayout = { ...formattedLayout };
  const originalRight = formattedLayout.x + formattedLayout.width;
  const baseFontSize = isEnglishPoem(poem.content)
    ? (formattedLayout.kind === 'bottom-right-small' ? 44 : 54)
    : formattedLayout.kind.includes('vertical')
      ? 52
      : formattedLayout.kind === 'bottom-right-small'
        ? 42
        : 56;

  if (formattedLayout.kind.includes('vertical')) {
    const columnCount = Math.max(1, textLines.length);
    const maxChars = Math.max(1, ...textLines.map((line) => [...line.replace(/\s+/g, '')].length));
    // The editor uses one canonical integer font size. Box dimensions, character
    // advance and column gap are all derived from it, so fitting cannot silently
    // shrink the glyphs below the size recorded in fontScale.
    const editorFontSize = Math.max(
      POSTER_EDITOR_MIN_FONT_SIZE,
      Math.round(POSTER_VERTICAL_BASE_FONT_SIZE * getPosterFontScale(formattedLayout))
    );
    const verticalCharAdvance = Math.round(editorFontSize * 1.22);
    const columnGap = Math.round(editorFontSize * 0.86);
    nextLayout.fontScale = editorFontSize / POSTER_VERTICAL_BASE_FONT_SIZE;
    // Both reading directions use identical geometry: the first column takes a
    // full glyph width and each following column advances by columnGap. Only
    // the physical anchor changes between left-to-right and right-to-left.
    nextLayout.width = Math.max(
      editorFontSize,
      editorFontSize + (columnCount - 1) * columnGap
    );
    // The browser's vertical textarea reserves the full character advance for
    // every glyph (including the last one). Using visible glyph bounds here
    // makes the last character wrap into a new column in the editor.
    nextLayout.height = Math.max(verticalCharAdvance, maxChars * verticalCharAdvance)
      + Math.max(4, editorFontSize * 0.12);
  } else {
    nextLayout.fontScale = metrics.fontSize / baseFontSize;
    const context = createMeasureContext();
    if (context) {
      context.font = isEnglishPoem(poem.content)
        ? `${metrics.fontSize}px ${ENGLISH_POEM_FONT}`
        : `${metrics.fontSize}px QianTuBiFeng, serif`;
      const measuredWidth = Math.max(
        1,
        ...textLines.map((line) => context.measureText(line).width)
      );
      nextLayout.width = measuredWidth;
    }
    // Match the DOM line-box model used by the textarea preview.
    nextLayout.height = Math.max(metrics.lineHeight, textLines.length * metrics.lineHeight)
      + Math.max(4, metrics.fontSize * 0.12);
  }

  const minimumEditorWidth = formattedLayout.kind.includes('vertical') ? 36 : 80;
  nextLayout.width = Math.min(POSTER_WIDTH, Math.max(minimumEditorWidth, Math.ceil(nextLayout.width)));
  nextLayout.height = Math.min(POSTER_HEIGHT, Math.max(80, Math.ceil(nextLayout.height)));
  if (formattedLayout.kind === 'bottom-right-small' || formattedLayout.kind === 'right-vertical') {
    nextLayout.x = originalRight - nextLayout.width;
  }
  nextLayout.x = clamp(nextLayout.x, 0, POSTER_WIDTH - nextLayout.width);
  nextLayout.y = clamp(nextLayout.y, 0, POSTER_HEIGHT - nextLayout.height);

  return createFormattedPosterLayout(poem, nextLayout);
}

export function formatPosterTextLayoutForEditing(
  poem: FavoritePoem,
  layout: PosterTextLayout
): PosterTextLayout {
  return fitPosterLayoutBoxToText(poem, layout);
}

export function createPosterLayoutForKind(
  poem: FavoritePoem,
  layout: PosterTextLayout,
  kind: PosterLayoutKind,
  size: Pick<PosterTextLayout, 'width' | 'height'>
): PosterTextLayout {
  return createNaturalPosterTextLayout(poem, {
    ...layout,
    kind,
    text: poem.content,
    width: size.width,
    height: size.height,
    fontScale: layout.fontScale ?? 1,
  });
}

function fitPoemLines(
  context: CanvasRenderingContext2D,
  sourceLines: string[],
  fontFamily: string,
  maxWidth: number,
  maxHeight: number,
  startSize: number,
  minSize: number,
  lineHeightRatio: number
): { fontSize: number; lineHeight: number; lines: string[] } {
  const safeMinSize = Math.min(minSize, POSTER_UNBROKEN_MIN_FONT_SIZE);

  for (let fontSize = startSize; fontSize >= safeMinSize; fontSize -= 2) {
    context.font = `${fontSize}px ${fontFamily}`;
    const lines = preservePoemLines(context, sourceLines, maxWidth);
    const lineHeight = Math.round(fontSize * lineHeightRatio);

    if (lines && (lines.length - 1) * lineHeight + fontSize <= maxHeight) {
      return { fontSize, lineHeight, lines };
    }
  }

  context.font = `${safeMinSize}px ${fontFamily}`;
  const lineHeight = Math.round(safeMinSize * lineHeightRatio);
  return {
    fontSize: safeMinSize,
    lineHeight,
    lines: sourceLines,
  };
}

function fitVerticalPoemColumns(
  sourceLines: string[],
  maxWidth: number,
  maxHeight: number,
  startSize: number,
  minSize: number
): { fontSize: number; lineHeight: number; columnGap: number; columns: string[] } {
  const columns = sourceLines.map((line) => line.replace(/\s+/g, '')).filter(Boolean);
  // Vertical text has the same single 24px lower bound in preview and export.
  // Do not let a scale-derived minSize reintroduce the legacy 12px fallback:
  // that makes the glyph metrics diverge from the box redrawn at 24px.
  const safeMinSize = Math.max(minSize, POSTER_EDITOR_MIN_FONT_SIZE);

  for (let fontSize = startSize; fontSize >= safeMinSize; fontSize -= 2) {
    const lineHeight = Math.round(fontSize * 1.22);
    const columnGap = Math.round(fontSize * 0.86);
    const totalWidth = fontSize + Math.max(0, columns.length - 1) * columnGap;
    const fitsHeight = columns.every((column) => (
      Math.max(fontSize, ([...column].length - 1) * lineHeight + fontSize) <= maxHeight
    ));

    if (fitsHeight && totalWidth <= maxWidth) {
      return { fontSize, lineHeight, columnGap, columns };
    }
  }

  const lineHeight = Math.round(safeMinSize * 1.22);
  const columnGap = Math.round(safeMinSize * 0.86);
  return { fontSize: safeMinSize, lineHeight, columnGap, columns };
}

function drawVerticalColumns(
  context: CanvasRenderingContext2D,
  columns: string[],
  startX: number,
  y: number,
  columnGap: number,
  lineHeight: number,
  direction: 1 | -1
) {
  columns.forEach((column, columnIndex) => {
    const x = startX + columnIndex * columnGap * direction;
    [...column].forEach((char, charIndex) => {
      context.fillText(char, x, y + charIndex * lineHeight);
    });
  });
}

function formatVerticalBookTitle(title: string): string {
  const cleanedTitle = title.replace(/[《》︽︾]/g, '').trim();
  return `︽${cleanedTitle}︾`;
}

function hasPoemAttribution(poem: Pick<FavoritePoem, 'poem_title' | 'author'>): boolean {
  return Boolean(poem.poem_title.trim() && poem.author.trim());
}

function getPoemShareText(poem: FavoritePoem): string {
  const attribution = hasPoemAttribution(poem)
    ? `\n《${poem.poem_title}》— ${poem.author}`
    : '';
  return `${poem.content}${attribution}\nBlindPoem 盲盒诗`;
}

function drawEnglishPosterText(
  context: CanvasRenderingContext2D,
  poem: FavoritePoem,
  style: PosterStyle,
  layout: PosterTextLayout
) {
  const isRight = layout.kind === 'bottom-right-small';
  const scale = getPosterFontScale(layout);
  const x = isRight ? layout.x + layout.width : layout.x;

  context.textAlign = isRight ? 'right' : 'left';
  context.fillStyle = style.text;

  const fitted = fitEnglishLines(
    context,
    layout.text,
    layout.width,
    Math.max(1, Math.floor(layout.height / 40)),
    Math.round((isRight ? 44 : 54) * scale),
    Math.round(24 * scale)
  );
  context.font = `${fitted.fontSize}px ${ENGLISH_POEM_FONT}`;
  fitted.lines.forEach((line, index) => {
    context.fillText(line, x, layout.y + index * fitted.lineHeight);
  });

  context.shadowBlur = 0;
  context.fillStyle = style.accent;
  const metaFontSize = Math.round(26 * getMetaScaleFromFontSize(fitted.fontSize));
  const metaLineHeight = Math.round(metaFontSize * 1.32);
  context.font = `${metaFontSize}px ${ENGLISH_META_FONT}`;
  context.textAlign = 'right';
  if (!hasPoemAttribution(poem)) return;
  const metaText = `《${poem.poem_title}》`;
  const metaLines = wrapEnglishText(context, metaText, layout.width);
  const metaY = clamp(
    layout.y + layout.height + metaLineHeight * 0.35,
    metaLineHeight,
    POSTER_HEIGHT - 28
  );
  const metaX = layout.x + layout.width;
  metaLines.slice(0, 2).forEach((line, index) => {
    context.fillText(line, metaX, metaY + index * metaLineHeight);
  });
}

function getPosterLayoutKinds(poem: FavoritePoem): PosterLayoutKind[] {
  return isEnglishPoem(poem.content)
    ? ['bottom-left', 'bottom-right-small']
    : ['bottom-left', 'upper-left-vertical', 'right-vertical', 'bottom-right-small'];
}

function scoreImageCell(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): number {
  const imageData = context.getImageData(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  const data = imageData.data;
  const step = 12;
  const samples: number[] = [];
  let luminanceTotal = 0;
  let edgeTotal = 0;

  for (let row = 0; row < imageData.height; row += step) {
    for (let column = 0; column < imageData.width; column += step) {
      const index = (row * imageData.width + column) * 4;
      const luminance = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
      samples.push(luminance);
      luminanceTotal += luminance;

      if (column >= step) {
        const leftIndex = (row * imageData.width + column - step) * 4;
        const leftLuminance = data[leftIndex] * 0.299 + data[leftIndex + 1] * 0.587 + data[leftIndex + 2] * 0.114;
        edgeTotal += Math.abs(luminance - leftLuminance);
      }

      if (row >= step) {
        const topIndex = ((row - step) * imageData.width + column) * 4;
        const topLuminance = data[topIndex] * 0.299 + data[topIndex + 1] * 0.587 + data[topIndex + 2] * 0.114;
        edgeTotal += Math.abs(luminance - topLuminance);
      }
    }
  }

  const average = luminanceTotal / Math.max(1, samples.length);
  const variance = samples.reduce((total, luminance) => total + (luminance - average) ** 2, 0) / Math.max(1, samples.length);

  return variance / 900 + edgeTotal / Math.max(1, samples.length * 38);
}

function createGridScores(context: CanvasRenderingContext2D) {
  const columns = 8;
  const rows = 10;
  const x = POSTER_SAFE_AREA.left;
  const y = POSTER_SAFE_AREA.top;
  const width = POSTER_WIDTH - POSTER_SAFE_AREA.left - POSTER_SAFE_AREA.right;
  const height = POSTER_HEIGHT - POSTER_SAFE_AREA.top - POSTER_SAFE_AREA.bottom;
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const scores = Array.from({ length: rows }, (_, row) => (
    Array.from({ length: columns }, (_, column) => {
      const cellX = x + column * cellWidth;
      const cellY = y + row * cellHeight;
      const centerX = cellX + cellWidth / 2;
      const centerY = cellY + cellHeight / 2;
      const distanceFromCenter = Math.hypot(
        (centerX - POSTER_WIDTH / 2) / (POSTER_WIDTH / 2),
        (centerY - POSTER_HEIGHT / 2) / (POSTER_HEIGHT / 2)
      );
      const centerPenalty = Math.max(0, 1.2 - distanceFromCenter) * 1.6;

      return scoreImageCell(context, cellX, cellY, cellWidth, cellHeight) + centerPenalty;
    })
  ));

  return { columns, rows, x, y, width, height, cellWidth, cellHeight, scores };
}

function getLayoutScanBounds(kind: PosterLayoutKind, columnSpan: number, rowSpan: number) {
  const maxColumn = 8 - columnSpan;
  const maxRow = 10 - rowSpan;

  if (kind === 'bottom-left') {
    return {
      minColumn: 0,
      maxColumn: Math.min(maxColumn, 3),
      minRow: Math.max(0, Math.min(maxRow, 5)),
      maxRow,
    };
  }

  if (kind === 'bottom-right-small') {
    return {
      minColumn: Math.max(0, Math.min(maxColumn, 3)),
      maxColumn,
      minRow: Math.max(0, Math.min(maxRow, 5)),
      maxRow,
    };
  }

  if (kind === 'upper-left-vertical') {
    return {
      minColumn: 0,
      maxColumn: Math.min(maxColumn, 3),
      minRow: 0,
      maxRow: Math.min(maxRow, 3),
    };
  }

  return {
    minColumn: Math.max(0, Math.min(maxColumn, 4)),
    maxColumn,
    minRow: 0,
    maxRow: Math.min(maxRow, 3),
  };
}

function scoreLayoutArea(
  grid: ReturnType<typeof createGridScores>,
  kind: PosterLayoutKind,
  column: number,
  row: number,
  columnSpan: number,
  rowSpan: number
): number {
  let total = 0;
  let count = 0;

  for (let y = row; y < row + rowSpan; y += 1) {
    for (let x = column; x < column + columnSpan; x += 1) {
      total += grid.scores[y]?.[x] || 0;
      count += 1;
    }
  }

  const edgeBias = kind.includes('bottom') ? 0.35 : 0;
  return total / Math.max(1, count) + edgeBias;
}

function createScoredPosterTextLayout(
  poem: FavoritePoem,
  style: PosterStyle,
  context: CanvasRenderingContext2D
): PosterTextLayout | null {
  try {
    const grid = createGridScores(context);
    const candidates = getPosterLayoutKinds(poem).flatMap((kind) => {
      const base = POSTER_TEXT_BASE_LAYOUTS[kind];
      const columnSpan = Math.max(1, Math.min(grid.columns, Math.ceil(base.width / grid.cellWidth)));
      const rowSpan = Math.max(1, Math.min(grid.rows, Math.ceil(base.height / grid.cellHeight)));
      const bounds = getLayoutScanBounds(kind, columnSpan, rowSpan);
      const layouts: Array<{ kind: PosterLayoutKind; score: number; column: number; row: number }> = [];

      for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
        for (let column = bounds.minColumn; column <= bounds.maxColumn; column += 1) {
          layouts.push({
            kind,
            column,
            row,
            score: scoreLayoutArea(grid, kind, column, row, columnSpan, rowSpan),
          });
        }
      }

      return layouts;
    });
    const sortedCandidates = candidates.sort((a, b) => a.score - b.score);
    const topCandidates = sortedCandidates.slice(0, Math.min(4, sortedCandidates.length));
    const chosen = topCandidates[Math.floor(Math.random() * topCandidates.length)];
    if (!chosen) return null;

    const base = POSTER_TEXT_BASE_LAYOUTS[chosen.kind];
    const cellX = grid.x + chosen.column * grid.cellWidth;
    const cellY = grid.y + chosen.row * grid.cellHeight;
    const jitterX = randomBetween(-grid.cellWidth * 0.24, grid.cellWidth * 0.24);
    const jitterY = randomBetween(-grid.cellHeight * 0.24, grid.cellHeight * 0.24);
    const x = clamp(cellX + jitterX, POSTER_SAFE_AREA.left, POSTER_WIDTH - POSTER_SAFE_AREA.right - base.width);
    const y = clamp(cellY + jitterY, POSTER_SAFE_AREA.top, POSTER_HEIGHT - POSTER_SAFE_AREA.bottom - base.height);

    return {
      kind: chosen.kind,
      styleName: style.name,
      text: poem.content,
      x,
      y,
      width: base.width,
      height: base.height,
      fontScale: 1,
    };
  } catch (error) {
    console.warn('⚠️ 自动排版评分失败，使用随机布局：', error);
    return null;
  }
}

function createPosterTextLayout(
  poem: FavoritePoem,
  style: PosterStyle,
  context?: CanvasRenderingContext2D
): PosterTextLayout {
  if (context) {
    const scoredLayout = createScoredPosterTextLayout(poem, style, context);
    if (scoredLayout) return scoredLayout;
  }

  const layoutKinds = getPosterLayoutKinds(poem);
  const kind = layoutKinds[Math.floor(Math.random() * layoutKinds.length)];
  const base = POSTER_TEXT_BASE_LAYOUTS[kind];
  const jitterX = kind.includes('right') ? randomBetween(-42, 24) : randomBetween(-24, 46);
  const jitterY = kind.includes('bottom') ? randomBetween(-54, 28) : randomBetween(-36, 48);
  const x = clamp(base.x + jitterX, POSTER_SAFE_AREA.left, POSTER_WIDTH - POSTER_SAFE_AREA.right - base.width);
  const y = clamp(base.y + jitterY, POSTER_SAFE_AREA.top, POSTER_HEIGHT - POSTER_SAFE_AREA.bottom - base.height);

  return {
    kind,
    styleName: style.name,
    text: poem.content,
    x,
    y,
    width: base.width,
    height: base.height,
    fontScale: 1,
  };
}

function createMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  return canvas.getContext('2d');
}

export function getPosterTextPreviewMetrics(
  poem: FavoritePoem,
  layout: PosterTextLayout
): PosterTextPreviewMetrics {
  const context = createMeasureContext();
  const scale = getPosterFontScale(layout);

  if (!context) {
    return {
      fontSize: Math.round(48 * scale),
      lineHeight: Math.round(70 * scale),
      metaFontSize: Math.round(24 * scale),
      metaLineHeight: Math.round(34 * scale),
      textAlign: layout.kind === 'bottom-right-small' ? 'right' : 'left',
      isVertical: layout.kind.includes('vertical'),
    };
  }

  if (isEnglishPoem(poem.content)) {
    const isRight = layout.kind === 'bottom-right-small';
    const fitted = fitEnglishLines(
      context,
      layout.text,
      layout.width,
      Math.max(1, Math.floor(layout.height / 40)),
      Math.round((isRight ? 44 : 54) * scale),
      Math.round(24 * scale)
    );

    return {
      fontSize: fitted.fontSize,
      lineHeight: fitted.lineHeight,
      metaFontSize: Math.round(26 * getMetaScaleFromFontSize(fitted.fontSize)),
      metaLineHeight: Math.round(34 * getMetaScaleFromFontSize(fitted.fontSize)),
      textAlign: isRight ? 'right' : 'left',
      isVertical: false,
    };
  }

  if (layout.kind === 'upper-left-vertical' || layout.kind === 'right-vertical') {
    const fitted = fitVerticalPoemColumns(
      getPoemSourceLines(layout.text),
      layout.width,
      layout.height,
      Math.round(52 * scale),
      Math.round(26 * scale)
    );
    const metaScale = getMetaScaleFromFontSize(fitted.fontSize);

    return {
      fontSize: fitted.fontSize,
      lineHeight: fitted.columnGap,
      metaFontSize: Math.round(24 * metaScale),
      metaLineHeight: Math.round(34 * metaScale),
      textAlign: 'left',
      isVertical: true,
      verticalCharAdvance: fitted.lineHeight,
    };
  }

  const isRight = layout.kind === 'bottom-right-small';
  const fitted = fitPoemLines(
    context,
    getPoemSourceLines(layout.text),
    'QianTuBiFeng, serif',
    layout.width,
    layout.height,
    Math.round((isRight ? 42 : 56) * scale),
    Math.round(24 * scale),
    isRight ? 1.45 : 1.48
  );
  const metaFontSize = Math.max(20, Math.min(26, Math.round(fitted.fontSize * 0.58)));

  return {
    fontSize: fitted.fontSize,
    lineHeight: fitted.lineHeight,
    metaFontSize,
    metaLineHeight: Math.round(metaFontSize * 1.35),
    textAlign: isRight ? 'right' : 'left',
    isVertical: false,
  };
}

function drawPosterText(
  context: CanvasRenderingContext2D,
  poem: FavoritePoem,
  style: PosterStyle,
  layout: PosterTextLayout
) {
  context.save();
  context.fillStyle = style.text;
  context.shadowColor = 'rgba(0, 0, 0, 0.58)';
  context.shadowBlur = 18;
  context.textBaseline = 'top';
  const scale = getPosterFontScale(layout);

  if (isEnglishPoem(poem.content)) {
    drawEnglishPosterText(context, poem, style, layout);
  } else if (layout.kind === 'upper-left-vertical') {
    const poemColumns = fitVerticalPoemColumns(
      getPoemSourceLines(layout.text),
      layout.width,
      layout.height,
      Math.round(52 * scale),
      Math.round(26 * scale)
    );
    context.textAlign = 'center';
    context.font = `${poemColumns.fontSize}px QianTuBiFeng, serif`;
    const textStartX = layout.x + poemColumns.fontSize / 2;
    drawVerticalColumns(
      context,
      poemColumns.columns,
      textStartX,
      layout.y,
      poemColumns.columnGap,
      poemColumns.lineHeight,
      1
    );
    context.shadowBlur = 0;
    context.fillStyle = style.accent;
    const metaScale = getMetaScaleFromFontSize(poemColumns.fontSize);
    const metaFontSize = Math.round(24 * metaScale);
    const metaLineHeight = Math.round(34 * metaScale);
    const metaStartX = Math.min(
      POSTER_WIDTH - metaFontSize / 2 - 18,
      layout.x + layout.width + metaLineHeight
    );
    context.font = `${metaFontSize}px QianTuBiFeng, serif`;
    if (hasPoemAttribution(poem)) {
      drawVerticalColumns(
        context,
        [formatVerticalBookTitle(poem.poem_title)],
        metaStartX,
        layout.y,
        metaLineHeight,
        metaLineHeight,
        1
      );
    }
  } else if (layout.kind === 'right-vertical') {
    const poemColumns = fitVerticalPoemColumns(
      getPoemSourceLines(layout.text),
      layout.width,
      layout.height,
      Math.round(52 * scale),
      Math.round(26 * scale)
    );
    context.textAlign = 'center';
    context.font = `${poemColumns.fontSize}px QianTuBiFeng, serif`;
    const textStartX = layout.x + layout.width - poemColumns.fontSize / 2;
    drawVerticalColumns(
      context,
      poemColumns.columns,
      textStartX,
      layout.y,
      poemColumns.columnGap,
      poemColumns.lineHeight,
      -1
    );
    context.shadowBlur = 0;
    context.fillStyle = style.accent;
    const metaScale = getMetaScaleFromFontSize(poemColumns.fontSize);
    const metaFontSize = Math.round(24 * metaScale);
    const metaLineHeight = Math.round(34 * metaScale);
    const metaStartX = Math.max(metaFontSize / 2 + 18, layout.x - metaLineHeight);
    context.font = `${metaFontSize}px QianTuBiFeng, serif`;
    if (hasPoemAttribution(poem)) {
      drawVerticalColumns(
        context,
        [formatVerticalBookTitle(poem.poem_title)],
        metaStartX,
        layout.y,
        metaLineHeight,
        metaLineHeight,
        -1
      );
    }
  } else {
    const isRight = layout.kind === 'bottom-right-small';
    const x = isRight ? layout.x + layout.width : layout.x;
    const maxTextBottom = layout.y + layout.height;

    context.textAlign = isRight ? 'right' : 'left';
    const fitted = fitPoemLines(
      context,
      getPoemSourceLines(layout.text),
      'QianTuBiFeng, serif',
      layout.width,
      layout.height,
      Math.round((isRight ? 42 : 56) * scale),
      Math.round(24 * scale),
      isRight ? 1.45 : 1.48
    );
    context.font = `${fitted.fontSize}px QianTuBiFeng, serif`;
    fitted.lines.forEach((line, index) => {
      context.fillText(line, x, layout.y + index * fitted.lineHeight);
    });

    context.shadowBlur = 0;
    context.fillStyle = style.accent;
    const metaFontSize = Math.max(20, Math.min(26, Math.round(fitted.fontSize * 0.58)));
    const metaLineHeight = Math.round(metaFontSize * 1.35);
    context.font = `${metaFontSize}px QianTuBiFeng, serif`;
    const metaY = clamp(
      maxTextBottom + metaLineHeight * 0.35,
      metaLineHeight,
      POSTER_HEIGHT - 28
    );
    context.textAlign = 'right';
    if (hasPoemAttribution(poem)) {
      context.fillText(`《${poem.poem_title}》`, layout.x + layout.width, metaY, layout.width);
    }
  }

  context.restore();
}

async function tryGenerateRemoteShareImage(poem: FavoritePoem): Promise<RemoteShareImageResult | null> {
  try {
    const response = await fetch('/api/generate-share-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: poem.content,
        poem_title: poem.poem_title,
        author: poem.author,
      }),
    });

    if (!response.ok) return null;

    const result = await response.json() as { image?: string; visualBrief?: string | null };
    return result.image
      ? { image: result.image, visualBrief: result.visualBrief || null }
      : null;
  } catch {
    return null;
  }
}

function createPosterCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器无法生成分享图。');

  return [canvas, context];
}

function drawFallbackBackground(context: CanvasRenderingContext2D, style: PosterStyle) {
  const background = context.createLinearGradient(120, 0, POSTER_WIDTH, POSTER_HEIGHT);
  background.addColorStop(0, style.background[0]);
  background.addColorStop(0.55, style.background[1]);
  background.addColorStop(1, style.background[2]);
  context.fillStyle = background;
  context.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

  drawSoftOrb(context, 240, 230, 360, style.mist);
  drawSoftOrb(context, 900, 1040, 420, style.mist);

  for (let index = 0; index < 190; index += 1) {
    const x = Math.random() * POSTER_WIDTH;
    const y = Math.random() * POSTER_HEIGHT;
    const opacity = 0.18 + Math.random() * 0.62;
    const size = 0.8 + Math.random() * 2.6;
    context.fillStyle = `rgba(255, 244, 204, ${opacity})`;
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
  }

  context.strokeStyle = 'rgba(255, 240, 190, 0.36)';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(POSTER_WIDTH * 0.5, 520, 280, Math.PI * 0.08, Math.PI * 1.02);
  context.stroke();
}

function posterBoundsOverlap(
  first: { left: number; top: number; right: number; bottom: number },
  second: { left: number; top: number; right: number; bottom: number }
): boolean {
  return first.left < second.right
    && first.right > second.left
    && first.top < second.bottom
    && first.bottom > second.top;
}

function getPosterLayoutContentBounds(poem: FavoritePoem, layout: PosterTextLayout) {
  const metrics = getPosterTextPreviewMetrics(poem, layout);
  if (!hasPoemAttribution(poem)) {
    return {
      left: layout.x,
      top: layout.y,
      right: layout.x + layout.width,
      bottom: layout.y + layout.height,
    };
  }
  if (!layout.kind.includes('vertical')) {
    return {
      left: layout.x,
      top: layout.y,
      right: layout.x + layout.width,
      bottom: layout.y + layout.height + (hasPoemAttribution(poem) ? metrics.metaLineHeight * 1.45 : 0),
    };
  }

  const metaHeight = (hasPoemAttribution(poem) ? [...formatVerticalBookTitle(poem.poem_title)].length : 0)
    * metrics.metaLineHeight;
  const metaWidth = metrics.metaFontSize;
  const metaLeft = layout.kind === 'upper-left-vertical'
    ? layout.x + layout.width + metrics.metaLineHeight - metaWidth / 2
    : layout.x - metrics.metaLineHeight - metaWidth / 2;

  return {
    left: Math.min(layout.x, metaLeft),
    top: layout.y,
    right: Math.max(layout.x + layout.width, metaLeft + metaWidth),
    bottom: Math.max(layout.y + layout.height, layout.y + metaHeight),
  };
}

export function resolvePosterLayoutForBranding(
  poem: FavoritePoem,
  layout: PosterTextLayout,
  branding: PosterBrandingOptions
): PosterTextLayout {
  const nextLayout = { ...layout };
  const reservedZones = [
    ...(branding.showQRCode ? [POSTER_QR_RESERVED_ZONE] : []),
    ...(branding.showBranding ? [POSTER_BRAND_RESERVED_ZONE] : []),
  ];

  for (let index = 0; index < reservedZones.length + 1; index += 1) {
    const contentBounds = getPosterLayoutContentBounds(poem, nextLayout);
    const collisions = reservedZones.filter((zone) => posterBoundsOverlap(contentBounds, zone));
    if (collisions.length === 0) break;

    const nearestTop = Math.min(...collisions.map((zone) => zone.top));
    nextLayout.y = Math.max(
      POSTER_LAYOUT_EDGE_PADDING,
      nextLayout.y - (contentBounds.bottom - nearestTop + POSTER_BRANDING_CLEARANCE)
    );
  }

  return nextLayout;
}

async function composeShareImage(
  poem: FavoritePoem,
  backgroundImage: string,
  layout: PosterTextLayout,
  brandingOptions: PosterBrandingOptions = DEFAULT_BRANDING_OPTIONS
): Promise<string> {
  // Canvas keeps whichever fallback font is active at draw time. Wait for the
  // poster font so the completed bitmap uses the same face as the DOM preview.
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.load('52px QianTuBiFeng');
      await document.fonts.load('500 italic 52px "Cormorant Garamond"');
      await document.fonts.ready;
    } catch {
      // Keep image generation available on browsers without a working FontFaceSet.
    }
  }

  const background = await loadImage(backgroundImage);
  const siteQRCode = brandingOptions.showQRCode ? await loadImage(WEBSITE_QR_CODE_PATH) : null;
  const style = POSTER_STYLES.find((item) => item.name === layout.styleName) || POSTER_STYLES[0];
  const [canvas, context] = createPosterCanvas();

  if (background) {
    context.drawImage(background, 0, 0, POSTER_WIDTH, POSTER_HEIGHT);
  } else {
    drawFallbackBackground(context, style);
  }

  context.fillStyle = 'rgba(0, 0, 0, 0.16)';
  context.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

  drawPosterText(context, poem, style, layout);
  drawPosterFooter(context, siteQRCode, brandingOptions);

  return canvas.toDataURL('image/jpeg', 0.92);
}

export async function regenerateShareImageWithLayout(
  poem: FavoritePoem,
  backgroundImage: string,
  layout: PosterTextLayout,
  brandingOptions: PosterBrandingOptions = DEFAULT_BRANDING_OPTIONS
): Promise<ShareImageResult> {
  const formattedLayout = createFormattedPosterLayout(poem, layout);
  const resolvedLayout = resolvePosterLayoutForBranding(poem, formattedLayout, brandingOptions);
  const image = await composeShareImage(poem, backgroundImage, resolvedLayout, brandingOptions);
  return {
    image,
    backgroundImage,
    backgroundSource: poem.shareBackgroundSource || 'local-fallback',
    layout: resolvedLayout,
  };
}

export async function generateShareImage(
  poem: FavoritePoem,
  options: { bypassLimit?: boolean; branding?: PosterBrandingOptions } = {}
): Promise<ShareImageResult> {
  const style = POSTER_STYLES[Math.floor(Math.random() * POSTER_STYLES.length)];
  const remoteResult = hasAiGenerationQuota(options.bypassLimit) ? await tryGenerateRemoteShareImage(poem) : null;
  const aiBackground = remoteResult ? await loadImage(remoteResult.image) : null;
  const semanticFallbackImage = aiBackground ? null : await findSemanticFallbackBackground(poem);
  const semanticFallbackBackground = semanticFallbackImage ? await loadImage(semanticFallbackImage) : null;
  const [backgroundCanvas, backgroundContext] = createPosterCanvas();
  let backgroundSource: ShareImageResult['backgroundSource'] = 'local-fallback';

  if (aiBackground) {
    // Only successful AI backgrounds consume the daily AI image quota.
    // The local canvas fallback poster is free and must not affect the counter.
    assertAndConsumeAiGenerationQuota(options.bypassLimit);
    drawImageCover(backgroundContext, aiBackground, POSTER_WIDTH, POSTER_HEIGHT);
    backgroundSource = 'ai';
  } else if (semanticFallbackBackground) {
    drawImageCover(backgroundContext, semanticFallbackBackground, POSTER_WIDTH, POSTER_HEIGHT);
    backgroundSource = 'semantic-fallback';
  } else {
    drawFallbackBackground(backgroundContext, style);
  }

  const compressedBackgroundImage = backgroundCanvas.toDataURL('image/jpeg', BACKGROUND_UPLOAD_QUALITY);
  const uploadedBackgroundImage = backgroundSource === 'ai'
    ? await uploadShareBackground(poem, compressedBackgroundImage, remoteResult?.visualBrief || null)
    : null;
  const backgroundImage = uploadedBackgroundImage || semanticFallbackImage || compressedBackgroundImage;
  const branding = options.branding || DEFAULT_BRANDING_OPTIONS;
  const layout = resolvePosterLayoutForBranding(
    poem,
    createNaturalPosterTextLayout(poem, createPosterTextLayout(poem, style, backgroundContext)),
    branding
  );
  const image = await composeShareImage(poem, backgroundImage, layout, branding);

  return { image, backgroundImage, backgroundSource, layout };
}

export function downloadShareImage(image: string, poem: FavoritePoem): void {
  const link = document.createElement('a');
  link.href = image;
  const suffix = hasPoemAttribution(poem) ? `${poem.author}-${poem.poem_title}` : 'poem';
  link.download = `blindpoem-${suffix}.jpg`;
  link.click();
}

export async function sharePoster(image: string, poem: FavoritePoem): Promise<boolean> {
  if (!navigator.share) return false;

  const text = `${getPoemShareText(poem)}\n${WEBSITE_URL}`;

  try {
    const blob = await (await fetch(image)).blob();
    const file = new File([blob], 'blindpoem.jpg', { type: 'image/jpeg' });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text, title: 'BlindPoem 盲盒诗' });
    } else {
      await navigator.share({ text, title: 'BlindPoem 盲盒诗' });
    }

    return true;
  } catch (error) {
    console.warn('⚠️ 系统分享失败：', error);
    return false;
  }
}
