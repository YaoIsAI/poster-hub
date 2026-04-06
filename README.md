# 🖼️ PosterHub — AI 项目简介海报生成平台

> 输入 GitHub 地址或本地项目路径，AI 自动分析 README、技术栈、代码结构，生成一张专业的项目介绍海报。

[English](README_EN.md)

---

## 🧭 整体架构

PosterHub 是一个 **本地优先** 的 AI 海报生成工具，由两部分组成：

```
┌─────────────────────────────────────────────┐
│  客户端（浏览器 / AI助手）                     │
│                                             │
│  用户输入: GitHub URL 或本地路径               │
│       ↓                                      │
│  AI助手读取 SKILL.md，学会技能               │
│       ↓                                      │
│  调用 API: POST /api/generate                │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│  PosterHub Server (localhost:3008)           │
│                                             │
│  1. 解析输入 → GitHub API / 本地文件扫描     │
│  2. AI分析 → OpenAI 兼容 LLM 分析（任意模型）│
│  3. 生成海报 → HTML + CSS                   │
│  4. 输出 PNG → Playwright 全页截图           │
│       ↓                                      │
│  返回: posterId → /api/poster/:id/png      │
└─────────────────────────────────────────────┘
```

**核心特点：**
- AI 助手通过 `SKILL.md` 自动学会使用
- 生成的海报底部带有项目 GitHub 地址（自我推广）
- 零成本：支持任意 OpenAI 兼容 LLM（DeepSeek / Qwen / Claude 等）

---

## ✨ 特性

- 🤖 **AI 驱动** — 输入任意项目，AI 自动分析内容生成海报
- 🌐 **中英文** — 界面和海报内容均支持中英双语
- 📱 **高清导出** — 原生 780px 宽，2× 清晰度
- 🌐 **Web 界面** — 无需安装，打开浏览器即可使用
- 🔗 **GitHub 接入** — 粘贴 GitHub 地址，AI 自动分析
- ⚡ **本地运行** — 克隆即运行，无复杂依赖

---

## 🚀 快速开始

### Step 1：安装

```bash
git clone https://github.com/YaoIsAI/poster-hub.git
cd poster-hub
npm install
npx playwright install chromium
```

### Step 2：启动服务

```bash
node server.js
# 服务运行在 http://localhost:3008
```

### Step 3：使用（三种方式）

#### 方式 A：Web 界面（最简单）
打开 http://localhost:3008 ，粘贴 GitHub 地址，点击「生成简介卡」

#### 方式 B：对 AI 助手说（推荐）
安装技能后，对 AI 说：
```
"帮我生成 facebook/react 的海报"
"分析 ~/projects/my-app 并生成海报"
```

#### 方式 C：命令行 / API
```bash
curl -X POST http://localhost:3008/api/generate \
  -H "Content-Type: application/json" \
  -d '{"nl": "https://github.com/facebook/react", "lang": "zh"}'
```

---

## 🤖 AI 助手集成（OpenClaw）

### 工作原理

OpenClaw AI 助手会自动扫描 `~/.openclaw/workspace/skills/` 目录下的所有 `SKILL.md` 文件，学会其中的技能。

当 AI 学会 PosterHub 后，它会：
1. 理解用户「生成海报」的意图
2. 解析 GitHub URL 或本地路径
3. 调用 PosterHub API 获取分析结果
4. 将海报链接返回给用户

### 安装步骤

```bash
# 克隆到 OpenClaw skills 目录
git clone https://github.com/YaoIsAI/poster-hub.git \
  ~/.openclaw/workspace/skills/poster-hub

cd ~/.openclaw/workspace/skills/poster-hub
npm install

# 确保 PosterHub 服务正在运行
node server.js
```

### 给自己的项目添加海报能力

在 GitHub 项目根目录添加 `SKILL.md`，其他 AI 助手就能为该项目生成海报：

```bash
# 1. 复制模板
cp poster-hub/SKILL.md /path/to/your-project/

# 2. 修改项目名称和描述
# 编辑 SKILL.md 中的 name 和 description

# 3. 推送到 GitHub
git add SKILL.md && git commit -m "Add PosterHub skill"
git push
```

## 💬 发送给 AI 的话术案例

安装 PosterHub 后，直接把下面任意一条发给 AI 就行：

### 案例1：生成 GitHub 项目海报
```
帮我生成 facebook/react 的海报
给 https://github.com/microsoft/vscode 生成一张介绍海报
```

### 案例2：生成本地项目海报（模糊表达也可以）
```
帮我生成 ~/my-projects/web-app 的海报
帮我生成一个项目海报
检查一下我的项目生成海报
分析一下这个项目并生成海报
```

