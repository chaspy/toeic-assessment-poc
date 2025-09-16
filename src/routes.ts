import express from 'express';
import { z } from 'zod';
import { loadItems, selectBlueprint20 } from './items.js';
import { createSession, getSession, nextItemFor, recordAnswer, markFinished } from './session.js';
import { AnswerSchema, ProvisionalCI, cefrFromReading, scaleReading } from './scoring.js';
import { logEvent, saveResultJson } from './telemetry.js';
import { ETS_DISCLAIMER, type Item } from './types.js';
import { reportTool } from './mastra/tools.js';
import { buildFriendlyInsights, aggregateSkillStats } from './services/logic.js';
import { generateRichInsights } from './llm.js';

export const router = express.Router();

const pool = loadItems();

router.post('/v1/assessment/start', (req, res) => {
  const items: Item[] = selectBlueprint20(pool);
  const s = createSession(items);
  logEvent(s.id, 'assessment_started', { ua: req.headers['user-agent'] || '' });
  res.json({ sessionId: s.id, items });
});

router.post('/v1/assessment/answer', (req, res) => {
  const parsed = AnswerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { sessionId, itemId, selected, rtMs } = parsed.data;
  const s = getSession(sessionId);
  if (!s) return res.status(404).json({ error: 'session not found' });
  const item = s.items.find((i) => i.id === itemId);
  if (!item) return res.status(400).json({ error: 'invalid itemId' });
  const correct = selected === item.answer;
  recordAnswer(sessionId, {
    sessionId,
    itemId,
    selected,
    correct,
    rtMs,
    ts: Date.now(),
  });
  logEvent(sessionId, 'answer_submitted', { itemId, selected, correct, rtMs });
  const next = nextItemFor(sessionId);
  res.json({ nextItem: next || null });
});

router.post('/v1/assessment/finish', async (req, res) => {
  const SessionSchema = z.object({ sessionId: z.string() });
  const p = SessionSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const { sessionId } = p.data;
  const s = getSession(sessionId);
  if (!s) return res.status(404).json({ error: 'session not found' });
  const rawCorrect = s.answers.filter((a) => a.correct).length;
  const scaled = scaleReading(rawCorrect);
  const cefr = cefrFromReading(scaled);

  // 学習アドバイス（OpenAI使用）
  let advice;
  try {
    advice = await reportTool.execute({ input: { sessionId } });
  } catch (e: any) {
    console.error('Advice generation failed:', e);
    return res.status(502).json({ error: 'advice_generation_failed', message: e?.message || String(e) });
  }

  // 各設問の解説は固定（事前生成）を使用し、動的生成はしない
  const responses: Array<{
    itemId: string;
    part: string;
    stem: string;
    options: string[];
    answer: number;
    selected: number | null;
    correct: boolean | null;
    explanation?: string;
    rationales?: string[];
  }> = s.items.map((item) => {
    const a = s.answers.find((x) => x.itemId === item.id);
    return {
      itemId: item.id,
      part: item.part,
      stem: item.stem,
      options: item.options,
      answer: item.answer,
      selected: a ? a.selected : null,
      correct: a ? a.correct : null,
      explanation: (item as any).explanation || '',
      rationales: (item as any).rationales || []
    };
  });

  const result = {
    raw_correct: rawCorrect,
    scaled_reading: scaled,
    provisional_ci: ProvisionalCI(scaled),
    cefr,
    insights: advice.advice,
    disclaimer: ETS_DISCLAIMER,
    responses,
  } as const;

  markFinished(sessionId, result);
  logEvent(sessionId, 'assessment_finished', { raw: rawCorrect, scaled, cefr, durationMs: (Date.now() - s.createdAt) });
  saveResultJson(sessionId, result);
  res.json(result);
});

// LLMなしで即時にスコア/回答/解説のみ返す（所見は別API）
router.post('/v1/assessment/finish-lite', async (req, res) => {
  const SessionSchema = z.object({ sessionId: z.string() });
  const p = SessionSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const { sessionId } = p.data;
  const s = getSession(sessionId);
  if (!s) return res.status(404).json({ error: 'session not found' });
  const rawCorrect = s.answers.filter((a) => a.correct).length;
  const scaled = scaleReading(rawCorrect);
  const cefr = cefrFromReading(scaled);
  const responses = s.items.map((item) => {
    const a = s.answers.find((x) => x.itemId === item.id);
    return {
      itemId: item.id,
      part: item.part,
      stem: item.stem,
      options: item.options,
      answer: item.answer,
      selected: a ? a.selected : null,
      correct: a ? a.correct : null,
      explanation: (item as any).explanation || '',
      rationales: (item as any).rationales || [],
    };
  });
  const result = {
    raw_correct: rawCorrect,
    scaled_reading: scaled,
    provisional_ci: ProvisionalCI(scaled),
    cefr,
    insights: [],
    disclaimer: ETS_DISCLAIMER,
    responses,
  } as const;
  markFinished(sessionId, result);
  logEvent(sessionId, 'assessment_finished', { raw: rawCorrect, scaled, cefr, durationMs: (Date.now() - s.createdAt) });
  saveResultJson(sessionId, result);
  res.json(result);
});

// 所見だけを別途生成（OpenAI）。失敗時は502。
router.post('/v1/assessment/insights', async (req, res) => {
  const SessionSchema = z.object({ sessionId: z.string() });
  const p = SessionSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const { sessionId } = p.data;
  const s = getSession(sessionId);
  if (!s) return res.status(404).json({ error: 'session not found' });
  // 個別最適な所見（LLM）: スキル統計→上位3件のメタ情報を渡し、JSONで返してもらう
  try {
    const stats = aggregateSkillStats(s.items, s.answers);
    const indexById = new Map(s.items.map((it, i) => [it.id, i + 1] as const));
    // 間違いが多い順（同率なら任意）。seen>=1 を対象、上位3件
    const ranked = stats
      .map((st) => ({ ...st, acc: st.seen ? st.correct / st.seen : 0 }))
      .sort((a, b) => a.acc - b.acc)
      .slice(0, 3);
    // 日本語メタ（意味/コツ/練習）を付与し、誤答の関連設問番号を添える
    const friendly = buildFriendlyInsights(s.items, s.answers);
    const friendlyByKey = new Map(friendly.map((f: any) => [f.key, f] as const));
    const topSkills = ranked.map((r) => {
      const f = friendlyByKey.get(r.skill) || {} as any;
      return {
        key: r.skill,
        label: f.label || r.skill,
        meaning: f.meaning || '',
        read: f.read || '',
        practice: Array.isArray(f.practice) ? f.practice : [],
        examples: Array.isArray(f.examples) ? f.examples : [],
        seen: r.seen,
        correct: r.correct,
        acc: r.acc,
      };
    });

    const rawCorrect = s.answers.filter((a) => a.correct).length;
    const scaledScore = scaleReading(rawCorrect);
    const cefr = cefrFromReading(scaledScore);
    const llm = await generateRichInsights({ scaled: scaledScore, cefr, topSkills });
    res.json({ insights: llm });
  } catch (e: any) {
    console.error('LLM insights failed:', e);
    return res.status(502).json({ error: 'insights_generation_failed', message: e?.message || String(e) });
  }
});

router.get('/v1/assessment/result/:sessionId', (req, res) => {
  const s = getSession(req.params.sessionId);
  if (!s || !s.result) return res.status(404).json({ error: 'not found' });
  res.json(s.result);
});
