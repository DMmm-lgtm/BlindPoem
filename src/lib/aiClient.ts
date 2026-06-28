export interface PoemResponse {
  content: string;      // 诗句内容（≤30字）
  poem_title: string;   // 诗名
  author: string;       // 作者
}

/**
 * 根据心情关键词生成诗句（调用后端 Vercel Function）
 * API Key 只在服务端使用，前端不会暴露密钥。
 */
export async function generatePoem(
  keyword: string,
  moodName: string
): Promise<PoemResponse> {
  console.log(`🎯 生成诗句 - 关键词: ${keyword}, 心情: ${moodName}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    console.log('⏱️ API 请求超时（12秒），将从数据库读取备用诗句');
  }, 12000);

  try {
    const response = await fetch('/api/generate-poem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keyword, moodName }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const poemData: PoemResponse = await response.json();
    console.log('✅ 诗句生成成功:', poemData);

    if (!poemData.content || !poemData.poem_title || !poemData.author) {
      throw new Error('Invalid poem data from API');
    }

    return poemData;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('❌ 诗句生成失败:', error);
    throw error;
  }
}
