require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { execSync } = require('child_process');
const { generateFromNaturalLanguage, generateFromConfig } = require('./generator');
const { scanProjectDir, analyzeWithLLM } = require('./local-llm');
const { hiresPoster } = require('./screenshot');

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
      nl: finalNl, nlEn: finalNlEn
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

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (req.method === 'OPTIONS') { setCors(res); res.writeHead(204); res.end(); return; }

  // 静态文件
  if (pathname.startsWith('/web/')) {
    const fp = path.join(__dirname, pathname);
    const ext = path.extname(fp);
    const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png' };
    if (fs.existsSync(fp)) {
      res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
      fs.createReadStream(fp).pipe(res);
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
        const { nl, lang = 'zh', inputType = 'url' } = JSON.parse(body);
        let finalNl = nl;
        let ghData = null;
        let posterConfig;

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
          if (ghData) {
            finalNl = lang === 'en' ? ghData.nlEn : ghData.nl;
            console.log('🧠 OpenClaw 正在学习: ' + ghData.owner + '/' + ghData.name);
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
        if (ghData) {
          finalNl = lang === 'en' ? ghData.nlEn : ghData.nl;
        } else if (localData) {
          // 用 LLM 分析整个项目目录
          console.log('🔍 正在扫描目录: ' + localData.root);
          const scan = scanProjectDir(localData.root);
          console.log('📁 扫描到 ' + scan.files.length + ' 个文件');
          const llmResult = await analyzeWithLLM(localData.root, localData.name, scan);
          if (llmResult) {
            // 构建海报配置
            let builtConfig = {
              theme: 'apple-minimal',
              hero: {
                badge: llmResult.badge || '📁 本地项目',
                title: llmResult.title || localData.name,
                subtitle: llmResult.description || '本地项目'
              },
              sections: (llmResult.sections || []).map(sec => ({
                label: sec.label,
                items: sec.items.map(item => ({
                  emoji: item.emoji || '📌',
                  title: item.title,
                  desc: item.desc || '',
                  badge: item.badge || '',
                  color: item.color || '#8B7355'
                }))
              })),
              stats: [],
              footer: {
                line1: llmResult.footer1 || 'Powered by PosterHub',
                line2: llmResult.footer2 || 'AI驱动的项目简介生成器'
              },
              projectLink: ''
            };
            posterConfig = builtConfig;
            const techs = llmResult.techStack ? llmResult.techStack.join(' / ') : '';
            finalNl = (llmResult.title || localData.name) + ' - ' + (llmResult.description || '') + (techs ? '，技术栈：' + techs : '');
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

        // 用 AI 生成海报
        const { html, theme } = posterConfig
          ? generateFromConfig(posterConfig)
          : generateFromNaturalLanguage(finalNl, { lang });

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

        const warnings = [];
        if (!ghData && localData && !localData.readme && !posterConfig) warnings.push('📁 该目录无 README.md，内容可能不完整');
        if (ghData && ghData.notice) warnings.push(ghData.notice);
        json(res, 200, { ok: true, posterId: id, title: meta.title, github: meta.github, stars: meta.stars, hasSkill: meta.hasSkill, warnings });
      } catch(e) {
        console.error('❌ 生成失败: ' + e.message);
        json(res, 500, { ok: false, error: e.message });
      }
    });
    return;
  }

  // API: 列表
  if (req.method === 'GET' && pathname === '/api/list') {
    const posters = [];
    if (fs.existsSync('./posters')) {
      for (const id of fs.readdirSync('./posters')) {
        const mp = path.join('./posters', id, 'meta.json');
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
    const id = pathname.split('/')[3].replace('\.png', '');
    const fp = path.join(__dirname, 'posters', id, 'poster.png');
    if (fs.existsSync(fp)) {
      const cd = 'attachment; filename="' + id + '.png"';
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Disposition': cd });
      fs.createReadStream(fp).pipe(res);
    } else { res.writeHead(404); res.end('Not Found'); }
    return;
  }

  // API: 下载 PNG (旧格式: /api/poster/{id}/png) — 兼容旧链接
  if (req.method === 'GET' && pathname.startsWith('/api/poster/') && pathname.endsWith('/png')) {
    const parts = pathname.split('/');
    const id = parts[3];
    const fp = path.join(__dirname, 'posters', id, 'poster.png');
    if (fs.existsSync(fp)) {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename="' + id + '.png"' });
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
