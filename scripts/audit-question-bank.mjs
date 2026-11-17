import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const letters = ['A', 'B', 'C', 'D'];

// Structural audit only: deliberately never writes or repairs the source.
export function auditQuestionBank(data) {
  const questions = Array.isArray(data) ? data : data?.questions;
  const report = { ok: false, total: 0, active: 0, review: 0, units: Object.create(null), errors: [], warnings: [] };
  if (!Array.isArray(questions) || questions.length === 0) {
    report.errors.push({ field: 'questions', message: '題庫必須是非空陣列，或含 questions 陣列的物件。' });
    return report;
  }
  const ids = new Set();
  report.total = questions.length;
  questions.forEach((q, index) => {
    const id = q?.id;
    const issue = (field, message, warning = false) => {
      report[warning ? 'warnings' : 'errors'].push({ index, id: id ?? null, field, message });
    };
    if (!q || typeof q !== 'object' || Array.isArray(q)) {
      issue('question', '題目必須是物件。');
      return;
    }
    if (!nonempty(id)) issue('id', '缺少非空字串 ID。');
    else {
      if (ids.has(id)) issue('id', '題目 ID 重複。');
      ids.add(id);
    }
    if (!['active', 'review'].includes(q.status)) issue('status', 'status 必須明確為 active 或 review。');
    else report[q.status]++;
    const warning = q.status === 'review';
    for (const field of ['unit', 'stem', 'explanation']) {
      if (!nonempty(q[field])) issue(field, `缺少 ${field}。`, warning);
    }
    if (nonempty(q.unit) && q.status === 'active') {
      report.units[q.unit] = (Object.hasOwn(report.units, q.unit) ? report.units[q.unit] : 0) + 1;
    }
    if (!q.options || typeof q.options !== 'object' || Array.isArray(q.options) ||
        Object.keys(q.options).length !== 4 || letters.some(letter => !nonempty(q.options[letter]))) {
      issue('options', '單選選項需恰為 A、B、C、D，且均非空字串。', warning);
    }
    if (!letters.includes(q.answer)) issue('answer', '答案必須為 A、B、C 或 D。', warning);
    if (q.sourceOrder !== undefined && (!Number.isInteger(q.sourceOrder) || q.sourceOrder < 1)) {
      issue('sourceOrder', '提供 sourceOrder 時需為正整數。', warning);
    }
  });
  report.ok = report.errors.length === 0;
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2]) throw new Error('用法：node audit-question-bank.mjs <題庫.json>');
    const report = auditQuestionBank(JSON.parse(readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, '')));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.ok ? 0 : 1;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ ok: false, errors: [{ message: error.message }] }, null, 2)}\n`);
    process.exitCode = 1;
  }
}
