import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { generatePoem } from './lib/geminiClient';
import { savePoemToDatabase, getRandomPoemFromDatabase } from './lib/poemService';
import './App.css';

// 🎲 Fisher-Yates 洗牌算法 - 用于随机打乱数组
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// 100 个精选情绪 Emoji 配置池（完整池）
const EMOJI_MOODS = [
  // 正面情绪（35个）
  { emoji: '😀', mood: '欢喜', keyword: 'grinning' },
  { emoji: '😃', mood: '灿烂', keyword: 'bright' },
  { emoji: '😄', mood: '开心', keyword: 'joyful' },
  { emoji: '😁', mood: '欣喜', keyword: 'delighted' },
  { emoji: '😆', mood: '大笑', keyword: 'laughing' },
  { emoji: '😅', mood: '尬笑', keyword: 'sweat-smile' },
  { emoji: '🤣', mood: '爆笑', keyword: 'rofl' },
  { emoji: '😂', mood: '喜极而泣', keyword: 'joy-tears' },
  { emoji: '🙂', mood: '微笑', keyword: 'smile' },
  { emoji: '🙃', mood: '倒笑', keyword: 'upside-down' },
  { emoji: '😉', mood: '眨眼', keyword: 'wink' },
  { emoji: '😊', mood: '快乐', keyword: 'happy' },
  { emoji: '😇', mood: '纯真', keyword: 'innocent' },
  { emoji: '🥰', mood: '爱意', keyword: 'loving' },
  { emoji: '😍', mood: '倾心', keyword: 'heart-eyes' },
  { emoji: '🤩', mood: '惊艳', keyword: 'star-struck' },
  { emoji: '😘', mood: '飞吻', keyword: 'kissing' },
  { emoji: '😗', mood: '亲吻', keyword: 'kiss' },
  { emoji: '😚', mood: '闭眼吻', keyword: 'kissing-closed' },
  { emoji: '😙', mood: '含笑吻', keyword: 'kissing-smile' },
  { emoji: '🥲', mood: '感动', keyword: 'touched' },
  { emoji: '😋', mood: '美味', keyword: 'yum' },
  { emoji: '😛', mood: '吐舌', keyword: 'tongue' },
  { emoji: '😜', mood: '调皮', keyword: 'playful' },
  { emoji: '🤪', mood: '疯狂', keyword: 'zany' },
  { emoji: '😝', mood: '淘气', keyword: 'squint-tongue' },
  { emoji: '🤑', mood: '发财', keyword: 'money' },
  { emoji: '🤗', mood: '温暖', keyword: 'hugging' },
  { emoji: '😏', mood: '得意', keyword: 'smirk' },
  { emoji: '☺️', mood: '温馨', keyword: 'relaxed' },
  { emoji: '😌', mood: '满足', keyword: 'content' },
  { emoji: '🥳', mood: '庆祝', keyword: 'party' },
  { emoji: '😎', mood: '自信', keyword: 'cool' },
  { emoji: '🤓', mood: '书呆', keyword: 'nerd' },
  { emoji: '🧐', mood: '审视', keyword: 'monocle' },
  
  // 平静/思考情绪（20个）
  { emoji: '🤔', mood: '思考', keyword: 'thinking' },
  { emoji: '😐', mood: '冷静', keyword: 'neutral-face' },
  { emoji: '😑', mood: '无感', keyword: 'expressionless' },
  { emoji: '😶', mood: '平静', keyword: 'no-mouth' },
  { emoji: '🫤', mood: '犹豫', keyword: 'diagonal-mouth' },
  { emoji: '🤐', mood: '沉默', keyword: 'zipper' },
  { emoji: '🤨', mood: '疑惑', keyword: 'raised-eyebrow' },
  { emoji: '😪', mood: '疲惫', keyword: 'sleepy' },
  { emoji: '😴', mood: '困倦', keyword: 'sleeping' },
  { emoji: '🥱', mood: '倦怠', keyword: 'yawn' },
  { emoji: '😮‍💨', mood: '舒气', keyword: 'exhale' },
  { emoji: '🫥', mood: '虚无', keyword: 'dotted-line' },
  { emoji: '😶‍🌫️', mood: '迷茫', keyword: 'face-clouds' },
  { emoji: '😬', mood: '咬牙', keyword: 'grimacing' },
  { emoji: '🤥', mood: '说谎', keyword: 'lying' },
  { emoji: '🙄', mood: '翻白眼', keyword: 'eye-roll' },
  { emoji: '😒', mood: '不屑', keyword: 'unamused' },
  { emoji: '🫡', mood: '敬礼', keyword: 'salute' },
  { emoji: '🤭', mood: '捂嘴', keyword: 'hand-over-mouth' },
  { emoji: '🤫', mood: '嘘', keyword: 'shush' },
  
  // 负面情绪（35个）
  { emoji: '😕', mood: '困惑', keyword: 'confused' },
  { emoji: '😟', mood: '担忧', keyword: 'worried' },
  { emoji: '🙁', mood: '皱眉', keyword: 'frown' },
  { emoji: '☹️', mood: '沮丧', keyword: 'frowning' },
  { emoji: '😮', mood: '惊讶', keyword: 'open-mouth' },
  { emoji: '😯', mood: '惊呆', keyword: 'hushed' },
  { emoji: '😲', mood: '吃惊', keyword: 'astonished' },
  { emoji: '😳', mood: '尴尬', keyword: 'flushed' },
  { emoji: '🥺', mood: '委屈', keyword: 'pleading' },
  { emoji: '😦', mood: '蹙眉', keyword: 'frowning-mouth' },
  { emoji: '😧', mood: '痛苦', keyword: 'anguished' },
  { emoji: '😨', mood: '恐惧', keyword: 'fearful' },
  { emoji: '😰', mood: '焦虑', keyword: 'anxious-sweat' },
  { emoji: '😥', mood: '失意', keyword: 'sad-sweat' },
  { emoji: '😢', mood: '悲伤', keyword: 'crying' },
  { emoji: '😭', mood: '大哭', keyword: 'sobbing' },
  { emoji: '😖', mood: '苦恼', keyword: 'confounded' },
  { emoji: '😣', mood: '煎熬', keyword: 'persevering' },
  { emoji: '😞', mood: '失落', keyword: 'disappointed' },
  { emoji: '😓', mood: '挫败', keyword: 'downcast-sweat' },
  { emoji: '😩', mood: '痛苦', keyword: 'weary' },
  { emoji: '😫', mood: '厌烦', keyword: 'tired-face' },
  { emoji: '🥹', mood: '哀伤', keyword: 'holding-tears' },
  { emoji: '😤', mood: '不满', keyword: 'triumph' },
  { emoji: '😡', mood: '愤怒', keyword: 'pouting' },
  { emoji: '😠', mood: '生气', keyword: 'angry' },
  { emoji: '🤬', mood: '暴怒', keyword: 'cursing' },
  { emoji: '😾', mood: '恼怒', keyword: 'pouting-cat' },
  { emoji: '😿', mood: '心碎', keyword: 'crying-cat' },
  { emoji: '🙀', mood: '惊恐', keyword: 'weary-cat' },
  { emoji: '😔', mood: '忧郁', keyword: 'pensive' },
  { emoji: '🥹', mood: '含泪', keyword: 'tear-hold' },
  { emoji: '💔', mood: '心碎', keyword: 'broken-heart' },
  { emoji: '😒', mood: '厌恶', keyword: 'bored' },
  { emoji: '🫨', mood: '颤抖', keyword: 'shaking' },
  
  // 强烈/特殊情绪（10个）
  { emoji: '😱', mood: '震惊', keyword: 'screaming' },
  { emoji: '🤯', mood: '崩溃', keyword: 'exploding-head' },
  { emoji: '😵', mood: '眩晕', keyword: 'dizzy' },
  { emoji: '😵‍💫', mood: '晕眩', keyword: 'face-spiral' },
  { emoji: '🤢', mood: '恶心', keyword: 'nauseated' },
  { emoji: '🤮', mood: '呕吐', keyword: 'vomiting' },
  { emoji: '🥵', mood: '燥热', keyword: 'hot' },
  { emoji: '🥶', mood: '寒冷', keyword: 'cold' },
  { emoji: '😈', mood: '邪恶', keyword: 'devil' },
  { emoji: '👿', mood: '恶魔', keyword: 'imp' },
];

const WELCOME_TIMING = {
  charsPerSecond: 2.5,
  nextLineStartProgress: 0.6,
  holdAfterFadeIn: 1,
  curtainPassDuration: 2,
  skipToBottomDuration: 0.75,
  finalJoinDuration: 0.75,
  bottomLineSettleDuration: 1.3,
  skipBottomLineSettleDuration: 0.65,
  skipPromptDelay: 0.35,
  emojiToPromptDelay: 3,
  bottomLineScale: 0.8,
  textBoundsScale: 0.92,
};

const WELCOME_LAYER_Z_INDEX = {
  intro: 100,
  complete: 5,
  prompt: 20,
};

const CURTAIN_BEZIER = {
  x1: 0.35,
  y1: 0,
  x2: 0.35,
  y2: 1,
};

