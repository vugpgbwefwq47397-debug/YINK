# 线上部署

本文配置中的 `leekquant.tech` 是项目演示站点域名。自行部署时，请修改 `deploy/nginx.conf` 的域名和证书路径、`deploy/yink.service` 的 `YINK_ORIGIN`，以及 `js/hosted.js` 的明确域名白名单。统计脚本只请求当前站点的同源 `/api/`，不会将自行部署站点的数据发送给演示站。

## 新服务器准备

1. 准备 Python 3、Gunicorn、Nginx 和有效 TLS 证书。
2. 在 Windows PowerShell 运行 `tools/build-hosted.ps1`，将生成包内 `public/` 和 `server/` 放到 `/opt/yink/` 下。
3. 创建用于运行后端的系统用户 `yink`，准备归其所有、权限为 `700` 的 `/var/lib/yink`。
4. 修改并安装 systemd 服务；后端保持监听本机 `127.0.0.1:8766`，只允许 Nginx 访问。
5. 参考 Nginx 配置，调整站点目录与 TLS 证书路径。配置中包含访问限制检查，需要后端先正常运行。验证配置后启动站点，并安排证书续期。
6. 通过 HTTPS 打开 `/admin01`，由管理员本人完成初始化。

运行时数据库、初始化码、密码及 TLS 私钥须留在服务器，不提交到代码仓库。本仓库不提供演示服务器旧站点迁移脚本。

网站静态文件部署到 `/opt/yink/public`，Python 后端到 `/opt/yink/server`。后端只监听 `127.0.0.1:8766`，使用 Ubuntu 官方包 `gunicorn` 启动，由 systemd 自动重启。Nginx 复用服务器已有官方镜像，使用 host 网络及只读站点/证书挂载。

初始化：管理员本人在 `/admin01` 输入 `/var/lib/yink/setup-token` 中的一次性码，并设定至少 12 位密码。初始化后该码不再有效。密码以 PBKDF2-SHA256 600000 次迭代加盐保存；会话有效 8 小时，Cookie 为 HttpOnly、Secure、SameSite=Strict。后台操作检查来源与 CSRF。

IP 封禁由 Nginx `auth_request` 及后端执行。IP 只取 Nginx 覆盖的 `X-Real-IP`，服务端端口不对公网开放。前端记录不是可信交易证明；浏览器可禁用/伪造记录，因此安全边界还包含 Nginx 和后端限流、请求大小限制。基本防护不能替代上游 DDoS 服务。

数据为 SQLite，路径 `/var/lib/yink/yink.sqlite`；访客按 UTC 日汇总并保留 30 天，生成记录保留 30 天。管理端可筛选日期、分页检索 IP 与备注、查看每日趋势、风格／股票／比例／入口分布、导出 CSV，并查看 IP 详情。IP 备注独立存储，保留至管理员清除；安全信号及管理操作记录保留 30 天。登录密码及初始化码不会记入操作记录。生成 metadata 不包含买卖价格、金额、标语、完整项目。当前前端仅上报 metadata，不上传 PNG 预览；历史自愿分享的预览仍由后台认证保护。前端仅在 `https://leekquant.tech` 启用上报。

证书使用 `/opt/yink/tls`，HTTP ACME 校验目录 `/opt/yink/certbot-www`。续期后执行 `docker exec yink-nginx nginx -s reload`。上线需安排已有证书自动续期，不能只复制现有证书。

## 手机端及首页提示更新

运行 `python tools/build-ui-update.py` 构建 `dist/YINK-mobile-update.zip`。把此包上传到服务器根目录后，可在 Workbench 终端执行：

```sh
python3 -c "import zipfile; p='/YINK-mobile-update.zip'; exec(compile(zipfile.ZipFile(p).read('apply-ui-update.py'),'apply-ui-update.py','exec'))" /YINK-mobile-update.zip
```

更新器先校验完整文件清单与 SHA-256，再替换 11 个 UI 文件，最后替换首页。它不修改数据库、密码、服务配置或证书。运行后检查首页引用 `mobile.css?v=1`、`mobile-ui.js?v=1`、`i18n.js?v=6`、`hosted.js?v=3`；首次刷新应加载新版资源。发布后仍需在 iPhone Safari 验证输入、滚动与编辑。

## 管理端更新

运行 `python tools/build-admin-update.py`。上传 `dist/YINK-admin-update.zip` 到服务器 `/` 后执行：

```sh
python3 -c "import zipfile; p='/YINK-admin-update.zip'; exec(compile(zipfile.ZipFile(p).read('apply-admin-update.py'),'apply-admin-update.py','exec'))" /YINK-admin-update.zip
```

更新器校验并替换 app.py 与 admin.html，重启 yink 服务并检查 loopback 健康接口。启动时只新增数据库表与索引，保留现有统计、密码和会话。统计按 UTC 日界线筛选；时间显示北京时间。CSV 支持中文 BOM，并防止表格公式注入。每日高频提醒阈值为 60 次，仅为维护线索；安全信号从新版本开始记录，不包含 Nginx 在请求到达应用前拒绝的所有请求。

测试：`python -B tests/backend.test.py`、`node tests/admin-ui.test.js`。运行 `python tools/build-admin-preview.py` 可生成明确标注示例数据的界面演示，不向真实后台发请求。
