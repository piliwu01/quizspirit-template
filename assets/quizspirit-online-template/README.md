# QuizSpirit 帳號與多人遊戲範本

來源：2026-11-10 本機驗證的 4.1.0 版本。包含固定夥伴養成、收服選角、班級討伐、道具商店與雙人 PVP；不是單檔 HTML。

需先安裝 Node.js 與 npm。在此資料夾執行 npm ci，再執行 npm test、npm run build。Windows 可雙擊「啟動網站.cmd」，其他系統執行 npm run dev 啟動本機服務；預設 http://127.0.0.1:8788，若已有服務使用此連接埠，先處理衝突。第一次啟動會建立本機 D1 資料與隨機老師初始密碼，保存在 work/本機老師帳密.txt，首次登入須改密碼。每個複本產生自己的帳號，範本沒有既有帳密或學生資料。

wrangler.jsonc 的 D1 ID 是佔位值，只可直接用於本機流程。公開使用前另行確認帳號、資料庫、費用、權限、正式遷移與部署範圍；不要直接套用本機老師帳號至正式站。自訂登入流程已做功能測試，尚未經獨立安全稽核。

不要分享 work、.wrangler、環境變數、cookie、資料庫備份或帳密檔。角色圖由 tools/make_art.py 程式產生，為原創素材；配樂由瀏覽器即時合成。換成其他圖片或音樂前，先確認有公開使用的權利。

正式部署見技能 references/cloudflare-d1-workflow.md。規則與注意事項見技能 references/quizspirit-companion.md、quizspirit-multiplayer.md；程式是實際行為的依據。修改題庫仍需教師審題，別把所有提案當成已完成功能。

4.1.0 加入老師完整投影戰場與學生精簡答題畫面：全班角色固定站位、姓名出招、技能道具特效、滿版備援與減少動態。詳見技能 references/quizspirit-projector-battlefield.md。沿用既有角色整圖動畫，不含逐格動作素材。來源案例通過 120 項測試，仍需於新副本重測。
