# NASEEM Bios — 个人作品集

街机 BIOS 风格的纯静态作品集。零构建、零依赖，双击 `index.html` 就能看。

参考气质：`holooooo.pages.dev`（开机自检 → PLAYER 1 READY → 卡带架 → 账本 → 终端）。
设计系统由 skill `ui-ux-pro-max` 生成，见 `design-system/serene-portfolio/MASTER.md`。

## 结构

```
index.html              所有文案/作品内容都在这（要改字就改这里）
styles.css              视觉层，色板在 :root
app.js                  开机动画 / 账本图表 / 卡带插画 / 终端 / 音效
assets/stats.js         ⚠ 自动生成，别手改
assets/stats.json       同上，供其它地方引用
assets/fonts/           Press Start 2P + VT323（自托管 woff2）
assets/favicon.svg
tools/export-stats.py   从 ~/.hermes/state.db 只读导出 token 账本
design-system/          ui-ux-pro-max 生成的 MASTER.md
```

本地跑 QA 时会生成 `preview/`（三档尺寸渲染截图）和临时页 `_qa.html`，这两类已在 `.gitignore` 里。

字体走自托管：Google Fonts 在本机不可达（curl 直接 000），在线引 CSS 会让整站掉回系统字体，
街机味全没了。`assets/fonts/*.woff2` 从 @fontsource 镜像取的 latin 子集，页面用
`<link rel="preload" as="font">` 预加载。

## 本地预览

```bash
cd ~/code/portfolio
python3 -m http.server 4321
# 打开 http://localhost:4321
```

直接双击 `index.html` 也能跑（`stats.js` 是 `<script>` 而不是 fetch）。

## 刷新 token 账本

```bash
python3 tools/export-stats.py
```

只读 `~/.hermes/state.db`，统计 `session_model_usage`（token 量、模型、渠道）和
`sessions`（每日活跃），输出到 `assets/stats.js`。想看新数字就重跑一次。

## 部署（Cloudflare Pages）

站点是纯静态目录，两种方式都行：

1. **拖拽**：Cloudflare Dashboard → Workers & Pages → Create → Pages → Upload assets，把
   `index.html styles.css app.js assets/` 拖进去。
2. **Git**：推到 GitHub 后在 Pages 里连仓库，build command 留空，输出目录 `/`。

## 待你拍板的占位

- 邮箱 `hello@example.com` — `index.html` 里搜 `hello@example.com` 换掉。
- 作品文案：现在按「starhusk / Hermes Fleet / Hindsight / HFT-Trend / Reading Pipeline / 本页」
  写的，要删要改直接动 `index.html` 里的 `<article class="card">`。
- 卡带缩略图目前是程序化像素风景（不是截图）。想换成真图：把图片放进 `assets/works/`，
  然后在对应 card 里替换 `<canvas class="card-canvas">` 为 `<img src="assets/works/xxx.webp" alt="…">`。
