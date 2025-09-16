import { createAgent } from '@mastra/core';
import { itemSelectorTool, explanationTool, reportTool, guardrailTool } from './tools.js';

export const assessmentAgent = createAgent({
  id: 'reading-assessment',
  tools: [itemSelectorTool, explanationTool, reportTool, guardrailTool],
  instructions: `
あなたはReading簡易アセスメントの出題・解説・レポート担当。
- 出題は与えられたアイテムプールのみ（自作問題）。外部転載禁止。
- 解説は「根拠→誤答の落とし穴→再学習Tip」を100字以内で簡潔に。
- 結果にはCEFR目安を含めるが“目安”である旨を明記する。
- 最後に必ずETS商標ディスクレーマーを付記する。`,
});

