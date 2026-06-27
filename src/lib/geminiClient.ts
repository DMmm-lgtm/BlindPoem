// 调用后端 Vercel Serverless Function（安全方案）
// API Key 不再暴露在前端，而是存储在 Vercel 环境变量中

// 定义返回数据类型
export interface PoemResponse {
  content: string;      // 诗句内容（≤30字）
  poem_title: string;   // 诗名
  author: string;       // 作者
}

/**
 * 根据心情关键词生成诗句（调用后端 Vercel Function）
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
    console.log('⏳ 开始调用后端 API（12秒超时）...');

    // 调用后端 Vercel Serverless Function（API Key 隐藏在后端）
    const response = await fetch('/api/generate-poem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keyword, moodName }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log('📥 收到后端响应，状态码:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: '后端响应错误' }));
      throw new Error(errorData.message || `后端 API 调用失败: ${response.status}`);
    }

    const poemData: PoemResponse = await response.json();
    console.log('✅ 诗句生成成功:', poemData);

    // 验证返回数据
    if (!poemData.content || !poemData.poem_title || !poemData.author) {
      throw new Error('返回数据不完整');
    }

    return poemData;
  } catch (error) {
    clearTimeout(timeoutId);

    // 检查是否是超时错误
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ API 请求超时（12秒）');
      throw new Error('API_TIMEOUT');
    }

    console.error('❌ 后端 API 调用失败：', error);
    throw error;
  }
}
