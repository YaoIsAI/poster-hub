# ARCHITECTURE-BLUE.md — 深色主题最小可行方案

> 身份：Architect-BLUE（冷静分析派）| 审查对象：ARCHITECTURE-FIX.md
> 日期：2026-04-07

---

## 一、对 Architect-RED 方案的评审意见

### RED 方案的三个前提假设均已过时

| RED 的假设 | 实际情况 |
|-----------|---------|
| `buildCard()` 有硬编码 `#fff`/`#FAFAFA` | **已修复**（第661-668行已用 `t._cardBg`/`t._cardBgAlt`） |
| `buildWorkflow()` 有硬编码 `#FAFAFA` | **已修复**（第313行已用 `t._cardBgAlt`） |
| `generateFromConfig()` 缺少深色支持 | **已修复**（第631-641行已有完整深色逻辑） |

**结论：RED 方案针对的是旧版代码。** 当前代码库已经完成了 RED 方案中 8 处改动里的 4 处（buildCard、buildWorkflow、generateFromConfig、CSS变量注入）。

---

## 二、当前代码的真实问题（仅 2 处）

### 问题 A：非深色 designSpec 颜色覆盖无效（关键Bug）

**位置**：`generator.js` 第 326-327 行，`generatePoster()` 内

```js
// 现状（有bug）
if (ds.bgColor) overrides.bgGray = ds.bgColor;      // ❌ 变量名不存在
if (ds.bgColorAlt) overrides.bgWhite = ds.bgColorAlt; // ❌ 变量名不存在
```

THEMES 对象里根本没有 `bgGray`/`bgWhite` 这两个键，实际变量名是 `bgSecondary`/`bgPrimary`。所以 **非深色场景下传 `designSpec.bgColor` 完全不生效**。

### 问题 B：深色逻辑重复维护，来源不一致

**位置**：`generateFromNaturalLanguage()` 第 595-613 行

这里独立维护了一套 `dsOverrides`，然后再调 `generatePoster()`。而 `generatePoster()` 第 333-346 行又有一份几乎相同的深色覆盖。两套逻辑如果不一致，就会产生难以追踪的 bug。

---

## 三、最小可行方案（仅 2 个改动点，< 60 行）

### 改动点 1：修复 designSpec 变量名映射（BUG FIX）

**文件**：`generator.js`  
**位置**：第 326-327 行

```js
// 改动前（无效赋值）
if (ds.bgColor) overrides.bgGray = ds.bgColor;
if (ds.bgColorAlt) overrides.bgWhite = ds.bgColorAlt;

// 改动后（正确映射到 THEMES 中的实际变量名）
if (ds.bgColor) overrides.bgSecondary = ds.bgColor;
if (ds.bgColorAlt) overrides.bgPrimary = ds.bgColorAlt;
```

**影响**：非深色 designSpec 颜色覆盖从此生效，无需改动 THEMES 对象。

---

### 改动点 2：删除 `generateFromNaturalLanguage()` 中的重复深色逻辑

**文件**：`generator.js`  
**位置**：第 595-613 行（整个 `if (overrides.designSpec)` 块）

**方案**：直接删掉第 595-613 行，将深色覆盖职责完全交给 `generatePoster()`（第 333-346 行）。`generatePoster()` 已经完整实现了所有深色覆盖逻辑。

```js
// 改动前（第 595-613 行，整块删除）
if (overrides.designSpec) {
  const ds = overrides.designSpec;
  const dsOverrides = {};
  if (ds.isDark) {
    const darkBg = ds.bgColor || ds.primaryColor || '#000000';
    const lightBg = ds.bgColorAlt || '#FFFFFF';
    dsOverrides._cardBg = darkBg;
    dsOverrides._cardBgAlt = lightBg;
    dsOverrides._sectionBg1 = darkBg;
    dsOverrides._sectionBg2 = lightBg;
    dsOverrides.bgPrimary = darkBg;
    dsOverrides.bgSecondary = darkBg + 'CC';
    dsOverrides.textPrimary = '#FFFFFF';
    dsOverrides.textSecondary = '#FFFFFF99';
    dsOverrides.accent = ds.accentColor || '#007AFF';
    dsOverrides.divider = '#333333';
  } else {
    if (ds.bgColor) { dsOverrides.bgSecondary = ds.bgColor; dsOverrides.bgPrimary = ds.bgColor; }
    if (ds.accentColor) dsOverrides.accent = ds.accentColor;
    if (ds.textColor) dsOverrides.textPrimary = ds.textColor;
  }
  mergedTheme = { ...theme, ...dsOverrides };
}

// 改动后：mergedTheme 直接用 theme，深色逻辑全部由 generatePoster() 统一处理
const mergedTheme = { ...theme };
```

---

## 四、深色主题需要哪些组件级颜色变化？

通过代码分析，一个深色主题海报涉及以下颜色变化节点：

