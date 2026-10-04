# 盈刻 · YINK

**简体中文 · [English](README.en.md)**

**揽盘间跌宕，镌一迹风华。**

一段行情，一次选择，一件可以留下来的作品。

盈刻是一款开源的股票交易艺术海报编辑器。把真实价格轨迹化为蜡烛、墨线与留白，再用文字、贴图和图层完成自己的表达。从选择行情到保存 PNG，整个创作流程都在浏览器里完成。

**[直接打开在线版 → https://leekquant.tech/](https://leekquant.tech/)**

无需注册或安装，打开即可使用。也可下载离线版，用 CSV 在本地创作。

[完整使用指南](docs/USER_GUIDE.md) · [参与贡献](CONTRIBUTING.md) · [开源致谢](ACKNOWLEDGEMENTS.md) · [第三方授权](THIRD_PARTY_NOTICES.md)

## 从行情到作品

<p align="center"><img src="docs/screenshots/artwork-spcx.png" alt="盈刻导出的 SPCX 水墨交易海报示例" width="600"></p>

价格保留走势，笔触表达情绪。你可以记录一笔交易，也可以不标买卖点，把一段行情单独做成作品。

<details>
<summary>看看作品在空间中的展示</summary>

<p align="center"><img src="docs/screenshots/artwork-in-room.png" alt="盈刻海报的室内装裱场景示意" width="600"></p>

室内展示图为作品场景示意；下面的操作端展示由真实网页截图排版而成。

</details>

## 界面预览

下面展示真实操作端的浅色、深色界面。图中的股票和收益仅用于展示软件操作，不是收益承诺。

| 浅色主题 | 深色主题 |
| --- | --- |
| ![浅色操作端](docs/screenshots/light.png) | ![深色操作端](docs/screenshots/dark.png) |

## 核心流程

**选股与区间 → 标记交易（可选）→ 选择 K 线风格 → 编辑艺术画布 → 保存本地**

- **行情与数据**：A 股、港股、美股搜索；导入 CSV；5 分钟、小时、日、周 K；在线行情支持前复权、后复权和不复权。
- **多笔交易**：添加多个买点和卖点，逐笔编辑成交价与数量，按移动平均成本计算；也可直接制作没有交易标点的原始 K 线贴图。
- **轨迹风格**：标准蜡烛、价格线、面积轨迹；水墨风 1 的黑白蜡烛；水墨风 2 的飞白折线。自定义线条、颜色、买卖标点和图片标点。
- **自由画布**：横纵预设、自定义比例、背景、文字、图片、预设墨点和独立图层；拖动、缩放、旋转、锁定、排序、对齐、撤销和重做。
- **字体与导出**：本地免费字体，自定义字体上传；保存 PNG，保存及重新打开项目 JSON。
- **界面设置**：深浅色主题、中文/英文、三档界面字号；手机触摸编辑及减少动态效果适配。

## 立即开始

### 本地使用，无需构建

1. 下载项目源码并解压，或从仓库的 **Releases** 下载 `YINK-offline.zip`。
2. 用普通浏览器打开根目录的 `index.html`。
3. 选择“导入 CSV → 一键试用示例数据”，即可开始体验。

前端不需要 Node.js、账号或 API Key。内置字体和贴图支持离线加载；在线行情需要联网。示例 CSV 是虚构数据。

也可以启动本地静态服务：

```sh
python -m http.server 8765 --bind 127.0.0.1
```

然后访问 `http://127.0.0.1:8765/`。

### CSV 格式

```csv
date,open,high,low,close,volume
2026-09-01,210,215,208,213,1000000
2026-09-02,213,220,211,218,1200000
```

分时数据使用 `YYYY-MM-DD HH:mm`。示例见 [examples/sample.csv](examples/sample.csv)。数据可从细粒度聚合到粗粒度，不能从日 K 还原分钟行情；CSV 不计算复权。

## 本地版与部署版

作品编辑、CSV 解析、收益计算和 PNG 渲染均在浏览器中完成。作品草稿可保存在浏览器，也可下载项目 JSON。

本地版和其他域名上的副本不会向盈刻服务器发送使用记录。`js/hosted.js` 只在 `https://leekquant.tech` 启用同源使用统计；在线站点记录访客 IP、访问次数和生成作品的基础元数据。当前前端不上传作品预览、完整项目、交易价格或标语。可选 Python 管理端提供日期报表、IP 备注、访问限制和 CSV 导出。

自行部署可参考 [deploy/README.md](deploy/README.md)。部署版需要另行配置域名、Nginx、Gunicorn、TLS 和管理员初始化；源码不包含线上密码、数据库、证书或初始化码。

## 开发与验证

前端是原生 JavaScript、HTML、CSS 和 Canvas 2D。开发者请下载完整源码后运行以下命令；测试需要 Node.js，后端测试需要 Python，使用标准库。

```sh
node tests/core.test.js
node tests/data.test.js
node tests/editor.test.js
node tests/ui-flow.test.js
node tests/i18n.test.js
node tests/hosted.test.js
node tests/mobile.test.js
node tests/admin-ui.test.js
node tests/package.test.js
python -B tests/backend.test.py
```

Windows PowerShell 构建离线包：

```powershell
./tools/build-offline.ps1
```

更新包与构建输出位于 `dist/`，通过 Releases 分发，不提交到源码仓库。

## 项目结构

```text
index.html       操作端入口
css/             界面样式、手机适配和主题
js/              数据、交易、图表、编辑器和导出
assets/          字体、Logo 和内置素材
examples/        虚构 CSV 示例
server/          可选管理端及统计后端
deploy/          部署配置与更新器
tests/           自动化测试
tools/           打包工具
docs/            使用指南及真实界面展示
```

## 已知边界

- 公开行情接口可能变化、限流或无法访问；可使用 CSV 继续编辑。
- 分钟行情的历史覆盖范围由数据源决定。
- 当前收益计算不计手续费、税费、汇率和分红；价格复权口径由数据源提供。
- 浏览器草稿受存储空间限制；包含大图片或自定义字体时，建议下载项目 JSON。
- 盈刻是交易艺术作品编辑工具，不提供预测、下单或投资建议。

## 授权

项目自身代码采用 [MIT License](LICENSE)。第三方库及字体保留各自许可证，详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。行情数据和用户导入的素材不随项目代码许可重新授权。

## 致谢

感谢把代码和字体开放给大家的创作者。盈刻的笔触与排版建立在他们的工作之上：

- **[Squiggy](https://github.com/LingDong-/squiggy) · [LingDong-](https://github.com/LingDong-)**：当前水墨渲染使用的矢量笔刷几何库，采用 ISC 许可。
- **[p5.brush](https://github.com/acamposuribe/p5.brush) · [Alejandro Campos Uribe](https://github.com/acamposuribe)**：水墨探索阶段使用的绘画库；仓库保留其 MIT 授权的 standalone 包，当前页面不加载它。
- **[寒蝉高黑体 / Chill G Sans](https://github.com/Warren2060/ChillGSans) · [Warren2060](https://github.com/Warren2060)**：界面使用的本地字体。
- **[Google Fonts](https://github.com/google/fonts) 与各字体作者**：提供离线艺术字体，包括中文书写、衬线、几何和展示字体。

完整出处、实际用途和逐款字体版权见 [中英双语致谢](ACKNOWLEDGEMENTS.md)。感谢这些项目的作者、维护者和贡献者；原始许可证随源码与离线包一起保留。
