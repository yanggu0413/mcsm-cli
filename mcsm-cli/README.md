# MCSManager CLI (`mcsm`)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

專為開發者與終端中的 AI Agent 設計的 MCSManager 命令列工具，可用 JSON 輸出資料，方便後續檢查、腳本處理與命令列管線串接。

## 安裝

需要 Node.js `>=22.12.0`。

```sh
npm install -g mcsm-cli
mcsm --help
```

## 設定

設定 MCSManager 面板網址與 API Key：

```sh
mcsm config set --url http://localhost:23333 --key <API_KEY>
```

設定會儲存在使用者家目錄的 `~/.mcsmrc.json`。也可以透過 `MCSM_BASE_URL` 與 `MCSM_API_KEY` 環境變數提供設定。API Key 是機密資料，請勿提交至版本控制或貼入公開日誌。

## 功能總覽

CLI 以 MCSManager 面板為入口，透過節點 ID 與執行個體 UUID 指定管理目標。主要功能包括：

- **面板與節點**：查看面板概況、系統資源與節點統計；列出節點、測試或重新連線，並支援管理員新增及移除節點。
- **執行個體管理**：依節點列出執行個體、跨節點搜尋、查看即時資訊及主控台日誌；建立或更新設定，並執行啟動、正常停止、重新啟動、傳送主控台指令及刪除等操作。
- **執行個體檔案**：列出目錄、讀取或寫入文字檔、上傳本機檔案、從網址下載檔案、建立目錄，以及壓縮或解壓縮 ZIP；也可查看檔案系統狀態與背景檔案工作。
- **Minecraft 模組**：從 Modrinth、CurseForge 與 SpigotMC 搜尋模組，列出執行個體中已安裝的模組，並切換模組啟用狀態。
- **排程工作**：列出、建立及移除執行個體排程，例如定時重新啟動或執行主控台指令。
- **使用者資訊**：查看目前登入使用者及其可用執行個體；管理員可列出面板使用者。
- **Java 執行環境**：列出節點可用的 Java、下載並安裝版本、註冊自訂路徑、指定執行個體使用的 runtime，或移除 runtime 設定。
- **JSON 與腳本整合**：查詢指令可搭配 `--json` 輸出結構化資料，便於交由 Agent 判讀、用 `jq` 篩選，或串接其他 shell 工具。

## 使用範例

```sh
# 查看面板概況與節點
mcsm overview --json
mcsm daemon list --json

# 列出節點上的執行個體
mcsm instance list <daemonId> --json

# 查詢執行個體狀態與日誌
mcsm instance get <daemonId> <uuid> --json
mcsm instance log <daemonId> <uuid> --size 20KB --json

# 搜尋 Minecraft 模組
mcsm mod search "jei" --loader fabric --version 1.20.1 --json
```

完整指令與參數請使用 `mcsm --help`，或參閱[專案 GitHub README](https://github.com/yanggu0413/mcsm-cli#readme)。

`instance kill` 會強制終止程序，可能造成世界存檔損毀；刪除執行個體、檔案、節點或排程也可能造成資料或服務中斷。執行這些操作前，請先確認目標及影響範圍。

## Agent Skill

本儲存庫另提供 [MCSManager CLI Agent Skill](https://github.com/yanggu0413/mcsm-cli/tree/main/skills/mcsm-cli)。Skill 不包含在 npm 套件中，請依照所使用 AI Agent 的 skills 安裝方式取得。

## 本地開發

在儲存庫中的 `mcsm-cli/` 目錄執行：

```sh
pnpm install
pnpm test
pnpm build
```

### 程式架構

原始碼按責任拆分：

```text
src/
  index.ts                 # 可執行入口：啟動 runCli
  cli/
    program.ts             # createProgram、全域選項與指令註冊
    context.ts             # 設定解析、client 工廠與可注入 stdin
    run.ts                 # 參數解析、最外層錯誤與退出碼
  commands/
    config.ts、overview.ts、daemon.ts、user.ts、mod.ts、schedule.ts、java.ts
    instance/
      index.ts             # 父指令與註冊順序
      configuration.ts     # 查詢、建立、更新與刪除
      lifecycle.ts         # 啟停、主控台指令與日誌
    file/
      index.ts             # 父指令與註冊順序
      read.ts、write.ts、transfer.ts、archive.ts
  client/
    mcsmClient.ts          # HTTP client 與 MCSManager 回應處理
    upload.ts              # upload ticket 與直接 daemon multipart 上傳
    types.ts               # API 型別
  utils/
    paths.ts、validation.ts、pagination.ts、stdin.ts、redaction.ts
  config.ts                # 本機設定、環境變數與設定檔權限
  output.ts                # 文字/JSON 輸出與錯誤格式
```

新增子指令時，放入對應領域模組；新增領域時，在 `cli/program.ts` 註冊。各指令透過 `CLIContext` 取得 client，避免自行維護全域 Commander 狀態。`createProgram()` 每次建立獨立指令樹；組裝、runner 與領域模組在匯入時不解析 argv 或連線，`index.ts` 是會執行 CLI 的入口。

測試可注入 `createClient` 與 `readStdin`，驗證指令解析、API method/path/body/query 與輸出，無需真實面板。測試依設定、工具、client、指令與執行流程分組。

此次重構保留原指令用法與輸出格式，並修正以下行為：

- 網址下載拒絕 IPv6 loopback（例如 `http://[::1]/file`），與既有本機網址限制一致。
- `instance log --size` 對 B、KB、MB 及無單位數值一致套用 100KB 上限；無單位數值沿用 KB。
- `schedule create --count` 僅接受 `-1` 或非負安全整數。預設為 `-1`，`0` 保留；無效值會報錯並以退出碼 1 結束，不送出排程請求。

## 授權

MIT License
