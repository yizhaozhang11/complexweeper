# Complexweeper Web

基于复数扫雷玩法的非官方网页扩展实现。

[在线试玩](https://yizhaozhang11.github.io/complexweeper/) · [GitHub](https://github.com/yizhaozhang11/complexweeper)

基础玩法与复数雷、模长线索的创意来自[青月晓（Yueqing-Chen）的 Complexweeper](https://github.com/Yueqing-Chen/complexweeper-A-minesweeper-game)。本项目修改并扩展玩法，重新实现网页程序。

本项目作者为 [yizhaozhang11](https://github.com/yizhaozhang11)，代码由作者本人在 OpenAI Codex 辅助下编写。本版本加入 `1 / 1*` 公开线索、符号分组、条件展开和线索满足胜利等规则。

第一次玩请读 [入门教程与操作指南](GUIDE.md)：包括线索示例、桌面与触屏操作、字母分组、展开条件和常见误区。网页顶部“教程”可以打开适合手机阅读的版本；“玩法”保留简短速查。

试玩期间的操作变化记录在 [CHANGELOG.md](CHANGELOG.md)。生产站点加载到新的部署版本时，会自动弹出最近一条更新说明；关闭后，该浏览器不再重复提示同一次部署，也可以随时从顶部“更新”重看。

## 运行与检查

使用 Node.js 24（见 [.nvmrc](.nvmrc)）：

```sh
npm ci
npm run dev
npm test
npm run build
```

浏览器测试：安装 Playwright Chromium（`npx playwright install chromium`），然后 `npm run test:browser`。测试自动启动本地网页；已有本地预览时会复用。

构建后运行 `npm run test:pages`，检查生产页面在仓库子目录下的资源、源码入口和分享恢复。

教程内容统一维护在 `GUIDE.md`。开发和构建时自动生成 `public/guide.html`；单独更新教程预览可运行 `npm run build:guide`。Markdown 渲染工具只在构建时使用。

更新说明统一维护在 `CHANGELOG.md`，新的条目放在最前面，使用 `## 日期 · 标题`。开发和构建时自动生成 `public/changes.html`，也可单独运行 `npm run build:notes`。本地开发不会自动弹窗，可点击“更新”预览；自动弹窗使用生产构建验证。

生产输出为 `dist/`，资源采用相对路径，可部署到静态站点或子目录。GitHub Actions 构建时，网页“GitHub”入口自动打开本仓库，“关于”中的“GitHub（本版本）”指向部署对应的提交，均在新标签页打开。构建前也会生成含测试、规格、许可与锁文件的源码包；未配置仓库地址或提交时，相应入口显示源码下载。配置方式见 [部署说明](DEPLOYMENT.md#部署内容和源码)。

## 发布与部署

项目包含 GitHub Pages 工作流：各分支推送和 pull request 运行检查，默认分支通过全部检查后部署。首次发布时，在仓库 Settings → Pages 中将 Source 设为 GitHub Actions。完整步骤及线上验收见 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 操作与规则

完整约定见 [SPEC.md](SPEC.md)。桌面左键翻开或展开，右键编辑当前组，中键点击已有标记选中该组。中键点无标记格、格子间隙、棋盘边框或页面空白，或点击桌面“新组”，会按数值组、a、b…的顺序准备第一个未使用的组，没有数值标记时优先准备数值组。链接、按钮、表单控件和弹窗保留原有行为。数值与字母标记格统一使用深色底。I 旋转、C 共轭、M 后中键点击另一组合并、0 数值组、Esc 取消、Ctrl/⌘ Z 撤销标记；待合并时中键点空白不切组。

手机不需要切换翻开/标记模式：未标格点按翻开，长按约 0.2 秒打开滑动菜单，划向四个方向选择当前组的系数，中心 ∅ 清除，划出外圈取消，松手才执行。菜单和命中区域一起避让屏幕边缘，并覆盖在底部分组栏上方。菜单出现前滑动仍用于滚动，出现后划动选择标记；多指或触摸中断会取消。已开格点按持续选中线索，长按后松手条件展开。

棋盘下方可切回旧版“直接标记”：长按后松手直接落标或清除。点按已有标记时，异组先归入当前组并保留系数，同组才轮换；滑动菜单下可关闭点按轮换，关闭后同组点按不变。两项偏好分别记忆。底栏下拉列表选组，“新组”与桌面一样从数值组开始准备第一个未使用的组，并提供整组变换、撤销及“选目标组 → 确认”的合并操作。

标记提示和展开默认开启并各自保存偏好；展开开关在桌面显示“点击展开”，在手机显示“长按展开”。所有提示及展开资格仅使用公开信息。胜利要求安全格全部翻开并使全部线索满足；变量无需指定绝对相位。

分享链接使用 `#cw=` 与完整棋局快照，保留当前盘面、分组、用时和结束状态。导入进行中的局面后点击“继续对局”。无法识别的格式或损坏的数据会提示错误。分享数据可重建完整雷场，不用于防作弊。

## 实现与许可

网页核心、状态更新、分享格式、界面与测试依据本项目的 [行为规格](SPEC.md) 实现。代码采用单元格记录、独立公开观察数据与显式操作更新的结构。界面使用 CSS、SVG 和数学字体绘制。

Copyright (C) 2026 yizhaozhang11。本项目自有代码及文档采用 **GPL-3.0-only**（仅 GNU GPL 第 3 版），完整条款见 [LICENSE](LICENSE)，作者、玩法致谢和第三方素材的范围见 [COPYRIGHT](COPYRIGHT)。本程序不提供任何担保。

数学字体及其生成的字形轮廓另按 GUST Font License 使用，来源、作者与文件校验见 [public/fonts/NOTICE.md](public/fonts/NOTICE.md)。项目没有额外的运行时 JavaScript 包依赖；开发工具及其许可信息记录于 `package-lock.json`。

根式和 `±i` 标识直接取自所附 Latin Modern Math 字形轮廓，使用固定根号比例和数字基线。可选生成工具为 `tools/draw-math.py`（Python + fonttools 4.66.1）；常规构建直接使用已经生成的文件，不需要 Python。胜利播放彩色光圈、少量纸屑与完成徽章，约三秒收起；踩雷播放命中格轻震、暖色波纹与结束徽章，约两秒收起。减少动态效果时仅显示静态徽章。
