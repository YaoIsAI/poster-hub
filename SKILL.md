---
name: poster-hub
description: Generate AI-powered project poster cards from GitHub URLs or local project paths. Activates when user wants to create a project introduction poster.
---

# 🖼️ PosterHub

Generate beautiful HD project posters (780px) from a GitHub URL or local project path.

## How It Works

```
User says: "Generate a poster for facebook/react"
    ↓
AI reads this SKILL.md → learns the skill
    ↓
AI calls: POST http://localhost:3008/api/generate
         Body: { "nl": "https://github.com/facebook/react", "lang": "en" }
    ↓
PosterHub server:
  1. Fetches GitHub README, stars, topics
  2. Analyzes with AI (LLM — see "For AI Assistants" below)
  3. Generates HTML poster
  4. Screenshots to PNG (780px wide)
    ↓
Returns: { "posterId": "xxx" }
    ↓
Poster URL: GET /api/poster/:posterId.png
```

## Setup

```bash
git clone https://github.com/YaoIsAI/poster-hub.git
cd poster-hub
npm install
npx playwright install chromium
node server.js
# Server runs at http://localhost:3008
```

**Note for AI:** After `npm install`, run `npx playwright install chromium` to enable screenshot generation.

## 💬 What to Tell Your AI

Just say any of these:

```
"Generate a poster for facebook/react"
"Create a poster for ~/my-projects/web-app"
"Make a poster for this project"
"帮我生成 ~/my-projects/web-app 的海报"
"检查一下我的项目并生成海报"
```

The AI will handle everything else automatically.

## For AI Assistants (OpenClaw)

When you learn this skill, **you should automatically configure your own LLM** so the poster analysis works. The AI understands both GitHub URLs and local paths (e.g. `~/Desktop/projects/my-app`), and even vague descriptions like "this project" or "the project on my desktop".

```bash
# AI: Install all dependencies including Playwright (for screenshot generation)
cd poster-hub && npm install && npx playwright install chromium

# AI: Configure your own LLM (pick one you have access to)
export LLM_API_KEY=your_key          # DeepSeek / OpenAI / Qwen / etc.
export LLM_BASE_URL=https://api.deepseek.com  # or your LLM's endpoint
export LLM_MODEL=deepseek-chat       # or gpt-4o-mini / qwen-turbo / etc.

# AI: Start the server
node server.js
```

Supported LLM providers (all OpenAI-compatible format):
- **DeepSeek**: API key from platform.deepseek.com, base URL `https://api.deepseek.com`
- **OpenAI**: API key from platform.openai.com, base URL `https://api.openai.com`
- **Qwen (阿里云)**: API key from dashscope.console.aliyun.com, base URL `https://dashscope.aliyuncs.com`
- **SiliconFlow (硅基流动)**: API key from siliconflow.cn, base URL `https://api.siliconflow.cn/v1`
- **MiniMax**: base URL `https://api.minimaxi.com/v1`

The poster generator works even without LLM — it falls back to README extraction. But LLM makes the posters much richer.

## Add to Your Own Project

Add `SKILL.md` to any GitHub repo → AI assistants will learn it automatically.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_API_KEY` | OpenAI-compatible API key | none |
| `LLM_BASE_URL` | LLM API endpoint | MiniMax |
| `LLM_MODEL` | LLM model name | MiniMax-M2.1 |
| `GITHUB_TOKEN` | GitHub API token (for better rate limits) | none |
| `PORT` | Server port | 3008 |

## License

MIT
