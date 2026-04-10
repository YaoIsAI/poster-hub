// ============================================================
// 本地项目解析器
// ============================================================

const TECH_MAP = [
  { pat: /vue|react|angular|svelte|next\.js|nuxt/i, label: 'Frontend', emoji: '🖥️', desc: '前端框架', color: '#4A90E2' },
  { pat: /node|express|koa|nest/i, label: 'Node.js', emoji: '🟢', desc: '后端运行时', color: '#68A063' },
  { pat: /python|flask|django|fastapi/i, label: 'Python', emoji: '🐍', desc: 'Python生态', color: '#3776AB' },
  { pat: /typescript|ts/i, label: 'TypeScript', emoji: '📘', desc: '类型安全', color: '#3178C6' },
  { pat: /postgres|mysql|mongodb|redis|sqlite/i, label: 'Database', emoji: '🗄️', desc: '数据库', color: '#F0AD4E' },
  { pat: /docker|k8s|kubernetes/i, label: 'DevOps', emoji: '🚢', desc: '容器化', color: '#326CE5' },
  { pat: /go|golang/i, label: 'Go', emoji: '🔵', desc: 'Go语言', color: '#00ADD8' },
  { pat: /ai|llm|gpt|claude|openai/i, label: 'AI', emoji: '🤖', desc: 'AI能力', color: '#9B59B6' },
];

function parseLocalProject(text, lang = 'zh') {
  const isZh = lang === 'zh' || !/^[a-zA-Z]/.test(text.trim());
  const localMatch = text.match(/^([a-zA-Z0-9_-]+)\s*-\s*(.+)/s);
  
  // 排除 GitHub 格式
  if (!localMatch || /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]/.test(text)) {
    return null;
  }

  const name = localMatch[1].trim();
  const desc = localMatch[2].trim();
  
  // 跳过 GitHub 数据字符串
  if (/^\d[\d,]* stars|github\.com|label:|stars,/i.test(desc)) {
    return null;
  }

  const config = {
    contentType: 'project-intro',
    theme: 'apple-minimal',
    hero: {
      badge: '📁 Local Project',
      title: name,
      subtitle: desc.slice(0, 200),
    },
    stats: [],
    sections: [],
    footer: {
      line1: 'Powered by PosterHub',
      line2: 'github.com/YaoIsAI/poster-hub',
    },
    workflow: [],
  };

  // 解析技术栈
  const items = [];
  for (const t of TECH_MAP) {
    if (t.pat.test(desc)) {
      items.push({ 
        label: t.label, 
        emoji: t.emoji, 
        desc: t.desc, 
        badge: t.label, 
        color: t.color 
      });
    }
  }
  
  if (items.length === 0) {
    items.push({ 
      label: name, 
      emoji: '📁', 
      desc: desc.slice(0, 60), 
      badge: 'Project', 
      color: '#8B7355' 
    });
  }

  const techLabel = isZh ? '🏷️ 技术栈' : '🏷️ Tech Stack';
  config.sections = [{ label: techLabel, items }];

  return config;
}

module.exports = { parseLocalProject };