function App() {
  // 📱 移动设备检测：桌面浏览器即使窗口较窄，也保留完整动效。
  const getIsTouchDevice = () =>
    window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const [viewportSize, setViewportSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [isTouchDevice, setIsTouchDevice] = useState(getIsTouchDevice());
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768 && getIsTouchDevice());
  const [isSmallMobile, setIsSmallMobile] = useState(window.innerWidth <= 480 && getIsTouchDevice());
  const [isNarrowScreen, setIsNarrowScreen] = useState(window.innerWidth <= 760);

  useEffect(() => {
    const handleResize = () => {
      const isTouchDevice = getIsTouchDevice();
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      setIsTouchDevice(isTouchDevice);
      setIsMobile(window.innerWidth <= 768 && isTouchDevice);
      setIsSmallMobile(window.innerWidth <= 480 && isTouchDevice);
      setIsNarrowScreen(window.innerWidth <= 760);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 动态字体大小 - 移动端优化（增大显示）
  const welcomeFontSize = isSmallMobile ? '1.4rem' : isMobile ? '2rem' : '2.5rem';
  const promptFontSize = isSmallMobile ? '1.75rem' : isMobile ? '2.2rem' : '2.5rem';

  // 🎲 每次刷新从 100 个中随机选择 Emoji（保持情绪平衡，移动端性能优化）
  const selectedEmojis = useMemo(() => {
    // 分类 Emoji（按在数组中的位置）
    const positive = EMOJI_MOODS.slice(0, 35);   // 正面情绪 35个
    const neutral = EMOJI_MOODS.slice(35, 55);   // 平静情绪 20个
    const negative = EMOJI_MOODS.slice(55, 90);  // 负面情绪 35个
    const intense = EMOJI_MOODS.slice(90, 100);  // 强烈情绪 10个
    
    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));
    const screenArea = viewportSize.width * viewportSize.height;
    const targetCount = isTouchDevice
      ? isSmallMobile
        ? clamp(Math.round(screenArea / 42000), 8, 12)
        : isMobile
          ? clamp(Math.round(screenArea / 46000), 10, 16)
          : clamp(Math.round(screenArea / 52000), 16, 28)
      : 27;
    
    // 桌面端保留现有 27 个的视觉密度；非桌面端按屏幕面积保持中等密度。
    const counts = isTouchDevice
      ? (() => {
          const positiveCount = Math.round(targetCount * 0.35);
          const neutralCount = Math.round(targetCount * 0.2);
          const negativeCount = Math.round(targetCount * 0.35);
          return {
            positive: positiveCount,
            neutral: neutralCount,
            negative: negativeCount,
            intense: targetCount - positiveCount - neutralCount - negativeCount,
          };
        })()
      : { positive: 9, neutral: 5, negative: 9, intense: 4 }; // PC端：27个
    
    // 从每类中随机选择，保持情绪平衡
    const selected = [
      ...shuffleArray(positive).slice(0, counts.positive),
      ...shuffleArray(neutral).slice(0, counts.neutral),
      ...shuffleArray(negative).slice(0, counts.negative),
      ...shuffleArray(intense).slice(0, counts.intense),
    ];
    
    // 再次打乱顺序，避免情绪分组显示
    const final = shuffleArray(selected);
    
    const totalCount = final.length;
    const deviceType = isTouchDevice
      ? isSmallMobile
        ? '超小屏触摸设备'
        : isMobile
          ? '移动端触摸设备'
          : '平板/触摸设备'
      : 'PC端';
    console.log(`🎲 本次从100个中随机选择的${totalCount}个 Emoji (${deviceType}):`, 
      final.map(e => `${e.emoji} ${e.mood}`).join(', ')
    );
    
    return final;
  }, [isSmallMobile, isMobile, isTouchDevice, viewportSize]); // 依赖设备类型和屏幕面积 - 设备类型变化时重新计算

  // 入场动画状态
  const [welcomePhase, setWelcomePhase] = useState<'lines' | 'sliding' | 'complete'>('lines');
  const [skipMode, setSkipMode] = useState<'none' | 'first-only' | 'partial' | 'with-last'>('none');
  const [showWelcome] = useState(true);  // 入场诗一直保持显示
  const [emojisVisible, setEmojisVisible] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);  // 控制提示词显示（初始为false）
  const [showPromptAnimation, setShowPromptAnimation] = useState(false);  // 控制提示词淡入动画
  const [isSkipped, setIsSkipped] = useState(false);  // 标记是否跳过了入场动画
  const [isWelcomeFontReady, setIsWelcomeFontReady] = useState(false);
  const [bottomLineOffsets, setBottomLineOffsets] = useState<Record<number, number>>({});
  const [firstLineMeetOffset, setFirstLineMeetOffset] = useState(0);
  const [curtainWipeDelays, setCurtainWipeDelays] = useState<Record<number, number>>({});
  const [curtainWipeDurations, setCurtainWipeDurations] = useState<Record<number, number>>({});
  const [visibleWelcomeLines, setVisibleWelcomeLines] = useState<boolean[]>([]);
  
  // 跳过入场动画定时器引用
  const skipTimersRef = useRef<number[]>([]);
  const welcomeAnimationStartRef = useRef<number>(Date.now());
  const welcomeLineRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const isRequestInFlightRef = useRef(false);
  const [poemData, setPoemData] = useState<{
    content: string;
    poem_title: string;
    author: string;
  } | null>(null);

  // 赞赏功能状态
  const [showLoveButton, setShowLoveButton] = useState(false);  // 控制爱心按钮显示
  const [isLoved, setIsLoved] = useState(false);                // 控制爱心是否被点击
  const [showQRCode, setShowQRCode] = useState(false);          // 控制二维码显示
  
  // 淡出动画状态
  const [isPoemFadingOut, setIsPoemFadingOut] = useState(false); // 诗句框淡出状态
  const [isQRFadingOut, setIsQRFadingOut] = useState(false);     // 二维码淡出状态

  type StarParticle = {
    id: string;
    layer: 'front' | 'mid' | 'back';
    size: number;
    glowRadius: number;
    baseOpacity: number;
    maxOpacity: number;
    colorR: number;
    colorG: number;
    colorB: number;
    x: number;
    y: number;
  };

  // 流星效果状态管理：只给 Canvas 渲染循环读取，不进入 React 渲染路径。
  const meteorParticlesRef = useRef(new Map<string, { 
    startTime: number; 
    startX: number; 
    startY: number;
    direction: number; // 流星方向：0-右下, 1-左下, 2-右上, 3-左上, 4-正下, 5-正右
  }>());
  
  // 粒子位置覆盖（用于流星后在新位置重生）
  const particlePositionOverridesRef = useRef(new Map<string, { x: number; y: number }>());

  // 入场诗句
  const welcomeLines = [
    '在AI时代',
    '做一件AI做不了的小事',
    '读一句诗  读一首诗',
    '让意识流淌过',
    '让感受激发出',
    '穿越  翱翔  跋涉  漂浮……',
    '沉浸在生活外',
    '生活在诗句里',
  ];

  // 每句诗的节奏长度：JS长度和去空格长度的平均值。
  const charCounts = welcomeLines.map((line) => {
    const jsLength = [...line].length;
    const noSpaceLength = [...line.replace(/\s/g, '')].length;
    return (jsLength + noSpaceLength) / 2;
  });
  const curtainPassDuration = WELCOME_TIMING.curtainPassDuration;
  const skipToBottomDuration = WELCOME_TIMING.skipToBottomDuration;
  const finalJoinDuration = WELCOME_TIMING.finalJoinDuration;
  const welcomeMoveDuration = curtainPassDuration + finalJoinDuration;
  const bottomLineSettleDuration = WELCOME_TIMING.bottomLineSettleDuration;
  const skipBottomLineSettleDuration = WELCOME_TIMING.skipBottomLineSettleDuration;
  const curtainBezier = CURTAIN_BEZIER;

  // 计算每行的淡入时长（每秒2.5个字符）
  const getLineFadeInDuration = (index: number): number => {
    return charCounts[index] / WELCOME_TIMING.charsPerSecond;
  };

  // 根据上一句进度计算每句的开始时间：下一句在上一句淡入完成 60% 时开始。
  const getLineStartTime = (index: number): number => {
    let startTime = 0;
    for (let i = 0; i < index; i++) {
      startTime += getLineFadeInDuration(i) * WELCOME_TIMING.nextLineStartProgress;
    }
    return startTime;
  };

  const getAllLinesFadeInEndTime = (): number => {
    return Math.max(
      ...charCounts.map((_, index) => getLineStartTime(index) + getLineFadeInDuration(index))
    );
  };

  const getBezierTimeForProgress = (
    progress: number,
    x1 = 0.4,
    y1 = 0,
    x2 = 0.2,
    y2 = 1
  ): number => {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;
    let t = clampedProgress;

    for (let i = 0; i < 8; i++) {
      const yEstimate = ((ay * t + by) * t + cy) * t;
      const dy = (3 * ay * t + 2 * by) * t + cy;
      if (Math.abs(yEstimate - clampedProgress) < 0.00001 || Math.abs(dy) < 0.00001) break;
      t = Math.max(0, Math.min(1, t - (yEstimate - clampedProgress) / dy));
    }

    return ((ax * t + bx) * t + cx) * t;
  };

  const measureBottomLineOffsets = (
    options: {
      visibleLines?: boolean[];
      includeLastInMeet?: boolean;
      passDuration?: number;
    } = {}
  ) => {
    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const nextOffsets: Record<number, number> = {};
    const nextCurtainDelays: Record<number, number> = {};
    const nextCurtainDurations: Record<number, number> = {};
    const getTextBounds = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const fontSize = Number.parseFloat(getComputedStyle(element).fontSize) || rect.height;
      const textHeight = Math.min(rect.height, fontSize * WELCOME_TIMING.textBoundsScale);
      const centerY = rect.top + rect.height / 2;

      return {
        ...rect,
        textTop: centerY - textHeight / 2,
        textBottom: centerY + textHeight / 2,
      };
    };

    [0, welcomeLines.length - 1].forEach((index) => {
      const element = welcomeLineRefs.current[index];
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const bottomRem = index === 0 ? 5 : 3;
      const targetTop = window.innerHeight - bottomRem * rootFontSize - rect.height;
      nextOffsets[index] = targetTop - rect.top;
    });

    const firstLine = welcomeLineRefs.current[0];
    const lastLine = welcomeLineRefs.current[welcomeLines.length - 1];
    const firstMoveY = nextOffsets[0] || 0;
    let nextFirstMeetOffset = 0;

    const includeLastInMeet = options.includeLastInMeet ?? true;
    const passDuration = options.passDuration ?? curtainPassDuration;

    if (firstLine && lastLine && firstMoveY > 0) {
      const firstBounds = getTextBounds(firstLine);
      const lastBounds = getTextBounds(lastLine);
      nextFirstMeetOffset = includeLastInMeet
        ? Math.min(firstMoveY, Math.max(0, lastBounds.textTop - firstBounds.textBottom))
        : firstMoveY;

      welcomeLines.forEach((_, index) => {
        if (index === 0 || index === welcomeLines.length - 1) return;
        if (options.visibleLines && !options.visibleLines[index]) return;

        const element = welcomeLineRefs.current[index];
        if (!element) return;

        const bounds = getTextBounds(element);
        const wipeStartProgress = (bounds.textTop - firstBounds.textBottom) / nextFirstMeetOffset;
        const wipeEndProgress = (bounds.textBottom - firstBounds.textBottom) / nextFirstMeetOffset;
        const wipeStart = getBezierTimeForProgress(
          wipeStartProgress,
          curtainBezier.x1,
          curtainBezier.y1,
          curtainBezier.x2,
          curtainBezier.y2
        ) * passDuration;
        const wipeEnd = getBezierTimeForProgress(
          wipeEndProgress,
          curtainBezier.x1,
          curtainBezier.y1,
          curtainBezier.x2,
          curtainBezier.y2
        ) * passDuration;

        nextCurtainDelays[index] = wipeStart;
        nextCurtainDurations[index] = Math.max(0.08, wipeEnd - wipeStart);
      });
    }

    setBottomLineOffsets(nextOffsets);
    setFirstLineMeetOffset(nextFirstMeetOffset);
    setCurtainWipeDelays(nextCurtainDelays);
    setCurtainWipeDurations(nextCurtainDurations);
  };

  // 赞赏功能计时器：根据诗句长度动态调整爱心按钮出现时间
  useEffect(() => {
    if (poemData) {
      // 去除标点符号
      const textWithoutPunctuation = poemData.content.replace(/[，。、；！？\s]/g, '');
      
      // 区分中文和非中文字符
      const chineseChars = textWithoutPunctuation.match(/[\u4e00-\u9fa5]/g) || [];
      const nonChineseChars = textWithoutPunctuation.replace(/[\u4e00-\u9fa5]/g, '');
      
      const chineseLength = chineseChars.length;
      const nonChineseLength = nonChineseChars.length;
      
      // 中文：每秒6个字符，非中文：每秒12个字符
      const chineseDuration = (chineseLength / 6) * 1000;
      const nonChineseDuration = (nonChineseLength / 12) * 1000;
      const calculatedDuration = chineseDuration + nonChineseDuration;
      
      // 下限1.5秒，上限13.5秒
      const displayDuration = Math.max(1500, Math.min(calculatedDuration, 13500));
      
      console.log(`✅ 诗句字符：中文${chineseLength}个，非中文${nonChineseLength}个，爱心按钮将在 ${(displayDuration / 1000).toFixed(1)} 秒后出现`);
      
      const timer = setTimeout(() => {
        setShowLoveButton(true);
      }, displayDuration);

      return () => clearTimeout(timer);
    } else {
      // 诗句关闭时，重置所有赞赏状态和动画状态
      setShowLoveButton(false);
      setIsLoved(false);
      setShowQRCode(false);
      setIsPoemFadingOut(false);
      setIsQRFadingOut(false);
    }
  }, [poemData]);

  // 二维码自动消失计时器：显示 30 秒后自动隐藏
  useEffect(() => {
    if (showQRCode) {
      const timer = setTimeout(() => {
        setShowQRCode(false);
      }, 30000); // 30 秒

      return () => clearTimeout(timer);
    }
  }, [showQRCode]);

  useEffect(() => {
    let isMounted = true;

    const markReady = () => {
      if (isMounted) {
        setIsWelcomeFontReady(true);
      }
    };

    if ('fonts' in document) {
      document.fonts.load('1em QianTuBiFeng').then(() => {
        return document.fonts.ready;
      }).then(markReady).catch(markReady);
    } else {
      markReady();
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // 入场动画时间控制
  useEffect(() => {
    if (!isWelcomeFontReady) return;
    if (isSkipped) return;

    const timers: number[] = [];
    welcomeAnimationStartRef.current = Date.now();
    const fadeInEndTime = getAllLinesFadeInEndTime();
    const holdAfterFadeIn = WELCOME_TIMING.holdAfterFadeIn;
    const moveStartMs = (fadeInEndTime + holdAfterFadeIn) * 1000;
    const moveDurationMs = welcomeMoveDuration * 1000;
    const completeMs = moveStartMs + moveDurationMs;
    const emojiStartMs = completeMs + bottomLineSettleDuration * 1000;
    const promptStartMs = emojiStartMs + WELCOME_TIMING.emojiToPromptDelay * 1000;

    // 所有诗句完整淡入并停留后，首尾句移动到底部，其他句子原地淡出。
    const timer1 = window.setTimeout(() => {
      measureBottomLineOffsets();
      setWelcomePhase('sliding');
    }, moveStartMs);
    timers.push(timer1);
    
    // 移动完成后，首尾句固定在底部。
    const timer2 = window.setTimeout(() => {
      setWelcomePhase('complete');
    }, completeMs);
    timers.push(timer2);
    
    // 首尾句落位后，Emoji开始淡入。
    const timer3 = window.setTimeout(() => {
      setEmojisVisible(true);
    }, emojiStartMs);
    timers.push(timer3);
    
    // Emoji淡入完成后，提示词开始淡入。
    const timer4 = window.setTimeout(() => {
      setShowPrompt(true);
      setShowPromptAnimation(true);
    }, promptStartMs);
    timers.push(timer4);
    
    // 不再隐藏欢迎屏幕，让入场诗一直保持在背景
    // setTimeout(() => {
    //   setShowWelcome(false);
    // }, 23000);
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [isWelcomeFontReady, isSkipped]);

  // 🌟 三层星空粒子系统 - 静态星空 + 事件驱动眨眼/流星
  const particleSequences = useMemo(() => {
    const particleCount = isSmallMobile ? 
      { front: 10, mid: 8, back: 6 } :
      isMobile ? 
      { front: 14, mid: 10, back: 8 } :
      { front: 40, mid: 40, back: 40 };
    
    // 生成指定层级的粒子
    const generateParticles = (
      count: number, 
      layer: 'front' | 'mid' | 'back',
      baseDelay: number
    ) => {
      // 根据层级设置不同的属性（强化三层纵深感）
      const layerConfig = {
        front: { 
          sizeMin: 1.5, sizeMax: 3.5,       // 前景：缩小50%（原3-7）
          opacityMin: 0.3, opacityMax: 1.0, // 前景：增大透明度变化幅度（增强闪烁）
          colorR: 255, colorG: 255, colorB: 255, // 前景：纯白色（最亮）
        },
        mid: { 
          sizeMin: 1, sizeMax: 2,           // 中景：缩小（原1.5-3.5）
          opacityMin: 0.1, opacityMax: 0.6, // 中景：增大透明度变化幅度（增强闪烁）
          colorR: 220, colorG: 230, colorB: 255, // 中景：淡蓝白（微弱蓝调）
        },
        back: { 
          sizeMin: 0.5, sizeMax: 1.2,       // 背景：缩小（原0.5-2）
          opacityMin: 0.05, opacityMax: 0.35, // 背景：增大透明度变化幅度（增强闪烁）
          colorR: 180, colorG: 200, colorB: 255, // 背景：偏蓝（深空感）
        },
      };
      
      const config = layerConfig[layer];
      
      return Array.from({ length: count }, (_, i): StarParticle => {
        const size = config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin);
        return {
          id: `${layer}-${baseDelay}-${i}`,
          layer,
          size,
          glowRadius: size * (1.15 + Math.random() * 1.85),
          baseOpacity: config.opacityMin + Math.random() * (config.opacityMax - config.opacityMin) * 0.45,
          maxOpacity: config.opacityMax,
          colorR: config.colorR,
          colorG: config.colorG,
          colorB: config.colorB,
          x: Math.random(),
          y: Math.random(),
        };
      });
    };
    
    // 三层粒子：根据屏幕尺寸调整数量
    const frontLayer = generateParticles(particleCount.front, 'front', 0);
    const midLayer = generateParticles(particleCount.mid, 'mid', 1);
    const backLayer = generateParticles(particleCount.back, 'back', 2);
    
    const deviceType = isSmallMobile ? '超小屏' : isMobile ? '移动端' : 'PC端';
    console.log(`✨ 静态星空 (${deviceType}): 前景${particleCount.front}个 + 中景${particleCount.mid}个 + 背景${particleCount.back}个 = 总计${particleCount.front + particleCount.mid + particleCount.back}个`);
    
    return { frontLayer, midLayer, backLayer };
  }, [isSmallMobile, isMobile]); // 屏幕尺寸变化时重新计算

  // 深空背景：一次性绘制，避免大面积 blur 背景持续动画。
  const deepSpaceCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = deepSpaceCanvasRef.current;
    if (!canvas) return;

    const drawDeepSpace = () => {
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, isTouchDevice ? 1.5 : 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const nightGradient = ctx.createLinearGradient(0, 0, 0, height);
      nightGradient.addColorStop(0, '#060819');
      nightGradient.addColorStop(0.28, '#090e26');
      nightGradient.addColorStop(0.58, '#100f2a');
      nightGradient.addColorStop(0.82, '#080e25');
      nightGradient.addColorStop(1, '#050613');
      ctx.fillStyle = nightGradient;
      ctx.fillRect(0, 0, width, height);

      const nebulae = [
        { x: 0.46, y: 0.44, r: 0.64, color: '78, 82, 156', alpha: isTouchDevice ? 0.165 : 0.215 },
        { x: 0.22, y: 0.3, r: 0.5, color: '30, 68, 126', alpha: isTouchDevice ? 0.135 : 0.175 },
        { x: 0.78, y: 0.68, r: 0.54, color: '54, 38, 96', alpha: isTouchDevice ? 0.12 : 0.155 },
        { x: 0.56, y: 0.61, r: 0.36, color: '210, 168, 72', alpha: isTouchDevice ? 0.028 : 0.04 },
        { x: 0.42, y: 0.78, r: 0.44, color: '26, 94, 132', alpha: isTouchDevice ? 0.075 : 0.1 },
      ];

      nebulae.forEach((nebula) => {
        const radius = Math.max(width, height) * nebula.r;
        const gradient = ctx.createRadialGradient(
          width * nebula.x,
          height * nebula.y,
          0,
          width * nebula.x,
          height * nebula.y,
          radius
        );
        gradient.addColorStop(0, `rgba(${nebula.color}, ${nebula.alpha})`);
        gradient.addColorStop(0.48, `rgba(${nebula.color}, ${nebula.alpha * 0.42})`);
        gradient.addColorStop(1, `rgba(${nebula.color}, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      });

      const colorBands = [
        {
          from: { x: width * 0.08, y: height * 0.18 },
          to: { x: width * 0.92, y: height * 0.88 },
          stops: [
            [0, 'rgba(64, 92, 170, 0)'],
            [0.38, `rgba(56, 82, 150, ${isTouchDevice ? 0.044 : 0.062})`],
            [0.7, 'rgba(66, 72, 142, 0.03)'],
            [1, 'rgba(64, 92, 170, 0)'],
          ] as const,
        },
        {
          from: { x: width * 0.82, y: height * 0.04 },
          to: { x: width * 0.16, y: height * 0.96 },
          stops: [
            [0, 'rgba(76, 94, 160, 0)'],
            [0.42, `rgba(66, 82, 142, ${isTouchDevice ? 0.032 : 0.046})`],
            [0.76, 'rgba(26, 80, 120, 0.034)'],
            [1, 'rgba(76, 94, 160, 0)'],
          ] as const,
        },
        {
          from: { x: width * 0.02, y: height * 0.72 },
          to: { x: width * 0.98, y: height * 0.38 },
          stops: [
            [0, 'rgba(36, 112, 150, 0)'],
            [0.34, `rgba(32, 96, 132, ${isTouchDevice ? 0.028 : 0.04})`],
            [0.55, `rgba(102, 82, 156, ${isTouchDevice ? 0.025 : 0.035})`],
            [0.82, 'rgba(36, 72, 132, 0.02)'],
            [1, 'rgba(36, 112, 150, 0)'],
          ] as const,
        },
      ];

      colorBands.forEach((band) => {
        const gradient = ctx.createLinearGradient(band.from.x, band.from.y, band.to.x, band.to.y);
        band.stops.forEach(([stop, color]) => gradient.addColorStop(stop, color));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      });

      const edgeShadows = [
        { x: -0.08, y: 0.14, r: 0.72, alpha: 0.22 },
        { x: 1.06, y: 0.24, r: 0.66, alpha: 0.18 },
        { x: 0.18, y: 1.08, r: 0.74, alpha: 0.2 },
        { x: 0.95, y: 1.0, r: 0.56, alpha: 0.14 },
        { x: 0.48, y: -0.2, r: 0.58, alpha: 0.13 },
      ];

      edgeShadows.forEach((shadow) => {
        const radius = Math.max(width, height) * shadow.r;
        const gradient = ctx.createRadialGradient(
          width * shadow.x,
          height * shadow.y,
          0,
          width * shadow.x,
          height * shadow.y,
          radius
        );
        gradient.addColorStop(0, `rgba(0, 0, 0, ${shadow.alpha})`);
        gradient.addColorStop(0.52, `rgba(0, 0, 0, ${shadow.alpha * 0.34})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      });

      const noiseCount = Math.round((width * height) / (isTouchDevice ? 6500 : 4200));
      for (let i = 0; i < noiseCount; i++) {
        const alpha = 0.015 + Math.random() * 0.035;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
      }
    };

    drawDeepSpace();
    window.addEventListener('resize', drawDeepSpace);

    return () => window.removeEventListener('resize', drawDeepSpace);
  }, [isTouchDevice]);

  // Canvas 粒子系统
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starAnimationRef = useRef<number>(0);
  const meteorAnimationRef = useRef<number>(0);
  const meteorInFlightRef = useRef(false);
  const starRevealTimerRef = useRef<number>(0);
  const revealedStarIdsRef = useRef(new Set<string>());
  const allStarsVisibleRef = useRef(false);
  const twinkleTimerRef = useRef<number>(0);
  const twinkleWaveActiveRef = useRef(false);
  const activeTwinklesRef = useRef(new Map<string, {
    startTime: number;
    delay: number;
    duration: number;
    peakOpacity: number;
  }>());

  const getAllParticles = useCallback((): StarParticle[] => ([
    ...particleSequences.backLayer,
    ...particleSequences.midLayer,
    ...particleSequences.frontLayer,
  ]), [particleSequences]);

  const drawStar = useCallback((
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    particle: StarParticle,
    opacity: number
  ) => {
    const positionOverride = particlePositionOverridesRef.current.get(particle.id);
    const baseX = positionOverride ? positionOverride.x : particle.x;
    const baseY = positionOverride ? positionOverride.y : particle.y;
    const x = baseX * canvas.width;
    const y = baseY * canvas.height;
    const finalOpacity = Math.max(0, Math.min(1, opacity));

    ctx.beginPath();
    ctx.arc(x, y, particle.size / 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${particle.colorR}, ${particle.colorG}, ${particle.colorB}, ${finalOpacity})`;
    ctx.fill();

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, particle.glowRadius);
    gradient.addColorStop(0, `rgba(${particle.colorR}, ${particle.colorG}, ${particle.colorB}, ${finalOpacity * 0.55})`);
    gradient.addColorStop(0.5, `rgba(${particle.colorR}, ${particle.colorG}, ${particle.colorB}, ${finalOpacity * 0.24})`);
    gradient.addColorStop(1, `rgba(${particle.colorR}, ${particle.colorG}, ${particle.colorB}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, particle.glowRadius, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const getStarOpacity = useCallback((particle: StarParticle, now: number) => {
    const twinkle = activeTwinklesRef.current.get(particle.id);
    if (!twinkle) return particle.baseOpacity;

    const elapsed = now - twinkle.startTime - twinkle.delay;
    if (elapsed < 0 || elapsed > twinkle.duration) return particle.baseOpacity;

    const progress = elapsed / twinkle.duration;
    const blink = Math.sin(progress * Math.PI);
    return particle.baseOpacity + (twinkle.peakOpacity - particle.baseOpacity) * blink;
  }, []);

  const drawStarField = useCallback((now: number = Date.now()) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    getAllParticles().forEach((particle) => {
      if (!allStarsVisibleRef.current && !revealedStarIdsRef.current.has(particle.id)) return;
      if (meteorParticlesRef.current.has(particle.id)) return;
      drawStar(ctx, canvas, particle, getStarOpacity(particle, now));
    });
  }, [drawStar, getAllParticles, getStarOpacity]);

  // Canvas 星光层：平时静态，只在眨眼波/流星期间短暂重绘。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 设置 Canvas 尺寸为窗口大小
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawStarField();
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 清理
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (starAnimationRef.current) {
        cancelAnimationFrame(starAnimationRef.current);
      }
      if (meteorAnimationRef.current) {
        cancelAnimationFrame(meteorAnimationRef.current);
      }
    };
  }, [drawStarField]);

  // 开场星星逐步出现：每次随机露出 1-3 颗，emoji 出现时补齐全部星星。
  useEffect(() => {
    const allParticles = getAllParticles();
    if (allParticles.length === 0) return;

    if (emojisVisible) {
      if (starRevealTimerRef.current) {
        clearTimeout(starRevealTimerRef.current);
      }
      allStarsVisibleRef.current = true;
      allParticles.forEach((particle) => revealedStarIdsRef.current.add(particle.id));
      drawStarField();
      return;
    }

    allStarsVisibleRef.current = false;
    revealedStarIdsRef.current.clear();
    drawStarField();

    let isDisposed = false;
    const revealNextStars = () => {
      if (isDisposed || allStarsVisibleRef.current) return;

      const hiddenParticles = allParticles.filter((particle) => (
        !revealedStarIdsRef.current.has(particle.id)
      ));

      if (hiddenParticles.length === 0) return;

      const revealCount = Math.min(hiddenParticles.length, 1 + Math.floor(Math.random() * 3));
      shuffleArray(hiddenParticles).slice(0, revealCount).forEach((particle) => {
        revealedStarIdsRef.current.add(particle.id);
      });

      drawStarField();

      starRevealTimerRef.current = window.setTimeout(
        revealNextStars,
        220 + Math.random() * 620 + Math.random() * 180
      );
    };

    starRevealTimerRef.current = window.setTimeout(
      revealNextStars,
      260 + Math.random() * 540
    );

    return () => {
      isDisposed = true;
      if (starRevealTimerRef.current) {
        clearTimeout(starRevealTimerRef.current);
      }
    };
  }, [drawStarField, emojisVisible, getAllParticles]);

  // 星星眨眼：每波约 15% 星星参与，波次不重叠，平时不占用 rAF。
  useEffect(() => {
    const allParticles = getAllParticles();
    if (allParticles.length === 0) return;

    let isDisposed = false;
    const activeTwinkles = activeTwinklesRef.current;

    const scheduleNextTwinkle = (delay = 1200 + Math.random() * 2600) => {
      if (twinkleTimerRef.current) {
        clearTimeout(twinkleTimerRef.current);
      }

      twinkleTimerRef.current = window.setTimeout(() => {
        if (isDisposed || document.hidden) {
          scheduleNextTwinkle(1400 + Math.random() * 2400);
          return;
        }

        if (meteorInFlightRef.current || twinkleWaveActiveRef.current) {
          scheduleNextTwinkle(900 + Math.random() * 1600);
          return;
        }

        const availableParticles = allParticles.filter((particle) => (
          (allStarsVisibleRef.current || revealedStarIdsRef.current.has(particle.id)) &&
          !meteorParticlesRef.current.has(particle.id) &&
          !activeTwinklesRef.current.has(particle.id)
        ));

        if (availableParticles.length === 0) {
          scheduleNextTwinkle();
          return;
        }

        const selectedParticles = shuffleArray(availableParticles).slice(
          0,
          Math.max(1, Math.round(allParticles.length * 0.15))
        );
        const waveStart = Date.now();
        let waveEnd = waveStart;

        twinkleWaveActiveRef.current = true;
        selectedParticles.forEach((particle) => {
          const delay = Math.random() * 640 + Math.random() * 230;
          const duration = 520 + Math.random() * 680;
          waveEnd = Math.max(waveEnd, waveStart + delay + duration);
          activeTwinklesRef.current.set(particle.id, {
            startTime: waveStart,
            delay,
            duration,
            peakOpacity: particle.maxOpacity,
          });
        });

        let lastFrameTime = 0;
        const frameInterval = 1000 / (isSmallMobile ? 18 : isMobile ? 22 : 26);

        const animateTwinkle = (timestamp: number = Date.now()) => {
          if (isDisposed) return;

          if (timestamp - lastFrameTime < frameInterval) {
            starAnimationRef.current = requestAnimationFrame(animateTwinkle);
            return;
          }
          lastFrameTime = timestamp;

          const now = Date.now();
          drawStarField(now);

          selectedParticles.forEach((particle) => {
            const twinkle = activeTwinklesRef.current.get(particle.id);
            if (twinkle && now > twinkle.startTime + twinkle.delay + twinkle.duration) {
              activeTwinklesRef.current.delete(particle.id);
            }
          });

          if (now <= waveEnd) {
            starAnimationRef.current = requestAnimationFrame(animateTwinkle);
            return;
          }

          selectedParticles.forEach((particle) => {
            activeTwinklesRef.current.delete(particle.id);
          });
          twinkleWaveActiveRef.current = false;
          drawStarField();
          scheduleNextTwinkle();
        };

        starAnimationRef.current = requestAnimationFrame(animateTwinkle);
      }, delay);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && !twinkleWaveActiveRef.current) {
        drawStarField();
        scheduleNextTwinkle(900 + Math.random() * 1600);
      }
    };

    scheduleNextTwinkle();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isDisposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (twinkleTimerRef.current) {
        clearTimeout(twinkleTimerRef.current);
      }
      if (starAnimationRef.current) {
        cancelAnimationFrame(starAnimationRef.current);
      }
      activeTwinkles.clear();
      twinkleWaveActiveRef.current = false;
    };
  }, [drawStarField, getAllParticles, isMobile, isSmallMobile]);

  // 🎯 Emoji 多彩辉光配置
  const generateGlowColors = useMemo(() => {
    const colors = [
      '255, 100, 100',   // 红色
      '255, 150, 100',   // 橙色
      '255, 215, 0',     // 金色
      '150, 255, 100',   // 绿色
      '100, 200, 255',   // 蓝色
      '200, 100, 255',   // 紫色
      '255, 100, 200',   // 粉色
      '100, 255, 255',   // 青色
    ];
    return selectedEmojis.map(() => colors[Math.floor(Math.random() * colors.length)]);
  }, [selectedEmojis]);

  // Emoji辉光周期（15-33秒）
  const emojiGlowDurations = useMemo(() => {
    return selectedEmojis.map(() => 15 + Math.random() * 18);
  }, [selectedEmojis]);

  // Emoji辉光大小范围（每个emoji不同）
  const emojiGlowSizes = useMemo(() => {
    return selectedEmojis.map(() => ({
      minSize: 10 + Math.random() * 8,      // 最小光辉：10-18px
      maxSize: 20 + Math.random() * 12,     // 最大光辉：20-32px
      minOpacity: 0.3 + Math.random() * 0.2, // 最小不透明度：0.3-0.5
      maxOpacity: 0.5 + Math.random() * 0.3, // 最大不透明度：0.5-0.8
    }));
  }, [selectedEmojis]);

  const emojiAnimations = useMemo(() => {
    return selectedEmojis.map((_, index) => {
      if (isTouchDevice) {
        return `emojiSimpleFadeIn ${isSkipped ? '1.2s' : '1.8s'} ease-out forwards`;
      }

      return `emojiSimpleFadeIn ${isSkipped ? '2s' : '3s'} ease-out forwards, emojiGlow-${index} ${emojiGlowDurations[index]}s ease-in-out ${isSkipped ? '2s' : '3s'} infinite`;
    });
  }, [emojiGlowDurations, isSkipped, isTouchDevice, selectedEmojis]);

  // Emoji物理系统
  interface EmojiPhysics {
    x: number;
    y: number;
    vx: number;
    vy: number;
    rotation: number;
    rotationSpeed: number;
    startAt: number;
    wanderPhase: number;
  }

  const emojiPhysicsRef = useRef<EmojiPhysics[]>([]);
  const [physicsEnabled, setPhysicsEnabled] = useState(false);
  const hoveredEmojiIndexRef = useRef<number | null>(null); // 悬停的emoji索引
  const animationFrameRef = useRef<number>(0);
  const emojiButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // 根据屏幕尺寸调整emoji碰撞半径
  const emojiSize = isSmallMobile ? 24 : isMobile ? 32 : isTouchDevice ? 40 : 48;

  // 27个Emoji的初始位置（淡入时使用） - 每次刷新随机打乱位置
  const emojiInitialPositions = useMemo(() => {
    const allPositions = [
      { top: '8%', left: '12%' },
      { top: '15%', left: '85%' },
      { top: '22%', left: '25%' },
      { top: '18%', left: '50%' },
      { top: '28%', left: '70%' },
      { top: '35%', left: '15%' },
      { top: '32%', left: '88%' },
      { top: '42%', left: '40%' },
      { top: '45%', left: '65%' },
      { top: '38%', left: '8%' },
      { top: '52%', left: '30%' },
      { top: '55%', left: '78%' },
      { top: '48%', left: '92%' },
      { top: '62%', left: '18%' },
      { top: '58%', left: '55%' },
      { top: '65%', left: '45%' },
      { top: '68%', left: '82%' },
      { top: '72%', left: '10%' },
      { top: '75%', left: '35%' },
      { top: '78%', left: '68%' },
      { top: '82%', left: '25%' },
      { top: '85%', left: '88%' },
      { top: '88%', left: '50%' },
      { top: '92%', left: '15%' },
      { top: '12%', left: '62%' },
      { top: '25%', left: '92%' },
      { top: '95%', left: '75%' },
    ];
    
    if (!isTouchDevice) {
      return shuffleArray(allPositions);
    }

    const count = selectedEmojis.length;
    const minDistance = emojiSize;
    const positions: { top: string; left: string }[] = [];

    for (let i = 0; i < count; i++) {
      let acceptedPosition: { x: number; y: number } | null = null;
      const relaxedDistance = Math.max(emojiSize * 0.72, minDistance - i * 0.25);

      for (let attempt = 0; attempt < 80; attempt++) {
        const candidate = {
          x: 8 + Math.random() * 84,
          y: 8 + Math.random() * 84,
        };
        const hasEnoughSpace = positions.every((position) => {
          const dx = candidate.x - parseFloat(position.left);
          const dy = candidate.y - parseFloat(position.top);
          const distanceInPixels = Math.hypot(
            (dx / 100) * viewportSize.width,
            (dy / 100) * viewportSize.height
          );
          return distanceInPixels >= relaxedDistance;
        });

        if (hasEnoughSpace) {
          acceptedPosition = candidate;
          break;
        }
      }

      const fallbackPosition = {
        x: 8 + Math.random() * 84,
        y: 8 + Math.random() * 84,
      };
      const nextPosition = acceptedPosition || fallbackPosition;
      positions.push({
        top: `${nextPosition.y}%`,
        left: `${nextPosition.x}%`,
      });
    }

    return positions;
  }, [emojiSize, isTouchDevice, selectedEmojis.length, viewportSize]);

  const createEmojiPhysics = useCallback((): EmojiPhysics[] => {
    const now = Date.now();
    return emojiInitialPositions.slice(0, selectedEmojis.length).map((pos, index) => {
      const x = (parseFloat(pos.left) / 100) * window.innerWidth;
      const y = (parseFloat(pos.top) / 100) * window.innerHeight;
      const angle = Math.random() * Math.PI * 2;
      const speed = isTouchDevice ? 0.16 + Math.random() * 0.12 : 0.2 + Math.random() * 0.3;
      const batchDelay = isTouchDevice ? Math.floor(index / 4) * 420 : Math.floor(index / 5) * 650;
      const randomDelay = isTouchDevice ? Math.random() * 550 : Math.random() * 850;
      
      return {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * (isTouchDevice ? 0.12 : 0.3),
        startAt: now + batchDelay + randomDelay,
        wanderPhase: Math.random() * Math.PI * 2,
      };
    });
  }, [emojiInitialPositions, isTouchDevice, selectedEmojis.length]);

  // 🎯 跳过入场动画功能
  const skipWelcomeAnimation = useCallback(() => {
    // 只在入场诗淡入或淡出阶段可以跳过
    if (welcomePhase === 'lines' || welcomePhase === 'sliding') {
      console.log('⏭️ 用户点击跳过入场动画');
      
      // 清除所有入场动画定时器
      skipTimersRef.current.forEach(timer => clearTimeout(timer));
      skipTimersRef.current = [];
      
      // 标记已跳过
      setIsSkipped(true);

      const welcomeElapsedSeconds = (Date.now() - welcomeAnimationStartRef.current) / 1000;
      const lineVisibility = welcomeLines.map((_, index) => (
        index === 0 || welcomeElapsedSeconds >= getLineStartTime(index)
      ));
      const hasVisibleMiddleLine = lineVisibility.slice(1, -1).some(Boolean);
      const hasVisibleLastLine = Boolean(lineVisibility[welcomeLines.length - 1]);
      const nextSkipMode = hasVisibleLastLine
        ? 'with-last'
        : hasVisibleMiddleLine
          ? 'partial'
          : 'first-only';

      setSkipMode(nextSkipMode);
      setVisibleWelcomeLines(lineVisibility);
      measureBottomLineOffsets({
        visibleLines: lineVisibility,
        includeLastInMeet: hasVisibleLastLine,
        passDuration: hasVisibleLastLine ? curtainPassDuration : skipToBottomDuration,
      });
      setWelcomePhase('sliding');
      
      const skipMoveDuration = hasVisibleLastLine ? welcomeMoveDuration : skipToBottomDuration;
      const skipSettleDuration = hasVisibleLastLine ? bottomLineSettleDuration : skipBottomLineSettleDuration;

      const skipCompleteTimer = window.setTimeout(() => {
        setWelcomePhase('complete');
      }, skipMoveDuration * 1000);
      skipTimersRef.current.push(skipCompleteTimer);

      // 首尾句收束完成后触发Emoji淡入
      const emojiTimer = window.setTimeout(() => {
        setEmojisVisible(true);
        console.log('✅ Emoji开始淡入（2秒）');
      }, (skipMoveDuration + skipSettleDuration) * 1000);
      skipTimersRef.current.push(emojiTimer);

      const skipPromptTimer = window.setTimeout(() => {
        setShowPrompt(true);
        setShowPromptAnimation(true);
      }, (skipMoveDuration + skipSettleDuration + WELCOME_TIMING.skipPromptDelay) * 1000);
      skipTimersRef.current.push(skipPromptTimer);
      
    }
  }, [
    welcomePhase,
    welcomeLines,
    welcomeMoveDuration,
    curtainPassDuration,
    bottomLineSettleDuration,
    skipBottomLineSettleDuration,
  ]);

  // 初始化emoji运动属性（emoji可见后立即启动）
  useEffect(() => {
    if (!emojisVisible) return;
    
    if (!physicsEnabled || emojiPhysicsRef.current.length !== selectedEmojis.length) {
      emojiPhysicsRef.current = createEmojiPhysics();
      setPhysicsEnabled(true);
      console.log(isTouchDevice
        ? '✅ 触摸设备 Emoji 自由漫游已启动（低帧率柔和排斥）'
        : '✅ 桌面端物理引擎已随Emoji可见状态启动，Emoji将随机分批动起来'
      );
    }
  }, [emojisVisible, physicsEnabled, createEmojiPhysics, isTouchDevice, selectedEmojis.length]);

  // 物理引擎 - 桌面保留现有效果；触摸设备使用低帧率自由漫游 + 柔和排斥。
  useEffect(() => {
    if (!physicsEnabled || emojiPhysicsRef.current.length === 0) return;

    const damping = 0.92; // 阻尼系数（碰撞后保留92%速度）
    const restitution = 0.8; // 弹性系数（碰撞恢复系数）
    const targetFPS = isTouchDevice ? (isSmallMobile ? 20 : 24) : 60;
    const frameInterval = 1000 / targetFPS;
    let lastFrameTime = 0;
    
    const updatePhysics = (timestamp: number = Date.now()) => {
      if (timestamp - lastFrameTime < frameInterval) {
        animationFrameRef.current = requestAnimationFrame(updatePhysics);
        return;
      }
      lastFrameTime = timestamp;

      const now = Date.now();
      const hoveredEmojiIndex = hoveredEmojiIndexRef.current;
      const newPhysics = emojiPhysicsRef.current;
      const maxX = window.innerWidth - emojiSize / 2;
      const maxY = window.innerHeight - emojiSize / 2;

      // 第一步：更新所有emoji的位置
      for (let index = 0; index < newPhysics.length; index++) {
        const emoji = newPhysics[index];
        if (now < emoji.startAt || index === hoveredEmojiIndex) continue;

        if (isTouchDevice) {
          const wander = Math.sin(now * 0.00035 + emoji.wanderPhase + index) * 0.006;
          const crossWander = Math.cos(now * 0.00028 + emoji.wanderPhase - index) * 0.004;
          emoji.vx += wander;
          emoji.vy += crossWander;
        }

        emoji.x += emoji.vx;
        emoji.y += emoji.vy;
        emoji.rotation += emoji.rotationSpeed;

        if (emoji.x <= emojiSize / 2) {
          emoji.x = emojiSize / 2;
          emoji.vx = Math.abs(emoji.vx) * (isTouchDevice ? 0.98 : damping);
        } else if (emoji.x >= window.innerWidth - emojiSize / 2) {
          emoji.x = maxX;
          emoji.vx = -Math.abs(emoji.vx) * (isTouchDevice ? 0.98 : damping);
        }

        if (emoji.y <= emojiSize / 2) {
          emoji.y = emojiSize / 2;
          emoji.vy = Math.abs(emoji.vy) * (isTouchDevice ? 0.98 : damping);
        } else if (emoji.y >= window.innerHeight - emojiSize / 2) {
          emoji.y = maxY;
          emoji.vy = -Math.abs(emoji.vy) * (isTouchDevice ? 0.98 : damping);
        }

        if (isTouchDevice) {
          const speed = Math.hypot(emoji.vx, emoji.vy) || 1;
          const minSpeed = isSmallMobile ? 0.1 : 0.12;
          const maxSpeed = isSmallMobile ? 0.24 : 0.3;

          if (speed < minSpeed) {
            emoji.vx = (emoji.vx / speed) * minSpeed;
            emoji.vy = (emoji.vy / speed) * minSpeed;
          } else if (speed > maxSpeed) {
            emoji.vx = (emoji.vx / speed) * maxSpeed;
            emoji.vy = (emoji.vy / speed) * maxSpeed;
          }
        }
      }

      if (isTouchDevice) {
        const safeDistance = emojiSize;
        const cellSize = safeDistance * 1.6;
        const grid = new Map<string, number[]>();
        const getGridKey = (x: number, y: number) =>
          `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`;

        newPhysics.forEach((emoji, index) => {
          if (now < emoji.startAt) return;
          const key = getGridKey(emoji.x, emoji.y);
          const cell = grid.get(key);
          if (cell) {
            cell.push(index);
          } else {
            grid.set(key, [index]);
          }
        });

        for (let i = 0; i < newPhysics.length; i++) {
          const emoji1 = newPhysics[i];
          if (now < emoji1.startAt) continue;

          const gridX = Math.floor(emoji1.x / cellSize);
          const gridY = Math.floor(emoji1.y / cellSize);

          for (let offsetX = -1; offsetX <= 1; offsetX++) {
            for (let offsetY = -1; offsetY <= 1; offsetY++) {
              const nearby = grid.get(`${gridX + offsetX}:${gridY + offsetY}`);
              if (!nearby) continue;

              nearby.forEach((j) => {
                if (j <= i || now < newPhysics[j].startAt) return;

                const emoji2 = newPhysics[j];
                const dx = emoji2.x - emoji1.x;
                const dy = emoji2.y - emoji1.y;
                const distance = Math.hypot(dx, dy) || 0.01;

                if (distance >= safeDistance) return;

                const nx = dx / distance;
                const ny = dy / distance;
                const repelStrength = (safeDistance - distance) / safeDistance;
                const force = repelStrength * 0.045;

                emoji1.vx -= nx * force;
                emoji1.vy -= ny * force;
                emoji2.vx += nx * force;
                emoji2.vy += ny * force;

                if (distance < safeDistance * 0.85) {
                  const correction = (safeDistance * 0.85 - distance) * 0.04;
                  emoji1.x -= nx * correction;
                  emoji1.y -= ny * correction;
                  emoji2.x += nx * correction;
                  emoji2.y += ny * correction;
                }
              });
            }
          }
        }
      } else {
        // 第二步：检测并处理emoji之间的碰撞
        for (let i = 0; i < newPhysics.length; i++) {
          if (i === hoveredEmojiIndex || now < newPhysics[i].startAt) continue;

          for (let j = i + 1; j < newPhysics.length; j++) {
            if (j === hoveredEmojiIndex || now < newPhysics[j].startAt) continue;

            const emoji1 = newPhysics[i];
            const emoji2 = newPhysics[j];
            const dx = emoji2.x - emoji1.x;
            const dy = emoji2.y - emoji1.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = emojiSize * 0.8;

            if (distance < minDistance && distance > 0) {
              const nx = dx / distance;
              const ny = dy / distance;
              const dvx = emoji2.vx - emoji1.vx;
              const dvy = emoji2.vy - emoji1.vy;
              const dvn = dvx * nx + dvy * ny;

              if (dvn > 0) continue;

              const impulse = -(1 + restitution) * dvn / 2;
              emoji1.vx -= impulse * nx;
              emoji1.vy -= impulse * ny;
              emoji2.vx += impulse * nx;
              emoji2.vy += impulse * ny;

              const overlap = minDistance - distance;
              const separationX = (overlap / 2) * nx;
              const separationY = (overlap / 2) * ny;
              emoji1.x -= separationX;
              emoji1.y -= separationY;
              emoji2.x += separationX;
              emoji2.y += separationY;
            }
          }
        }
      }

      newPhysics.forEach((emoji, index) => {
        const button = emojiButtonRefs.current[index];
        if (!button) return;

        button.style.left = `${emoji.x}px`;
        button.style.top = `${emoji.y}px`;
        button.style.transform = `translate(-50%, -50%) rotate(${emoji.rotation}deg)`;
      });
      
      animationFrameRef.current = requestAnimationFrame(updatePhysics);
    };
    
    animationFrameRef.current = requestAnimationFrame(updatePhysics);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [physicsEnabled, emojiSize, isSmallMobile, isTouchDevice]);

  // 触发流星效果的通用函数
  const triggerMeteor = useCallback(() => {
    const allParticles = getAllParticles();
    
    const activeMeteors = meteorParticlesRef.current;
    if (meteorInFlightRef.current) return;
    if (activeMeteors.size > 0) return;

    const positionOverrides = particlePositionOverridesRef.current;
    // 过滤出不是流星的粒子
    const availableParticles = allParticles.filter((particle) => (
      (allStarsVisibleRef.current || revealedStarIdsRef.current.has(particle.id)) &&
      !activeMeteors.has(particle.id)
    ));
    
    if (availableParticles.length > 0) {
      meteorInFlightRef.current = true;
      if (starAnimationRef.current) {
        cancelAnimationFrame(starAnimationRef.current);
      }
      activeTwinklesRef.current.clear();
      twinkleWaveActiveRef.current = false;

      const randomParticle = availableParticles[Math.floor(Math.random() * availableParticles.length)];
      const canvas = canvasRef.current;
      
      if (canvas) {
        const positionOverride = positionOverrides.get(randomParticle.id);
        const currentX = positionOverride ? positionOverride.x : randomParticle.x;
        const currentY = positionOverride ? positionOverride.y : randomParticle.y;
        const startX = Math.random() * canvas.width;
        const startY = Math.random() * canvas.height * 0.32 + canvas.height * 0.06;
        
        // 随机选择更自然的斜向下路径。
        const randomDirection = Math.floor(Math.random() * 4);
        const directionNames = ['右下斜掠', '左下斜掠', '短右下斜掠', '短左下斜掠'];

        const brightenStart = Date.now();
        const brightenDuration = 380 + Math.random() * 160;
        activeTwinklesRef.current.set(randomParticle.id, {
          startTime: brightenStart,
          delay: 0,
          duration: brightenDuration,
          peakOpacity: randomParticle.maxOpacity,
        });

        const animateBrighten = () => {
          const now = Date.now();
          drawStarField(now);

          if (now < brightenStart + brightenDuration) {
            meteorAnimationRef.current = requestAnimationFrame(animateBrighten);
            return;
          }

          activeTwinklesRef.current.delete(randomParticle.id);
          meteorParticlesRef.current.set(randomParticle.id, {
            startTime: Date.now(),
            startX,
            startY,
            direction: randomDirection,
          });
          
          console.log(`✨ 流星出现：${randomParticle.id}，方向：${directionNames[randomDirection]}`);

          const animateMeteor = () => {
            const ctx = canvas.getContext('2d', { alpha: true });
            const meteorInfo = meteorParticlesRef.current.get(randomParticle.id);
            if (!ctx || !meteorInfo) {
              meteorInFlightRef.current = false;
              return;
            }

            const currentTime = Date.now();
            const meteorElapsed = (currentTime - meteorInfo.startTime) / 1000;
            const meteorDuration = 1.15;

            drawStarField(currentTime);

            if (meteorElapsed < meteorDuration) {
              const meteorProgress = meteorElapsed / meteorDuration;
              let travelX, travelY;
              switch (meteorInfo.direction) {
                case 0:
                  travelX = canvas.width * 0.34;
                  travelY = canvas.height * 0.24;
                  break;
                case 1:
                  travelX = -canvas.width * 0.34;
                  travelY = canvas.height * 0.24;
                  break;
                case 2:
                  travelX = canvas.width * 0.26;
                  travelY = canvas.height * 0.18;
                  break;
                default:
                  travelX = -canvas.width * 0.26;
                  travelY = canvas.height * 0.18;
              }

              const endX = meteorInfo.startX + travelX;
              const endY = meteorInfo.startY + travelY;
              const easedProgress = 1 - Math.pow(1 - meteorProgress, 2);
              const currentX = meteorInfo.startX + (endX - meteorInfo.startX) * easedProgress;
              const currentY = meteorInfo.startY + (endY - meteorInfo.startY) * easedProgress;
              const meteorOpacity = meteorProgress < 0.12
                ? meteorProgress / 0.12
                : Math.max(0, 1 - (meteorProgress - 0.12) / 0.88);
              const vectorLength = Math.hypot(endX - meteorInfo.startX, endY - meteorInfo.startY) || 1;
              const unitX = (endX - meteorInfo.startX) / vectorLength;
              const unitY = (endY - meteorInfo.startY) / vectorLength;
              const trailLength = Math.min(canvas.width, canvas.height) * (isMobile ? 0.24 : 0.2);
              const tailX = currentX - unitX * trailLength;
              const tailY = currentY - unitY * trailLength;

              const trailGradient = ctx.createLinearGradient(tailX, tailY, currentX, currentY);
              trailGradient.addColorStop(0, 'rgba(220, 235, 255, 0)');
              trailGradient.addColorStop(0.72, `rgba(220, 235, 255, ${meteorOpacity * 0.22})`);
              trailGradient.addColorStop(1, `rgba(255, 255, 255, ${meteorOpacity * 0.82})`);
              ctx.save();
              ctx.lineCap = 'round';
              ctx.lineWidth = isMobile ? 1 : 1.25;
              ctx.strokeStyle = trailGradient;
              ctx.shadowColor = `rgba(190, 215, 255, ${meteorOpacity * 0.35})`;
              ctx.shadowBlur = isMobile ? 3 : 5;
              ctx.beginPath();
              ctx.moveTo(tailX, tailY);
              ctx.lineTo(currentX, currentY);
              ctx.stroke();
              ctx.restore();

              ctx.beginPath();
              ctx.arc(currentX, currentY, isMobile ? 1.15 : 1.4, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(255, 255, 255, ${meteorOpacity * 0.9})`;
              ctx.fill();

              meteorAnimationRef.current = requestAnimationFrame(animateMeteor);
              return;
            }

            // 生成新的随机位置（确保与当前位置不同）
            let newX, newY;
            do {
              newX = Math.random();
              newY = Math.random();
            } while (Math.abs(newX - currentX) < 0.2 && Math.abs(newY - currentY) < 0.2); // 确保新位置距离当前位置足够远

            particlePositionOverridesRef.current.set(randomParticle.id, { x: newX, y: newY });
            meteorParticlesRef.current.delete(randomParticle.id);
            meteorInFlightRef.current = false;
            drawStarField();

            console.log(`🌟 流星消失，粒子在新位置重生：${randomParticle.id}，位置：(${(newX * 100).toFixed(1)}%, ${(newY * 100).toFixed(1)}%)`);
          };

          meteorAnimationRef.current = requestAnimationFrame(animateMeteor);
        };

        meteorAnimationRef.current = requestAnimationFrame(animateBrighten);
      } else {
        meteorInFlightRef.current = false;
      }
    }
  }, [drawStarField, getAllParticles, isMobile]);

  // 流星效果：首次快速出现，之后低频随机出现
  useEffect(() => {
    let meteorTimer: number;
    
    const scheduleMeteor = (isFirstRun = false) => {
      // 首次更早出现，之后保持低频随机，避免长时间等不到流星。
      const randomInterval = isFirstRun
        ? 6000 + Math.random() * 4000
        : 18000 + Math.random() * 24000;
      console.log(`🌠 下一次流星将在 ${(randomInterval / 1000).toFixed(1)} 秒后出现`);
      
      meteorTimer = window.setTimeout(() => {
        if (emojisVisible) {
          triggerMeteor();
        }
        // 触发后立即安排下一次流星
        scheduleMeteor();
      }, randomInterval);
    };
    
    // 启动第一次流星调度
    scheduleMeteor(true);

    return () => {
      if (meteorTimer) {
        clearTimeout(meteorTimer);
      }
    };
  }, [emojisVisible, triggerMeteor]);

  // 处理爱心点击
  const handleLoveClick = () => {
    setIsLoved(true);
    setShowQRCode(true);
  };

  const getNearestEmojiIndex = useCallback((x: number, y: number) => {
    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;

    emojiPhysicsRef.current.forEach((emoji, index) => {
      const distance = Math.hypot(emoji.x - x, emoji.y - y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    return nearestDistance <= emojiSize * 0.9 ? nearestIndex : -1;
  }, [emojiSize]);

  // 处理关闭按钮点击
  const handleCloseClick = () => {
    if (!isPoemFadingOut) {
      setIsPoemFadingOut(true);
      console.log('✅ 关闭按钮：诗句框开始淡出');
      
      triggerMeteor();
      console.log('🌠 关闭诗句时触发流星');
      
      // 0.8秒淡出动画完成后，真正关闭诗句框
      setTimeout(() => {
        setPoemData(null);
        setIsPoemFadingOut(false);
        console.log('✅ 诗句框已关闭');
      }, 800);
    }
  };

  // 处理点击诗句框外部区域
  const handleOutsideClick = () => {
    if (showQRCode && !isQRFadingOut) {
      // 如果二维码正在显示且未开始淡出，先淡出二维码
      setIsQRFadingOut(true);
      console.log('✅ 二维码开始淡出');
      
      // 0.5秒淡出动画完成后，真正关闭二维码
      setTimeout(() => {
        setShowQRCode(false);
        setIsQRFadingOut(false);
        console.log('✅ 二维码已关闭');
      }, 500);
    } else if (!isPoemFadingOut) {
      // 如果二维码未显示或已关闭，淡出诗句框
      setIsPoemFadingOut(true);
      console.log('✅ 诗句框开始淡出');
      
      triggerMeteor();
      console.log('🌠 关闭诗句时触发流星');
      
      // 0.8秒淡出动画完成后，真正关闭诗句框
      setTimeout(() => {
        setPoemData(null);
        setIsPoemFadingOut(false);
        console.log('✅ 诗句框已关闭');
      }, 800);
    }
  };

  // AI 调用核心逻辑
  const handleEmojiClick = async (keyword: string, mood: string) => {
    if (isRequestInFlightRef.current) return;
    isRequestInFlightRef.current = true;

    console.log('🎭 点击了 Emoji:', { keyword, mood });
    triggerMeteor();
    setShowPrompt(false); // 隐藏提示词
    
    // 如果有诗句正在显示，先淡出
    if (poemData && !isPoemFadingOut) {
      // 如果二维码正在显示，先淡出二维码
      if (showQRCode && !isQRFadingOut) {
        console.log('✅ 检测到二维码，先淡出二维码...');
        setIsQRFadingOut(true);
        
        // 等待二维码淡出动画完成（0.5秒）
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setShowQRCode(false);
        setIsQRFadingOut(false);
        console.log('✅ 二维码已淡出');
      }
      
      // 然后淡出诗句框
      console.log('✅ 开始淡出诗句框...');
      setIsPoemFadingOut(true);
      
      triggerMeteor();
      console.log('🌠 诗句淡出时触发流星');
      
      // 等待诗句框淡出动画完成（0.8秒）
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setPoemData(null);
      setIsPoemFadingOut(false);
      console.log('✅ 诗句框已淡出');
    }
    
    setIsLoading(true);

    try {
      console.log('📡 准备调用 Gemini API...');
      // 调用 Gemini API
      const poem = await generatePoem(keyword, mood);
      console.log('✅ Gemini API 返回成功:', poem);
      
      // 展示诗句
      setPoemData({
        content: poem.content,
        poem_title: poem.poem_title,
        author: poem.author,
      });

      // 异步保存到数据库（不阻塞 UI）
      savePoemToDatabase(
        poem.content,
        poem.poem_title,
        poem.author,
        keyword
      );

      console.log('✅ AI 返回成功：', poem);
    } catch (error) {
      console.error('❌ AI 调用失败，完整错误信息：', error);
      console.error('错误类型:', error instanceof Error ? error.message : String(error));

      // 容错机制：从数据库随机读取
      console.log('🔄 尝试从数据库读取备用诗句...');
      const fallbackPoem = await getRandomPoemFromDatabase();

      if (fallbackPoem) {
        setPoemData({
          content: fallbackPoem.content,
          poem_title: fallbackPoem.poem_title || '未知',
          author: fallbackPoem.author || '佚名',
        });
        console.log('✅ 使用数据库备用诗句');
      } else {
        alert('获取诗句失败，且数据库中暂无备用诗句。请稍后重试。');
      }
    } finally {
      isRequestInFlightRef.current = false;
      setIsLoading(false);
    }
  };


  return (
    <div className="app-container min-h-screen relative overflow-hidden">
      {/* 入场欢迎屏幕 */}
      {showWelcome && (
        <div
          onClick={skipWelcomeAnimation}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: welcomePhase === 'complete' ? WELCOME_LAYER_Z_INDEX.complete : WELCOME_LAYER_Z_INDEX.intro,
            background: 'transparent',  // 完全透明，让背景的星空、光芒和粒子层透过来
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: welcomePhase === 'complete' ? 'none' : 'auto',  // 完成后不阻挡交互
            cursor: welcomePhase === 'complete' ? 'default' : 'auto',  // 移除手型提示
          }}
        >
          {/* 入场诗句 */}
          <div
            style={{
              position: 'relative',
              width: '80%',
              maxWidth: '600px',
              height: '100vh',
            }}
          >
            {welcomeLines.map((line, index) => {
              // 计算位置
              const initialTop = 25 + index * 5; // 初始位置：25%, 30%, 35%...（间隔5%）
              
              // 判断是否是第1句或最后1句
              const isFirstLine = index === 0;
              const isLastLine = index === welcomeLines.length - 1;
              const shouldKeep = isFirstLine || isLastLine;
              const isSkipExit = skipMode !== 'none';
              const shouldWipeMiddleLine = !shouldKeep && (!isSkipExit || visibleWelcomeLines[index]);
              const shouldHideMiddleLine = !shouldKeep && isSkipExit && !visibleWelcomeLines[index];
              const shouldMoveLastLine = !isSkipExit || skipMode === 'with-last';
              const shouldIntroduceLastLineAtBottom = isLastLine && isSkipExit && skipMode !== 'with-last';
              
              return (
                <div
                  key={index}
                  ref={(element) => {
                    welcomeLineRefs.current[index] = element;
                  }}
                  className={`welcome-line-${index}`}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    fontSize: welcomeFontSize,
                    fontFamily: 'QianTuBiFeng, sans-serif',
                    color: '#ffd700',
                    textAlign: 'center',
                    whiteSpace: 'nowrap', // 所有设备都不换行
                    maxWidth: isMobile ? '95vw' : 'none', // 移动端增大容器宽度到95vw
                    // 阶段1：逐行淡入，停留在初始位置（根据字符数分配时间）
                    ...(welcomePhase === 'lines' && {
                      top: `${initialTop}%`,
                      opacity: 0,
                      transform: 'translateX(-50%) translateY(-10px)',
                      animation: isWelcomeFontReady
                        ? `welcomeLineAppear ${getLineFadeInDuration(index)}s ease-out ${getLineStartTime(index)}s forwards`
                        : 'none',
                    }),
                    // 阶段2：首尾句移动到底部，其他诗句原地淡出
                    ...(welcomePhase === 'sliding' && {
                      top: `${initialTop}%`,  // 保持在原位置
                      bottom: 'auto',
                      opacity: 0.9,
                      fontSize: welcomeFontSize,
                      fontFamily: 'QianTuBiFeng, sans-serif',
                      color: '#ffd700',
                      transform: 'translateX(-50%)',
                      ...(shouldKeep
                        ? {
                            '--move-y': `${bottomLineOffsets[index] || 0}px`,
                            ...(isFirstLine
                              ? {
                                  '--meet-y': `${firstLineMeetOffset}px`,
                                  animation: isSkipExit && skipMode !== 'with-last'
                                    ? `welcomeFirstLineSkipToBottom ${skipToBottomDuration}s cubic-bezier(${curtainBezier.x1}, ${curtainBezier.y1}, ${curtainBezier.x2}, ${curtainBezier.y2}) forwards`
                                    : `welcomeFirstLineCurtainMove ${welcomeMoveDuration}s cubic-bezier(${curtainBezier.x1}, ${curtainBezier.y1}, ${curtainBezier.x2}, ${curtainBezier.y2}) forwards`,
                                }
                              : {
                                  animation: shouldMoveLastLine
                                    ? `welcomeLastLineJoinMove ${welcomeMoveDuration}s cubic-bezier(${curtainBezier.x1}, ${curtainBezier.y1}, ${curtainBezier.x2}, ${curtainBezier.y2}) forwards`
                                    : 'none',
                                  display: shouldMoveLastLine ? 'block' : 'none',
                                }),
                          }
                        : shouldWipeMiddleLine ? {
                            animation: `welcomeLineCurtainWipe ${curtainWipeDurations[index] || 0.2}s linear ${curtainWipeDelays[index] || 0}s forwards`,
                          } : {
                            display: shouldHideMiddleLine ? 'none' : 'block',
                            opacity: 0,
                          }),
                    }),
                    // 阶段3：只有第1句和最后1句固定在底部
                    ...(welcomePhase === 'complete' && shouldKeep && {
                      top: `${initialTop}%`,
                      bottom: 'auto',
                      opacity: 0.7,
                      fontSize: welcomeFontSize,
                      '--move-y': `${bottomLineOffsets[index] || 0}px`,
                      transform: `translateX(-50%) translateY(${bottomLineOffsets[index] || 0}px) scale(${WELCOME_TIMING.bottomLineScale})`,
                      animation: shouldIntroduceLastLineAtBottom
                        ? `welcomeBottomLineAppearSettle ${skipBottomLineSettleDuration}s ease-out forwards`
                        : `welcomeBottomLineSettle ${isSkipExit && skipMode !== 'with-last' ? skipBottomLineSettleDuration : bottomLineSettleDuration}s ease-out forwards`,
                      transformOrigin: 'center center',
                      maxWidth: isMobile ? '95vw' : 'none', // 移动端增大容器宽度
                    }),
                    // 其他句子保持淡出状态
                    ...(welcomePhase === 'complete' && !shouldKeep && {
                      opacity: 0,
                      pointerEvents: 'none',
                      display: 'none',
                    }),
                  }}
                >
                  {line}
                </div>
              );
            })}
            
            {/* 操作提示词（emoji淡入完成后显示） */}
            {showPromptAnimation && showPrompt && (
              <div
                style={{
                  position: 'fixed',
                  left: '50%',
                  top: '33%',
                  transform: 'translateX(-50%)',
                  fontSize: promptFontSize,
                  fontFamily: 'QianTuBiFeng, sans-serif',
                  color: 'rgba(255, 215, 0, 0.8)',
                  textAlign: 'center',
                  whiteSpace: isNarrowScreen ? 'normal' : 'nowrap',
                  maxWidth: isNarrowScreen ? '90vw' : 'none',
                  opacity: 0,
                  zIndex: WELCOME_LAYER_Z_INDEX.prompt,
                  animation: 'welcomeLineAppear 2s ease-out forwards',
                  lineHeight: isNarrowScreen ? '1.6' : 'normal',
                }}
              >
                {/* 宽屏：一行显示 */}
                {!isNarrowScreen && (
                  <>
                    在每一个瞬间的情绪里  都藏着一句等待被唤醒的诗
                    <span className="dots-animation">
                      <span className="dot1">.</span>
                      <span className="dot2">.</span>
                      <span className="dot3">.</span>
                    </span>
                  </>
                )}
                {/* 窄屏：分两行显示 */}
                {isNarrowScreen && (
                  <>
                    在每一个瞬间的情绪里
                    <br />
                    都藏着一句等待被唤醒的诗
                    <span className="dots-animation">
                      <span className="dot1">.</span>
                      <span className="dot2">.</span>
                      <span className="dot3">.</span>
                    </span>
                  </>
                )}
              </div>
            )}
            
            {/* 提示词淡出动画 */}
            {showPromptAnimation && !showPrompt && (
              <div
                style={{
                  position: 'fixed',
                  left: '50%',
                  top: '33%',
                  transform: 'translateX(-50%)',
                  fontSize: promptFontSize,
                  fontFamily: 'QianTuBiFeng, sans-serif',
                  color: 'rgba(255, 215, 0, 0.8)',
                  textAlign: 'center',
                  whiteSpace: isNarrowScreen ? 'normal' : 'nowrap',
                  maxWidth: isNarrowScreen ? '90vw' : 'none',
                  opacity: 0.9,
                  zIndex: WELCOME_LAYER_Z_INDEX.prompt,
                  animation: 'promptFadeOut 0.8s ease-out forwards',
                  lineHeight: isNarrowScreen ? '1.6' : 'normal',
                }}
              >
                {/* 宽屏：一行显示 */}
                {!isNarrowScreen && (
                  <>
                    在每一个瞬间的情绪里  都藏着一句等待被唤醒的诗
                    <span>...</span>
                  </>
                )}
                {/* 窄屏：分两行显示 */}
                {isNarrowScreen && (
                  <>
                    在每一个瞬间的情绪里
                    <br />
                    都藏着一句等待被唤醒的诗
                    <span>...</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 深空背景层 - 一次性绘制，不持续动画 */}
      <canvas
        ref={deepSpaceCanvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: '#050716',
        }}
      />

      {/* 桌面端轻量光感层：不使用大面积 blur，触摸设备关闭 */}
      {!isTouchDevice && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            opacity: 0,
            background: [
              'radial-gradient(circle at 52% 58%, rgba(218, 176, 78, 0.08) 0%, rgba(218, 176, 78, 0.035) 23%, transparent 48%)',
              'radial-gradient(circle at 32% 34%, rgba(88, 102, 190, 0.09) 0%, rgba(88, 102, 190, 0.04) 28%, transparent 56%)',
              'radial-gradient(circle at 72% 70%, rgba(118, 58, 150, 0.08) 0%, rgba(118, 58, 150, 0.03) 24%, transparent 52%)',
            ].join(', '),
            animation: 'glowLayerFadeIn 4s ease-out 1s forwards, deepSpaceGlowBreath 58s ease-in-out 5s infinite',
            willChange: 'opacity, transform',
            backfaceVisibility: 'hidden',
          }}
        />
      )}

      {/* Canvas 粒子系统 - 负责星空和流星；移动端低帧率、低粒子数 */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2,
          pointerEvents: 'none',
          willChange: isMobile ? 'auto' : 'transform, opacity',
          backfaceVisibility: 'hidden',
        }}
      />

      {/* Emoji 按钮区域 - 淡入后物理运动 */}
      <div 
        className="emoji-container" 
        style={{ 
          position: 'fixed', 
          inset: 0, 
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        {selectedEmojis.map((item, index) => {
          const glowColor = generateGlowColors[index];
          const glowSize = emojiGlowSizes[index];
          const initialPos = emojiInitialPositions[index];
          const physics = emojiPhysicsRef.current[index];
          const usePhysics = physicsEnabled && physics;
          const emojiFilter = isTouchDevice
            ? 'none'
            : `drop-shadow(0 0 ${glowSize.minSize}px rgba(${glowColor}, ${glowSize.minOpacity}))`;
          const emojiTextShadow = isTouchDevice
            ? `0 0 0.42rem rgba(${glowColor}, 0.22)`
            : 'none';
          
          return (
            <button
              key={index}
              ref={(element) => {
                emojiButtonRefs.current[index] = element;
              }}
              onClick={(event) => {
                if (isTouchDevice && physicsEnabled) {
                  const nearestIndex = getNearestEmojiIndex(event.clientX, event.clientY);
                  if (nearestIndex !== index) return;
                }

                handleEmojiClick(item.keyword, item.mood);
              }}
              className="cursor-pointer"
              style={{
                position: 'absolute',
                // PC端：物理位置，移动端：CSS动画位置
                ...(usePhysics ? {
                  left: `${physics.x}px`,
                  top: `${physics.y}px`,
                  transform: `translate(-50%, -50%) rotate(${physics.rotation}deg)`,
                } : {
                  left: initialPos.left,
                  top: initialPos.top,
                  transform: 'translate(-50%, -50%)',
                }),
                fontSize: '3rem',
                border: 'none',
                background: 'transparent',
                pointerEvents: 'auto',
                opacity: emojisVisible ? 1 : 0,
                filter: emojiFilter,
                textShadow: emojiTextShadow,
                animation: emojisVisible ? emojiAnimations[index] : 'none',
                transition: isTouchDevice ? 'none' : 'filter 0.3s ease',
                willChange: usePhysics ? (isTouchDevice ? 'transform, opacity' : 'transform, filter') : isTouchDevice ? 'transform, opacity' : 'filter',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }}
              onMouseEnter={(e) => {
                // PC端：增强辉光效果
                if (!isTouchDevice) {
                  e.currentTarget.style.filter = `drop-shadow(0 0 ${glowSize.maxSize * 1.5}px rgba(${glowColor}, ${glowSize.maxOpacity * 1.2}))`;
                  // 暂停emoji移动
                  hoveredEmojiIndexRef.current = index;
                  console.log(`🖱️ 鼠标悬停: ${item.emoji} ${item.mood} (暂停移动)`);
                }
              }}
              onMouseLeave={(e) => {
                // PC端：恢复辉光效果
                if (!isTouchDevice) {
                  e.currentTarget.style.filter = `drop-shadow(0 0 ${glowSize.minSize}px rgba(${glowColor}, ${glowSize.minOpacity}))`;
                  // 恢复emoji移动
                  hoveredEmojiIndexRef.current = null;
                  console.log(`🖱️ 鼠标离开: ${item.emoji} ${item.mood} (恢复移动)`);
                }
              }}
              title={item.mood}
            >
              {item.emoji}
            </button>
          );
        })}
        
        {/* 动态生成每个emoji的辉光呼吸动画（仅桌面端使用） */}
        {!isTouchDevice && (
          <style>{`
            ${selectedEmojis.map((_, index) => {
              const glowColor = generateGlowColors[index];
              const glowSize = emojiGlowSizes[index];
              return `
                @keyframes emojiGlow-${index} {
                  0%, 100% {
                    filter: drop-shadow(0 0 ${glowSize.minSize}px rgba(${glowColor}, ${glowSize.minOpacity}));
                  }
                  50% {
                    filter: drop-shadow(0 0 ${glowSize.maxSize}px rgba(${glowColor}, ${glowSize.maxOpacity}));
                  }
                }
              `;
            }).join('\n')}
          `}</style>
        )}

      </div>

      {/* 诗句展示区域（中央） */}
      {poemData && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-20 pointer-events-auto"
          onClick={handleOutsideClick}
        >
          <div 
            className={`poem-display bg-black/40 ${isMobile ? '' : 'backdrop-blur-md'} rounded-2xl p-8 max-w-2xl`}
            style={{
              minWidth: '20rem', // 最小宽度：约10个字符的长度（可自行调整）
              animation: isPoemFadingOut ? 'poemFadeOut 0.8s ease-out forwards' : 'none',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 诗句内容 - 左对齐，一句一行 */}
            <div className="text-2xl text-white mb-4 leading-relaxed text-left">
              {poemData.content.split(/[，。、；！？]/).filter(line => line.trim()).map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
            
            {/* 诗名和作者 - 右对齐 */}
            <div className="text-sm text-gold/80 text-right">
              <p>《{poemData.poem_title}》</p>
              <p>— {poemData.author}</p>
            </div>
            
            {/* 按钮区域 */}
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={handleCloseClick}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
              >
                关闭
              </button>
              
              {/* 爱心按钮区域 - 固定占位，避免提示出现时撑大诗句框 */}
              <div
                className="flex items-center justify-end gap-1.5"
                style={{
                  minWidth: isSmallMobile ? '8.75rem' : '10.75rem',
                  minHeight: isSmallMobile ? '2.25rem' : '2.75rem',
                }}
              >
                {showLoveButton && (
                  <>
                  {/* 提示文字 - 高光划过效果 */}
                  <span
                    className="love-hint-text"
                    style={{
                      fontSize: '0.875rem',
                      color: 'rgba(255, 215, 0, 0.8)',
                      fontFamily: 'QianTuBiFeng, sans-serif',
                      whiteSpace: 'nowrap',
                      animation: isLoved
                        ? 'none'
                        : 'loveHintFadeIn 0.8s ease-out 1.5s forwards, loveHintShine 2.5s linear 2.5s infinite',
                      opacity: isLoved ? 0 : 0,
                      visibility: isLoved ? 'hidden' : 'visible',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    喜欢就点个赞吧！
                  </span>
                  
                  {/* 爱心按钮 */}
                  <button
                    onClick={handleLoveClick}
                    className="text-3xl transition-all duration-300 hover:scale-110"
                    style={{
                      transform: isLoved ? 'scale(1.2)' : 'scale(1)',
                      filter: isLoved ? 'drop-shadow(0 0 8px rgba(255, 50, 50, 0.8))' : 'none',
                      animation: 'loveButtonFadeIn 1.5s ease-out forwards',
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      boxShadow: 'none',
                      padding: 0,
                      cursor: 'pointer',
                    }}
                    title={isLoved ? '感谢支持！' : '喜欢这首诗？'}
                  >
                    {isLoved ? '❤️' : '🤍'}
                  </button>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* 赞赏二维码 - 点击爱心后显示，在诗句框下方 */}
          {showQRCode && (
            <div
              className="absolute pointer-events-auto"
              style={{
                top: '60%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginTop: '2rem',
                animation: isQRFadingOut 
                  ? 'qrCodeFadeOut 0.5s ease-out forwards' 
                  : 'qrCodeFadeIn 0.5s ease-out forwards',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white rounded-xl p-4 shadow-2xl">
                <img
                  src="/qrcode.jpg"
                  alt="赞赏二维码"
                  className="w-48 h-48 object-contain"
                />
                <p className="text-center text-sm text-gray-600 mt-2">
                  感谢您的支持 ❤️
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 加载状态 */}
      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center z-40 pointer-events-none">
          <div 
            className="text-gold animate-pulse"
            style={{
              fontSize: isSmallMobile ? '1.4rem' : isMobile ? '1.75rem' : '1.5rem'
            }}
          >
            诗句正在向你跑来...
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