### 案例3：生成任意项目的海报
```
帮我分析并生成一个 Vue 项目的简介海报，用中文
给一个 Node.js 后台项目生成海报
```

### 案例4：在 Web 界面使用
直接打开 http://localhost:3008 ，粘贴任意 GitHub 地址，点击「生成简介卡」即可。

---

## 🎯 使用场景

- 📱 **小程序 / APP** — 给产品生成宣传海报
- 🛠️ **AI 工具 / Skill** — 给技能生成介绍海报
- 👤 **个人品牌** — 生成个人介绍海报
- 🏢 **企业产品** — 批量生成产品 / 活动海报
- 📦 **开源项目** — 让别人快速了解你的项目
- 🔬 **AI 研究** — 生成论文 / 项目海报用于分享

---

## 📂 项目结构

```
poster-hub/
├── SKILL.md              # AI 技能定义（AI助手通过此文件学习）
├── README.md             # 中文说明
├── README_EN.md          # 英文说明
├── server.js             # HTTP API 服务（端口 3008）
├── generator.js          # 海报 HTML/CSS 生成引擎
├── screenshot.js         # Playwright 高清截图
├── local-llm.js         # LLM 项目分析（支持任意 OpenAI 兼容 API）
├── generate-poster.js   # CLI 命令行工具
├── web/
│   ├── index.html       # 生成器 Web 界面
│   └── gallery.html     # 海报画廊页面
└── posters/             # 生成的海报（本地存储）
```

**各文件职责：**

| 文件 | 职责 |
|------|------|
| `server.js` | HTTP API，路由分发，GitHub API 调用 |
| `generator.js` | 海报 HTML/CSS 生成，主题系统，i18n |
| `local-llm.js` | 调用 OpenAI 兼容 LLM 分析项目内容 |
| `screenshot.js` | Playwright 全页截图输出 PNG |
| `web/index.html` | 生成器界面（3种输入模式）|
| `web/gallery.html` | 历史海报画廊 |

---

## 🔌 API 接口

### 生成海报
```
POST /api/generate
Content-Type: application/json

Body:
{
  "nl": "GitHub URL 或本地路径 或 项目描述",
  "lang": "zh" | "en"
}

Response:
{
  "ok": true,
  "posterId": "1775490000000-xxxx",
  "title": "项目标题",
  "github": "https://github.com/owner/repo",
  "stars": 12345,
  "warnings": []
}
```

### 下载海报 PNG
```
GET /api/poster/:posterId.png
→ Content-Type: image/png
→ Content-Disposition: attachment; filename="posterId.png"
```

### 列出所有海报
```
GET /api/list
Response: { "posters": [{ "id": "...", "title": "...", "date": "..." }] }
```

---

## 📋 生成的海报包含

| 模块 | 内容 |
|------|------|
| Hero 区 | 项目名 + 描述 + ⭐ Star 数 |
| 统计卡 | 页面数 / 接口数 / 代码文件数 |
| 技术栈 | 识别的编程语言和框架 |
| 功能模块 | 项目的主要功能区域 |
| Footer | 品牌水印 + 生成时间 + GitHub 链接 |

---

## 🌐 中英文支持

- 界面支持中文 / English 切换（右上角）
- 海报内容根据 `lang` 参数自动切换中英标签
- API 参数 `lang: "zh"` / `lang: "en"`

---

## ⚙️ 配置

环境变量（可选）：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `GITHUB_TOKEN` | GitHub API Token（提高 API 速率限制，无 Token 也能用但信息较少）| 无 |
| `LLM_API_KEY` | OpenAI 兼容 API Key（用于 AI 分析，若不配置则使用 README 提取模式）| 无 |
| `PORT` | 服务端口 | `3008` |
| `POSTER_LOGO_PATH` | 自定义 logo 图片路径 | 无 |
| `POSTER_BRAND_NAME` | 自定义品牌名称（显示在海报底部 Footer）| `PosterHub` |

```bash
# 推荐用法：创建 .env 文件
cp .env.example .env
# 编辑 .env 填入你的 API Key
```

---

## ⚠️ 常见问题

**Q: AI 助手说「不会生成海报」怎么办？**
确保 PosterHub 服务正在运行：`node server.js`

**Q: GitHub 项目信息不完整（stars 为 0）？**
配置 `GITHUB_TOKEN` 环境变量可获得完整数据（无 Token 也有 60次/小时限制）

**Q: 海报内容太简单？**
配置 `LLM_API_KEY` 可启用 AI 深度分析（无 Key 时降级到 README 提取）

**Q: 生成的图片是空白怎么办？**
确保 Playwright 已安装：`npx playwright install chromium`

---

## 📄 开源协议

MIT License

---

## 🤝 贡献

欢迎提交 Issue 和 PR！
