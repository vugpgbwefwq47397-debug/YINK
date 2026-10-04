# Third-party software and assets

The project-level license applies to YINK's own code. Third-party libraries and fonts retain their original licenses.

For author credits, source links, actual usage, and bilingual acknowledgements, see [ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md). Each font's copyright holder is recorded there and in its original local license.

| Component | Upstream | License | Local notice |
| --- | --- | --- | --- |
| Squiggy | https://github.com/LingDong-/squiggy | ISC | `js/vendor/SQUIGGY-LICENSE.txt` |
| p5.brush standalone bundle | https://github.com/acamposuribe/p5.brush | MIT | `js/vendor/p5-brush-LICENSE.md` |
| Bundled font families | See `assets/fonts/README.md` | SIL Open Font License 1.1 | `assets/fonts/licenses/` |

Squiggy is used for brush geometry. The p5.brush bundle is retained locally; the current default renderer uses Canvas 2D and Squiggy. The original upstream bundles and bundled font files are unmodified.

The Chinese/English interface uses Chill G Sans. Bundled artwork fonts are loaded on demand. Do not remove their copyright and license files when redistributing the offline package.

Brand artwork and the ink splash asset were developed with image-generation tools during this project's design process. User-uploaded images and fonts are not included in the source repository and retain their respective owners' rights.

The Eastmoney adapter accesses a third-party public market-data service. That data is not licensed by the YINK source-code license. The repository's CSV sample is fictional demonstration data.
