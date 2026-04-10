/**
 * 通用海报生成器
 * 
 * 核心思路：用 LLM 生成任意类型的海报 HTML/CSS
 * 支持：文字描述 / 图片 / URL / 模板
 * 风格：微信风格 / 小红书风格 / 演出海报 / 企业宣传 等
 */

const https = require('https');
const httpsGet = (url) => new Promise((resolve, reject) => {
  https.get(url, { headers: { 'User-Agent': 'PosterHub/1.0' }, timeout: 15000 }, res => {
    if (res.statusCode !== 200) { reject(new Error(res.statusCode)); return; }
    let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
  }).on('error', reject).on('timeout', () => reject(new Error('超时')));
});

/**
 * POST /api/prompt
 * 
 * 通用海报生成接口
 * Body: {
 *   prompt: "生成一张微信风格的推广海报，内容是...",
 *   type: "wechat" | "xiaohongshu" | "performance" | "corporate" | "custom",
 *   image?: "url or base64",  // 可选的背景图片
 *   lang?: "zh" | "en",
 *   width?: 780,
 *   customCss?: "自定义 CSS"  // 可选的自定义样式
 * }
 */
async function generateFromPrompt({ prompt, type = 'custom', image, lang = 'zh', width = 780, customCss }) {
  const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
  const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.minimaxi.com/v1';
  const LLM_MODEL = process.env.LLM_MODEL || 'MiniMax-M2.1';
  
  // 风格指南
  const styleGuides = {
    wechat: {
      name: '微信文章卡片',
      desc: '微信公号推文风格，白色背景，红色标题，灰色正文，简洁大方，适合朋友圈传播',
      colors: { bg: '#FFFFFF', primary: '#D34F4F', text: '#333333', secondary: '#888888', accent: '#1AAD19' },
      font: "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
      layout: '居中布局，标题突出，卡片式内容块',
    },
    xiaohongshu: {
      name: '小红书风格',
      desc: '小红书笔记风格，粉色/橙色渐变，卡片圆润，大emoji，年轻人风格',
      colors: { bg: '#FEF2F2', primary: '#FF6B6B', text: '#2D3436', secondary: '#636E72', accent: '#FF9F43', gradient: 'linear-gradient(135deg, #FF6B6B 0%, #FF9F43 100%)' },
      font: "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
      layout: '左图右文或上图下文，圆角卡片，阴影柔和',
    },
    performance: {
      name: '演唱会/演出海报',
      desc: '演唱会海报风格，深色背景，霓虹渐变，大标题高对比，适合活动宣传',
      colors: { bg: '#0D0D0D', primary: '#FFFFFF', text: '#E0E0E0', secondary: '#888888', accent: '#FF2D55', gradient: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)' },
      font: "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
      layout: '全屏沉浸式，大标题居中，时间地点突出，底部CTA按钮',
    },
    corporate: {
      name: '企业宣传海报',
      desc: '企业级专业风格，蓝色主调，白色背景，结构清晰，适合B端展示',
      colors: { bg: '#FFFFFF', primary: '#0052D9', text: '#1D2129', secondary: '#86909C', accent: '#0C66E4', divider: '#E5E6EB' },
      font: "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
      layout: '网格布局，数据突出，卡片分组，层次分明',
    },
    custom: {
      name: '自定义风格',
      desc: '根据你的描述生成最合适的海报',
      colors: { bg: '#FFFFFF', primary: '#1D1D1F', text: '#333333', secondary: '#888888', accent: '#007AFF' },
      font: "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, sans-serif",
      layout: '自由布局',
    }
  };

  const style = styleGuides[type] || styleGuides.custom;
  
  // 构建 LLM prompt
  const llmPrompt = `你是一个专业的海报设计师。请根据用户的描述生成一张高质量的 HTML/CSS 海报。

【海报要求】
"${prompt}"

【风格】${style.name}
${style.desc}

【布局】${style.layout}

【技术约束】
- 海报宽度: ${width}px（固定）
- 高度: 根据内容自适应（不是固定值）
- 语言: ${lang === 'zh' ? '中文（主要）' : '英文（主要）'}
- 字体: ${style.font}

【颜色系统】
背景色: ${style.colors.bg}
主标题色: ${style.colors.primary}
正文色: ${style.colors.text}
辅助色: ${style.colors.secondary}
强调色: ${style.colors.accent}
${style.colors.gradient ? '渐变: ' + style.colors.gradient : ''}

【自适应 CSS 规则（必须遵循）】
1. 响应式标题: .hero-title { font-size: clamp(32px, 8vw, 72px); font-weight: 800; }
2. flex 换行: .grid { display: flex; flex-wrap: wrap; gap: 20px; }
3. flex 子项: .card { flex: 1 1 calc(50% - 10px); min-width: 0; max-width: 100%; box-sizing: border-box; }
4. 文本溢出: .card-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; min-width: 0; }
   或者让长标题自然换行（推荐）
5. card-top flex 容器: .card-top { display: flex; align-items: center; gap: 12px; min-width: 0; }
6. card-name 在 flex 中: .card-name { flex: 1; min-width: 0; }

【图片处理】
${image ? '用户提供了背景图片，使用 <img src="' + image + '"> 嵌入' : '无背景图片，使用纯色或渐变背景'}

【自定义 CSS（可选）】
${customCss ? '用户额外要求：\n' + customCss : '无'}

【HTML 结构示例】
<div class="poster">
  <div class="hero">
    <div class="hero-badge">标签</div>
    <div class="hero-title">主标题</div>
    <div class="hero-subtitle">副标题/描述</div>
    <div class="hero-stats">统计数字</div>
  </div>
  <div class="content">
    <div class="section">
      <div class="section-title">模块标题</div>
      <div class="grid">
        <div class="card">
          <div class="card-body">
            <div class="card-emoji">🎯</div>
            <div class="card-name">功能名称</div>
            <div class="card-desc">功能描述...</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="footer">
    <div class="footer-cta">底部行动号召</div>
    <div class="footer-brand">品牌/来源</div>
  </div>
</div>

请生成完整的 HTML 代码（包含 <style>），只返回 HTML，不要有 markdown 格式，不要有解释。`;

  if (!LLM_API_KEY) {
    throw new Error('未配置 LLM_API_KEY，请先配置');
  }

  try {
    const endpoint = `${LLM_BASE_URL}/chat/completions`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LLM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [{ role: 'user', content: llmPrompt }],
        max_tokens: 8000,
        temperature: 0.5
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    let rawHtml = data.choices?.[0]?.message?.content || '';
    
    // 提取 HTML - 智能处理 LLM thinking 内容
    // MiniMax 的 thinking 内容没有标签包裹，直接以 <think> 开头
    // 策略：找到第一个真正的 HTML 标签开始位置（<style>, <div, <html）
    const stylePos = rawHtml.indexOf('<style>');
    const divPos = rawHtml.indexOf('<div ');
    const htmlPos = rawHtml.indexOf('<html');
    const doctypePos = rawHtml.indexOf('<!DOCTYPE');
    
    // 找最小的有效起始位置
    const positions = [stylePos, divPos, htmlPos, doctypePos].filter(p => p >= 0);
    const htmlStart = positions.length > 0 ? Math.min(...positions) : rawHtml.indexOf('<');
    if (htmlStart > 0) {
      rawHtml = rawHtml.substring(htmlStart);
    }
    
    const htmlEnd = rawHtml.lastIndexOf('>') + 1;
    if (htmlStart < 0 || htmlEnd <= htmlStart) {
      throw new Error('LLM 返回无效 HTML');
    }
    
    let html = rawHtml.substring(0, htmlEnd);
    
    // 注入响应式 CSS（确保自适应规则生效）
    const responsiveCSS = `
<style>
.hero-title { font-size: clamp(32px, 8vw, 72px) !important; word-break: break-word; }
.card-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; min-width: 0; }
.card-top { display: flex; align-items: center; gap: 12px; min-width: 0; }
.card { flex: 1 1 calc(50% - 10px); min-width: 0; max-width: 100%; box-sizing: border-box; }
.grid { display: flex; flex-wrap: wrap; gap: 20px; }
</style>`;
    
    html = html.replace('</head>', responsiveCSS + '</head>');
    
    return { html, style: style.name };
    
  } catch (e) {
    throw new Error(`海报生成失败: ${e.message}`);
  }
}

