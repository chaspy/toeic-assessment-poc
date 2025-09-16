// Mastra Tools 雛形（当面はローカル関数で完結。LLM接続は後日）
import { createTool } from '@mastra/core';
import { nextItemFor, getSession } from '../session.js';
import { disclaimer } from '../services/logic.js';
import { generateAdvice, generateExplanation } from '../llm.js';
import { scaleReading, cefrFromReading } from '../scoring.js';

export const itemSelectorTool = createTool({
  id: 'item-selector',
  description: 'Return next item for a session',
  inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] },
  execute: async ({ input }) => {
    return nextItemFor(input.sessionId);
  },
});

export const explanationTool = createTool({
  id: 'explain',
  description: 'Generate short explanation for an item',
  inputSchema: {
    type: 'object',
    properties: { item: { type: 'object' }, correct: { type: 'boolean' }, selected: { type: 'number' } },
    required: ['item', 'correct', 'selected'],
  },
  execute: async ({ input }) => {
    if (input.item && input.item.explanation) {
      return { text: input.item.explanation };
    }
    const text = await generateExplanation({ item: input.item, correct: input.correct, selected: input.selected });
    return { text };
  },
});

export const reportTool = createTool({
  id: 'report',
  description: 'Generate learning advice from result',
  inputSchema: {
    type: 'object',
    properties: { sessionId: { type: 'string' } },
    required: ['sessionId'],
  },
  execute: async ({ input }) => {
    const s = getSession(input.sessionId);
    if (!s) throw new Error('session not found');
    const byId = new Map(s.items.map((i) => [i.id, i] as const));
    const stats = new Map<string, { skill: string; seen: number; correct: number }>();
    for (const a of s.answers) {
      const it = byId.get(a.itemId);
      if (!it) continue;
      for (const sk of it.skills) {
        const cur = stats.get(sk) || { skill: sk, seen: 0, correct: 0 };
        cur.seen += 1;
        if (a.correct) cur.correct += 1;
        stats.set(sk, cur);
      }
    }
    const raw = s.answers.filter((a) => a.correct).length;
    const scaled = scaleReading(raw);
    const cefr = cefrFromReading(scaled);
    const advice = await generateAdvice({ scaled, cefr, skillStats: Array.from(stats.values()) });
    return { advice };
  },
});

export const guardrailTool = createTool({
  id: 'guardrail',
  description: 'Append ETS trademark disclaimer',
  inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  execute: async ({ input }) => ({ text: `${input.text}\n\n${disclaimer}` }),
});
