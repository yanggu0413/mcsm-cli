# MCSManager CLI

`mcsm-cli` 是用於管理 MCSManager 面板的命令列工具，適合開發者及終端中的 AI Agent。它支援以 JSON 輸出資料，方便後續檢查、腳本處理與命令列管線串接。

本儲存庫包含：

- `mcsm-cli/`：CLI 原始碼、測試與套件設定。
- `skills/mcsm-cli/`：提供 AI Agent 使用 `mcsm` 的 skill 指引。

## 安裝

需要 Node.js `>=22.12.0`。

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

## 功能總覽

CLI 以 MCSManager 面板為入口，透過節點 ID 與執行個體 UUID 指定管理目標。支援的主要功能如下：

- **面板與節點**：查看面板概況、系統資源與節點統計；列出節點、測試或重新連線，並支援管理員新增及移除節點。
- **執行個體管理**：依節點列出執行個體、跨節點搜尋、查看即時資訊及主控台日誌；建立或更新執行個體設定，並執行啟動、正常停止、重新啟動、傳送主控台指令及刪除等操作。
- **執行個體檔案**：列出目錄、讀取或寫入文字檔、上傳本機檔案、從網址下載檔案、建立目錄，以及壓縮或解壓縮 ZIP。也可查看檔案系統狀態與背景檔案工作。
- **Minecraft 模組**：從 Modrinth、CurseForge 與 SpigotMC 搜尋模組，列出執行個體中已安裝的模組，並切換模組啟用狀態。
- **排程工作**：列出、建立及移除執行個體排程，例如定時重新啟動或執行主控台指令。
- **使用者資訊**：查看目前登入使用者及其可用執行個體；管理員可列出面板使用者。
- **Java 執行環境**：列出節點可用的 Java、下載並安裝版本、註冊自訂路徑、指定執行個體使用的 runtime，或移除 runtime 設定。
- **JSON 與腳本整合**：查詢指令可搭配 `--json` 輸出結構化資料，便於交由 Agent 判讀、用 `jq` 篩選，或串接其他 shell 工具。

`instance kill` 會強制終止程序，可能造成世界存檔損毀；刪除執行個體、檔案、節點或排程也可能造成資料或服務中斷。執行這些操作前，請先確認目標及影響範圍。

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
