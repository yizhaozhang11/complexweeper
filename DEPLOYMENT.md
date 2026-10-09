# 发布与 GitHub Pages 部署

本项目以独立仓库发布。基础玩法的致谢见 [README.md](README.md)，本项目署名与许可范围见 [COPYRIGHT](COPYRIGHT)。首次正式发布版本为 `1.0.0`。

项目仓库为 [yizhaozhang11/complexweeper](https://github.com/yizhaozhang11/complexweeper)，站点地址为 [yizhaozhang11.github.io/complexweeper](https://yizhaozhang11.github.io/complexweeper/)。

## 首次发布

1. 确认公开署名为 [yizhaozhang11](https://github.com/yizhaozhang11)，仓库名称为 `complexweeper`。
2. 在 GitHub 创建独立的公开空仓库，提交本项目源码、锁文件及发布配置。默认分支为 `main`；工作流也支持自动识别其他默认分支名称。
3. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 推送默认分支，或在 **Actions → Check and deploy Pages → Run workflow** 选择默认分支运行。
5. 工作流成功后，从 `github-pages` 环境或部署任务打开实际站点地址，补充到仓库 About 和 README。
6. 完成线上验收后，为这次发布创建与版本号一致的 Git 标签和 Release。

GitHub Actions 工作流见 [.github/workflows/pages.yml](.github/workflows/pages.yml)。各分支推送和 pull request 都运行检查；只有默认分支的推送或手动运行会部署。部署使用 GitHub 自带的令牌，所需的 Pages 和 OIDC 权限仅授予部署任务。

## 本地发布检查

使用 Node.js 24；版本声明见 [.nvmrc](.nvmrc)。

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run test:pages
```

Linux 环境安装浏览器及系统依赖时，使用 `npx playwright install --with-deps chromium`。CI 已包含此步骤。

- `npm test`：规则、快照和源码打包测试。
- `npm run build`：生成教程、更新说明页和对应源码包，检查 TypeScript，并构建 `dist/`。
- `npm run test:browser`：桌面和触屏交互检查。
- `npm run test:pages`：检查生产构建的子目录访问、字体、许可、源码入口、分享恢复，以及更新弹窗的首次提示、已读记忆和存储回退。运行前须先构建；测试占用本地端口 4174。

测试目前覆盖 Chromium 桌面和触屏模拟。首发验收还应在实际手机、Safari 或 Firefox 上确认主要操作。

## 部署内容和源码

只部署 `dist/`。资源使用相对路径，支持 `https://用户名.github.io/仓库名/` 这样的子目录，无需在源码中硬编码仓库名称。

GitHub Actions 构建时从 `GITHUB_SERVER_URL`、`GITHUB_REPOSITORY` 和 `GITHUB_SHA` 生成源码链接：页脚“GitHub”在新标签页打开本仓库，“关于”中的“GitHub（本版本）”打开 `/tree/提交SHA`，便于找到当前网页实际使用的代码。发布仓库应公开，保留部署对应的提交及构建文件。

本地或其他平台构建可通过进程环境变量 `CW_REPOSITORY_URL` 指定仓库 HTTPS 地址，通过 `CW_SOURCE_REVISION` 指定对应提交 SHA；它们优先于 GitHub Actions 的默认值。开发预览修改这些变量后需重新启动 Vite。未提供仓库地址时，页脚显示“下载源码”；未提供对应提交时，“关于”仍提供本次构建的源码包。源码包会随站点保留，供本地预览和下载使用。

教程正文维护在 `GUIDE.md`，由 `tools/build-guide.mjs` 生成静态网页 `public/guide.html`，随站点发布。开发和构建命令都会先生成教程；请修改 Markdown 正文，而不是生成的 HTML。

更新说明维护在 `CHANGELOG.md`，由 `tools/build-notes.mjs` 生成 `public/changes.html`；最近一条说明和部署标识同时编入游戏代码，确保弹窗对应实际载入的版本。

随后，`tools/package-source.mjs` 会：

- 检查 `package.json` 中的源码清单；任何列出的文件缺失都会使构建失败。
- 将根目录的 LICENSE、COPYRIGHT 同步到网页法律说明目录。
- 打包源码、测试、字体、规则、教程、更新说明及其生成工具、构建配置、工作流及锁文件，并将源码包放入 `dist/source.tgz`。

新增构建输入、许可或发布文件时，同步更新 `package.json` 的 `files` 清单。不要手工修改 `dist/` 或源码压缩包；通过重新构建保持网页与对应源码一致。

`.cache/`、`node_modules/`、`dist/`、浏览器测试产物和自动生成的源码压缩包已经由 `.gitignore` 排除。

## 每次更新时维护说明

1. 在 `CHANGELOG.md` 最前面的更新条目之前，新增 `## YYYY-MM-DD · 简短标题`，旧条目保留在下面。
2. 面向试玩者描述实际变化；操作有调整时写清“以前怎么做、现在怎么做”。部署不会自动总结代码改动，更新内容需要随修改一起维护。
3. 重新构建并部署。独立页面展示全部记录，首次访问弹窗只展示最新条目；条目缺失或为空会使构建失败。

Pages 工作流通过 `CW_DEPLOYMENT_ID` 传入工作流运行编号和重试次数。即使 `package.json` 仍是同一个版本号，只要重新运行构建和部署，就会使用新的提醒标识。

本地 `npm run build` 默认也会产生新的标识，可用 `npm run preview` 验证自动弹窗。`npm run dev` 只提供手动预览，以免开发时反复打扰。自定义部署或复现构建时，可显式设置 `CW_DEPLOYMENT_ID`；同一个标识表示同一次更新。原样重新发布旧构建产物不会产生新的提醒标识。

已读状态按仓库子路径和部署标识保存在浏览器本地；持久存储不可用时尝试当前标签页的会话存储。换浏览器或清除站点数据后会重新提示；两种存储均不可用时，刷新可能再次提示，但关闭和游玩不受影响。

## 线上验收

- 页面、图标和数学字体加载正常，浏览器控制台没有资源错误。
- “教程”能在新标签页打开，目录跳转正常，手机上表格不会撑宽页面。
- 新的部署首次打开会弹出更新说明，关闭后刷新不重复；“更新”仍可手动打开，完整记录页可访问。
- 能翻开、标记、分组操作和重新开局；手机长按与滑动正常。
- 分享链接保留仓库路径，新页面打开后可继续对局。
- “关于”中的玩法来源、作者、辅助开发说明和许可正确。
- 页脚源码入口打开本仓库，“关于”中的版本源码对应本次部署的提交；源码包下载可用，解压后能运行上述安装与构建命令。

参考：[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
