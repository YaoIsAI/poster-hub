/**
 * LLM 驱动的海报生成器
 * 
 * 核心思路：用 LLM 生成自适应 CSS，而不是硬编码模板。
 * LLM 根据内容长度、布局要求，设计最优的字体大小和排版。
 */

const https = require('https');
const httpsGet = (url) => new Promise((resolve, reject) => {
  https.get(url, { headers: { 'User-Agent': 'PosterHub/1.0' }, timeout: 15000 }, res => {
    if (res.statusCode !== 200) { reject(new Error(res.statusCode)); return; }
    let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
  }).on('error', reject).on('timeout', () => reject(new Error('超时')));
});

// 从 VoltAgent awesome-design-md 加载设计系统
async function fetchDesignMd(template) {
  try {
    const url = `https://api.github.com/repos/VoltAgent/awesome-design-md/contents/design-md/${template}/DESIGN.md`;
    const GH_TOKEN = process.env.GITHUB_TOKEN || '';
    const opts = {
      headers: {
        'User-Agent': 'PosterHub/1.0',
        'Accept': 'application/vnd.github.v3.raw',
        ...(GH_TOKEN ? { 'Authorization': `token ${GH_TOKEN}` } : {}),
      }
    };
    return new Promise((resolve, reject) => {
      https.get(url, opts, res => {
        if (res.statusCode !== 200) { resolve(null); return; }
        let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
      }).on('error', resolve).on('timeout', () => resolve(null));
    });
  } catch (e) { return null; }
}

