import type { FavoritePoem } from './favoriteService';

const DAILY_LIMIT_KEY = 'blindpoem.shareImageDailyLimit.v1';
const DAILY_GENERATION_LIMIT = 3;
const POSTER_WIDTH = 1080;
const POSTER_HEIGHT = 1440;

type PosterStyle = {
  name: string;
  background: [string, string, string];
  accent: string;
  mist: string;
  text: string;
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
  return Math.max(0, DAILY_GENERATION_LIMIT - readDailyCount().count);
}

function consumeGenerationQuota(): boolean {
  const dailyCount = readDailyCount();
  if (dailyCount.count >= DAILY_GENERATION_LIMIT) return false;

  writeDailyCount(dailyCount.count + 1);
  return true;
}

function assertAndConsumeAiGenerationQuota(): void {
  if (!consumeGenerationQuota()) {
    throw new Error(`今日 AI 分享图生成次数已用完，明天会恢复 ${DAILY_GENERATION_LIMIT} 次。`);
  }
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const segments = text.split(/(?=[，。；！？,.!?])|(?<=[，。；！？,.!?])|\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  segments.forEach((segment) => {
    const nextLine = currentLine ? `${currentLine}${segment}` : segment;
    if (context.measureText(nextLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = segment;
    } else {
      currentLine = nextLine;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 6);
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

function splitPoemChars(text: string): string[] {
  return [...text.replace(/\s+/g, '')].filter(Boolean);
}

function isEnglishPoem(text: string): boolean {
  const latinChars = text.match(/[A-Za-z]/g)?.length || 0;
  const cjkChars = text.match(/[\u3400-\u9fff]/g)?.length || 0;
  return latinChars > 0 && latinChars >= cjkChars * 2;
}

function drawVerticalText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  lineHeight: number,
  maxChars: number
) {
  splitPoemChars(text).slice(0, maxChars).forEach((char, index) => {
    context.fillText(char, x, y + index * lineHeight);
  });
}

function drawEnglishPosterText(
  context: CanvasRenderingContext2D,
  poem: FavoritePoem,
  style: PosterStyle,
  layout: string
) {
  const isRight = layout === 'bottom-right-small';
  const maxWidth = isRight ? 620 : 720;
  const x = isRight ? POSTER_WIDTH - 92 : 92;
  const y = isRight ? 900 : 880;

  context.textAlign = isRight ? 'right' : 'left';
  context.fillStyle = style.text;

  const fitted = fitEnglishLines(context, poem.content, maxWidth, 4, isRight ? 44 : 54, 30);
  context.font = `${fitted.fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  fitted.lines.forEach((line, index) => {
    context.fillText(line, x, y + index * fitted.lineHeight);
  });

  context.shadowBlur = 0;
  context.fillStyle = style.accent;
  context.font = '26px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const metaText = `《${poem.poem_title}》 — ${poem.author}`;
  const metaLines = wrapEnglishText(context, metaText, maxWidth);
  const metaY = y + fitted.lines.length * fitted.lineHeight + 38;
  metaLines.slice(0, 2).forEach((line, index) => {
    context.fillText(line, x, metaY + index * 34);
  });
}

function drawPosterText(
  context: CanvasRenderingContext2D,
  poem: FavoritePoem,
  style: PosterStyle
) {
  const layouts = isEnglishPoem(poem.content)
    ? ['bottom-left', 'bottom-right-small']
    : ['bottom-left', 'upper-left-vertical', 'right-vertical', 'bottom-right-small'];
  const layout = layouts[
    Math.floor(Math.random() * layouts.length)
  ];

  context.save();
  context.fillStyle = style.text;
  context.shadowColor = 'rgba(0, 0, 0, 0.58)';
  context.shadowBlur = 18;

  if (isEnglishPoem(poem.content)) {
    drawEnglishPosterText(context, poem, style, layout);
  } else if (layout === 'upper-left-vertical') {
    context.textAlign = 'center';
    context.font = '48px QianTuBiFeng, serif';
    drawVerticalText(context, poem.content, 150, 190, 62, 18);
    context.shadowBlur = 0;
    context.fillStyle = style.accent;
    context.font = '24px QianTuBiFeng, serif';
    drawVerticalText(context, `《${poem.poem_title}》`, 228, 214, 34, 12);
    drawVerticalText(context, poem.author, 270, 214, 34, 8);
  } else if (layout === 'right-vertical') {
    context.textAlign = 'center';
    context.font = '52px QianTuBiFeng, serif';
    drawVerticalText(context, poem.content, POSTER_WIDTH - 150, 260, 68, 18);
    context.shadowBlur = 0;
    context.fillStyle = style.accent;
    context.font = '24px QianTuBiFeng, serif';
    drawVerticalText(context, `《${poem.poem_title}》`, POSTER_WIDTH - 238, 300, 34, 12);
    drawVerticalText(context, poem.author, POSTER_WIDTH - 280, 300, 34, 8);
  } else {
    const isRight = layout === 'bottom-right-small';
    const x = isRight ? POSTER_WIDTH - 92 : 92;
    const y = isRight ? 1030 : 960;
    const maxWidth = isRight ? 560 : 690;

    context.textAlign = isRight ? 'right' : 'left';
    context.font = `${isRight ? 42 : 56}px QianTuBiFeng, serif`;
    const lines = wrapText(context, poem.content, maxWidth);
    const lineHeight = isRight ? 66 : 82;
    lines.forEach((line, index) => {
      context.fillText(line, x, y + index * lineHeight);
    });

    context.shadowBlur = 0;
    context.fillStyle = style.accent;
    context.font = '26px QianTuBiFeng, serif';
    const metaY = y + lines.length * lineHeight + 34;
    context.fillText(`《${poem.poem_title}》 · ${poem.author}`, x, metaY);
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

export async function generateShareImage(poem: FavoritePoem): Promise<string> {
  const remoteImage = await tryGenerateRemoteShareImage(poem);
  const aiBackground = remoteImage ? await loadImage(remoteImage) : null;
  if (aiBackground) {
    assertAndConsumeAiGenerationQuota();
  }

  const canvas = document.createElement('canvas');
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器无法生成分享图。');

  const style = POSTER_STYLES[Math.floor(Math.random() * POSTER_STYLES.length)];
  if (aiBackground) {
    drawImageCover(context, aiBackground, POSTER_WIDTH, POSTER_HEIGHT);
  } else {
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

  context.fillStyle = aiBackground ? 'rgba(0, 0, 0, 0.16)' : 'rgba(0, 0, 0, 0.22)';
  context.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

  drawPosterText(context, poem, style);

  context.fillStyle = 'rgba(255, 244, 210, 0.62)';
  context.font = '24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  context.textAlign = 'right';
  context.fillText('BlindPoem 盲盒诗', POSTER_WIDTH - 72, POSTER_HEIGHT - 68);

  return canvas.toDataURL('image/jpeg', 0.92);
}

export function downloadShareImage(image: string, poem: FavoritePoem): void {
  const link = document.createElement('a');
  link.href = image;
  link.download = `blindpoem-${poem.author}-${poem.poem_title}.jpg`;
  link.click();
}

export async function sharePoster(image: string, poem: FavoritePoem): Promise<boolean> {
  if (!navigator.share) return false;

  const text = `${poem.content}\n《${poem.poem_title}》— ${poem.author}\nBlindPoem 盲盒诗`;

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
