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
# 生成海报
curl -X POST http://localhost:3008/api/generate \
  -H "Content-Type: application/json" \
  -d '{"nl": "https://github.com/facebook/react", "lang": "zh"}'

# 参数说明
# nl: GitHub URL / 本地路径 / 项目描述
# lang: "zh"（默认）或 "en"
# theme: "apple" / "dark" / "cyber" / "cpython" / "inventory"
```

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

## License

MIT