/**
 * 获取支持的海报类型
 */
function getPosterTypes() {
  return [
    { id: 'wechat', name: '微信风格', desc: '微信公号推文风格，简洁大方，适合朋友圈传播' },
    { id: 'xiaohongshu', name: '小红书风格', desc: '小红书笔记风格，粉色渐变，圆角卡片，年轻人风格' },
    { id: 'performance', name: '演出海报', desc: '演唱会/活动海报，深色背景，霓虹渐变，大标题' },
    { id: 'corporate', name: '企业宣传', desc: '企业级专业风格，蓝色主调，适合B端展示' },
    { id: 'custom', name: '自定义风格', desc: '根据你的描述生成最合适的海报' },
  ];
}

function validatePosterStructure(html) {
  const issues = [];
  if (!html || typeof html !== 'string') {
    return { valid: false, issues: ['HTML 为空或无效'] };
  }

  // 1. 乱码检测：检测连续无意义字符
  const garbledPattern = /[\u4e00-\u9fa5]{10,}/g;
  const chineseChars = (html.match(/[\u4e00-\u9fa5]/g) || []).length;
  const alphaChars = (html.match(/[a-zA-Z]/g) || []).length;
  const digitChars = (html.match(/[0-9]/g) || []).length;
  const totalChars = chineseChars + alphaChars + digitChars;
  // 如果内容中有意义字符占比低于 60%，可能是乱码
  if (totalChars > 100 && totalChars / html.length < 0.4) {
    issues.push('检测到乱码或无意义内容');
  }

  // 2. 内容长度检查
  if (html.length < 500) {
    issues.push(`HTML 内容过短 (${html.length} 字符)，可能生成不完整`);
  }
  if (html.length > 200000) {
    issues.push(`HTML 内容过长 (${Math.round(html.length/1000)}K)，可能包含异常`);
  }

  // 3. 标签完整性检查
  const tagPairs = [
    ['<html', '</html>'],
    ['<head>', '</head>'],
    ['<body>', '</body>'],
    ['<style>', '</style>'],
  ];
  for (const [open, close] of tagPairs) {
    const hasOpen = html.includes(open);
    const hasClose = html.includes(close);
    if (hasOpen && !hasClose) {
      issues.push(`标签未闭合: ${open}`);
    }
  }

  // 4. 样式存在检查
  if (!html.includes('<style') && !html.includes('class=')) {
    issues.push('缺少样式定义');
  }

  // 5. 关键元素存在检查
  const essentialElements = [
    ['.poster', '海报容器'],
    ['class="hero', '英雄区'],
  ];
  for (const [selector, name] of essentialElements) {
    if (!html.includes(selector)) {
      issues.push(`缺少关键元素: ${name}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    stats: {
      length: html.length,
      chineseChars,
      alphaChars,
      digitChars
    }
  };
}

/**
 * Harness 质量检查：HTML 结构完整性验证
 * - 检查标签是否正确闭合
 * - 检查是否有乱码
 * - 检查内容长度是否合理
 * - 检查样式是否存在
 */

module.exports = { generateFromPrompt, getPosterTypes, validatePosterStructure };
