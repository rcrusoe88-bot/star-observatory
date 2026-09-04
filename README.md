# 余小莫的星空观察台

> 一份把「开源 Skill · Agent 使用手记 · 自研 APP」装订成私人星表的个人内容站。
> 主站是一张深空星图，作品是星图上的星座；内容以 Markdown 维护，提交后由 GitHub Actions 持续构建并发布。

[![在线预览](https://img.shields.io/badge/在线预览-rcrusoe88--bot.github.io-9b59b6)](https://rcrusoe88-bot.github.io/star-observatory/)

## 在线预览

🌐 **https://rcrusoe88-bot.github.io/star-observatory/**

站点使用 GitHub Pages 部署：推送到 `main` 后，CI 会校验笔记、生成 `dist/` 静态产物，并将 `dist/` 发布到 Pages。

## 内容模型

- **开源 Skill 图鉴**：展示可复用的开源 Skill、能力标签与捕获地。
- **版本进化树**：记录项目从想法到可发布产品的演进。
- **Agent 使用手记**：用 Markdown 记录真实排障、判断和反直觉结论。
- **自研 APP**：持续补充个人软件与实验项目。

新增手记只需要在 `notes/_inbox/` 放入一个 Markdown 文件。文件被发布到 `notes/` 后，会自动进入首页和手记详情页。

## 手记格式

文件名建议使用日期加 slug，例如 `2026-09-05-new-observation.md`：

```markdown
---
title: 一次新的观察
date: 2026-09-05
tag: NOTE
env: Codex
sample: build
summary: 用一句话说明这篇手记解决了什么问题。
obs: 观察结论或可复用经验。
---

## 背景

正文支持标题、列表、引用、代码块、链接和图片。
```

必填 frontmatter：`title`、`date`。`date` 必须使用 `YYYY-MM-DD`，构建时会校验；图片和链接只允许 `http(s)` 或站内相对路径，避免把不安全 URL 注入页面。

模板文件 `notes/_inbox/模板-笔记格式示范.md` 会被发布脚本自动跳过。

## 本地开发

项目运行时零第三方依赖，但内容发布前需要运行一次 Node 构建：

```bash
# 生成 dist/index.html、dist/notes.html，并复制站点资源
node build.mjs

# 推荐：从构建产物启动本地静态服务器
python3 -m http.server 8000 --directory dist
# 浏览器访问 http://localhost:8000
```

也可以直接打开 `dist/index.html`，但使用静态服务器更接近 GitHub Pages 的运行环境。

## 发布手记

```bash
# 安全发布：移动 → 构建 → 精确暂存 → 提交 → 推送
node scripts/publish.mjs

# 本地检查提交，不推送到远端
node scripts/publish.mjs --no-push
```

发布脚本会：

1. 检查工作区是否干净，避免覆盖其他未提交工作；
2. 检查目标文件是否冲突；
3. 将 `notes/_inbox/*.md` 移入 `notes/`；
4. 构建并校验内容；
5. 只暂存本次发布涉及的源文件；
6. 提交后再推送。若提交前失败，会自动把笔记退回收件箱；若推送失败，则保留本地提交，等待稍后重试。

历史版本中的 `--dry-run` 仍可使用，但它是 `--no-push` 的兼容别名，并不会撤销本地提交。

## 技术与性能

- **零运行时依赖**：纯 HTML/CSS/JS，适合 GitHub Pages、EdgeOne 或任意静态托管。
- **可重复构建**：源文件是模板与 Markdown，部署文件统一生成到被忽略的 `dist/`，避免手工修改生成 HTML。
- **WebGL 星系**：原生 WebGL GLSL 背景，不依赖 React 或 OGL。
- **2D Canvas 三维星座**：深度坐标、透视投影和画家算法形成可点击章节导航。
- **性能边界**：Hero 离开视口后取消下一帧调度；页面支持 `prefers-reduced-motion`，Canvas 同时按设备像素比绘制。
- **可访问性**：罗盘保留移动端底部导航，Canvas 提供语义标签，键盘焦点有清晰可见状态。

## 文件结构

```text
.
├── .github/workflows/deploy-pages.yml  # 构建、校验并部署 dist/
├── assets/                             # 手记插图等静态资源
├── notes/                              # 已发布 Markdown 内容
│   └── _inbox/                         # 待发布内容收件箱
├── scripts/
│   ├── check.mjs                       # 构建结果自检
│   └── publish.mjs                     # 收件箱发布脚本
├── build.mjs                           # Markdown + 模板 → dist/
├── index.template.html                 # 首页模板
├── notes.template.html                 # 手记页模板
├── hero.png                            # README 首页预览图
└── README.md
```

`dist/` 是构建产物，不提交到 Git；线上部署只使用 CI 生成的 `dist/`。

---

*vibe coding for LOVE · 本星表持续生长*
