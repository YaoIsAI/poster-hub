// ============================================================
// 解析器入口 - 组装所有解析模块
// ============================================================

const { parseGitHubProject } = require('./github');
const { parseLocalProject } = require('./local');
const { parseTemplate } = require('./template');

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

  // 1. 模板匹配（最高优先级）
  const templateResult = parseTemplate(text, lang);
  if (templateResult) {
    return { ...config, ...templateResult };
  }

  // 2. GitHub 项目解析
  const githubResult = parseGitHubProject(text, lang);
  if (githubResult) {
    return githubResult;
  }

  // 3. 本地项目解析
  const localResult = parseLocalProject(text, lang);
  if (localResult) {
    return localResult;
  }

  // 默认返回
  return config;
}

module.exports = { parseNaturalLanguage };