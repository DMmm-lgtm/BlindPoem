import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { generatePoem } from './lib/geminiClient';
import { savePoemToDatabase, getRandomPoemFromDatabase } from './lib/poemService';
import './App.css';

// 27 个情绪 Emoji 配置
const EMOJI_MOODS = [
  // 正面情绪
  { emoji: '😊', mood: '快乐', keyword: 'happy' },
  { emoji: '😄', mood: '开心', keyword: 'joyful' },
  { emoji: '🥰', mood: '爱意', keyword: 'loving' },
  { emoji: '😌', mood: '满足', keyword: 'content' },
  { emoji: '🤗', mood: '温暖', keyword: 'warm' },
  { emoji: '😇', mood: '纯真', keyword: 'innocent' },
  { emoji: '🥳', mood: '庆祝', keyword: 'celebratory' },
  { emoji: '😎', mood: '自信', keyword: 'confident' },
  { emoji: '🤩', mood: '惊艳', keyword: 'amazed' },
  
  // 平静情绪
  { emoji: '😴', mood: '困倦', keyword: 'sleepy' },
  { emoji: '🤔', mood: '思考', keyword: 'thoughtful' },
  { emoji: '😶', mood: '平静', keyword: 'calm' },
  { emoji: '🙂', mood: '淡定', keyword: 'peaceful' },
  { emoji: '😑', mood: '无感', keyword: 'neutral' },
  
  // 负面情绪
  { emoji: '😢', mood: '悲伤', keyword: 'sad' },
  { emoji: '😭', mood: '哭泣', keyword: 'crying' },
  { emoji: '😞', mood: '失落', keyword: 'disappointed' },
  { emoji: '😔', mood: '沮丧', keyword: 'dejected' },
  { emoji: '😟', mood: '担忧', keyword: 'worried' },
  { emoji: '😰', mood: '焦虑', keyword: 'anxious' },
  { emoji: '😡', mood: '愤怒', keyword: 'angry' },
  { emoji: '😤', mood: '不满', keyword: 'frustrated' },
  
  // 强烈情绪
  { emoji: '😱', mood: '震惊', keyword: 'shocked' },
  { emoji: '🤯', mood: '崩溃', keyword: 'overwhelmed' },
  { emoji: '😳', mood: '尴尬', keyword: 'embarrassed' },
  { emoji: '🥺', mood: '委屈', keyword: 'pitiful' },
  { emoji: '😵', mood: '眩晕', keyword: 'dizzy' },
];

