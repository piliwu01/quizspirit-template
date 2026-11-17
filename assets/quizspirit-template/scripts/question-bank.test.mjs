import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBank, drawQuestion, readStoredBanks, writeStoredBanks } from '../src/question-bank.js';
const question = (id, status='active') => ({id,unit:'單元一',stem:'3 + 4 = ?',options:{A:'5',B:'6',C:'7',D:'8'},answer:'C',explanation:'3 + 4 = 7。',sourceRef:'自動化測試資料，非正式教材',status});
const bank = id => ({schemaVersion:1,bankId:id,title:id,questions:[question('q1'),question('q2'),question('q3','review')]});
test('invalid input and unsafe IDs are rejected without throwing',()=>{
  for(const data of [null,[],{}, {...bank('ok'),questions:{}}, {...bank('ok'),questions:'bad'}, {...bank('ok'),bankId:'math-auto'}]) assert.equal(validateBank(data).ok,false);
});
test('active questions require answer mapping, unique IDs and full source',()=>{
  const b=bank('a'); assert.equal(validateBank(b).active,2);
  b.questions[1].id='q1';assert.equal(validateBank(b).ok,false);
  b.questions[1].id='q2';b.questions[1].answer='Z';assert.equal(validateBank(b).ok,false);
  b.questions[1].answer='C';delete b.questions[1].sourceRef;assert.equal(validateBank(b).ok,false);
});
test('review records can remain incomplete but never enter the deck',()=>{
  const b=bank('a');b.questions[2]={id:'draft',status:'review'};assert.equal(validateBank(b).ok,true);
  const deck={};const first=drawQuestion(b,'easy',deck,()=>.3), second=drawQuestion(b,'easy',deck,()=>.3);
  assert.notEqual(first.questionId,second.questionId);assert(!first.questionId.includes('draft'));assert.equal(first.optionTexts[first.answer],'7');
});
test('bank IDs isolate decks and difficulty fallback retains all eligible questions',()=>{
  const decks={};const a=drawQuestion(bank('a'),'hard',decks,()=>.2);const b=drawQuestion(bank('b'),'hard',decks,()=>.2);assert.notEqual(a.questionId,b.questionId);
  const graded=bank('graded');graded.questions[0].difficulty='hard';assert.equal(drawQuestion(graded,'hard',{},()=>.2).questionId,'graded:q1');
});
test('storage failure is recoverable and corrupt saved banks are excluded',()=>{
  const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
  assert.deepEqual(readStoredBanks(blocked),[]);assert.equal(writeStoredBanks([bank('a')],blocked),false);
  const memory={value:'',getItem(){return this.value},setItem(k,v){this.value=v}};
  assert.equal(writeStoredBanks([bank('a')],memory),true);assert.equal(readStoredBanks(memory)[0].bankId,'a');
  memory.value=JSON.stringify([bank('a'),bank('a'),{bad:1}]);assert.equal(readStoredBanks(memory).length,1);
});
