# PosterHub Architecture

中文 | [English](#english)

## 架构图

PosterHub 采用本地优先的双端协作结构：

```text
┌─────────────────────────────────────────────┐
│  客户端（浏览器 / AI 助手）                  │
│                                             │
│  输入：GitHub URL / 本地路径 / 项目描述      │
│       ↓                                      │
│  AI 读取 SKILL.md 并学习技能                 │
│       ↓                                      │
│  调用：POST /api/generate 或 /api/prompt     │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│  PosterHub 服务端（localhost:3008）          │
│                                             │
│  1. 解析输入 → GitHub API / 本地扫描          │
│  2. AI 分析 → OpenAI 兼容 LLM                │
│  3. 生成海报 → HTML + CSS                    │
│  4. 导出 PNG → Chromium 截图                 │
│       ↓                                      │
│  返回：posterId → /api/poster/:id.png        │
└─────────────────────────────────────────────┘
```

## 系统概览

```
GitHub URL / 本地路径 / 项目描述
           ↓
     server.js (API 路由)
           ↓
 github-utils.js / 本地文件扫描
           ↓
 local-llm.js (本地目录 / GitHub README 分析)
           ↓
 generator.js / prompt-generator.js
           ↓
 poster-validator.js / validatePosterStructure()
           ↓
   screenshot.js (Playwright 截图)
           ↓
     PNG 海报输出
```

## 核心模块

| 模块 | 职责 | 入口 |
|------|------|------|
| `server.js` | HTTP API、路由、设置读写、连通性诊断、进度同步 | `node server.js` |
| `github-utils.js` | GitHub 仓库信息、README、SKILL.md、DESIGN.md 获取与模板匹配 | 被 server.js 调用 |
| `poster-validator.js` | 海报内容验证、Harness 问题分级、硬/软错误汇总 | 被 server.js 调用 |
| `generator.js` | 海报 HTML/CSS 生成、主题系统、i18n | 被 server.js 调用 |
| `local-llm.js` | 调用 OpenAI 兼容 LLM 分析本地项目与 GitHub README | 被 server.js 调用 |
| `prompt-generator.js` | 通用海报生成（按类型风格）+ HTML 结构验证 | 被 server.js 调用 |
| `screenshot.js` | Chromium 全页截图输出 PNG | 被 server.js 调用 |
| `web/index.html` | 生成器 Web 界面 | 浏览器访问 |
| `web/gallery.html` | 历史海报画廊 | 浏览器访问 |
| `web/settings.html` | 设置页面、模型刷新、连通性测试 | 浏览器访问 |

## 海报生成流程

1. **解析输入** → GitHub API / 本地文件扫描
2. **AI 分析** → GitHub README LLM 分析或本地目录 LLM 分析，提取项目描述、技术栈、功能模块
3. **内容规划（/api/prompt）** → 规划器输出结构化 plan JSON
4. **构建 HTML** → 生成器按计划生成响应式 HTML
5. **Harness 验证与纠偏** → 内容验证器 + 结构验证器联合校验，不一致自动纠偏重试；硬错误阻断，软偏差仅警告
6. **渲染截图** → 审查通过后才进行 Playwright 截图
7. **返回结果** → posterId + 下载链接

### API 路由（当前）

- `POST /api/generate`：项目海报生成（GitHub / 本地路径 / 描述）
- `POST /api/prompt`：通用海报生成（wechat/xiaohongshu/performance/corporate/custom）
- `GET /api/settings` / `POST /api/settings`：读取或保存 `.env` 设置
- `POST /api/settings/test`：测试 LLM 连通性（不保存）
- `GET /api/models`：获取模型列表与诊断字段（设置页刷新）
- `GET /api/progress/:progressId`：查询真实进度阶段（前端状态同步）
- `GET /api/types`：返回通用海报类型列表
- `GET /api/list`：返回历史海报列表（按时间倒序）
- `GET /api/poster/:id.png`：下载海报
- `GET /api/poster/:id/meta.json`：读取单张海报元数据

### 设置页诊断链路

1. 前端 `web/settings.html` 调用 `POST /api/settings/test`
2. 服务端 `testLlmConnectivity()` 依次探测：
   - Ollama: `/api/tags`、`/v1/models`、`/models`
   - 通用 OpenAI 兼容接口：`/models`、`/v1/models`、`/model/list`
3. 返回摘要字段：`message`
4. 返回诊断字段：`details`、`tried`、`suggestedBaseUrl`
5. 设置页默认展示用户友好提示，详细诊断由 API 提供

## 设计 Token 系统

PosterHub 使用三层 Token 架构，支持任意 DESIGN.md 规范：

```
Design Spec (VoltAgent/awesome-design-md)
    ↓ parseDesignMd()
Primitive Tokens { primaryColor, bgColor, ... }
    ↓ Resolver.resolve()
Semantic Tokens { --hero-bg, --stat-card-bg, ... }
    ↓ Theme Resolver
Poster Components (Hero / Stats / Sections / Cards / Footer)
```

## 主题系统

内置 4 套主题，每套定义完整的 Semantic Token：

- `apple-minimal` — Apple 极简主义，纯白 + 彩虹色谱
- `warm-earth` — 暖棕大地，温暖自然风格
- `tech-blue` — 科技蓝，冷蓝未来感
- `creative` — 创意渐变，多彩活泼

## 存储

- **海报 PNG**: `posters/{posterId}/poster.png`
- **海报 HTML**: `posters/{posterId}/poster.html`
- **元数据**: `posters/{posterId}/meta.json`
- **临时文件**: `tmp/`

## 端口

- `3008` — 默认服务端口（可通过 `PORT` 环境变量修改）

---

## English

## Architecture Diagram

PosterHub follows a local-first, dual-side collaboration flow:

```text
┌─────────────────────────────────────────────┐
│  Client (Browser / AI Assistant)            │
│                                             │
│  Input: GitHub URL / local path / prompt    │
│       ↓                                      │
│  AI reads SKILL.md and learns capability     │
│       ↓                                      │
│  Calls: POST /api/generate or /api/prompt   │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│  PosterHub Server (localhost:3008)          │
│                                             │
│  1. Parse input -> GitHub API / local scan  │
│  2. AI analysis -> OpenAI-compatible LLM    │
│  3. Build poster -> HTML + CSS              │
│  4. Export PNG -> Chromium screenshot       │
│       ↓                                      │
│  Return: posterId -> /api/poster/:id.png    │
└─────────────────────────────────────────────┘
```

## System Overview

```text
GitHub URL / local path / prompt
           ↓
     server.js (API router)
           ↓
 github-utils.js / local file scan
           ↓
 local-llm.js (local project / GitHub README analysis)
           ↓
 generator.js / prompt-generator.js
           ↓
 poster-validator.js / validatePosterStructure()
           ↓
 screenshot.js (Playwright render)
           ↓
        PNG output
```

## Core Modules

| Module | Responsibility | Entry |
|------|------|------|
| `server.js` | HTTP API, routing, settings persistence, connectivity diagnostics, progress sync | `node server.js` |
| `github-utils.js` | GitHub repo metadata, README, SKILL.md, DESIGN.md fetching and template matching | called by server |
| `poster-validator.js` | Poster content validation, harness issue classification, hard/soft issue summary | called by server |
| `generator.js` | Poster HTML/CSS generation, themes, i18n | called by server |
| `local-llm.js` | OpenAI-compatible local project analysis and GitHub README analysis | called by server |
| `prompt-generator.js` | Generic style-based poster generation + HTML structure validation | called by server |
| `screenshot.js` | Chromium full-page PNG capture | called by server |
| `web/index.html` | Generator UI | browser |
| `web/gallery.html` | Poster history gallery | browser |
| `web/settings.html` | Settings page, model refresh, connectivity test | browser |

## Poster Generation Flow

1. Parse input -> GitHub API or local project scan
2. AI analysis -> extract description, stack, and modules from local project or GitHub README
3. Planning (`/api/prompt`) -> planner outputs structured plan JSON
4. Build HTML -> generator follows the plan
5. Harness validation & auto-repair -> content validator + structure validator, retry on hard issues, keep soft deviations as warnings
6. Render screenshot -> capture only after audit passes
7. Return response -> `posterId` and downloadable link

### Current API Routes

- `POST /api/generate`: project poster generation
- `POST /api/prompt`: generic style poster generation
- `GET /api/settings` / `POST /api/settings`: read or save runtime settings
- `POST /api/settings/test`: LLM connectivity probe without persisting config
- `GET /api/models`: model list for settings UI, with diagnostics fields
- `GET /api/progress/:progressId`: live progress stage for frontend synchronization
- `GET /api/types`: list prompt types
- `GET /api/list`: list poster history in reverse chronological order
- `GET /api/poster/:id.png`: download poster image
- `GET /api/poster/:id/meta.json`: read poster metadata

### Settings Diagnostics Flow

1. `web/settings.html` calls `POST /api/settings/test`
2. `testLlmConnectivity()` probes:
   - Ollama: `/api/tags`, `/v1/models`, `/models`
   - Generic OpenAI-compatible APIs: `/models`, `/v1/models`, `/model/list`
3. Server returns summary field `message`
4. Server also returns diagnostics fields `details`, `tried`, and `suggestedBaseUrl`
5. Settings UI shows user-friendly summaries and keeps detailed fields for debugging

## Design Token System

PosterHub uses a 3-layer token architecture:

```text
Design spec (DESIGN.md)
   ↓ parseDesignMd()
Primitive tokens
   ↓ Resolver.resolve()
Semantic tokens (CSS vars)
   ↓ Theme resolver
Poster components (Hero/Stats/Sections/Cards/Footer)
```

## Theme System

Built-in themes:

- `apple-minimal` - white/minimal Apple-like style
- `warm-earth` - warm earthy style
- `tech-blue` - cool futuristic blue style
- `creative` - colorful gradient style

## Storage

- Poster PNG: `posters/{posterId}/poster.png`
- Poster HTML: `posters/{posterId}/poster.html`
- Metadata: `posters/{posterId}/meta.json`
- Temp files: `tmp/`

## Port

- `3008` - default service port (customizable via `PORT`)
