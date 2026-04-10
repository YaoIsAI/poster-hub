const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ============================================================
// LLM 配置（支持任意 OpenAI 兼容 API）
// 每次调用实时读取，避免设置页更新后必须重启才生效
// ============================================================
function getLlmRuntimeConfig() {
  return {
    apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.minimaxi.com/v1',
    model: process.env.LLM_MODEL || 'MiniMax-M2.1',
  };
}

function extractAndParseJsonFromLLM(content) {
  const raw = String(content || '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('LLM 返回格式无效（缺少 JSON）');
  const base = raw.substring(start, end + 1);

  const attempts = [];
  attempts.push(base);
  attempts.push(
    base
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .replace(/\u201c|\u201d/g, '"')
      .replace(/\u2018|\u2019/g, "'")
      .replace(/^\uFEFF/, '')
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
  );
  attempts.push(
    attempts[1]
      .replace(/([{,]\s*)'([^']+?)'\s*:/g, '$1"$2":')
      .replace(/:\s*'([^']*?)'(\s*[,}\]])/g, ':"$1"$2')
  );

  let lastErr = null;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('JSON 解析失败');
}

async function postJsonWithCurlFallback({ endpoint, apiKey, payload, timeoutMs = 30000 }) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true, data: JSON.parse(text), transport: 'fetch' };
  } catch (e) {
    const args = [
      '-sS',
      '-m', String(Math.ceil(timeoutMs / 1000)),
      '-X', 'POST',
      endpoint,
      '-H', `Authorization: Bearer ${apiKey}`,
      '-H', 'Content-Type: application/json',
      '-d', '@-'
    ];
    const cp = spawnSync('curl', args, {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024
    });
    if (cp.status !== 0) {
      const stderr = (cp.stderr || cp.error?.message || '').trim();
      return { ok: false, error: `fetch/curl 均失败: ${stderr || e.message}` };
    }
    try {
      return { ok: true, data: JSON.parse(cp.stdout), transport: 'curl' };
    } catch (parseErr) {
      return { ok: false, error: `curl 返回非 JSON: ${(cp.stdout || '').slice(0, 160)}` };
    }
  }
}

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
  const llm = getLlmRuntimeConfig();
  if (!llm.apiKey) {
    const reason = '未配置 LLM_API_KEY';
    console.log('LLM 分析跳过（' + reason + '）');
    return { config: null, error: reason };
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

  async function callAnalysis(userPrompt) {
    const endpoint = `${llm.baseUrl}/chat/completions`;
    return postJsonWithCurlFallback({
      endpoint,
      apiKey: llm.apiKey,
      payload: {
        model: llm.model,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 4000,
        temperature: 0.2,
        response_format: { type: 'json_object' }
      },
      timeoutMs: 45000
    });
  }

  try {
    const call = await callAnalysis(prompt);
    if (!call.ok) {
      console.log('LLM API error:', call.error);
      return { config: null, error: call.error };
    }
    const data = call.data || {};
    let content = data.choices?.[0]?.message?.content || '';
    let config = null;
    try {
      config = extractAndParseJsonFromLLM(content);
    } catch (firstErr) {
      // 让 LLM 将“非严格 JSON 输出”修复为合法 JSON，降低回退概率
      const repairPrompt = `请把下面这段内容修复为合法 JSON（只输出 JSON 对象，不要解释）：\n\n${content}`;
      const repairCall = await callAnalysis(repairPrompt);
      if (!repairCall.ok) throw firstErr;
      const repairContent = repairCall.data?.choices?.[0]?.message?.content || '';
      config = extractAndParseJsonFromLLM(repairContent);
    }
    console.log(`LLM 分析完成: ${config.title || name}, techs: ${config.techStack ? config.techStack.length : 0}, sections: ${config.sections ? config.sections.length : 0}, model: ${llm.model}`);
    console.log('📋 LLM 返回配置:', JSON.stringify(config).slice(0, 500));
    return { config, error: null };
  } catch(e) {
    console.log('LLM 请求失败:', e.message);
    return { config: null, error: 'LLM 请求失败: ' + e.message };
  }
}

// 分析 GitHub README 的函数
async function analyzeReadmeWithLLM(readme, name) {
  const llm = getLlmRuntimeConfig();
  if (!llm.apiKey) {
    const reason = '未配置 LLM_API_KEY';
    console.log('README LLM 分析跳过（' + reason + '）');
    return { config: null, error: reason };
  }

  // 限制 readme 长度，避免超限
  const truncatedReadme = readme.slice(0, 12000);

  const prompt = `你是一个专业的项目分析助手。请分析以下 GitHub 项目的 README 内容，生成项目简介海报的配置信息。

项目名称: ${name}

README 内容:
${truncatedReadme}

请以 JSON 格式返回海报配置，必须包含以下字段：
{
  "title": "项目名称",
  "badge": "标签，如：开源项目 / 工具库 / 框架",
  "description": "2-3句话的项目描述",
  "techStack": ["技术1", "技术2", ...],
  "features": ["功能1", "功能2", ...],
  "sections": [
    {
      "label": "模块名称",
      "items": [
        {"emoji": "图标", "title": "功能名称", "desc": "简短描述", "badge": "标签"}
      ]
    }
  ],
  "footer1": "底部标语第一行",
  "footer2": "底部标语第二行"
}

要求：技术栈最多8个，features最多6个，sections最多3个模块，JSON必须合法，直接返回JSON。`;

  async function callAnalysis(userPrompt) {
    const endpoint = `${llm.baseUrl}/chat/completions`;
    return postJsonWithCurlFallback({
      endpoint,
      apiKey: llm.apiKey,
      payload: {
        model: llm.model,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 4000,
        temperature: 0.2,
        response_format: { type: 'json_object' }
      },
      timeoutMs: 45000
    });
  }

  try {
    const call = await callAnalysis(prompt);
    if (!call.ok) {
      console.log('README LLM API error:', call.error);
      return { config: null, error: call.error };
    }
    const data = call.data || {};
    let content = data.choices?.[0]?.message?.content || '';
    let config = null;
    try {
      config = extractAndParseJsonFromLLM(content);
    } catch (firstErr) {
      const repairPrompt = `请把下面这段内容修复为合法 JSON（只输出 JSON 对象，不要解释）：\n\n${content}`;
      const repairCall = await callAnalysis(repairPrompt);
      if (!repairCall.ok) throw firstErr;
      const repairContent = repairCall.data?.choices?.[0]?.message?.content || '';
      config = extractAndParseJsonFromLLM(repairContent);
    }
    console.log(`📖 README LLM 分析完成: ${config.title || name}, features: ${config.features ? config.features.length : 0}, sections: ${config.sections ? config.sections.length : 0}`);
    return { config, error: null };
  } catch(e) {
    console.log('README LLM 请求失败:', e.message);
    return { config: null, error: 'LLM 请求失败: ' + e.message };
  }
}

module.exports = { scanProjectDir, analyzeWithLLM, analyzeReadmeWithLLM };
