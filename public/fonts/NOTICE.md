# Latin Modern Math 1.959

作者：Bogusław Jackowski、Piotr Strzelczyk、Piotr Pianowski，代表 TeX Users Groups。

- 发布页：https://ctan.org/pkg/lm-math
- 本次取得地址：https://mirrors.ctan.org/fonts/lm-math.zip
- 下载日期：2026-10-08
- 文件：上游 `opentype/latinmodern-math.otf`，原样保留，未修改字形或子集化。
- SHA-256：`6075562b771f8b82f0c179e363389684f2dd09de30038269e2628e504bd7be0f`
- 许可：同目录 `GUST-FONT-LICENSE.txt`
- 原始说明：同目录 `README-upstream.txt`

此字体许可独立于网页程序的 GPL-3.0 许可。

`tools/draw-math.py` 从上述 OTF 生成根式及 ±i 标识的矢量轮廓，结果位于 `src/math-outlines.ts`、`public/brand.svg`、`public/favicon.svg`。这些字形轮廓仍按 GUST 字体许可使用。生成器自行安排根号比例、横线、数字基线与标识留白；不依赖浏览器对数学根号的自动伸展。
