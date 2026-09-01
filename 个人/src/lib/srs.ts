/**
 * SM-2 间隔重复算法 (Anki 同款简化版)
 * 纯函数, 无 IO, 便于单测
 */

export interface SrsState {
  easeFactor: number; // 1.3 - 2.8
  intervalDays: number;
  repetitions: number;
}

export interface SrsResult extends SrsState {
  dueAt: Date;
}

export const SRS_MIN_EASE = 1.3;
export const SRS_MAX_EASE = 2.8;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 一次复习后的状态转移.
 * quality: 0-5 (5=轻松答对 ... 0=完全不会); <3 视为答错, 重置进度
 */
export function reviewSm2(state: SrsState, quality: number, now: Date = new Date()): SrsResult {
  const q = Math.max(0, Math.min(5, Math.round(quality)));

  // 答错: 重置
  if (q < 3) {
    const ef = Math.max(SRS_MIN_EASE, state.easeFactor - 0.2);
    return {
      easeFactor: ef,
      intervalDays: 1,
      repetitions: 0,
      dueAt: new Date(now.getTime() + DAY_MS),
    };
  }

  // 答对: 更新 EF (SM-2 公式)
  const efDelta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  const easeFactor = Math.min(
    SRS_MAX_EASE,
    Math.max(SRS_MIN_EASE, +(state.easeFactor + efDelta).toFixed(3)),
  );

  const repetitions = state.repetitions + 1;
  let intervalDays: number;
  if (repetitions === 1) intervalDays = 1;
  else if (repetitions === 2) intervalDays = 6;
  else intervalDays = Math.round(state.intervalDays * easeFactor);

  return {
    easeFactor,
    intervalDays,
    repetitions,
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS),
  };
}

/**
 * 拼写判定: 正确 / 接近 (大小写、空格、末尾单复数 -s/-es 差异) / 错误
 * 返回 SM-2 quality 映射: 正确=5, 接近=3, 错误=1
 */
export function judgeSpell(input: string, answer: string): { verdict: 'correct' | 'near' | 'wrong'; quality: number } {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const a = norm(answer);
  const b = norm(input);
  if (b === a) return { verdict: 'correct', quality: 5 };
  // 词形变化 (复数/三单/过去式/进行式) 或连字符/空格差异算"接近"
  const variants = (s: string) => new Set([s, s + 's', s + 'es', s + 'ing', s.replace(/e$/, ''), s.replace(/e$/, '') + 'ing', s.replace(/y$/, 'ies')]);
  const squash = (s: string) => s.replace(/[\s-]/g, '');
  if (b && (variants(a).has(b) || variants(b).has(a) || squash(b) === squash(a))) {
    return { verdict: 'near', quality: 3 };
  }
  return { verdict: 'wrong', quality: 1 };
}
