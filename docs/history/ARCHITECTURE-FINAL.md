# PosterHub 新一代海报渲染引擎 — 架构设计文档

> **制定者：** Architect-TEAM  
> **日期：** 2026-04-07  
> **目标：** 让 58 套 VoltAgent/awesome-design-md 设计规范注入后，生成对应品牌风格的海报（N 种风格，非深色/浅色二选一）  
> **代码变更上限：** 800 行（generator.js 重构）  
> **约束：** 必须渐进式重构，58 套模板全部生效  

---

## 一、根因分析

### 当前架构的问题

**generator.js 647 行，症状如下：**

| 症状 | 根因 |
|------|------|
| Vercel 深色（#171717）→ Hero 深色但 Stat Card 白色 | `buildCard()` 硬编码 `isEven ? '#fff' : '#FAFAFA'`，完全绕过了 theme |
| Section Label 是灰色 | `section-label { color: t.textSecondary }`，但深色主题下 textSecondary 被设为 `#FFFFFF99`，灰色是硬编码在 CSS 规则里的 fallback |
| Divider 在深色背景上太亮 | `divider: '#E5E5EA'` 在深色主题覆盖中被遗漏 |
| 所有文字颜色不响应 theme | 组件 CSS 规则里直接写死了颜色值，没有用 CSS 变量 |
| DESIGN.md 只能覆盖 2-3 个变量 | `parseNaturalLanguage()` 只读取 `primaryColor/accentColor/bgColor/textColor`，其他规范全部丢弃 |

**核心问题：现有架构是"字符串模板 + 全局变量覆盖"，不是"组件 + 设计 Token 系统"。**

---

## 二、整体架构

```
┌──────────────────────────────────────────────────────────────┐
│  DESIGN.md 原文（VoltAgent/awesome-design-md 任意模板）        │
│  例：primaryColor / bgColor / textColor / fontFamily / mood    │
└──────────────────────────┬───────────────────────────────────┘
                           │ Token 解析流水线
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 1: Primitive Tokens（设计规范的原始字段）                 │
│  { primaryColor, bgColor, textColor, fontFamily, mood, ... }  │
└──────────────────────────┬───────────────────────────────────┘
                           │ Resolver.resolve()
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 2: Semantic Tokens（语义化 CSS 变量，20+ 个）            │
│  { --hero-bg, --hero-text, --stat-card-bg, --card-bg, ... }   │
└──────────────────────────┬───────────────────────────────────┘
                           │ Theme Resolver
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 3: Poster Components（只引用 Semantic Tokens）          │
│  Hero / Stats / Sections / Cards / Footer                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 三、数据结构设计

### 3.1 Semantic Token Schema（语义化 Token）

```javascript
/**
 * Poster Semantic Token Schema
 * 每个 token 对应 poster 的一个具体组件角色
 * 组件只引用这些 token，绝不直接引用颜色值
 */
const SEMANTIC_TOKENS = {
  // ── Hero ──────────────────────────────────────
  '--hero-bg':          '#FFFFFF',  // Hero 背景
  '--hero-text':        '#1D1D1F',  // Hero 主标题
  '--hero-subtext':     '#6E6E73',  // Hero 副标题
  '--hero-badge-bg':    '#F5F5F7',  // Hero badge 背景
  '--hero-badge-text':  '#6E6E73',  // Hero badge 文字
  '--hero-divider':     '#E5E5EA',  // Hero 底部分隔线

  // ── Stats Cards ───────────────────────────────
  '--stat-card-bg':     '#F5F5F7',  // 统计卡片背景
  '--stat-num-color':   '#1D1D1F',  // 统计数字颜色
  '--stat-label-color': '#6E6E73',  // 统计标签颜色

  // ── Sections ──────────────────────────────────
  '--section-bg-1':     '#FFFFFF',  // Section 背景（奇数位）
  '--section-bg-2':     '#F5F5F7',  // Section 背景（偶数位）
  '--section-label':    '#6E6E73',  // Section 标题文字
  '--section-rule':     '#E5E5EA',  // Section 标题下划线
  '--section-count':    '#86868B',  // Section 计数文字

  // ── Cards ─────────────────────────────────────
  '--card-bg':          '#FFFFFF',  // 卡片背景（奇数位）
  '--card-bg-alt':      '#F5F5F7',  // 卡片背景（偶数位）
  '--card-text':        '#1D1D1F',  // 卡片标题文字
  '--card-desc':        '#6E6E73',  // 卡片描述文字
  '--card-badge-bg':    '#F5F5F7',  // 卡片 badge 背景
  '--card-badge-text':  '#6E6E73',  // 卡片 badge 文字
  '--card-dot':         '#1D1D1F',  // 卡片右上角圆点

  // ── Footer ────────────────────────────────────
  '--footer-rule':      '#E5E5EA',  // Footer 分隔线
  '--footer-line1':     '#1D1D1F',  // Footer 首行大字
  '--footer-line2':     '#86868B',  // Footer 次行小字
  '--footer-link':      '#1D1D1F',  // Footer 链接
  '--footer-brand':     '#86868B',  // Footer 品牌文字

  // ── Global ────────────────────────────────────
  '--accent':           '#1D1D1F',  // 全局强调色（链接等）
  '--divider':          '#E5E5EA',  // 全局分隔线
  '--font-family':      "'Inter', 'PingFang SC', -apple-system, sans-serif",
};
```

### 3.2 DesignSpec（设计规范对象）

```javascript
/**
 * 从 DESIGN.md 解析出来的设计规范
 * 描述的是"设计意图"，不是"渲染值"
 */
