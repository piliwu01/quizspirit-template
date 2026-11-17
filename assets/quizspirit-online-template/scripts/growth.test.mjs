import test from 'node:test';
import assert from 'node:assert/strict';
import { freshGrowth, chooseStarter, recordAnswer, levelFor, evolve, canEvolve, validGrowth, partnerFor, loadSave, saveProgress, GROWTH_KEY } from '../src/growth.js';
const q = { question: '3 + 4', answer: 7 };
const begin = () => chooseStarter(freshGrowth(),4);
test('first correct, repeat, wrong and cross-bank keys', () => {
  let s = begin();
  s = recordAnswer(s,'a',q,true).state; assert.equal(s.xp,20);
  s = recordAnswer(s,'a',q,true).state; assert.equal(s.xp,25);
  s = recordAnswer(s,'a',q,false).state; assert.equal(s.xp,25);
  s = recordAnswer(s,'b',q,true).state; assert.equal(s.xp,45);
  assert.equal(s.answered,4); assert.equal(s.correct,3);
});
test('ten completed questions pay once, across saved partial rounds; banks stay separate', () => {
  let s=begin();
  for(let i=0;i<9;i++)s=recordAnswer(s,'a',q,false).state;
  assert.equal(s.xp,0); assert.equal(s.rounds.a.count,9);
  const storage={value:'',getItem(){return this.value},setItem(k,v){this.value=v}};
  saveProgress(storage,{growth:s,captured:[],selected:partnerFor(s)});
  s=loadSave(storage).growth;
  s=recordAnswer(s,'b',q,false).state; assert.equal(s.xp,0);
  s=recordAnswer(s,'a',q,false).state; assert.equal(s.xp,30); assert.equal(s.rounds.a.completed,1);
  s=recordAnswer(s,'a',q,false).state; assert.equal(s.xp,30); assert.equal(s.rounds.a.count,1);
  assert.equal(s.rounds.b.count,1);
});
test('level boundaries, manual evolution and no repeated evolution below threshold', () => {
  for (const [xp,lv] of [[0,1],[99,1],[100,2],[4899,49],[4900,50],[9899,99],[9900,100]])assert.equal(levelFor(xp),lv);
  for (const id of [1,4,7]) {
    let s=chooseStarter(freshGrowth(),id);s.xp=4899;assert.equal(canEvolve(s),false);assert.equal(evolve(s),s);
    s.xp=4900;s=evolve(s);assert.equal(partnerFor(s).id,id+1);assert.equal(s.xp,4900);assert.equal(canEvolve(s),false);
    s.xp=9899;assert.equal(canEvolve(s),false);assert.equal(evolve(s),s);
    s.xp=9900;s=evolve(s);assert.equal(partnerFor(s).id,id+2);assert.equal(evolve(s),s);assert(validGrowth(s));
  }
});
test('maximum level caps XP while still recording review',()=>{
  let s=begin();s.xp=9895;s=recordAnswer(s,'a',q,true).state;assert.equal(s.xp,9900);
  const r=recordAnswer(s,'a',q,true);assert.equal(r.reward.gained,0);assert.equal(r.state.answered,2);
});
test('starter is chosen once and unselected state earns no XP',()=>{
  const s=begin();assert.equal(chooseStarter(s,7),s);assert.equal(recordAnswer(freshGrowth(),'a',q,true).reward,null);
});
test('storage denial and corrupt save recover without touching bank data',()=>{
  const blocked={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
  assert(loadSave(blocked).notice);assert.equal(saveProgress(blocked,{}),false);
  assert(loadSave({getItem(){return '{bad'}}).notice);
  assert.equal(validGrowth({...begin(),xp:-1}),false);assert.equal(validGrowth({...begin(),stage:2}),false);
  assert.equal(validGrowth({...begin(),correct:5}),false);assert.equal(validGrowth({...begin(),rounds:{a:{count:10,completed:0}}}),false);
  assert.equal(GROWTH_KEY,'quizspirit.growth.v1');
});
test('first-correct history survives evolution, question stable ID ignores answer position',()=>{
  let s=begin();const bankQ={question:'題幹',questionId:'a:q1',answer:'A'};
  s=recordAnswer(s,'a',bankQ,true).state;s.xp=4900;s=evolve(s);
  const r=recordAnswer(s,'a',{...bankQ,answer:'B'},true);assert.equal(r.reward.answerXp,5);
});
test('reserved object property bank names have independent round counters',()=>{
  const r=recordAnswer(begin(),'constructor',q,true);assert.equal(r.state.rounds.constructor.count,1);assert(validGrowth(r.state));
});
test('finite small bank can reach evolution by meaningful repeat practice',()=>{
  let s=begin(),n=0;while(s.xp<9900){s=recordAnswer(s,'a',q,true).state;n++;}
  assert.equal(n,1239);assert.equal(levelFor(s.xp),100);
});
test('legacy evolved saves keep XP and form while new evolution uses 50/100',()=>{
  for(const [starter,stage,xp] of [[1,1,1500],[1,2,3100],[4,1,1500],[4,2,3500],[7,2,3500]]){
    const growth={...chooseStarter(freshGrowth(),starter),stage,xp};delete growth.evolutionRules;
    const selected=partnerFor(growth),save={growth,selected,captured:[selected]};
    const restored=loadSave({getItem(){return JSON.stringify(save)}});
    assert.equal(restored.notice,'');assert.equal(restored.growth.stage,stage);assert.equal(restored.growth.xp,xp);
    assert.equal(canEvolve(restored.growth),false);
    const next=recordAnswer(restored.growth,'a',q,true).state;assert(validGrowth(next));
  }
});
