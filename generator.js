/**
 * 海报墙生成器 — 核心引擎 v7.0
 *
 * 设计语言：Apple Minimalism × Professional SaaS
 * 核心风格：纯白背景、大圆角卡片、彩虹色谱、极简留白
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// 彩虹色谱 — 区分不同功能模块
// ============================================================

const RAINBOW = {
  red:    '#FF5E5E',
  orange: '#FF9F43',
  yellow: '#FFD60A',
  green:  '#4CD964',
  teal:   '#64D2FF',
  blue:   '#4A90E2',
  purple: '#7E57FF',
  pink:   '#FF6B9D',
  gray:   '#8E8E93',
};

const CATEGORY_COLORS = {
  feishu:  { color: '#4A90E2', bg: '#EBF4FF', name: '飞书' },
  apple:   { color: '#8E8E93', bg: '#F2F2F7', name: 'Apple' },
  ai:      { color: '#7E57FF', bg: '#F0EDFF', name: 'AI' },
  git:     { color: '#FF9F43', bg: '#FFF4E6', name: 'Git' },
  utility: { color: '#64D2FF', bg: '#E8FBFF', name: '工具' },
};

function getCategoryStyle(name) {
  if (name === '飞书') return CATEGORY_COLORS.feishu;
  if (name === 'Apple') return CATEGORY_COLORS.apple;
  if (name === 'AI') return CATEGORY_COLORS.ai;
  if (name === 'Git') return CATEGORY_COLORS.git;
  return CATEGORY_COLORS.utility;
}

// ============================================================
// 主题市场 — Apple Minimalist 设计系统
// ============================================================


const THEMES = {
  'warm-earth': {
    name: '暖棕大地',
    description: '温暖、自然、大地色调',
    bgWhite: '#FAF8F5', bgGray: '#F0EDE8', bgCard: '#FFFFFF',
    textPrimary: '#3D2B1F', textSecondary: '#6B5B4F', textTertiary: '#8B7355',
    accent: '#8B5A2B', accentMid: '#A07050', accentLight: '#D4B896',
    cardShadow: '0 2px 8px rgba(139,90,43,0.12)',
    cardShadowHover: '0 8px 24px rgba(139,90,43,0.18)',
    cardRadius: 16,
    divider: '#E8DED0',
    fontFamily: "'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif",
    scale: 2, pageWidth: 780,
    sectionGap: 56, cardGap: 20,
    heroPadding: '96px 64px 104px', sectionPadding: '40px',
    footerLine: '#E8DED0',
  },

  'tech-blue': {
    name: '科技蓝',
    description: '冷蓝、科技、未来感',
    bgWhite: '#F5F8FF', bgGray: '#EDF2F7', bgCard: '#FFFFFF',
    textPrimary: '#1A202C', textSecondary: '#4A5568', textTertiary: '#718096',
    accent: '#4A90E2', accentMid: '#3182CE', accentLight: '#90CDF4',
    cardShadow: '0 2px 8px rgba(74,144,226,0.15)',
    cardShadowHover: '0 8px 24px rgba(74,144,226,0.22)',
    cardRadius: 12,
    divider: '#E2E8F0',
    fontFamily: "'Inter', 'PingFang SC', -apple-system, sans-serif",
    scale: 2, pageWidth: 780,
    sectionGap: 56, cardGap: 20,
    heroPadding: '96px 64px 104px', sectionPadding: '40px',
    footerLine: '#E2E8F0',
  },

  'creative': {
    name: '创意紫',
    description: '创意、活力、艺术感',
    bgWhite: '#FAF5FF', bgGray: '#F3E8FF', bgCard: '#FFFFFF',
    textPrimary: '#2D1B4E', textSecondary: '#6B4E8B', textTertiary: '#9B7BC7',
    accent: '#9B59B6', accentMid: '#B873C7', accentLight: '#D7B3E8',
    cardShadow: '0 2px 12px rgba(155,89,182,0.15)',
    cardShadowHover: '0 8px 28px rgba(155,89,182,0.22)',
    cardRadius: 20,
    divider: '#E8D9F3',
    fontFamily: "'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif",
    scale: 2, pageWidth: 780,
    sectionGap: 56, cardGap: 20,
    heroPadding: '96px 64px 104px', sectionPadding: '40px',
    footerLine: '#E8D9F3',
  },

  'apple-minimal': {
    name: 'Apple极简',
    description: 'Apple极简主义 + 专业SaaS感，纯白背景、彩虹色谱',
    // 背景
    bgWhite: '#FFFFFF',
    bgGray:  '#F5F5F7',
    bgCard:  '#FFFFFF',
    // 文字
    textPrimary:   '#1D1D1F',
    textSecondary: '#6E6E73',
    textTertiary:  '#86868B',
    // 强调
    accent:        '#1D1D1F',
    accentMid:     '#4A4A4A',
    accentLight:   '#F5F5F7',
    // 卡片
    cardShadow:    '0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)',
    cardShadowHover: '0 8px 32px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.06)',
    cardRadius:    12,
    // 分隔线
    divider:       '#E5E5EA',
    dividerLight:  '#F5F5F7',
    // 页宽
    fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif",
    scale: 2,
    pageWidth: 780,
    sectionGap: 56,
    cardGap: 20,
    heroPadding: '96px 64px 104px',
    sectionPadding: '40px',
    // Footer
    footerLine: '#E5E5EA',
  },

};

// ============================================================
// 自然语言解析引擎
// ============================================================

function parseNaturalLanguage(nl, lang = 'zh') {
  const text = nl.trim();
  const isZh = lang === 'zh' || !/^[a-zA-Z]/.test(text.trim());

  // 默认 config
  const config = {
    contentType: 'custom',
    theme: 'apple-minimal',
    hero: { badge: '', title: '', subtitle: '' },
    stats: {},
    sections: [],
    footer: { line1: '', line2: '' },
    workflow: [],
  };

  // ===== GitHub 项目检测 =====
  // finalNl 格式: owner/repo - description，⭐ N stars，技术栈：Lang，标签：a / b / c
  // 也支持只有 owner/repo 格式但没有 stars/topics 的情况
  const githubMatch = text.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/);
  const hasGitHubData = githubMatch && (/⭐\s*[\d,]+|标签[：:]/.test(text) || text.split('\n')[0].split('-').length >= 2);
  if (githubMatch) {
    const owner = githubMatch[1];
    const repo = githubMatch[2];
    const starsMatch = text.match(/⭐\s*([\d,]+)\s*stars?/);
    const langMatch = text.match(/技术栈[：:]\s*([^，,，\s]+)/);
    const topicsMatch = text.match(/标签[：:]\s*(.+?)(?:，|$)/);
    // 用 " - " (space-dash-space) 分割，firstPart 是 owner/repo，rest 是 description
    // 注意：描述中可能也有 " - "（如 "poster-hub - xxx"），所以要 split 后取第二段以后再拼回
    const parts = text.split(/\s+-\s+/);
    // parts[0] = "owner/repo", parts[1+] = description（可能含多个 " - "）
    const rawDesc = parts.length > 1 ? parts.slice(1).join(' - ').trim() : '';
    // 从 rawDesc 中提取主要描述（取第一段逗号前的英文，或全中文）
    const descFirst = rawDesc.split(/[,，]/)[0].trim();
    const descMatch = descFirst ? [null, descFirst] : null;
    const stars = starsMatch ? parseInt(starsMatch[1].replace(/,/g, ''), 10) : 0;
    const lang = langMatch ? langMatch[1].trim() : '';
    const topics = topicsMatch ? topicsMatch[1].split(/[\/、]/).map(t => t.trim()).filter(Boolean) : [];
    const description = descMatch ? descMatch[1].trim() : '';

    config.contentType = 'project-intro';
    config.theme = 'apple-minimal';
    config.hero.badge = stars > 0 ? 'GitHub ⭐ ' + stars.toLocaleString() : 'GitHub';
    config.hero.title = owner + '/' + repo;
    config.hero.subtitle = description || 'Open source project on GitHub';
    config.footer.line1 = 'Powered by PosterHub';
    config.footer.line2 = 'github.com/YaoIsAI/poster-hub';
    config.footer.heroLogo = '✨ PosterHub';

    const stats = [];
    if (stars > 0) {
      const starsK = stars >= 1000 ? (stars / 1000).toFixed(1) + 'k' : String(stars);
      stats.push({ value: starsK, label: 'Stars', color: '#f0ad4e' });
    }
    if (lang) {
      stats.push({ value: lang, label: 'Language', color: '#5bc0de' });
    }
    if (topics.length > 0) {
      stats.push({ value: String(topics.length), label: 'Topics', color: '#5bc0de' });
    }
    config.stats = stats;

    const items = [];
    if (lang) items.push({ label: lang, emoji: '⚙️', desc: 'Primary language', badge: lang, color: '#4A90E2' });
    topics.slice(0, 6).forEach(t => items.push({ label: t, emoji: '🏷️', desc: 'Topic', badge: 'Tag', color: '#8B7355' }));
    // Always show at least one section for GitHub projects
    const infoLabel = isZh ? '📦 项目信息' : '📦 Project Info';
    config.sections = [{ label: infoLabel, items: items.length > 0 ? items : [{ label: description || owner + '/' + repo, emoji: '📂', desc: description || 'GitHub 开源项目', badge: 'Project', color: '#8B7355' }] }];

    return config;
  }

  // ===== 本地项目检测 =====
const localMatch = text.match(/^([a-zA-Z0-9_-]+)\s*-\s*(.+)/s);
  if (localMatch && !githubMatch) {
    const name = localMatch[1].trim();
    const desc = localMatch[2].trim();
    // Skip GitHub data strings
    if (/^\d[\d,]* stars|github\.com|label:|stars,/i.test(desc)) return config;
    config.contentType = 'project-intro';
    config.hero.badge = '📁 Local Project';
    config.hero.title = name;
    config.hero.subtitle = desc.slice(0, 200);
    config.footer.line1 = 'Powered by PosterHub';
    config.footer.line2 = 'github.com/YaoIsAI/poster-hub';
    const items = [];
    const techMap = [
      { pat: /vue|react|angular|svelte|next\.js|nuxt/i, label: 'Frontend', emoji: '🖥️', desc: '前端框架', color: '#4A90E2' },
      { pat: /node|express|koa|nest/i, label: 'Node.js', emoji: '🟢', desc: '后端运行时', color: '#68A063' },
      { pat: /python|flask|django|fastapi/i, label: 'Python', emoji: '🐍', desc: 'Python生态', color: '#3776AB' },
      { pat: /typescript|ts/i, label: 'TypeScript', emoji: '📘', desc: '类型安全', color: '#3178C6' },
      { pat: /postgres|mysql|mongodb|redis|sqlite/i, label: 'Database', emoji: '🗄️', desc: '数据库', color: '#F0AD4E' },
      { pat: /docker|k8s|kubernetes/i, label: 'DevOps', emoji: '🚢', desc: '容器化', color: '#326CE5' },
      { pat: /go|golang/i, label: 'Go', emoji: '🔵', desc: 'Go语言', color: '#00ADD8' },
      { pat: /ai|llm|gpt|claude|openai/i, label: 'AI', emoji: '🤖', desc: 'AI能力', color: '#9B59B6' },
    ];
    for (const t of techMap) { if (t.pat.test(desc)) items.push({ label: t.label, emoji: t.emoji, desc: t.desc, badge: t.label, color: t.color }); }
    if (items.length === 0) items.push({ label: name, emoji: '📁', desc: desc.slice(0, 60), badge: 'Project', color: '#8B7355' });
    const techLabel = isZh ? '🏷️ 技术栈' : '🏷️ Tech Stack';
    config.sections = [{ label: techLabel, items }];
    return config;
  }

  // ===== 模板匹配 =====
  if (/技能墙|插件墙|skill.*wall/i.test(text)) {
    config.contentType = 'skill-wall';
    config.hero.badge = 'OpenClaw Skills';
    config.hero.title = 'Skill Poster Wall';
    config.hero.subtitle = '探索AI助手能力的无限边界';
    config.footer.line1 = '让每一次展示，都值得被记住';
    config.footer.line2 = 'Powered by Precision';
    config.workflow = [
      { num: '01', title: '发现技能', desc: '浏览技能市场' },
      { num: '02', title: '安装配置', desc: '一键启用' },
      { num: '03', title: '智能协作', desc: 'AI助手帮你完成' },
    ];
  } else if (/同事\.skill|colleague|skill.*离职|skill.*离别/i.test(text)) {
    config.contentType = 'custom';
    config.hero.badge = 'GitHub ⭐ 7.6k';
    config.hero.title = '同事.skill';
    config.hero.subtitle = '将冰冷的离别转化为温暖的 Skill';
    config.footer.line1 = '人走了，Skill 留着';
    config.footer.line2 = 'Powered by OpenClaw + Claude Code';
    config.footer.logoPath = process.env.POSTER_LOGO_PATH || null;
    config.footer.brandUrl = process.env.POSTER_BRAND_NAME || 'PosterHub';
    config.sections = [
      { label: '💬 数据来源', items: [
        { emoji: '📨', title: '飞书消息', desc: '输入姓名全自动 API 采集', badge: '飞书', color: '#4A90E2' },
        { emoji: '💬', title: '钉钉 / Slack', desc: '浏览器抓取或 API 方式', badge: '工具', color: '#64D2FF' },
        { emoji: '💭', title: '微信聊天记录', desc: 'WeChatMsg / PyWxDump 导出', badge: '工具', color: '#64D2FF' },
        { emoji: '📧', title: '邮件 / PDF', desc: '.eml .mbox PDF 直接上传', badge: '工具', color: '#64D2FF' },
        { emoji: '✍️', title: '直接粘贴文字', desc: '任何格式的文本描述', badge: '工具', color: '#64D2FF' },
      ]},
      { label: '⚙️ Skill 结构', items: [
        { emoji: '⚙️', title: 'Work Skill', desc: '系统规范 / 工作流程 / 经验知识库', badge: 'AI', color: '#7E57FF' },
        { emoji: '🎭', title: 'Persona', desc: '5层性格：硬规则→身份→表达→决策→人际', badge: 'AI', color: '#7E57FF' },
        { emoji: '🔄', title: '增量进化', desc: '追加文件自动 merge，不覆盖已有结论', badge: 'AI', color: '#7E57FF' },
        { emoji: '✏️', title: '对话纠正', desc: '说他不会这样 → 写入 Correction 层', badge: 'AI', color: '#7E57FF' },
        { emoji: '⏪', title: '版本回滚', desc: '/colleague-rollback {slug} {version}', badge: '工具', color: '#64D2FF' },
      ]},
      { label: '🎯 性格标签', items: [
        { emoji: '🏢', title: '职级支持', desc: '字节 2-1~3-3+ · 阿里 P5~P11 · 华为 13~21级', badge: '工具', color: '#64D2FF' },
        { emoji: '💼', title: '企业文化', desc: '字节范 · 阿里味 · 腾讯味 · 华为味', badge: '工具', color: '#64D2FF' },
        { emoji: '🎯', title: '个性标签', desc: '甩锅高手 · 完美主义 · PUA · 向上管理', badge: '工具', color: '#64D2FF' },
      ]},
      { label: '🛠️ 安装使用', items: [
        { emoji: '🔧', title: 'Claude Code', desc: '/create-colleague → 输入信息 → 生成', badge: 'Git', color: '#FF9F43' },
        { emoji: '🦞', title: 'OpenClaw', desc: 'git clone 到 ~/.openclaw/workspace/skills/', badge: 'Git', color: '#FF9F43' },
      ]},
    ];
  }

  return config;
}

function buildWorkflow(workflow, t) {
  if (!workflow || workflow.length === 0) return '';
  const scale = t.scale || 2;
  function sc(n) { return (parseInt(n) * scale) + 'px'; }
  const items = workflow.map(w => {
    const num = w.num || '';
    const title = w.title || '';
    const desc = w.desc || '';
    return '<div class="wf-item"><div class="wf-num">' + num + '</div><div class="wf-body"><div class="wf-title">' + title + '</div><div class="wf-desc">' + desc + '</div></div></div>';
  }).join('<div class="wf-arrow">→</div>');
  return '<div class="workflow" style="display:flex;align-items:center;gap:24px;padding:32px 48px;background:#FAFAFA;border-radius:12px;margin:24px 0;overflow-x:auto;justify-content:center;">' + items + '</div>';
}

function generatePoster({ config, items, theme }) {
  const t = theme;
  // DESIGN.md 规范覆盖
  // ═══════════════════════════════════════════
  //  视觉正确性自我修复
  //  检测 :root CSS 变量值是否符合设计规范，不符合则自动修正
  // ═══════════════════════════════════════════
  function isColorDark(hex) {
    if (!hex || hex === 'transparent') return false;
    const clean = hex.replace('#', '');
    if (clean.length < 6) return false;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }
  function isColorWhite(hex) {
    if (!hex) return false;
    return /^#(FFF|F{5}|FA){1,}/i.test(hex);
  }

  const ds = config.designSpec;
  if (ds && ds.isDark && ds.bgColor) {
    // 深色主题验证：检查 :root CSS 变量是否正确
    // bgWhite 应该被覆盖为深色，如果不是则强制覆盖
    const currentBg = t.bgWhite;
    if (!currentBg || !isColorDark(currentBg) || isColorWhite(currentBg)) {
      // 自我修复：强制应用深色主题
      t.bgWhite = ds.bgColor;
      const r = parseInt(ds.bgColor.slice(1, 3), 16);
      const g = parseInt(ds.bgColor.slice(3, 5), 16);
      const b = parseInt(ds.bgColor.slice(5, 7), 16);
      const lighterDark = '#' + [Math.min(255, r + 20), Math.min(255, g + 20), Math.min(255, b + 20)].map(x => x.toString(16).padStart(2, '0')).join('');
      t.bgGray = lighterDark;
      t.bgCard = lighterDark;
      t.textPrimary = ds.textColor || '#FFFFFF';
      t.textSecondary = ds.textColorAlt || '#FFFFFF99';
      t.textTertiary = ds.textColorAlt ? ds.textColorAlt + '66' : '#FFFFFF44';
      t.accent = ds.accentColor || '#FF5B4F';
      t.divider = ds.dividerColor || '#333333';
      console.log('[🔧 自我修复] 深色主题检测到 bgWhite=' + currentBg + ' 已强制覆盖为 ' + ds.bgColor);
    }
  }
  if (ds) {
    if (ds.isDark && ds.bgColor) {
      t.bgWhite = ds.bgColor;
      // 深色主题：卡片背景用比主背景稍浅的颜色（而不是白色）
      const darkBase = ds.bgColor;
      const r = parseInt(darkBase.slice(1,3),16);
      const g = parseInt(darkBase.slice(3,5),16);
      const b = parseInt(darkBase.slice(5,7),16);
      const lighterDark = '#' + [Math.min(255,r+20), Math.min(255,g+20), Math.min(255,b+20)].map(x=>x.toString(16).padStart(2,'0')).join('');
      t.bgGray = lighterDark;
      t.bgCard = lighterDark;
      t.textPrimary = ds.textColor || '#FFFFFF';
      t.textSecondary = ds.textColorAlt || '#FFFFFF99';
      t.textTertiary = ds.textColorAlt ? ds.textColorAlt + '66' : '#FFFFFF44';
      t.accent = ds.accentColor || '#FF5B4F';
      t.divider = ds.dividerColor || '#333333';
    }
  }
  const s = t.scale || 2;
  // 辅助：CSS px 值×scale
  function sc(n) { return (parseInt(n) * s) + 'px'; }
  const hero = config.hero || { badge: '', title: '内容海报', subtitle: '探索无限可能' };
  const footer = config.footer || { line1: '精准赋能每一次决策', line2: 'Clarity in Every Detail' };
  const projectLink = config.projectLink || '';
  const sections = config.sections || [{ label: '内容一览', items }];

  if (config.cards && config.sections) {
    config.sections.forEach(sec => {
      if (!sec.items) sec.items = config.cards.filter(c => c.section === sec.label);
    });
  }

  const workflow = config.workflow || [];
  const date = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

  const totalItems = (items && items.length) || sections.reduce((sum, s) => sum + (s.items ? s.items.length : 0), 0);
  const feishuCount = (items && items.filter(i => i.tag === '飞书').length) || 0;
  const otherCount = totalItems - feishuCount;

  let statsConfig;
  if (config.stats && Array.isArray(config.stats) && config.stats.length > 0) {
    const s = config.stats.slice(0, 4);
    statsConfig = {
      stat1: s[0]?.value,
      label1: s[0]?.label,
      stat2: s[1]?.value,
      label2: s[1]?.label,
      stat3: s[2]?.value,
      label3: s[2]?.label,
      stat4: s[3]?.value,
      label4: s[3]?.label,
    };
  } else {
    statsConfig = config.stats || {};
  }

  // Stats — 直接用 config.stats 数组中的值，不要 fallback
  const hideStats = config.hideStats === true;
  // 只在 config.stats 不存在时用 fallback
  const _fallbackStats = hideStats ? [] : (totalItems > 0 ? [
    { value: String(totalItems), label: '技能总数', color: '#8B7355' },
    { value: String(feishuCount), label: '飞书系', color: '#4A90E2' },
    { value: String(otherCount), label: '实用工具', color: '#64D2FF' },
  ] : []);
  const _allStats = (config.stats && config.stats.length > 0) ? config.stats : [];
  const stat1 = _allStats[0]?.value || '';
  const stat2 = _allStats[1]?.value || '';
  const stat3 = _allStats[2]?.value || '';
  const stat4 = _allStats[3]?.value || '';
  const statLabel1 = _allStats[0]?.label || '';
  const statLabel2 = _allStats[1]?.label || '';
  const statLabel3 = _allStats[2]?.label || '';
  const statLabel4 = _allStats[3]?.label || '';

  let sectionsHTML = '';
  let sectionBgIndex = 0;
  for (const sec of sections) {
    const bg = sectionBgIndex % 2 === 0 ? t.bgWhite : t.bgGray;
    let cardsHTML = '';
    sec.items.forEach((item, i) => { cardsHTML += buildCard(item, t, i); });
    sectionsHTML +=
      '<div class="section" style="background:' + bg + '">' +
      '<div class="section-head">' +
      '<span class="section-label">' + sec.label + '</span>' +
      '<span class="section-rule"></span>' +
      '<span class="section-count">' + sec.items.length + ' 项</span></div>' +
      '<div class="grid">' + cardsHTML + '</div></div>';
    sectionBgIndex++;
  }

  const workflowHTML = buildWorkflow(workflow, t);

  return '<!DOCTYPE html>\n<html lang="zh-CN">' +
'<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>' + hero.title + '</title>' +
'<style>' +
':root { --hero-bg:' + t.bgWhite + '; --hero-text:' + t.textPrimary + '; --hero-subtext:' + t.textSecondary + '; --hero-badge-bg:' + t.bgGray + '; --hero-badge-text:' + t.textSecondary + '; --hero-divider:' + (t.divider || t.bgGray) + '; --accent:' + (t.accent || '#FF5B4F') + '; --stat-card-bg:' + t.bgGray + '; --stat-num-color:' + t.textPrimary + '; --stat-label-color:' + t.textSecondary + '; --section-label:' + t.textSecondary + '; --section-rule:' + (t.divider || t.bgGray) + '; --section-count:' + t.textTertiary + '; --card-bg:' + t.bgCard + '; --card-text:' + t.textPrimary + '; --card-desc:' + t.textSecondary + '; --card-badge-bg:' + t.bgGray + '; --card-badge-text:' + t.textSecondary + '; --card-dot:' + (t.accent || t.textPrimary) + '; --footer-rule:' + (t.divider || t.bgGray) + '; --footer-line1:' + t.textPrimary + '; --footer-line2:' + t.textTertiary + '; --footer-brand:' + t.textTertiary + '; }' +
'@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap");' +
'* { margin: 0; padding: 0; box-sizing: border-box; }' +
'body { font-family: ' + t.fontFamily + '; background: ' + t.bgWhite + '; color: ' + t.textPrimary + '; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; width: 100%; max-width: ' + t.pageWidth + 'px; margin: 0 auto; }' +

// Poster wrapper
'.poster { max-width: ' + t.pageWidth + 'px; margin: 0 auto; background: ' + t.bgWhite + '; padding-bottom: 128px; }' +

// ═══════════════════════════════════════════
//  HERO — 纯白背景 + 大标题 + 2x2统计网格
// ═══════════════════════════════════════════
'.hero { background: ' + t.bgWhite + '; padding: ' + t.heroPadding + '; }' +

// Logo area
'.hero-logo { font-size: ' + sc(11) + '; font-weight: 600; color: ' + t.textTertiary + '; letter-spacing: ' + sc(2) + '; text-transform: uppercase; margin-bottom: ' + sc(20) + '; }' +

// Badge pill
'.hero-badge { display: inline-flex; align-items: center; gap: ' + sc(6) + '; padding: ' + sc(5) + ' ' + sc(12) + '; border-radius: 20px; background: ' + t.bgGray + '; font-size: ' + sc(11) + '; font-weight: 600; color: ' + t.textSecondary + '; letter-spacing: 0.5px; margin-bottom: ' + sc(24) + '; }' +
'.hero-badge-dot { width: ' + sc(6) + '; height: ' + sc(6) + '; border-radius: 50%; background: #4A90E2; flex-shrink: 0; }' +

// Title — extreme weight contrast
'.hero-title { font-size: ' + sc(38) + '; font-weight: 800; color: ' + t.textPrimary + '; line-height: 1.05; letter-spacing: -1.5px; margin-bottom: ' + sc(12) + '; }' +

// Subtitle
'.hero-subtitle { font-size: ' + sc(15) + '; color: ' + t.textSecondary + '; font-weight: 400; line-height: 1.6; margin-bottom: ' + sc(40) + '; max-width: ' + t.pageWidth + 'px; }' +

// 2x2 Stats grid
'.stats-grid { display: grid; grid-template-columns: repeat(' + _allStats.length + ', 1fr); gap: ' + sc(12) + '; }' +
'.stat-card { background: ' + t.bgGray + '; border-radius: ' + (t.cardRadius * s) + 'px; padding: ' + sc(20) + ' ' + sc(16) + '; text-align: center; }' +
'.stat-num { font-size: ' + sc(40) + '; font-weight: 800; color: ' + t.textPrimary + '; line-height: 1; letter-spacing: -3px; margin-bottom: ' + sc(8) + '; }' +
'.stat-label { font-size: ' + sc(11) + '; font-weight: 500; color: ' + t.textSecondary + '; letter-spacing: 0.5px; }' +

// Section divider
'.hero-bottom-bar { height: ' + sc(12) + '; background: ' + t.bgGray + '; }' +

// ═══════════════════════════════════════════
//  SECTION
// ═══════════════════════════════════════════
'.section { padding: ' + t.sectionGap + 'px ' + t.sectionPadding + '; }' +
'.section-head { display: flex; align-items: center; gap: ' + sc(10) + '; margin-bottom: ' + sc(14) + '; }' +
'.section-label { font-size: ' + sc(12) + '; font-weight: 700; color: ' + t.textSecondary + '; letter-spacing: 1px; white-space: nowrap; }' +
'.section-rule { flex: 1; height: 1px; background: ' + t.divider + '; }' +
'.section-count { font-size: ' + sc(11) + '; font-weight: 500; color: ' + t.textTertiary + '; white-space: nowrap; }' +

// ═══════════════════════════════════════════
//  GRID
// ═══════════════════════════════════════════
'.grid { display: grid; grid-template-columns: 1fr 1fr; gap: ' + t.cardGap + 'px; }' +

// ═══════════════════════════════════════════
//  CARD — 大圆角 + 左侧2px细色条 + 无边框
// ═══════════════════════════════════════════
'.card { background: ' + t.bgCard + '; border-radius: ' + (t.cardRadius * s) + 'px; box-shadow: ' + t.cardShadow + '; transition: box-shadow 0.2s ease, transform 0.2s ease; position: relative; overflow: hidden; }' +
'.card:hover { box-shadow: ' + t.cardShadowHover + '; transform: translateY(-4px); }' +
'.card-dot { position: absolute; top: ' + sc(10) + '; right: ' + sc(10) + '; width: ' + sc(6) + '; height: ' + sc(6) + '; border-radius: 50%; background: var(--accent, #4A90E2); }' +


'.card-body { padding: ' + sc(12) + ' ' + sc(12) + ' ' + sc(10) + '; }' +

// Card top row
'.card-top { display: flex; align-items: center; gap: ' + sc(8) + '; margin-bottom: ' + sc(8) + '; }' +
'.card-emoji { font-size: ' + sc(16) + '; line-height: 1; flex-shrink: 0; }' +
'.card-name { font-size: ' + sc(13) + '; font-weight: 700; color: ' + t.textPrimary + '; line-height: 1.3; letter-spacing: -0.1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }' +

// Description
'.card-desc { font-size: ' + sc(11) + '; color: ' + t.textSecondary + '; line-height: 1.55; margin-bottom: ' + sc(10) + '; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: ' + sc(33) + '; }' +

// Badge tag (pill style)
'.card-footer { display: flex; align-items: center; }' +
'.card-badge { display: inline-flex; align-items: center; gap: ' + sc(5) + '; padding: ' + sc(3) + ' ' + sc(10) + '; border-radius: 20px; background: ' + t.bgGray + '; font-size: ' + sc(10) + '; font-weight: 600; color: ' + t.textSecondary + '; }' +
'.card-badge-dot { width: ' + sc(5) + '; height: ' + sc(5) + '; border-radius: 50%; flex-shrink: 0; }' +

// ═══════════════════════════════════════════
//  WORKFLOW — 圆形编号 + 垂直细线
// ═══════════════════════════════════════════
'.workflow-section { padding: ' + sc(32) + ' ' + sc(32) + ' ' + sc(8) + '; display: flex; flex-direction: column; align-items: flex-start; }' +
'.wf-item { display: flex; align-items: flex-start; gap: ' + sc(16) + '; position: relative; }' +
'.wf-circle { width: ' + sc(36) + '; height: ' + sc(36) + '; border-radius: 50%; background: ' + t.textPrimary + '; color: ' + t.bgWhite + '; font-size: ' + sc(12) + '; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; z-index: 1; }' +
'.wf-line { position: absolute; left: ' + sc(18) + '; top: ' + sc(36) + '; width: 1.5px; height: ' + sc(40) + '; background: ' + t.divider + '; }' +
'.wf-content { padding-top: ' + sc(6) + '; padding-bottom: ' + sc(24) + '; }' +
'.wf-title { font-size: ' + sc(14) + '; font-weight: 700; color: ' + t.textPrimary + '; margin-bottom: 3px; }' +
'.wf-desc { font-size: ' + sc(11) + '; color: ' + t.textSecondary + '; }' +

// ═══════════════════════════════════════════
//  FOOTER — 极简风格
// ═══════════════════════════════════════════
'.footer { padding: ' + sc(40) + ' ' + sc(32) + ' 0; text-align: center; }' +
'.footer-rule { width: 100%; height: 1px; background: ' + t.footerLine + '; margin-bottom: ' + sc(36) + '; }' +
'.footer-line1 { font-size: ' + sc(20) + '; font-weight: 800; color: ' + t.textPrimary + '; letter-spacing: -0.5px; line-height: 1.3; margin-bottom: ' + sc(8) + '; }' +
'.footer-line2 { font-size: ' + sc(11) + '; color: ' + t.textTertiary + '; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; }' +
    '.footer-powered { font-size: ' + sc(11) + '; color: ' + t.textTertiary + '; margin-top: ' + sc(8) + '; }' +
    '.poster-link { color: ' + t.accent + '; text-decoration: none; font-weight: 500; }' +
    '.poster-link:hover { text-decoration: underline; }' +
'.footer-brand { margin-top: ' + sc(24) + '; padding-top: ' + sc(20) + '; font-size: ' + sc(10) + '; color: ' + t.textTertiary + '; font-weight: 500; letter-spacing: 0.5px; }' +
'.footer-brand span { color: ' + t.textSecondary + '; font-weight: 600; }' +
'.hero-github { margin-bottom: ' + sc(20) + '; }' +
'.hero-github a { font-size: ' + sc(12) + '; color: #4A90E2; text-decoration: none; font-weight: 500; letter-spacing: 0.3px; }' +
'.footer-brand-text { margin-top: ' + sc(16) + '; font-size: ' + sc(13) + '; font-weight: 700; color: ' + t.textPrimary + '; letter-spacing: 0.5px; }' +
'.footer-brand-text span { font-weight: 400; }' +
'.footer-logo { margin-top: ' + sc(20) + '; display: flex; align-items: center; justify-content: center; gap: ' + sc(10) + '; }' +
'.footer-logo img { max-height: ' + sc(44) + '; max-width: ' + sc(44) + '; object-fit: contain; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }' +
'.footer-logo-text { font-size: ' + sc(14) + '; font-weight: 600; color: #1D1D1F; letter-spacing: 0.5px; }' +
'</style></head>' +
'<body><div class="poster">' +

// HERO
'<div class="hero">' +
'<div class="hero-logo">' + (footer.heroLogo || '✨ PosterHub') + '</div>' +
'<div class="hero-badge"><span class="hero-badge-dot"></span>' + hero.badge + '</div>' +
'<div class="hero-title">' + hero.title + '</div>' +
'<div class="hero-subtitle">' + hero.subtitle + '</div>' +
(hero.githubUrl ? '<div class="hero-github"><a href="https://' + hero.githubUrl + '">🌐 ' + hero.githubUrl + '</a></div>' : '') +
(hideStats ? '' :
'<div class="stats-grid">' +
(_allStats[0]?.value ? '<div class="stat-card"><div class="stat-num">' + stat1 + '</div><div class="stat-label">' + statLabel1 + '</div></div>' : '') +
(_allStats[1]?.value ? '<div class="stat-card"><div class="stat-num">' + stat2 + '</div><div class="stat-label">' + statLabel2 + '</div></div>' : '') +
(_allStats[2]?.value ? '<div class="stat-card"><div class="stat-num">' + stat3 + '</div><div class="stat-label">' + statLabel3 + '</div></div>' : '') +
(_allStats[3]?.value ? '<div class="stat-card"><div class="stat-num">' + stat4 + '</div><div class="stat-label">' + statLabel4 + '</div></div>' : '') +
'</div>') +
'</div>' +
'<div class="hero-bottom-bar"></div>' +

sectionsHTML +

(workflowHTML ? workflowHTML : '') +

// FOOTER
'<div class="footer">' +
'<div class="footer-rule"></div>' +
'<div class="footer-line1">' + footer.line1 + '</div>' +
'<div class="footer-line2">' + footer.line2 + '</div>' +
    '<div class="footer-powered">' +
    '<a href="https://github.com/YaoIsAI/poster-hub" target="_blank" class="poster-link">Powered by PosterHub</a> · <a href="https://github.com/YaoIsAI/poster-hub" target="_blank" class="poster-link">github.com/YaoIsAI/poster-hub</a>' +
    (projectLink ? ' · <a href="' + projectLink + '" target="_blank" class="poster-link">View on GitHub</a>' : '') +
    '</div>' +
(footer.logoPath ? '<div class="footer-logo"><img src="' + footer.logoPath + '" alt="logo"><span class="footer-logo-text">' + (footer.brandUrl || 'PosterHub') + '</span></div>' : '') +
'<div class="footer-brand"><span>YaoIsAI</span> · ' + date + '</div></div>' +
'</div></body></html>';
}

// ============================================================
// 主入口
// ============================================================

function generateFromNaturalLanguage(nl, overrides = {}) {
  const parsed = parseNaturalLanguage(nl, overrides.lang);
  const config = { ...parsed, ...overrides };
  const theme = THEMES[config.theme] || THEMES['apple-minimal'];

  let items;
  // skill-wall 类型已移除（依赖 getAllSkills）
  if (config.contentType === 'project-intro') {
    // GitHub 项目简介 — sections 已由 parseNaturalLanguage 设置，保留
    items = [];
  } else {
    // 如果没有 sections，自动从 items 构建一个默认 section
    if (!config.sections || config.sections.length === 0) {
      const _isZh = config.lang === 'zh' || !/^[a-zA-Z]/.test((config.hero?.subtitle || '').trim());
      const overviewLabel = _isZh ? '内容一览' : '📋 Overview';
      config.sections = [{ label: overviewLabel, items: items || [] }];
    }
  }

  if (overrides.hero) config.hero = { ...parsed.hero, ...overrides.hero };
  if (overrides.footer) config.footer = { ...parsed.footer, ...overrides.footer };

  const html = generatePoster({ config, items, theme });
  return { html, config, items, theme };
}

function generateFromConfig(config) {
  const theme = THEMES[config.theme] || THEMES['apple-minimal'];
  let items = config.items || [];
  if (config.sections && config.sections.length > 0 && !config.items) {
    items = config.sections.flatMap(sec => sec.items || []);
  }
  // Pass config directly, not wrapped
  const html = generatePoster({ config, items, theme });
  return { html, config, items, theme };
}

function getAllSkills() {
  return [];
}

function buildCard(item, t, index) {
  const emoji = item.emoji || '';
  const title = item.title || item.label || '';
  const desc = item.desc || '';
  const badge = item.badge || item.tag || '';
  const color = item.color || '#8B7355';
  const isEven = index % 2 === 0;
  return '<div class="card" style="background:var(--card-bg)"><div class="card-body">' + (emoji ? '<div class="card-top">' + (emoji ? '<div class="card-emoji">' + emoji + '</div>' : '') + '<div class="card-name">' + title + '</div></div>' : '') + (desc ? '<div class="card-desc">' + desc + '</div>' : '') + (badge ? '<div class="card-footer"><div class="card-badge" style="background:var(--card-badge-bg);color:var(--card-badge-text)">' + badge + '</div></div>' : '') + '</div></div>';
}

module.exports = {
  THEMES,
  parseNaturalLanguage,
  generateFromNaturalLanguage,
  generateFromConfig,
  generatePoster,
  getAllSkills,
  buildCard,
};
