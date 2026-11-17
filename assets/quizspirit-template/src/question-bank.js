export const AUTO_BANK_ID = 'math-auto';
export const STORAGE_KEY = 'quizspirit.question-banks.v1';
const letters = ['A', 'B', 'C', 'D'];
const text = value => typeof value === 'string' && value.trim().length > 0;

export function validateBank(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, errors: ['題庫必須為 JSON 物件。'] };
  if (data.schemaVersion !== 1) errors.push('schemaVersion 必須為 1。');
  if (!text(data.bankId) || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(data.bankId) || data.bankId === AUTO_BANK_ID) errors.push('bankId 需為英文小寫、數字、底線或連字號，且不可為 math-auto。');
  if (!text(data.title)) errors.push('缺少題庫 title。');
  if (data.timeLimitSeconds !== undefined && (!Number.isInteger(data.timeLimitSeconds) || data.timeLimitSeconds < 5 || data.timeLimitSeconds > 600)) errors.push('timeLimitSeconds 需為 5–600 的整數。');
  if (!Array.isArray(data.questions) || data.questions.length === 0) errors.push('questions 不可為空。');
  const ids = new Set();
  for (const [i,q] of (Array.isArray(data.questions) ? data.questions : []).entries()) {
    const at = `第 ${i + 1} 題：`;
    if (!q || typeof q !== 'object' || Array.isArray(q)) { errors.push(at + '必須為物件。'); continue; }
    if (!text(q.id) || ids.has(q.id)) errors.push(at + 'ID 缺漏或重複。');
    ids.add(q.id);
    if (!['active', 'review'].includes(q.status)) errors.push(at + 'status 需為 active 或 review。');
    // Review entries may retain incomplete transcription; they are never drawn.
    if (q.status !== 'active') continue;
    for (const key of ['stem','unit','explanation','sourceRef']) if (!text(q[key])) errors.push(at + `缺少 ${key}。`);
    if (!q.options || Object.keys(q.options).length !== 4 || letters.some(k => !text(q.options[k]))) errors.push(at + '需有非空 A、B、C、D 選項。');
    else if (new Set(letters.map(k => q.options[k].trim())).size !== 4) errors.push(at + '選項內容重複。');
    if (!letters.includes(q.answer)) errors.push(at + 'answer 需為 A、B、C 或 D。');
    if (q.difficulty !== undefined && !['easy','medium','hard','champion'].includes(q.difficulty)) errors.push(at + 'difficulty 不在支援範圍。');
  }
  return { ok: errors.length === 0, errors, active: (data.questions || []).filter?.(q => q?.status === 'active').length || 0 };
}

export function activeQuestions(bank) {
  return bank.questions.filter(q => q.status === 'active');
}

export function drawQuestion(bank, difficulty, decks, random = Math.random) {
  const active = activeQuestions(bank);
  const matching = active.filter(q => q.difficulty === difficulty);
  const pool = matching.length ? matching : active;
  if (!pool.length) throw new Error('這份題庫沒有可出題的 active 題目。');
  const key = `${bank.bankId}:${matching.length ? difficulty : 'all'}`;
  let deck = decks[key];
  if (!deck?.length) {
    deck = [...pool];
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    decks[key] = deck;
  }
  const q = deck.pop();
  return { question: q.stem, answer: q.answer, options: letters, optionTexts: q.options, explanation: q.explanation, sourceRef: q.sourceRef, questionId: `${bank.bankId}:${q.id}`, unit: q.unit };
}

export function readStoredBanks(storage) {
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    const ids = new Set();
    return value.filter(bank => { if (!validateBank(bank).ok || ids.has(bank.bankId)) return false; ids.add(bank.bankId); return true; });
  } catch { return []; }
}

export function writeStoredBanks(banks, storage) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(banks)); return true; } catch { return false; }
}
