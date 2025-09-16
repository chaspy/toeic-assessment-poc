# テスト観点（暫定）

## 手動確認
- 素点 10/20 → `scaled_reading = 5 + ceil((10/20)*490/5)*5 = 255`、CEFR=A2。
- 素点 15/20 → `scaled_reading = 5 + ceil((15/20)*490/5)*5 = 380`、CEFR=B1。
- 素点 20/20 → `scaled_reading = 495`、CEFR=C1。
- 境界テスト（目安切替）: 60/115/275/385/455 近傍の表示が切り替わること。
- 結果JSONに `provisional_ci` が ±60 点幅で入ること。
- ディスクレーマー文言が含まれること。

## APIフロー
1. `POST /v1/assessment/start` で sessionId と 20問が返る。
2. 20回 `POST /v1/assessment/answer` を行い、最終で `nextItem: null` になる。
3. `POST /v1/assessment/finish` → スコア/CEFR/所見/免責が返る。
4. `GET /v1/assessment/result/:sessionId` で同一結果が再取得できる。

## テレメトリ
- `data/logs/events.csv` に `assessment_started`, `answer_submitted`, `assessment_finished` が記録される。

