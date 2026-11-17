export const PROGRESS_KEY = 'spirit-chinese.progress.v1';
export function readProgress(storage) {
  try {
    const data = JSON.parse(storage.getItem(PROGRESS_KEY));
    if (data?.version !== 1) return {};
    const records = {};
    for (const [key, r] of Object.entries(data.records || {})) {
      if (r && Number.isInteger(r.attempts) && r.attempts > 0 && typeof r.firstCorrect === 'boolean' && typeof r.lastCorrect === 'boolean') records[key] = r;
    }
    const validSpirit = p => p && Number.isInteger(p.id) && p.id > 0 && typeof p.name === 'string' && typeof p.type === 'string';
    return {records, player: validSpirit(data.player) ? data.player : undefined, captured: Array.isArray(data.captured) ? data.captured.filter(validSpirit) : undefined, streak: Number.isInteger(data.streak) && data.streak >= 0 ? data.streak : 0};
  } catch { return {}; }
}
export function recordAnswer(records, key, correct) {
  const old = records[key];
  return {...records, [key]: {attempts: (old?.attempts || 0) + 1, firstCorrect: old ? old.firstCorrect : correct, lastCorrect: correct, mistakes: (old?.mistakes || 0) + (correct ? 0 : 1)}};
}
export function summarize(bank, records, unit) {
  const pool = bank.questions.filter(q => q.status === 'active' && (!unit || q.unit === unit));
  const seen = pool.map(q => records[`${bank.bankId}:${q.id}`]).filter(Boolean);
  return {total: pool.length, attempted: seen.length, first: seen.filter(r=>r.firstCorrect).length, mastered: seen.filter(r=>r.lastCorrect).length, wrong: seen.filter(r=>!r.lastCorrect).length};
}
