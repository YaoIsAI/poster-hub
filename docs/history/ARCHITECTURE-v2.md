# PosterHub 海报渲染引擎重构方案 — ARCHITECTURE-v2.md

中文 | [English Summary](#english-summary)

> 制定者：Architect-RED（资深前端架构师）  
> 日期：2026-04-07  
> 状态：设计稿，待瑶确认后实施

---

## 一、问题总结（精确定位）

### 症状 vs 根因对照

| 症状 | 根因 | 位置 |
|------|------|------|
| 深色主题文字对比度低 | `.hero-badge` 等组件的 CSS 规则里用了 `t.textSecondary`（浅色主题值 `#6E6E73`），在深色 Hero 里不够亮 | `generatePoster()` CSS 拼接字符串 |
| Stat Card 数字是深色 | `.stat-num { color: ' + t.textPrimary + '` — 深色主题下 `textPrimary` 被覆盖为 `#FFFFFF`，但 `t._allStats[].color` 硬编码了如 `#f0ad4e` | `generatePoster()` 硬编码 `color: '#f0ad4e'` |
| Hero Badge 浅色背景在深色 Hero 里 | `.hero-badge { background: ' + t.bgSecondary + '` — 深色主题下 `bgSecondary` 被设为 `darkBg + 'CC'`（半透明），而 `bgCard` 是 `lightBg`（白色） | 深色覆盖逻辑错误 |
| Divider 在深色背景上太亮 | `divider: '#E5E5EA'`（浅灰），在深色背景上成了"白线" | 深色主题覆盖遗漏 |
| Card 交替深/白太强烈 | `buildCard()` 用 `isEven ? '#fff' : '#FAFAFA'` 完全不经过 theme | `buildCard()` 硬编码 |
| 改一个变量牵一堆地方 | CSS 全在字符串拼接里，没有组件抽象 | 整体架构问题 |

### 核心问题

**现有架构是"字符串模板 + 全局变量覆盖"，不是"组件 + 设计 Token 系统"。**

---

## 二、整体架构设计

### 2.1 设计目标

```
现状：字符串拼接 + 零散 CSS 变量
目标：语义化组件层 + 两级设计 Token 系统
```

### 2.2 两级 Token 系统

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Primitive Tokens（主题定义里的原始值）           │
│  例: bgPrimary=#FFFFFF, textPrimary=#1D1D1F, accent=#007AFF │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Semantic Tokens（语义变量，组件只引用这些）        │
│  例: --hero-bg, --stat-num-color, --card-bg, --divider    │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Components（Hero/Stats/Section/Card/Footer）   │
│  只引用 Semantic Tokens，不引用 Primitive Tokens          │
└─────────────────────────────────────────────────────────┘
```

### 2.3 数据结构定义

#### Primitive Token Schema（现有 THEMES 对象）

```typescript
interface PrimitiveTheme {
  // 背景
  bgPrimary:      string;   // 页面/外层背景
  bgSecondary:    string;   // Hero底部条/统计卡背景
  bgCard:         string;   // 卡片背景（仅浅色主题用白色）

  // 文字
  textPrimary:    string;   // 标题
  textSecondary: string;   // 副标题/描述
  textTertiary:  string;   // 标签/Footer

  // 强调
  accent:         string;   // 主强调色
  accentMid:      string;   // 次强调色
  accentLight:    string;   // 浅强调（标签背景）

  // 卡片
  cardShadow:       string;
  cardShadowHover:  string;
  cardRadius:       number;  // px, 无单位（scale 倍数）

  // 布局
  divider:       string;
  dividerLight:  string;
  fontFamily:    string;

  // 尺寸
  scale:          number;  // 2
  pageWidth:      number;  // 780
  sectionGap:     number;  // 56
  cardGap:        number;  // 20
  heroPadding:    string;  // '96px 64px 104px'
  sectionPadding: string;  // '40px'
  footerLine:     string;
}
```

#### Semantic Token Schema（新层，在 generatePoster 内部派生）

```typescript
interface SemanticTokens {
  // Hero
  '--hero-bg':        string;
  '--hero-badge-bg':  string;
  '--hero-badge-color': string;
  '--hero-title-color': string;
  '--hero-subtitle-color': string;

  // Stat Card
  '--stat-card-bg':   string;
  '--stat-num-color': string;
  '--stat-label-color': string;

  // Section
  '--section-bg-odd':  string;
  '--section-bg-even': string;
  '--section-label-color': string;
  '--divider-color':   string;

  // Card
  '--card-bg-a':      string;  // 偶数索引
  '--card-bg-b':      string;  // 奇数索引
  '--card-name-color': string;
  '--card-desc-color': string;
  '--card-badge-bg':   string;

  // Footer
  '--footer-line1-color': string;
  '--footer-line2-color': string;
}
```

#### Component Props Schema

```typescript
interface HeroProps {
  badge:         string;      // 'GitHub ⭐ 7.6k'
  title:         string;      // 'poster-hub'
  subtitle:      string;      // 'Open source project'
  githubUrl?:    string;
  logo?:         string;      // '✨ PosterHub'
}

interface StatItem {
  value:  string;             // '7.6k', 'TypeScript', '12'
  label:  string;             // 'Stars', 'Language', 'Topics'
  color?: string;             // 可选，用语义色；无则用 accent
}

interface CardItem {
  emoji:  string;             // '🔥'
  title:  string;             // 'Item Name'
  desc:   string;             // 'Description text'
  badge?: string;             // 'Tag'
  color?: string;             // 标签颜色，可选
}

interface SectionProps {
  label:  string;
  items:  CardItem[];
}

interface PosterConfig {
  theme:    string;           // 'apple-minimal' | 'warm-earth' | ...
  hero:     HeroProps;
  stats:    StatItem[];
  sections: SectionProps[];
  footer: {
    line1:    string;
    line2:    string;
    logoPath?: string;
    brandUrl?: string;
  };
  // 新增：覆盖色（用于 DESIGN.md 注入）
  overrides?: Partial<PrimitiveTheme>;
  // 新增：深色模式标记
  darkMode?: boolean;
}
```

### 2.4 核心接口设计

#### `resolveTokens(theme, overrides, darkMode) → SemanticTokens`

```typescript
//伪代码
function resolveTokens(theme: PrimitiveTheme, overrides?: Partial<PrimitiveTheme>, darkMode?: boolean): SemanticTokens {
  const base = { ...theme, ...overrides };
  const isDark = darkMode || overrides?.isDark;

  if (isDark) {
    const darkBg   = base.bgPrimary  || '#000000';
    const lightBg  = base.bgCard    || '#FFFFFF';
    return {
      '--hero-bg':           darkBg,
      '--hero-badge-bg':     darkBg + '99',    // 半透明深色
      '--hero-badge-color':  lightBg + 'CC',
      '--hero-title-color':  '#FFFFFF',
      '--hero-subtitle-color': '#FFFFFF99',
      '--stat-card-bg':      darkBg + 'E6',    // 90% 深色
      '--stat-num-color':    '#FFFFFF',
      '--stat-label-color':  '#FFFFFF99',
      '--section-bg-odd':    darkBg,
      '--section-bg-even':   lightBg,
      '--section-label-color': '#FFFFFF99',
      '--divider-color':     '#333333',
      '--card-bg-a':        darkBg,
      '--card-bg-b':        darkBg + 'CC',
      '--card-name-color':  '#FFFFFF',
      '--card-desc-color':  '#FFFFFF99',
      '--card-badge-bg':    darkBg + 'E6',
      '--footer-line1-color': '#FFFFFF',
      '--footer-line2-color': '#FFFFFF66',
    };
  }

  // 浅色模式
  return {
    '--hero-bg':           base.bgPrimary,
    '--hero-badge-bg':     base.bgSecondary,
    '--hero-badge-color':  base.textSecondary,
    '--hero-title-color':  base.textPrimary,
    '--hero-subtitle-color': base.textSecondary,
    '--stat-card-bg':      base.bgSecondary,
    '--stat-num-color':    base.textPrimary,
    '--stat-label-color':  base.textSecondary,
    '--section-bg-odd':    base.bgPrimary,
    '--section-bg-even':   base.bgSecondary,
    '--section-label-color': base.textSecondary,
    '--divider-color':     base.divider,
    '--card-bg-a':        base.bgCard || base.bgPrimary,
    '--card-bg-b':        base.bgSecondary,
    '--card-name-color':  base.textPrimary,
    '--card-desc-color':  base.textSecondary,
    '--card-badge-bg':    base.bgSecondary,
    '--footer-line1-color': base.textPrimary,
    '--footer-line2-color': base.textTertiary,
  };
}
```

#### `renderHero(props, tokens, scale) → HTML`

```typescript
// 所有颜色引用语义 token，不引用原始 theme 变量
function renderHero({ badge, title, subtitle, githubUrl, logo }, tokens, s) {
  const sc = n => (parseInt(n) * s) + 'px';
  return `<div class="hero" style="background:var(--hero-bg)">
    <div class="hero-logo" style="color:var(--hero-subtitle-color)">${logo}</div>
    <div class="hero-badge" style="background:var(--hero-badge-bg);color:var(--hero-badge-color)">
      <span class="hero-badge-dot"></span>${badge}
    </div>
    <div class="hero-title" style="color:var(--hero-title-color)">${title}</div>
    <div class="hero-subtitle" style="color:var(--hero-subtitle-color)">${subtitle}</div>
    ...stats grid...
  </div>`;
}
```

#### `renderCard(item, index, tokens) → HTML`

```typescript
// 不再依赖 index 奇偶决定硬编码颜色，改为语义 token
function renderCard(item, index, tokens) {
  const bg = index % 2 === 0 ? 'var(--card-bg-a)' : 'var(--card-bg-b)';
  const badgeBg = item.color ? item.color + '20' : 'var(--card-badge-bg)';
  const badgeColor = item.color || 'var(--hero-subtitle-color)';
  return `<div class="card" style="background:${bg}">
    <div class="card-body">
      <div class="card-top">
        <div class="card-emoji">${item.emoji}</div>
        <div class="card-name" style="color:var(--card-name-color)">${item.title}</div>
      </div>
      <div class="card-desc" style="color:var(--card-desc-color)">${item.desc}</div>
      ${item.badge ? `<div class="card-badge" style="background:${badgeBg};color:${badgeColor}">${item.badge}</div>` : ''}
    </div>
  </div>`;
}
```

### 2.5 文件结构（重构后）

```
generator.js
├── Token 系统
│   ├── THEMES (现有 4 个主题，Primitive Tokens)
│   ├── resolveTokens(theme, overrides, darkMode)  ← 新增
│   └── buildCSSVariables(tokens, scale) → CSS string  ← 新增
│
├── 组件渲染函数（全部新增，收口硬编码）
│   ├── renderHero(props, s) → HTML
│   ├── renderStats(stats, tokens, s) → HTML
│   ├── renderSection(section, index, tokens, s) → HTML
│   ├── renderCard(item, index, tokens) → HTML
│   └── renderFooter(footer, tokens, s) → HTML
│
├── 入口函数（修改）
│   ├── generatePoster(config, theme)  ← 重构，组件化
│   ├── generateFromNaturalLanguage(nl, overrides)  ← 兼容
│   └── generateFromConfig(config)  ← 兼容
│
└── 工具函数
    ├── parseNaturalLanguage(nl, lang, designSpec)  ← 兼容
    └── detectTheme(config)  ← 未来 Phase 1
```

---

## 三、深色主题下各组件配色策略

### 3.1 配色对照表

| 组件 | 子元素 | 浅色主题值 | 深色主题值 | 说明 |
|------|--------|-----------|-----------|------|
| **Hero** | 背景 | `bgPrimary` (#FFF) | `#171717` | 主背景深色 |
| **Hero Badge** | 背景 | `bgSecondary` (#F5F5F7) | `#17171799` | 半透明深色，有层次 |
| **Hero Badge** | 文字 | `textSecondary` (#6E6E73) | `#FFFFFFCC` | 高对比度白色系 |
| **Hero Title** | 文字 | `textPrimary` (#1D1D1F) | `#FFFFFF` | 纯白 |
| **Hero Subtitle** | 文字 | `textSecondary` (#6E6E73) | `#FFFFFF99` | 70%白 |
| **Stat Card** | 背景 | `bgSecondary` (#F5F5F7) | `#171717E6` | 90%深色，不透明 |
| **Stat Number** | 文字 | `textPrimary` (#1D1D1F) | `#FFFFFF` | **纯白，不随 stat.color** |
| **Stat Label** | 文字 | `textSecondary` (#6E6E73) | `#FFFFFF99` | 70%白 |
| **Section（偶）** | 背景 | `bgPrimary` (#FFF) | `#171717` | 深色 |
| **Section（奇）** | 背景 | `bgSecondary` (#F5F5F7) | `#FFFFFF` | **浅色，形成交替节奏** |
| **Section Label** | 文字 | `textSecondary` (#6E6E73) | `#FFFFFF99` | 70%白 |
| **Divider** | 颜色 | `divider` (#E5E5EA) | `#333333` | **暗灰，非亮灰** |
| **Card（偶）** | 背景 | `bgCard` (#FFF) | `#171717` | 深色 |
| **Card（奇）** | 背景 | `bgSecondary` (#F5F5F7) | `#171717CC` | 半透明深色 |
| **Card Name** | 文字 | `textPrimary` (#1D1D1F) | `#FFFFFF` | 纯白 |
| **Card Desc** | 文字 | `textSecondary` (#6E6E73) | `#FFFFFF99` | 70%白 |
| **Card Badge** | 背景 | `bgSecondary` (#F5F5F7) | `#171717E6` | 深色有层次 |
| **Card Badge** | 文字 | `item.color` | `item.color` | **保持原有标签色，不变** |
| **Footer Line1** | 文字 | `textPrimary` (#1D1D1F) | `#FFFFFF` | 纯白 |
| **Footer Line2** | 文字 | `textTertiary` (#86868B) | `#FFFFFF66` | 40%白 |

### 3.2 关键设计决策

**① Stat Number 不受 `stat.color` 控制**  
问题根源：`config.stats` 里硬编码了 `color: '#f0ad4e'`（GitHub orange），在深色背景上无法保证可读性。  
决策：深色模式下 Stat Number 固定 `#FFFFFF`，忽略 `stat.color`。浅色模式保持原行为。

**② Section 奇偶交替节奏**  
问题：深色主题下全深色 Section 太压抑。  
决策：偶数 Section 深色 `#171717`，奇数 Section 浅色 `#FFFFFF`，节奏 = 深/浅/深/浅。

**③ Card Badge 背景**  
问题：`item.color` 是为浅色背景设计的（`color + '20'` = 20% opacity），在深色背景上太暗。  
决策：深色模式下 Badge 背景用 `bgSecondary`（接近卡片背景），文字用 `item.color`（保持品牌色）。

---

## 四、从当前 generator.js 到新架构的迁移路径

### 迁移原则

> **渐进式，不破坏现有功能**  
> 每一步完成后，浅色主题海报**输出必须完全一致**（行对行 diff 可通过）

### 改动 1：引入 `resolveTokens()` 函数（低风险）

**改动量**：~30 行  
**风险**：极低，纯新增函数，不影响现有逻辑

在 `generator.js` 底部 module.exports 之前插入：

```javascript
// ============================================================
// 语义 Token 解析器（新增）
// ============================================================

function resolveTokens(theme, overrides = {}, darkMode = false) {
  const base = { ...theme, ...overrides };
  const isDark = darkMode || base.isDark;

  const light = (hex, alpha) => {
    // 将 hex 颜色加上 hex alpha 后缀
    if (!hex || !hex.startsWith('#')) return hex;
    return hex + alpha;
  };

  if (isDark) {
    const darkBg  = base.bgPrimary  || '#000000';
    const lightBg = base.bgCard     || '#FFFFFF';
    return {
      '--hero-bg':              darkBg,
      '--hero-badge-bg':         light(darkBg, '99'),
      '--hero-badge-color':      light(lightBg, 'CC'),
      '--hero-title-color':     '#FFFFFF',
      '--hero-subtitle-color':  '#FFFFFF99',
      '--stat-card-bg':          light(darkBg, 'E6'),
      '--stat-num-color':       '#FFFFFF',
      '--stat-label-color':     '#FFFFFF99',
      '--section-bg-odd':       darkBg,
      '--section-bg-even':      lightBg,
      '--section-label-color':  '#FFFFFF99',
      '--divider-color':        '#333333',
      '--card-bg-a':            darkBg,
      '--card-bg-b':            light(darkBg, 'CC'),
      '--card-name-color':      '#FFFFFF',
      '--card-desc-color':      '#FFFFFF99',
      '--card-badge-bg':        light(darkBg, 'E6'),
      '--footer-line1-color':   '#FFFFFF',
      '--footer-line2-color':   '#FFFFFF66',
    };
  }

  // 浅色模式
  return {
    '--hero-bg':              base.bgPrimary,
    '--hero-badge-bg':         base.bgSecondary,
    '--hero-badge-color':      base.textSecondary,
    '--hero-title-color':     base.textPrimary,
    '--hero-subtitle-color':  base.textSecondary,
    '--stat-card-bg':          base.bgSecondary,
    '--stat-num-color':        base.textPrimary,
    '--stat-label-color':      base.textSecondary,
    '--section-bg-odd':        base.bgPrimary,
    '--section-bg-even':       base.bgSecondary,
    '--section-label-color':   base.textSecondary,
    '--divider-color':         base.divider,
    '--card-bg-a':             base.bgCard || base.bgPrimary,
    '--card-bg-b':             base.bgSecondary,
    '--card-name-color':       base.textPrimary,
    '--card-desc-color':       base.textSecondary,
    '--card-badge-bg':         base.bgSecondary,
    '--footer-line1-color':    base.textPrimary,
    '--footer-line2-color':    base.textTertiary,
  };
}

function buildCSSVars(tokens) {
  return Object.entries(tokens)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}
```

**验证方法**：生成的浅色海报与原版逐像素对比，无差异。

---

### 改动 2：`buildCard()` 消除硬编码（低风险）

**改动量**：~5 行  
**风险**：低，但需回归测试确认卡片外观不变

在 `buildCard()` 函数中：

```javascript
// 改动前
const cardBg = isEven ? '#fff' : '#FAFAFA';

// 改动后（通过传入 tokens 或用 theme 变量）
// 浅色模式 fallback
const cardBgA = t.cardBgA || t.bgCard || t.bgPrimary || '#fff';
const cardBgB = t.cardBgB || t.bgSecondary || '#FAFAFA';
const cardBg = isEven ? cardBgA : cardBgB;
```

同时在 `generatePoster()` 开头把 `resolveTokens()` 的结果注入 `t`：

```javascript
const semanticTokens = resolveTokens(t, config.overrides, config.darkMode);
t = { ...t, ...semanticTokens };
```

---

### 改动 3：`buildWorkflow()` 消除硬编码（极低风险）

**改动量**：~3 行  
**风险**：极低，workflow 使用频率低

```javascript
// 改动前
background:' + (t._cardBgAlt || t.bgSecondary) + '

// 改动后（直接用 tokens，已经注入到 t）
background:var(--card-bg-b)
```

---

### 改动 4：`generatePoster()` CSS 块注入 Semantic Tokens（中等风险）

**改动量**：~20 行  
**风险**：中等，涉及 CSS 变量注入位置，需逐 CSS 规则验证

在现有 CSS `<style>` 块**最开头**（@import 之后）注入：

```javascript
// 在 * { margin: 0; ... } 之前
':root { ' + buildCSSVars(semanticTokens) + ' }' +
```

这样所有 `var(--xxx)` 引用都能正确解析。

然后把关键 CSS 规则从硬编码值改为 `var()` 引用：

| CSS 规则 | 改动前 | 改动后 |
|---------|--------|--------|
| `.hero` | `background: ' + t.bgPrimary` | `background: var(--hero-bg)` |
| `.hero-badge` | `background: ' + t.bgSecondary` | `background: var(--hero-badge-bg)` |
| `.hero-badge` | `color: ' + t.textSecondary` | `color: var(--hero-badge-color)` |
| `.hero-title` | `color: ' + t.textPrimary` | `color: var(--hero-title-color)` |
| `.hero-subtitle` | `color: ' + t.textSecondary` | `color: var(--hero-subtitle-color)` |
| `.stat-card` | `background: ' + t.bgSecondary` | `background: var(--stat-card-bg)` |
| `.stat-num` | `color: ' + t.textPrimary` | `color: var(--stat-num-color)` |
| `.stat-label` | `color: ' + t.textSecondary` | `color: var(--stat-label-color)` |
| `.section-rule` | `background: ' + t.divider` | `background: var(--divider-color)` |
| `.section-label` | `color: ' + t.textSecondary` | `color: var(--section-label-color)` |
| `.card` | `background: var(--card-bg)` | **已通过内联 style** |
| `.card-name` | `color: ' + t.textPrimary` | `color: var(--card-name-color)` |
| `.card-desc` | `color: ' + t.textSecondary` | `color: var(--card-desc-color)` |
| `.card-badge` | `background: ' + t.bgSecondary` | `background: var(--card-badge-bg)` |
| `.footer-line1` | `color: ' + t.textPrimary` | `color: var(--footer-line1-color)` |
| `.footer-line2` | `color: ' + t.textTertiary` | `color: var(--footer-line2-color)` |

---

### 改动 5：`generateFromNaturalLanguage()` 和 `generateFromConfig()` 深色支持统一入口（中风险）

**改动量**：~20 行  
**风险**：中等，需验证深色主题不再出现白色"贴纸"

把深色覆盖逻辑从各个入口函数里**全部删除**，改为统一在 `generatePoster()` 内处理：

```javascript
// generatePoster() 开头
const isDark = !!(config.darkMode || config._designSpec?.isDark);
const resolvedTokens = resolveTokens(theme, config.overrides || config._designSpec, isDark);
```

删除 `generateFromNaturalLanguage()` 和 `generateFromConfig()` 里的重复深色覆盖块。

---

### 迁移风险汇总

| 改动 | 风险 | 原因 | 缓解 |
|------|------|------|------|
| 改动1（新增resolveTokens） | 🟢 极低 | 纯新增 | 浅色模式功能不变 |
| 改动2（buildCard） | 🟢 低 | 改动5行 | 浅色模式需回归验证 |
| 改动3（buildWorkflow） | 🟢 极低 | 极少使用 | — |
| 改动4（CSS var注入） | 🟡 中 | 涉及30+ CSS规则 | 分批验证，每批注释其他 |
| 改动5（统一深色入口） | 🟡 中 | 删除多处重复逻辑 | 先加新再删旧，保证始终可运行 |

**总变更量**：约 **180 行**（含注释和空行），纯代码约 **100 行**

---

## 五、DESIGN.md 如何融入架构

### 5.1 DESIGN.md 的角色定位

DESIGN.md 是一份**设计规范文档**，在新架构中的定位是 **Primitive Token Override 来源**。

```
DESIGN.md (设计师提供)
    ↓ 解析为 overrides 对象
config.overrides = { accent: '#FF5E5E', bgPrimary: '#1A1A2E', ... }
    ↓
resolveTokens(theme, overrides, darkMode)
    ↓
Semantic Tokens（最终渲染变量）
    ↓
组件渲染（renderHero / renderCard 等）
    ↓
最终 HTML
```

### 5.2 DESIGN.md 解析函数

```typescript
// parseDesignSpec(doc: string) → Partial<PrimitiveTheme>

function parseDesignSpec(doc) {
  // DESIGN.md 支持的字段（映射到 Primitive Theme）
  const mapping = {
    'primaryColor|accentColor': 'accent',
    'primaryColor': 'bgPrimary',
    'bgColor|background': 'bgPrimary',
    'textColor|textPrimary': 'textPrimary',
    'textSecondaryColor': 'textSecondary',
    'dividerColor|borderColor': 'divider',
    'cardBg|bgCard': 'bgCard',
    'fontFamily': 'fontFamily',
    'cardRadius|borderRadius': 'cardRadius',
  };

  const result = {};
  // 从 DESIGN.md 文本中用正则提取 hex 值和键名
  for (const [pattern, token] of Object.entries(mapping)) {
    const regex = new RegExp(`${pattern}[：:\\s]+([\\w#]+)`, 'i');
    const match = doc.match(regex);
    if (match) result[token] = match[1];
  }

  // isDark 标记
  if (/dark|dark mode|深色|暗色/i.test(doc)) {
    result.isDark = true;
  }

  return result;
}
```

### 5.3 注入流程（端到端）

```
用户传入 DESIGN.md 文本
  ↓
parseDesignSpec(doc) → overrides 对象
  ↓
config.overrides = overrides
config.darkMode = overrides.isDark
  ↓
generatePoster(config, theme)
  ↓
resolveTokens(theme, config.overrides, config.darkMode)
  ↓
语义 Tokens（DESIGN.md 值覆盖了 theme 原始值）
  ↓
CSS: `:root { --hero-bg: #1A1A2E; ... }`
  ↓
组件渲染（全部引用 var(--xxx)）
```

### 5.4 DESIGN.md 示例格式

```markdown
# My Poster Design

## 色彩
- 主色（primaryColor）: #6366F1
- 背景色（bgColor）: #0F172A
- 文字色（textColor）: #F8FAFC
- 次要文字: #94A3B8
- 分隔线: #334155

## 模式
- 深色主题: true

## 字体
- 字体族: Inter
```

---

## 六、推荐实施顺序

```
Phase 0（准备）: 理解现有代码基线，确保浅色主题回归测试可运行
    ↓
Phase 1: 新增 resolveTokens() + buildCSSVars()
         风险：极低，纯新增
         产出：Semantic Tokens 可独立验证
    ↓
Phase 2: 引入 tokens 到 generatePoster()（:root CSS var 注入）
         风险：低，先注入不替换，只验证
         产出：所有 var() 引用有值
    ↓
Phase 3: 替换 CSS 规则（逐类替换，注释法）
         Hero → Stats → Section → Card → Footer
         风险：中等，分类替换便于 bisect
         产出：所有组件颜色来自 var()
    ↓
Phase 4: 修复 buildCard() 和 buildWorkflow() 硬编码
         风险：低，用 tokens 替换
    ↓
Phase 5: 删除各入口函数的重复深色覆盖逻辑
         风险：中等，先在 generatePoster() 确认统一入口正确后再删
    ↓
Phase 6: 深色主题端到端验证
         对比：深色海报 vs 浅色海报，确认所有组件协调
    ↓
Phase 7: DESIGN.md 解析函数 + 集成
```

### 预估工作量

| Phase | 描述 | 预估行变更 | 风险 |
|-------|------|-----------|------|
| Phase 1 | resolveTokens + buildCSSVars | ~30 行 | 🟢 |
| Phase 2 | CSS :root var 注入 | ~5 行 | 🟢 |
| Phase 3 | 逐类替换 CSS 规则 | ~40 行 | 🟡 |
| Phase 4 | buildCard + buildWorkflow | ~5 行 | 🟢 |
| Phase 5 | 删除重复深色逻辑 | ~15 行 | 🟡 |
| Phase 6 | 深色主题验证 | — | — |
| Phase 7 | DESIGN.md 解析集成 | ~25 行 | 🟢 |
| **总计** | | **~120 行** | |

> 远低于 800 行要求。实际有效代码约 **80 行**。

---

## 七、关键文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `generator.js` | 重构 | 核心变更，所有新架构实现 |
| `generate-poster.js` | 无改动 | CLI 入口，不碰 |
| `server.js` | 无改动 | HTTP 服务，不碰 |
| `screenshot.js` | 无改动 | 截图工具，不碰 |

**只改 `generator.js` 一个文件**，其他文件零改动。

---

## 八、向后兼容性承诺

---

## English Summary

This v2 architecture draft proposes refactoring the poster rendering engine from string-heavy template assembly into a componentized semantic-token system.

### Key Diagnosis
- Existing code mixed hardcoded colors and ad-hoc overrides.
- Dark theme rendering was inconsistent across Hero, cards, dividers, and stats.
- Theme overrides were scattered in multiple entry points.

### Core Direction
- Introduce a 3-layer architecture:
  1. Primitive theme tokens
  2. Semantic tokens (`--hero-bg`, `--stat-num-color`, etc.)
  3. Components (Hero/Stats/Sections/Cards/Footer) that only consume semantic tokens

### Main Proposed Changes
- Add `resolveTokens()` and `buildCSSVars()`.
- Remove hardcoded card/workflow backgrounds.
- Inject CSS variables in `generatePoster()` at a single source of truth.
- Unify dark-mode handling at rendering entry.

### DESIGN.md Integration
- Parse design specs into color/mode/font signals.
- Apply deterministic fallback sequence for missing specs.
- Keep backward compatibility with current generation routes.

### Migration and Compatibility
- Refactor in small, verifiable steps.
- Preserve output equivalence for light themes during migration.
- Keep existing API behavior while upgrading internal rendering architecture.

1. **所有现有主题（4个）行为不变** — 浅色海报输出与重构前完全一致
2. **`generateFromNaturalLanguage()` 返回结构不变** — 字段名、顺序完全兼容
3. **`generateFromConfig()` 返回结构不变** — 同上
4. **`generatePoster()` 签名不变** — 参数 `{ config, items, theme }` 不变
5. **THEMES 对象 key 不变** — 不重命名（ARCHITECTURE-FIX.md 建议的 bgWhite/bgGray 重命名**撤销**，改用 Token 层隔离）
