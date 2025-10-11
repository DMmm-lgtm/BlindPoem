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
  // 🎲 每次刷新从 100 个中随机选择 27 个 Emoji（保持情绪平衡）
  const selectedEmojis = useMemo(() => {
    // 分类 Emoji（按在数组中的位置）
    const positive = EMOJI_MOODS.slice(0, 35);   // 正面情绪 35个
    const neutral = EMOJI_MOODS.slice(35, 55);   // 平静情绪 20个
    const negative = EMOJI_MOODS.slice(55, 90);  // 负面情绪 35个
    const intense = EMOJI_MOODS.slice(90, 100);  // 强烈情绪 10个
    
    // 从每类中随机选择，保持情绪平衡
    const selected = [
      ...shuffleArray(positive).slice(0, 9),  // 9个正面
      ...shuffleArray(neutral).slice(0, 5),   // 5个中性
      ...shuffleArray(negative).slice(0, 9),  // 9个负面
      ...shuffleArray(intense).slice(0, 4),   // 4个强烈
    ];
    
    // 再次打乱顺序，避免情绪分组显示
    const final = shuffleArray(selected);
    
    console.log('🎲 本次从100个中随机选择的27个 Emoji:', 
      final.map(e => `${e.emoji} ${e.mood}`).join(', ')
    );
    
    return final;
  }, []); // 空依赖数组 - 页面刷新时重新计算

  // 入场动画状态
  const [welcomePhase, setWelcomePhase] = useState<'lines' | 'sliding' | 'complete'>('lines');
  const [showWelcome] = useState(true);  // 入场诗一直保持显示
  const [emojisVisible, setEmojisVisible] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);  // 控制提示词显示（初始为false）
  const [showPromptAnimation, setShowPromptAnimation] = useState(false);  // 控制提示词淡入动画
  
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
  
  // 粒子位置覆盖（用于流星后在新位置重生）
  const [particlePositionOverrides, setParticlePositionOverrides] = useState<Map<string, { x: number; y: number }>>(new Map());

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
      
      // 中文：每秒3个字符，非中文：每秒6个字符
      const chineseDuration = (chineseLength / 3) * 1000;
      const nonChineseDuration = (nonChineseLength / 8) * 1000;
      const calculatedDuration = chineseDuration + nonChineseDuration;
      
      // 上限15秒
      const displayDuration = Math.min(calculatedDuration, 15000);
      
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

  // 🌟 三层星空粒子系统（120个粒子）- 使用 useMemo 缓存，避免闪烁
  const particleSequences = useMemo(() => {
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
    
    // 三层粒子：前景40个、中景40个、背景40个（共120个）
    const frontLayer = generateParticles(40, 'front', 0, 3);    // 前景层
    const midLayer = generateParticles(40, 'mid', 1, 4);        // 中景层
    const backLayer = generateParticles(40, 'back', 2, 5);      // 背景层
    
    return { frontLayer, midLayer, backLayer };
  }, []); // 空依赖数组 - 只计算一次

  // Canvas 粒子系统
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particleAnimationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());

  // Canvas 渲染循环 - 三层粒子呼吸动画
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

    // 渲染循环
    const render = () => {
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
          const meteorDuration = 2; // 流星持续2秒
          
          if (meteorElapsed < meteorDuration) {
            const meteorProgress = meteorElapsed / meteorDuration; // 0-1
            
            // 流星起点
            const startX = meteorInfo.startX;
            const startY = meteorInfo.startY;
            
            // 根据方向计算流星终点（6种随机路径）
            let endX, endY;
            switch (meteorInfo.direction) {
              case 0: // 右下角
                endX = canvas.width + 100;
                endY = canvas.height + 100;
                break;
              case 1: // 左下角
                endX = -100;
                endY = canvas.height + 100;
                break;
              case 2: // 右上角
                endX = canvas.width + 100;
                endY = -100;
                break;
              case 3: // 左上角
                endX = -100;
                endY = -100;
                break;
              case 4: // 正下方
                endX = startX;
                endY = canvas.height + 100;
                break;
              case 5: // 正右方
                endX = canvas.width + 100;
                endY = startY;
                break;
              default:
                endX = canvas.width + 100;
                endY = canvas.height + 100;
            }
            
            // 当前流星位置（线性插值）
            const currentX = startX + (endX - startX) * meteorProgress;
            const currentY = startY + (endY - startY) * meteorProgress;
            
            // 流星透明度（先增强后减弱）
            const meteorOpacity = meteorProgress < 0.2 
              ? meteorProgress * 5  // 0-0.2: 快速增强
              : 1 - (meteorProgress - 0.2) / 0.8; // 0.2-1: 缓慢减弱
            
            // 绘制流星拖尾（多个圆形）
            const trailLength = 8; // 拖尾长度
            for (let i = 0; i < trailLength; i++) {
              const trailProgress = i / trailLength;
              const trailX = currentX - (currentX - startX) * trailProgress * 0.3;
              const trailY = currentY - (currentY - startY) * trailProgress * 0.3;
              const trailOpacity = meteorOpacity * (1 - trailProgress) * 0.6;
              const trailSize = particle.size * (1 + meteorProgress * 2) * (1 - trailProgress * 0.5);
              
              ctx.beginPath();
              ctx.arc(trailX, trailY, trailSize, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(${particle.colorR}, ${particle.colorG}, ${particle.colorB}, ${trailOpacity})`;
              ctx.fill();
              
              // 拖尾光晕
              const trailGlowRadius = trailSize * 2;
              const trailGradient = ctx.createRadialGradient(trailX, trailY, 0, trailX, trailY, trailGlowRadius);
              trailGradient.addColorStop(0, `rgba(${particle.colorR}, ${particle.colorG}, ${particle.colorB}, ${trailOpacity * 0.8})`);
              trailGradient.addColorStop(0.5, `rgba(${particle.colorR}, ${particle.colorG}, ${particle.colorB}, ${trailOpacity * 0.4})`);
              trailGradient.addColorStop(1, `rgba(${particle.colorR}, ${particle.colorG}, ${particle.colorB}, 0)`);
              ctx.fillStyle = trailGradient;
              ctx.beginPath();
              ctx.arc(trailX, trailY, trailGlowRadius, 0, Math.PI * 2);
              ctx.fill();
            }
            
            // 绘制流星主体（更亮更大）
            ctx.beginPath();
            ctx.arc(currentX, currentY, particle.size * (1 + meteorProgress * 2), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${particle.colorR}, ${particle.colorG}, ${particle.colorB}, ${meteorOpacity})`;
            ctx.fill();
            
            // 流星主体光晕
            const meteorGlowRadius = particle.size * (1 + meteorProgress * 2) * 3;
            const meteorGradient = ctx.createRadialGradient(currentX, currentY, 0, currentX, currentY, meteorGlowRadius);
            meteorGradient.addColorStop(0, `rgba(${particle.colorR}, ${particle.colorG}, ${particle.colorB}, ${meteorOpacity})`);
            meteorGradient.addColorStop(0.3, `rgba(${particle.colorR}, ${particle.colorG}, ${particle.colorB}, ${meteorOpacity * 0.6})`);
            meteorGradient.addColorStop(1, `rgba(${particle.colorR}, ${particle.colorG}, ${particle.colorB}, 0)`);
            ctx.fillStyle = meteorGradient;
            ctx.beginPath();
            ctx.arc(currentX, currentY, meteorGlowRadius, 0, Math.PI * 2);
            ctx.fill();
          }
          
          return; // 流星状态下不绘制普通粒子
        }
        
        // 普通粒子绘制
        // 计算淡入进度（基于 fadeInDelay 和层级）
        const fadeInStart = particle.fadeInDelay;
        const fadeInDuration = particle.layer === 'back' ? 3 : particle.layer === 'mid' ? 4 : 5;
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

        // 计算超级缓慢的浮动偏移（圆周运动）
        const driftTime = elapsedTime - fadeInStart - fadeInDuration;
        const driftCycle = (driftTime / particle.driftPeriod) * Math.PI * 2 + particle.driftPhase;
        const driftOffsetX = Math.cos(driftCycle + particle.driftAngle) * particle.driftRadius * fadeInProgress;
        const driftOffsetY = Math.sin(driftCycle + particle.driftAngle) * particle.driftRadius * fadeInProgress;

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
  }, [particleSequences, meteorParticles, particlePositionOverrides]);

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
  }

  const [emojiPhysics, setEmojiPhysics] = useState<EmojiPhysics[]>([]);
  const [physicsEnabled, setPhysicsEnabled] = useState(false);
  const [hoveredEmojiIndex, setHoveredEmojiIndex] = useState<number | null>(null); // 悬停的emoji索引
  const animationFrameRef = useRef<number>(0);
  const emojiSize = 48;

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

  // 🎯 跳过入场动画功能
  const skipWelcomeAnimation = useCallback(() => {
    // 只在入场诗淡入或淡出阶段可以跳过
    if (welcomePhase === 'lines' || welcomePhase === 'sliding') {
      console.log('⏭️ 用户点击跳过入场动画');
      
      // 清除所有入场动画定时器
      welcomeTimersRef.current.forEach(timer => clearTimeout(timer));
      welcomeTimersRef.current = [];
      
      // 直接跳转到底部诗句淡入阶段
      setWelcomePhase('complete');
      
      // 立即触发Emoji淡入
      setEmojisVisible(true);
      
      // Emoji淡入3秒后触发提示词和物理引擎
      const afterSkipTimer = window.setTimeout(() => {
        setShowPrompt(true);
        setShowPromptAnimation(true);
        
        // 如果物理引擎还未启动，立即启动
        if (!physicsEnabled && emojiPhysics.length === 0) {
          const physics: EmojiPhysics[] = emojiInitialPositions.map((pos) => {
            const x = (parseFloat(pos.left) / 100) * window.innerWidth;
            const y = (parseFloat(pos.top) / 100) * window.innerHeight;
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.2 + Math.random() * 0.3;
            
            return {
              x,
              y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              rotation: Math.random() * 360,
              rotationSpeed: (Math.random() - 0.5) * 0.3,
            };
          });
          
          setEmojiPhysics(physics);
          setPhysicsEnabled(true);
          console.log('✅ 跳过后启动物理引擎');
        }
      }, 3000);
      welcomeTimersRef.current.push(afterSkipTimer);
    }
  }, [welcomePhase, physicsEnabled, emojiPhysics.length, emojiInitialPositions]);

  // 初始化emoji物理属性（淡入完成后启动）
  useEffect(() => {
    if (!physicsEnabled && emojiPhysics.length === 0) {
      // 等待emoji淡入完成后启动物理引擎
      setTimeout(() => {
        const physics: EmojiPhysics[] = emojiInitialPositions.map((pos) => {
          // 从当前位置开始
          const x = (parseFloat(pos.left) / 100) * window.innerWidth;
          const y = (parseFloat(pos.top) / 100) * window.innerHeight;
          
          // 缓慢的随机速度（0.2-0.5 px/frame）
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.2 + Math.random() * 0.3;
          
          return {
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 0.3, // 超慢旋转
          };
        });
        
        setEmojiPhysics(physics);
        setPhysicsEnabled(true);
        console.log('✅ 物理引擎已启动（emoji淡入时）');
      }, 15800); // 15.8秒emoji开始淡入时立即启动物理引擎
    }
  }, [physicsEnabled, emojiPhysics.length, emojiInitialPositions]);

  // 物理引擎 - 超级缓慢移动和反弹 + emoji间碰撞
  useEffect(() => {
    if (!physicsEnabled || emojiPhysics.length === 0) return;

    const damping = 0.92; // 阻尼系数（碰撞后保留92%速度）
    const restitution = 0.8; // 弹性系数（碰撞恢复系数）
    
    const updatePhysics = () => {
      setEmojiPhysics(prevPhysics => {
        // 第一步：更新所有emoji的位置
        let newPhysics = prevPhysics.map((emoji, index) => {
          let { x, y, vx, vy, rotation, rotationSpeed } = emoji;
          
          // 如果当前emoji被鼠标悬停，跳过位置更新
          if (index === hoveredEmojiIndex) {
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
        
        // 第二步：检测并处理emoji之间的碰撞
        for (let i = 0; i < newPhysics.length; i++) {
          // 跳过被悬停的emoji
          if (i === hoveredEmojiIndex) continue;
          
          for (let j = i + 1; j < newPhysics.length; j++) {
            // 跳过被悬停的emoji
            if (j === hoveredEmojiIndex) continue;
            
            const emoji1 = newPhysics[i];
            const emoji2 = newPhysics[j];
            
            // 计算两个emoji中心的距离
            const dx = emoji2.x - emoji1.x;
            const dy = emoji2.y - emoji1.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 碰撞检测：如果距离小于两个半径之和
            const minDistance = emojiSize; // 两个emoji的半径之和
            
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
  }, [physicsEnabled, emojiPhysics.length, hoveredEmojiIndex]);

  // 触发流星效果的通用函数
  const triggerMeteor = useCallback(() => {
    const allParticles = [
      ...particleSequences.frontLayer,
      ...particleSequences.midLayer,
      ...particleSequences.backLayer,
    ];
    
    // 过滤出不是流星的粒子
    const availableParticles = allParticles.filter(p => !meteorParticles.has(p.id));
    
    if (availableParticles.length > 0) {
      const randomParticle = availableParticles[Math.floor(Math.random() * availableParticles.length)];
      const canvas = canvasRef.current;
      
      if (canvas) {
        // 获取粒子当前位置（优先使用覆盖位置）
        const positionOverride = particlePositionOverrides.get(randomParticle.id);
        const currentX = positionOverride ? positionOverride.x : randomParticle.x;
        const currentY = positionOverride ? positionOverride.y : randomParticle.y;
        
        // 随机选择流星方向（6种路径）
        const randomDirection = Math.floor(Math.random() * 6);
        const directionNames = ['右下角', '左下角', '右上角', '左上角', '正下方', '正右方'];
        
        // 记录流星起点和方向
        setMeteorParticles(prev => {
          const newMap = new Map(prev);
          newMap.set(randomParticle.id, {
            startTime: Date.now(),
            startX: currentX * canvas.width,
            startY: currentY * canvas.height,
            direction: randomDirection,
          });
          return newMap;
        });
        
        console.log(`✨ 流星出现：${randomParticle.id}，方向：${directionNames[randomDirection]}`);
        
        // 2秒后流星消失，粒子在新随机位置重生
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
        }, 2000);
      }
    }
  }, [particleSequences, meteorParticles, particlePositionOverrides]);

  // 流星效果：定期自动触发（20-60秒随机间隔）
  useEffect(() => {
    let meteorTimer: number;
    
    const scheduleMeteor = () => {
      // 随机生成20-60秒的间隔
      const randomInterval = 20000 + Math.random() * 40000; // 20000-60000毫秒
      console.log(`🌠 下一次流星将在 ${(randomInterval / 1000).toFixed(1)} 秒后出现`);
      
      meteorTimer = window.setTimeout(() => {
        triggerMeteor();
        // 触发后立即安排下一次流星
        scheduleMeteor();
      }, randomInterval);
    };
    
    // 启动第一次流星调度
    scheduleMeteor();

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
      
      // 50%概率触发流星效果
      if (Math.random() < 0.5) {
        triggerMeteor();
        console.log('🌠 诗句淡出时触发流星');
      }
      
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
      
      // 50%概率触发流星效果
      if (Math.random() < 0.5) {
        triggerMeteor();
        console.log('🌠 诗句淡出时触发流星');
      }
      
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
      
      // 50%概率触发流星效果
      if (Math.random() < 0.5) {
        triggerMeteor();
        console.log('🌠 诗句淡出时触发流星');
      }
      
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
            cursor: welcomePhase === 'complete' ? 'default' : 'pointer',  // 可跳过时显示手型
          }}
          title={welcomePhase !== 'complete' ? '点击跳过入场动画' : ''}
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
              const finalBottom = isFirstLine ? 4 : 2; // 第1句4rem，最后1句2rem
              
              return (
                <div
                  key={index}
                  className={`welcome-line-${index}`}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    fontSize: '2.5rem',
                    fontFamily: 'QianTuBiFeng, sans-serif',
                    color: '#ffd700',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
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
                      fontSize: '2.5rem',
                      fontFamily: 'QianTuBiFeng, sans-serif',
                      color: '#ffd700',
                      transform: 'translateX(-50%)',
                      animation: `welcomeLineFadeOut 1.5s ease-out ${index * 0.2}s forwards`,
                    }),
                    // 阶段3：只有第1句和最后1句从底部淡入
                    ...(welcomePhase === 'complete' && shouldKeep && {
                      bottom: `${finalBottom}rem`,
                      opacity: 0,
                      fontSize: '1.8rem',
                      transform: 'translateX(-50%)',
                      animation: `welcomeLineFadeInBottom 1.5s ease-out ${isFirstLine ? 0 : 1.4}s forwards`,
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
                  fontSize: '2.5rem',
                  fontFamily: 'QianTuBiFeng, sans-serif',
                  color: 'rgba(255, 215, 0, 0.8)',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  opacity: 0,
                  animation: 'welcomeLineAppear 2s ease-out forwards',
                }}
              >
                在每一个瞬间的情绪里  都藏着一句等待被唤醒的诗
                <span className="dots-animation">
                  <span className="dot1">.</span>
                  <span className="dot2">.</span>
                  <span className="dot3">.</span>
                </span>
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
                  fontSize: '2.5rem',
                  fontFamily: 'QianTuBiFeng, sans-serif',
                  color: 'rgba(255, 215, 0, 0.8)',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  opacity: 0.9,
                  animation: 'promptFadeOut 0.8s ease-out forwards',
                }}
              >
                在每一个瞬间的情绪里  都藏着一句等待被唤醒的诗
                <span>...</span>
              </div>
            )}
            
            {/* 跳过入场动画提示 */}
            {(welcomePhase === 'lines' || welcomePhase === 'sliding') && (
              <div
                style={{
                  position: 'absolute',
                  right: '2rem',
                  bottom: '2rem',
                  fontSize: '1rem',
                  fontFamily: 'QianTuBiFeng, sans-serif',
                  color: 'rgba(255, 215, 0, 0.5)',
                  textAlign: 'right',
                  opacity: 0,
                  animation: 'skipHintFadeIn 1s ease-out 2s forwards',
                  pointerEvents: 'none',
                }}
              >
                点击屏幕跳过 ⏭️
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
          animation: 'backgroundFadeIn3s 3s ease-out forwards, dawnGradient 40s ease-in-out 3s infinite',
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
            width: '150vw',
            height: '150vh',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 215, 0, 0.15) 0%, transparent 70%)',
            filter: 'blur(60px)',
            animation: 'glow 12s ease-in-out 5s infinite',
            willChange: 'transform, opacity',
            backfaceVisibility: 'hidden',
          }}
        />
        {/* 第二层光芒 */}
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
        {/* 第三层光芒 */}
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
      </div>

      {/* Canvas 粒子系统 - 120个星光粒子 */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2,
          pointerEvents: 'none',
          willChange: 'transform, opacity',
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
          
          // 使用物理位置（如果已启动）或初始位置
          const usePhysics = physicsEnabled && physics;
          
          return (
            <button
              key={index}
              onClick={() => handleEmojiClick(item.keyword, item.mood)}
              className="cursor-pointer"
              style={{
                position: 'absolute',
                // 淡入阶段用百分比位置，物理阶段用像素位置
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
                  ? `emojiSimpleFadeIn 3s ease-out forwards, emojiGlow-${index} ${glowDuration}s ease-in-out 3s infinite`
                  : 'none',
                transition: 'filter 0.3s ease',
                willChange: usePhysics ? 'transform, filter' : 'filter',
              }}
              onMouseEnter={(e) => {
                // 增强辉光效果
                e.currentTarget.style.filter = `drop-shadow(0 0 ${glowSize.maxSize * 1.5}px rgba(${glowColor}, ${glowSize.maxOpacity * 1.2}))`;
                // 暂停emoji移动
                setHoveredEmojiIndex(index);
                console.log(`🖱️ 鼠标悬停: ${item.emoji} ${item.mood} (暂停移动)`);
              }}
              onMouseLeave={(e) => {
                // 恢复辉光效果
                e.currentTarget.style.filter = `drop-shadow(0 0 ${glowSize.minSize}px rgba(${glowColor}, ${glowSize.minOpacity}))`;
                // 恢复emoji移动
                setHoveredEmojiIndex(null);
                console.log(`🖱️ 鼠标离开: ${item.emoji} ${item.mood} (恢复移动)`);
              }}
              title={item.mood}
            >
              {item.emoji}
            </button>
          );
        })}
        
        {/* 动态生成每个emoji的薄层辉光呼吸动画 */}
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
              
              {/* 爱心按钮 - 根据诗句长度动态显示 */}
              {showLoveButton && (
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
          <div className="text-gold text-xl animate-pulse">
            诗意生成中...
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
