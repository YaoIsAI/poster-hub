const fs = require('fs');
const path = require('path');

// ============================================================
// LLM 配置（支持任意 OpenAI 兼容 API）
// AI 助手在使用本技能时，应自动配置以下环境变量
// ============================================================
const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
const LLM_BASE_URL = process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.minimaxi.com/v1';
const LLM_MODEL = process.env.LLM_MODEL || 'MiniMax-M2.1';

// ============================================================
// 扫描项目目录，返回关键文件内容和结构
// ============================================================
function scanProjectDir(root) {
  const MAX_FILES = 50;
  const MAX_FILE_SIZE = 50000;
  const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv', 'venv', 'vendor', 'coverage', '.next', '.nuxt', 'assets', 'public', 'static', '.cache']);
  const SKIP_EXTS = new Set(['.map', '.lock', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.zip', '.tar', '.gz', '.pdf', '.log', '.tmp']);
  const PRIORITY_FILES = {
    'package.json': 'package.json',
    'pyproject.toml': 'pyproject.toml',
    'Cargo.toml': 'Cargo.toml',
    'go.mod': 'go.mod',
    'pom.xml': 'pom.xml',
    'build.gradle': 'build.gradle',
    'CMakeLists.txt': 'CMakeLists.txt',
    'Makefile': 'Makefile',
    '.env': '.env.example',
    'docker-compose.yml': 'docker-compose.yml',
    'Dockerfile': 'Dockerfile',
    'README.md': 'README.md',
    'readme.md': 'readme.md',
    'SPEC.md': 'SPEC.md',
    'architecture.md': 'architecture.md',
    'api.md': 'api.md',
  };

  const result = { files: [], structure: [], priorityContent: {} };

  function walk(dir, depth) {
    if (depth > 4) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        if (SKIP_DIRS.has(entry.name)) continue;
        const fp = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          result.structure.push('  '.repeat(depth) + entry.name + '/');
          walk(fp, depth + 1);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (SKIP_EXTS.has(ext)) continue;
          try {
            const stat = fs.statSync(fp);
            if (stat.size > MAX_FILE_SIZE) continue;
            const content = fs.readFileSync(fp, 'utf8').slice(0, MAX_FILE_SIZE);
            const relPath = path.relative(root, fp);
            result.files.push(relPath);
            if (Object.values(PRIORITY_FILES).includes(entry.name) || entry.name in PRIORITY_FILES) {
              result.priorityContent[relPath] = content;
            }
          } catch(e) {}
        }
      }
    } catch(e) {}
  }

  walk(root, 0);
  return result;
}

// ============================================================
// 用 LLM 分析项目，生成海报配置
// 支持任意 OpenAI 兼容 API（OpenAI / DeepSeek / Claude / Qwen / MiniMax 等）
// ============================================================
async function analyzeWithLLM(root, name, scan) {
  if (!LLM_API_KEY) {
    console.log('LLM 分析跳过（未配置 LLM_API_KEY）');
    return null;
  }

  const structure = scan.structure.slice(0, 80).join('\n');

  let keyFilesSummary = '';
  for (const [fp, content] of Object.entries(scan.priorityContent)) {
    keyFilesSummary += '\n\n=== ' + fp + ' ===\n' + content.slice(0, 4000);
  }

  const prompt = `你是一个专业的项目分析助手。请分析以下项目，生成一张项目简介海报的配置信息。

项目目录结构：
${structure}

关键文件内容：
${keyFilesSummary || '(无关键文件)'}

请以 JSON 格式返回海报配置，必须包含以下字段：
{
  "title": "项目名称（英文或中文）",
  "badge": "标签，如：开源项目 / 个人项目 / 企业项目",
  "description": "2-3句话的项目描述",
  "techStack": ["技术1", "技术2", ...],
  "sections": [
    {
      "label": "模块名称",
      "items": [
        {"emoji": "图标", "title": "功能名称", "desc": "简短描述", "badge": "标签", "color": "#颜色代码"}
      ]
    }
  ],
  "footer1": "底部标语第一行",
  "footer2": "底部标语第二行"
}

要求：技术栈最多8个，sections最多3个模块，JSON必须合法，不要有注释。直接返回JSON。`;

  try {
    // OpenAI 兼容格式
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
        max_tokens: 4000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.log('LLM API error:', response.status, errText.slice(0, 200));
      return null;
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';

    // Extract JSON from response
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    if (jsonStart < 0 || jsonEnd <= jsonStart) {
      console.log('LLM response has no JSON:', content.slice(0, 200));
      return null;
    }

    const jsonStr = content.substring(jsonStart, jsonEnd + 1);
    const config = JSON.parse(jsonStr);
    console.log(`LLM 分析完成: ${config.title || name}, techs: ${config.techStack ? config.techStack.length : 0}, model: ${LLM_MODEL}`);
    return config;
  } catch(e) {
    console.log('LLM 请求失败:', e.message);
    return null;
  }
}

module.exports = { scanProjectDir, analyzeWithLLM };
