# MCSManager CLI (`mcsm`)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

专为 **AI Agent**（Claude Code、Aider、OpenHands、Cline 等）与开发者设计的 **MCSManager** 命令行运维工具。

- ⚡ **零 Token 预加载负担**：无需预先在 LLM 上下文中注入几十个工具的 Schema。
- 🔗 **支持 Unix 管道与脚本组合**：通过 `--json` 原生支持 `jq` 与管道处理。
- 🔑 **凭据持久化**：配置一次即可在整个系统随处调用。

---

## 🚀 快速安装与配置

```bash
# 全局安装
npm install -g mcsm-cli

# 设置面板地址与 API Key（保存在 ~/.mcsmrc.json）
mcsm config set --url http://localhost:23333 --key your-api-key

# 查看配置
mcsm config get
```

---

## 💻 常用命令示例

```bash
# 1. 查看面板概览
mcsm overview --json

# 2. 节点管理
mcsm daemon list --json
mcsm daemon link <daemonId>

# 3. 实例操作
mcsm instance list <daemonId> --json
mcsm instance get <daemonId> <uuid>
mcsm instance start <daemonId> <uuid>
mcsm instance stop <daemonId> <uuid>
mcsm instance restart <daemonId> <uuid>
mcsm instance kill <daemonId> <uuid>
mcsm instance cmd <daemonId> <uuid> "say Hello World"
mcsm instance log <daemonId> <uuid> --size 20KB

# 4. 文件操作
mcsm file ls <daemonId> <uuid> /plugins --json
mcsm file cat <daemonId> <uuid> /server.properties
mcsm file write <daemonId> <uuid> /eula.txt "eula=true"
mcsm file upload <daemonId> <uuid> ./mods.zip /plugins/mods.zip
mcsm file upload <daemonId> <uuid> ./server-pack.zip /server-pack.zip --unzip
# 若 panel 回传的 daemon 位址不可达，可指定从当前环境可连线的地址
mcsm file upload <daemonId> <uuid> ./setup.exe /setup.exe --daemon-addr http://100.92.190.117:24444
mcsm file rm <daemonId> <uuid> /old.jar
mcsm file mkdir <daemonId> <uuid> /backup
mcsm file download <daemonId> <uuid> https://example.com/mod.jar /plugins/mod.jar

# 5. 用户与权限
mcsm user list --json
mcsm user me

# 6. Minecraft Mod 管理
mcsm mod search "jei" --loader fabric --version 1.20.1 --json
mcsm mod list <daemonId> <uuid> --json
mcsm mod toggle <daemonId> <uuid> jei-1.20.1.jar
```

---

## 🛠️ 本地开发与构建

```bash
cd mcsm-cli
pnpm install
pnpm test
pnpm build
```

---

## 📄 License
MIT License
