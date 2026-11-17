import test from 'node:test';
import assert from 'node:assert/strict';
import { auditQuestionBank } from './audit-question-bank.mjs';

const question = (overrides = {}) => ({ id: 'q1', unit: '閱讀', stem: '題幹', options: { A: '甲', B: '乙', C: '丙', D: '丁' }, answer: 'A', explanation: '解析', status: 'active', ...overrides });

test('支援陣列與包裝物件，依唯一題目統計', () => {
  for (const input of [[question()], { questions: [question()] }]) {
    const r = auditQuestionBank(input);
    assert.equal(r.ok, true); assert.equal(r.active, 1); assert.equal(r.units['閱讀'], 1);
  }
});
test('active 題缺少解析為錯誤；review 題為警告，不計有效題', () => {
  const r = auditQuestionBank([question({ explanation: '' }), question({ id: 'q2', status: 'review', answer: '' })]);
  assert.equal(r.ok, false); assert.equal(r.review, 1);
  assert.ok(r.errors.some(e => e.field === 'explanation'));
  assert.ok(r.warnings.some(e => e.field === 'answer'));
  assert.equal(r.units['閱讀'], 1);
});
test('review 題也不能重複 ID；未知狀態不能默認有效', () => {
  const r = auditQuestionBank([question(), question({ status: 'review' }), question({ id: 'q3', status: undefined })]);
  assert.equal(r.ok, false); assert.ok(r.errors.some(e => e.field === 'id'));
  assert.ok(r.errors.some(e => e.field === 'status'));
});
test('選項與答案必須是四選一；拒絕空題庫', () => {
  assert.equal(auditQuestionBank([]).ok, false);
  assert.equal(auditQuestionBank([question({ options: ['甲', '乙', '丙', '丁'], answer: 0 })]).ok, false);
  assert.equal(auditQuestionBank([question({ options: { A: '甲', B: '乙', C: '丙', D: '丁', E: '戊' } })]).ok, false);
});
test('不修改輸入，來源順序與特殊單元名稱可檢查', () => {
  const input = [question({ unit: '__proto__', sourceOrder: 0 })];
  const before = JSON.stringify(input);
  const r = auditQuestionBank(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(r.ok, false); assert.equal(r.units.__proto__, 1);
});
