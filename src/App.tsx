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

function App() {
  // 📱 移动设备检测：桌面浏览器即使窗口较窄，也保留完整动效。
  const getIsTouchDevice = () =>
    window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768 && getIsTouchDevice());
  const [isSmallMobile, setIsSmallMobile] = useState(window.innerWidth <= 480 && getIsTouchDevice());
  const [isNarrowScreen, setIsNarrowScreen] = useState(window.innerWidth <= 760);

  useEffect(() => {
    const handleResize = () => {
      const isTouchDevice = getIsTouchDevice();
      setIsMobile(window.innerWidth <= 768 && isTouchDevice);
      setIsSmallMobile(window.innerWidth <= 480 && isTouchDevice);
      setIsNarrowScreen(window.innerWidth <= 760);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 动态字体大小 - 移动端优化（增大显示）
  const welcomeFontSize = isSmallMobile ? '1.4rem' : isMobile ? '2rem' : '2.5rem';
  const bottomPoemFontSize = isSmallMobile ? '1.4rem' : isMobile ? '1.75rem' : '1.8rem';
  const promptFontSize = isSmallMobile ? '1.75rem' : isMobile ? '2.2rem' : '2.5rem';

  // 🎲 每次刷新从 100 个中随机选择 Emoji（保持情绪平衡，移动端性能优化）
  const selectedEmojis = useMemo(() => {
    // 分类 Emoji（按在数组中的位置）
    const positive = EMOJI_MOODS.slice(0, 35);   // 正面情绪 35个
    const neutral = EMOJI_MOODS.slice(35, 55);   // 平静情绪 20个
    const negative = EMOJI_MOODS.slice(55, 90);  // 负面情绪 35个
    const intense = EMOJI_MOODS.slice(90, 100);  // 强烈情绪 10个
    
    // 根据设备类型选择不同数量（性能优化：超小屏12个，移动端18个，PC端27个）
    const counts = isSmallMobile
      ? { positive: 4, neutral: 2, negative: 4, intense: 2 }  // 超小屏：12个
      : isMobile 
      ? { positive: 6, neutral: 3, negative: 6, intense: 3 }  // 移动端：18个
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
    
    const totalCount = isSmallMobile ? 12 : isMobile ? 18 : 27;
    const deviceType = isSmallMobile ? '超小屏' : isMobile ? '移动端' : 'PC端';
    console.log(`🎲 本次从100个中随机选择的${totalCount}个 Emoji (${deviceType}):`, 
      final.map(e => `${e.emoji} ${e.mood}`).join(', ')
    );
    
    return final;
  }, [isSmallMobile, isMobile]); // 依赖设备类型 - 设备类型变化时重新计算

  // 入场动画状态
  const [welcomePhase, setWelcomePhase] = useState<'lines' | 'sliding' | 'complete'>('lines');
  const [showWelcome] = useState(true);  // 入场诗一直保持显示
  const [emojisVisible, setEmojisVisible] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);  // 控制提示词显示（初始为false）
  const [showPromptAnimation, setShowPromptAnimation] = useState(false);  // 控制提示词淡入动画
  const [isSkipped, setIsSkipped] = useState(false);  // 标记是否跳过了入场动画
  
  // 入场动画定时器引用（用于跳过功能）
  const welcomeTimersRef = useRef<number[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
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

  // 流星效果状态管理
  const [meteorParticles, setMeteorParticles] = useState<Map<string, { 
    startTime: number; 
    startX: number; 
    startY: number;
    direction: number; // 流星方向：0-右下, 1-左下, 2-右上, 3-左上, 4-正下, 5-正右
  }>>(new Map());
  const meteorParticlesRef = useRef(meteorParticles);
  
  // 粒子位置覆盖（用于流星后在新位置重生）
  const [particlePositionOverrides, setParticlePositionOverrides] = useState<Map<string, { x: number; y: number }>>(new Map());
  const particlePositionOverridesRef = useRef(particlePositionOverrides);

  useEffect(() => {
    meteorParticlesRef.current = meteorParticles;
  }, [meteorParticles]);

  useEffect(() => {
    particlePositionOverridesRef.current = particlePositionOverrides;
  }, [particlePositionOverrides]);

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

  // 每句诗的字符数
  const charCounts = [5, 11, 11, 6, 6, 18, 6, 6]; // 每句的字符数

  // 计算每行的淡入时长（每秒1.5个字符）
  const getLineFadeInDuration = (index: number): number => {
    return charCounts[index] / 2; // 每秒1.5个字符
  };

  // 根据字符数计算每句的开始时间（总时长8秒 + 每句0.5秒delay）
  const getLineStartTime = (index: number): number => {
    const totalChars = charCounts.reduce((sum, count) => sum + count, 0); // 65
    const totalDuration = 8; // 总时长8秒
    
    let startTime = 0;
    for (let i = 0; i < index; i++) {
      startTime += (charCounts[i] / totalChars) * totalDuration;
    }
    return startTime + index * 0.5; // 每句增加0.5秒delay
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

  // 入场动画时间控制
  useMemo(() => {
    // 约11秒：8行诗句淡入完成（按字符数分配时间 + 每句0.5秒delay）
    // 停留2秒，让用户欣赏完整诗句
    // 13秒：开始淡出阶段
    const timer1 = window.setTimeout(() => {
      setWelcomePhase('sliding');
    }, 13000);
    welcomeTimersRef.current.push(timer1);
    
    // 14.5秒：淡出完成后，底部诗句开始淡入
    const timer2 = window.setTimeout(() => {
      setWelcomePhase('complete');
    }, 14500);
    welcomeTimersRef.current.push(timer2);
    
    // 15.8秒：Emoji开始淡入
    const timer3 = window.setTimeout(() => {
      setEmojisVisible(true);
    }, 15800);
    welcomeTimersRef.current.push(timer3);
    
    // 18.8秒：Emoji淡入完成后，提示词开始淡入
    const timer4 = window.setTimeout(() => {
      setShowPrompt(true);
      setShowPromptAnimation(true);
    }, 18800);
    welcomeTimersRef.current.push(timer4);
    
    // 不再隐藏欢迎屏幕，让入场诗一直保持在背景
    // setTimeout(() => {
    //   setShowWelcome(false);
    // }, 23000);
  }, []);

  // 🌟 三层星空粒子系统 - 使用 useMemo 缓存，避免闪烁
  // 移动端只保留少量 Canvas 粒子，避免大量 DOM 动画导致发热卡顿。
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
      baseDelay: number,
      delayRange: number
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
      
      return Array.from({ length: count }, (_, i) => ({
        id: `${layer}-${baseDelay}-${i}`,
        layer,
        fadeInDelay: baseDelay + Math.random() * delayRange,
        size: config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin),
        baseOpacity: config.opacityMin + Math.random() * (config.opacityMax - config.opacityMin),
        opacityMin: config.opacityMin,
        opacityMax: config.opacityMax,
        colorR: config.colorR,
        colorG: config.colorG,
        colorB: config.colorB,
        x: (Math.random() * 100) / 100, // 转换为 0-1 的比例
        y: (Math.random() * 100) / 100, // 转换为 0-1 的比例
        // 闪烁效果参数（快速闪烁 + 长时间保持）
        flashDuration: 0.5 + Math.random() * 1.5, // 闪烁时长：0.5-2秒
        holdDuration: 20 + Math.random() * 40, // 保持时长：20-60秒
        flashPhase: Math.random() * 100, // 随机起始相位（秒）
        // 浮动效果参数（缓慢浮动）
        driftSpeed: 0.02 + Math.random() * 0.08, // 漂浮速度参数（暂未使用）
        driftAngle: Math.random() * Math.PI * 2, // 漂浮方向：随机角度
        driftRadius: 5 + Math.random() * 15, // 漂浮半径：5-20px（粒子围绕原点的最大偏移）
        driftPhase: Math.random() * Math.PI * 2, // 漂浮动画随机起始相位
        driftPeriod: 60 + Math.random() * 100, // 漂浮周期：60-160秒（最快约1-2px/秒）
      }));
    };
    
    // 三层粒子：根据屏幕尺寸调整数量
    const frontLayer = generateParticles(particleCount.front, 'front', 0, 3);
    const midLayer = generateParticles(particleCount.mid, 'mid', 1, 4);
    const backLayer = generateParticles(particleCount.back, 'back', 2, 5);
    
    const deviceType = isSmallMobile ? '超小屏' : isMobile ? '移动端' : 'PC端';
    const fps = isSmallMobile ? '18fps' : isMobile ? '24fps' : '60fps';
    console.log(`✨ 粒子系统 (${deviceType}, ${fps}): 前景${particleCount.front}个 + 中景${particleCount.mid}个 + 背景${particleCount.back}个 = 总计${particleCount.front + particleCount.mid + particleCount.back}个`);
    
    return { frontLayer, midLayer, backLayer };
  }, [isSmallMobile, isMobile]); // 屏幕尺寸变化时重新计算

  // Canvas 粒子系统
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particleAnimationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());

  // Canvas 渲染循环 - 三层粒子呼吸动画 + 流星
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // 设置 Canvas 尺寸为窗口大小
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 合并所有粒子
    const allParticles = [
      ...particleSequences.backLayer,
      ...particleSequences.midLayer,
      ...particleSequences.frontLayer,
    ];

    let lastFrameTime = 0;
    const targetFPS = isSmallMobile ? 18 : isMobile ? 24 : 60;
    const frameInterval = 1000 / targetFPS;

    // 渲染循环
    const render = (timestamp: number = Date.now()) => {
      if (timestamp - lastFrameTime < frameInterval) {
        particleAnimationRef.current = requestAnimationFrame(render);
        return;
      }
      lastFrameTime = timestamp;

      const currentTime = Date.now();
      const elapsedTime = (currentTime - startTimeRef.current) / 1000; // 转换为秒

      // 清空画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制每个粒子
      allParticles.forEach((particle) => {
        // 检查是否是流星
        const meteorInfo = meteorParticles.get(particle.id);
        
        if (meteorInfo) {
          // 绘制流星效果
          const meteorElapsed = (currentTime - meteorInfo.startTime) / 1000; // 流星经过时间（秒）
          const meteorDuration = 1.15; // 流星短促划过
          
          if (meteorElapsed < meteorDuration) {
            const meteorProgress = meteorElapsed / meteorDuration; // 0-1
            
            // 流星起点
            const startX = meteorInfo.startX;
            const startY = meteorInfo.startY;
            
            // 更接近真实流星：从天空上方斜向掠过，轨迹短而克制。
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
            const endX = startX + travelX;
            const endY = startY + travelY;
            
            // 当前流星位置（线性插值）
            const easedProgress = 1 - Math.pow(1 - meteorProgress, 2);
            const currentX = startX + (endX - startX) * easedProgress;
            const currentY = startY + (endY - startY) * easedProgress;
            
            // 流星透明度：快速出现，随后柔和消失。
            const meteorOpacity = meteorProgress < 0.12
              ? meteorProgress / 0.12
              : Math.max(0, 1 - (meteorProgress - 0.12) / 0.88);
            
            const vectorLength = Math.hypot(endX - startX, endY - startY) || 1;
            const unitX = (endX - startX) / vectorLength;
            const unitY = (endY - startY) / vectorLength;
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
          }
          
          return; // 流星状态下不绘制普通粒子
        }
        
        // 普通粒子绘制
        // 计算淡入进度（基于 fadeInDelay 和层级）
        const fadeInStart = particle.fadeInDelay;
        // 跳过后所有粒子使用1秒淡入，正常流程使用3-5秒淡入
        const fadeInDuration = isSkipped ? 1 : (particle.layer === 'back' ? 3 : particle.layer === 'mid' ? 4 : 5);
        const fadeInProgress = Math.min(1, Math.max(0, (elapsedTime - fadeInStart) / fadeInDuration));

        // 如果还没开始淡入，跳过
        if (fadeInProgress === 0) return;

        // 计算闪烁动画的透明度变化（快速闪烁 + 长时间保持）
        const animationTime = elapsedTime - fadeInStart - fadeInDuration + particle.flashPhase;
        const cycleDuration = particle.flashDuration + particle.holdDuration; // 一个完整循环时长
        const timeInCycle = animationTime % cycleDuration; // 当前在循环中的时间
        
        let flashOpacity;
        if (timeInCycle < particle.flashDuration) {
          // 闪烁阶段（0.5-2秒）：快速从最低→最高→最低
          const flashProgress = timeInCycle / particle.flashDuration; // 0-1
          // 使用正弦波实现平滑的 最低→最高→最低 变化
          const sinValue = Math.sin(flashProgress * Math.PI); // 0→1→0
          flashOpacity = particle.opacityMin + (particle.opacityMax - particle.opacityMin) * sinValue;
        } else {
          // 保持阶段（20-60秒）：保持在最低亮度
          flashOpacity = particle.opacityMin;
        }

        // 最终透明度 = 淡入进度 × 闪烁透明度
        const finalOpacity = fadeInProgress * flashOpacity;

        // 获取粒子的基础位置（优先使用覆盖位置）
        const positionOverride = particlePositionOverrides.get(particle.id);
        const baseX = positionOverride ? positionOverride.x : particle.x;
        const baseY = positionOverride ? positionOverride.y : particle.y;

        // 计算浮动偏移（移动端取消移动动效，性能优化）
        let driftOffsetX = 0;
        let driftOffsetY = 0;
        
        if (!isMobile) {
          // PC端：保留超级缓慢的浮动偏移（圆周运动）
          const driftTime = elapsedTime - fadeInStart - fadeInDuration;
          const driftCycle = (driftTime / particle.driftPeriod) * Math.PI * 2 + particle.driftPhase;
          driftOffsetX = Math.cos(driftCycle + particle.driftAngle) * particle.driftRadius * fadeInProgress;
          driftOffsetY = Math.sin(driftCycle + particle.driftAngle) * particle.driftRadius * fadeInProgress;
        }

        // 计算粒子位置（基础位置 + 浮动偏移）
        const x = baseX * canvas.width + driftOffsetX;
        const y = baseY * canvas.height + driftOffsetY;

        // 绘制粒子（圆形）
        ctx.beginPath();
        ctx.arc(x, y, particle.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${particle.colorR}, ${particle.colorG}, ${particle.colorB}, ${finalOpacity})`;
        ctx.fill();

        // 绘制光晕效果（减小光晕范围：从2倍改为1.2倍）
        const glowRadius = particle.size * 1.2;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
        gradient.addColorStop(0, `rgba(${particle.colorR}, ${particle.colorG}, ${particle.colorB}, ${finalOpacity * 0.6})`);
        gradient.addColorStop(0.5, `rgba(${particle.colorR}, ${particle.colorG}, ${particle.colorB}, ${finalOpacity * 0.3})`);
        gradient.addColorStop(1, `rgba(${particle.colorR}, ${particle.colorG}, ${particle.colorB}, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      particleAnimationRef.current = requestAnimationFrame(render);
    };

    // 启动渲染循环
    render();

    // 清理
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (particleAnimationRef.current) {
        cancelAnimationFrame(particleAnimationRef.current);
      }
    };
  }, [particleSequences, meteorParticles, particlePositionOverrides, isMobile, isSmallMobile, isSkipped]);

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

  // Emoji物理系统
  interface EmojiPhysics {
    x: number;
    y: number;
    vx: number;
    vy: number;
    rotation: number;
    rotationSpeed: number;
    startAt: number;
  }

  const [emojiPhysics, setEmojiPhysics] = useState<EmojiPhysics[]>([]);
  const [physicsEnabled, setPhysicsEnabled] = useState(false);
  const [hoveredEmojiIndex, setHoveredEmojiIndex] = useState<number | null>(null); // 悬停的emoji索引
  const animationFrameRef = useRef<number>(0);
  // 根据屏幕尺寸调整emoji碰撞半径
  const emojiSize = isSmallMobile ? 24 : isMobile ? 32 : 48;

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
    
    // 随机打乱全部27个位置
    return shuffleArray(allPositions);
  }, []);

  const createEmojiPhysics = useCallback((): EmojiPhysics[] => {
    const now = Date.now();
    return emojiInitialPositions.map((pos, index) => {
      const x = (parseFloat(pos.left) / 100) * window.innerWidth;
      const y = (parseFloat(pos.top) / 100) * window.innerHeight;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.2 + Math.random() * 0.3;
      const batchDelay = Math.floor(index / 5) * 650;
      const randomDelay = Math.random() * 850;
      
      return {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        startAt: now + batchDelay + randomDelay,
      };
    });
  }, [emojiInitialPositions]);

  // 🎯 跳过入场动画功能
  const skipWelcomeAnimation = useCallback(() => {
    // 只在入场诗淡入或淡出阶段可以跳过
    if (welcomePhase === 'lines' || welcomePhase === 'sliding') {
      console.log('⏭️ 用户点击跳过入场动画');
      
      // 清除所有入场动画定时器
      welcomeTimersRef.current.forEach(timer => clearTimeout(timer));
      welcomeTimersRef.current = [];
      
      // 标记已跳过
      setIsSkipped(true);
      
      // 直接跳转到底部诗句淡入阶段
      setWelcomePhase('complete');
      
      // 重置粒子时间基准，让所有粒子立即开始1秒淡入
      // 将时间设为7秒前（所有粒子的fadeInDelay都已过），粒子会立即开始淡入
      startTimeRef.current = Date.now() - 7000;
      console.log('✨ 粒子时间基准已重置，3层粒子将同时淡入（1秒）');
      
      // 延迟500ms后触发Emoji淡入
      const emojiTimer = window.setTimeout(() => {
        setEmojisVisible(true);
        console.log('✅ Emoji开始淡入（2秒）');
      }, 500);
      welcomeTimersRef.current.push(emojiTimer);
      
      // Emoji淡入完成后（500ms延迟 + 2000ms淡入 = 2500ms）启动物理引擎和提示词
      const afterSkipTimer = window.setTimeout(() => {
        setShowPrompt(true);
        setShowPromptAnimation(true);
        
        // 桌面端才启动物理引擎；手机端保持静态按钮，避免持续重绘。
        if (!isMobile && !physicsEnabled && emojiPhysics.length === 0) {
          setEmojiPhysics(createEmojiPhysics());
          setPhysicsEnabled(true);
          console.log('✅ Emoji淡入完成，物理引擎将随机分批启动');
        }
      }, 2500);
      welcomeTimersRef.current.push(afterSkipTimer);
    }
  }, [welcomePhase, physicsEnabled, emojiPhysics.length, createEmojiPhysics, isMobile]);

  // 初始化emoji物理属性（淡入完成后启动，仅PC端）
  useEffect(() => {
    // 移动端使用CSS动画，不需要物理引擎
    if (isMobile) return;
    
    if (!physicsEnabled && emojiPhysics.length === 0) {
      // 等待emoji淡入完成后启动物理引擎
      setTimeout(() => {
        setEmojiPhysics(createEmojiPhysics());
        setPhysicsEnabled(true);
        console.log('✅ 物理引擎已启动，Emoji将随机分批动起来');
      }, 15800); // 15.8秒emoji开始淡入时立即启动物理引擎
    }
  }, [physicsEnabled, emojiPhysics.length, createEmojiPhysics, isMobile]);

  // 物理引擎 - 超级缓慢移动和反弹 + emoji间碰撞
  useEffect(() => {
    if (isMobile) return;
    if (!physicsEnabled || emojiPhysics.length === 0) return;

    const damping = 0.92; // 阻尼系数（碰撞后保留92%速度）
    const restitution = 0.8; // 弹性系数（碰撞恢复系数）
    
    const updatePhysics = () => {
      setEmojiPhysics(prevPhysics => {
        const now = Date.now();
        // 第一步：更新所有emoji的位置
        let newPhysics = prevPhysics.map((emoji, index) => {
          let { x, y, vx, vy, rotation, rotationSpeed, startAt } = emoji;
          
          // 未到启动时间或被鼠标悬停时，保持当前位置。
          if (now < startAt || index === hoveredEmojiIndex) {
            return emoji; // 保持原位置，不移动
          }
          
          // 更新位置
          x += vx;
          y += vy;
          rotation += rotationSpeed;
          
          // 屏幕边界碰撞检测和反弹
          if (x <= emojiSize / 2) {
            x = emojiSize / 2;
            vx = Math.abs(vx) * damping;
          } else if (x >= window.innerWidth - emojiSize / 2) {
            x = window.innerWidth - emojiSize / 2;
            vx = -Math.abs(vx) * damping;
          }
          
          if (y <= emojiSize / 2) {
            y = emojiSize / 2;
            vy = Math.abs(vy) * damping;
          } else if (y >= window.innerHeight - emojiSize / 2) {
            y = window.innerHeight - emojiSize / 2;
            vy = -Math.abs(vy) * damping;
          }
          
          return { ...emoji, x, y, vx, vy, rotation };
        });
        
        // 第二步：检测并处理emoji之间的碰撞（移动端跳过，只保留边界反弹）
        if (!isMobile) {
          for (let i = 0; i < newPhysics.length; i++) {
            // 跳过被悬停的emoji
            if (i === hoveredEmojiIndex || now < newPhysics[i].startAt) continue;
          
          for (let j = i + 1; j < newPhysics.length; j++) {
            // 跳过被悬停的emoji
            if (j === hoveredEmojiIndex || now < newPhysics[j].startAt) continue;
            
            const emoji1 = newPhysics[i];
            const emoji2 = newPhysics[j];
            
            // 计算两个emoji中心的距离
            const dx = emoji2.x - emoji1.x;
            const dy = emoji2.y - emoji1.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 碰撞检测距离收近，让 Emoji 视觉上更贴近后再弹开。
            const minDistance = emojiSize * 0.8;
            
            if (distance < minDistance && distance > 0) {
              // 发生碰撞！
              
              // 计算碰撞法线（单位向量）
              const nx = dx / distance;
              const ny = dy / distance;
              
              // 计算相对速度
              const dvx = emoji2.vx - emoji1.vx;
              const dvy = emoji2.vy - emoji1.vy;
              
              // 相对速度在法线方向的分量
              const dvn = dvx * nx + dvy * ny;
              
              // 如果emoji正在远离，不处理碰撞
              if (dvn > 0) continue;
              
              // 计算碰撞冲量（假设质量相等）
              const impulse = -(1 + restitution) * dvn / 2;
              
              // 更新速度（弹性碰撞）
              newPhysics[i].vx -= impulse * nx;
              newPhysics[i].vy -= impulse * ny;
              newPhysics[j].vx += impulse * nx;
              newPhysics[j].vy += impulse * ny;
              
              // 分离重叠的emoji（避免卡住）
              const overlap = minDistance - distance;
              const separationX = (overlap / 2) * nx;
              const separationY = (overlap / 2) * ny;
              
              newPhysics[i].x -= separationX;
              newPhysics[i].y -= separationY;
              newPhysics[j].x += separationX;
              newPhysics[j].y += separationY;
              
              console.log(`💥 Emoji碰撞: #${i} ↔ #${j}`);
            }
          }
          }
        }
        
        return newPhysics;
      });
      
      animationFrameRef.current = requestAnimationFrame(updatePhysics);
    };
    
    animationFrameRef.current = requestAnimationFrame(updatePhysics);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [physicsEnabled, emojiPhysics.length, hoveredEmojiIndex, isMobile]);

  // 触发流星效果的通用函数
  const triggerMeteor = useCallback(() => {
    const allParticles = [
      ...particleSequences.frontLayer,
      ...particleSequences.midLayer,
      ...particleSequences.backLayer,
    ];
    
    const activeMeteors = meteorParticlesRef.current;
    const positionOverrides = particlePositionOverridesRef.current;
    // 过滤出不是流星的粒子
    const availableParticles = allParticles.filter(p => !activeMeteors.has(p.id));
    
    if (availableParticles.length > 0) {
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
        
        // 记录流星起点和方向
        setMeteorParticles(prev => {
          const newMap = new Map(prev);
          newMap.set(randomParticle.id, {
            startTime: Date.now(),
            startX,
            startY,
            direction: randomDirection,
          });
          return newMap;
        });
        
        console.log(`✨ 流星出现：${randomParticle.id}，方向：${directionNames[randomDirection]}`);
        
        // 流星消失后，原粒子在新随机位置重生。
        setTimeout(() => {
          // 生成新的随机位置（确保与当前位置不同）
          let newX, newY;
          do {
            newX = Math.random();
            newY = Math.random();
          } while (Math.abs(newX - currentX) < 0.2 && Math.abs(newY - currentY) < 0.2); // 确保新位置距离当前位置足够远
          
          // 更新粒子位置
          setParticlePositionOverrides(prev => {
            const newMap = new Map(prev);
            newMap.set(randomParticle.id, { x: newX, y: newY });
            return newMap;
          });
          
          // 移除流星标记
          setMeteorParticles(prev => {
            const newMap = new Map(prev);
            newMap.delete(randomParticle.id);
            return newMap;
          });
          
          console.log(`🌟 流星消失，粒子在新位置重生：${randomParticle.id}，位置：(${(newX * 100).toFixed(1)}%, ${(newY * 100).toFixed(1)}%)`);
        }, 1200);
      }
    }
  }, [particleSequences]);

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
        triggerMeteor();
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
  }, [triggerMeteor]);

  // 处理爱心点击
  const handleLoveClick = () => {
    setIsLoved(true);
    setShowQRCode(true);
  };

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
            zIndex: welcomePhase === 'complete' ? 5 : 100,  // 完成后降到背景上方、emoji下方
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
              
              // 最终位置
              const finalBottom = isFirstLine ? 5 : 3; // 第1句5rem，最后1句3rem
              
              return (
                <div
                  key={index}
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
                      animation: `welcomeLineAppear ${getLineFadeInDuration(index)}s ease-out ${getLineStartTime(index)}s forwards`,
                    }),
                    // 阶段2：所有诗句逐行淡出（每行延迟0.2秒）
                    ...(welcomePhase === 'sliding' && {
                      top: `${initialTop}%`,  // 保持在原位置
                      bottom: 'auto',
                      opacity: 0.9,
                      fontSize: welcomeFontSize,
                      fontFamily: 'QianTuBiFeng, sans-serif',
                      color: '#ffd700',
                      transform: 'translateX(-50%)',
                      animation: `welcomeLineFadeOut 1.5s ease-out ${index * 0.2}s forwards`,
                    }),
                    // 阶段3：只有第1句和最后1句从底部淡入
                    ...(welcomePhase === 'complete' && shouldKeep && {
                      bottom: `${finalBottom}rem`,
                      opacity: 0,
                      fontSize: bottomPoemFontSize,
                      transform: 'translateX(-50%)',
                      animation: `welcomeLineFadeInBottom 1.5s ease-out ${isFirstLine ? 0 : 1.4}s forwards`,
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
                  position: 'absolute',
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
                  position: 'absolute',
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

      {/* 黎明渐变背景层 - 0-3秒淡入 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'linear-gradient(180deg, #0a0e27 0%, #1a1a3e 100%)',
          opacity: 0,
          animation: isMobile
            ? 'backgroundFadeIn3s 3s ease-out forwards'
            : 'backgroundFadeIn3s 3s ease-out forwards, dawnGradient 40s ease-in-out 3s infinite',
          zIndex: 0,
        }}
      />

      {/* 光芒层 - 1-5秒淡入 */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none', overflow: 'hidden', opacity: 0, animation: 'glowLayerFadeIn 4s ease-out 1s forwards' }}>
        {/* 核心光芒 */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: isMobile ? '120vw' : '150vw',
            height: isMobile ? '120vh' : '150vh',
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(255, 215, 0, ${isMobile ? 0.09 : 0.15}) 0%, transparent 70%)`,
            filter: `blur(${isMobile ? 28 : 60}px)`,
            animation: isMobile ? 'none' : 'glow 12s ease-in-out 5s infinite',
            willChange: isMobile ? 'auto' : 'transform, opacity',
            backfaceVisibility: 'hidden',
          }}
        />
        {/* 第二层光芒 */}
        {!isMobile && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '180vw',
              height: '180vh',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255, 215, 0, 0.1) 0%, transparent 70%)',
              filter: 'blur(80px)',
              animation: 'glowSlow 18s ease-in-out 5s infinite',
              willChange: 'transform, opacity',
              backfaceVisibility: 'hidden',
            }}
          />
        )}
        {/* 第三层光芒 */}
        {!isMobile && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '200vw',
              height: '200vh',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255, 215, 0, 0.08) 0%, transparent 70%)',
              filter: 'blur(100px)',
              animation: 'glowSlowest 25s ease-in-out 5s infinite',
              willChange: 'transform, opacity',
              backfaceVisibility: 'hidden',
            }}
          />
        )}
      </div>

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
          zIndex: poemData ? 10 : 30, // 诗句框显示时降到后面，隐藏时恢复到前面
          pointerEvents: 'none',
        }}
      >
        {selectedEmojis.map((item, index) => {
          const glowColor = generateGlowColors[index];
          const glowDuration = emojiGlowDurations[index];
          const glowSize = emojiGlowSizes[index];
          const initialPos = emojiInitialPositions[index];
          const physics = emojiPhysics[index];
          
          // PC端使用物理引擎，移动端使用CSS动画
          const usePhysics = !isMobile && physicsEnabled && physics;
          
          return (
            <button
              key={index}
              onClick={() => handleEmojiClick(item.keyword, item.mood)}
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
                filter: `drop-shadow(0 0 ${glowSize.minSize}px rgba(${glowColor}, ${glowSize.minOpacity}))`,
                animation: emojisVisible 
                  ? isMobile
                    ? `emojiSimpleFadeIn ${isSkipped ? '1.2s' : '1.8s'} ease-out forwards`
                    : `emojiSimpleFadeIn ${isSkipped ? '2s' : '3s'} ease-out forwards, emojiGlow-${index} ${glowDuration}s ease-in-out ${isSkipped ? '2s' : '3s'} infinite`
                  : 'none',
                transition: 'filter 0.3s ease',
                willChange: usePhysics ? 'transform, filter' : isMobile ? 'opacity' : 'filter',
              }}
              onMouseEnter={(e) => {
                // PC端：增强辉光效果
                if (!isMobile) {
                  e.currentTarget.style.filter = `drop-shadow(0 0 ${glowSize.maxSize * 1.5}px rgba(${glowColor}, ${glowSize.maxOpacity * 1.2}))`;
                  // 暂停emoji移动
                  setHoveredEmojiIndex(index);
                  console.log(`🖱️ 鼠标悬停: ${item.emoji} ${item.mood} (暂停移动)`);
                }
              }}
              onMouseLeave={(e) => {
                // PC端：恢复辉光效果
                if (!isMobile) {
                  e.currentTarget.style.filter = `drop-shadow(0 0 ${glowSize.minSize}px rgba(${glowColor}, ${glowSize.minOpacity}))`;
                  // 恢复emoji移动
                  setHoveredEmojiIndex(null);
                  console.log(`🖱️ 鼠标离开: ${item.emoji} ${item.mood} (恢复移动)`);
                }
              }}
              onTouchStart={(e) => {
                // 移动端：触摸时不暂停，直接触发点击
                e.preventDefault();
              }}
              title={item.mood}
            >
              {item.emoji}
            </button>
          );
        })}
        
        {/* 动态生成每个emoji的辉光呼吸动画（仅桌面端使用） */}
        {!isMobile && (
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
            className="poem-display bg-black/40 backdrop-blur-md rounded-2xl p-8 max-w-2xl"
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
              
              {/* 爱心按钮区域 - 根据诗句长度动态显示 */}
              {showLoveButton && (
                <div className="flex items-center gap-1.5">
                  {/* 提示文字 - 高光划过效果 */}
                  {!isLoved && (
                    <span
                      className="love-hint-text"
                      style={{
                        fontSize: '0.875rem',
                        color: 'rgba(255, 215, 0, 0.8)',
                        fontFamily: 'QianTuBiFeng, sans-serif',
                        whiteSpace: 'nowrap',
                        animation: 'loveHintFadeIn 0.8s ease-out 1.5s forwards, loveHintShine 2.5s linear 2.5s infinite',
                        opacity: 0,
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      喜欢就点个赞吧！
                    </span>
                  )}
                  
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
                </div>
              )}
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
