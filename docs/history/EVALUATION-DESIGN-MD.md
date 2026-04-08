# PosterHub × DESIGN.md 集成方案评估

> 评估人：匿名 | 日期：2026-04-07

---

## 一、方案概述

**核心理念：** 不自己造主题，而是让 PosterHub 自动读取目标项目的 `DESIGN.md` 文件作为设计规范，实现"一份设计规格，生成精准风格海报"。

**数据来源：**
- 用户项目的 `DESIGN.md`（优先）
- VoltAgent/awesome-design-md 生态（58 套现成规范，备用）

**效果示例：**
```
用户输入 → https://github.com/owner/project（含 DESIGN.md）
       ↓
PosterHub 读取 DESIGN.md
       ↓
提取色彩/字体/组件规范
       ↓
生成精准风格海报
```

---

## 二、awesome-design-md 生态调研

| 指标 | 数据 |
|------|------|
| 已有 DESIGN.md 数量 | **58 套** |
| 覆盖网站 | Stripe、Linear、Vercel、Notion、Apple、BMW、Airbnb 等 |
| 文件格式 | Markdown，遵循 Google Stitch 标准 |
| 章节结构 | 9 个标准化章节（色彩/字体/组件/布局/深度等） |
| Stars | 24,013（持续增长） |

**每套 DESIGN.md 包含：**
1. Visual Theme & Atmosphere — 氛围描述
2. Color Palette & Roles — 色值 + 语义角色
3. Typography Rules — 字体家族 + 层级表
4. Component Stylings — 按钮/卡片/输入框含所有交互状态
5. Layout Principles — 间距体系 + 栅格规则
6. Depth & Elevation — 阴影层级
7. Do's and Don'ts — AI 约束规则
8. Responsive Behavior — 响应式断点
9. Agent Prompt Guide — 快速引用 + 可用 prompt

---

## 三、技术方案

### 3.1 架构设计

```
GitHub URL 输入
      ↓
fetchGitHub() — 获取仓库信息
      ↓
fetchDesignMd() — 新增：尝试读取 DESIGN.md
      ↓
parseDesignMd() — 新增：解析 Markdown，提取设计 token
      ↓
designSpec 对象 — { colors, typography, components, mood }
      ↓
generator.js — 用 designSpec 覆盖/补充主题配置
      ↓
生成海报
```

### 3.2 新增函数

| 函数 | 职责 | 代码量 |
|------|------|--------|
| `fetchDesignMd(owner, repo)` | 从 GitHub 读取 DESIGN.md 文件 | ~15 行 |
| `parseDesignMd(mdContent)` | 解析 Markdown，提取色彩/字体/规范 | ~80 行 |
| `findDesignMdTemplate(slug)` | 从 awesome-design-md 查找匹配模板（可选） | ~20 行 |

### 3.3 解析算法（parseDesignMd）

从 Markdown 中提取的关键 token：

```javascript
// 色彩提取（正则匹配 hex）
const colors = mdContent.match(/#[0-9a-fA-F]{3,8}/g) || [];

// 语义色映射（通过描述行判断用途）
const semantic = {
  primary: findColorByRole(md, 'primary|主色|brand'),
  secondary: findColorByRole(md, 'secondary|辅助'),
  background: findColorByRole(md, 'background|背景'),
  text: findColorByRole(md, 'text|文字|foreground'),
  accent: findColorByRole(md, 'accent|强调'),
};

// 字体提取
const fonts = mdContent.match(/font[^;\n]*?:\s*([^;\n]+)/gi) || [];

// 组件描述（通过章节标题识别）
const components = extractSection(md, 'Component Stylings');
```

### 3.4 降级策略（Fallback）

```
1. 读取项目根目录 DESIGN.md ✅
      ↓ 失败
2. 从 awesome-design-md 查找同名模板（如输入 Stripe → 找 stripe/）
      ↓ 失败
3. 使用 auto-detectTheme() 自动匹配现有 4 套主题
      ↓ 失败
4. 使用 apple-minimal 默认主题
```

### 3.5 可插拔微架构

```javascript
// 设计解析器可替换
const designMdParser = options.designMdParser || defaultParseDesignMd;

// 主题覆盖优先级（从高到低）
// 1. 用户手动指定 overrides.theme
// 2. parseDesignMd() 提取的规范
// 3. detectTheme() 自动匹配
// 4. apple-minimal 默认
```

---

## 四、工作量评估

| 阶段 | 内容 | 工时 |
|------|------|------|
| **Phase 1** | `fetchDesignMd()` + `parseDesignMd()` + 集成 | **1-2 人天** |
| Phase 2 | awesome-design-md 模板查找器 | 0.5 人天 |
| Phase 3 | 预览工具（可选） | 2-3 人天 |

**Phase 1 交付物：**
- 用户给 GitHub 地址 → 自动读取 DESIGN.md → 生成精准风格海报
- 无 DESIGN.md → 自动降级到现有逻辑（完全向后兼容）

---

## 五、风险评估

| 风险 | 等级 | 缓解方案 |
|------|------|----------|
| DESIGN.md 不存在时体验断层 | 中 | 完善降级策略 + 明确 UI 提示 |
| Markdown 格式变异导致解析失败 | 中 | 解析加 try-catch + 宽松匹配 |
| 解析不完整导致色值缺失 | 低 | 部分成功也使用，其他用主题默认值 |
| awesome-design-md 网络请求慢 | 低 | 本地缓存 + 超时 5s fallback |

---

## 六、与自建主题系统的对比

| 维度 | 自建主题系统 | DESIGN.md 集成 |
|------|-------------|---------------|
| 工作量 | 3-8 周 | **1-2 人天** |
| 主题数量 | 4-6 套 | **58+ 套且持续增长** |
| 维护成本 | 高（需持续更新） | **零维护** |
| 精准度 | 一般（泛主题） | **高（每套对应具体网站）** |
| 生态复用 | 无 | **VoltAgent 生态背书** |
| 架构复杂度 | 中（新增 THEMES 对象） | **低（纯解析函数）** |
| 扩展性 | 受限 | **无限（任何 DESIGN.md）** |

---

## 七、结论

**推荐：立刻做 DESIGN.md 集成方案**

| 推荐理由 |
|----------|
| ✅ 工作量是自建主题的 **1/10** |
| ✅ 借力 awesome-design-md 生态，**零维护** |
| ✅ 架构极简，**可插拔**，不影响现有逻辑 |
| ✅ 精准度远超自建主题（58 套 vs 4 套） |
| ✅ 完全向后兼容，**零风险** |

**下一步行动：**
等瑶确认后，用 1-2 人天实现 Phase 1。

---

## 八、附录：DESIGN.md 示例结构

VoltAgent/awesome-design-md 中每套 DESIGN.md 遵循 Stitch 标准格式：

```
# Stripe Design

## 1. Visual Theme & Atmosphere
Stripe's aesthetic is... (氛围描述)

## 2. Color Palette & Roles
| Role | Hex | Usage |
|------|-----|-------|
| Primary | #635BFF | Brand, CTAs |
| Background | #F6F9FC | Page backgrounds |

## 3. Typography Rules
- Headings: Inter, 600 weight
- Body: Inter, 400 weight

## 4. Component Stylings
### Buttons
Primary: #635BFF bg, white text, 4px radius...

## 5-9. Layout / Depth / Do's / Responsive / Agent Prompts
...
```

这种结构非常适合程序解析。
