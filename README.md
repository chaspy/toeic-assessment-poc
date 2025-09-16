# TOEIC Reading 簡易アセスメント PoC

TypeScript + Express + Mastra（ツール駆動）で動作する20問・≤10分のReading簡易アセスメントのPoCです。

## 要件の反映
- 出題配分: R5×12 / R7×8（自作アイテムのみ、`data/items/pool.json`）
- 採点: 素点→暫定スケール（5点刻み「切り上げ」）→ 5–495
- CEFRマッピング: A1/A2/B1/B2/C1（目安表示）
- 擬似CI: ±60点（固定幅）
- 同意UI・注意書き・商標ディスクレーマー: `docs/copy.md` 参照
- テレメトリ: CSV（`data/logs/events.csv`）

## 使い方
1. 依存準備（Node.js 20+ が必要）
2. 環境変数を設定（レポート生成でOpenAIを使用します）
   - `export OPENAI_API_KEY=...`
3. 開発起動: `npm run dev`（または `PORT=3051 npm run dev`）

エンドポイント:
- `POST /v1/assessment/start` → `{ sessionId, items }`
- `POST /v1/assessment/answer` ← `{ sessionId, itemId, selected, rtMs }` → `{ nextItem|null }`
- `POST /v1/assessment/finish` ← `{ sessionId }` → 結果JSON
- `GET  /v1/assessment/result/:sessionId` → 再表示

## ディレクトリ
- `src/` サーバ/ロジック（TypeScript）
- `data/items/pool.json` アイテムプール（自作）
- `data/logs/` CSV/結果JSON出力
- `docs/` 文言/テスト観点

## 注意
- 本PoCは社内デモ用途です。公式問題の流用禁止。
- 商標表記: TOEICはETSの登録商標です。本製品はETSによる承認・推奨を受けていません。
 - LLM失敗時はフォールバックせずエラーで終了します（仕様）。
