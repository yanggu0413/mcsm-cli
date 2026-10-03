# Changelog

## 1.1.0

### Changed

- 將 CLI 拆分為獨立的組裝、執行上下文、領域指令與共用工具模組；既有指令與 JSON 輸出格式保持相容。
- 分離直接 daemon 上傳流程，保留 `MCSMClient.uploadFile` 介面與 upload ticket 傳輸方式。
- 每次建立 CLI 時使用獨立的 Commander 指令樹，並補齊指令解析、API 請求與錯誤處理的回歸測試。
- 明確宣告 Node.js `>=22.12.0`，與現有 Commander 15 的需求一致。
- npm 打包前清理並重新建置，發布前執行測試；套件包含 MIT 授權與本變更紀錄。

### Fixed

- 網址下載驗證拒絕 IPv6 loopback（例如 `http://[::1]/file`）。
- `instance log --size` 對 B、KB、MB 及無單位數值一致套用 100KB 上限；無單位沿用 KB。
- `schedule create --count` 僅接受 `-1` 或非負安全整數，無效值不再以 `null` 送至 API。

## 1.0.2

- 前一個 npm 發布版本；1.1.0 保留其現有命令列用法，並修正上述參數驗證缺陷。
