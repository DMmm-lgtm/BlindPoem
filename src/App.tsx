import { useState, useMemo, useEffect, useRef } from 'react';
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
  const [showPrompt, setShowPrompt] = useState(true);  // 控制提示词显示
  
  const [isLoading, setIsLoading] = useState(false);
  const [poemData, setPoemData] = useState<{
    content: string;
    poem_title: string;
    author: string;
  } | null>(null);

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

  // 入场动画时间控制
  useMemo(() => {
    // 8秒：8行诗句淡入完成
    // 停留2秒，让用户欣赏完整诗句
    // 10秒：开始下滑动画
    setTimeout(() => {
      setWelcomePhase('sliding');
    }, 10000);
    
    // 19秒（10秒 + 7秒延迟 + 1.5秒动画 + 0.5秒缓冲）后显示提示词和 Emoji
    setTimeout(() => {
      setWelcomePhase('complete');
      setEmojisVisible(true);
    }, 19000);
    
    // 不再隐藏欢迎屏幕，让入场诗一直保持在背景
    // setTimeout(() => {
    //   setShowWelcome(false);
    // }, 23000);
  }, []);

  // 🌟 三层星空粒子系统（120个粒子）- 使用 useMemo 缓存，避免闪烁
  const particleSequences = useMemo(() => {
    const animations = ['pulse', 'float', 'twinkle'];
    
    // 生成指定层级的粒子
    const generateParticles = (
      count: number, 
      layer: 'front' | 'mid' | 'back',
      baseDelay: number,
      delayRange: number
    ) => {
      // 根据层级设置不同的属性
      const layerConfig = {
        front: { 
          sizeMin: 2, sizeMax: 4,           // 前景：较大
          opacityMin: 0.4, opacityMax: 0.8, // 前景：较亮
          durationMin: 15, durationMax: 30, // 前景：较快
          color: 'rgba(255, 255, 255, ',    // 前景：白色
        },
        mid: { 
          sizeMin: 1.2, sizeMax: 2.5,       // 中景：中等
          opacityMin: 0.25, opacityMax: 0.5, // 中景：中等亮度
          durationMin: 30, durationMax: 50, // 中景：中等速度
          color: 'rgba(200, 220, 255, ',    // 中景：淡蓝白
        },
        back: { 
          sizeMin: 0.5, sizeMax: 1.5,       // 背景：较小
          opacityMin: 0.1, opacityMax: 0.3, // 背景：较暗
          durationMin: 50, durationMax: 80, // 背景：较慢
          color: 'rgba(150, 180, 255, ',    // 背景：偏蓝
        },
      };
      
      const config = layerConfig[layer];
      
      return Array.from({ length: count }, (_, i) => ({
        id: `${layer}-${baseDelay}-${i}`,
        randomAnim: animations[Math.floor(Math.random() * animations.length)],
        fadeInDelay: baseDelay + Math.random() * delayRange,
        duration: config.durationMin + Math.random() * (config.durationMax - config.durationMin),
        size: config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin),
        opacity: config.opacityMin + Math.random() * (config.opacityMax - config.opacityMin),
        color: config.color,
        left: Math.random() * 100,
        top: Math.random() * 100,
        animDelay: 0,
      }));
    };
    
    // 三层粒子：前景40个、中景40个、背景40个（共120个）
    const frontLayer = generateParticles(40, 'front', 0, 3);    // 前景层
    const midLayer = generateParticles(40, 'mid', 1, 4);        // 中景层
    const backLayer = generateParticles(40, 'back', 2, 5);      // 背景层
    
    // 计算动画延迟
    [...frontLayer, ...midLayer, ...backLayer].forEach(p => {
      p.animDelay = p.fadeInDelay + (Math.random() * 5);
    });
    
    return { frontLayer, midLayer, backLayer };
  }, []); // 空依赖数组 - 只计算一次

  // 🎯 Emoji 物理系统 - 碰撞反弹和多彩辉光
  interface EmojiPhysics {
    x: number;          // 当前x位置
    y: number;          // 当前y位置
    vx: number;         // x速度
    vy: number;         // y速度
    rotation: number;   // 旋转角度
    rotationSpeed: number; // 旋转速度
    glowColor: string;  // 辉光颜色
    glowDuration: number; // 辉光周期（15-33秒）
  }

  const [emojiPhysics, setEmojiPhysics] = useState<EmojiPhysics[]>([]);
  const animationFrameRef = useRef<number>(0);
  const emojiSize = 48; // emoji大小（px）

  // 生成多彩辉光颜色
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

  // 初始化emoji物理属性
  useEffect(() => {
    if (emojisVisible && emojiPhysics.length === 0) {
      const physics: EmojiPhysics[] = EMOJI_MOODS.map((_, index) => {
        // 从屏幕外随机位置开始
        const side = Math.floor(Math.random() * 4); // 0上, 1右, 2下, 3左
        let x, y, vx, vy;
        
        const speed = 0.3 + Math.random() * 0.5; // 慢速：0.3-0.8 px/frame
        
        switch(side) {
          case 0: // 从上方进入
            x = Math.random() * window.innerWidth;
            y = -100;
            vx = (Math.random() - 0.5) * speed;
            vy = speed;
            break;
          case 1: // 从右侧进入
            x = window.innerWidth + 100;
            y = Math.random() * window.innerHeight;
            vx = -speed;
            vy = (Math.random() - 0.5) * speed;
            break;
          case 2: // 从下方进入
            x = Math.random() * window.innerWidth;
            y = window.innerHeight + 100;
            vx = (Math.random() - 0.5) * speed;
            vy = -speed;
            break;
          default: // 从左侧进入
            x = -100;
            y = Math.random() * window.innerHeight;
            vx = speed;
            vy = (Math.random() - 0.5) * speed;
        }
        
        return {
          x,
          y,
          vx,
          vy,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 0.5, // 旋转速度
          glowColor: generateGlowColors[index],
          glowDuration: 15 + Math.random() * 18, // 15-33秒
        };
      });
      
      setEmojiPhysics(physics);
    }
  }, [emojisVisible, emojiPhysics.length, generateGlowColors]);

  // 物理引擎 - 更新位置和碰撞检测
  useEffect(() => {
    if (!emojisVisible || emojiPhysics.length === 0) return;

    const damping = 0.85; // 阻尼系数（碰撞后速度保留85%）
    
    const updatePhysics = () => {
      setEmojiPhysics(prevPhysics => 
        prevPhysics.map(emoji => {
          let { x, y, vx, vy, rotation, rotationSpeed } = emoji;
          
          // 更新位置
          x += vx;
          y += vy;
          rotation += rotationSpeed;
          
          // 边界碰撞检测和反弹（带阻尼）
          if (x <= emojiSize / 2) {
            x = emojiSize / 2;
            vx = Math.abs(vx) * damping; // 反弹并减速
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
  }, [emojisVisible, emojiPhysics.length]);

  // AI 调用核心逻辑
  const handleEmojiClick = async (keyword: string, mood: string) => {
    console.log('🎭 点击了 Emoji:', { keyword, mood });
    setShowPrompt(false); // 隐藏提示词
    setIsLoading(true);
    setPoemData(null); // 清空之前的诗句

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
            background: welcomePhase === 'complete' ? 'transparent' : 'linear-gradient(180deg, #0a0e27 0%, #1a1a3e 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: welcomePhase === 'complete' ? 'none' : 'auto',  // 完成后不阻挡交互
            transition: 'background 1s ease-out',
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
              // 计算位置（更紧凑）
              const initialTop = 25 + index * 5; // 初始位置：25%, 29%, 33%...（间隔5%）
              const finalBottom = 2 + index * 2; // 下滑后位置：保持原顺序（第1行在底部2rem，第8行在16rem）
              
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
                    // 阶段1：逐行淡入，停留在初始位置
                    ...(welcomePhase === 'lines' && {
                      top: `${initialTop}%`,
                      opacity: 0,
                      transform: 'translateX(-50%) translateY(-10px)',
                      animation: `welcomeLineAppear 1s ease-out ${index}s forwards`,
                    }),
                    // 阶段2：下滑到底部，顺序倒置（依次执行，每行延迟1秒）
                    ...(welcomePhase === 'sliding' && {
                      top: `${initialTop}%`,  // 明确设置起始位置（保持淡入后的位置）
                      opacity: 0.9,
                      transform: 'translateX(-50%)',
                      // 使用 cubic-bezier(0.42, 0, 0.58, 1) 实现开始慢→中间快→结束慢
                      animation: `welcomeLineSlideDown-${index} 1.5s cubic-bezier(0.42, 0, 0.58, 1) ${index}s forwards`,
                    }),
                    // 阶段3：停留在底部
                    ...(welcomePhase === 'complete' && {
                      bottom: `${finalBottom}rem`,
                      opacity: 0.7,
                      transform: 'translateX(-50%)',
                    }),
                  }}
                >
                  {line}
                </div>
              );
            })}
            
            {/* 操作提示词（下滑完成后显示） */}
            {welcomePhase === 'complete' && showPrompt && (
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
            {welcomePhase === 'complete' && !showPrompt && (
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

      {/* 黎明渐变背景层 - 和入场诗第一句同步淡入 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'linear-gradient(180deg, #0a0e27 0%, #1a1a3e 100%)',
          opacity: 0,
          animation: 'backgroundFadeIn 2s ease-out forwards, dawnGradient 40s ease-in-out 2s infinite',
          zIndex: 0,
        }}
      />

      {/* 光芒层 - 和背景同步淡入 */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none', overflow: 'hidden', opacity: 0, animation: 'backgroundFadeIn 2s ease-out forwards' }}>
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
            animation: 'glow 12s ease-in-out 2s infinite',
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
            animation: 'glowSlow 18s ease-in-out 2s infinite',
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
            animation: 'glowSlowest 25s ease-in-out 2s infinite',
            willChange: 'transform, opacity',
            backfaceVisibility: 'hidden',
          }}
        />
      </div>

      {/* 粒子容器 - 背景淡入完成后开始淡入 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2,
          pointerEvents: 'none',
          overflow: 'hidden',
          contain: 'layout style paint',
          opacity: 0,
          animation: 'particlesFadeIn 3s ease-out 2s forwards',
        }}
      >
        {/* 背景层粒子（最远，最小最暗，蓝色调） */}
        {particleSequences.backLayer.map((particle) => (
          <div
            key={particle.id}
            style={{
              position: 'absolute',
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              borderRadius: '50%',
              background: particle.color + particle.opacity + ')',
              boxShadow: `0 0 ${particle.size * 2}px ${particle.color}0.5)`,
              opacity: 1,
              willChange: 'transform, opacity',
              backfaceVisibility: 'hidden',
              animation: `${particle.randomAnim} ${particle.duration}s cubic-bezier(0.4, 0, 0.2, 1) ${particle.animDelay}s infinite`,
            }}
          />
        ))}
        
        {/* 中景层粒子（中等大小和亮度，淡蓝白色） */}
        {particleSequences.midLayer.map((particle) => (
          <div
            key={particle.id}
            style={{
              position: 'absolute',
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              borderRadius: '50%',
              background: particle.color + particle.opacity + ')',
              boxShadow: `0 0 ${particle.size * 2.5}px ${particle.color}0.6)`,
              opacity: 1,
              willChange: 'transform, opacity',
              backfaceVisibility: 'hidden',
              animation: `${particle.randomAnim} ${particle.duration}s cubic-bezier(0.4, 0, 0.2, 1) ${particle.animDelay}s infinite`,
            }}
          />
        ))}
        
        {/* 前景层粒子（最近，最大最亮，白色） */}
        {particleSequences.frontLayer.map((particle) => (
          <div
            key={particle.id}
            style={{
              position: 'absolute',
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              borderRadius: '50%',
              background: particle.color + particle.opacity + ')',
              boxShadow: `0 0 ${particle.size * 3}px ${particle.color}0.8)`,
              opacity: 1,
              willChange: 'transform, opacity',
              backfaceVisibility: 'hidden',
              animation: `${particle.randomAnim} ${particle.duration}s cubic-bezier(0.4, 0, 0.2, 1) ${particle.animDelay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Emoji 按钮区域 - 物理运动系统 */}
      <div className="emoji-container" style={{ position: 'fixed', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
        {EMOJI_MOODS.map((item, index) => {
          const physics = emojiPhysics[index];
          if (!physics) return null;
          
          const glowColor = generateGlowColors[index];
          
          return (
            <button
              key={index}
              onClick={() => handleEmojiClick(item.keyword, item.mood)}
              className="cursor-pointer"
              style={{
                position: 'absolute',
                left: physics.x,
                top: physics.y,
                transform: `translate(-50%, -50%) rotate(${physics.rotation}deg)`,
                fontSize: '3rem',
                border: 'none',
                background: 'transparent',
                pointerEvents: 'auto',
                filter: `drop-shadow(0 0 20px rgba(${glowColor}, 0.6))`,
                animation: `emojiGlow-${index} ${physics.glowDuration}s ease-in-out infinite`,
                transition: 'filter 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = `drop-shadow(0 0 30px rgba(${glowColor}, 0.9))`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = `drop-shadow(0 0 20px rgba(${glowColor}, 0.6))`;
              }}
              title={item.mood}
            >
              {item.emoji}
            </button>
          );
        })}
        
        {/* 动态生成每个emoji的辉光动画 */}
        <style>{`
          ${EMOJI_MOODS.map((_, index) => {
            const glowColor = generateGlowColors[index];
            return `
              @keyframes emojiGlow-${index} {
                0%, 100% {
                  filter: drop-shadow(0 0 15px rgba(${glowColor}, 0.4));
                }
                50% {
                  filter: drop-shadow(0 0 30px rgba(${glowColor}, 0.8));
                }
              }
            `;
          }).join('\n')}
        `}</style>
      </div>

      {/* 诗句展示区域（中央） */}
      {poemData && (
        <div className="fixed inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="poem-display bg-black/40 backdrop-blur-md rounded-2xl p-8 max-w-2xl pointer-events-auto">
            <p className="text-2xl text-white mb-4 leading-relaxed">
              {poemData.content}
            </p>
            <div className="text-sm text-gold/80">
              <p>《{poemData.poem_title}》</p>
              <p>— {poemData.author}</p>
            </div>
            <button
              onClick={() => setPoemData(null)}
              className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* 加载状态 */}
      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center z-30 pointer-events-none">
          <div className="text-gold text-xl animate-pulse">
            诗意生成中...
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
