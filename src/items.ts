import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import type { Item } from './types.js';

const ItemSchema = z.object({
  id: z.string(),
  part: z.union([z.literal('R5'), z.literal('R7')]),
  stem: z.string(),
  options: z.array(z.string()).min(2),
  answer: z.number().int().nonnegative(),
  skills: z.array(z.string()),
  difficulty: z.number().min(0).max(1),
  time_limit_sec: z.number().int().positive(),
  explanation: z.string().optional(),
  rationales: z.array(z.string()).optional(),
});

export const loadItems = (): Item[] => {
  const file = path.join(process.cwd(), 'data', 'items', 'pool.json');
  const raw = fs.readFileSync(file, 'utf-8');
  const arr = JSON.parse(raw);
  const parsed = z.array(ItemSchema).parse(arr);
  return parsed as Item[];
};

export const selectBlueprint20 = (pool: Item[]): Item[] => {
  const r5 = pool.filter((i) => i.part === 'R5').slice(0, 12);
  const r7 = pool.filter((i) => i.part === 'R7').slice(0, 8);
  return [...r5, ...r7];
};
