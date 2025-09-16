import { v4 as uuidv4 } from 'uuid';
import type { Item, AnswerEvent } from './types.js';

type Session = {
  id: string;
  items: Item[];
  answers: AnswerEvent[];
  createdAt: number;
  finishedAt?: number;
  result?: any;
};

const sessions = new Map<string, Session>();

export const createSession = (items: Item[]) => {
  const id = uuidv4();
  const s: Session = { id, items, answers: [], createdAt: Date.now() };
  sessions.set(id, s);
  return s;
};

export const getSession = (id: string) => sessions.get(id);

export const recordAnswer = (sessionId: string, ev: AnswerEvent) => {
  const s = sessions.get(sessionId);
  if (!s) throw new Error('Session not found');
  // 同一 itemId の回答がすでにあれば置換（最後の選択を有効とする）
  const idx = s.answers.findIndex((a) => a.itemId === ev.itemId);
  if (idx >= 0) s.answers[idx] = ev; else s.answers.push(ev);
  return s;
};

export const nextItemFor = (sessionId: string) => {
  const s = sessions.get(sessionId);
  if (!s) throw new Error('Session not found');
  const answered = new Set(s.answers.map((a) => a.itemId));
  return s.items.find((i) => !answered.has(i.id)) || null;
};

export const markFinished = (sessionId: string, result: any) => {
  const s = sessions.get(sessionId);
  if (!s) throw new Error('Session not found');
  s.finishedAt = Date.now();
  s.result = result;
  return s;
};
