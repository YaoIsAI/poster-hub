# 🖼️ PosterHub — AI-Powered Project Poster Generator

> Input a GitHub URL or local project path, AI automatically analyzes README, tech stack, and code structure to generate a clean project introduction poster.

---

## 🧭 Architecture

PosterHub is a **local-first** AI poster generator with two components:

```
┌─────────────────────────────────────────────┐
│  Client (Browser / AI Assistant)             │
│                                             │
│  Input: GitHub URL or local path             │
│       ↓                                      │
│  AI reads SKILL.md, learns the skill         │
│       ↓                                      │
│  Calls: POST /api/generate                   │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│  PosterHub Server (localhost:3008)           │
│                                             │
│  1. Parse input → GitHub API / local scan    │
│  2. AI Analyze → OpenAI-compatible LLM (any model)│
│  3. Generate → HTML + CSS poster             │
│  4. Output PNG → Playwright full-page shot   │
│       ↓                                      │
│  Return: posterId → /api/poster/:id/png      │
└─────────────────────────────────────────────┘
```

**Key features:**
- AI assistants auto-learn via `SKILL.md` discovery
- Generated posters include project GitHub URL (self-promotion)
- Zero-cost: supports any OpenAI-compatible LLM (DeepSeek / Qwen / Claude etc.)

---

## ✨ Features

- 🤖 **AI-Driven** — Enter any project, AI analyzes content and generates poster
- 🌐 **Bilingual** — UI and poster content support Chinese and English
- 📱 **HD Export** — Native 780px width, 2× clarity
- 🌐 **Web Interface** — No installation needed, open in browser
- 🔗 **GitHub Integration** — Paste GitHub URL, AI analyzes automatically
- ⚡ **Local Run** — Clone and run, minimal dependencies

---

## 🚀 Quick Start

### Step 1: Install

```bash
git clone https://github.com/YaoIsAI/poster-hub.git
cd poster-hub
npm install
npx playwright install chromium
```

### Step 2: Start Server

```bash
node server.js
# Server runs at http://localhost:3008
```

### Step 3: Use (3 ways)

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
  -d '{"nl": "https://github.com/facebook/react", "lang": "en"}'
```

---

## 🤖 AI Assistant Integration (OpenClaw)

### How It Works

OpenClaw AI assistants automatically scan `~/.openclaw/workspace/skills/` for all `SKILL.md` files and learn the skills defined within.

Once the AI learns PosterHub, it will:
1. Understand the user's "generate poster" intent
2. Parse the GitHub URL or local path
3. Call the PosterHub API
4. Return the poster link to the user

### Install Steps

```bash
# Clone to OpenClaw skills directory
git clone https://github.com/YaoIsAI/poster-hub.git \
  ~/.openclaw/workspace/skills/poster-hub

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
├── generator.js          # Poster HTML/CSS generation engine
├── screenshot.js         # Playwright full-page screenshot
├── local-llm.js         # LLM project analyzer (any OpenAI-compatible API)
├── generate-poster.js   # CLI command-line tool
├── web/
│   ├── index.html       # Generator web interface
│   └── gallery.html     # Poster gallery page
└── posters/             # Generated posters (local storage)
```

**File Responsibilities:**

| File | Responsibility |
|------|---------------|
| `server.js` | HTTP API, routing, GitHub API calls |
| `generator.js` | Poster HTML/CSS generation, theme system, i18n |
| `local-llm.js` | OpenAI-compatible LLM for project analysis |
| `screenshot.js` | Playwright full-page PNG screenshot |
| `web/index.html` | Generator UI (3 input modes) |
| `web/gallery.html` | Historical poster gallery |

---

## 🔌 API Reference

### Generate Poster
```
POST /api/generate
Content-Type: application/json

Body:
{
  "nl": "GitHub URL or local path or project description",
  "lang": "zh" | "en"
}

Response:
{
  "ok": true,
  "posterId": "1775490000000-xxxx",
  "title": "Project Title",
  "github": "https://github.com/owner/repo",
  "stars": 12345,
  "warnings": []
}
```

### Download Poster PNG
```
GET /api/poster/:posterId.png
→ Content-Type: image/png
→ Content-Disposition: attachment; filename="posterId.png"
```

### List All Posters
```
GET /api/list
Response: { "posters": [{ "id": "...", "title": "...", "date": "..." }] }
```

---

## 📋 What Posters Include

| Module | Content |
|--------|---------|
| Hero | Project name + description + ⭐ Stars |
| Stats | Page count / API count / File count |
| Tech Stack | Detected programming languages and frameworks |
| Modules | Project's main functional areas |
| Footer | Brand watermark + generation date + GitHub link |

---

## 🌐 Bilingual Support

- UI supports Chinese / English switching (top-right)
- Poster content switches labels automatically based on `lang` parameter
- API param `lang: "zh"` / `lang: "en"`

---

## ⚙️ Configuration

Environment variables (optional):

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub API Token (raises rate limit; works without it but with less data) | none |
| `LLM_API_KEY` | OpenAI-compatible API Key (for AI analysis; DeepSeek/Qwen/Claude all work) | none |
| `LLM_BASE_URL` | LLM API endpoint (default: MiniMax; also works with DeepSeek / OpenAI / SiliconFlow) | MiniMax default |
| `LLM_MODEL` | LLM model name (default: MiniMax-M2.1) | MiniMax-M2.1 |
| `PORT` | Server port | `3008` |
| `POSTER_LOGO_PATH` | Custom logo image path | none |
| `POSTER_BRAND_NAME` | Custom brand name (shown in poster footer) | `PosterHub` |

```bash
# Recommended: create .env file
cp .env.example .env
# Edit .env with your API keys
```

---

## ⚠️ FAQ

**Q: AI says it "can't generate posters"**
→ Make sure PosterHub server is running: `node server.js`

**Q: GitHub project info incomplete (stars = 0)?**
→ Set `GITHUB_TOKEN` env var for complete data (60 requests/hour without it)

**Q: Poster content too simple?**
→ Set `MINIMAX_API_KEY` for AI-powered deep analysis (falls back to README extraction if missing)

**Q: Generated image is blank?**
→ Make sure Playwright is installed: `npx playwright install chromium`

---

## 📄 License

MIT License

---

## 🤝 Contributing

Issues and PRs are welcome!