// 解析 VoltAgent DESIGN.md
function parseDesignTokens(md) {
  if (!md) return null;
  const tokens = { colors: {}, typography: {}, spacing: [], shadows: [], mood: '' };
  
  // 提取颜色
  const hexMatches = md.matchAll(/#[0-9a-fA-F]{6,8}/g);
  for (const m of hexMatches) {
    if (!tokens.colors.primary && !tokens.colors.bg) {
      tokens.colors.primary = m[0];
    }
  }
  
  // 提取 key colors
  const primaryMatch = md.match(/(?:primary|accent)[- ]?color[:\s]*[\[：]?\s*(#[0-9a-fA-F]{3,8})/i);
  if (primaryMatch) tokens.colors.primary = primaryMatch[1];
  
  // 提取 bg
  const bgMatch = md.match(/background[:\s]*[\[：]?\s*(#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\))/i);
  if (bgMatch) tokens.colors.bg = bgMatch[1];
  
  // 提取字体
  const fontMatch = md.match(/font[- ]?family[:\s]*['"]([^'"]+)['"]/i);
  if (fontMatch) tokens.typography.font = fontMatch[1];
  
  // 提取间距
  const spacingMatch = md.match(/(?:spacing|scale)[:\s]*[\[：]?\s*(\d+(?:\s*[\/,]\s*\d+)+)\s*(?:px)?/i);
  if (spacingMatch) tokens.spacing = spacingMatch[1].split(/[\/,]\s*/).map(Number).filter(Boolean);
  
  // 提取阴影
  const shadowMatch = md.match(/box[- ]?shadow[:\s]*(var\(--[^)]+\)|rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}[^;]*)/gi);
  if (shadowMatch) tokens.shadows = shadowMatch.slice(0, 3).map(s => s.replace(/^box[- ]?shadow[:\s]*/i, ''));
  
  // 提取 mood
  const moodMatch = md.match(/##\s*1\.\s*[Vv]isual.*?\n([\s\S]{10,200}?)(?=##)/);
  if (moodMatch) tokens.mood = moodMatch[1].trim().substring(0, 200);
  
  return tokens;
}

// 用 LLM 生成自适应 HTML/CSS
async function generateWithLLM({ hero, sections, stats, footer, theme, lang }) {
  const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
  const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.minimaxi.com/v1';
  const LLM_MODEL = process.env.LLM_MODEL || 'MiniMax-M2.1';
  
  const isZh = lang === 'zh' || !hero.subtitle || /[\u4e00-\u9fa5]/.test(hero.subtitle);
  
  // 构建设计说明
  const designNote = theme && theme.name !== 'Apple极简'
    ? `\n设计风格: ${theme.name}\n` 
    : '\n设计风格: Apple极简主义（纯白背景，专业SaaS感）\n';

  // 根据内容长度决定布局
  const heroTitleLen = (hero.title || '').length;
  const heroSubtitleLen = (hero.subtitle || '').length;
  const cardCount = sections.reduce((sum, s) => sum + (s.items ? s.items.length : 0), 0);
  const longestCardTitle = sections.flatMap(s => s.items || []).reduce((max, i) => 
    Math.max(max, (i.title || i.name || '').length), 0);

  // 构建内容 JSON
  const contentJson = JSON.stringify({ hero, sections, stats, footer, cardCount, longestCardTitle }, null, 2);

  const prompt = `你是一个专业的海报设计师。请为以下项目生成一张高质量的HTML/CSS海报。

【内容信息】
${contentJson}

【设计约束】
- 海报宽度: 780px（固定）
- 海报高度: 根据内容自适应（不是固定值）
- 布局: ${cardCount <= 4 ? '2列网格' : cardCount <= 6 ? '2-3列网格' : '3列网格'}
- 语言: ${isZh ? '中文（主要）' : '英文（主要）'}

${designNote}

【字体规则（关键）】
根据内容长度自动调整字体大小：
- 主标题: 长度为${heroTitleLen}字符 → 建议字号 ${heroTitleLen > 20 ? '48' : heroTitleLen > 10 ? '64' : '76'}px
- 副标题: 长度为${heroSubtitleLen}字符 → 建议字号 ${heroSubtitleLen > 30 ? '22' : '28'}px
- 卡片标题: 最长${longestCardTitle}字符 → 建议字号 ${longestCardTitle > 15 ? '18' : '22'}px，必须text-overflow:ellipsis或自动换行
- 卡片描述: 必须设置line-clamp限制行数，或设置合理的min-height

【自适应规则（关键）】
1. 所有文本元素必须能处理长内容，不能溢出容器
2. 卡片使用flex布局，标题用flex:1和min-width:0约束
3. card-name类必须设置overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%
4. 或者：不限制white-space，让文本自然换行（推荐长标题）
5. 统计数字使用font-size而非固定px，根据数字长度调整
6. hero-title使用clamp()函数实现响应式字号：font-size: clamp(32px, 8vw, 76px)

【CSS技术要求】
1. 响应式字体: hero-title { font-size: clamp(36px, 7vw, ${heroTitleLen > 20 ? 48 : 76}px); }
2. flex换行: .grid { display: flex; flex-wrap: wrap; gap: 20px; }
3. flex子项: .card { flex: 1 1 calc(50% - 10px); min-width: 200px; max-width: 100%; }
4. 文本溢出: card-name必须设置 overflow:hidden; text-overflow:ellipsis; white-space:nowrap; 
   或者不设置nowrap让自然换行（推荐长标题场景）
5. card-top flex容器: min-width:0 防止flex子项撑破容器

【HTML结构】
<div class="poster">
  <div class="hero">
    <div class="hero-logo">✨ PosterHub</div>
    <div class="hero-badge">...</div>
    <div class="hero-title">...</div>
    <div class="hero-subtitle">...</div>
    <div class="stats-grid">...</div>
  </div>
  <div class="hero-bottom-bar"></div>
  ${sections.map((s, i) => `
  <div class="section">
    <div class="section-head">
      <span class="section-label">${s.label}</span>
      <span class="section-rule"></span>
      <span class="section-count">${s.items ? s.items.length : 0} 项</span>
    </div>
    <div class="grid">
      ${(s.items || []).map(item => `
      <div class="card">
        <div class="card-body">
          ${item.emoji ? '<div class="card-top"><span class="card-emoji">'+item.emoji+'</span><span class="card-name">'+item.title+'</span></div>' : '<div class="card-name">'+item.title+'</div>'}
          ${item.desc ? '<div class="card-desc">'+item.desc+'</div>' : ''}
          ${item.badge ? '<div class="card-footer"><span class="card-badge">'+item.badge+'</span></div>' : ''}
        </div>
      </div>`).join('')}
    </div>
  </div>`).join('')}
  <div class="footer">
    <div class="footer-rule"></div>
    <div class="footer-line1">${footer.line1}</div>
    <div class="footer-line2">${footer.line2}</div>
    <div class="footer-brand">Powered by PosterHub</div>
  </div>
</div>

请生成完整的HTML/CSS，CSS必须包含上述所有自适应规则。

【CSS格式】
- 使用 <style> 标签包裹
- 字体栈: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
- poster 容器 max-width: 780px, margin: 0 auto
- 不要使用 Google Fonts @import
- hero-title 使用 clamp() 实现响应式字号
- .card { flex: 1 1 calc(50% - 10px); min-width: 0; } 实现flex换行

只返回HTML代码，不要有markdown格式，不要有解释。`;

  if (!LLM_API_KEY) {
    console.log('⚠️ 未配置 LLM_API_KEY，使用自适应CSS生成器');
    return generateAdaptiveCSS({ hero, sections, stats, footer, theme, lang });
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
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      console.log('LLM 生成失败，使用自适应CSS');
      return generateAdaptiveCSS({ hero, sections, stats, footer, theme, lang });
    }

    const data = await response.json();
    let html = data.choices?.[0]?.message?.content || '';
    
    // 提取 HTML
    const htmlStart = html.indexOf('<');
    const htmlEnd = html.lastIndexOf('>') + 1;
    if (htmlStart < 0 || htmlEnd <= htmlStart) {
      console.log('LLM 返回无效HTML，使用自适应CSS');
      return generateAdaptiveCSS({ hero, sections, stats, footer, theme, lang });
    }
    
    html = html.substring(htmlStart, htmlEnd);
    
    // 注入响应式字体规则
    const responsiveCSS = `
    <style>
    .hero-title { font-size: clamp(36px, 7vw, ${heroTitleLen > 20 ? 48 : 76}px); word-break: break-word; }
    .card-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
    .card-top { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .card { flex: 1 1 calc(50% - 10px); min-width: 200px; max-width: 100%; box-sizing: border-box; }
    .grid { display: flex; flex-wrap: wrap; gap: 20px; }
    </style>`;
    
    // 在 </head> 前插入响应式CSS
    html = html.replace('</head>', responsiveCSS + '</head>');
    
    console.log('✅ LLM 自适应海报生成成功');
    return html;
    
  } catch (e) {
    console.log('LLM 生成异常:', e.message, '使用自适应CSS');
    return generateAdaptiveCSS({ hero, sections, stats, footer, theme, lang });
  }
}

// 自适应 CSS 生成器（不依赖 LLM 的备选方案）
function generateAdaptiveCSS({ hero, sections, stats, footer, theme, lang }) {
  const t = theme || {};
  const isZh = lang === 'zh' || !hero.subtitle || /[\u4e00-\u9fa5]/.test(hero.subtitle);
  
  const heroTitleLen = (hero.title || '').length;
  const heroTitleSize = heroTitleLen > 20 ? 48 : heroTitleLen > 10 ? 64 : 76;
  
  const heroSubtitleLen = (hero.subtitle || '').length;
  const heroSubtitleSize = heroSubtitleLen > 40 ? 20 : heroSubtitleLen > 25 ? 24 : 30;
  
  const longestCardTitle = sections.flatMap(s => s.items || []).reduce((max, i) => 
    Math.max(max, (i.title || i.name || '').length), 0);
  const cardNameSize = longestCardTitle > 20 ? 16 : longestCardTitle > 12 ? 18 : 22;
  
  const cardCount = sections.reduce((sum, s) => sum + (s.items ? s.items.length : 0), 0);
  const gridCols = cardCount <= 2 ? '100%' : cardCount <= 4 ? 'calc(50% - 10px)' : 'calc(33.33% - 14px)';
  
  const bgWhite = t.bgWhite || '#FFFFFF';
  const bgGray = t.bgGray || '#F5F5F7';
  const textPrimary = t.textPrimary || '#1D1D1F';
  const textSecondary = t.textSecondary || '#6E6E73';
  const textTertiary = t.textTertiary || '#86868B';
  const divider = t.divider || '#E5E5EA';
  const accent = t.accent || '#1D1D1F';

  const fontStack = "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const date = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  const badge = hero.badge || (isZh ? 'GitHub 项目' : 'GitHub Project');

  return `<!DOCTYPE html>
<html lang="${isZh ? 'zh-CN' : 'en'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${(hero.title || '').replace(/"/g, '&quot;')}</title>
<style>
:root {
  --bg-white: ${bgWhite};
  --bg-gray: ${bgGray};
  --text-primary: ${textPrimary};
  --text-secondary: ${textSecondary};
  --text-tertiary: ${textTertiary};
  --divider: ${divider};
  --accent: ${accent};
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: ${fontStack};
  background: var(--bg-white);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  width: 100%;
}
.poster {
  max-width: 780px;
  margin: 0 auto;
  background: var(--bg-white);
  padding-bottom: 100px;
}
.hero {
  background: var(--bg-white);
  padding: 80px 64px 60px;
}
.hero-logo {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-tertiary);
  letter-spacing: 4px;
  text-transform: uppercase;
  margin-bottom: 32px;
}
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 20px;
  border-radius: 20px;
  background: var(--bg-gray);
  font-size: 18px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 32px;
}
.hero-badge-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #4A90E2;
  flex-shrink: 0;
}
.hero-title {
  font-size: clamp(36px, 7vw, ${heroTitleSize}px);
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.1;
  letter-spacing: -1px;
  margin-bottom: 16px;
  word-break: break-word;
  max-width: 100%;
}
.hero-subtitle {
  font-size: ${heroSubtitleSize}px;
  color: var(--text-secondary);
  font-weight: 400;
  line-height: 1.5;
  margin-bottom: 48px;
  max-width: 100%;
  word-break: break-word;
}
.stats-grid {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.stat-card {
  background: var(--bg-gray);
  border-radius: 16px;
  padding: 24px 20px;
  text-align: center;
  min-width: 120px;
  flex: 1;
}
.stat-num {
  font-size: 36px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1;
  letter-spacing: -1px;
  margin-bottom: 8px;
  word-break: break-word;
}
.stat-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}
.hero-bottom-bar {
  height: 16px;
  background: var(--bg-gray);
}
.section {
  padding: 48px 40px;
  background: var(--bg-white);
}
.section-head {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.section-label {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
  white-space: nowrap;
}
.section-rule {
  flex: 1;
  height: 1px;
  background: var(--divider);
}
.section-count {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-tertiary);
  white-space: nowrap;
}
.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.card {
  background: var(--bg-white);
  border: 1px solid var(--divider);
  border-radius: 16px;
  padding: 20px;
  flex: 1 1 calc(50% - 8px);
  min-width: 0;
  box-sizing: border-box;
}
.card-body {}
.card-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  min-width: 0;
}
.card-emoji {
  font-size: 28px;
  line-height: 1;
  flex-shrink: 0;
}
.card-name {
  font-size: ${cardNameSize}px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  min-width: 0;
}
.card-desc {
  font-size: 15px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 45px;
}
.card-footer {
  display: flex;
  align-items: center;
}
.card-badge {
  display: inline-flex;
  padding: 4px 12px;
  border-radius: 12px;
  background: var(--bg-gray);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}
.footer {
  padding: 60px 40px 0;
  text-align: center;
}
.footer-rule {
  width: 100%;
  height: 1px;
  background: var(--divider);
  margin-bottom: 48px;
}
.footer-line1 {
  font-size: 28px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.3;
  margin-bottom: 12px;
}
.footer-line2 {
  font-size: 16px;
  color: var(--text-tertiary);
  font-weight: 500;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 24px;
}
.footer-brand {
  font-size: 16px;
  color: var(--text-tertiary);
}
</style>
</head>
<body>
<div class="poster">
  <div class="hero">
    <div class="hero-logo">✨ PosterHub</div>
    <div class="hero-badge">
      <span class="hero-badge-dot"></span>
      ${badge}
    </div>
    <div class="hero-title">${hero.title || ''}</div>
    ${hero.subtitle ? `<div class="hero-subtitle">${hero.subtitle}</div>` : ''}
    ${stats && stats.length > 0 ? `
    <div class="stats-grid">
      ${stats.map(s => `
      <div class="stat-card">
        <div class="stat-num">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>`).join('')}
    </div>` : ''}
  </div>
  <div class="hero-bottom-bar"></div>
  ${sections.map(s => `
  <div class="section">
    <div class="section-head">
      <span class="section-label">${s.label}</span>
      <span class="section-rule"></span>
      <span class="section-count">${s.items ? s.items.length : 0} 项</span>
    </div>
    <div class="grid">
      ${(s.items || []).map(item => `
      <div class="card">
        <div class="card-body">
          ${item.emoji ? `<div class="card-top"><span class="card-emoji">${item.emoji}</span><span class="card-name">${item.title || item.name || ''}</span></div>` : `<div class="card-name">${item.title || item.name || ''}</div>`}
          ${item.desc ? `<div class="card-desc">${item.desc}</div>` : ''}
          ${item.badge ? `<div class="card-footer"><span class="card-badge">${item.badge}</span></div>` : ''}
        </div>
      </div>`).join('')}
    </div>
  </div>`).join('')}
  <div class="footer">
    <div class="footer-rule"></div>
    <div class="footer-line1">${footer.line1 || 'Powered by PosterHub'}</div>
    <div class="footer-line2">${footer.line2 || 'github.com/YaoIsAI/poster-hub'}</div>
    <div class="footer-brand">${date}</div>
  </div>
</div>
</body>
</html>`;
}

module.exports = { generateWithLLM, generateAdaptiveCSS, fetchDesignMd, parseDesignTokens };
