export const GROWTH_KEY = 'quizspirit.growth.v1';
export const MAX_XP = 9900;
export const STARTERS = [
  [{ id: 25, name: 'Zappip', zhName: '雷啾啾', type: 'electric', gen: 1, at: 1 }, { id: 26, name: 'Voltail', zhName: '霆尾獸', type: 'electric', gen: 1, at: 100 }],
  [{ id: 1, name: 'Sproutle', zhName: '芽芽獸', type: 'grass', gen: 1, at: 1 }, { id: 2, name: 'Vinemoss', zhName: '藤蔓獸', type: 'grass', gen: 1, at: 50 }, { id: 3, name: 'Grovecrown', zhName: '森冠獸', type: 'grass', gen: 1, at: 100 }],
  [{ id: 4, name: 'Embkit', zhName: '焰狐仔', type: 'fire', gen: 1, at: 1 }, { id: 5, name: 'Blazefox', zhName: '炎尾狐', type: 'fire', gen: 1, at: 50 }, { id: 6, name: 'Pyrelord', zhName: '赤焰狐王', type: 'fire', gen: 1, at: 100 }],
  [{ id: 7, name: 'Ripplet', zhName: '浪蝌蝌', type: 'water', gen: 1, at: 1 }, { id: 8, name: 'Tidefin', zhName: '潮鰭獸', type: 'water', gen: 1, at: 50 }, { id: 9, name: 'Abyssail', zhName: '滄海鯨帆', type: 'water', gen: 1, at: 100 }],
];
export const levelFor = xp => Math.min(100, 1 + Math.floor(Math.max(0, xp) / 100));
export const freshGrowth = () => ({ version: 1, evolutionRules: 2, starter: null, stage: 0, xp: 0, mastered: {}, rounds: {}, answered: 0, correct: 0 });
export const familyFor = state => STARTERS.find(f => f[0].id === state.starter);
export const partnerFor = state => familyFor(state)?.[state.stage] || null;
export const nextEvolution = state => familyFor(state)?.[state.stage + 1] || null;
export const canEvolve = state => !!nextEvolution(state) && levelFor(state.xp) >= nextEvolution(state).at;
export function chooseStarter(state, id) {
  if (state.starter || !STARTERS.some(f => f[0].id === id)) return state;
  return { ...state, starter: id };
}
export function evolve(state) {
  return canEvolve(state) ? { ...state, evolutionRules: 2, stage: state.stage + 1 } : state;
}
export function questionKey(bankId, question) {
  return JSON.stringify([bankId, question.questionId || `${question.question.trim()}=${question.answer}`]);
}
export function recordAnswer(state, bankId, question, correct) {
  if (!state.starter) return { state, reward: null };
  const key = questionKey(bankId, question);
  const first = correct && !Object.hasOwn(state.mastered, key);
  const answerXp = correct ? (first ? 20 : 5) : 0;
  const previous = Object.hasOwn(state.rounds, bankId) ? state.rounds[bankId] : { count: 0, completed: 0 };
  const complete = previous.count === 9;
  const roundXp = complete ? 30 : 0;
  const xp = Math.min(MAX_XP, state.xp + answerXp + roundXp);
  const next = {
    ...state, xp,
    mastered: first ? { ...state.mastered, [key]: true } : state.mastered,
    rounds: { ...state.rounds, [bankId]: { count: complete ? 0 : previous.count + 1, completed: previous.completed + (complete ? 1 : 0) } },
    answered: state.answered + 1, correct: state.correct + Number(correct),
  };
  return { state: next, reward: { gained: xp - state.xp, answerXp, roundXp, first, complete, before: levelFor(state.xp), after: levelFor(xp) } };
}
const integer = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
export function validGrowth(s) {
  if (!s || s.version !== 1 || !integer(s.xp, 0, MAX_XP) || !integer(s.stage, 0, 2)) return false;
  if (s.starter !== null && !STARTERS.some(f => f[0].id === s.starter)) return false;
  if (!integer(s.answered, 0, Number.MAX_SAFE_INTEGER) || !integer(s.correct, 0, s.answered)) return false;
  if (!s.mastered || Array.isArray(s.mastered) || typeof s.mastered !== 'object' || Object.values(s.mastered).some(v => v !== true)) return false;
  if (!s.rounds || Array.isArray(s.rounds) || typeof s.rounds !== 'object' || Object.values(s.rounds).some(r => !r || !integer(r.count, 0, 9) || !integer(r.completed, 0, Number.MAX_SAFE_INTEGER))) return false;
  if (s.starter === null && (s.stage !== 0 || s.xp !== 0)) return false;
  if (s.evolutionRules !== undefined && s.evolutionRules !== 2) return false;
  // Grandfather valid pre-update forms; all future evolution uses STARTERS.
  const minimum = s.evolutionRules === 2 ? familyFor(s)?.[s.stage].at : [1, 16, s.starter === 1 ? 32 : 36][s.stage];
  return !s.starter || levelFor(s.xp) >= minimum;
}
const validSpirit = p => p && integer(p.id, 1, 20000) && ['name','zhName','type'].every(k => typeof p[k] === 'string' && p[k].length < 160);
export function loadSave(storage) {
  try {
    const raw = storage?.getItem(GROWTH_KEY);
    if (!raw) return { growth: freshGrowth(), captured: null, selected: null, notice: '' };
    const save = JSON.parse(raw);
    if (!validGrowth(save.growth) || !Array.isArray(save.captured) || !save.captured.every(validSpirit) || !validSpirit(save.selected)) throw Error('invalid');
    return { ...save, notice: '' };
  } catch { return { growth: freshGrowth(), captured: null, selected: null, notice: '舊養成存檔無法讀取，本次先從新進度開始；原題庫不受影響。' }; }
}
export function saveProgress(storage, save) {
  try { storage.setItem(GROWTH_KEY, JSON.stringify(save)); return true; } catch { return false; }
}
