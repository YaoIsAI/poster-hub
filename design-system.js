/**
 * VoltAgent DESIGN.md 设计系统解析器
 * 
 * 从 VoltAgent awesome-design-md 仓库加载设计系统，
 * 解析为统一的设计 Token 格式，供海报生成使用。
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

/**
 * 获取 VoltAgent DESIGN.md 文件
 */
async function fetchDesignMd(owner, repo, template, branch = 'main') {
  const GH_TOKEN = process.env.GITHUB_TOKEN || '';
  const auth = GH_TOKEN ? `Authorization: token ${GH_TOKEN}` : '';
  
  return new Promise((resolve, reject) => {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/design-md/${template}/DESIGN.md?ref=${branch}`;
    const options = {
      headers: {
        'User-Agent': 'PosterHub/1.0',
        'Accept': 'application/vnd.github.v3.raw',
        ...(auth ? { 'Authorization': auth } : {}),
      },
      timeout: 15000,
    };
    
    https.get(url, options, (res) => {
      if (res.statusCode === 200) {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      } else if (res.statusCode === 404) {
        resolve(null); // 文件不存在
      } else {
        reject(new Error(`GitHub API ${res.statusCode}`));
      }
    }).on('error', reject).on('timeout', () => reject(new Error('超时')));
  });
}

/**
 * 解析 VoltAgent DESIGN.md，提取设计 Token
 * 
 * 格式基于 Google Stitch DESIGN.md 规范，9个章节：
 * 1. Visual Theme & Atmosphere
 * 2. Color Palette & Roles  
 * 3. Typography Rules
 * 4. Component Stylings
 * 5. Layout Principles
 * 6. Depth & Elevation
 * 7. Do's and Don'ts
 * 8. Responsive Behavior
 * 9. Agent Prompt Guide
 */
function parseDesignMd(markdown) {
  if (!markdown) return null;
  
  const tokens = {
    raw: markdown,
    name: 'Custom',
    description: '',
    colors: {},
    typography: {},
    spacing: {},
    shadows: {},
    layout: {},
    components: {},
  };
  
  // 提取名称
  const nameMatch = markdown.match(/^#\s*(.+)/m);
  if (nameMatch) tokens.name = nameMatch[1].trim();
  
  // 提取描述（第一个段落）
  const sections = markdown.split(/^##\s*/m);
  if (sections[1]) {
    tokens.description = sections[1].split(/^##/m)[0].trim().substring(0, 200);
  }
  
  // 解析颜色 (## Color Palette)
  const colorSection = markdown.match(/##\s*.*[Cc]olor.*\n([\s\S]*?)(?=##|$)/);
  if (colorSection) {
    const colorText = colorSection[1];
    // 匹配格式: - `name`: #hex / rgb(x,x,x) / var(--token)
    const colorMatches = colorText.matchAll(/`([^`]+)`[:\s]*[\[：]?\s*(#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|var\(--[^)]+\))/gi);
    for (const match of colorMatches) {
      tokens.colors[match[1].trim()] = match[2];
    }
    // 也匹配 Key Colors / Primary / Accent 等关键色
    const keyColorMatch = colorText.match(/(?:primary|accent|key)[- ]?color[:\s]*[\[：]?\s*(#[0-9a-fA-F]{3,8}|rgb\([^)]+\))/i);
    if (keyColorMatch) tokens.colors.primary = keyColorMatch[1];
  }
  
  // 解析字体 (## Typography)
  const fontSection = markdown.match(/##\s*.*[Tt]ypo.*\n([\s\S]*?)(?=##|$)/);
  if (fontSection) {
    const fontText = fontSection[1];
    // 匹配 font-family: 'Name', 'Fallback'
    const fontFamilyMatch = fontText.match(/font[- ]?family[:\s]*['"]([^'"]+)['"]/i);
    if (fontFamilyMatch) tokens.typography.fontFamily = fontFamilyMatch[1];
    
    // 匹配 font-size scale
    const sizes = fontText.matchAll(/(\d+)(?:px|rem|em)[^,]*[,/]?\s*(?:line[- ]?height|for|heading|body|small)/gi);
    const sizeValues = [];
    for (const m of sizes) sizeValues.push(parseInt(m[1]));
    if (sizeValues.length > 0) {
      tokens.typography.scale = [...new Set(sizeValues)].sort((a, b) => b - a);
    }
  }
  
  // 解析间距 (## Layout / ## Spacing)
  const spacingSection = markdown.match(/##\s*(?:.*[Ss]pac|.*[Ll]ay).*\n([\s\S]*?)(?=##|$)/);
  if (spacingSection) {
    const spacingText = spacingSection[1];
    const spacingMatches = spacingText.matchAll(/(\d+)(?:px|rem)/g);
    const spacingValues = [];
    for (const m of spacingMatches) spacingValues.push(parseInt(m[1]));
    if (spacingValues.length > 0) {
      tokens.spacing.base = Math.min(...spacingValues);
      tokens.spacing.scale = [...new Set(spacingValues)].sort((a, b) => a - b);
    }
  }
  
  // 解析阴影 (## Depth / ## Shadow)
  const shadowSection = markdown.match(/##\s*.*([Dd]epth|[Ss]had|[Ee]leva).*\n([\s\S]*?)(?=##|$)/);
  if (shadowSection) {
    const shadowText = shadowSection[2] || shadowSection[1];
    const shadowMatches = shadowText.matchAll(/box[- ]?shadow[:\s]*(var\(--[^)]+\)|rgba\([^)]+\)|#[0-9a-fA-F]{3,8}[^;,]*(?:,?\s*(?:rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})){0,4})/gi);
    const shadows = [];
    for (const m of shadowMatches) shadows.push(m[1].trim());
    if (shadows.length > 0) tokens.shadows = shadows;
  }
  
  // 解析布局规则 (## Layout Principles)
  const layoutSection = markdown.match(/##\s*.*[Ll]ayout.*\n([\s\S]*?)(?=##|$)/);
  if (layoutSection) {
    const layoutText = layoutSection[1];
    // 提取 breakpoint
    const bpMatch = layoutText.match(/(\d+)(?:px|rem)/g);
    if (bpMatch) tokens.layout.breakpoints = bpMatch.map(v => parseInt(v));
    // 提取 grid 列数
    const colMatch = layoutText.match(/(\d+)[- ]?(?:col|column)/i);
    if (colMatch) tokens.layout.columns = parseInt(colMatch[1]);
  }
  
  return tokens;
}

/**
 * 将设计 Token 转换为 LLM 友好的 prompt 片段
 */
function designTokensToPrompt(tokens) {
  let prompt = '';
  
  prompt += `\n【设计系统: ${tokens.name}】\n`;
  if (tokens.description) prompt += `${tokens.description}\n`;
  
  if (Object.keys(tokens.colors).length > 0) {
    prompt += '\n颜色:\n';
    for (const [name, value] of Object.entries(tokens.colors)) {
      prompt += `  ${name}: ${value}\n`;
    }
  }
  
  if (tokens.typography.fontFamily) {
    prompt += `\n字体: ${tokens.typography.fontFamily}\n`;
    if (tokens.typography.scale) {
      prompt += `字号: ${tokens.typography.scale.join('px / ')}px\n`;
    }
  }
  
  if (tokens.spacing.scale) {
    prompt += `\n间距: ${tokens.spacing.scale.join('px / ')}px\n`;
  }
  
  if (tokens.shadows.length > 0) {
    prompt += '\n阴影:\n';
    tokens.shadows.slice(0, 3).forEach((s, i) => {
      prompt += `  shadow${i+1}: ${s.substring(0, 80)}\n`;
    });
  }
  
  if (tokens.layout.columns) {
    prompt += `\n布局: ${tokens.layout.columns}列网格\n`;
  }
  
  return prompt;
}

/**
 * 加载设计系统
 * @param {string|null} template - VoltAgent 模板名 (如 'stripe', 'apple', 'vercel')
 * @param {string|null} customDesignMd - 自定义的 DESIGN.md 内容
 */
async function loadDesignSystem(template, customDesignMd = null) {
  // 如果有自定义 DESIGN.md，直接解析
  if (customDesignMd) {
    return parseDesignMd(customDesignMd);
  }
  
  // 如果有模板名，从 VoltAgent 加载
  if (template) {
    try {
      const md = await fetchDesignMd('VoltAgent', 'awesome-design-md', template);
      if (md) {
        const tokens = parseDesignMd(md);
        tokens.name = template;
        return tokens;
      }
    } catch (e) {
      console.log('⚠️ 加载 VoltAgent 设计失败:', e.message);
    }
  }
  
  return null;
}

module.exports = {
  fetchDesignMd,
  parseDesignMd,
  designTokensToPrompt,
  loadDesignSystem,
};