function App() {
  // 入场动画状态
  const [welcomePhase, setWelcomePhase] = useState<'lines' | 'sliding' | 'complete'>('lines');
  const [showWelcome] = useState(true);  // 入场诗一直保持显示
  const [emojisVisible, setEmojisVisible] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);  // 控制提示词显示（初始为false）
  const [showPromptAnimation, setShowPromptAnimation] = useState(false);  // 控制提示词淡入动画
  
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
  const [meteorParticles, setMeteorParticles] = useState<Map<string, { startTime: number; startX: number; startY: number }>>(new Map());

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

  // 赞赏功能计时器：根据诗句长度动态调整爱心按钮出现时间（每秒1.5个字符，上限15秒）
  useEffect(() => {
    if (poemData) {
      // 计算诗句字符数（去除标点符号后的纯文字长度）
      const pureTextLength = poemData.content.replace(/[，。、；！？\s]/g, '').length;
      
      // 每秒3个字符，转换为毫秒，上限15秒
      const calculatedDuration = (pureTextLength / 3) * 1000;
      const displayDuration = Math.min(calculatedDuration, 15000); // 最大15秒
      
      console.log(`✅ 诗句字符数：${pureTextLength}，爱心按钮将在 ${displayDuration / 1000} 秒后出现`);
      
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
    setTimeout(() => {
      setWelcomePhase('sliding');
    }, 13000);
    
    // 15.9秒：淡出完成后，底部诗句开始淡入
    setTimeout(() => {
      setWelcomePhase('complete');
    }, 15900);
    
    // 16.0秒：Emoji开始淡入（complete后0.1秒）
    setTimeout(() => {
      setEmojisVisible(true);
    }, 16000);
    
    // 21秒：Emoji淡入完成后，提示词开始淡入
    setTimeout(() => {
      setShowPrompt(true);
      setShowPromptAnimation(true);
    }, 21000);
    
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
        breatheDuration: 8 + Math.random() * 12, // 呼吸周期：8-20秒（加快闪烁，原20-60秒）
        breathePhase: Math.random() * Math.PI * 2, // 呼吸动画随机起始相位
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
            
            // 流星终点（右下角外）
            const endX = canvas.width + 100;
            const endY = canvas.height + 100;
            
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

        // 计算呼吸动画的透明度变化（正弦波）
        const breatheTime = elapsedTime - fadeInStart - fadeInDuration;
        const breatheCycle = (breatheTime / particle.breatheDuration) * Math.PI * 2 + particle.breathePhase;
        const breatheOpacity = particle.opacityMin + (particle.opacityMax - particle.opacityMin) * (Math.sin(breatheCycle) * 0.5 + 0.5);

        // 最终透明度 = 淡入进度 × 呼吸透明度
        const finalOpacity = fadeInProgress * breatheOpacity;

        // 计算粒子位置（像素坐标）
        const x = particle.x * canvas.width;
        const y = particle.y * canvas.height;

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
  }, [particleSequences, meteorParticles]);

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
    return EMOJI_MOODS.map(() => colors[Math.floor(Math.random() * colors.length)]);
  }, []);

  // Emoji辉光周期（15-33秒）
  const emojiGlowDurations = useMemo(() => {
    return EMOJI_MOODS.map(() => 15 + Math.random() * 18);
  }, []);

  // Emoji辉光大小范围（每个emoji不同）
  const emojiGlowSizes = useMemo(() => {
    return EMOJI_MOODS.map(() => ({
      minSize: 10 + Math.random() * 8,      // 最小光辉：10-18px
      maxSize: 20 + Math.random() * 12,     // 最大光辉：20-32px
      minOpacity: 0.3 + Math.random() * 0.2, // 最小不透明度：0.3-0.5
      maxOpacity: 0.5 + Math.random() * 0.3, // 最大不透明度：0.5-0.8
    }));
  }, []);

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
  const animationFrameRef = useRef<number>(0);
  const emojiSize = 48;

  // 27个Emoji的初始位置（淡入时使用）
  const emojiInitialPositions = useMemo(() => [
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
  ], []);

  // 初始化emoji物理属性（淡入完成后启动）
  useEffect(() => {
    if (!physicsEnabled && emojiPhysics.length === 0) {
      // 等待emoji淡入完成后启动物理引擎
      setTimeout(() => {
        const physics: EmojiPhysics[] = emojiInitialPositions.map((pos) => {
          // 从当前位置开始
          const x = (parseFloat(pos.left) / 100) * window.innerWidth;
          const y = (parseFloat(pos.top) / 100) * window.innerHeight;
          
          // 超级缓慢的随机速度（0.1-0.3 px/frame）
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.1 + Math.random() * 0.2;
          
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
      }, 21000); // 16秒emoji开始淡入 + 5秒淡入时长
    }
  }, [physicsEnabled, emojiPhysics.length, emojiInitialPositions]);

  // 物理引擎 - 超级缓慢移动和反弹
  useEffect(() => {
    if (!physicsEnabled || emojiPhysics.length === 0) return;

    const damping = 0.92; // 阻尼系数（碰撞后保留92%速度）
    
    const updatePhysics = () => {
      setEmojiPhysics(prevPhysics => 
        prevPhysics.map(emoji => {
          let { x, y, vx, vy, rotation, rotationSpeed } = emoji;
          
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
          
          // 诗句框碰撞检测（如果诗句框存在）
          if (poemData && !isPoemFadingOut) {
            // 估算诗句框的位置和大小（居中显示）
            // 最小宽度 20rem = 320px，最大宽度 42rem = 672px
            // 高度估算：约 300-400px（根据内容动态调整）
            const poemBoxWidth = 500; // 估算平均宽度 (约31rem)
            const poemBoxHeight = 350; // 估算平均高度
            const poemBoxLeft = (window.innerWidth - poemBoxWidth) / 2;
            const poemBoxRight = poemBoxLeft + poemBoxWidth;
            const poemBoxTop = (window.innerHeight - poemBoxHeight) / 2;
            const poemBoxBottom = poemBoxTop + poemBoxHeight;
            
            // 增加一些碰撞缓冲区（让emoji在接近时就反弹）
            const buffer = emojiSize / 2 + 10;
            
            // 检测是否与诗句框碰撞
            const isCollidingLeft = x >= poemBoxLeft - buffer && x <= poemBoxLeft + buffer && y >= poemBoxTop - buffer && y <= poemBoxBottom + buffer;
            const isCollidingRight = x >= poemBoxRight - buffer && x <= poemBoxRight + buffer && y >= poemBoxTop - buffer && y <= poemBoxBottom + buffer;
            const isCollidingTop = y >= poemBoxTop - buffer && y <= poemBoxTop + buffer && x >= poemBoxLeft - buffer && x <= poemBoxRight + buffer;
            const isCollidingBottom = y >= poemBoxBottom - buffer && y <= poemBoxBottom + buffer && x >= poemBoxLeft - buffer && x <= poemBoxRight + buffer;
            
            // 左侧碰撞
            if (isCollidingLeft) {
              x = poemBoxLeft - buffer;
              vx = -Math.abs(vx) * damping;
            }
            // 右侧碰撞
            if (isCollidingRight) {
              x = poemBoxRight + buffer;
              vx = Math.abs(vx) * damping;
            }
            // 顶部碰撞
            if (isCollidingTop) {
              y = poemBoxTop - buffer;
              vy = -Math.abs(vy) * damping;
            }
            // 底部碰撞
            if (isCollidingBottom) {
              y = poemBoxBottom + buffer;
              vy = Math.abs(vy) * damping;
            }
          }
          
          return { ...emoji, x, y, vx, vy, rotation };
        })
      );
      
      animationFrameRef.current = requestAnimationFrame(updatePhysics);
    };
    
    animationFrameRef.current = requestAnimationFrame(updatePhysics);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [physicsEnabled, emojiPhysics.length, poemData, isPoemFadingOut]);

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
        // 记录流星起点
        setMeteorParticles(prev => {
          const newMap = new Map(prev);
          newMap.set(randomParticle.id, {
            startTime: Date.now(),
            startX: randomParticle.x * canvas.width,
            startY: randomParticle.y * canvas.height,
          });
          return newMap;
        });
        
        console.log(`✨ 流星出现：${randomParticle.id}`);
        
        // 2秒后流星消失，粒子重生在新位置
        setTimeout(() => {
          setMeteorParticles(prev => {
            const newMap = new Map(prev);
            newMap.delete(randomParticle.id);
            return newMap;
          });
          
          console.log(`🌟 流星消失，粒子重生：${randomParticle.id}`);
        }, 2000);
      }
    }
  }, [particleSequences, meteorParticles]);

  // 流星效果：定期自动触发（每30秒一次）
  useEffect(() => {
    const meteorInterval = setInterval(() => {
      triggerMeteor();
    }, 30000);

    return () => clearInterval(meteorInterval);
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
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: welcomePhase === 'complete' ? 5 : 100,  // 完成后降到背景上方、emoji下方
            background: 'transparent',  // 完全透明，让背景的星空、光芒和粒子层透过来
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: welcomePhase === 'complete' ? 'none' : 'auto',  // 完成后不阻挡交互
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
                      animation: `welcomeLineFadeInBottom 1.5s ease-out ${isFirstLine ? 0 : 1}s forwards`,
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
        {EMOJI_MOODS.map((item, index) => {
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
                  ? `emojiSimpleFadeIn 5s ease-out forwards, emojiGlow-${index} ${glowDuration}s ease-in-out 5s infinite`
                  : 'none',
                transition: 'filter 0.3s ease',
                willChange: usePhysics ? 'transform, filter' : 'filter',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = `drop-shadow(0 0 ${glowSize.maxSize * 1.5}px rgba(${glowColor}, ${glowSize.maxOpacity * 1.2}))`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = `drop-shadow(0 0 ${glowSize.minSize}px rgba(${glowColor}, ${glowSize.minOpacity}))`;
              }}
              title={item.mood}
            >
              {item.emoji}
            </button>
          );
        })}
        
        {/* 动态生成每个emoji的薄层辉光呼吸动画 */}
        <style>{`
          ${EMOJI_MOODS.map((_, index) => {
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
