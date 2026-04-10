// ============================================================
// GitHub 项目解析器
// ============================================================

function parseGitHubProject(text, lang = 'zh') {
  const isZh = lang === 'zh' || !/^[a-zA-Z]/.test(text.trim());
  const githubMatch = text.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/);
  
  // 检查是否有 GitHub 数据（stars/标签）
  const hasGitHubData = githubMatch && (/⭐\s*[\d,]+|标签[：:]/.test(text) || text.split('\n')[0].split('-').length >= 2);
  
  if (!githubMatch || !hasGitHubData) {
    return null;
  }

  const owner = githubMatch[1];
  const repo = githubMatch[2];
  const starsMatch = text.match(/⭐\s*([\d,]+)\s*stars?/);
  const langMatch = text.match(/技术栈[：:]\s*([^，,，\s]+)/);
  const topicsMatch = text.match(/标签[：:]\s*(.+?)(?:，|$)/);
  
  // 用 " - " 分割获取描述
  const parts = text.split(/\s+-\s+/);
  const rawDesc = parts.length > 1 ? parts.slice(1).join(' - ').trim() : '';
  const descFirst = rawDesc.split(/[,，]/)[0].trim();
  const description = descFirst || '';
  
  const stars = starsMatch ? parseInt(starsMatch[1].replace(/,/g, ''), 10) : 0;
  const techStack = langMatch ? langMatch[1].trim() : '';
  const topics = topicsMatch ? topicsMatch[1].split(/[\/、]/).map(t => t.trim()).filter(Boolean) : [];

  const config = {
    contentType: 'project-intro',
    theme: 'apple-minimal',
    hero: {
      badge: stars > 0 ? 'GitHub ⭐ ' + stars.toLocaleString() : 'GitHub',
      title: owner + '/' + repo,
      subtitle: description || 'Open source project on GitHub',
    },
    stats: [],
    sections: [],
    footer: {
      line1: 'Powered by PosterHub',
      line2: 'github.com/YaoIsAI/poster-hub',
      heroLogo: '✨ PosterHub',
    },
    workflow: [],
  };

  // 构建 stats
  if (stars > 0) {
    const starsK = stars >= 1000 ? (stars / 1000).toFixed(1) + 'k' : String(stars);
    config.stats.push({ value: starsK, label: 'Stars', color: '#f0ad4e' });
  }
  if (techStack) {
    config.stats.push({ value: techStack, label: 'Language', color: '#5bc0de' });
  }
  if (topics.length > 0) {
    config.stats.push({ value: String(topics.length), label: 'Topics', color: '#5bc0de' });
  }

  // 构建 sections
  const items = [];
  if (techStack) items.push({ label: techStack, emoji: '⚙️', desc: 'Primary language', badge: techStack, color: '#4A90E2' });
  topics.slice(0, 6).forEach(t => items.push({ label: t, emoji: '🏷️', desc: 'Topic', badge: 'Tag', color: '#8B7355' }));
  
  const infoLabel = isZh ? '📦 项目信息' : '📦 Project Info';
  const fallbackItem = { 
    label: description || owner + '/' + repo, 
    emoji: '📂', 
    desc: description || 'GitHub 开源项目', 
    badge: 'Project', 
    color: '#8B7355' 
  };
  config.sections = [{ 
    label: infoLabel, 
    items: items.length > 0 ? items : [fallbackItem] 
  }];

  return config;
}

module.exports = { parseGitHubProject };