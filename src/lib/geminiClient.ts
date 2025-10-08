import { GoogleGenerativeAI } from '@google/generative-ai';

// 从环境变量读取 API Key
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// 检查环境变量是否配置
if (!apiKey) {
  throw new Error('缺少 Gemini API Key！请检查 .env.local 文件');
}

// 创建 Gemini AI 客户端
const genAI = new GoogleGenerativeAI(apiKey);

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
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  console.log(`🎯 生成诗句 - 关键词: ${keyword}, 心情: ${moodName}`);

  // 动态生成提示词
  const prompt = `你是一位精通中国古典诗词的诗人。请根据"${moodName}"这个心情，从中国古典诗词中选择一句最贴合的诗句（不超过30字）。

要求：
1. 必须是真实存在的中国古典诗句
2. 诗句要与"${moodName}"这个心情高度契合
3. 返回格式必须是严格的 JSON，不要包含任何 markdown 标记或其他文本

返回格式示例：
{
  "content": "诗句内容",
  "poem_title": "诗名",
  "author": "作者"
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // 清理可能的 markdown 代码块标记
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // 解析 JSON
    const poemData: PoemResponse = JSON.parse(text);

    // 验证返回数据
    if (!poemData.content || !poemData.poem_title || !poemData.author) {
      throw new Error('AI 返回数据不完整');
    }

    console.log('✅ Gemini API 调用成功：', poemData);
    return poemData;
  } catch (error) {
    console.error('❌ Gemini API 调用失败：', error);
    throw error;
  }
}

