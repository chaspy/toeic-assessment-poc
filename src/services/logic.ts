import type { AnswerEvent, Item } from '../types.js';

export const aggregateSkillStats = (items: Item[], answers: AnswerEvent[]) => {
  const byId = new Map(items.map((i) => [i.id, i] as const));
  const stats = new Map<string, { skill: string; seen: number; correct: number }>();
  for (const a of answers) {
    const it = byId.get(a.itemId);
    if (!it) continue;
    for (const sk of it.skills) {
      const cur = stats.get(sk) || { skill: sk, seen: 0, correct: 0 };
      cur.seen += 1;
      if (a.correct) cur.correct += 1;
      stats.set(sk, cur);
    }
  }
  return Array.from(stats.values()).sort((x, y) => (x.seen ? x.correct / x.seen : 0) - (y.seen ? y.correct / y.seen : 0));
};

export const makeInsights = (skillStats: { skill: string; seen: number; correct: number }[]) => {
  const notes: { skill: string; note: string }[] = [];
  for (const s of skillStats.slice(0, 3)) {
    const acc = s.seen ? Math.round((s.correct / s.seen) * 100) : 0;
    let tip = '';
    if (s.skill.startsWith('grammar')) tip = '文構造を短く区切って主述一致を確認しましょう。';
    else if (s.skill.startsWith('vocab')) tip = '前後の語からコロケーションを推測し、選択肢の品詞を照合しましょう。';
    else if (s.skill.startsWith('inference')) tip = '設問語の言い換えに注目し、根拠文を精読しましょう。';
    else tip = 'キーワードを特定して根拠文へ戻る癖を付けましょう。';
    notes.push({ skill: s.skill, note: `正答率${acc}%。${tip}` });
  }
  if (notes.length === 0) {
    notes.push({ skill: 'general', note: '読みの足場（主語・動詞・修飾）を先に把握しましょう。' });
  }
  return notes;
};

export const disclaimer =
  'TOEIC is a registered trademark of ETS. This product is not endorsed or approved by ETS.';

