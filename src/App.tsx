import { useState, useMemo } from 'react';
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
  const [showWelcome, setShowWelcome] = useState(true);
  const [emojisVisible, setEmojisVisible] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [poemData, setPoemData] = useState<{
    content: string;
    poem_title: string;
    author: string;
  } | null>(null);

  // 入场诗句
  const welcomeLines = [
    '在AI的时代',
    '做一件AI做不了的小事',
    '读一句诗  读一首诗',
    '让意识流淌过',
    '让感受激发出',
    '穿越  翱翔  跋涉  漂浮  ……',
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
    
    // 23秒后隐藏欢迎屏幕
    setTimeout(() => {
      setShowWelcome(false);
    }, 23000);
  }, []);

  // 🌟 粒子系统 - 使用 useMemo 缓存，避免闪烁
  const particleSequences = useMemo(() => {
    const animations = ['pulse', 'float', 'twinkle'];
    
    const generateParticles = (count: number, baseDelay: number, delayRange: number) => {
      return Array.from({ length: count }, (_, i) => ({
        id: `${baseDelay}-${i}`,
        randomAnim: animations[Math.floor(Math.random() * animations.length)],
        fadeInDelay: baseDelay + Math.random() * delayRange,
        duration: 20 + Math.random() * 40, // 20-60秒
        size: 0.8 + Math.random() * 2.5,
        opacity: 0.15 + Math.random() * 0.4,
        left: Math.random() * 100,
        top: Math.random() * 100,
        animDelay: 0,
      }));
    };
    
    const seq1 = generateParticles(25, 0, 3);      // 0-3秒
    const seq2 = generateParticles(25, 3, 3);      // 3-6秒
    const seq3 = generateParticles(30, 6, 4);      // 6-10秒
    
    // 计算动画延迟
    [...seq1, ...seq2, ...seq3].forEach(p => {
      p.animDelay = p.fadeInDelay + (Math.random() * 5);
    });
    
    return { seq1, seq2, seq3 };
  }, []); // 空依赖数组 - 只计算一次

  // AI 调用核心逻辑
  const handleEmojiClick = async (keyword: string, mood: string) => {
    console.log('🎭 点击了 Emoji:', { keyword, mood });
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

  // 27 个 Emoji 的随机分布位置
  const positions = [
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

  return (
    <div className="app-container min-h-screen relative overflow-hidden">
      {/* 入场欢迎屏幕 */}
      {showWelcome && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'linear-gradient(180deg, #0a0e27 0%, #1a1a3e 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: welcomePhase === 'complete' ? 'welcomeFadeOut 3s ease-out forwards' : 'none',
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
              const initialTop = 25 + index * 4; // 初始位置：25%, 29%, 33%...（间隔4%）
              const finalBottom = 2 + index * 2; // 下滑后位置：保持原顺序（第1行在底部2rem，第8行在16rem）
              
              return (
                <div
                  key={index}
                  className={`welcome-line-${index}`}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    fontSize: '2.0rem',
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
            {welcomePhase === 'complete' && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '33%',
                  transform: 'translateX(-50%)',
                  fontSize: '1.3rem',
                  fontFamily: 'QianTuBiFeng, sans-serif',
                  color: 'rgba(255, 215, 0, 0.8)',
                  textAlign: 'center',
                  opacity: 0,
                  animation: 'welcomeLineAppear 2s ease-out forwards',
                }}
              >
                在每一个瞬间的情绪里  都藏着一句等待被唤醒的诗
              </div>
            )}
          </div>
        </div>
      )}

      {/* 背景呼吸层 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'linear-gradient(180deg, #0a0e27 0%, #1a1a3e 100%)',
          animation: 'backgroundBreath 30s ease-in-out infinite',
          zIndex: 0,
        }}
      />

      {/* 光芒层 - 3层不同速度的光芒 */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none', overflow: 'hidden' }}>
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
            animation: 'glow 12s ease-in-out infinite',
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
            animation: 'glowSlow 18s ease-in-out infinite',
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
            animation: 'glowSlowest 25s ease-in-out infinite',
            willChange: 'transform, opacity',
            backfaceVisibility: 'hidden',
          }}
        />
      </div>

      {/* 粒子容器 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2,
          pointerEvents: 'none',
          overflow: 'hidden',
          contain: 'layout style paint',
        }}
      >
        {/* 序列1粒子 */}
        {particleSequences.seq1.map((particle) => (
          <div
            key={`particle-seq1-${particle.id}`}
            style={{
              position: 'absolute',
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              borderRadius: '50%',
              background: 'rgba(255, 215, 0, 0.8)',
              boxShadow: `0 0 ${particle.size * 2.5}px rgba(255, 215, 0, 0.6)`,
              opacity: 0,
              willChange: 'transform, opacity',
              backfaceVisibility: 'hidden',
              animation: `particleFadeIn 2s ease-out ${particle.fadeInDelay}s forwards, ${particle.randomAnim} ${particle.duration}s cubic-bezier(0.4, 0, 0.2, 1) ${particle.animDelay}s infinite`,
            }}
          />
        ))}
        {/* 序列2粒子 */}
        {particleSequences.seq2.map((particle) => (
          <div
            key={`particle-seq2-${particle.id}`}
            style={{
              position: 'absolute',
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              borderRadius: '50%',
              background: 'rgba(255, 215, 0, 0.8)',
              boxShadow: `0 0 ${particle.size * 2.5}px rgba(255, 215, 0, 0.6)`,
              opacity: 0,
              willChange: 'transform, opacity',
              backfaceVisibility: 'hidden',
              animation: `particleFadeIn 2s ease-out ${particle.fadeInDelay}s forwards, ${particle.randomAnim} ${particle.duration}s cubic-bezier(0.4, 0, 0.2, 1) ${particle.animDelay}s infinite`,
            }}
          />
        ))}
        {/* 序列3粒子 */}
        {particleSequences.seq3.map((particle) => (
          <div
            key={`particle-seq3-${particle.id}`}
            style={{
              position: 'absolute',
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              borderRadius: '50%',
              background: 'rgba(255, 215, 0, 0.8)',
              boxShadow: `0 0 ${particle.size * 2.5}px rgba(255, 215, 0, 0.6)`,
              opacity: 0,
              willChange: 'transform, opacity',
              backfaceVisibility: 'hidden',
              animation: `particleFadeIn 2s ease-out ${particle.fadeInDelay}s forwards, ${particle.randomAnim} ${particle.duration}s cubic-bezier(0.4, 0, 0.2, 1) ${particle.animDelay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Emoji 按钮区域 */}
      <div className="emoji-container" style={{ position: 'relative', zIndex: 10 }}>
        {EMOJI_MOODS.map((item, index) => {
          // 为每个 Emoji 计算入场方向和延迟
          const sides = ['top', 'right', 'bottom', 'left'];
          const side = sides[index % 4];
          
          return (
            <button
              key={index}
              onClick={() => handleEmojiClick(item.keyword, item.mood)}
              className="emoji-btn absolute text-5xl cursor-pointer hover:scale-110 transition-transform"
              style={{
                top: positions[index].top,
                left: positions[index].left,
                transform: 'translate(-50%, -50%)',
                opacity: emojisVisible ? 1 : 0,
                animation: emojisVisible 
                  ? `emojiSlideIn${side.charAt(0).toUpperCase() + side.slice(1)} 2s ease-out ${index * 0.1}s forwards`
                  : 'none',
              }}
              title={item.mood}
            >
              {item.emoji}
            </button>
          );
        })}
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
