require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const { execSync, spawnSync } = require('child_process');
const { generateFromNaturalLanguage, generateFromConfig, THEMES } = require('./generator');
const { scanProjectDir, analyzeWithLLM, analyzeReadmeWithLLM } = require('./local-llm');
const { hiresPoster } = require('./screenshot');
const { generateAdaptiveCSS, generateWithLLM } = require('./poster-generator');
const { generateFromPrompt, getPosterTypes, validatePosterStructure } = require('./prompt-generator');

// ═══════════════════════════════════════════
//  海报生成辅助函数
// ═══════════════════════════════════════════

function formatStars(n) {
  if (!n || n <= 0) return '-';
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function applyDesignSpecToTheme(theme, spec) {
  if (!spec || !theme) return;
  try {
    if (spec.bgColor) theme.bgWhite = spec.bgColor;
    if (spec.bgColorAlt) theme.bgGray = spec.bgColorAlt;
    if (spec.textColor) theme.textPrimary = spec.textColor;
    if (spec.textColorAlt) theme.textSecondary = spec.textColorAlt;
    if (spec.accentColor) theme.accent = spec.accentColor;
    if (spec.dividerColor) theme.divider = spec.dividerColor;
    if (spec.isDark && spec.bgColor) {
      // 深色主题：转换为浅色主题（反色处理）
      // 深色背景(#000) → 浅色背景(#FFF)，深色文字 → 白色文字
      const bg = spec.bgColor.replace('#', '');
      const r = parseInt(bg.slice(0, 2), 16);
      const g = parseInt(bg.slice(2, 4), 16);
      const b = parseInt(bg.slice(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      
      if (luminance < 0.5) {
        // 深色背景 → 反转为浅色背景
        theme.bgWhite = '#FFFFFF';
        theme.bgGray = '#F5F5F7';
        theme.bgCard = '#FFFFFF';
        theme.textPrimary = spec.textColorAlt || '#1D1D1F';
        theme.textSecondary = spec.textColor || '#6E6E73';
        theme.textTertiary = '#86868B';
        theme.divider = spec.dividerColor || '#E5E5EA';
        theme.accent = spec.accentColor || '#1D1D1F';
        console.log('🔄 深色主题已反转为浅色模式');
      }
    }
  } catch (e) {
    console.log('⚠️ applyDesignSpecToTheme 失败:', e.message);
  }
}

const PROJECTS_ROOT = process.env.PROJECTS_ROOT || path.join(__dirname, '..');
function autoDetectLocal(nlText) {
  try {
    // 1. 先在 PROJECTS_ROOT 中匹配（要求更严格：完整包含或首尾匹配）
    if (fs.existsSync(PROJECTS_ROOT)) {
      const dirs = fs.readdirSync(PROJECTS_ROOT).filter(d =>
        fs.statSync(path.join(PROJECTS_ROOT, d)).isDirectory()
      );
      // 严格匹配：nlText 首尾包含目录名，或者目录名首尾包含 nlText（但排除太长/太短的误匹配）
      const matched = dirs.find(d => {
        const nl = nlText.toLowerCase(), dn = d.toLowerCase();
        return (nl.startsWith(dn) || nl.endsWith(dn) || dn.startsWith(nl))
               && nl.length >= 2 && dn.length >= 2;
      });
      if (matched) {
        const root = path.join(PROJECTS_ROOT, matched);
        const info = readProjectInfo(root, matched);
        if (info) return info;
      }
    }

    // 2. 尝试作为绝对路径处理
    const absRoot = path.resolve(nlText.replace(/["']/g, ''));
    if (fs.existsSync(absRoot) && fs.statSync(absRoot).isDirectory()) {
      const folderName = path.basename(absRoot);
      const info = readProjectInfo(absRoot, folderName);
      if (info) return info;
    }

    // 3. 尝试直接读取 nlText 作为目录名（不带路径）
    if (fs.existsSync(nlText) && fs.statSync(nlText).isDirectory()) {
      const folderName = path.basename(nlText);
      const info = readProjectInfo(nlText, folderName);
      if (info) return info;
    }

    return null;
  } catch(e) { return null; }
}

function readProjectInfo(root, name) {
  let readme = '', readmeEn = '';
  for (const f of ['README.md', 'readme.md', 'docs/README.md', 'readme.txt']) {
    const fp = path.join(root, f);
    if (fs.existsSync(fp)) { readme = fs.readFileSync(fp, 'utf8').slice(0, 3000); break; }
  }
  for (const f of ['README_EN.md', 'readme_en.md', 'docs/README_EN.md']) {
    const fp = path.join(root, f);
    if (fs.existsSync(fp)) { readmeEn = fs.readFileSync(fp, 'utf8').slice(0, 3000); break; }
  }

  // 从 README 中提取技术栈
  const readmeAll = readme + readmeEn;
  const techPatterns = [
    { pat: /vue|vue\.js/i, name: 'vue' },
    { pat: /react/i, name: 'react' },
    { pat: /angular/i, name: 'angular' },
    { pat: /svelte/i, name: 'svelte' },
    { pat: /next\.?js/i, name: 'next.js' },
    { pat: /nuxt\.?js/i, name: 'nuxt.js' },
    { pat: /node\.?js|express|koa/i, name: 'node.js' },
    { pat: /typescript|ts/i, name: 'typescript' },
    { pat: /python|flask|django|fastapi/i, name: 'python' },
    { pat: /go|golang/i, name: 'go' },
    { pat: /rust|cargo/i, name: 'rust' },
    { pat: /java(?!script)/i, name: 'java' },
    { pat: /spring/i, name: 'spring' },
    { pat: /postgres|postgresql/i, name: 'postgresql' },
    { pat: /mysql|mariadb/i, name: 'mysql' },
    { pat: /mongodb/i, name: 'mongodb' },
    { pat: /redis/i, name: 'redis' },
    { pat: /sqlite/i, name: 'sqlite' },
    { pat: /docker/i, name: 'docker' },
    { pat: /kubernetes|k8s/i, name: 'kubernetes' },
    { pat: /react\s*native/i, name: 'react native' },
    { pat: /flutter/i, name: 'flutter' },
    { pat: /swift|ios|iphone/i, name: 'swift' },
    { pat: /android/i, name: 'android' },
    { pat: /electron/i, name: 'electron' },
    { pat: /tauri/i, name: 'tauri' },
    { pat: /wasm|webassembly/i, name: 'wasm' },
    { pat: /llm|claude|openai|gpt|gemini|ai|人工智能/i, name: 'ai' },
  ];
  const techs = techPatterns.filter(t => t.pat.test(readmeAll)).map(t => t.name);

  // 尝试从 package.json 补充信息
  const pkgPath = path.join(root, 'package.json');
  let pkgName = '';
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      pkgName = pkg.name || '';
      if (!techs.includes('node.js') && (pkg.dependencies?.express || pkg.dependencies?.koa || pkg.dependencies?.fastify)) {
        techs.push('node.js');
      }
      if (!techs.includes('typescript') && (pkg.dependencies?.typescript || pkg.devDependencies?.typescript)) {
        techs.push('typescript');
      }
    } catch(e) {}
  }

  // 标题：优先用 package.json 的 name，其次用文件夹名
  const title = pkgName || name;

  return { name: title, root, readme, readmeEn, techs: [...new Set(techs)] };
}

// 通过 GitHub API 获取项目完整信息（OpenClaw 学习阶段）
function fetchGitHub(nlText) {
  const match = nlText.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!match) return null;
  const [, owner, repo] = match;
  console.log('🔍 GitHub API: ' + owner + '/' + repo);

  try {
    // 1. 获取 repo 元数据
    const ghToken = process.env.GITHUB_TOKEN || '';
    const authHdr = ghToken ? `-H "Authorization: token ${ghToken}"` : '';
    const apiData = execSync(`curl -sL "https://api.github.com/repos/${owner}/${repo}" -H "Accept: application/json" -H "User-Agent: PosterHub/1.0" ${authHdr} --max-time 10`, { encoding: 'utf8' });
    const info = JSON.parse(apiData);

    // 2. 获取 README（中英文）
    let readme = '', readmeEn = '';
    const readmeFiles = [
      ['README.md', 'readme'], ['README_EN.md', 'readmeEn'], ['README.zh.md', 'readme']
    ];
    for (const [fname, varName] of readmeFiles) {
      for (const branch of ['main', 'master']) {
        try {
          const rd = execSync(`curl -sL "https://api.github.com/repos/${owner}/${repo}/contents/${fname}?ref=${branch}" -H "Accept: application/json" -H "User-Agent: PosterHub/1.0" ${authHdr} --max-time 10`, { encoding: 'utf8' });
          const parsed = JSON.parse(rd);
          if (parsed.content) {
            const content = Buffer.from(parsed.content, 'base64').toString('utf8');
            if (varName === 'readme') readme = content;
            else readmeEn = content;
            break;
          }
        } catch(e) {}
      }
    }

    // 3. 获取 SKILL.md（如果存在）
    let skillMd = '';
    for (const branch of ['main', 'master']) {
      try {
        const rd = execSync(`curl -sL "https://api.github.com/repos/${owner}/${repo}/contents/SKILL.md?ref=${branch}" -H "Accept: application/json" -H "User-Agent: PosterHub/1.0" ${authHdr} --max-time 10`, { encoding: 'utf8' });
        const parsed = JSON.parse(rd);
        if (parsed.content) { skillMd = Buffer.from(parsed.content, 'base64').toString('utf8'); break; }
      } catch(e) {}
    }

    const stars = info.stargazers_count || 0;
    const lang = info.language || '';
    const desc = info.description || '';
    const topics = (info.topics || []).slice(0, 8);

    // 中文 nl
    const starsStr = stars > 0 ? '，⭐ ' + stars + ' stars' : '';
    const langStr = lang ? '，技术栈：' + lang : '';
    const topicsStr = topics.length > 0 ? '，标签：' + topics.join(' / ') : '';
    const finalNl = owner + '/' + repo + ' - ' + (desc || repo) + starsStr + langStr + topicsStr;

    // 英文 nl
    const starsStrEn = stars > 0 ? ', ⭐ ' + stars + ' stars' : '';
    const langStrEn = lang ? ', Tech: ' + lang : '';
    const topicsStrEn = topics.length > 0 ? ', Tags: ' + topics.join(' / ') : '';
    const finalNlEn = owner + '/' + repo + ' - ' + (desc || repo) + starsStrEn + langStrEn + topicsStrEn;

    console.log('✅ GitHub: ' + owner + '/' + repo + ' ⭐' + stars + ' Lang:' + lang + ' SKILL:' + (skillMd ? 'YES' : 'NO') + ' README:' + (readme ? 'YES' : 'NO') + ' README_EN:' + (readmeEn ? 'YES' : 'NO'));

    const isPrivate = info.private === true;
    if (isPrivate && !readme) {
      return { error: '私有仓库且无 README', notice: '🔒 私有仓库，可能缺少 README 内容' };
    }
    return {
      name: repo, owner, stars, lang, desc, topics, techs: [],
      readme, readmeEn, skillMd,
      nl: finalNl, nlEn: finalNlEn,
      designMd: null  // 待 fetchDesignMd 填充
    };
  } catch(e) {
    const errMsg = e.message || '';
    let notice = null;
    if (errMsg.includes('404') || errMsg.includes('Not Found')) {
      notice = '⚠️ 仓库不存在或 URL 错误';
    } else if (errMsg.includes('403') || errMsg.includes('rate limit')) {
      notice = '⚠️ GitHub API 速率限制，请稍后再试';
    } else if (errMsg.includes('private')) {
      notice = '⚠️ 私有仓库无法访问，请确保 Token 有权限';
    }
    console.log('❌ GitHub API 失败: ' + e.message);
    return { error: notice || 'GitHub API 请求失败', notice };
  }
}

// ============================================================
// DESIGN.md 支持：从 GitHub 读取并解析设计规范
// ============================================================

// 4. 获取 DESIGN.md（如果存在）
function fetchDesignMd(owner, repo) {
  const ghToken = process.env.GITHUB_TOKEN || '';
  const authHdr = ghToken ? `-H "Authorization: token ${ghToken}"` : '';
  for (const branch of ['main', 'master']) {
    try {
      const rd = execSync(`curl -sL "https://api.github.com/repos/${owner}/${repo}/contents/DESIGN.md?ref=${branch}" -H "Accept: application/json" -H "User-Agent: PosterHub/1.0" ${authHdr} --max-time 10`, { encoding: 'utf8' });
      const parsed = JSON.parse(rd);
      if (parsed.content) {
        const content = Buffer.from(parsed.content, 'base64').toString('utf8');
        console.log('✅ 读取到 DESIGN.md（' + content.length + ' 字符）');
        return content;
      }
    } catch(e) {}
  }
  console.log('⚠️ 未找到 DESIGN.md，将使用默认主题');
  return null;
}

// 从 awesome-design-md 查找匹配的设计模板
// 通过项目关键词（名称/描述/技术栈）匹配 VoltAgent 的 58 套设计模板
function fetchBestDesignMdFromAwesome(owner, repo, desc, lang, topics) {
  const ghToken = process.env.GITHUB_TOKEN || '';
  const authHdr = ghToken ? `-H "Authorization: token ${ghToken}"` : '';

  // 核心模板列表（VoltAgent awesome-design-md 的 design-md 目录）
  const TEMPLATES = [
    'airbnb','airtable','algolia','apple','atlassian','auth0','basecamp',
    'bear','behance','bentoml','bmw','brave','cal','chatgpt','claude',
    'clay','clickhouse','cloudflare','codium','cursor','datadog','discord',
    'docker','dribbble','dropbox','ethers','excalidraw','figma','framer',
    'github','gitlab','google','grida','hashnode','huggingface','instagram',
    'linear','loom','mailchimp','mastodon','midjourney','mint','neon',
    'notion','openai','parabola','planetscale','plex','radix','raycast',
    'readme','replicate','resend','runware','shopify','slack','spotify',
    'steam','stripe','supabase','tailwind','tldraw','twitch','twitter','ubisoft',
    'undesc','v0','vercel','warp','x','youtube','linear'
  ];

  // 从描述和关键词中提取匹配词
  const searchText = (desc + ' ' + repo + ' ' + (topics || []).join(' ')).toLowerCase();
  const langMap = {
    'Python': ['neon', 'vercel', 'openai'],
    'JavaScript': ['stripe', 'vercel', 'github', 'twitter'],
    'TypeScript': ['stripe', 'linear', 'vercel', 'github', 'cursor'],
    'Go': ['docker', 'cloudflare', 'neon'],
    'Rust': ['vercel', 'neon'],
    'Ruby': ['stripe', 'github', 'airbnb'],
    'Swift': ['apple', 'cal', 'bear'],
    'Kotlin': ['spotify', 'twitter'],
  };

  const targetSlugs = langMap[lang] || [];
  const keywordMatches = [
    // 语言/框架相关
    { kw: 'typescript', slug: 'linear' },
    { kw: 'typescript', slug: 'vercel' },
    { kw: 'python', slug: 'neon' },
    { kw: 'ai', slug: 'openai' },
    { kw: 'chatbot', slug: 'openai' },
    { kw: 'stripe', slug: 'stripe' },
    { kw: 'payment', slug: 'stripe' },
    { kw: 'docker', slug: 'docker' },
    { kw: 'container', slug: 'docker' },
    { kw: 'figma', slug: 'figma' },
    { kw: 'design', slug: 'figma' },
    { kw: 'github', slug: 'github' },
    { kw: 'git', slug: 'github' },
    { kw: 'linear', slug: 'linear' },
    { kw: 'project management', slug: 'linear' },
    { kw: 'notion', slug: 'notion' },
    { kw: 'note', slug: 'notion' },
    { kw: 'vercel', slug: 'vercel' },
    { kw: 'deploy', slug: 'vercel' },
    { kw: 'frontend', slug: 'vercel' },
    { kw: 'openai', slug: 'openai' },
    { kw: 'gpt', slug: 'openai' },
    { kw: 'claude', slug: 'claude' },
    { kw: 'cursor', slug: 'cursor' },
    { kw: 'v0', slug: 'v0' },
    { kw: 'radi', slug: 'radix' },
    { kw: 'twitter', slug: 'twitter' },
    { kw: 'social media', slug: 'twitter' },
    { kw: 'youtube', slug: 'youtube' },
    { kw: 'video', slug: 'youtube' },
    { kw: 'spotify', slug: 'spotify' },
    { kw: 'music', slug: 'spotify' },
    { kw: 'shopify', slug: 'shopify' },
    { kw: 'ecommerce', slug: 'shopify' },
    { kw: 'slack', slug: 'slack' },
    { kw: 'chat', slug: 'slack' },
    { kw: 'discord', slug: 'discord' },
    { kw: 'community', slug: 'discord' },
    { kw: 'docker', slug: 'docker' },
    { kw: 'cloudflare', slug: 'cloudflare' },
    { kw: 'edge', slug: 'cloudflare' },
    { kw: 'tailwind', slug: 'tailwind' },
    { kw: 'css', slug: 'tailwind' },
    { kw: 'supabase', slug: 'supabase' },
    { kw: 'database', slug: 'supabase' },
    { kw: 'postgres', slug: 'supabase' },
    { kw: 'framer', slug: 'framer' },
    { kw: 'motion', slug: 'framer' },
    { kw: 'apple', slug: 'apple' },
    { kw: 'ios', slug: 'apple' },
    { kw: 'macos', slug: 'apple' },
    { kw: 'bear', slug: 'bear' },
    { kw: 'note', slug: 'bear' },
    { kw: 'cal', slug: 'cal' },
    { kw: 'calendar', slug: 'cal' },
    { kw: 'loom', slug: 'loom' },
    { kw: 'video recording', slug: 'loom' },
    { kw: 'chatgpt', slug: 'chatgpt' },
    { kw: 'midjourney', slug: 'midjourney' },
    { kw: 'image gen', slug: 'midjourney' },
    { kw: 'huggingface', slug: 'huggingface' },
    { kw: 'ml', slug: 'huggingface' },
    { kw: 'neural', slug: 'huggingface' },
  ];

  // 提取匹配度最高的 slug
  let bestSlug = null;
  let bestScore = 0;
  for (const { kw, slug } of keywordMatches) {
    if (searchText.includes(kw)) {
      // 精确匹配给更高分
      const score = searchText.includes(repo.toLowerCase() + ' ' + kw) ? 3 : 2;
      if (score > bestScore) {
        bestScore = score;
        bestSlug = slug;
      }
    }
  }

  if (!bestSlug) return null;

  // 尝试获取该模板的 DESIGN.md
  for (const branch of ['main', 'master']) {
    try {
      const path = `design-md/${bestSlug}/DESIGN.md`;
      const rd = execSync(`curl -sL "https://api.github.com/repos/VoltAgent/awesome-design-md/contents/${path}?ref=${branch}" -H "Accept: application/json" -H "User-Agent: PosterHub/1.0" ${authHdr} --max-time 10`, { encoding: 'utf8' });
      const parsed = JSON.parse(rd);
      if (parsed.content) {
        const content = Buffer.from(parsed.content, 'base64').toString('utf8');
        console.log('✅ 从 awesome-design-md 匹配到 ' + bestSlug + ' 风格（搜索文本: ' + lang + '）');
        return content;
      }
    } catch(e) {}
  }
  return null;
}

// 解析 DESIGN.md Markdown，提取完整设计 token
// 支持表格格式和叙述格式（如 VoltAgent awesome-design-md 的写作风格）
function parseDesignMd(mdContent) {
  if (!mdContent) return null;
  try {
    const spec = {
      colors: [],
      primaryColor: null,
      accentColor: null,
      bgColor: null,
      bgColorAlt: null,
      textColor: null,
      textColorAlt: null,
      dividerColor: null,
      semanticColors: {},
      fontFamily: null,
      fontDisplay: null,
      fontBody: null,
      mood: '',
      moodShort: '',
      borderRadius: null,
      isDark: false,
    };

    // 1. 提取所有 hex 色值
    spec.colors = [...new Set(mdContent.match(/#[0-9a-fA-F]{3,8}/g) || [])];

    // 2. 优先尝试解析 Markdown 表格（标准 Stitch 格式）
    const tableSection = mdContent.match(/##\s*\d+\.\s*Color[^#]*?(?=\n##|\n#|$)/is);
    if (tableSection) {
      const rows = tableSection[0].match(/\|[^|]+\|[^|]+\|[^|]+\|/g) || [];
      for (const row of rows) {
        const cells = row.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length >= 3) {
          const [name, hexRaw, usage] = cells;
          const hexMatch = (hexRaw || '').match(/#([0-9a-fA-F]{3,8})/);
          if (hexMatch) {
            let hex = '#' + hexMatch[1];
            if (hex.length === 4) hex = hex[0] + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
            spec.semanticColors[name.toLowerCase()] = { hex, usage: usage || '' };
          }
        }
      }
    }

    // 3. 叙述式色值提取（VoltAgent awesome-design-md 的写作风格）
    const lowerMd = mdContent.toLowerCase();
    const findInText = (keywords, contextChars = 120) => {
      for (const kw of keywords) {
        const idx = lowerMd.indexOf(kw.toLowerCase());
        if (idx >= 0) {
          const snippet = mdContent.slice(Math.max(0, idx - 10), idx + contextChars);
          const match = snippet.match(/`?(#[0-9a-fA-F]{3,8})`?/);
          if (match) return match[1].toUpperCase();
        }
      }
      return null;
    };

    // 语义角色映射（叙述式查找）
    const roleExtractors = [
      // accent / interactive
      { key: 'accentColor', names: ['apple blue', 'accent', 'cta', '#0071e3', 'interactive', 'blue', 'highlight'] },
      // primary / brand
      { key: 'primaryColor', names: ['pure black', 'primary', 'brand', '#000000', '#000)'] },
      // light background
      { key: 'bgColor', names: ['light gray', 'light grey', '#f5f5f7', 'fafafc', 'background', 'near white'] },
      // dark background
      { key: 'bgColorAlt', names: ['pure black', '#000000', 'dark background', 'black', 'dark section'] },
      // text on light
      { key: 'textColor', names: ['near black', '#1d1d1f', 'primary text', 'dark text', 'black text'] },
      // text on dark
      { key: 'textColorAlt', names: ['white', '#ffffff', 'ffffff', 'on dark', 'text on dark'] },
    ];

    for (const { key, names } of roleExtractors) {
      if (!spec[key]) {
        const found = findInText(names);
        if (found) spec[key] = found;
      }
    }

    // 4. 从语义色表覆盖叙述式查找结果（表格优先）
    const sc = spec.semanticColors;
    const priorityKeys = {
      accentColor: ['accent', 'interactive', 'cta', 'apple blue', 'link blue', 'bright blue'],
      primaryColor: ['pure black', 'primary', 'near black', 'white', 'main'],
      bgColor: ['light gray', 'f5f5f7', 'background', 'surface', 'white'],
      bgColorAlt: ['pure black', '000000', 'black'],
      textColor: ['near black', '1d1d1f', 'primary', 'text'],
      textColorAlt: ['white', 'ffffff'],
    };

    for (const [key, names] of Object.entries(priorityKeys)) {
      if (!spec[key]) {
        for (const n of names) {
          const k = n.toLowerCase();
          if (sc[k] && sc[k].hex) { spec[key] = sc[k].hex; break; }
          for (const [sk, sv] of Object.entries(sc)) {
            if (sk.includes(k) && sv.hex) { spec[key] = sv.hex; break; }
          }
          if (spec[key]) break;
        }
      }
    }

    // 5. 判断深色主题（主色为纯黑，或背景为深色）
    if (spec.primaryColor && (spec.primaryColor === '#000000' || spec.primaryColor === '#000')) {
      spec.isDark = true;
    }
    // 如果背景色偏暗，也判为深色主题
    if (!spec.isDark && spec.bgColor) {
      const bgHex = spec.bgColor.replace('#', '');
      const r = parseInt(bgHex.slice(0, 2), 16);
      const g = parseInt(bgHex.slice(2, 4), 16);
      const b = parseInt(bgHex.slice(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (luminance < 0.4) spec.isDark = true;
    }

    // 6. 提取字体
    const fontMatch = mdContent.match(/(?:font[- ]*family|字体|Font Family)[：:\s]*([^\n,\|`]+)/i);
    if (fontMatch) {
      const fonts = fontMatch[1].split(',').map(f => f.trim().replace(/[`*]/g, ''));
      spec.fontFamily = fonts[0];
    }

    const displayMatch = mdContent.match(/display.*?font[：:\s]*([^\n,\|`]+)/i);
    if (displayMatch) spec.fontDisplay = displayMatch[1].split(',')[0].trim().replace(/[`*]/g, '');

    const bodyMatch = mdContent.match(/body.*?font[：:\s]*([^\n,\|`]+)/i);
    if (bodyMatch) spec.fontBody = bodyMatch[1].split(',')[0].trim().replace(/[`*]/g, '');

    // 7. 提取氛围描述
    const moodMatch = mdContent.match(/##\s*\d+\.\s*Visual Theme[^#]*?(?=\n##|\n#|$)/is);
    if (moodMatch) {
      const raw = moodMatch[0].replace(/[#*`\n]/g, ' ').replace(/\s+/g, ' ').trim();
      spec.mood = raw.slice(0, 300);
      spec.moodShort = raw.slice(0, 80);
    }

    // 8. 圆角
    const radiusMatch = mdContent.match(/(?:radius|pill)[^0-9]*(\d+)/i);
    if (radiusMatch) spec.borderRadius = parseInt(radiusMatch[1]);

    console.log('📐 parseDesignMd: primary=' + spec.primaryColor + ', accent=' + spec.accentColor + ', bg=' + spec.bgColor + ', bgAlt=' + spec.bgColorAlt + ', isDark=' + spec.isDark + ', font=' + spec.fontFamily);
    return spec;
  } catch(e) {
    console.log('⚠️ parseDesignMd 解析失败: ' + e.message);
    return null;
  }
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const ENV_FILE_PATH = path.join(__dirname, '.env');

function maskSecret(v) {
  const s = String(v || '');
  if (!s) return '';
  if (s.length <= 8) return '*'.repeat(s.length);
  return s.slice(0, 4) + '*'.repeat(Math.max(4, s.length - 8)) + s.slice(-4);
}

function escapeEnvValue(v) {
  return String(v).replace(/\n/g, '\\n');
}

function removeEnvKey(raw, key) {
  const keyRe = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reg = new RegExp('^' + keyRe + '=.*\\n?', 'm');
  return raw.replace(reg, '');
}

function upsertEnvKey(raw, key, value) {
  const keyRe = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const line = key + '=' + escapeEnvValue(value);
  const reg = new RegExp('^' + keyRe + '=.*$', 'm');
  if (reg.test(raw)) return raw.replace(reg, line);
  const suffix = raw && !raw.endsWith('\n') ? '\n' : '';
  return raw + suffix + line + '\n';
}

function writeEnvUpdates(updates) {
  let raw = fs.existsSync(ENV_FILE_PATH) ? fs.readFileSync(ENV_FILE_PATH, 'utf8') : '';
  for (const [key, value] of Object.entries(updates)) {
    if (typeof value === 'undefined') continue;
    if (value === null || value === '') {
      raw = removeEnvKey(raw, key);
      delete process.env[key];
    } else {
      raw = upsertEnvKey(raw, key, value);
      process.env[key] = String(value);
    }
  }
  fs.writeFileSync(ENV_FILE_PATH, raw, 'utf8');
}

function normalizeBaseUrl(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

function getModelsEndpoints(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  const isOllama = normalized.includes(':11434');
  const isMiniMax = normalized.includes('minimaxi');
  
  if (!normalized) return [];
  
  if (isOllama) {
    const baseNoV1 = normalized.replace(/\/v1$/, '');
    const endpoints = [
      baseNoV1 + '/api/tags',
      baseNoV1 + '/v1/models',
      normalized + '/models'
    ];
    return Array.from(new Set(endpoints));
  }
  
  // 非 OllAMA: 尝试多个已知端点
  const endpoints = [
    normalized + '/models',
    normalized + '/v1/models',
    normalized + '/model/list',
  ];
  
  return Array.from(new Set(endpoints));
}

function extractModelIds(data) {
  const fromModels = Array.isArray(data?.models)
    ? data.models.map(m => m.name || m.model || '').filter(Boolean)
    : [];
  const fromData = Array.isArray(data?.data)
    ? data.data.map(m => m.id || m.model || m.name || '').filter(Boolean)
    : [];
  return fromModels.length ? fromModels : fromData;
}

function getLocalIpCandidates() {
  try {
    const nets = os.networkInterfaces();
    const ips = [];
    for (const addrs of Object.values(nets)) {
      for (const a of (addrs || [])) {
        if (!a || a.internal) continue;
        if (a.family === 'IPv4' && a.address) ips.push(a.address);
      }
    }
    return Array.from(new Set(ips));
  } catch (e) {
    return [];
  }
}

function getCandidateBaseUrls(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return [];
  const candidates = [normalized];
  if (normalized.includes(':11434')) {
    if (normalized.endsWith('/v1')) candidates.push(normalized.replace(/\/v1$/, ''));
    if (!normalized.endsWith('/v1')) candidates.push(normalized + '/v1');
    candidates.push('http://127.0.0.1:11434/v1');
    candidates.push('http://localhost:11434/v1');
    for (const ip of getLocalIpCandidates()) {
      candidates.push(`http://${ip}:11434/v1`);
    }
  }
  return Array.from(new Set(candidates.map(s => normalizeBaseUrl(s)).filter(Boolean)));
}

function getJsonWithCurlFallback(endpoint, headers, timeoutMs) {
  const args = ['-sS', '-m', String(Math.ceil(timeoutMs / 1000)), endpoint];
  for (const [k, v] of Object.entries(headers || {})) {
    if (!v) continue;
    args.push('-H', `${k}: ${v}`);
  }
  const cp = spawnSync('curl', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (cp.status !== 0) {
    const stderr = (cp.stderr || cp.error?.message || '').trim();
    return { ok: false, error: stderr || 'curl failed' };
  }
  const stdout = (cp.stdout || '').trim();
  try {
    return { ok: true, data: JSON.parse(stdout) };
  } catch (e) {
    return { ok: false, error: 'curl 返回非 JSON: ' + stdout.slice(0, 160) };
  }
}

async function testLlmConnectivity({ apiKey = '', baseUrl = '', model = '' }) {
  const LLM_BASE_URL = process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || '';
  const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
  const LLM_MODEL = process.env.LLM_MODEL || '';
  
  const finalBaseUrl = (baseUrl || LLM_BASE_URL).trim();
  const finalApiKey = (apiKey || LLM_API_KEY).trim();
  const finalModel = (model || LLM_MODEL).trim();
  
  if (!finalBaseUrl) return { ok: false, reachable: false, message: 'Empty URL', modelCount: 0, modelsPreview: [], modelFound: null, endpoint: '' };
  if (!/^https?:\/\//i.test(finalBaseUrl)) return { ok: false, reachable: false, message: 'Invalid URL', modelCount: 0, modelsPreview: [], modelFound: null, endpoint: '' };
  
  const timeoutMs = 4000;
  const headers = { 'Content-Type': 'application/json' };
  if (finalApiKey) headers['Authorization'] = `Bearer ${finalApiKey}`;

  const attempt = async (base) => {
    const endpoints = getModelsEndpoints(base);
    const tried = [];
    for (const endpoint of endpoints) {
      tried.push(endpoint);
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(endpoint, { method: 'GET', headers, signal: controller.signal });
        const raw = await res.text();
        clearTimeout(timer);
        if (!res.ok) {
          return { ok: false, reachable: true, message: `HTTP ${res.status}`, modelCount: 0, modelsPreview: [], modelFound: null, endpoint, tried };
        }
        const data = JSON.parse(raw);
        const modelIds = extractModelIds(data);
        return {
          ok: true,
          reachable: true,
          modelCount: modelIds.length,
          modelsPreview: modelIds.slice(0, 13),
          modelFound: finalModel ? modelIds.includes(finalModel) : null,
          endpoint,
          tried
        };
      } catch (e) {
        const curl = getJsonWithCurlFallback(endpoint, headers, timeoutMs);
        if (curl.ok) {
          const modelIds = extractModelIds(curl.data);
          return {
            ok: true,
            reachable: true,
            modelCount: modelIds.length,
            modelsPreview: modelIds.slice(0, 13),
            modelFound: finalModel ? modelIds.includes(finalModel) : null,
            endpoint,
            tried
          };
        }
        return { ok: false, reachable: false, message: `fetch/curl 均失败: ${curl.error || e.message}`, modelCount: 0, modelsPreview: [], modelFound: null, endpoint, tried };
      }
    }
    return { ok: false, reachable: false, message: 'No endpoint', modelCount: 0, modelsPreview: [], modelFound: null, endpoint: '', tried };
  };

  const first = await attempt(finalBaseUrl);
  if (first.ok) return first;

  const candidates = getCandidateBaseUrls(finalBaseUrl);
  for (const cand of candidates) {
    if (cand === normalizeBaseUrl(finalBaseUrl)) continue;
    const r = await attempt(cand);
    if (r.ok) {
      return { ...r, suggestedBaseUrl: cand, autoDiscovered: true };
    }
  }

  // MiniMax 不提供 /models 端点，返回默认模型列表
  if (finalBaseUrl.includes('minimaxi')) {
    const defaultModels = [
      'MiniMax-M2.1',
      'MiniMax-M2.5',
      'MiniMax-M2.7',
      'abab6.5s-chat'
    ];
    const found = finalModel ? defaultModels.includes(finalModel) : null;
    return {
      ok: true,
      reachable: true,
      modelCount: defaultModels.length,
      modelsPreview: defaultModels,
      modelFound: found,
      endpoint: finalBaseUrl + '/models (默认)',
      tried: []
    };
  }

  return first;
}

// 进度存储
const progressMap = new Map();

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // API: 健康检查
  if (pathname === '/health' || pathname === '/api/health') {
    json(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
    return;
  }

  // API: 获取进度
  if (pathname.startsWith('/api/progress/')) {
    const id = pathname.split('/')[2]?.split('?')[0];
    const p = progressMap.get(id);
    if (p) {
      json(res, 200, { progress: p });
    } else {
      json(res, 200, { progress: { stage: 'prepare', model: 'LLM' } });
    }
    return;
  }

  const warnings = [];  // 统一警告收集（声明在使用之前）

  if (req.method === 'OPTIONS') { setCors(res); res.writeHead(204); res.end(); return; }

  // 静态文件
  if (pathname.startsWith('/web/')) {
    const fp = path.join(__dirname, pathname);
    // 处理目录请求（自动找 index.html）
    const stat = fs.existsSync(fp) ? fs.statSync(fp) : null;
    let servePath = fp;
    if (stat && stat.isDirectory()) {
      servePath = path.join(fp, 'index.html');
      if (!fs.existsSync(servePath)) { res.writeHead(403); res.end('Directory listing denied'); return; }
    }
    const ext = path.extname(servePath);
    const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
    if (fs.existsSync(servePath)) {
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      fs.createReadStream(servePath).pipe(res);
    } else { res.writeHead(404); res.end('Not Found'); }
    return;
  }

  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(302, { 'Location': '/web/index.html' }); res.end(); return;
  }

  // API: 生成海报
  if (req.method === 'POST' && pathname === '/api/generate') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { nl, lang = 'zh', inputType = 'url', _progressId } = JSON.parse(body);
        
        // 更新进度辅助函数
        let updateProgress;
        const setUpdateProgress = (stage, model) => {
          if (_progressId) {
            progressMap.set(_progressId, { stage, model: model || 'LLM', timestamp: Date.now() });
          }
        };
        updateProgress = setUpdateProgress;
        setUpdateProgress('prepare', '');
        
        let finalNl = nl;
        let ghData = null;

        // Handle browse (folder selection) - just use the folder name to match local project
        if (inputType === 'browse' && nl) {
          const folderName = nl.trim();
          const localData = autoDetectLocal(folderName);
          if (localData) {
            finalNl = localData.name + ' - ' + (localData.readme || '').slice(0, 200).replace(/[#*`]/g, ' ').replace(/\s+/g, ' ').trim();
            if (localData.techs.length > 0) finalNl += '，技术栈：' + localData.techs.join(' / ');
            console.log('🧠 浏览文件夹: ' + localData.name);
          }
        }

        // 1. GitHub URL → API 获取完整项目信息（OpenClaw 学习）
        if (nl.includes('github.com')) {
          ghData = fetchGitHub(nl);
          if (ghData && !ghData.error) {
            finalNl = lang === 'en' ? ghData.nlEn : ghData.nl;
            console.log('🧠 OpenClaw 正在学习: ' + ghData.owner + '/' + ghData.name);
            // 读取 DESIGN.md（先尝试项目根目录，再尝试 awesome-design-md 同名模板）
            let designMd = fetchDesignMd(ghData.owner, ghData.name);
            if (!designMd) {
              // 从 awesome-design-md 智能匹配最佳模板
              designMd = fetchBestDesignMdFromAwesome(ghData.owner, ghData.name, ghData.desc, ghData.lang, ghData.topics);
            }
            if (designMd) {
              ghData.designMd = designMd;
              ghData.designSpec = parseDesignMd(designMd);
            }
          }
        }

        // 2. 本地路径
        let localData = null;
        if (!ghData && (nl.startsWith('~/') || nl.startsWith('/'))) {
          localData = autoDetectLocal(nl);
          if (localData) {
            console.log('🧠 本地项目: ' + localData.name);
          }
        }

        // 3. 自动检测
        if (!ghData && !localData && !nl.includes('github.com') && !nl.startsWith('~/')) {
          localData = autoDetectLocal(nl);
          if (localData) {
            console.log('🧠 扫描匹配: ' + localData.name);
          }
        }

        // 构造 finalNl（包含本地项目的 README 信息，供海报生成器解析）
        let posterConfig = null;
        if (ghData) {
          // GitHub 项目：用 LLM 分析 README
          if (ghData.readme || ghData.readmeEn) {
            updateProgress('llm', process.env.LLM_MODEL || 'gemma4:e4b');
            console.log('📖 正在分析 GitHub README: ' + ghData.owner + '/' + ghData.name);
            const readmeToAnalyze = lang === 'en' ? (ghData.readmeEn || ghData.readme) : (ghData.readme || ghData.readmeEn);
            const llmResult = await analyzeReadmeWithLLM(readmeToAnalyze, ghData.name);
            updateProgress('promptLlm', process.env.LLM_MODEL || 'gemma4:e4b');
            const cfg = llmResult && llmResult.config;
            if (cfg) {
              // 使用 LLM 分析结果构建海报配置
              posterConfig = {
                theme: 'apple-minimal',
                hero: {
                  badge: cfg.badge || (ghData.topics && ghData.topics[0]) || (ghData.stars ? '⭐ ' + ghData.stars : 'GitHub 项目'),
                  title: cfg.title || (ghData.owner + '/' + ghData.name),
                  subtitle: cfg.description || ghData.desc || ghData.name
                },
                sections: (cfg.sections || []).map(sec => ({
                  label: sec.label,
                  items: (sec.items || []).map(item => ({
                    emoji: item.emoji || '📌',
                    title: item.title,
                    desc: item.desc || '',
                    badge: item.badge || '',
                    color: item.color || '#4A90E2'
                  }))
                })),
                stats: [],
                footer: {
                  line1: cfg.footer1 || ghData.desc || 'Powered by PosterHub',
                  line2: cfg.footer2 || ('github.com/' + ghData.owner + '/' + ghData.name)
                }
              };
              console.log('✅ GitHub README LLM 分析成功: ' + (cfg.features ? cfg.features.length : 0) + ' features');
            } else {
              console.log('⚠️ GitHub README LLM 分析失败，回退到基础模式');
            }
          }
          if (!posterConfig) {
            finalNl = lang === 'en' ? ghData.nlEn : ghData.nl;
          }
        } else if (localData) {
          // 用 LLM 分析整个项目目录
          updateProgress('llm', process.env.LLM_MODEL || 'gemma4:e4b');
          console.log('🔍 正在扫描目录: ' + localData.root);
          const scan = scanProjectDir(localData.root);
          console.log('📁 扫描到 ' + scan.files.length + ' 个文件');
          const llmResult = await analyzeWithLLM(localData.root, localData.name, scan);
          updateProgress('promptLlm', process.env.LLM_MODEL || 'gemma4:e4b');
          const cfg = llmResult && llmResult.config;
          if (cfg) {
            // 构建海报配置
            let builtConfig = {
              theme: 'apple-minimal',
              hero: {
                badge: cfg.badge || '📁 本地项目',
                title: cfg.title || localData.name,
                subtitle: cfg.description || '本地项目'
              },
              sections: (cfg.sections || []).map(sec => ({
                label: sec.label,
                items: (sec.items || []).map(item => ({
                  emoji: item.emoji || '📌',
                  title: item.title,
                  desc: item.desc || '',
                  badge: item.badge || '',
                  color: item.color || '#8B7355'
                }))
              })),
              stats: [],
              footer: {
                line1: cfg.footer1 || 'Powered by PosterHub',
                line2: cfg.footer2 || 'AI驱动的项目简介生成器'
              },
              projectLink: ''
            };
            posterConfig = builtConfig;
            const techs = cfg.techStack ? cfg.techStack.join(' / ') : '';
            finalNl = (cfg.title || localData.name) + ' - ' + (cfg.description || '') + (techs ? '，技术栈：' + techs : '');
            console.log('🎨 [LLM] 生成海报: ' + finalNl);
          } else {
            // LLM 未配置或失败，降级到 README 方式
            const readmeShort = (localData.readme || '').replace(/[#*`]/g, ' ').replace(/\s+/g, ' ').slice(0, 200).trim();
            const techs = localData.techs.length > 0 ? '，技术栈：' + localData.techs.join(' / ') : '';
            finalNl = localData.name + ' - ' + (readmeShort || '本地项目') + techs;
            console.log('🎨 [fallback] 生成海报: ' + finalNl);
            if (!process.env.LLM_API_KEY && !process.env.OPENAI_API_KEY) {
              warnings.push('⚠️ 未配置 LLM_API_KEY，建议配置后获得更精准的海报内容');
            }
          }
        } else {
          finalNl = nl;
          console.log('🎨 [' + lang + '] 生成海报: ' + finalNl);
        }

        // 如果有 designSpec，传递给生成器
        const genOverrides = { lang };
        if (ghData && ghData.designSpec) {
          genOverrides.designSpec = ghData.designSpec;
        }

        
// ═══════════════════════════════════════════
//  海报内容验证器
// ═══════════════════════════════════════════
function validatePosterHTML(html, sourceData) {
  const issues = [];
  
  // Helper: extract text content from HTML element
  function extract(selector, regex) {
    const m = new RegExp(regex || selector.replace(/[<>]/g, '').replace(/class=.([^"]+)./, '(?:[^>]*>)([^<]+)'), 'i').exec(html);
    return m ? m[1].trim() : null;
  }
  
  // Extract hero title
  const heroTitle = /class="hero-title[^>]*>([^<]+)</.exec(html);
  const heroSubtitle = /class="hero-subtitle[^>]*>([^<]+)</.exec(html);
  const heroBadge = /class="hero-badge[^>]*>([\s\S]*?)<\/div>/.exec(html);
  const statNums = [...html.matchAll(/class="stat-num[^>]*>([^<]+)</g)].map(m => m[1]);
  const cardNames = [...html.matchAll(/class="card-name[^>]*>([^<]+)</g)].map(m => m[1]);

  // Validate against source data
  if (sourceData) {
    // GitHub data validation
    // Only validate title if source has both owner AND name (GitHub projects)
    // Local projects may only have 'name' without 'owner'
    if (sourceData.owner && sourceData.name) {
      const expectedTitle = sourceData.owner + '/' + sourceData.name;
      if (heroTitle && heroTitle[1] !== expectedTitle) {
        issues.push({ type: 'title', expected: expectedTitle, actual: heroTitle[1] });
      }
    }
    
    // Only validate stars if source explicitly provides stars > 0 (GitHub projects)
    // Local projects have stars=0 or undefined — skip stars validation for them
    if (sourceData.stars !== undefined && sourceData.stars > 0) {
      const stars = sourceData.stars;
      // Check if stars stat exists and is reasonably close (handles "244.4k" format)
      const hasStars = statNums.some(n => {
        // Handle formats like "244.4k", "244k", "244,446"
        const normalized = n.replace(/,/g, '').toLowerCase();
        const num = parseFloat(normalized);
        const units = { 'k': 1e3, 'm': 1e6, 'w': 1e4 };
        const unit = normalized.match(/[kmw]$/);
        const multiplier = unit ? units[unit[0]] : 1;
        const parsed = unit ? num * multiplier : num;
        // For formatted numbers, just check if stars > 0 and the stat is a number
        return parsed > 0 && !isNaN(parsed);
      });
      if (!hasStars) {
        issues.push({ type: 'stars', expected: stars, found: statNums });
      }
    }
    
    if (sourceData.topics && sourceData.topics.length > 0) {
      // Check card topics
      const topicCount = cardNames.filter(n => sourceData.topics.includes(n)).length;
      if (topicCount < sourceData.topics.length * 0.5) {
        issues.push({ type: 'topics', expected: sourceData.topics.length, found: cardNames.length });
      }
    }
  }
  
  // Structural checks
  if (!heroTitle) issues.push({ type: 'missing', field: 'hero-title' });
  if (!heroSubtitle) issues.push({ type: 'missing', field: 'hero-subtitle' });
  if (!heroBadge) issues.push({ type: 'missing', field: 'hero-badge' });
  // Only require stats for GitHub projects (which have owner)
  // Local projects don't have stars/forks/etc, so skip stats check for them
  if (statNums.length === 0 && sourceData && sourceData.owner) {
    issues.push({ type: 'missing', field: 'stats' });
  }
  
  return { valid: issues.length === 0, issues };
}

// 用 AI 生成海报
        // 🎯 新架构：优先使用自适应 CSS 生成器
        let html;
        let theme;
        
        try {
          // 构建海报结构化数据
          if (posterConfig) {
            // 本地项目：使用 posterConfig（已有 LLM 解析的完整配置）
            const { hero, sections, stats, footer } = posterConfig;
            theme = THEMES[posterConfig.theme] || THEMES['apple-minimal'];
            // 应用 DESIGN.md 规范
            if (posterConfig.designSpec) {
              applyDesignSpecToTheme(theme, posterConfig.designSpec);
            }
            updateProgress('html', process.env.LLM_MODEL || 'gemma4:e4b');
            html = generateAdaptiveCSS({ hero, sections, stats, footer, theme, lang });
          } else if (ghData) {
            // GitHub 项目：从 ghData 构建结构化数据
            const stars = ghData.stars > 0 ? ghData.stars : null;
            const stats = [
              { label: 'Stars', value: stars ? formatStars(stars) : '-' },
              { label: 'Language', value: ghData.lang || '-' },
              { label: 'Topics', value: String(ghData.topics ? ghData.topics.length : 0) },
            ];
            const hero = {
              badge: ghData.topics && ghData.topics[0] ? '⭐ ' + ghData.topics[0] : (stars ? '⭐ ' + formatStars(stars) : 'GitHub 项目'),
              title: ghData.owner + '/' + ghData.name,
              subtitle: ghData.desc || ghData.name,
            };
            
            // 构建 sections：至少有一个默认 section
            const sections = [];
            if (ghData.topics && ghData.topics.length > 0) {
              sections.push({
                label: lang === 'en' ? 'Topics' : '📦 项目信息',
                items: ghData.topics.map(t => ({ emoji: '🏷️', title: t, desc: lang === 'en' ? 'Topic' : '标签', badge: lang === 'en' ? 'Tag' : '标签' })),
              });
            } else if (!ghData.desc && !ghData.readme) {
              // API 数据为空时，至少显示项目链接
              sections.push({
                label: lang === 'en' ? 'GitHub' : '🔗 访问链接',
                items: [{ emoji: '📦', title: ghData.owner + '/' + ghData.name, desc: 'View on GitHub', badge: 'github.com' }],
              });
            }
            
            // 如果什么都没有，至少加一个默认 section
            if (sections.length === 0) {
              sections.push({
                label: lang === 'en' ? 'About' : '📝 项目简介',
                items: [{ emoji: '💡', title: ghData.desc || ghData.name, desc: ghData.lang ? 'Language: ' + ghData.lang : 'View on GitHub', badge: ghData.lang || 'GitHub' }],
              });
            }
            
            const footer = {
              line1: ghData.desc || 'Powered by PosterHub',
              line2: 'github.com/' + ghData.owner + '/' + ghData.name,
            };
            theme = THEMES['apple-minimal'];
            // 应用 VoltAgent DESIGN.md 规范
            if (ghData.designSpec) {
              applyDesignSpecToTheme(theme, ghData.designSpec);
            }
            updateProgress('html', process.env.LLM_MODEL || 'gemma4:e4b');
            html = generateAdaptiveCSS({ hero, sections, stats, footer, theme, lang });
          } else {
            // 其他输入：使用旧的 NL 解析方式（fallback）
            updateProgress('html', process.env.LLM_MODEL || 'gemma4:e4b');
            const result = generateFromNaturalLanguage(finalNl, genOverrides);
            html = result.html;
            theme = result.theme;
          }
          console.log('✅ 自适应CSS海报生成成功');
        } catch (e) {
          console.warn('⚠️ 自适应CSS生成失败，使用旧方式:', e.message);
          const result = posterConfig
            ? generateFromConfig(posterConfig)
            : generateFromNaturalLanguage(finalNl, genOverrides);
          html = result.html;
          theme = result.theme;
        }

        // ═══════════════════════════════════════════
        //  Harness 验证循环（最多3轮）
        // ═══════════════════════════════════════════
        let harnessPassed = false;
        let harnessRound = 0;
        const maxRounds = 3;

        while (!harnessPassed && harnessRound < maxRounds) {
          harnessRound++;
          
          // 双重验证
          const sourceForValidation = ghData || localData || {};
          const htmlValidation = validatePosterHTML(html, sourceForValidation);
          const structureValidation = validatePosterStructure(html);
          
          const allIssues = [
            ...(htmlValidation.issues || []),
            ...(structureValidation.issues || [])
          ];
          
          if (allIssues.length === 0) {
            harnessPassed = true;
            console.log('✅ Harness 第' + harnessRound + '轮通过');
            break;
          }

          console.warn('⚠️ Harness 第' + harnessRound + '轮验证失败: ' + JSON.stringify(allIssues).slice(0, 100));
          
          // 如果还有轮次，尝试修复
          if (harnessRound < maxRounds) {
            console.log('🔧 Harness 修复中...');
            try {
              if (posterConfig) {
                // 有 LLM 配置：用配置重新生成
                const { hero, sections, stats, footer } = posterConfig;
                theme = THEMES[posterConfig.theme] || THEMES['apple-minimal'];
                if (posterConfig.designSpec) {
                  applyDesignSpecToTheme(theme, posterConfig.designSpec);
                }
                html = generateAdaptiveCSS({ hero, sections, stats, footer, theme, lang });
              } else {
                // 无 LLM 配置：用旧的 fallback
                const retryResult = generateFromNaturalLanguage(finalNl, genOverrides);
                html = retryResult.html;
                theme = retryResult.theme;
              }
            } catch(repairErr) {
              console.warn('⚠️ 修复失败:', repairErr.message);
              break;
            }
          }
        }

        if (!harnessPassed) {
          console.warn('⚠️ Harness 验证未通过，保留生成结果');
          warnings.push('⚠️ 内容验证未完全通过');
        }

        const id = Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        const outDir = path.join(__dirname, 'posters', id);
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'poster.html'), html);
        await hiresPoster(path.join(outDir, 'poster.html'), path.join(outDir, 'poster.png'));

        const meta = {
          id, title: finalNl.slice(0, 80), theme,
          github: ghData ? 'https://github.com/' + ghData.owner + '/' + ghData.name : null,
          stars: ghData ? ghData.stars : 0,
          lang, hasSkill: ghData ? !!ghData.skillMd : false,
          created: new Date().toISOString()
        };
        fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));

        // 完成
        updateProgress('done', '');

        if (!ghData && localData && !localData.readme && !posterConfig) warnings.push('📁 该目录无 README.md，内容可能不完整');
        if (ghData && ghData.notice) warnings.push(ghData.notice);
        json(res, 200, { ok: true, posterId: id, title: meta.title, github: meta.github, stars: meta.stars, hasSkill: meta.hasSkill, warnings });
      } catch(e) {
        console.error('❌ 生成失败: ' + e.message);
        updateProgress('error', '');
        json(res, 500, { ok: false, error: e.message });
      }
    });
    return;
  }

  // ═══════════════════════════════════════════
  //  API: 通用海报生成（支持任意内容描述）
  // ═══════════════════════════════════════════
  if (req.method === 'POST' && pathname === '/api/prompt') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      let updateProgress;
      try {
        const { prompt, type = 'custom', image, lang = 'zh', width = 780, customCss, _progressId } = JSON.parse(body);
        
        // 更新进度辅助函数
        updateProgress = (stage, model) => {
          if (_progressId) {
            progressMap.set(_progressId, { stage, model: model || 'LLM', timestamp: Date.now() });
          }
        };
        
        updateProgress('prepare', '');
        
        if (!prompt || prompt.trim().length < 3) {
          json(res, 400, { ok: false, error: 'prompt 必须至少 3 个字符' });
          return;
        }
        
        console.log(`🎨 [通用海报] type=${type}, prompt="${prompt.slice(0, 50)}..."`);
        updateProgress('promptLlm', '');
        
        const { html, style } = await generateFromPrompt({ prompt, type, image, lang, width, customCss });
        updateProgress('export', '');
        
        // 保存 HTML
        const posterId = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const outDir = path.join(__dirname, 'posters', posterId);
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(outDir + '/poster.html', html, 'utf8');
        
        // 截图
        console.log('📸 正在截图...');
        const pngPath = outDir + '/poster.png';
        await hiresPoster(outDir + '/poster.html', pngPath);
        
        const meta = {
          id: posterId,
          title: prompt.slice(0, 80),
          type,
          style,
          lang,
          created: new Date().toISOString(),
        };
        fs.writeFileSync(outDir + '/meta.json', JSON.stringify(meta, null, 2));
        
        console.log(`✅ 通用海报生成成功: ${posterId}`);
        updateProgress('done', '');
        json(res, 200, { ok: true, posterId, style, meta });
        
      } catch(e) {
        console.error('❌ 通用海报生成失败: ' + e.message);
        updateProgress('error', '');
        json(res, 500, { ok: false, error: e.message });
      }
    });
    return;
  }

  // API: 获取支持的类型列表
  if (req.method === 'GET' && pathname === '/api/types') {
    json(res, 200, { ok: true, types: getPosterTypes() });
    return;
  }

  // API: 获取设置（给 settings 页面）
  if (req.method === 'GET' && pathname === '/api/settings') {
    const llmApiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
    const githubToken = process.env.GITHUB_TOKEN || '';
    json(res, 200, {
      ok: true,
      settings: {
        llmBaseUrl: process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || '',
        llmModel: process.env.LLM_MODEL || '',
        hasLlmApiKey: !!llmApiKey,
        llmApiKeyMasked: maskSecret(llmApiKey),
        hasGithubToken: !!githubToken,
        githubTokenMasked: maskSecret(githubToken),
      }
    });
    return;
  }

  // API: 保存设置（写入 .env）
  if (req.method === 'POST' && pathname === '/api/settings') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const updates = {};
        if (Object.prototype.hasOwnProperty.call(payload, 'llmApiKey')) {
          const v = String(payload.llmApiKey || '').trim();
          updates.LLM_API_KEY = v || null;
          updates.OPENAI_API_KEY = null;
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'llmBaseUrl')) {
          updates.LLM_BASE_URL = String(payload.llmBaseUrl || '').trim() || null;
          updates.OPENAI_BASE_URL = null;
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'llmModel')) {
          updates.LLM_MODEL = String(payload.llmModel || '').trim() || null;
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'githubToken')) {
          updates.GITHUB_TOKEN = String(payload.githubToken || '').trim() || null;
        }
        writeEnvUpdates(updates);
        const llmApiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
        const githubToken = process.env.GITHUB_TOKEN || '';
        json(res, 200, {
          ok: true,
          message: '设置已保存',
          settings: {
            llmBaseUrl: process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || '',
            llmModel: process.env.LLM_MODEL || '',
            hasLlmApiKey: !!llmApiKey,
            llmApiKeyMasked: maskSecret(llmApiKey),
            hasGithubToken: !!githubToken,
            githubTokenMasked: maskSecret(githubToken),
          }
        });
      } catch (e) {
        json(res, 400, { ok: false, error: '设置保存失败: ' + e.message });
      }
    });
    return;
  }

  // API: 测试 LLM 连通性（不保存）
  if (req.method === 'POST' && pathname === '/api/settings/test') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = await testLlmConnectivity({
          apiKey: payload.llmApiKey || '',
          baseUrl: payload.llmBaseUrl || '',
          model: payload.llmModel || ''
        });
        json(res, 200, { ok: true, test: result });
      } catch (e) {
        json(res, 400, { ok: false, error: 'LLM 连通性测试失败: ' + e.message });
      }
    });
    return;
  }

  // API: 获取模型列表
  if (req.method === 'GET' && pathname === '/api/models') {
    try {
      const params = parsedUrl.searchParams;
      const result = await testLlmConnectivity({
        baseUrl: params.get('baseUrl') || '',
        apiKey: params.get('apiKey') || '',
        model: params.get('model') || ''
      });
      json(res, 200, {
        ok: result.ok,
        models: result.modelsPreview || [],
        modelCount: result.modelCount || 0,
        endpoint: result.endpoint,
        modelFound: result.modelFound,
        message: result.message || ''
      });
    } catch (e) {
      json(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // API: 列表
  if (req.method === 'GET' && pathname === '/api/list') {
    const posters = [];
    const POSTERS_DIR = path.join(__dirname, 'posters');
    if (fs.existsSync(POSTERS_DIR)) {
      for (const id of fs.readdirSync(POSTERS_DIR)) {
        const mp = path.join(POSTERS_DIR, id, 'meta.json');
        if (fs.existsSync(mp)) {
          const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
          m.id = id;
          posters.push(m);
        }
      }
    }
    posters.sort((a, b) => new Date(b.created) - new Date(a.created));
    json(res, 200, { ok: true, posters });
    return;
  }

  // API: 删除海报
  if (req.method === 'DELETE' && pathname.startsWith('/api/poster/')) {
    const match = pathname.match(/^\/api\/poster\/([^/]+)$/);
    const id = match ? match[1] : null;
    if (!id) {
      json(res, 400, { ok: false, error: 'Missing poster ID' });
      return;
    }
    const POSTERS_DIR = path.join(__dirname, 'posters');
    const posterDir = path.join(POSTERS_DIR, id);
    
    if (!fs.existsSync(posterDir)) {
      json(res, 404, { ok: false, error: 'Poster not found' });
      return;
    }
    
    try {
      fs.rmSync(posterDir, { recursive: true, force: true });
      json(res, 200, { ok: true });
    } catch(e) {
      json(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // API: 调起 macOS 原生文件夹选择对话框
  if (req.method === 'GET' && pathname === '/api/pick-folder') {
    try {
      const { execSync } = require('child_process');
      const folderPath = execSync(
        'osascript -e \'tell app "Finder" to POSIX path of (choose folder default location (path to home folder))\'',
        { encoding: 'utf8', timeout: 30000 }
      ).trim();
      const folderName = folderPath.split('/').filter(Boolean).pop() || '';
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
      res.end(folderName);
    } catch(e) {
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
      res.end(''); // 用户取消
    }
    return;
  }

  // API: 下载 PNG (新格式: /api/poster/{id}.png)
  if (req.method === 'GET' && pathname.match(/^\/api\/poster\/[^/]+\.png$/)) {
    const id = pathname.split('/')[3].replace(/\.png$/, '');
    const fp = path.join(__dirname, 'posters', id, 'poster.png');
    if (fs.existsSync(fp)) {
      // 支持缩略图参数 ?w=260
      const urlParams = new URL(req.url, 'http://localhost').searchParams;
      const thumbWidth = parseInt(urlParams.get('w')) || 0;
      
      if (thumbWidth > 0 && thumbWidth < 780) {
        // 生成缩略图
        res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
        const { spawn } = require('child_process');
        const args = [fp, '-resize', thumbWidth + 'x', '-quality', '85', 'png:-'];
        const ps = spawn('convert', args); // ImageMagick
        ps.stdout.pipe(res);
        ps.stderr.on('data', () => {});
        ps.on('error', () => {
          // ImageMagick 不可用，回退到原图
          fs.createReadStream(fp).pipe(res);
        });
      } else {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        fs.createReadStream(fp).pipe(res);
      }
    } else { res.writeHead(404); res.end('Not Found'); }
    return;
  }

  // API: 下载 PNG (旧格式: /api/poster/{id}/png) — 兼容旧链接
  if (req.method === 'GET' && pathname.startsWith('/api/poster/') && pathname.endsWith('/png')) {
    const parts = pathname.split('/');
    const id = parts[3];
    const fp = path.join(__dirname, 'posters', id, 'poster.png');
    if (fs.existsSync(fp)) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      fs.createReadStream(fp).pipe(res);
    } else { res.writeHead(404); res.end('Not Found'); }
    return;
  }

  // API: 获取单张海报 meta
  if (req.method === 'GET' && pathname.match(/^\/api\/poster\/[^/]+\/meta\.json$/)) {
    const id = pathname.split('/')[3];
    const fp = path.join(__dirname, 'posters', id, 'meta.json');
    if (fs.existsSync(fp)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      fs.createReadStream(fp).pipe(res);
    } else { res.writeHead(404); res.end('Not Found'); }
    return;
  }

  res.writeHead(404); res.end('Not Found');
});

const PORT = process.env.PORT || 3008;
server.listen(PORT, () => console.log('🎉 PosterHub 运行中: http://localhost:' + PORT));
