/**
 * poster-validator.js - 海报内容验证器
 * 从 server.js 提取（~120行）
 */

function validatePosterHTML(html, sourceData) {
  const issues = [];

  function extract(selector, regex) {
    const m = new RegExp(regex || selector.replace(/[<>]/g, '').replace(/class=.([^"]+)./, '(?:[^>]*>)([^<]+)'), 'i').exec(html);
    return m ? m[1].trim() : null;
  }

  const heroTitle = /class="hero-title[^>]*>([^<]+)</.exec(html);
  const heroSubtitle = /class="hero-subtitle[^>]*>([^<]+)</.exec(html);
  const heroBadge = /class="hero-badge[^>]*>([\s\S]*?)<\/div>/.exec(html);
  const statNums = [...html.matchAll(/class="stat-num[^>]*>([^<]+)</g)].map(m => m[1]);
  const cardNames = [...html.matchAll(/class="card-name[^>]*>([^<]+)</g)].map(m => m[1]);

  if (sourceData) {
    if (sourceData.owner && sourceData.name) {
      const expectedTitle = sourceData.owner + '/' + sourceData.name;
      if (heroTitle && heroTitle[1] !== expectedTitle) {
        issues.push({ type: 'title', expected: expectedTitle, actual: heroTitle[1] });
      }
    }

    if (sourceData.stars !== undefined && sourceData.stars > 0) {
      const hasStars = statNums.some(n => {
        const normalized = n.replace(/,/g, '').toLowerCase();
        const num = parseFloat(normalized);
        const units = { 'k': 1e3, 'm': 1e6, 'w': 1e4 };
        const unit = normalized.match(/[kmw]$/);
        const multiplier = unit ? units[unit[0]] : 1;
        const parsed = unit ? num * multiplier : num;
        return parsed > 0 && !isNaN(parsed);
      });
      if (!hasStars) {
        issues.push({ type: 'stars', expected: sourceData.stars, found: statNums });
      }
    }

    if (sourceData.topics && sourceData.topics.length > 0) {
      const topicCount = cardNames.filter(n => sourceData.topics.includes(n)).length;
      if (topicCount < sourceData.topics.length * 0.5) {
        issues.push({ type: 'topics', expected: sourceData.topics.length, found: cardNames.length });
      }
    }
  }

  if (!heroTitle) issues.push({ type: 'missing', field: 'hero-title' });
  if (!heroSubtitle) issues.push({ type: 'missing', field: 'hero-subtitle' });
  if (!heroBadge) issues.push({ type: 'missing', field: 'hero-badge' });
  if (statNums.length === 0 && sourceData && sourceData.owner) {
    issues.push({ type: 'missing', field: 'stats' });
  }

  return { valid: issues.length === 0, issues };
}

function classifyHarnessIssue(issue) {
  if (typeof issue === 'string') {
    const hardPatterns = [
      'HTML 为空', '标签未闭合', '缺少样式定义',
      '缺少关键元素', 'HTML 内容过短', '乱码'
    ];
    const isHard = hardPatterns.some(p => issue.includes(p));
    return { severity: isHard ? 'hard' : 'soft', message: issue };
  }

  if (!issue || typeof issue !== 'object') {
    return { severity: 'soft', message: String(issue) };
  }

  if (issue.type === 'missing') {
    return { severity: 'hard', message: '缺少关键字段: ' + issue.field };
  }
  if (issue.type === 'title') return { severity: 'soft', message: '标题与源数据不完全一致' };
  if (issue.type === 'topics') return { severity: 'soft', message: '主题词覆盖不足' };
  if (issue.type === 'stars') return { severity: 'soft', message: '统计信息未充分体现' };

  return { severity: 'soft', message: JSON.stringify(issue) };
}

function summarizeHarnessIssues(issues) {
  const normalized = (issues || []).map(classifyHarnessIssue);
  const hardIssues = normalized.filter(i => i.severity === 'hard');
  const softIssues = normalized.filter(i => i.severity === 'soft');
  const messages = Array.from(new Set(normalized.map(i => i.message).filter(Boolean)));
  return { hardIssues, softIssues, messages, blocking: hardIssues.length > 0 };
}

module.exports = { validatePosterHTML, classifyHarnessIssue, summarizeHarnessIssues };
