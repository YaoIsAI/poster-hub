---
name: poster-hub
description: Generate AI-powered project poster cards from GitHub URLs or local project paths. Activates when user wants to create a project introduction poster.
---

# 🖼️ PosterHub

> Generate beautiful HD project posters (780px) from a GitHub URL or local project path.

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

---

## 🏗️ 系统架构

```
GitHub URL / 本地路径
       ↓
  GitHub API 获取项目信息
       ↓
  VoltAgent DESIGN.md 设计系统（自动匹配）
       ↓
  LLM 驱动自适应 CSS 生成
       ↓
  Playwright 截图 → PNG 海报
```

### 设计系统（VoltAgent awesome-design-md）

系统会自动从 [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) 仓库匹配设计模板。

**匹配规则：**
- 按技术栈关键词匹配（TypeScript → Linear/Vercel, Python → Supabase, etc.）
- 按项目名称/描述匹配
- 深色主题会被自动反转为浅色主题

**内置轻量模板：** Apple 极简 / 深色科技 / 赛博朋克 / Python 官方 / 库存管理

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

---

## 配置

```bash
cp .env.example .env
# 编辑 .env 填入配置
```

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `LLM_API_KEY` | OpenAI 兼容 API Key（或 `ollama`） | 无 |
| `LLM_BASE_URL` | LLM API 端点 | MiniMax |
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
- `theme`: "apple" / "dark" / "cyber" / "cpython" / "inventory"

**/api/prompt:**
- `prompt`: 海报内容描述（必须）
- `type`: 海报类型（wechat/xiaohongshu/performance/corporate/custom）
- `lang`: "zh" 或 "en"
- `width`: 海报宽度（默认 780px）

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
