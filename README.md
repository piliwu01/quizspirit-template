# 題靈冒險 QuizSpirit — 教學 RPG 複習網站範本

把教材或題庫做成 RPG 複習遊戲：答題發動招式、養成專屬夥伴、收服題靈、全班共同討伐、雙人 PVP。

這個程式庫同時是 Claude 技能「edu-rpg-review-builder」的本體：`SKILL.md` 是技能說明，`references/` 是各主題的參考文件。

## 內容

| 資料夾 | 用途 |
| --- | --- |
| `assets/quizspirit-template` | 單檔 HTML 自學版：可匯入／切換 JSON 題庫，匯出成一個可離線開啟的 HTML |
| `assets/quizspirit-online-template` | 線上班級版：Cloudflare Workers + D1 + Durable Objects，含老師帳號、夥伴養成、討伐、PVP、投影戰場（120 項測試） |
| `assets/quizspirit-learning-pack` | 錯題本、掌握度、圖鑑稱號模組 |
| `scripts/` | 建立新專案、題庫檢查器 |
| `tools/` | 原創角色產生器（`make_art.py`）與 71 隻題靈名冊（`roster.py`） |
| `references/` | 題庫、夥伴、多人、部署、手冊等參考文件 |

## 快速開始

```bash
# 單檔自學版
node scripts/create-quizspirit-project.mjs ../my-quiz-game
cd ../my-quiz-game && npm install && npm run build && node scripts/export-standalone.mjs

# 線上班級版（本機試玩）
node scripts/create-quizspirit-online-project.mjs ../my-class-game
cd ../my-class-game && npm ci && npm test && npm run dev
```

## 角色與素材

所有題靈角色都是原創，由 `tools/make_art.py` 程式產生（需要 `rsvg-convert`）；配樂由瀏覽器即時合成。不包含任何既有遊戲或動畫作品的角色、名稱或圖片。

## 注意

- 不要把 API 金鑰、帳密檔、`work/`、`.wrangler/`、資料庫備份提交到這個公開程式庫。
- 線上版的 `wrangler.jsonc` 資料庫 ID 是佔位值，正式部署前要換成自己的 D1。
- 自訂登入流程已做功能測試，尚未經獨立安全稽核。
