# ARCHITECTURE-FIX.md — 深色主题颜色一致性修复方案

中文 | [English Summary](#english-summary)

> 状态：草案 | 制定者：Architect-MAX | 日期：2026-04-07

---

## 一、问题根因分析

### 问题1：深色主题下组件颜色不协调

**根因：语义变量名与其实际用途错位**

`generator.js` 中的 CSS 变量系统使用 `bgWhite`/`bgGray` 作为**语义层**变量，但注释和命名暗示它们代表"白色/灰色"——这个命名在深色主题下完全误导。

深色主题时，`generatePoster()` 中的覆盖逻辑：
```js
overrides.bgWhite = darkBg;   // → #171717
overrides.bgGray = lightBg;   // → #FFFFFF  ← 问题！
```
然后所有组件引用这些变量：
- `.hero` → `bgWhite = #171717` ✅
- `.stat-card` → `bgGray = #FFFFFF` ❌（白色卡片贴在深色背景上）

`buildCard()` 中还有**硬编码**：
```js
background:' + (isEven ? '#fff' : '#FAFAFA') + '
```
完全不经过 theme 变量系统。

### 问题2：CSS 变量映射逻辑混乱

有两套并行的深色覆盖代码：

1. `generatePoster()` 函数内（用于生成 poster HTML）
2. `generateFromNaturalLanguage()` 函数末尾（用于 API 入口）

两者逻辑**不完全一致**，且各自维护一套 `isDark` 判断。`generateFromConfig()` **完全没有**深色主题处理。

### 问题3：整体架构错误

现在的做法是"改 THEMES 里几个变量的值"，但 poster HTML 模板里有**至少 3 处硬编码颜色**：
1. `buildCard()` — `#fff` / `#FAFAFA`
2. `buildWorkflow()` — `background:#FAFAFA`
3. `.hero-bottom-bar` — 引用 `bgGray`（在深色 Hero 后变成白色条）

正确的架构应该是：**深色主题时，把所有组件的 hardcoded fallback 值都推倒**，而不是只修 THEMES 对象的几个变量。

---

## 二、推荐方案

### 方案 A：「语义变量重构」⭐ 推荐

**核心思路**：将 `bgWhite`/`bgGray` 重命名为 `bgPrimary`/`bgSecondary`，彻底消除命名误导；所有硬编码颜色改用 CSS 变量；深色主题通过统一入口一次性覆盖所有组件变量。

**优点**：
- 架构清晰，变量名 = 实际用途
- 深色主题覆盖路径唯一
- 硬编码全消除

**缺点**：
- 需改动 `generator.js` 中约 40 行
- THEMES 对象中所有 `bgWhite`/`bgGray` 键需重命名（批量 sed 可完成）

**修改量**：~50 行

---

### 方案 B：「深色覆盖函数」最小改动

**核心思路**：不动 THEMES 变量名，不改 `buildCard()`，只在 `generatePoster()` 的深色覆盖块中补充对 `stat-card` 背景和 `card` 硬编码的处理。

**优点**：
- 最小改动（~20 行）
- 兼容现有 THEMES 结构

**缺点**：
- `bgWhite`/`bgGray` 命名误导问题依然存在
- 硬编码问题用更多硬编码解决（治标不治本）
- `buildCard()` 中的 `#fff`/`#FAFAFA` 依然不经过 theme

**修改量**：~20 行

---

### 方案 C：「CSS 变量层抽象」

**核心思路**：在 `generatePoster()` 开头统一生成一对 `--card-bg` / `--card-bg-alt` CSS 变量，让所有硬编码的 `#fff` / `#FAFAFA` 替换为 `var(--card-bg)` 等。

**优点**：
- 完全不碰 THEMES
- 硬编码颜色统一收口

**缺点**：
- 引入 CSS 变量需要额外生成 `<style>` 块
- `buildCard()` 函数签名需改变

**修改量**：~30 行

---

**最终推荐：方案 A**。理由： PosterHub 是瑶的设计系统资产，长期维护；方案 A 虽然改动量稍大，但架构正确，长期成本最低。

---

## 三、具体代码改动（方案 A）

### 改动 1：THEMES 对象 — 重命名变量

**文件**：`generator.js`  
**行数**：约 40-80 行

将所有 theme 中的 `bgWhite` → `bgPrimary`，`bgGray` → `bgSecondary`：

```js
// warm-earth
- bgWhite: '#FAF8F5', bgGray: '#F0EDE8'
+ bgPrimary: '#FAF8F5', bgSecondary: '#F0EDE8'

// tech-blue
- bgWhite: '#F5F8FF', bgGray: '#EDF2F7'
+ bgPrimary: '#F5F8FF', bgSecondary: '#EDF2F7'

// creative
- bgWhite: '#FAF5FF', bgGray: '#F3E8FF'
+ bgPrimary: '#FAF5FF', bgSecondary: '#F3E8FF'

// apple-minimal
- bgWhite: '#FFFFFF', bgGray: '#F5F5F7'
+ bgPrimary: '#FFFFFF', bgSecondary: '#F5F5F7'
```

### 改动 2：深色主题覆盖逻辑 — 统一并正确

**文件**：`generator.js`，`generatePoster()` 函数内，约第 280 行

将深色主题覆盖改为：

```js
// 深色主题：整体推倒重建
if (ds.isDark) {
  const darkBg = ds.bgColor || ds.primaryColor || '#000000';
  const lightBg = ds.bgColorAlt || '#FFFFFF';

  // Hero 区域：深色
  overrides.bgPrimary = darkBg;
  // Stat Card：深色（用 bgSecondary，这样在深色 Hero 下协调）
  overrides.bgSecondary = darkBg + 'CC';  // 半透明深色
  // Section 交替：深/浅
  overrides.sectionBg1 = darkBg;
  overrides.sectionBg2 = lightBg;
  // 文字：白色系
  overrides.textPrimary = '#FFFFFF';
  overrides.textSecondary = '#FFFFFF99';
  overrides.textTertiary = '#FFFFFF66';
  overrides.accent = ds.accentColor || '#007AFF';
  overrides.divider = '#333333';
  // 卡片背景（关键！）
  overrides.cardBg = darkBg;
  overrides.cardBgAlt = darkBg + 'CC';
}
```

### 改动 3：`generatePoster()` CSS 变量注入 — 消除硬编码

**文件**：`generator.js`，`generatePoster()` CSS 生成部分，约第 310 行

在 `<style>` 开头注入 CSS 变量：

```js
// 在 @import 之后、* { margin: 0; ... } 之前插入：
'html { --card-bg: ' + t.cardBg + '; --card-bg-alt: ' + (t.cardBgAlt || t.bgSecondary) + '; }' +
```

### 改动 4：`buildCard()` — 消除硬编码颜色

**文件**：`generator.js`，`buildCard()` 函数，约第 480 行

```js
// 改动前
return '<div class="card" style="background:' + (isEven ? '#fff' : '#FAFAFA') + '">'

// 改动后
return '<div class="card" style="background:' + (isEven ? 'var(--card-bg)' : 'var(--card-bg-alt)') + '">'
```

### 改动 5：`buildWorkflow()` — 消除硬编码颜色

**文件**：`generator.js`，`buildWorkflow()` 函数，约第 230 行

```js
// 改动前
'<div class="workflow" style="...background:#FAFAFA...">'

// 改动后
'<div class="workflow" style="...background:var(--card-bg-alt)...">'
```

### 改动 6：`generatePoster()` CSS 规则 — 更新变量引用

**文件**：`generator.js`，CSS 字符串拼接

| 位置 | 改动前 | 改动后 |
|------|--------|--------|
| `.hero` | `background: ' + t.bgWhite + '` | `background: ' + t.bgPrimary + '` |
| `body` | `background: ' + t.bgWhite` | `background: ' + t.bgPrimary` |
| `.poster` | `background: ' + t.bgWhite` | `background: ' + t.bgPrimary` |
| `.stat-card` | `background: ' + t.bgGray` | `background: ' + t.bgSecondary` |
| `.hero-bottom-bar` | `background: ' + t.bgGray` | `background: ' + t.bgSecondary` |
| `.card-badge` | `background: ' + t.bgGray` | `background: ' + t.bgSecondary` |
| `.card` | `background: ' + t.bgCard` | `background: var(--card-bg)` |

Section 背景交替逻辑（`generatePoster()` 内 `sectionsHTML` 生成）：

```js
// 改动前
const bg = sectionBgIndex % 2 === 0 ? t.bgWhite : t.bgGray;

// 改动后（用新增的 sectionBg1/sectionBg2）
const bg = sectionBgIndex % 2 === 0 ? t.sectionBg1 : t.sectionBg2;
```

### 改动 7：`generateFromNaturalLanguage()` — 移除重复的深色覆盖

**文件**：`generator.js`，`generateFromNaturalLanguage()` 末尾

删除 `mergedTheme` 构建块中重复的 `isDark` 处理（因为 `generatePoster()` 已经统一处理）。保留基础的非深色覆盖。

### 改动 8：`generateFromConfig()` — 补充深色主题支持

**文件**：`generator.js`，`generateFromConfig()` 函数

在调用 `generatePoster()` 之前，检测 `config._designSpec?.isDark` 并应用相同的深色覆盖逻辑：

```js
function generateFromConfig(config) {
  let theme = THEMES[config.theme] || THEMES['apple-minimal'];
  // 补充：深色主题支持
  const ds = config._designSpec;
  if (ds?.isDark) {
    const darkBg = ds.bgColor || ds.primaryColor || '#000000';
    const lightBg = ds.bgColorAlt || '#FFFFFF';
    theme = {
      ...theme,
      bgPrimary: darkBg,
      bgSecondary: darkBg + 'CC',
      sectionBg1: darkBg,
      sectionBg2: lightBg,
      textPrimary: '#FFFFFF',
      textSecondary: '#FFFFFF99',
      textTertiary: '#FFFFFF66',
      accent: ds.accentColor || '#007AFF',
      divider: '#333333',
      cardBg: darkBg,
      cardBgAlt: darkBg + 'CC',
    };
  }
  ...
}
```

---

## 四、验证步骤

### 步骤 1：本地生成测试海报

```bash
cd ~/Desktop/openclaw/projects/poster-hub
node -e "
const { generateFromConfig } = require('./generator');
const html = generateFromConfig({
  theme: 'apple-minimal',
  hero: { badge: 'Test', title: 'Deep Dark Poster', subtitle: 'Testing dark theme' },
  sections: [
    { label: 'Section A', items: [
      { emoji: '🔥', label: 'Item 1', desc: 'Description 1', badge: 'Tag', color: '#FF5E5E' },
      { emoji: '⚡', label: 'Item 2', desc: 'Description 2', badge: 'Tag', color: '#4A90E2' },
    ]}
  ],
  _designSpec: {
    isDark: true,
    bgColor: '#171717',
    bgColorAlt: '#1D1D1F',
    accentColor: '#4A90E2',
    textColorAlt: '#FFFFFF',
  }
}).html;
require('fs').writeFileSync('dark-test.html', html);
console.log('Done');
"
```

### 步骤 2：检查关键 CSS 变量

打开 `dark-test.html`，验证：

1. `.hero` 背景是 `#171717`（深色）
2. `.stat-card` 背景是 `#171717CC`（半透明深色，非白色）
3. `.card` 背景是 `#171717` 或其半透明版本
4. `.section` 背景交替：第一个 `#171717`，第二个 `#FFFFFF`
5. `.hero-title` 文字是白色 `#FFFFFF`

### 步骤 3：截图对比

生成浅色版本（不传 `isDark`）和深色版本并排截图，肉眼检查：
- 深色 Hero 和 Stat Card 是否融合（无白色"贴纸"效果）
- Section 交替是否节奏正确
- 卡片是否在深色 Section 中可见

### 步骤 4：回归测试

确保浅色主题（不传 `isDark`）海报**完全不变**：

```bash
node -e "
const { generateFromConfig } = require('./generator');
const html = generateFromConfig({
  theme: 'apple-minimal',
  hero: { badge: 'Test', title: 'Light Poster', subtitle: 'Testing light theme' },
  sections: [{ label: 'Section', items: [{ emoji: '🎉', label: 'Item', desc: 'Desc', badge: 'Tag', color: '#4A90E2' }] }]
}).html;
require('fs').writeFileSync('light-test.html', html);
"
```

对比新旧生成的浅色海报，应**完全相同**。

---

## 五、变更摘要

| 改动点 | 文件 | 行数 | 性质 |
|--------|------|------|------|
| THEMES 变量重命名 | generator.js | ~40 | 重构 |
| CSS 变量注入 | generator.js | ~5 | 新增 |
| 深色主题覆盖统一 | generator.js | ~15 | 重构 |
| buildCard 硬编码消除 | generator.js | ~1 | 修复 |
| buildWorkflow 硬编码消除 | generator.js | ~1 | 修复 |
| generateFromConfig 深色支持 | generator.js | ~15 | 新增 |
| generateFromNaturalLanguage 清理 | generator.js | ~5 | 清理 |
| **总计** | | **~82 行** | |

> 注：82 行包含注释和空行调整，实际有效代码 ~50 行。

---

## English Summary

This document proposes a dark-theme consistency fix plan and compares three options.

### Root Cause
- Semantic naming drift (`bgWhite` / `bgGray`) caused confusion in dark mode.
- Parallel dark-mode override blocks existed in multiple functions.
- A few hardcoded colors bypassed theme variables.

### Recommended Option
- **Option A: Semantic variable refactor** (recommended)
  - Rename to `bgPrimary` / `bgSecondary`
  - Remove hardcoded background values
  - Keep one dark-theme override entry point

### Planned Implementation
- Rename theme keys in `generator.js`
- Unify dark overrides in `generatePoster()`
- Replace hardcoded values in `buildCard()` / `buildWorkflow()`
- Ensure `generateFromConfig()` supports dark-spec overrides consistently

### Validation
- Generate dark and light test posters
- Verify component-level color behavior
- Confirm no regressions in light-theme output

### Outcome
- A low-risk, architecture-correct path that improves maintainability and visual consistency.
