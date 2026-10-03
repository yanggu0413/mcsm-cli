# MCSManager CLI

`mcsm-cli` 是用於管理 MCSManager 面板的命令列工具，適合開發者及終端中的 AI Agent。它支援以 JSON 輸出資料，方便後續檢查、腳本處理與命令列管線串接。

本儲存庫包含：

- `mcsm-cli/`：CLI 原始碼、測試與套件設定。
- `skills/mcsm-cli/`：提供 AI Agent 使用 `mcsm` 的 skill 指引。

## 安裝

從 npm 全域安裝：

```sh
npm install -g mcsm-cli
```

確認安裝：

```sh
mcsm --help
```

也可以從原始碼安裝相依套件並建置：

```sh
cd mcsm-cli
pnpm install
pnpm build
```

## 設定

設定 MCSManager 面板網址與 API Key：

```sh
mcsm config set --url http://localhost:23333 --key <API_KEY>
```

設定會儲存在使用者家目錄的 `~/.mcsmrc.json`。也可以透過 `MCSM_BASE_URL` 與 `MCSM_API_KEY` 環境變數提供設定。API Key 是機密資料，請勿提交至版本控制或貼入公開日誌。

## 使用範例

```sh
# 查看面板概況與節點
mcsm overview --json
mcsm daemon list --json

# 列出指定節點上的執行個體
mcsm instance list <daemonId> --json

# 查詢執行個體狀態與日誌
mcsm instance get <daemonId> <uuid> --json
mcsm instance log <daemonId> <uuid> --size 20KB --json

# 搜尋 Minecraft 模組
mcsm mod search "jei" --loader fabric --version 1.20.1 --json
```

完整指令與參數請參閱 [`mcsm-cli/README.md`](./mcsm-cli/README.md)，或使用 `mcsm --help`。

## Agent Skill

Skill 定義位於 [`skills/mcsm-cli/SKILL.md`](./skills/mcsm-cli/SKILL.md)。將 `skills/mcsm-cli/` 放入所使用 AI Agent 支援的 skills 目錄，即可提供 `mcsm` 的操作指引。Skill 內容包括常見查詢流程、指令範例、憑證保護及執行管理操作時的安全注意事項。

## 開發與測試

```sh
cd mcsm-cli
pnpm install
pnpm test
pnpm build
```