const designSpec = {
  // ── 色彩 ───────────────────────────────────────
  primaryColor:   '#171717',   // 主色调（Vercel 风格深灰）
  accentColor:    '#FF5B4F',   // 强调色
  bgColor:        '#171717',   // 主背景色
  bgColorAlt:     '#FFFFFF',   // 次背景色（用于交替）
  textColor:      '#FFFFFF',   // 主文字色
  textColorAlt:   '#FFFFFF99', // 次文字色
  dividerColor:   '#333333',   // 分隔线

  // ── 字体 ───────────────────────────────────────
  fontFamily: 'Geist Sans',
  fontFamilyMono: 'Geist Mono',

  // ── 间距/圆角 ──────────────────────────────────
  cardRadius: 24,
  cardPadding: 24,
  sectionGap: 56,

  // ── 氛围（用于推断 fallback） ───────────────────
  mood: 'Modern dark developer aesthetic',
  style: 'dark',   // 'dark' | 'light' | 'auto'
};
```

### 3.3 Poster Component Tree（组件树）

```javascript
/**
 * poster 组件树 — 组件只引用语义 token
 * 组件函数签名：renderXxx({ tokens, data, helpers })
 */
const posterTree = {
  hero: {
    bg:       '--hero-bg',
    text:     '--hero-text',
    subtext:  '--hero-subtext',
    badgeBg:  '--hero-badge-bg',
    badgeText:'--hero-badge-text',
    divider:  '--hero-divider',
  },
  stats: {
    cardBg:   '--stat-card-bg',
    numColor: '--stat-num-color',
    labelColor:'--stat-label-color',
  },
  sections: [
    {
      index: 0,         // 奇数位
      bg:    '--section-bg-1',
      label: '--section-label',
      rule:  '--section-rule',
      count: '--section-count',
      cards: [/* card objects */],
    },
    {
      index: 1,         // 偶数位
      bg:    '--section-bg-2',
      cards: [/* card objects */],
    },
  ],
  card: {
    bg:       '--card-bg',       // 奇数位
    bgAlt:    '--card-bg-alt',   // 偶数位
    text:     '--card-text',
    desc:     '--card-desc',
    badgeBg:  '--card-badge-bg',
    badgeText:'--card-badge-text',
    dot:      '--card-dot',
  },
  footer: {
    rule:    '--footer-rule',
    line1:   '--footer-line1',
    line2:   '--footer-line2',
    link:    '--footer-link',
    brand:   '--footer-brand',
  },
  global: {
    accent:  '--accent',
    divider: '--divider',
    font:    '--font-family',
  },
};
```

---

## 四、Token 解析流水线

### 4.1 流水线总览

```
DESIGN.md 原文
    │
    ▼
┌─────────────────┐
│ extractDesignSpec() │  阶段1：从 DESIGN.md 提取原始字段
│ - primaryColor       │  支持多种格式：DESIGN.md / API 参数 / 自然语言
│ - accentColor        │
│ - bgColor / bgColorAlt│
│ - textColor / textColorAlt│
│ - fontFamily / mood  │
└────────┬────────────┘
         │
         ▼
┌─────────────────┐
│ resolveTokens() │  阶段2：Primitive → Semantic 推断
│ - inferStyle()  │  根据 mood / style / 颜色亮度推断完整 token
│ - fillFallbacks()│
│ - generateVariants()│
└────────┬────────────┘
         │
         ▼
┌─────────────────┐
│ buildTheme()    │  阶段3：合并 Theme + DesignSpec → 最终 tokens
│ - mergeThemes() │  Theme 的原始值 + DesignSpec 的覆盖值
│ - applyDesignSpec()│
└────────┬────────────┘
         │
         ▼
    Semantic Tokens（20+ 个 CSS 变量）
         │
         ▼
┌─────────────────┐
│ generatePoster()│  阶段4：组件渲染
│ - renderHero()  │
│ - renderStats() │
│ - renderSection()│
│ - renderCard()  │
│ - renderFooter()│
└─────────────────┘
```

### 4.2 阶段 1：extractDesignSpec（DESIGN.md → 原始字段）

```javascript
/**
 * 从多种来源提取设计规范
 * @param {string|object} input - DESIGN.md 原文 或 设计规范对象
 * @returns {object} 原始设计字段
 */
