export type Part = 'R5' | 'R7';

export interface Item {
  id: string;
  part: Part;
  stem: string;
  options: string[];
  answer: number; // index in options
  skills: string[]; // e.g., ['grammar:verb-agreement']
  difficulty: number; // 0..1
  time_limit_sec: number;
  explanation?: string; // 固定問題なら事前解説
  rationales?: string[]; // 各選択肢の解説（optionsと同じ長さ）
}

export interface StartResponse {
  sessionId: string;
  items: Item[];
}

export interface AnswerEvent {
  sessionId: string;
  itemId: string;
  selected: number;
  correct: boolean;
  rtMs: number;
  ts: number;
}

export interface SkillStat {
  skill: string;
  seen: number;
  correct: number;
}

export interface ResultPayload {
  raw_correct: number;
  scaled_reading: number;
  provisional_ci: [number, number];
  cefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'Below A1';
  insights: { skill: string; note: string }[];
  disclaimer: string;
  responses?: Array<{
    itemId: string;
    part: Part;
    stem: string;
    options: string[];
    answer: number;
    selected: number | null;
    correct: boolean | null;
    explanation?: string;
  }>;
}

export const ETS_DISCLAIMER =
  'TOEIC is a registered trademark of ETS. This product is not endorsed or approved by ETS.';
