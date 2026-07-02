import type { FavoritePoem } from './favoriteService';

const DAILY_LIMIT_KEY = 'blindpoem.shareImageDailyLimit.v1';
const DAILY_GENERATION_LIMIT = 3;
const POSTER_WIDTH = 1080;
const POSTER_HEIGHT = 1440;
const WEBSITE_URL = 'https://www.blindpoem.space/';
const WEBSITE_DISPLAY_URL = 'www.blindpoem.space';
const WEBSITE_QR_CODE_PATH = '/blindpoem-site-qr.png';
const BYPASS_SHARE_IMAGE_LIMIT =
  import.meta.env.DEV && import.meta.env.VITE_BYPASS_SHARE_IMAGE_LIMIT === 'true';

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
  layout: PosterTextLayout;
};

export type PosterTextPreviewMetrics = {
  fontSize: number;
  lineHeight: number;
  metaFontSize: number;
  metaLineHeight: number;
  textAlign: 'left' | 'right' | 'center';
  isVertical: boolean;
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

const POSTER_TEXT_BASE_LAYOUTS: Record<PosterLayoutKind, Pick<PosterTextLayout, 'x' | 'y' | 'width' | 'height'>> = {
  'bottom-left': { x: 92, y: 900, width: 690, height: 310 },
  'bottom-right-small': { x: POSTER_WIDTH - 92 - 560, y: 940, width: 560, height: 270 },
  'upper-left-vertical': { x: 92, y: 170, width: 430, height: 850 },
  'right-vertical': { x: POSTER_WIDTH - 92 - 430, y: 230, width: 430, height: 830 },
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
  return clamp(layout.fontScale ?? 1, 0.35, 2.8);
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

export function getRemainingShareImageGenerations(): number {
  if (BYPASS_SHARE_IMAGE_LIMIT) return Number.POSITIVE_INFINITY;
  return Math.max(0, DAILY_GENERATION_LIMIT - readDailyCount().count);
}

export function isShareImageGenerationLimitBypassed(): boolean {
  return BYPASS_SHARE_IMAGE_LIMIT;
}

function consumeGenerationQuota(): boolean {
  if (BYPASS_SHARE_IMAGE_LIMIT) return true;

  const dailyCount = readDailyCount();
  if (dailyCount.count >= DAILY_GENERATION_LIMIT) return false;

  writeDailyCount(dailyCount.count + 1);
  return true;
}

function hasAiGenerationQuota(): boolean {
  return BYPASS_SHARE_IMAGE_LIMIT || readDailyCount().count < DAILY_GENERATION_LIMIT;
}

function assertAndConsumeAiGenerationQuota(): void {
  if (!consumeGenerationQuota()) {
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

function fitEnglishLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  startSize: number,
  minSize: number
): { fontSize: number; lines: string[]; lineHeight: number } {
  for (let fontSize = startSize; fontSize >= minSize; fontSize -= 2) {
    context.font = `${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const lines = wrapEnglishText(context, text, maxWidth);
    const tooWide = lines.some((line) => context.measureText(line).width > maxWidth);
    if (lines.length <= maxLines && !tooWide) {
      return { fontSize, lines, lineHeight: Math.round(fontSize * 1.28) };
    }
  }

  context.font = `${minSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  return {
    fontSize: minSize,
    lines: wrapEnglishText(context, text, maxWidth).slice(0, maxLines),
    lineHeight: Math.round(minSize * 1.28),
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
  siteQRCode: HTMLImageElement | null
) {
  const margin = 44;
  const qrSize = 92;
  const qrPadding = 8;
  const qrBoxSize = qrSize + qrPadding * 2;
  const qrX = margin;
  const qrY = POSTER_HEIGHT - margin - qrBoxSize;

  context.save();

  if (siteQRCode) {
    context.fillStyle = 'rgba(255, 255, 255, 0.9)';
    context.beginPath();
    context.roundRect(qrX, qrY, qrBoxSize, qrBoxSize, 10);
    context.fill();
    context.drawImage(siteQRCode, qrX + qrPadding, qrY + qrPadding, qrSize, qrSize);
  }

  context.textAlign = 'right';
  context.fillStyle = 'rgba(255, 244, 210, 0.66)';
  context.font = '24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  context.fillText('BlindPoem 盲盒诗', POSTER_WIDTH - margin, POSTER_HEIGHT - margin - 26);

  context.fillStyle = 'rgba(255, 244, 210, 0.52)';
  context.font = '20px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  context.fillText(WEBSITE_DISPLAY_URL, POSTER_WIDTH - margin, POSTER_HEIGHT - margin);

  context.restore();
}

function isEnglishPoem(text: string): boolean {
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
    context.font = `${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const lines = sourceLines.length > 0 ? sourceLines : [layout.text || poem.content];
    const lineHeight = Math.round(fontSize * 1.28);
    let measuredWidth = Math.max(1, ...lines.map((line) => context.measureText(line).width));
    let measuredHeight = Math.max(lineHeight, lines.length * lineHeight);
    const fitScale = Math.min(1, maxWidth / measuredWidth, maxHeight / measuredHeight);
    if (fitScale < 1) {
      fontSize = Math.max(POSTER_UNBROKEN_MIN_FONT_SIZE, Math.floor(fontSize * fitScale));
      context.font = `${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      measuredWidth = Math.max(1, ...lines.map((line) => context.measureText(line).width));
      measuredHeight = Math.max(Math.round(fontSize * 1.28), lines.length * Math.round(fontSize * 1.28));
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
        height: Math.max(lineHeight, Math.max(1, ...columns.map((column) => [...column].length)) * lineHeight),
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
    let measuredHeight = Math.max(lineHeight, sourceLines.length * lineHeight);
    const fitScale = Math.min(1, maxWidth / measuredWidth, maxHeight / measuredHeight);
    if (fitScale < 1) {
      fontSize = Math.max(POSTER_UNBROKEN_MIN_FONT_SIZE, Math.floor(fontSize * fitScale));
      context.font = `${fontSize}px QianTuBiFeng, serif`;
      lineHeight = Math.round(fontSize * lineHeightRatio);
      measuredWidth = Math.max(1, ...sourceLines.map((line) => context.measureText(line).width));
      measuredHeight = Math.max(lineHeight, sourceLines.length * lineHeight);
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

  if (formattedLayout.kind.includes('vertical')) {
    const columnCount = Math.max(1, textLines.length);
    const maxChars = Math.max(1, ...textLines.map((line) => [...line.replace(/\s+/g, '')].length));
    nextLayout.width = Math.max(metrics.fontSize, metrics.fontSize + Math.max(0, columnCount - 1) * metrics.lineHeight);
    nextLayout.height = Math.max(metrics.lineHeight, maxChars * metrics.lineHeight);
  } else {
    const context = createMeasureContext();
    if (context) {
      context.font = isEnglishPoem(poem.content)
        ? `${metrics.fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        : `${metrics.fontSize}px QianTuBiFeng, serif`;
      const measuredWidth = Math.max(
        1,
        ...textLines.map((line) => context.measureText(line).width)
      );
      nextLayout.width = measuredWidth;
    }
    nextLayout.height = Math.max(metrics.lineHeight, textLines.length * metrics.lineHeight);
  }

  nextLayout.width = Math.min(POSTER_WIDTH, Math.max(80, Math.ceil(nextLayout.width)));
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

    if (lines && lines.length * lineHeight <= maxHeight) {
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
  const safeMinSize = Math.min(minSize, POSTER_UNBROKEN_MIN_FONT_SIZE);

  for (let fontSize = startSize; fontSize >= safeMinSize; fontSize -= 2) {
    const lineHeight = Math.round(fontSize * 1.22);
    const columnGap = Math.round(fontSize * 0.86);
    const totalWidth = fontSize + Math.max(0, columns.length - 1) * columnGap;
    const fitsHeight = columns.every((column) => [...column].length * lineHeight <= maxHeight);

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
  context.font = `${fitted.fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  fitted.lines.forEach((line, index) => {
    context.fillText(line, x, layout.y + index * fitted.lineHeight);
  });

  context.shadowBlur = 0;
  context.fillStyle = style.accent;
  const metaFontSize = Math.round(26 * getMetaScaleFromFontSize(fitted.fontSize));
  const metaLineHeight = Math.round(metaFontSize * 1.32);
  context.font = `${metaFontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  context.textAlign = 'right';
  const metaText = `《${poem.poem_title}》 — ${poem.author}`;
  const metaLines = wrapEnglishText(context, metaText, layout.width);
  const metaY = clamp(
    layout.y + layout.height + metaLineHeight * 0.95,
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
    maxRow: Math.min(maxRow, 4),
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
    drawVerticalColumns(context, [`《${poem.poem_title}》`], metaStartX, layout.y, metaLineHeight, metaLineHeight, 1);
    drawVerticalColumns(context, [poem.author], metaStartX + metaLineHeight, layout.y, metaLineHeight, metaLineHeight, 1);
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
    drawVerticalColumns(context, [`《${poem.poem_title}》`], metaStartX, layout.y, metaLineHeight, metaLineHeight, -1);
    drawVerticalColumns(context, [poem.author], metaStartX - metaLineHeight, layout.y, metaLineHeight, metaLineHeight, -1);
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
      maxTextBottom + metaLineHeight * 0.95,
      metaLineHeight,
      POSTER_HEIGHT - 28
    );
    context.textAlign = 'right';
    context.fillText(`《${poem.poem_title}》 · ${poem.author}`, layout.x + layout.width, metaY, layout.width);
  }

  context.restore();
}

async function tryGenerateRemoteShareImage(poem: FavoritePoem): Promise<string | null> {
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

    const result = await response.json() as { image?: string };
    return result.image || null;
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

async function composeShareImage(
  poem: FavoritePoem,
  backgroundImage: string,
  layout: PosterTextLayout
): Promise<string> {
  const background = await loadImage(backgroundImage);
  const siteQRCode = await loadImage(WEBSITE_QR_CODE_PATH);
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
  drawPosterFooter(context, siteQRCode);

  return canvas.toDataURL('image/jpeg', 0.92);
}

export async function regenerateShareImageWithLayout(
  poem: FavoritePoem,
  backgroundImage: string,
  layout: PosterTextLayout
): Promise<ShareImageResult> {
  const formattedLayout = createFormattedPosterLayout(poem, layout);
  const image = await composeShareImage(poem, backgroundImage, formattedLayout);
  return { image, backgroundImage, layout: formattedLayout };
}

export async function generateShareImage(poem: FavoritePoem): Promise<ShareImageResult> {
  const style = POSTER_STYLES[Math.floor(Math.random() * POSTER_STYLES.length)];
  const remoteImage = hasAiGenerationQuota() ? await tryGenerateRemoteShareImage(poem) : null;
  const aiBackground = remoteImage ? await loadImage(remoteImage) : null;
  const [backgroundCanvas, backgroundContext] = createPosterCanvas();

  if (aiBackground) {
    // Only successful AI backgrounds consume the daily AI image quota.
    // The local canvas fallback poster is free and must not affect the counter.
    assertAndConsumeAiGenerationQuota();
    drawImageCover(backgroundContext, aiBackground, POSTER_WIDTH, POSTER_HEIGHT);
  } else {
    drawFallbackBackground(backgroundContext, style);
  }

  const backgroundImage = backgroundCanvas.toDataURL('image/jpeg', 0.92);
  const layout = createNaturalPosterTextLayout(poem, createPosterTextLayout(poem, style, backgroundContext));
  const image = await composeShareImage(poem, backgroundImage, layout);

  return { image, backgroundImage, layout };
}

export function downloadShareImage(image: string, poem: FavoritePoem): void {
  const link = document.createElement('a');
  link.href = image;
  link.download = `blindpoem-${poem.author}-${poem.poem_title}.jpg`;
  link.click();
}

export async function sharePoster(image: string, poem: FavoritePoem): Promise<boolean> {
  if (!navigator.share) return false;

  const text = `${poem.content}\n《${poem.poem_title}》— ${poem.author}\nBlindPoem 盲盒诗\n${WEBSITE_URL}`;

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
