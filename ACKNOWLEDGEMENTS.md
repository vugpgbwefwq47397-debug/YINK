# 开源致谢 · Acknowledgements

盈刻感谢每一位愿意公开作品、分享代码与字体的创作者。下面记录实际使用的项目、作者、用途及许可证；致谢不能替代原始许可文件，完整法律声明也随仓库和离线包保留。

YINK thanks the creators who make their code and typefaces available to others. This document records sources, creators, actual usage, and licenses. Credits supplement the original license notices, which are included in both the repository and offline package.

## 笔刷与图形 · Brushes and graphics

| 项目 / Project | 作者 / Creator | 盈刻中的用途 / Use in YINK | 许可 / License |
| --- | --- | --- | --- |
| [Squiggy](https://github.com/LingDong-/squiggy) | [LingDong-](https://github.com/LingDong-) | 当前水墨轨迹的矢量笔刷几何；YINK 在其基础上添加自己的 Canvas 2D 笔触渲染。Vector brush geometry for the current ink renderer, with YINK's own Canvas 2D rendering passes. | [ISC](js/vendor/SQUIGGY-LICENSE.txt) |
| [p5.brush](https://github.com/acamposuribe/p5.brush) | [Alejandro Campos Uribe](https://github.com/acamposuribe) | 早期水墨渲染实验使用；保留 standalone 包和许可，当前网页不加载。Used in earlier rendering experiments; standalone bundle retained with its notice, not loaded by the current page. | [MIT](js/vendor/p5-brush-LICENSE.md) |

上游浏览器包保留原样。当前页面只加载 Squiggy；交易数据处理、画布编辑与导出等项目功能由 YINK 自身代码实现。文件来源与 p5.brush 下载记录见 [vendor 说明](js/vendor/README.md)。

The upstream browser bundles are unmodified. Only Squiggy is loaded by the current page. Trade processing, canvas editing, and exports are implemented in YINK's own code. See the [vendor notes](js/vendor/README.md) for bundle sources and the p5.brush download record.

## 字体 · Typefaces

感谢 [Warren2060](https://github.com/Warren2060) 的[寒蝉高黑体](https://github.com/Warren2060/ChillGSans)，让界面有了紧凑而鲜明的文字气质。也感谢 [Google Fonts](https://github.com/google/fonts) 和下面各字体的作者及维护者，让作品能在离线环境中拥有多样排版。

Thank you to [Warren2060](https://github.com/Warren2060) for [Chill G Sans](https://github.com/Warren2060/ChillGSans), YINK's interface typeface, and to [Google Fonts](https://github.com/google/fonts) and the typeface creators below for making varied offline typography possible.

版权信息以下列随包许可证为准。所有 16 款内置字体采用 SIL Open Font License 1.1，文件未经修改。Google Fonts 是分发来源，逐款字体仍归其各自版权方。

Copyright information follows the notices bundled with each font. All 16 bundled families use SIL Open Font License 1.1 and are unmodified. Google Fonts is a distribution source; copyright remains with each font's respective holders.

| 字体 / Family | 版权方与项目出处 / Copyright holder and source | 原始许可 / Original notice |
| --- | --- | --- |
| Chill G Sans / 寒蝉高黑体 | The Chill G Sans Project Authors · [Warren2060/ChillGSans](https://github.com/Warren2060/ChillGSans) | [OFL](assets/fonts/licenses/chillgsans-OFL.txt) |
| Inter | The Inter Project Authors · [rsms/inter](https://github.com/rsms/inter) | [OFL](assets/fonts/licenses/inter-OFL.txt) |
| Noto Sans SC | Adobe · [google/fonts: Noto Sans SC](https://github.com/google/fonts/tree/main/ofl/notosanssc) | [OFL](assets/fonts/licenses/notosanssc-OFL.txt) |
| Noto Serif SC | Google Inc. · [google/fonts: Noto Serif SC](https://github.com/google/fonts/tree/main/ofl/notoserifsc) | [OFL](assets/fonts/licenses/notoserifsc-OFL.txt) |
| Ma Shan Zheng / 马善政 | The Ma Shan Zheng Project Authors · [googlefonts/mashanzheng](https://github.com/googlefonts/mashanzheng) | [OFL](assets/fonts/licenses/mashanzheng-OFL.txt) |
| Zhi Mang Xing / 志莽行 | The Zhi Mang Xing Project Authors · [googlefonts/zhimangxing](https://github.com/googlefonts/zhimangxing) | [OFL](assets/fonts/licenses/zhimangxing-OFL.txt) |
| Liu Jian Mao Cao / 刘建毛草 | The Liu Jian Mao Cao Project Authors · [googlefonts/liujianmaocao](https://github.com/googlefonts/liujianmaocao) | [OFL](assets/fonts/licenses/liujianmaocao-OFL.txt) |
| Long Cang / 龙藏 | The Long Cang Project Authors · [googlefonts/longcang](https://github.com/googlefonts/longcang) | [OFL](assets/fonts/licenses/longcang-OFL.txt) |
| ZCOOL XiaoWei / 站酷小薇 | The ZCOOL XiaoWei Project Authors · [googlefonts/zcool-xiaowei](https://github.com/googlefonts/zcool-xiaowei) | [OFL](assets/fonts/licenses/zcoolxiaowei-OFL.txt) |
| ZCOOL QingKe HuangYou / 站酷庆科黄油体 | The ZCOOL QingKe HuangYou Project Authors · [googlefonts/zcool-qingke-huangyou](https://github.com/googlefonts/zcool-qingke-huangyou) | [OFL](assets/fonts/licenses/zcoolqingkehuangyou-OFL.txt) |
| DM Serif Display | Adobe; Google LLC · [google/fonts: DM Serif Display](https://github.com/google/fonts/tree/main/ofl/dmserifdisplay) | [OFL](assets/fonts/licenses/dmserifdisplay-OFL.txt) |
| Space Mono | The Space Mono Project Authors · [googlefonts/spacemono](https://github.com/googlefonts/spacemono) | [OFL](assets/fonts/licenses/spacemono-OFL.txt) |
| Bebas Neue | Dharma Type · [google/fonts: Bebas Neue](https://github.com/google/fonts/tree/main/ofl/bebasneue) | [OFL](assets/fonts/licenses/bebasneue-OFL.txt) |
| Playfair Display | The Playfair Display Project Authors · [clauseggers/Playfair-Display](https://github.com/clauseggers/Playfair-Display) | [OFL](assets/fonts/licenses/playfairdisplay-OFL.txt) |
| Caveat | The Caveat Project Authors · [googlefonts/caveat](https://github.com/googlefonts/caveat) | [OFL](assets/fonts/licenses/caveat-OFL.txt) |
| Bungee | The Bungee Project Authors · [djrrb/Bungee](https://github.com/djrrb/Bungee) | [OFL](assets/fonts/licenses/bungee-OFL.txt) |

精确字体下载路径见 [字体来源表](assets/fonts/README.md)。原始 OFL 文件包含版权年份及保留字体名等条款。

Exact font download paths are listed in the [font source table](assets/fonts/README.md). The original OFL files include copyright years and any reserved font names.

## 行情与演示素材 · Data and presentation assets

- 在线行情适配器使用[东方财富](https://www.eastmoney.com/)的数据服务；该服务不是本仓库包含的开源依赖，行情数据也不受 YINK 的 MIT 许可重新授权。The online adapter uses Eastmoney's data service. It is not a bundled open-source dependency, and market data is not relicensed under YINK's MIT license.
- 内置 CSV 是虚构演示数据。README 中的作品与截图由项目维护者提供；室内图为展示场景示意。The bundled CSV is fictional. README artwork and screenshots were supplied by the project maintainer; the room image illustrates an artwork presentation.
- 品牌图形和泼墨素材在项目设计过程中使用了图像生成工具。用户自行上传的字体和图片归其各自权利人。Brand graphics and ink splash assets were developed with image-generation tools during the design process. User-uploaded fonts and images remain the property of their respective rights holders.

如果发现遗漏或出处错误，欢迎提交 Issue 或 Pull Request，我们会核对并补充。感谢所有上游作者、维护者与贡献者。

If a credit is missing or incorrect, please open an issue or pull request so we can verify and correct it. Thank you to all upstream authors, maintainers, and contributors.
