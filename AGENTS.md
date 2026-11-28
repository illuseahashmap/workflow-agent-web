# AI 接手入口

先读 README.md 的安装与启动步骤。完整产品位于 `workflow-agent` 根仓库时，继续阅读根目录 `docs/AI-BOOTSTRAP.md` 和 release-manifest.json；不要各自升级前后端子模块到未经一起验收的提交。

使用 package.json 的 packageManager 和 pnpm-lock.yaml：`corepack pnpm install --frozen-lockfile`。代理配置目前直接读取进程环境 VITE_API_PROXY_TARGET，默认后端 8080。维护依赖、环境变量或端口时同步更新 README 和 .env.example。浏览器不保存模型/数据库/服务端密钥。
