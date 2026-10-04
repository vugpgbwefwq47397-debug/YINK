# Squiggy

`squiggy.js` is the upstream browser bundle from [LingDong-/squiggy](https://github.com/LingDong-/squiggy/blob/main/dist/squiggy.js). The upstream `package.json` declares the ISC license; its notice is included in `SQUIGGY-LICENSE.txt`. It is bundled locally so the K-line brush works when `index.html` is opened without a server or network connection.

The YINK ink renderer uses Squiggy for variable-width vector stroke geometry and adds deterministic bristle passes in `js/editor/render.js`. No source changes were made to the upstream bundle.

# p5.brush standalone

`p5-brush-standalone.js` is the unmodified `dist/brush.js` browser bundle from [acamposuribe/p5.brush](https://github.com/acamposuribe/p5.brush). Its MIT notice is preserved in `p5-brush-LICENSE.md`. The bundle is retained from an earlier renderer experiment. The current Ink wash 2 renderer uses Squiggy/Canvas 2D so its exported sticker keeps a transparent background; the p5.brush bundle is not loaded by the current page.

Downloaded from the upstream `main` branch on 2026-10-03. SHA-256: `952c1853b7699e6052b9f53d917cd09ea7c35f79d9f5b25e8665a937c618cae`.
