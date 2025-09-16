import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
const baseURL = process.env.OPENAI_BASE_URL; // 互換プロキシ利用時
const modelDefault = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// 実行時に未設定なら後続で明示エラーにする（フォールバックなし方針）
const client = apiKey ? new OpenAI({ apiKey, baseURL }) : null;

export type SkillStat = { skill: string; seen: number; correct: number };

const withRetry = async <T>(fn: () => Promise<T>, tries = 2, delayMs = 600): Promise<T> => {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
};

export const generateExplanation = async (params: {
  item: { stem: string; options: string[]; answer: number };
  correct: boolean;
  selected: number;
}): Promise<string> => {
  if (!client) throw new Error('OPENAI_API_KEY is not set');
  const { item, correct, selected } = params;
  const sys = 'あなたは英語読解の解説者です。日本語で100字以内、簡潔に。「根拠→誤答の落とし穴→Tip」の順で書いてください。';
  const user = `問題: ${item.stem}\n選択肢: ${item.options.map((o, i) => `${i+1}. ${o}`).join(' / ')}\n選択: ${selected+1}\n正解: ${item.answer+1}\n正誤: ${correct ? '正解' : '不正解'}`;
  const res = await withRetry(() => client.chat.completions.create({
    model: modelDefault,
    temperature: 0.2,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user }
    ]
  }, { timeout: 12000 }));
  return res.choices[0]?.message?.content?.trim() || '';
};

export const generateAdvice = async (params: {
  scaled: number;
  cefr: string;
  skillStats: SkillStat[];
}): Promise<{ skill: string; note: string }[]> => {
  if (!client) throw new Error('OPENAI_API_KEY is not set');
  const { scaled, cefr, skillStats } = params;
  const sys = 'あなたは英語学習アドバイザーです。日本語で、学習者がすぐ行動できる助言を返してください。出力は必ずJSON配列。各要素は {"skill":"…","note":"…"}。noteは全角60字以内で、具体的な手順（例: 1語句、1操作）を含めること。凡庸な一般論は禁止。弱点の理由や対処を短く示し、できれば正答率(%)を含める。';
  const user = `暫定Reading=${scaled}点、CEFR目安=${cefr}。スキル統計（seen/correct）：${JSON.stringify(skillStats)}。正答率の低い順に上位3件へ、具体的な改善行動を提案してください（例: 「前置詞の直後の名詞をハイライト→語法辞典で確認」）。`;
  const res = await withRetry(() => client.chat.completions.create({
    model: modelDefault,
    temperature: 0.3,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user }
    ]
  }, { timeout: 15000 }));
  const content = res.choices[0]?.message?.content || '[]';
  const cleaned = stripCodeFence(content);
  const json = extractJSONArray(cleaned);
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed.slice(0, 5);
    if (Array.isArray((parsed as any).items)) return (parsed as any).items.slice(0, 5);
  } catch (e) {
    console.error('Advice JSON parse error. content=', content);
    throw new Error('LLM応答のJSON解析に失敗しました');
  }
  return [];
};

const stripCodeFence = (s: string) => s.replace(/^```[a-zA-Z]*\n/, '').replace(/```\s*$/m, '').trim();
const extractJSONArray = (s: string) => {
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start >= 0 && end >= 0 && end > start) return s.slice(start, end + 1);
  return s;
};

export const generateRichInsights = async (params: {
  scaled: number;
  cefr: string;
  topSkills: Array<{
    key: string;
    label: string;
    meaning: string;
    read: string;
    practice: string[];
    examples: number[]; // question numbers
    seen: number;
    correct: number;
    acc: number; // 0..1
  }>;
}): Promise<Array<{ key: string; label: string; meaning: string; read: string; practice: string[]; examples: number[] }>> => {
  if (!client) throw new Error('OPENAI_API_KEY is not set');
  const { scaled, cefr, topSkills } = params;
  const sys = `あなたは英語学習アドバイザーです。出力は必ずJSON配列のみで、各要素は {"key","label","meaning","read","practice","examples"} を含めてください。日本語で、用語は中学生にも分かる表現にします。practiceは2-4個、具体的な行動を書きます。examplesは与えられた設問番号の配列をそのまま返すだけ。`;
  const user = `学習者の暫定Reading=${scaled}点、CEFR目安=${cefr}。弱点候補スキルと補助情報は次の通り（正答率の低い順、最大3件）。
${JSON.stringify(topSkills, null, 2)}
これをもとに、各スキルについて「意味」「読み取りのコツ（read）」「practice（具体的行動）」を簡潔にまとめ、JSON配列のみで返してください。凡庸な一般論は避け、与えられたmeaning/readをベースに語尾や表現を整えてください。`;

  const res = await withRetry(() => client.chat.completions.create({
    model: modelDefault,
    temperature: 0.3,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
  }, { timeout: 18000 }));

  const content = res.choices[0]?.message?.content || '[]';
  const cleaned = stripCodeFence(content);
  const json = extractJSONArray(cleaned);
  const parsed = JSON.parse(json);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray((parsed as any).items)) return (parsed as any).items;
  return [];
};
