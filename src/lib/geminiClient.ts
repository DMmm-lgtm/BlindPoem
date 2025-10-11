// 使用直接 REST API 调用（参考 PersonalPage 的成功实现）
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// 检查环境变量是否配置
if (!API_KEY) {
  throw new Error('缺少 Gemini API Key！请检查 .env.local 文件');
}

// 定义返回数据类型
export interface PoemResponse {
  content: string;      // 诗句内容（≤30字）
  poem_title: string;   // 诗名
  author: string;       // 作者
}

/**
 * 根据心情关键词生成诗句
 * @param keyword 心情关键词（如：happy, sad）
 * @param moodName 心情名称（如：快乐、悲伤）
 * @returns 诗句数据（content, poem_title, author）
 */
export async function generatePoem(
  keyword: string,
  moodName: string
): Promise<PoemResponse> {
  console.log(`🎯 生成诗句 - 关键词: ${keyword}, 心情: ${moodName}`);

  // 创建超时控制器（12秒超时）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    console.log('⏱️ API 请求超时（12秒），将从数据库读取备用诗句');
  }, 12000);

  try {
    console.log('⏳ 开始调用 Gemini API（12秒超时）...');
    
    // 添加随机元素
    const randomSeed = Date.now();
    const randomHints = ['多样性', '创新性', '惊喜感', '独特性', '新鲜感', '趣味性'];
    const randomHint = randomHints[Math.floor(Math.random() * randomHints.length)];
    
    // 创建多个 Prompt 模板，随机选择一个
    const promptTemplates = [
      // 模板1：中文版（倾向中文诗句）
      `你是一位精通中国诗词的推荐者。请根据"${moodName}"这个情绪，推荐一句诗句。

[Request #${randomSeed}] 本次请注重${randomHint}，每次推荐不同的诗句。

要求：
1. 优先推荐中文诗句（古代诗词、现代诗、当代诗均可）
2. 诗句要有意境，富有文学性
3. 可以偶尔推荐英文诗句增加惊喜
4. 请返回 JSON 格式：
{
  "content": "诗句内容",
  "poem_title": "作品名称",
  "author": "作者"
}`,

      // 模板2：英文版（倾向英文诗句）
      `You are an expert poetry recommender. Recommend a line of poetry based on the mood: "${moodName}".

[Request #${randomSeed}] Focus on ${randomHint}, recommend different poems each time.

Requirements:
1. Prefer English poetry (classical, modern, or contemporary)
2. Can occasionally recommend Chinese poetry for surprise
3. The verse should be poetic and literary
4. Return JSON format:
{
  "content": "verse content",
  "poem_title": "work title",
  "author": "author name"
}`,

      // 模板3：现代诗版（倾向现代诗）
      `你是现代诗歌的鉴赏家。请根据"${moodName}"这个情绪，推荐一句现代诗。

[Request #${randomSeed}] 本次请注重${randomHint}。

要求：
1. 优先推荐20世纪至今的现代诗、当代诗
2. 可以是中文或英文
3. 诗句要有现代感、意象丰富
4. 请返回 JSON 格式：
{
  "content": "诗句内容",
  "poem_title": "作品名称",
  "author": "作者"
}`,

      // 模板4：古典诗词版（倾向古代诗词）
      `你是中国古典诗词专家。请根据"${moodName}"这个心情，推荐一句古典诗词。

[Request #${randomSeed}] 本次请注重${randomHint}。

要求：
1. 优先推荐唐诗、宋词、元曲等古典诗词
2. 也可以推荐其他国家的古典诗歌
3. 诗句要典雅、有韵味
4. 请返回 JSON 格式：
{
  "content": "诗句内容",
  "poem_title": "作品名称",
  "author": "作者"
}`,

      // 模板5：混合版（完全随机）
      `You are an expert poetry recommender. 请根据"${moodName}"推荐一句诗。

[Request #${randomSeed}] 本次请求请注重${randomHint}，完全自由发挥。

要求：
1. 可以是任何语言、任何时代的诗句
2. 可以是严肃的经典诗歌，也可以是轻松的网络文学
3. 诗句与"${moodName}"的相关性可以很强，也可以完全无关（制造惊喜）
4. 请返回 JSON 格式：
{
  "content": "诗句内容",
  "poem_title": "作品名称",
  "author": "作者"
}`,
    ];

    // 随机选择一个 Prompt 模板
    const promptTypeNames = ['中文版', '英文版', '现代诗版', '古典诗词版', '混合版'];
    const selectedIndex = Math.floor(Math.random() * promptTemplates.length);
    const fullPrompt = promptTemplates[selectedIndex];
    
    console.log('🎲 随机选择的 Prompt 类型:', promptTypeNames[selectedIndex]);
    console.log('📤 发送提示词:', fullPrompt);

    // 使用 REST API 调用（参考 PersonalPage 的成功实现）
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': API_KEY || '',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          temperature: 1.1,  // 提高到 1.1，增加随机性和多样性
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 512,
          thinkingConfig: {
            thinkingBudget: 0  // 禁用思考功能，加快响应
          }
        }
      }),
      signal: controller.signal  // 添加超时控制信号
    });

    clearTimeout(timeoutId);  // 请求成功，清除超时定时器
    console.log('📥 收到响应，状态码:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API 错误响应:', errorText);
      throw new Error(`API 调用失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('📄 完整 API 响应:', data);

    // 🔢 Token 使用统计
    if (data.usageMetadata) {
      console.log('💰 Token 使用情况:');
      console.log('  - 输入 Token:', data.usageMetadata.promptTokenCount);
      console.log('  - 输出 Token:', data.usageMetadata.candidatesTokenCount);
      console.log('  - 总计 Token:', data.usageMetadata.totalTokenCount);
    }

    // 解析响应（参考 PersonalPage 的方式）
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      console.log('📋 第一个候选结果:', candidate);
      
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        let text = candidate.content.parts[0].text;
        console.log('📄 Gemini 原始文本:', text);
        
        // 清理可能的 markdown 代码块标记
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        console.log('🧹 清理后的文本:', text);
        
        // 尝试提取 JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonStr = jsonMatch[0];
          const poemData: PoemResponse = JSON.parse(jsonStr);
          console.log('✅ JSON 解析成功:', poemData);
          
          // 验证返回数据
          if (!poemData.content || !poemData.poem_title || !poemData.author) {
            throw new Error('AI 返回数据不完整');
          }
          
          console.log('✅ Gemini API 调用成功:', poemData);
          return poemData;
        } else {
          throw new Error('无法从响应中提取 JSON');
        }
      }
    }
    
    throw new Error('无法解析 AI 响应');
  } catch (error) {
    clearTimeout(timeoutId);  // 确保清除定时器
    
    // 检查是否是超时错误
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ Gemini API 请求超时（12秒）');
      throw new Error('API_TIMEOUT');  // 抛出特殊标记，用于触发fallback
    }
    
    console.error('❌ Gemini API 调用失败：', error);
    throw error;
  }
}

