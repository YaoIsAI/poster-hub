# 🖼️ PosterHub — AI-Powered Project Poster Generator

> Input a GitHub URL or local project path, AI automatically analyzes README, tech stack, and code structure to generate a clean project introduction poster.

[中文](README.md) · [Quick Start](#-quick-start) · [Examples](#-sample-posters) · [API Docs](docs/API.md)

---

[![Node.js Version](https://img.shields.io/badge/node-%20>=18-brightgreen)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/YaoIsAI/poster-hub)](https://github.com/YaoIsAI/poster-hub/stargazers)

---

## 🎯 What Is It

PosterHub is a **local-first** AI poster generator.

You can provide:
- a GitHub repository URL
- a local project path
- a plain-language project description

Then PosterHub analyzes project context and generates a high-quality shareable poster.

---

## 🧭 Architecture

PosterHub follows a local-first, dual-side collaboration architecture:

```
┌─────────────────────────────────────────────┐
│  Client (Browser / AI Assistant)             │
│                                             │
│  Input: GitHub URL / local path / description│
│       ↓                                      │
│  AI reads SKILL.md, learns the skill         │
│       ↓                                      │
│  Calls: POST /api/generate or /api/prompt    │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│  PosterHub Server (localhost:3008)           │
│                                             │
│  1. Parse input → GitHub API / local scan    │
│  2. AI analyze → OpenAI-compatible LLM        │
│  3. Generate → HTML + CSS poster             │
│  4. Export PNG → Chromium full-page screenshot│
│       ↓                                      │
│  Return: posterId → /api/poster/:id.png      │
└─────────────────────────────────────────────┘
```

**Key features:**
- AI assistants auto-learn via `SKILL.md` discovery
- Generated posters include project GitHub URL (self-promotion)
- Supports any OpenAI-compatible LLM (DeepSeek / Qwen / OpenAI, etc.)

---

## ✨ Features

- 🤖 **AI-Driven** — Enter any project, AI analyzes content and generates poster
- 📖 **GitHub README Deep Analysis** — Reads README / README_EN first, then uses LLM to extract title, highlights, and sections
- 📁 **Local Project Analysis** — Scans local folders and uses LLM for richer content extraction
- 🧩 **Dual Generation Routes** — `POST /api/generate` (project poster) + `POST /api/prompt` (style-based poster)
- 🌐 **Bilingual** — UI and poster content support Chinese and English
- 🪄 **Multiple Poster Types** — `wechat` / `xiaohongshu` / `performance` / `corporate` / `custom`
- 📱 **HD Export** — Native 780px width, 2× clarity
- ⚙️ **Settings Page** — Built-in LLM connectivity test, model refresh/selection, candidate Base URL hints, and summarized diagnostics
- 🔁 **Closed-Loop Audit** — `/api/prompt` now runs planner -> generator -> auditor -> auto-repair -> re-audit before PNG export
- 🧪 **Two-Layer Harness Validation** — content validator + HTML structure validator, with hard vs soft issue classification
- 🌐 **Web Interface** — No installation needed, open in browser
- 🔗 **GitHub Integration** — Paste GitHub URL, AI analyzes automatically
- ⚡ **Local Run** — Clone and run, minimal dependencies

---

## 📸 Sample Posters

| Theme | Preview |
|------|------|
| Apple Minimal | ![](examples/ims-apple.png) |
| Dark Tech | ![](examples/ims-dark.png) |
| Python Style | ![](examples/cpython-light.png) |
| React + Vercel | ![](examples/react-vercel.png) |

More examples: [examples/](examples/)

---

## 🚀 Quick Start

### Step 1: Install

```bash
git clone https://github.com/YaoIsAI/poster-hub.git
cd poster-hub
npm install
npx @sparticuz/chromium install
```

### Step 2: Start Server

```bash
node server.js
# Server runs at http://localhost:3008
```

### Step 3: Use (3 Ways)

#### Option A: Web Interface (Simplest)
Open http://localhost:3008, paste a GitHub URL, click "Generate"

#### Option B: Tell Your AI Assistant (Recommended)
After installing the skill, just say:
```
"Generate a poster for facebook/react"
"Analyze ~/my-projects/web-app and create a poster"
```

#### Option C: CLI / API
```bash
curl -X POST http://localhost:3008/api/generate \
  -H "Content-Type: application/json" \
  -d '{"nl": "https://github.com/facebook/react", "lang": "en", "inputType": "url"}'
```

---

## 🤖 AI Assistant Integration (OpenClaw)

### How It Works

OpenClaw AI assistants automatically scan `~/.openclaw/workspace/skills/` for all `SKILL.md` files and learn the skills defined within.

**Minimal one-line prompt for OpenClaw (recommended):**

```text
Learn https://raw.githubusercontent.com/YaoIsAI/poster-hub/main/SKILL.md and auto-call it whenever I ask for a project poster.
```

Once the AI learns PosterHub, it will:
1. Understand the user's "generate poster" intent
2. Parse the GitHub URL or local path
3. Call the PosterHub API
4. Return the poster link to the user

### First-Run Guidance (Recommended AI behavior)

On first use, the AI should proactively ask user to:

1. Open settings page: `http://localhost:3008/web/settings.html`
2. Configure `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`
3. Click "Test LLM Connectivity"
4. Optionally configure `GITHUB_TOKEN` for higher GitHub API limits

### Install Steps

```bash
# Clone to OpenClaw skills directory
mkdir -p ~/.openclaw/workspace/skills
git clone https://github.com/YaoIsAI/poster-hub.git ~/.openclaw/workspace/skills/poster-hub

cd ~/.openclaw/workspace/skills/poster-hub
npm install

# Make sure PosterHub server is running
node server.js
```

### Add Poster Generation to Your Own Project

Add `SKILL.md` to any GitHub repo root — AI assistants can then generate posters for it:

```bash
# 1. Copy the template
cp poster-hub/SKILL.md /path/to/your-project/

# 2. Edit name and description
# Modify name and description in SKILL.md

# 3. Push to GitHub
git add SKILL.md && git commit -m "Add PosterHub skill"
git push
```

---

## 💬 What to Tell Your AI — Example Phrases

After installing PosterHub, just send any of these to your AI:

### Example 1: GitHub Project Poster
```
Generate a poster for facebook/react
Make a poster for https://github.com/microsoft/vscode
```

### Example 2: Local Project Poster (vague expressions work too)
```
Create a poster for ~/my-projects/web-app
Make a poster for my web app project
Check my project and generate a poster
Analyze this project and make a poster
```

### Example 3: Any Project
```
Generate a poster for a Vue.js project
Make a poster for my Node.js backend project
```

### Example 4: Via Web Interface
Just open http://localhost:3008, paste any GitHub URL, and click "Generate".

---

## 🎯 Use Cases

- 📱 **Mini Programs / APPs** — Generate promotional posters
- 🛠️ **AI Tools / Skills** — Generate skill introduction posters
- 👤 **Personal Brand** — Generate personal profile posters
- 🏢 **Enterprise Products** — Batch generate product/event posters
- 📦 **Open Source Projects** — Let others quickly understand your project
- 🔬 **AI Research** — Generate paper/project posters for sharing

---

## 📂 Project Structure

```
poster-hub/
├── SKILL.md              # AI skill definition (AI reads this to learn)
├── README.md             # Chinese documentation
├── README_EN.md          # English documentation
├── server.js             # HTTP API server (port 3008)
├── github-utils.js       # GitHub API + DESIGN.md fetching/parsing
├── poster-validator.js   # Poster content validation and harness severity summary
├── generator.js          # Poster HTML/CSS generation engine
├── prompt-generator.js   # Generic style-based poster generator + structure validation
├── design-system.js      # Design token and design spec parser
├── poster-generator.js   # Adaptive CSS poster generator
├── screenshot.js         # Chromium / Playwright full-page screenshot
├── local-llm.js          # Local project analysis + GitHub README LLM analysis
├── generate-poster.js    # CLI command-line tool
├── Dockerfile            # Docker image build (includes curl / wget dependencies)
├── docker-compose.yml    # Docker Compose deployment example
├── DEPLOY.md             # Deployment notes
├── web/
│   ├── index.html       # Generator web interface
│   ├── gallery.html     # Poster gallery page
│   ├── settings.html    # Settings UI (LLM test / model refresh)
│   └── css/style.css    # UI styles
└── posters/             # Generated posters (local storage)
```

**File Responsibilities:**

| File | Responsibility |
|------|---------------|
| `server.js` | HTTP API, routing, settings persistence, connectivity diagnostics, task progress |
| `github-utils.js` | GitHub repo metadata, README, SKILL.md, DESIGN.md fetching and template matching |
| `poster-validator.js` | Poster content validation, harness issue classification and summarization |
| `generator.js` | Poster HTML/CSS generation, theme system, i18n |
| `prompt-generator.js` | Generic poster generation, prompt type list, HTML structure validation |
| `local-llm.js` | OpenAI-compatible LLM for local project analysis and GitHub README analysis |
| `screenshot.js` | Playwright full-page PNG screenshot |
| `web/index.html` | Generator UI (3 input modes) |
| `web/gallery.html` | Historical poster gallery |
| `web/settings.html` | LLM / GitHub settings and diagnostics UI |

---

## 🔌 API Reference

### Generate Poster
```http
POST /api/generate
Content-Type: application/json

{
  "nl": "GitHub URL or local path or project description",
  "lang": "zh" | "en",
  "inputType": "url" | "browse"
}
```

Response example:
```json
{
  "ok": true,
  "posterId": "1775490000000-xxxx",
  "title": "Project Title",
  "github": "https://github.com/owner/repo",
  "stars": 12345,
  "warnings": []
}
```

### Generate Generic Poster
```http
POST /api/prompt
Content-Type: application/json

{
  "prompt": "Create a WeChat style promo poster for an AI tool",
  "type": "wechat" | "xiaohongshu" | "performance" | "corporate" | "custom",
  "lang": "zh" | "en",
  "width": 780
}
```

### List Prompt Types
```http
GET /api/types
```

### Download Poster PNG
```http
GET /api/poster/:posterId.png
```

### Get Poster Metadata
```http
GET /api/poster/:posterId/meta.json
```

### List All Posters
```http
GET /api/list
```

### Read/Save Settings
```http
GET /api/settings
POST /api/settings
POST /api/settings/test
GET /api/models
GET /api/progress/:progressId
```

Notes:
- `POST /api/settings/test` returns `reachable`, `modelFound`, `modelsPreview`, `endpoint`, and summarized `message`
- `GET /api/models` additionally returns `details`, `tried`, `suggestedBaseUrl`, and `autoDiscovered`
- The settings UI shows short user-facing diagnostics while the API keeps detailed fields for debugging

See details: [docs/API.md](docs/API.md)

---

## 📋 What Posters Include

| Module | Content |
|--------|---------|
| Hero | Project name + description + ⭐ Stars |
| Stats | Key metrics (e.g. file/module counts) |
| Tech Stack | Detected programming languages and frameworks |
| Modules | Project's main functional areas |
| Footer | Brand + generation info + project link |

---

## 🌐 Bilingual Support

- UI supports Chinese / English switching (top-right)
- Poster content switches labels automatically based on `lang` parameter
- API param `lang: "zh"` / `lang: "en"`

---

## 🎨 Built-in Themes

| Theme ID | Style |
|---------|------|
| `apple-minimal` | Apple-like minimal |
| `warm-earth` | Warm earthy palette |
| `tech-blue` | Cool tech blue |
| `creative` | Colorful creative gradient |

---

## ⚙️ Configuration

Environment variables (optional):

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub API token (higher rate limits) | none |
| `LLM_API_KEY` | OpenAI-compatible API key for AI analysis | none |
| `LLM_BASE_URL` | LLM API endpoint (OpenAI-compatible / Ollama supported) | MiniMax default |
| `LLM_MODEL` | LLM model name (default: MiniMax-M2.1) | MiniMax-M2.1 |
| `PORT` | Server port | `3008` |
| `POSTER_LOGO_PATH` | Custom logo file path | none |
| `POSTER_BRAND_NAME` | Brand name shown in footer | `PosterHub` |

```bash
# Recommended: create .env file
cp .env.example .env
# Edit .env with your API keys
```

You can also configure and test LLM connectivity via UI:
`http://localhost:3008/web/settings.html`

Docker notes:
- `docker-compose.yml` maps `30008:3008` by default
- The Docker image includes `curl`, so connectivity tests can fall back when `fetch` is unstable
- For LAN Ollama usage, verify the container can also reach `LLM_BASE_URL`

---

## ⚠️ FAQ

**Q: AI says it "can't generate posters"**
→ Make sure PosterHub server is running: `node server.js`

**Q: GitHub project info incomplete (stars = 0)?**
→ Set `GITHUB_TOKEN` env var for complete data (60 requests/hour without it)

**Q: Poster content too simple?**
→ Set `LLM_API_KEY` for AI-powered deep analysis (falls back to README extraction if missing)

**Q: Generated image is blank?**
→ Install bundled Chromium: `npx @sparticuz/chromium install`

**Q: Settings page says LLM is unreachable or shows no model list?**
→ Test connectivity in `web/settings.html` first. For Ollama:
- use `http://host:11434/v1` as `LLM_BASE_URL`
- verify `/api/tags` is reachable
- if deployed with Docker, verify the container can also reach that LAN address
- if endpoint is reachable but there are no models, pull/install models in Ollama first

---

## 📄 License

MIT License

---

## 🤝 Contributing

Issues and PRs are welcome!