// 使いやすい日本語ラベルと説明（スキルコード→表示用）
const SKILL_META: Record<string, { label: string; meaning: string; read: string; practice: string[] }> = {
  'grammar:preposition': {
    label: '前置詞の使い分け',
    meaning: '時間・場所・目的などに応じて前置詞を選ぶ力',
    read: '名詞句の直前に注目し、on(日付/曜日)・in(期間/時間帯)・at(時刻/地点)のように意味領域で当てる',
    practice: ['前置詞＋名詞の例を10個集める', 'on/in/at のコアイメージを図で確認', '過去問で前置詞の根拠語をハイライト'],
  },
  'grammar:tense': {
    label: '時制の一致',
    meaning: '文全体の時間軸に合わせて動詞の形を選ぶ力',
    read: '時を示す表現（yesterday, by Friday, was …など）を拾い、主節と従属節の時制を揃える',
    practice: ['出来事の時系列を線で描く', '主節と従属節を色分け', '時制ごとの例文を音読'],
  },
  'grammar:voice': {
    label: '受動態の理解',
    meaning: '受け身（be + 過去分詞）の用法を判断する力',
    read: '「誰が何をする/されるか」を主語と動詞で確認し、能動/受動どちらが自然か比べる',
    practice: ['能動→受動に書き換え練習を10問', '取扱説明書の文を観察（受動が多い）'],
  },
  'grammar:countability': {
    label: '可算/不可算名詞',
    meaning: '名詞が数えられるかどうかを判断する力',
    read: '数詞/冠詞(a, an, many)が付くかを確認し、information/feedback など不可算を暗記',
    practice: ['不可算名詞リストの暗記', '可算/不可算を交互に言い換え'],
  },
  'grammar:part-of-speech': {
    label: '品詞の一致',
    meaning: '空所に入る語の品詞を文構造から決める力',
    read: '冠詞の後=形容詞/名詞、動詞の直後=副詞など、位置と役割で品詞を判定',
    practice: ['品詞置換のミニドリル', '文の骨格(S/V/O)に下線を引く'],
  },
  'grammar:verb-agreement': {
    label: '主述一致',
    meaning: '主語の数に合わせて動詞の形を選ぶ力',
    read: '主語を特定→単/複を判断→動詞に三単現 -s などを付ける',
    practice: ['主語に丸→動詞に四角で対応付け', '頻出の仮主語/複合主語の扱い確認'],
  },
  'vocab:word-choice': {
    label: '語彙選択',
    meaning: '文脈に合う語を近義語から選ぶ力',
    read: '直前直後のコロケーション（相性語）を拾い、辞書の用例で用法を確認',
    practice: ['紛らわしい語の対リストを作る', '例文を1語入替で音読'],
  },
  'vocab:paraphrase': {
    label: '言い換え（パラフレーズ）',
    meaning: '同じ意味を別の語句で表した文を対応付ける力',
    read: '設問語と本文の言い換え語（類義語/反意語/派生語）を線で結ぶ',
    practice: ['類義語で1文を2通りに言い換え', '設問語→本文語の対リスト作成'],
  },
  'vocab:collocation': {
    label: 'コロケーション',
    meaning: 'よく一緒に使われる語の組合せを知る力',
    read: '動詞＋名詞/形容詞＋名詞などの頻出ペアを暗記して即断する',
    practice: ['業務メールから頻出ペアを収集', 'ペアの穴埋め練習を自作'],
  },
  'inference:detail': {
    label: '詳細読み取り',
    meaning: '短文の具体情報（日時/場所/数量等）を正確につかむ力',
    read: '固有名詞・数字・日付などをマーキングし、該当文と選択肢を1対1で照合',
    practice: ['短文から数字/固有名詞のみ抜き出す訓練', '根拠文に番号を振る'],
  },
  'inference:main-purpose': {
    label: '主旨把握',
    meaning: '文書全体の目的（依頼/告知/意図）をつかむ力',
    read: '冒頭/末尾の目的語句に着目し、具体例は補足と割り切る',
    practice: ['メールの1文要約を毎日1件', '段落のトピックセンテンスに印'],
  },
  'inference:time': {
    label: '時間関係の把握',
    meaning: '予定変更・締切などの時刻/日付の変化を追う力',
    read: 'from A to B / by / until の語に下線を引いて前後で比較',
    practice: ['時刻表現だけを集めて対訳', '変更前→後のメモを作る'],
  },
  'inference:condition': {
    label: '条件把握',
    meaning: '〜すれば…の条件・例外を見抜く力',
    read: 'if/unless/必要条件系の助動詞に反応し、条件節と帰結節を分解',
    practice: ['条件節に[if]付箋を貼る練習', '例外表現(except/unless)のリスト化'],
  },
  'inference:goal': {
    label: '目的の読み取り',
    meaning: '方針・導入の目的語句（to/for）を捉える力',
    read: 'to 不定詞/for + 名詞 の目的句を検出して言い換えを探す',
    practice: ['目的句と結果句を2色で塗り分け', '目的→手段の対応表を作る'],
  },
  'inference:sentiment': {
    label: '評価の読み取り',
    meaning: 'レビュー等で肯定/否定/改善点を見分ける力',
    read: 'but/however など逆接後の評価に注目し、長所短所を2列で整理',
    practice: ['レビューを長所/短所に分けて要約', '逆接後の主張を抽出する訓練'],
  },
};

const humanizeSkill = (key: string) => {
  return (
    SKILL_META[key] ||
    SKILL_META[key.split(':')[0] + ':' + key.split(':')[1]] || {
      label: '読解力全般',
      meaning: '文の構造と語の働きを捉える力',
      read: '主語・動詞・目的語を先に見つけ、修飾は後から足す',
      practice: ['1文をS/V/O/Mに分解', '接続語で論理展開を追う'],
    }
  );
};

export const buildFriendlyInsights = (items: Item[], answers: AnswerEvent[]) => {
  const stats = aggregateSkillStats(items, answers); // 既存の関数を活用
  // 間違いの多い順に上位3件
  const ranked = stats
    .map((s) => ({ ...s, acc: s.seen ? s.correct / s.seen : 0 }))
    .sort((a, b) => a.acc - b.acc)
    .slice(0, 3);

  // 関連設問（誤答のあった設問番号）
  const indexById = new Map(items.map((it, i) => [it.id, i + 1] as const));
  const wrongBySkill = new Map<string, number[]>();
  for (const a of answers) {
    if (!a || a.correct) continue;
    const it = items.find((x) => x.id === a.itemId);
    if (!it) continue;
    for (const sk of it.skills) {
      const arr = wrongBySkill.get(sk) || [];
      arr.push(indexById.get(it.id) || 0);
      wrongBySkill.set(sk, arr);
    }
  }

  return ranked.map((s) => {
    const meta = humanizeSkill(s.skill);
    const examples = (wrongBySkill.get(s.skill) || []).slice(0, 5).sort((a, b) => a - b);
    return {
      key: s.skill,
      label: meta.label,
      meaning: meta.meaning,
      read: meta.read,
      practice: meta.practice,
      examples,
    };
  });
};

