---
name: poster-hub
description: Generate AI-powered project poster cards from GitHub URLs or local project paths. Activates when user wants to create a project introduction poster.
---

# 🖼️ PosterHub

> Generate beautiful HD project posters (780px) from a GitHub URL or local project path.

中文 | [English](#english)

## 快速使用

```bash
git clone https://github.com/YaoIsAI/poster-hub.git
cd poster-hub
npm install
npx @sparticuz/chromium install  # 安装浏览器（约100MB）
node server.js
# 服务运行在 http://localhost:3008
```

**给 AI 下命令：**
```
"帮我生成 facebook/react 的海报"
"Create a poster for ~/my-project"
"检查这个项目并生成海报"
```

**给 OpenClaw 的最简描述（直接复制）：**
```text
学习 https://raw.githubusercontent.com/YaoIsAI/poster-hub/main/SKILL.md，并在我说“生成项目海报”时自动调用它。
```

---

## 🏗️ 系统架构

```
GitHub URL / 本地路径
       ↓
  GitHub API / github-utils.js
       ↓
  VoltAgent DESIGN.md 设计系统（自动匹配）
       ↓
  LLM 驱动自适应 CSS 生成
       ↓
  poster-validator.js + validatePosterStructure()
       ↓
  Playwright/Chromium 截图 → PNG 海报
```

### 设计系统（VoltAgent awesome-design-md）

系统会自动从 [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) 仓库匹配设计模板。

**匹配规则：**
- 按技术栈关键词匹配（TypeScript → Linear/Vercel, Python → Supabase, etc.）
- 按项目名称/描述匹配
- 深色主题会被自动反转为浅色主题

**内置轻量模板：** apple-minimal / warm-earth / tech-blue / creative

### LLM 驱动

PosterHub 使用 **自适应 CSS 生成器**，LLM 根据内容长度自动计算：
- 标题字号（clamp 响应式）
- 卡片布局（flex 换行）
- 文本溢出处理（ellipsis / 换行）
- 统计数字字号

支持 **任意 OpenAI 兼容 API**，包括：

| 提供商 | Base URL | 模型 |
|--------|---------|------|
| **DeepSeek** | `https://api.deepseek.com/v1` | deepseek-chat |
| **OpenAI** | `https://api.openai.com/v1` | gpt-4o-mini |
| **Qwen (阿里云)** | `https://dashscope.aliyuncs.com/v1` | qwen-turbo |
| **SiliconFlow** | `https://api.siliconflow.cn/v1` | deepseek-chat |
| **MiniMax** | `https://api.minimaxi.com/v1` | MiniMax-M2.1 |
| **Ollama (本地)** | `http://localhost:11434/v1` | llama3 / qwen2.5 / codellama |

> 💡 **本地模型（Ollama）**：如果使用 Ollama 本地模型，无需 API Key，只需设置 `LLM_API_KEY=ollama` 和 `LLM_BASE_URL=http://localhost:11434/v1`

GitHub 项目链路还支持：
- `analyzeReadmeWithLLM()`：优先分析 README / README_EN
- `poster-validator.js`：对内容字段做 Harness 校验
- `prompt-generator.js`：对 HTML 结构做二次校验

---

## 配置

```bash
cp .env.example .env
# 编辑 .env 填入配置
```

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `LLM_API_KEY` | OpenAI 兼容 API Key（或 `ollama`） | 无 |
| `LLM_BASE_URL` | LLM API 端点（支持 OpenAI 兼容接口 / Ollama） | MiniMax |
| `LLM_MODEL` | 模型名称 | MiniMax-M2.1 |
| `GITHUB_TOKEN` | GitHub API Token（提高限流阈值） | 无 |
| `PORT` | 服务端口 | 3008 |

---

## API

```bash
# 生成项目海报（GitHub / 本地项目）
curl -X POST http://localhost:3008/api/generate \
  -H "Content-Type: application/json" \
  -d '{"nl": "https://github.com/facebook/react", "lang": "zh"}'

# 生成通用海报（任意内容描述）
curl -X POST http://localhost:3008/api/prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt": "生成一张微信风格的朋友圈推广海报，内容是...", "type": "wechat", "lang": "zh"}'

# 支持的类型: wechat / xiaohongshu / performance / corporate / custom
```

### API 参数

**/api/generate:**
- `nl`: GitHub URL / 本地路径 / 项目描述
- `lang`: "zh"（默认）或 "en"
- `inputType`: "url"（默认）或 "browse"

**/api/prompt:**
- `prompt`: 海报内容描述（必须）
- `type`: 海报类型（wechat/xiaohongshu/performance/corporate/custom）
- `lang`: "zh" 或 "en"
- `width`: 海报宽度（默认 780px）
- `height`: 海报高度（可选，用于固定比例）
- 内部闭环：规划(JSON) -> 生成(HTML) -> 审查 -> 自动纠偏(最多3轮) -> PNG导出

**设置相关 API（用于 web/settings.html）：**
- `GET /api/settings`
- `POST /api/settings`
- `POST /api/settings/test`
- `GET /api/models`
- `GET /api/progress/:progressId`（查询真实进度阶段）

诊断字段说明：
- `POST /api/settings/test`：返回 `reachable`、`message`、`details`、`tried`
- `GET /api/models`：返回 `models`、`modelCount`、`suggestedBaseUrl`、`autoDiscovered`

**调用建议：**
- 默认项目分析海报：优先 `/api/generate`
- 用户指定风格类型（wechat/xiaohongshu/performance/corporate/custom）：使用 `/api/prompt`

---

## 🌳 本地项目输入（完整流程）

当用户给的是本地路径（如 `~/my-project`）时，系统会：

```
1. autoDetectLocal() → 检测项目类型（Node.js / Python / Go / Rust / Java 等）
2. scanProjectDir() → 扫描项目所有文件：
   - 读取关键文件: package.json / pyproject.toml / Cargo.toml / go.mod / README.md / SPEC.md
   - 读取目录结构（最多50个文件，50KB/文件）
   - 跳过: node_modules / .git / dist / build / 二进制文件
3. analyzeWithLLM() → 用 LLM 分析项目内容：
   - 读取所有关键文件内容
   - 生成海报配置 JSON（title/description/techStack/sections/footer）
   - 支持自动识别功能模块、API、特性
4. generateAdaptiveCSS() → 根据配置生成自适应海报
```

**注意：本地项目需要配置 LLM_API_KEY**，否则会回退到简陋的 README 提取。

GitHub 项目额外会：

```text
1. fetchGitHub() -> 获取 repo 元信息
2. analyzeReadmeWithLLM() -> 从 README / README_EN 提炼结构化内容
3. fetchDesignMd() / fetchBestDesignMdFromAwesome() -> 补充设计规范
4. generator.js / prompt-generator.js -> 输出 HTML
5. poster-validator.js + validatePosterStructure() -> 进行 Harness 校验
```

支持的本地路径：
- `~/my-project`
- `./my-project`
- 相对路径（如 `inventory-management`）

---

## 给 AI 助手的说明

当你学会这个技能后：

1. **启动服务** — `cd poster-hub && node server.js`
2. **调用 API** — `POST /api/generate`
3. **返回海报 ID** — 拼装 `GET /api/poster/:posterId.png` 下载链接
4. **主动告知用户** — 告诉用户海报已生成，提供下载链接

**处理模糊输入：**
- 用户说"这个项目" → 识别当前目录，生成海报
- 用户说"帮我生成海报" → 尝试在桌面或工作目录找项目
- 用户说中文/英文 → 自动设置 lang 参数

## 首次使用主动引导（非常重要）

AI 助手在首次使用本技能时，应主动执行以下引导：

1. 先确认服务状态：`GET /health` 或提示用户启动 `node server.js`
2. 引导用户打开设置页：`http://localhost:3008/web/settings.html`
3. 引导配置并检查：
   - `LLM_BASE_URL`
   - `LLM_MODEL`
   - `LLM_API_KEY`（Ollama 可填 `ollama`）
4. 调用 `POST /api/settings/test` 检查连通性
5. 如果是 GitHub 项目分析场景，建议用户配置 `GITHUB_TOKEN`
6. 若检测失败，返回明确错误（如端口不通、模型名不存在），并提供下一步修复建议

**本地项目示例：**
```
用户: "帮我生成 ~/Desktop/openclaw/projects/inventory-management 的海报"
AI: 
  1. 扫描目录，读取 package.json / README.md 等
  2. 调用 analyzeWithLLM() 分析项目
  3. 生成海报配置（标题/技术栈/功能模块）
  4. 调用 generateAdaptiveCSS() 生成海报
  5. 返回海报下载链接
```

## License

MIT

---

## English

## Quick Start

```bash
git clone https://github.com/YaoIsAI/poster-hub.git
cd poster-hub
npm install
npx @sparticuz/chromium install
node server.js
# Server runs at http://localhost:3008
```

**Tell your AI:**
```text
"Generate a poster for facebook/react"
"Create a poster for ~/my-project"
"Analyze this project and generate a poster"
```

**Minimal OpenClaw prompt (copy-paste):**
```text
Learn https://raw.githubusercontent.com/YaoIsAI/poster-hub/main/SKILL.md and auto-call it whenever I ask for a project poster.
```

---

## 🏗️ System Architecture

```text
GitHub URL / Local path
       ↓
GitHub API / github-utils.js
       ↓
Match VoltAgent DESIGN.md spec (auto)
       ↓
LLM-driven adaptive CSS generation
       ↓
poster-validator.js + validatePosterStructure()
       ↓
Playwright/Chromium screenshot -> PNG
```

### Design System (VoltAgent awesome-design-md)

PosterHub can match templates from [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md).

**Matching rules**
- Match by tech-stack keywords
- Match by project name/description
- Dark templates can be inverted when needed

**Built-in fallback templates**
- `apple-minimal` / `warm-earth` / `tech-blue` / `creative`

### LLM-driven adaptive layout

LLM computes adaptive style based on content length:
- title typography (responsive clamp)
- card/grid wrapping
- text overflow behavior
- key metric typography

Supports OpenAI-compatible APIs (DeepSeek, OpenAI, Qwen, SiliconFlow, MiniMax, Ollama).

---

## Configuration

```bash
cp .env.example .env
# Edit .env values
```

| Env | Description | Default |
|-----|-------------|---------|
| `LLM_API_KEY` | OpenAI-compatible API key (or `ollama`) | none |
| `LLM_BASE_URL` | LLM API endpoint (OpenAI-compatible / Ollama supported) | MiniMax |
| `LLM_MODEL` | Model name | MiniMax-M2.1 |
| `GITHUB_TOKEN` | GitHub token for higher rate limit | none |
| `PORT` | Server port | 3008 |

---

## API

```bash
# Project poster generation (GitHub / local project)
curl -X POST http://localhost:3008/api/generate \
  -H "Content-Type: application/json" \
  -d '{"nl": "https://github.com/facebook/react", "lang": "en"}'

# Generic style-based poster generation
curl -X POST http://localhost:3008/api/prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create a WeChat style promo poster for an AI project", "type": "wechat", "lang": "en"}'
```

**Parameters**
- `/api/generate`: `nl`, `lang`, `inputType`
- `/api/prompt`: `prompt`, `type`, `lang`, `width`
- `/api/progress/:progressId`: read backend real-time stage
- `/api/settings/test`: returns `reachable`, `message`, `details`, `tried`
- `/api/models`: returns `models`, `modelCount`, `suggestedBaseUrl`, `autoDiscovered`

**Routing recommendation**
- Use `/api/generate` for project analysis posters
- Use `/api/prompt` when user explicitly asks for a poster type/style

---

## 🌳 Local Project Input Flow

When user input is a local path:

```text
1. autoDetectLocal() -> detect project type
2. scanProjectDir() -> read key files + structure
3. analyzeWithLLM() -> derive title/description/tech stack/modules
4. generateAdaptiveCSS() -> build adaptive poster
```

**Note**
- Local project quality depends on `LLM_API_KEY`
- Without LLM key, it falls back to lightweight README extraction

GitHub projects additionally use:

```text
1. fetchGitHub() -> repo metadata
2. analyzeReadmeWithLLM() -> structured README summary
3. fetchDesignMd() / fetchBestDesignMdFromAwesome() -> design spec lookup
4. poster-validator.js + validatePosterStructure() -> Harness validation
```

---

## Instructions for AI Assistants

After learning this skill:
1. Start service: `cd poster-hub && node server.js`
2. Call API: `POST /api/generate` (or `/api/prompt` for explicit styles)
3. Return poster URL: `GET /api/poster/:posterId.png`
4. Proactively inform user that poster is ready

Handle vague input:
- "this project" -> infer current workspace
- "generate a poster" -> try nearby project folders
- Chinese/English input -> set `lang` automatically

## First-Run Proactive Onboarding (Required)

On first use, the AI assistant should proactively:

1. Check service availability (`GET /health`) or ask user to run `node server.js`
2. Ask user to open `http://localhost:3008/web/settings.html`
3. Guide configuration for:
   - `LLM_BASE_URL`
   - `LLM_MODEL`
   - `LLM_API_KEY` (`ollama` is acceptable for Ollama)
4. Run `POST /api/settings/test` for connectivity
5. Recommend `GITHUB_TOKEN` for GitHub API-heavy use cases
6. If failed, return actionable diagnostics (unreachable host, wrong model, auth issue) and next-step fix

## License

MIT
