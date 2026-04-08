# 🖼️ PosterHub

### AI-Powered Project Poster Generator

> 输入 GitHub 地址或项目描述，AI 自动分析并生成一张专业的项目介绍海报。

[English](README_EN.md) · [快速开始](#-快速开始) · [示例](#-示例海报) · [API 文档](docs/API.md)

---

[![Node.js Version](https://img.shields.io/badge/node-%20>=18-brightgreen)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/YaoIsAI/poster-hub)](https://github.com/YaoIsAI/poster-hub/stargazers)

---

## 🎯 是什么

PosterHub 是一个**本地优先**的 AI 海报生成工具。你给它一个 GitHub 项目地址，它自动分析 README、技术栈、代码结构，生成一张可以在社交媒体、公众号、视频号传播的专业项目介绍海报。

**支持任意 GitHub 项目**，也支持本地项目路径或纯文字描述。

---

## ✨ 特性

| 特性 | 说明 |
|------|------|
| 🤖 **AI 驱动** | 输入任意项目，AI 自动分析内容生成海报 |
| 🌐 **GitHub 集成** | 粘贴 GitHub URL，自动获取 Stars/语言/描述 |
| 🎨 **多主题** | Apple 极简 · 深色科技 · 渐变赛博朋克 · Python 官方风格 |
| 📱 **高清导出** | 原生 780px 宽，2× 清晰度（1560px 输出） |
| 🌏 **中英双语** | 界面和海报内容均支持中英切换 |
| 🔗 **自我推广** | 海报底部自动附带 GitHub 地址 |
| ⚡ **快速生成** | 纯 Node.js，无需复杂依赖 |

---

## 📸 示例海报

> 下面这些海报全部由 PosterHub 自动生成

| 主题 | 预览 |
|------|------|
| **Apple 极简风** | ![](examples/ims-apple.png) |
| **深色科技风** | ![](examples/ims-dark.png) |
| **Python 官方风** | ![](examples/cpython-light.png) |
| **React + Vercel** | ![](examples/react-vercel.png) |

> 更多示例海报见 [examples/](examples/) 目录

---

## 🚀 快速开始

### 1. 安装

```bash
git clone https://github.com/YaoIsAI/poster-hub.git
cd poster-hub
npm install
```

### 2. 启动（自动检测 Chrome）

```bash
node server.js
```

> PosterHub 会**自动检测**系统中的 Chrome/Chromium：
> - 🍎 macOS：优先使用 Playwright / Google Chrome
> - 🪟 Windows：自动检测 Program Files 中的 Chrome
> - 🐧 Linux：检测 /usr/bin/chromium
>
> 如果都找不到，启动时会显示友好的安装提示。

### 3. 安装 Chrome（如果提示找不到）

```bash
# macOS / Windows: 安装 Google Chrome
# https://www.google.com/chrome/

# Linux (Ubuntu/Debian)
sudo apt install chromium-browser

# 或使用 Playwright 自动安装
npx playwright install chromium
```

### 4. 使用

**方式 A — Web 界面**（最简单）
打开 http://localhost:3008 ，粘贴 GitHub 地址，点击「生成简介卡」

**方式 B — 命令行**
```bash
curl -X POST http://localhost:3008/api/generate \
  -H "Content-Type: application/json" \
  -d '{"nl": "https://github.com/facebook/react", "lang": "zh"}'
```

**方式 C — AI 助手**
安装 SKILL.md 后，直接对 AI 说：
```
帮我生成 facebook/react 的海报
给 ~/my-project 生成一张介绍海报
```

---

## ⚙️ 配置

```bash
cp .env.example .env
# 编辑 .env 填入你的 API Key
```

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `GITHUB_TOKEN` | GitHub API Token（获取完整 stars 等数据） | 无 |
| `LLM_API_KEY` | OpenAI 兼容 API Key（启用 AI 深度分析） | 无 |
| `PORT` | 服务端口 | `3008` |
| `POSTER_BRAND_NAME` | 海报底部品牌名称 | `PosterHub` |

---

## 🗂️ 项目结构

```
poster-hub/
├── server.js            # HTTP API 服务
├── generator.js         # 海报 HTML/CSS 生成引擎
├── screenshot.js        # Playwright 高清截图
├── local-llm.js        # LLM 项目分析
├── generate-poster.js   # 命令行工具
├── SKILL.md            # AI 助手技能定义
├── web/                # Web 界面
│   ├── index.html      # 生成器
│   └── gallery.html    # 海报画廊
├── docs/               # 项目文档
│   ├── API.md          # API 接口文档
│   └── ARCHITECTURE.md # 架构设计文档
├── examples/           # 示例海报
├── posters/            # 生成的海报（本地存储）
└── .env.example        # 环境变量模板
```

---

## 🤖 AI 助手集成

PosterHub 支持 **OpenClaw** 技能系统。安装后，AI 助手能理解「生成海报」的意图并自动调用 API。

```bash
git clone https://github.com/YaoIsAI/poster-hub.git \
  ~/.openclaw/workspace/skills/poster-hub
```

详见 [SKILL.md](SKILL.md)

---

## 📌 API 接口

### 生成海报

```bash
POST /api/generate
Content-Type: application/json

{
  "nl": "GitHub URL 或本地路径 或 项目描述",
  "lang": "zh" | "en",
  "theme": "apple" | "dark" | "cyber" | "cpython" | "inventory"
}
```

### 下载海报

```bash
GET /api/poster/:posterId.png
```

详见 [docs/API.md](docs/API.md)

---

## 🎨 支持的主题

| 主题标识 | 风格 |
|---------|------|
| `apple` | Apple 极简主义，纯白 + 彩虹色谱 |
| `dark` | 深色科技风，适合 AI/开源项目 |
| `cyber` | 渐变赛博朋克，荧光色 + 暗色背景 |
| `cpython` | Python 官方风格，蓝黄配色 |
| `inventory` | 库存管理系统定制，深蓝企业风 |

---

## 🤝 贡献

欢迎提交 Issue 和 PR！

- 🐛 报告 Bug → [Issue](https://github.com/YaoIsAI/poster-hub/issues)
- 💡 提出新功能 → [Feature Request](https://github.com/YaoIsAI/poster-hub/issues)
- 📖 完善文档 → 直接提交 PR

---

## 📄 License

MIT © YaoIsAI