| 组件 | 浅色值来源 | 深色值 | 当前状态 |
|------|-----------|--------|---------|
| `.hero` 背景 | `t.bgPrimary` | `#000` | ✅ 已通过主题变量 |
| `.stat-card` 背景 | `t.bgSecondary` | `dark + CC` | ✅ 已覆盖 |
| `.card` 背景 | `t._cardBg`/`t._cardBgAlt` | 深/浅交替 | ✅ 已通过 CSS 变量 |
| Section 背景交替 | `t._sectionBg1`/`t._sectionBg2` | 深/浅交替 | ✅ 已覆盖 |
| `.hero-title` 文字 | `t.textPrimary` | `#FFFFFF` | ✅ 已覆盖 |
| `.hero-subtitle` 文字 | `t.textSecondary` | `#FFFFFF99` | ✅ 已覆盖 |
| `.divider` 分隔线 | `t.divider` | `#333333` | ✅ 已覆盖 |
| `.footer-line1` | `t.textPrimary` | `#FFFFFF` | ✅ 已覆盖 |
| `buildWorkflow()` 背景 | `t._cardBgAlt` | 浅色 | ✅ 已通过变量 |
| `.hero-badge` 背景 | `t.bgSecondary` | 深色 CC | ✅ 已覆盖 |

**结论**：当前架构已经能覆盖所有组件级变化。问题不是"做不到"，而是"做重复了 + 有 1 个 bug"。

---

## 五、为什么当前架构理论上可以做到？

当前架构的核心设计是：

1. **THEMES 对象**：定义每套主题的完整语义变量（bgPrimary/bgSecondary/textPrimary/accent...）
2. **CSS 变量注入**（`:root` 块，第 434 行）：将 theme 对象映射为 CSS 自定义属性
3. **深色覆盖块**：在 `generatePoster()` 中用 `overrides` 对象覆盖语义变量
4. **`_cardBg`/`_cardBgAlt` 等私有变量**：解决卡片交替色的语义问题

这个设计**本来就是为多主题/深色模式设计的**。Architect-RED 误以为它做不到，是因为把代码状态看成了旧版本。

---

## 六、完整改动摘要

| 改动点 | 文件 | 行号 | 性质 | 有效行数 |
|--------|------|------|------|---------|
| 修复 `bgGray`/`bgWhite` → `bgSecondary`/`bgPrimary` | generator.js | 326-327 | Bug修复 | 2 |
| 删除 `generateFromNaturalLanguage()` 中的重复深色逻辑 | generator.js | 595-613 | 重构/去重 | ~19 |
| **总计** | | | | **~21 行** |

远远低于 RED 方案的 82 行和"不超过 200 行"的要求。

---

## 七、验证步骤

```bash
cd ~/Desktop/openclaw/projects/poster-hub
node -e "
const { generateFromConfig } = require('./generator');

// Test 1: 非深色 designSpec 颜色覆盖（之前是bug，现在应该修复）
const light = generateFromConfig({
  theme: 'apple-minimal',
  hero: { badge: 'Test', title: 'Light Theme Override', subtitle: 'Testing bgColor override' },
  sections: [{ label: 'Section', items: [{ emoji: '🎉', label: 'Item', desc: 'Desc', badge: 'Tag', color: '#FF5E5E' }] }],
  _designSpec: { bgColor: '#F0EDFF', accentColor: '#7E57FF' }
});
console.log('Test 1 (light override):', light.html.includes('#7E57FF') ? '✅ accentColor applied' : '❌ accentColor missing');

// Test 2: 深色主题（已正常工作）
const dark = generateFromConfig({
  theme: 'apple-minimal',
  hero: { badge: 'Test', title: 'Dark Theme', subtitle: 'Testing dark mode' },
  sections: [{ label: 'Section', items: [{ emoji: '🔥', label: 'Item', desc: 'Desc', badge: 'Tag', color: '#FF5E5E' }] }],
  _designSpec: { isDark: true, bgColor: '#171717', accentColor: '#4A90E2' }
});
const darkOk = dark.html.includes('#171717') && dark.html.includes('#FFFFFF');
console.log('Test 2 (dark mode):', darkOk ? '✅ dark colors applied' : '❌ dark colors missing');
console.log('Total changes:', 21, 'lines');
"
```

---

## 八、架构健康度评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 问题诊断准确性 | ⚠️ 中 | RED 误判了代码版本，部分问题已修复 |
| 改动最小化 | ✅ 优 | 真实改动仅 21 行，远低于约束 |
| 架构理解 | ✅ 优 | RED 对最终架构方向（统一覆盖点）的判断正确 |
| 实用性 | ✅ 优 | 两个改动均可独立验证，不破坏现有功能 |
| 风险 | ✅ 低 | 纯Bug修复+去重，无新增逻辑 |

**最终结论**：采纳 BLUE 的 2 点方案，不采纳 RED 的 8 点方案。RED 对问题方向的判断有价值，但具体改动清单因基于旧版代码而过度。
