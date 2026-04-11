/**
 * github-utils.js - GitHub API 获取 + Design MD 解析
 * 从 server.js 提取（~400行）
 */
const { execSync } = require('child_process');

// ═══════════════════════════════════════════
//  GitHub API 获取
// ═══════════════════════════════════════════

function fetchGitHub(nlText) {
  const match = nlText.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!match) return null;
  const [, owner, repo] = match;
  console.log('🔍 GitHub API: ' + owner + '/' + repo);

  try {
    const ghToken = process.env.GITHUB_TOKEN || '';
    const authHdr = ghToken ? `-H "Authorization: token ${ghToken}"` : '';

    // 1. 获取 repo 元数据
    const apiData = execSync(
      `curl -sL "https://api.github.com/repos/${owner}/${repo}" -H "Accept: application/json" -H "User-Agent: PosterHub/1.0" ${authHdr} --max-time 10`,
      { encoding: 'utf8' }
    );
    const info = JSON.parse(apiData);

    // 2. 获取 README（中英文）
    let readme = '', readmeEn = '';
    const readmeFiles = [
      ['README.md', 'readme'], ['README_EN.md', 'readmeEn'], ['README.zh.md', 'readme']
    ];
    for (const [fname, varName] of readmeFiles) {
      for (const branch of ['main', 'master']) {
        try {
          const rd = execSync(
            `curl -sL "https://api.github.com/repos/${owner}/${repo}/contents/${fname}?ref=${branch}" -H "Accept: application/json" -H "User-Agent: PosterHub/1.0" ${authHdr} --max-time 10`,
            { encoding: 'utf8' }
          );
          const parsed = JSON.parse(rd);
          if (parsed.content) {
            const content = Buffer.from(parsed.content, 'base64').toString('utf8');
            if (varName === 'readme') readme = content;
            else readmeEn = content;
            break;
          }
        } catch (e) {}
      }
    }

    // 3. 获取 SKILL.md
    let skillMd = '';
    for (const branch of ['main', 'master']) {
      try {
        const rd = execSync(
          `curl -sL "https://api.github.com/repos/${owner}/${repo}/contents/SKILL.md?ref=${branch}" -H "Accept: application/json" -H "User-Agent: PosterHub/1.0" ${authHdr} --max-time 10`,
          { encoding: 'utf8' }
        );
        const parsed = JSON.parse(rd);
        if (parsed.content) { skillMd = Buffer.from(parsed.content, 'base64').toString('utf8'); break; }
      } catch (e) {}
    }

    const stars = info.stargazers_count || 0;
    const lang = info.language || '';
    const desc = info.description || '';
    const topics = (info.topics || []).slice(0, 8);

    const starsStr = stars > 0 ? '，⭐ ' + stars + ' stars' : '';
    const langStr = lang ? '，技术栈：' + lang : '';
    const topicsStr = topics.length > 0 ? '，标签：' + topics.join(' / ') : '';
    const finalNl = owner + '/' + repo + ' - ' + (desc || repo) + starsStr + langStr + topicsStr;

    const starsStrEn = stars > 0 ? ', ⭐ ' + stars + ' stars' : '';
    const langStrEn = lang ? ', Tech: ' + lang : '';
    const topicsStrEn = topics.length > 0 ? ', Tags: ' + topics.join(' / ') : '';
    const finalNlEn = owner + '/' + repo + ' - ' + (desc || repo) + starsStrEn + langStrEn + topicsStrEn;

    console.log('✅ GitHub: ' + owner + '/' + repo + ' ⭐' + stars + ' Lang:' + lang + ' SKILL:' + (skillMd ? 'YES' : 'NO') + ' README:' + (readme ? 'YES' : 'NO'));

    const isPrivate = info.private === true;
    if (isPrivate && !readme) {
      return { error: '私有仓库且无 README', notice: '🔒 私有仓库，可能缺少 README 内容' };
    }
    return {
      name: repo, owner, stars, lang, desc, topics, techs: [],
      readme, readmeEn, skillMd,
      nl: finalNl, nlEn: finalNlEn,
      designMd: null
    };
  } catch (e) {
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

// ═══════════════════════════════════════════
//  DESIGN.md 获取 + 解析
// ═══════════════════════════════════════════

function fetchDesignMd(owner, repo) {
  const ghToken = process.env.GITHUB_TOKEN || '';
  const authHdr = ghToken ? `-H "Authorization: token ${ghToken}"` : '';
  for (const branch of ['main', 'master']) {
    try {
      const rd = execSync(
        `curl -sL "https://api.github.com/repos/${owner}/${repo}/contents/DESIGN.md?ref=${branch}" -H "Accept: application/json" -H "User-Agent: PosterHub/1.0" ${authHdr} --max-time 10`,
        { encoding: 'utf8' }
      );
      const parsed = JSON.parse(rd);
      if (parsed.content) {
        const content = Buffer.from(parsed.content, 'base64').toString('utf8');
        console.log('✅ 读取到 DESIGN.md（' + content.length + ' 字符）');
        return content;
      }
    } catch (e) {}
  }
  console.log('⚠️ 未找到 DESIGN.md，将使用默认主题');
  return null;
}

function fetchBestDesignMdFromAwesome(owner, repo, desc, lang, topics) {
  const ghToken = process.env.GITHUB_TOKEN || '';
  const authHdr = ghToken ? `-H "Authorization: token ${ghToken}"` : '';

  // VoltAgent awesome-design-md 模板列表
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

  const keywordMatches = [
    { kw: 'typescript', slug: 'linear' }, { kw: 'typescript', slug: 'vercel' },
    { kw: 'python', slug: 'neon' }, { kw: 'ai', slug: 'openai' },
    { kw: 'chatbot', slug: 'openai' }, { kw: 'stripe', slug: 'stripe' },
    { kw: 'payment', slug: 'stripe' }, { kw: 'docker', slug: 'docker' },
    { kw: 'container', slug: 'docker' }, { kw: 'figma', slug: 'figma' },
    { kw: 'design', slug: 'figma' }, { kw: 'github', slug: 'github' },
    { kw: 'git', slug: 'github' }, { kw: 'linear', slug: 'linear' },
    { kw: 'project management', slug: 'linear' }, { kw: 'notion', slug: 'notion' },
    { kw: 'note', slug: 'notion' }, { kw: 'vercel', slug: 'vercel' },
    { kw: 'deploy', slug: 'vercel' }, { kw: 'frontend', slug: 'vercel' },
    { kw: 'openai', slug: 'openai' }, { kw: 'gpt', slug: 'openai' },
    { kw: 'claude', slug: 'claude' }, { kw: 'cursor', slug: 'cursor' },
    { kw: 'v0', slug: 'v0' }, { kw: 'radix', slug: 'radix' },
    { kw: 'twitter', slug: 'twitter' }, { kw: 'social media', slug: 'twitter' },
    { kw: 'youtube', slug: 'youtube' }, { kw: 'video', slug: 'youtube' },
    { kw: 'spotify', slug: 'spotify' }, { kw: 'music', slug: 'spotify' },
    { kw: 'shopify', slug: 'shopify' }, { kw: 'ecommerce', slug: 'shopify' },
    { kw: 'slack', slug: 'slack' }, { kw: 'chat', slug: 'slack' },
    { kw: 'discord', slug: 'discord' }, { kw: 'community', slug: 'discord' },
    { kw: 'cloudflare', slug: 'cloudflare' }, { kw: 'edge', slug: 'cloudflare' },
    { kw: 'tailwind', slug: 'tailwind' }, { kw: 'css', slug: 'tailwind' },
    { kw: 'supabase', slug: 'supabase' }, { kw: 'database', slug: 'supabase' },
    { kw: 'postgres', slug: 'supabase' }, { kw: 'framer', slug: 'framer' },
    { kw: 'motion', slug: 'framer' }, { kw: 'apple', slug: 'apple' },
    { kw: 'ios', slug: 'apple' }, { kw: 'macos', slug: 'apple' },
    { kw: 'bear', slug: 'bear' }, { kw: 'cal', slug: 'cal' },
    { kw: 'calendar', slug: 'cal' }, { kw: 'loom', slug: 'loom' },
    { kw: 'video recording', slug: 'loom' }, { kw: 'chatgpt', slug: 'chatgpt' },
    { kw: 'midjourney', slug: 'midjourney' }, { kw: 'image gen', slug: 'midjourney' },
    { kw: 'huggingface', slug: 'huggingface' }, { kw: 'ml', slug: 'huggingface' },
  ];

  let bestSlug = null, bestScore = 0;
  for (const { kw, slug } of keywordMatches) {
    if (searchText.includes(kw)) {
      const score = searchText.includes(repo.toLowerCase() + ' ' + kw) ? 3 : 2;
      if (score > bestScore) { bestScore = score; bestSlug = slug; }
    }
  }

  if (!bestSlug) return null;

  for (const branch of ['main', 'master']) {
    try {
      const path = `design-md/${bestSlug}/DESIGN.md`;
      const rd = execSync(
        `curl -sL "https://api.github.com/repos/VoltAgent/awesome-design-md/contents/${path}?ref=${branch}" -H "Accept: application/json" -H "User-Agent: PosterHub/1.0" ${authHdr} --max-time 10`,
        { encoding: 'utf8' }
      );
      const parsed = JSON.parse(rd);
      if (parsed.content) {
        const content = Buffer.from(parsed.content, 'base64').toString('utf8');
        console.log('✅ 从 awesome-design-md 匹配到 ' + bestSlug + ' 风格');
        return content;
      }
    } catch (e) {}
  }
  return null;
}

function parseDesignMd(mdContent) {
  if (!mdContent) return null;
  try {
    const spec = {
      colors: [], primaryColor: null, accentColor: null,
      bgColor: null, bgColorAlt: null, textColor: null,
      textColorAlt: null, dividerColor: null, semanticColors: {},
      fontFamily: null, fontDisplay: null, fontBody: null,
      mood: '', moodShort: '', borderRadius: null, isDark: false,
    };

    spec.colors = [...new Set(mdContent.match(/#[0-9a-fA-F]{3,8}/g) || [])];

    // 表格格式解析
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

    // 叙述式色值提取
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

    const roleExtractors = [
      { key: 'accentColor', names: ['apple blue', 'accent', 'cta', '#0071e3', 'interactive', 'blue', 'highlight'] },
      { key: 'primaryColor', names: ['pure black', 'primary', 'brand', '#000000'] },
      { key: 'bgColor', names: ['light gray', 'light grey', '#f5f5f7', 'fafafc', 'background', 'near white'] },
      { key: 'bgColorAlt', names: ['pure black', '#000000', 'dark background', 'black', 'dark section'] },
      { key: 'textColor', names: ['near black', '#1d1d1f', 'primary text', 'dark text', 'black text'] },
      { key: 'textColorAlt', names: ['white', '#ffffff', 'ffffff', 'on dark', 'text on dark'] },
    ];

    for (const { key, names } of roleExtractors) {
      if (!spec[key]) {
        const found = findInText(names);
        if (found) spec[key] = found;
      }
    }

    // 语义色表覆盖
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

    // 深色主题判断
    if (spec.primaryColor && (spec.primaryColor === '#000000' || spec.primaryColor === '#000')) {
      spec.isDark = true;
    }
    if (!spec.isDark && spec.bgColor) {
      const bgHex = spec.bgColor.replace('#', '');
      const r = parseInt(bgHex.slice(0, 2), 16);
      const g = parseInt(bgHex.slice(2, 4), 16);
      const b = parseInt(bgHex.slice(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (luminance < 0.4) spec.isDark = true;
    }

    // 字体提取
    const fontMatch = mdContent.match(/(?:font[- ]*family|字体|Font Family)[：:\s]*([^\n,|`]+)/i);
    if (fontMatch) {
      const fonts = fontMatch[1].split(',').map(f => f.trim().replace(/[`*]/g, ''));
      spec.fontFamily = fonts[0];
    }
    const displayMatch = mdContent.match(/display.*?font[：:\s]*([^\n,|`]+)/i);
    if (displayMatch) spec.fontDisplay = displayMatch[1].split(',')[0].trim().replace(/[`*]/g, '');
    const bodyMatch = mdContent.match(/body.*?font[：:\s]*([^\n,|`]+)/i);
    if (bodyMatch) spec.fontBody = bodyMatch[1].split(',')[0].trim().replace(/[`*]/g, '');

    // 氛围描述
    const moodMatch = mdContent.match(/##\s*\d+\.\s*Visual Theme[^#]*?(?=\n##|\n#|$)/is);
    if (moodMatch) {
      const raw = moodMatch[0].replace(/[#*`\n]/g, ' ').replace(/\s+/g, ' ').trim();
      spec.mood = raw.slice(0, 300);
      spec.moodShort = raw.slice(0, 80);
    }

    const radiusMatch = mdContent.match(/(?:radius|pill)[^0-9]*(\d+)/i);
    if (radiusMatch) spec.borderRadius = parseInt(radiusMatch[1]);

    console.log('📐 parseDesignMd: primary=' + spec.primaryColor + ', accent=' + spec.accentColor + ', bg=' + spec.bgColor + ', isDark=' + spec.isDark);
    return spec;
  } catch (e) {
    console.log('⚠️ parseDesignMd 解析失败: ' + e.message);
    return null;
  }
}

module.exports = { fetchGitHub, fetchDesignMd, fetchBestDesignMdFromAwesome, parseDesignMd };
