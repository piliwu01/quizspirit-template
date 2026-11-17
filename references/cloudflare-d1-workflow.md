# Cloudflare 部署與資料庫（Claude 版）

適用線上版範本（`assets/quizspirit-online-template`）的 D1、Durable Objects 與正式部署。使用者的帳號、資料庫與金鑰位置記在 `teaching-web-stack` 技能；先讀它，不重問已記錄的資訊。

## 可用工具與狀態核對

1. Cloudflare 走 **cloudfare 連接器**（Cloudflare API 版）：`search` 查端點、`execute` 呼叫 `cloudflare.request()`。工具未載入時先用 ToolSearch 搜尋「cloudfare」。
2. 先用唯讀呼叫確認權限：列出 D1（`GET /accounts/{accountId}/d1/database`）與 Workers（`GET /accounts/{accountId}/workers/scripts`）。401／403 時，錯誤訊息會指出缺少的權限範圍，請使用者到連接器設定重新授權並勾選對應權限，不要自行猜測。
3. 列出結果是空陣列，代表「查詢成功、目前沒有」，不代表已建立。建立、遷移、寫入、部署都要有對應的實際驗證與使用者同意。
4. 不輸出 token、cookie、密碼或備份內容，不把金鑰寫進前端、程式庫或打包檔。需要第三方金鑰時，請使用者存進 Cloudflare Secrets Store，只告訴名稱。

## 本機與雲端是兩回事

- 範本內的 `wrangler.jsonc` 是本機用設定：D1 ID 是佔位值（`00000000-…`），不能直接正式部署。
- 在 Claude 的工作環境可以 `npm ci`、`npm test`、`npm run build`，並用 Miniflare 跑後端測試；這只代表程式正確，不代表雲端已完成。
- 本機老師帳密（`work/本機老師帳密.txt`）只屬於本機資料庫，不能沿用到正式站。

## 正式部署步驟（每一步先徵得同意）

1. **建立正式 D1**：每個遊戲用自己的資料庫（例如 `<遊戲名>-db`，區域 apac），不要和 `teaching-db` 混用，以免資料表衝突。
2. **套用遷移**：依序執行 `migrations/0001.sql` 起的每個檔案（`POST /accounts/{accountId}/d1/database/{uuid}/query`），完成後列出資料表核對。
3. **建置前端**：`npm run build` 產生 `dist/`。
4. **部署 Worker（含靜態檔案與 Durable Objects）**：
   - 靜態檔案：先建立 assets 上傳工作階段（`POST /accounts/{accountId}/workers/scripts/{name}/assets-upload-session`，送出每個檔案的雜湊與大小），依回傳分批上傳，取得完成 JWT。
   - 上傳 Worker（`PUT /accounts/{accountId}/workers/scripts/{name}`，multipart）：`metadata` 帶 `main_module`、`compatibility_date`、`assets: { jwt, config: { not_found_handling: "single-page-application", run_worker_first: ["/api/*"] } }`、D1 綁定 `DB`、Durable Object 綁定 `RAIDS`／`PVPS`，以及 `migrations: { new_tag, new_sqlite_classes: ["RaidRoom","PvpRoom"] }`。
   - 伺服器程式由 `server/worker.js` 匯入其他模組，需要一起上傳，或先用 esbuild 打包成單一模組。
   - 開啟網址：`POST .../workers/scripts/{name}/subdomain`，`{ "enabled": true }`。
   - 這條 API 路徑在使用者的帳號上尚未實際跑通過。第一次做時逐步核對每個回應；若卡住，改請使用者在自己電腦的專案資料夾執行 `npx wrangler login` 與 `npx wrangler deploy`（需先把 `wrangler.jsonc` 的 D1 ID 改成正式資料庫）。
5. **建立正式老師帳號**：用正式站的初始化流程產生隨機初始密碼，只交給使用者本人，首次登入強制改密碼。
6. **上線驗證**：用內建瀏覽器開正式網址，實際登入、答題、開討伐房間，確認 HTTPS 與互動都正常，才說「已上線」。

## 費用與方案

D1、Workers、SQLite 型 Durable Objects 在免費方案都有額度。全班同時使用的討伐與 PVP 會用到 Durable Objects 的請求與時長；上線前說明可能用量，超出免費額度前提醒使用者。R2 在使用者帳號未啟用，範本也不需要。

## 程式碼存放

範本與技能本體放在 GitHub `piliwu01/quizspirit-template`（公開）。新遊戲建立自己的程式庫前先問名稱；push 前確認沒有金鑰、帳密檔、`work/`、`.wrangler/`、`node_modules/`、`dist/`。