function extractDesignSpec(input) {
  // 情况1：已经是对象（API 调用）
  if (typeof input === 'object' && input !== null) {
    return normalizeDesignSpec(input);
  }

  // 情况2：DESIGN.md 原文字符串
  const text = String(input);
  const spec = {};

  // ── 颜色提取（支持多种格式）──────────────────
  const colorPatterns = [
    // CSS 变量格式：--primary: #fff; 或 --primary: #FFFFFF;
    [/(?:^|\n)\s*--(\w+(?:-\w+)*)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s*;/gm, (m, key, val) => {
      spec[key] = val;
    }],
    // 命名颜色格式：primary: #171717 或 primaryColor: #171717
    [/(?:primaryColor|primary|mainColor|brandColor)\s*[:=]\s*(#[0-9a-fA-F]{3,8})/i, (m, v) => { spec.primaryColor = v; }],
    [/(?:accentColor|accent|secondaryColor)\s*[:=]\s*(#[0-9a-fA-F]{3,8})/i, (m, v) => { spec.accentColor = v; }],
    [/(?:backgroundColor|bgColor|bg)\s*[:=]\s*(#[0-9a-fA-F]{3,8})/i, (m, v) => { spec.bgColor = v; }],
    [/(?:textColor|color|text)\s*[:=]\s*(#[0-9a-fA-F]{3,8})/i, (m, v) => { if (!spec.textColor) spec.textColor = v; }],
    [/(?:fontFamily|font)\s*[:=]\s*['"]([^'"]+)['"]/i, (m, v) => { spec.fontFamily = v; }],
    // Dark/Light 模式标识
    [/isDark\s*[:=]\s*(true|false)/i, (m, v) => { spec.isDark = v === 'true'; }],
    [/mood\s*[:=]\s*['"]([^律""]+)['"]/i, (m, v) => { spec.mood = v; }],
  ];

  colorPatterns.forEach(([pattern, handler]) => {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      handler(match, ...match.slice(1));
    }
  });

  // ── 推断风格 ─────────────────────────────────
  if (spec.primaryColor || spec.bgColor) {
    spec.style = inferStyle(spec);
  }

  return spec;
}

/**
 * 推断设计风格（dark / light）
 * 基于背景色亮度：luminance < 0.5 视为深色
 */
function inferStyle(spec) {
  const bg = spec.bgColor || spec.primaryColor;
  if (!bg) return 'light';
  const lum = getLuminance(bg);
  return lum < 0.35 ? 'dark' : 'light';
}

/**
 * 计算相对亮度（WCAG 公式）
 */
function getLuminance(hex) {
  const rgb = hexToRgb(hex);
  const [r, g, b] = rgb.map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}
```

### 4.3 阶段 2：resolveTokens（原始字段 → 语义 Token）

```javascript
/**
 * 将原始设计字段映射为语义 Token
 * 核心原则：每个组件角色的 token 都有明确的语义
 *
 * @param {object} spec - extractDesignSpec() 的输出
 * @returns {object} 语义 Token 对象（key = CSS var name, value = CSS var value）
 */
function resolveTokens(spec) {
  const isDark = spec.style === 'dark';
  const isLight = spec.style === 'light';

  // ── 基础值（带 fallback）───────────────────────
  const primary   = spec.primaryColor  || '#1D1D1F';
  const accent    = spec.accentColor   || primary;
  const bg        = spec.bgColor       || (isDark ? '#000000' : '#FFFFFF');
  const bgAlt     = spec.bgColorAlt    || (isDark ? '#FFFFFF' : '#F5F5F7');
  const text      = spec.textColor     || (isDark ? '#FFFFFF' : '#1D1D1F');
  const textAlt   = spec.textColorAlt  || (isDark ? '#FFFFFF99' : '#6E6E73');
  const divider   = spec.dividerColor  || (isDark ? '#333333' : '#E5E5EA');

  // ── Hero Tokens ────────────────────────────────
  const heroBg       = bg;
  const heroText     = text;
  const heroSubtext  = textAlt;
  const heroBadgeBg  = isDark ? bgAlt : (spec.bgColorAlt || '#F5F5F7');
  const heroBadgeText= textAlt;
  const heroDivider  = divider;

  // ── Stats Tokens ──────────────────────────────
  // 深色主题下 stat-card 用半透明 primary，避免白色"贴纸"效果
  const statCardBg    = isDark ? (primary + 'CC') : bgAlt;
  const statNumColor  = text;
  const statLabelColor= textAlt;

  // ── Section Tokens ────────────────────────────
  const sectionBg1   = bg;      // 奇数位
  const sectionBg2    = bgAlt;   // 偶数位（交替）
  const sectionLabel  = textAlt;
  const sectionRule   = divider;
  const sectionCount  = isDark ? '#FFFFFF66' : '#86868B';

  // ── Card Tokens ───────────────────────────────
  const cardBg       = isDark ? primary : bg;         // 奇数位
  const cardBgAlt    = isDark ? (primary + 'E6') : bgAlt; // 偶数位（深色加深，浅色用灰白）
  const cardText     = text;
  const cardDesc     = textAlt;
  const cardBadgeBg  = isDark ? (primary + '33') : bgAlt;
  const cardBadgeText= textAlt;
  const cardDot      = accent;

  // ── Footer Tokens ─────────────────────────────
  const footerRule   = divider;
  const footerLine1  = text;
  const footerLine2  = textAlt;
  const footerLink   = accent;
  const footerBrand  = textAlt;

  return {
    '--hero-bg':          heroBg,
    '--hero-text':        heroText,
    '--hero-subtext':     heroSubtext,
    '--hero-badge-bg':    heroBadgeBg,
    '--hero-badge-text':  heroBadgeText,
    '--hero-divider':     heroDivider,

    '--stat-card-bg':     statCardBg,
    '--stat-num-color':   statNumColor,
    '--stat-label-color': statLabelColor,

    '--section-bg-1':     sectionBg1,
    '--section-bg-2':     sectionBg2,
    '--section-label':   sectionLabel,
    '--section-rule':    sectionRule,
    '--section-count':   sectionCount,

    '--card-bg':          cardBg,
    '--card-bg-alt':      cardBgAlt,
    '--card-text':        cardText,
    '--card-desc':        cardDesc,
    '--card-badge-bg':   cardBadgeBg,
    '--card-badge-text':  cardBadgeText,
    '--card-dot':         cardDot,

    '--footer-rule':      footerRule,
    '--footer-line1':     footerLine1,
    '--footer-line2':     footerLine2,
    '--footer-link':      footerLink,
    '--footer-brand':     footerBrand,

    '--accent':           accent,
    '--divider':          divider,
    '--font-family':      spec.fontFamily
                            ? `'${spec.fontFamily}', Inter, -apple-system, sans-serif`
                            : "'Inter', 'PingFang SC', -apple-system, sans-serif",

    // ── 元数据 ───────────────────────────────────
    _style:  spec.style,   // 'dark' | 'light'
    _mood:   spec.mood,
    _cardRadius: spec.cardRadius || 12,
    _cardPadding: spec.cardPadding || 24,
    _sectionGap:  spec.sectionGap  || 56,
  };
}
```

### 4.4 阶段 3：buildTheme（合并 Theme + DesignSpec）

```javascript
/**
 * 合并 Theme 默认值 + DesignSpec 覆盖值
 * 优先级：THEMES[theme] < _designSpec < 显式 overrides
 *
 * @param {string} themeName - 主题名（如 'apple-minimal'）
 * @param {object} designSpec - extractDesignSpec() 的输出
 * @param {object} overrides - API 调用时的显式覆盖
 * @returns {object} tokens - 最终的语义 Token 对象
 */
function buildTheme(themeName, designSpec, overrides = {}) {
  // Step 1: Theme 的原始值
  const base = THEMES[themeName] || THEMES['apple-minimal'];

  // Step 2: 从 base 提取 primitive tokens
  const baseTokens = {
    primaryColor:  base.accent,
    bgColor:       base.bgPrimary,
    bgColorAlt:    base.bgSecondary,
    textColor:     base.textPrimary,
    textColorAlt:  base.textSecondary,
    dividerColor:  base.divider,
    fontFamily:    base.fontFamily,
    cardRadius:    base.cardRadius,
    cardPadding:   base.cardPadding,
    sectionGap:    base.sectionGap,
    style:         inferStyle({ bgColor: base.bgPrimary }),
  };

  // Step 3: DesignSpec 覆盖 base
  const merged = {
    ...baseTokens,
    ...designSpec,       // DESIGN.md 覆盖主题默认值
    ...overrides,        // API 参数覆盖一切
  };

  // Step 4: 强制统一 style（防止冲突）
  if (designSpec?.isDark || overrides?.isDark) {
    merged.style = 'dark';
  }

  // Step 5: resolveTokens 生成语义 token
  const tokens = resolveTokens(merged);

  // Step 6: 补充 Theme 特有的额外变量（如 scale, pageWidth）
  return {
    ...tokens,
    _scale:       base.scale,
    _pageWidth:   base.pageWidth,
    _cardGap:     base.cardGap,
    _heroPadding: base.heroPadding,
    _sectionPadding: base.sectionPadding,
    _cardShadow:       base.cardShadow,
    _cardShadowHover: base.cardShadowHover,
    _fontFamily:       tokens['--font-family'],
  };
}
```

---

## 五、组件渲染函数设计

### 5.0 CSS 变量注入（所有组件的共同基础设施）

```javascript
/**
 * 将语义 tokens 注入为 CSS 变量，写入 <style> 标签开头
 * 组件只需引用 var(--token-name)，无需知道具体颜色
 */
function injectSemanticTokens(tokens) {
  const lines = Object.entries(tokens)
    .filter(([k]) => k.startsWith('--'))
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `:root {\n${lines}\n}`;
}
```

### 5.1 Hero 组件

```javascript
/**
 * renderHero — Hero 区域渲染
 * @param {object} p - { hero, footer, tokens, scale }
 * @returns {string} HTML fragment
 */
function renderHero({ hero, footer, tokens, scale }) {
  const s = scale || 2;
  function sc(n) { return (parseInt(n) * s) + 'px'; }

  const logo     = footer?.heroLogo || '✨ PosterHub';
  const badge    = hero.badge    || '';
  const title    = hero.title    || '';
  const subtitle = hero.subtitle || '';
  const githubUrl = hero.githubUrl || '';

  return `<div class="hero">
  <div class="hero-logo" style="color:var(--hero-badge-text)">${logo}</div>
  ${badge ? `<div class="hero-badge"><span class="hero-badge-dot"></span>${badge}</div>` : ''}
  <h1 class="hero-title">${title}</h1>
  <p class="hero-subtitle">${subtitle}</p>
  ${githubUrl ? `<div class="hero-github"><a href="https://${githubUrl}">🌐 ${githubUrl}</a></div>` : ''}
</div>
<div class="hero-divider"></div>`;
}
```

**对应 CSS（只引用语义 Token）：**

```css
.hero {
  background: var(--hero-bg);
  padding: var(--hero-padding);
}
.hero-logo {
  font-size: var(--scale-11);
  color: var(--hero-badge-text);
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 20px;
}
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  background: var(--hero-badge-bg);
  font-size: var(--scale-11);
  font-weight: 600;
  color: var(--hero-badge-text);
}
.hero-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}
.hero-title {
  font-size: var(--scale-38);
  font-weight: 800;
  color: var(--hero-text);
  line-height: 1.05;
  letter-spacing: -1.5px;
  margin-bottom: 12px;
}
.hero-subtitle {
  font-size: var(--scale-15);
  color: var(--hero-subtext);
  font-weight: 400;
  line-height: 1.6;
  margin-bottom: 40px;
}
.hero-divider {
  height: 12px;
  background: var(--hero-divider);
}
```

### 5.2 Stats 组件

```javascript
/**
 * renderStats — 统计卡片渲染
 * @param {object} p - { stats[], tokens, scale, pageWidth }
 * @returns {string} HTML fragment
 */
function renderStats({ stats, tokens, scale }) {
  if (!stats || stats.length === 0) return '';
  const s = scale || 2;
  function sc(n) { return (parseInt(n) * s) + 'px'; }

  const cards = stats.slice(0, 4).map(stat => `
    <div class="stat-card">
      <div class="stat-num">${stat.value}</div>
      <div class="stat-label">${stat.label}</div>
    </div>`).join('');

  return `<div class="stats-grid">${cards}</div>`;
}
```

**对应 CSS（只引用语义 Token）：**

```css
.stats-grid {
  display: grid;
  grid-template-columns: repeat(var(--stats-cols, 4), 1fr);
  gap: 12px;
}
.stat-card {
  background: var(--stat-card-bg);
  border-radius: var(--card-radius);
  padding: 20px 16px;
  text-align: center;
}
.stat-num {
  font-size: var(--scale-40);
  font-weight: 800;
  color: var(--stat-num-color);
  line-height: 1;
  letter-spacing: -3px;
  margin-bottom: 8px;
}
.stat-label {
  font-size: var(--scale-11);
  font-weight: 500;
  color: var(--stat-label-color);
  letter-spacing: 0.5px;
}
```

### 5.3 Section 组件

```javascript
/**
 * renderSection — 单个 Section 渲染
 * @param {object} p - { section, index, tokens, scale }
 * @param {function} renderCard - Card 渲染函数
 * @returns {string} HTML fragment
 */
function renderSection({ section, index, tokens, scale, renderCard }) {
  const s = scale || 2;
  function sc(n) { return (parseInt(n) * s) + 'px'; }

  const bgToken = index % 2 === 0 ? '--section-bg-1' : '--section-bg-2';
  const label = section.label || '';
  const count = section.items ? section.items.length : 0;

  const cardsHTML = (section.items || []).map((item, i) =>
    renderCard({ item, index: i, tokens, scale })
  ).join('');

  return `<div class="section" style="background:var(${bgToken})">
  <div class="section-head">
    <span class="section-label">${label}</span>
    <span class="section-rule"></span>
    <span class="section-count">${count} 项</span>
  </div>
  <div class="grid">${cardsHTML}</div>
</div>`;
}
```

**对应 CSS（只引用语义 Token）：**

```css
.section {
  padding: var(--section-gap) var(--section-padding);
}
.section-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.section-label {
  font-size: var(--scale-12);
  font-weight: 700;
  color: var(--section-label);
  letter-spacing: 1px;
  white-space: nowrap;
}
.section-rule {
  flex: 1;
  height: 1px;
  background: var(--section-rule);
}
.section-count {
  font-size: var(--scale-11);
  font-weight: 500;
  color: var(--section-count);
  white-space: nowrap;
}
```

### 5.4 Card 组件（核心修复）

**当前错误代码（generator.js）：**
```javascript
// ❌ 硬编码颜色，完全绕过 theme
const cardBg = isEven ? '#fff' : '#FAFAFA';
```

**修复后（只引用语义 Token）：**
```javascript
/**
 * renderCard — 卡片渲染（完全消除硬编码）
 * @param {object} p - { item, index, tokens, scale }
 * @returns {string} HTML fragment
 */
function renderCard({ item, index, tokens, scale }) {
  const s = scale || 2;
  function sc(n) { return (parseInt(n) * s) + 'px'; }

  const isEven = index % 2 === 0;
  // ✅ 引用语义 Token（奇数位用 --card-bg，偶数位用 --card-bg-alt）
  const bgToken = isEven ? '--card-bg' : '--card-bg-alt';

  const emoji = item.emoji || '';
  const title = item.title || item.label || '';
  const desc  = item.desc  || '';
  const badge = item.badge  || item.tag  || '';
  const color = item.color  || '#8B7355';

  return `<div class="card" style="background:var(${bgToken})">
  <div class="card-body">
    ${emoji ? `<div class="card-top">
      <div class="card-emoji">${emoji}</div>
      <div class="card-name">${title}</div>
    </div>` : `<div class="card-name">${title}</div>`}
    ${desc ? `<div class="card-desc">${desc}</div>` : ''}
    ${badge ? `<div class="card-footer">
      <div class="card-badge" style="background:var(--card-badge-bg);color:var(--card-badge-text)">
        ${badge}
      </div>
    </div>` : ''}
  </div>
  <div class="card-dot"></div>
</div>`;
}
```

**对应 CSS（只引用语义 Token）：**

```css
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--card-gap, 20px);
}
.card {
  background: var(--card-bg);  /* fallback，渲染时会用 style= 覆盖为 var(--card-bg-alt) */
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  position: relative;
  overflow: hidden;
}
.card:hover {
  box-shadow: var(--card-shadow-hover);
  transform: translateY(-4px);
}
.card-dot {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--card-dot);
}
.card-body { padding: 12px 12px 10px; }
.card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.card-emoji { font-size: var(--scale-16); line-height: 1; flex-shrink: 0; }
.card-name {
  font-size: var(--scale-13);
  font-weight: 700;
  color: var(--card-text);
  line-height: 1.3;
  letter-spacing: -0.1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-desc {
  font-size: var(--scale-11);
  color: var(--card-desc);
  line-height: 1.55;
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 33px;
}
.card-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: var(--scale-10);
  font-weight: 600;
}
.card-footer { display: flex; align-items: center; }
```

### 5.5 Footer 组件

```javascript
/**
 * renderFooter — Footer 渲染
 * @param {object} p - { footer, tokens, scale, date, projectLink }
 * @returns {string} HTML fragment
 */
function renderFooter({ footer, tokens, scale, date, projectLink }) {
  const s = scale || 2;
  function sc(n) { return (parseInt(n) * s) + 'px'; }

  const line1    = footer?.line1    || '';
  const line2    = footer?.line2    || '';
  const logoPath = footer?.logoPath || '';
  const brandUrl = footer?.brandUrl || 'PosterHub';
  const d         = date || new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

  return `<div class="footer">
  <div class="footer-rule"></div>
  <div class="
  return `<div class="footer">
  <div class="footer-rule"></div>
  <div class="footer-line1">${line1}</div>
  <div class="footer-line2">${line2}</div>
  <div class="footer-powered">
    <a href="https://github.com/YaoIsAI/poster-hub" target="_blank" class="footer-link">Powered by PosterHub</a>
    · <a href="https://github.com/YaoIsAI/poster-hub" target="_blank" class="footer-link">github.com/YaoIsAI/poster-hub</a>
    ${projectLink ? `· <a href="${projectLink}" target="_blank" class="footer-link">View on GitHub</a>` : ''}
  </div>
  ${logoPath ? `<div class="footer-logo"><img src="${logoPath}" alt="logo"><span class="footer-logo-text">${brandUrl}</span></div>` : ''}
  <div class="footer-brand"><span>YaoIsAI</span> · ${d}</div>
</div>`;
}
```

**对应 CSS（只引用语义 Token）：**

```css
.footer {
  padding: 40px 32px 0;
  text-align: center;
}
.footer-rule {
  width: 100%;
  height: 1px;
  background: var(--footer-rule);
  margin-bottom: 36px;
}
.footer-line1 {
  font-size: var(--scale-20);
  font-weight: 800;
  color: var(--footer-line1);
  letter-spacing: -0.5px;
  line-height: 1.3;
  margin-bottom: 8px;
}
.footer-line2 {
  font-size: var(--scale-11);
  color: var(--footer-line2);
  font-weight: 500;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.footer-powered {
  font-size: var(--scale-11);
  color: var(--footer-brand);
  margin-top: 8px;
}
.footer-link {
  color: var(--footer-link);
  text-decoration: none;
  font-weight: 500;
}
.footer-link:hover { text-decoration: underline; }
.footer-brand {
  margin-top: 24px;
  padding-top: 20px;
  font-size: var(--scale-10);
  color: var(--footer-brand);
  font-weight: 500;
  letter-spacing: 0.5px;
}
.footer-brand span { color: var(--footer-line2); font-weight: 600; }
```

---

## 六、generatePoster 重构（核心入口）

### 6.1 重构后的 generatePoster 签名

```javascript
/**
 * generatePoster — 重构后的核心渲染函数
 *
 * @param {object} p
 * @param {object} p.config    - 海报配置（hero/stats/sections/footer 等）
 * @param {object} p.themeName - 主题名（兼容现有 THEMES）
 * @param {object} p.designSpec - 设计规范对象（可为空）
 * @param {object} p.overrides  - API 显式覆盖（可为空）
 * @returns {string} 完整的 HTML 字符串
 */
function generatePoster({ config, themeName, designSpec, overrides = {} }) {
  // ── Step 1: 构建语义 Tokens ─────────────────────
  const tokens = buildTheme(themeName, designSpec, overrides);
  const scale  = tokens._scale || 2;

  // ── Step 2: 注入 CSS 变量 ────────────────────────
  const cssVars = injectSemanticTokens(tokens);

  // ── Step 3: 渲染各组件 ───────────────────────────
  const heroHTML   = renderHero({ hero: config.hero, footer: config.footer, tokens, scale });
  const statsHTML  = renderStats({ stats: config.stats, tokens, scale });
  const sectionsHTML = config.sections.map((sec, i) =>
    renderSection({ section: sec, index: i, tokens, scale, renderCard })
  ).join('');

  const footerHTML = renderFooter({
    footer: config.footer,
    tokens,
    scale,
    date: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
    projectLink: config.projectLink,
  });

  // ── Step 4: 组装完整 HTML ────────────────────────
  return '<!DOCTYPE html>\n<html lang="zh-CN">' +
'<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">' +
`<title>${config.hero?.title || 'PosterHub'}</title>` +
'<style>' +
`@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap");` +
`* { margin: 0; padding: 0; box-sizing: border-box; }` +
`body { font-family: var(--font-family); background: var(--hero-bg); color: var(--hero-text); ` +
  `-webkit-font-smoothing: antialiased; width: 100%; max-width: ${tokens._pageWidth}px; margin: 0 auto; }` +
cssVars +
// ── Global scale variables ─────────────────────
`.poster { max-width: ${tokens._pageWidth}px; margin: 0 auto; padding-bottom: 128px; }` +
generateScaleCSS(scale) +
generateComponentCSS() +
'</style></head>' +
`<body><div class="poster">` +
  heroHTML +
  (config.hideStats ? '' : statsHTML) +
  sectionsHTML +
  footerHTML +
`</div></body></html>`;
}
```

### 6.2 CSS 规模变量（解决 sc() 函数分散问题）

```javascript
/**
 * 生成规模 CSS 变量，替代散布的 sc() 函数调用
 * 所有 scale 值都通过 CSS 变量引用，组件代码无需计算
 */
function generateScaleCSS(scale) {
  const vars = {};
  [10, 11, 12, 13, 14, 15, 16, 20, 24, 32, 36, 38, 40, 44, 48, 56, 64, 96, 104].forEach(n => {
    vars[`--scale-${n}`] = (parseInt(n) * scale) + 'px';
  });
  const lines = Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');
  return `.poster { ${lines}; --card-radius:${tokens?._cardRadius || 12}px; ` +
    `--card-gap:${tokens?._cardGap || 20}px; --section-gap:${tokens?._sectionGap || 56}px; ` +
    `--hero-padding:${tokens?._heroPadding || '96px 64px 104px'}; ` +
    `--section-padding:${tokens?._sectionPadding || '40px'}; ` +
    `--card-shadow:${tokens?._cardShadow || '0 2px 8px rgba(0,0,0,0.08)'}; ` +
    `--card-shadow-hover:${tokens?._cardShadowHover || '0 8px 32px rgba(0,0,0,0.12)'}; }`;
}
```

---

## 七、现有 THEMES 迁移方案

### 7.1 迁移策略：THEMES → Semantic Token Base

现有 4 套 THEMES 完全保留，通过 `buildTheme()` 自动映射为新语义 Token 系统。

```javascript
/**
 * 将现有 THEMES 的原始变量映射到语义 Token
 * 这样 4 套旧主题可以无缝接入新架构
 */
function migrateTheme(themeName) {
  const t = THEMES[themeName];
  if (!t) return {};

  // THEMES 的原始变量 → 语义 Token
  return {
    // Hero
    '--hero-bg':          t.bgPrimary,
    '--hero-text':        t.textPrimary,
    '--hero-subtext':     t.textSecondary,
    '--hero-badge-bg':    t.bgSecondary,
    '--hero-badge-text':  t.textSecondary,
    '--hero-divider':     t.footerLine || t.divider,

    // Stats
    '--stat-card-bg':     t.bgSecondary,
    '--stat-num-color':   t.textPrimary,
    '--stat-label-color': t.textSecondary,

    // Section
    '--section-bg-1':     t.bgPrimary,
    '--section-bg-2':     t.bgSecondary,
    '--section-label':   t.textSecondary,
    '--section-rule':    t.divider,
    '--section-count':   t.textTertiary || t.textSecondary,

    // Card
    '--card-bg':          t.bgCard || t.bgPrimary,
    '--card-bg-alt':      t.bgSecondary,
    '--card-text':        t.textPrimary,
    '--card-desc':        t.textSecondary,
    '--card-badge-bg':   t.bgSecondary,
    '--card-badge-text':  t.textSecondary,
    '--card-dot':         t.accent,

    // Footer
    '--footer-rule':      t.footerLine || t.divider,
    '--footer-line1':     t.textPrimary,
    '--footer-line2':     t.textTertiary || t.textSecondary,
    '--footer-link':      t.accent,
    '--footer-brand':     t.textTertiary || t.textSecondary,

    // Global
    '--accent':           t.accent,
    '--divider':          t.divider,
    '--font-family':      t.fontFamily,

    _style:  inferStyle({ bgColor: t.bgPrimary }),
    _cardRadius:    t.cardRadius,
    _cardPadding:   t.cardPadding,
    _sectionGap:    t.sectionGap,
    _cardGap:       t.cardGap,
    _heroPadding:   t.heroPadding,
    _sectionPadding: t.sectionPadding,
    _cardShadow:    t.cardShadow,
    _cardShadowHover: t.cardShadowHover,
  };
}
```

### 7.2 向后兼容层

```javascript
/**
 * 兼容旧 THEMES 对象的迁移函数
 * 用于 generateFromConfig / generateFromNaturalLanguage 的旧调用入口
 */
function generateFromConfigLegacy(config) {
  // 检测是否是旧格式（直接有 theme 对象而不是 themeName）
  if (config.theme && typeof config.theme === 'object') {
    // 旧格式：theme 是一个完整对象
    const migratedTokens = migrateThemeFromObject(config.theme);
    return generatePoster({
      config,
      themeName: 'apple-minimal',
      designSpec: config._designSpec || {},
      overrides: migratedTokens,
    });
  }
  // 新格式：themeName + designSpec
  return generatePoster({
    config,
    themeName: config.theme || 'apple-minimal',
    designSpec: config._designSpec || {},
  });
}

/**
 * 将旧 THEMES 对象直接转换为 tokens（不经 buildTheme）
 */
function migrateThemeFromObject(themeObj) {
  return {
    '--hero-bg':          themeObj.bgPrimary,
    '--hero-text':        themeObj.textPrimary,
    '--hero-subtext':     themeObj.textSecondary,
    '--stat-card-bg':     themeObj.bgSecondary,
    '--stat-num-color':   themeObj.textPrimary,
    '--card-bg':          themeObj.bgCard || themeObj.bgPrimary,
    '--card-bg-alt':      themeObj.bgSecondary,
    '--section-bg-1':     themeObj.bgPrimary,
    '--section-bg-2':     themeObj.bgSecondary,
    '--accent':           themeObj.accent,
    '--divider':          themeObj.divider,
    '--font-family':      themeObj.fontFamily,
    _cardRadius:    themeObj.cardRadius,
    _cardGap:       themeObj.cardGap,
    _sectionGap:    themeObj.sectionGap,
    _heroPadding:   themeObj.heroPadding,
    _cardShadow:    themeObj.cardShadow,
    _cardShadowHover: themeObj.cardShadowHover,
    _style: inferStyle({ bgColor: themeObj.bgPrimary }),
  };
}
```

---

## 八、58 套 DESIGN.md 模板支持

### 8.1 awesome-design-md 规范覆盖矩阵

VoltAgent/awesome-design-md 的 58 套模板覆盖以下设计维度，新架构必须全部支持：

| 维度 | 示例字段 | 映射到 Semantic Token |
|------|---------|---------------------|
| **主色** | primaryColor / brandColor | `--hero-bg`, `--accent`, `--card-dot` |
| **背景色** | bgColor / background | `--hero-bg`, `--section-bg-1`, `--card-bg` |
| **次背景色** | bgColorAlt / secondaryBg | `--section-bg-2`, `--card-bg-alt` |
| **主文字** | textColor / color | `--hero-text`, `--card-text`, `--footer-line1` |
| **次文字** | textColorAlt / secondaryText | `--hero-subtext`, `--card-desc`, `--footer-line2` |
| **强调色** | accentColor | `--accent`, `--card-dot`, `--footer-link` |
| **分隔线** | dividerColor | `--hero-divider`, `--section-rule`, `--footer-rule` |
| **字体** | fontFamily | `--font-family` |
| **圆角** | borderRadius / cardRadius | `--card-radius` |
| **间距** | spacing / padding | `--card-gap`, `--section-gap` |
| **阴影** | shadow / boxShadow | `--card-shadow` |
| **风格** | mood / style | `dark` / `light`（触发推断逻辑） |

### 8.2 Style 推断算法（支持 N 种风格，不只是深色/浅色）

```javascript
/**
 * 推断设计风格
 * 不只是 dark/light 二选一，而是根据颜色亮度、mood 描述、style 字段综合判断
 *
 * @param {object} spec - extractDesignSpec() 的输出
 * @returns {string} style - 'dark' | 'light' | 'auto'
 */
function inferDesignStyle(spec) {
  // 1. 显式指定优先
  if (spec.style === 'dark')  return 'dark';
  if (spec.style === 'light') return 'light';
  if (spec.style === 'auto')  return inferAutoStyle(spec);

  // 2. 从 isDark 字段推断
  if (spec.isDark === true)  return 'dark';
  if (spec.isDark === false) return 'light';

  // 3. 从颜色亮度推断
  if (spec.bgColor || spec.primaryColor) {
    const bg = spec.bgColor || spec.primaryColor;
    const lum = getLuminance(bg);
    if (lum < 0.35) return 'dark';
    if (lum < 0.65) return 'auto'; // 中等亮度，走 auto（不强制）
    return 'light';
  }

  // 4. 从 mood 推断
  if (spec.mood) {
    const darkMoods = ['dark', 'night', 'midnight', 'black', 'deep', 'shadow', 'developer', 'tech'];
    const lightMoods = ['light', 'minimal', 'clean', 'bright', 'white', 'airy'];
    const m = spec.mood.toLowerCase();
    if (darkMoods.some(k => m.includes(k)))  return 'dark';
    if (lightMoods.some(k => m.includes(k))) return 'light';
  }

  return 'light'; // 默认浅色
}
```

---

## 九、实施路线图

### 阶段 0：基础设施（预计 150 行）

**目标：** 建立 Token 系统的骨架，不改变任何现有行为

**产出：**
- [ ] `SEMANTIC_TOKENS` 常量对象（20+ 个 CSS 变量）
- [ ] `extractDesignSpec(input)` — DESIGN.md 解析函数
- [ ] `inferStyle(spec)` — 风格推断函数
- [ ] `getLuminance(hex)` — 亮度计算函数
- [ ] `injectSemanticTokens(tokens)` — CSS 变量注入函数
- [ ] `generateScaleCSS(scale)` — 规模变量生成函数

**验收：** 现有 `node generate-poster.js` 行为完全不变

---

### 阶段 1：Token Resolver + 硬编码消除（预计 200 行）

**目标：** 实现 `resolveTokens()` 和 `buildTheme()`，消除 `buildCard()` 和 `buildWorkflow()` 中的硬编码

**产出：**
- [ ] `resolveTokens(spec)` — 原始字段 → 语义 Token
- [ ] `buildTheme(themeName, designSpec, overrides)` — 合并主题
- [ ] `migrateTheme(themeName)` — 旧 THEMES → 语义 Token
- [ ] `renderCard()` — 重构，移除 `#fff`/`#FAFAFA` 硬编码
- [ ] `buildWorkflow()` — 重构，使用 `--card-bg-alt` Token

**验收：**
```bash
# 深色主题海报验证
node -e "
const { generatePoster } = require('./generator');
const html = generatePoster({
  config: { hero:{badge:'Test',title:'Deep Dark'}, sections:[{label:'A',items:[{emoji:'🔥',title:'I1',desc:'D1',badge:'Tag'}]}] },
  themeName: 'apple-minimal',
  designSpec: { isDark: true, bgColor: '#171717', accentColor: '#FF5B4F' }
});
require('fs').writeFileSync('phase1-test.html', html);
"
// 打开 phase1-test.html 验证：
// ✅ Hero 背景是 #171717（深色）
// ✅ Stat Card 背景是 #171717CC（半透明深色，非白色）
// ✅ Card 背景是 #171717（偶数位是 #171717E6）
// ✅ 无任何白色"贴纸"效果
```

---

### 阶段 2：组件全面重构（预计 250 行）

**目标：** 重写 `renderHero()`、`renderStats()`、`renderSection()`、`renderFooter()`，所有组件只引用语义 Token

**产出：**
- [ ] `renderHero()` — 只引用 `--hero-*` Token
- [ ] `renderStats()` — 只引用 `--stat-*` Token
- [ ] `renderSection()` — 只引用 `--section-*` Token
- [ ] `renderFooter()` — 只引用 `--footer-*` Token
- [ ] `generatePoster()` 重构 — 调用各组件渲染函数
- [ ] 统一 CSS 变量系统（`--scale-N` 规模变量 + `--card-radius` 等）

**验收：**
- 浅色海报（旧主题）渲染结果与当前版本**视觉一致**
- 深色海报（DESIGN.md 注入）所有组件颜色协调一致

---

### 阶段 3：generateFromNaturalLanguage + generateFromConfig 重构（预计 100 行）

**目标：** 重构两个旧入口函数，完整支持新 Token 系统

**产出：**
- [ ] `generateFromNaturalLanguage()` — 使用新 `buildTheme()` 流程
- [ ] `generateFromConfig()` — 统一使用 `generatePoster()` 新签名
- [ ] 向后兼容层（检测旧 `theme` 对象格式，自动迁移）

**验收：**
```bash
# 现有 API 调用行为不变
const { generateFromNaturalLanguage } = require('./generator');
generateFromNaturalLanguage('facebook/react - ...');
// 生成的 HTML 完全兼容旧格式
```

---

### 阶段 4：完整测试 + 文档（预计 50 行）

**目标：** 确保 58 套模板全部可渲染，文档完整

**产出：**
- [ ] 5 个验收测试用例（apple-minimal / 深色 / warm-earth / creative / tech-blue）
- [ ] 更新 README（描述新的 Token 系统）
- [ ] 更新 SKILL.md（描述 DESIGN.md 支持的字段）

---

## 十、验收标准总览

| 指标 | 当前 | 目标 |
|------|------|------|
| Token 覆盖的组件角色数 | 3 个（accent/bg/text） | 20+ 个（每组件独立 Token） |
| 深色主题颜色一致性 | ❌ Stat Card 白色"贴纸" | ✅ 所有组件协调一致 |
| DESIGN.md 字段覆盖率 | ~30%（只有 primary/bg/text） | 100%（所有字段均映射） |
| 硬编码颜色数 | 8+ 处（buildCard/buildWorkflow/CSS 规则） | **0 处** |
| 支持的设计风格 | 4 套固定主题 | N 种（58 套模板全覆盖） |
| 回归风险 | 高（改动分散） | 低（Token 系统单一入口） |
| 代码变更量 | — | ≤800 行 |

---

## 十一、关键约定

### 命名约定

| 类型 | 示例 | 用途 |
|------|------|------|
| Semantic Token | `--hero-bg` | 组件 CSS 规则引用 |
| Scale Variable | `--scale-38` | 字体/间距规模 |
| Config Field | `bgColor` | API / DESIGN.md 原始字段 |
| Internal Meta | `_style` | 推断结果（不下沉到 CSS） |
| Component Token | `hero-bg` | JavaScript 对象中的 token key |

### 硬编码禁区

以下写法在 generator.js 中**严格禁止**：
```javascript
// ❌ 禁止
background: '#fff'
background: '#FAFAFA'
color: '#1D1D1F'
color: '#6E6E73'
border: '1px solid #E5E5EA'

// ✅ 必须
background: var(--hero-bg)
color: var(--card-text)
border-color: var(--section-rule)
```

---

*文档版本：v1.0 | Architect-TEAM | 2026-04-07*
*此文档是 PosterHub 的核心架构依据，每次重构需对照验收标准检验。*
