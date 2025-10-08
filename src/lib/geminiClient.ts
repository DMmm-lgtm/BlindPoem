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

  try {
    console.log('⏳ 开始调用 Gemini API...');
    
    // 构建提示词
    const fullPrompt = `你是一位精通中国古典诗词的诗人。请根据"${moodName}"这个心情，从中国古典诗词中选择一句最贴合的诗句（不超过30字）。

要求：
1. 必须是真实存在的中国古典诗句
2. 诗句要与"${moodName}"这个心情高度契合
3. 返回格式必须是严格的 JSON，不要包含任何 markdown 标记或其他文本

请返回 JSON 格式：
{
  "content": "诗句内容",
  "poem_title": "诗名",
  "author": "作者"
}`;

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
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 512,
          thinkingConfig: {
            thinkingBudget: 0  // 禁用思考功能，加快响应
          }
        }
      })
    });

    console.log('📥 收到响应，状态码:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API 错误响应:', errorText);
      throw new Error(`API 调用失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('📄 完整 API 响应:', data);

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
    console.error('❌ Gemini API 调用失败：', error);
    throw error;
  }
}

