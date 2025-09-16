import { z } from 'zod';

export const clamp = (min: number, max: number, v: number) => Math.max(min, Math.min(max, v));

// 四捨五入ではなく「5点刻みで切り上げ」に変更（合意事項）
export const scaleReading = (rawCorrect: number): number => {
  const raw = clamp(0, 20, Math.floor(rawCorrect));
  const scaledSteps = Math.ceil(((raw / 20) * 490) / 5); // 0..98
  const scaled = 5 + scaledSteps * 5; // 5..495
  return clamp(5, 495, scaled);
};

export const cefrFromReading = (scaled: number) => {
  if (scaled >= 455) return 'C1' as const;
  if (scaled >= 385) return 'B2' as const;
  if (scaled >= 275) return 'B1' as const;
  if (scaled >= 115) return 'A2' as const;
  if (scaled >= 60) return 'A1' as const;
  return 'Below A1' as const;
};

export const ProvisionalCI = (scaled: number): [number, number] => [clamp(5, 495, scaled - 60), clamp(5, 495, scaled + 60)];

export const AnswerSchema = z.object({
  sessionId: z.string(),
  itemId: z.string(),
  selected: z.number().int().min(0),
  rtMs: z.number().int().nonnegative(),
});

