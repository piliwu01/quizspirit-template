import {freshGrowth, chooseStarter, partnerFor, nextEvolution, levelFor, recordAnswer, evolve} from '../src/growth.js';
import {generateMathProblem} from './questions.js';
import {CATALOG} from './catalog.js';
import {canCapture} from '../src/capture.js';
import {itemById,bagOf} from './items.js';
import {ownedSpirit} from './ownership.js';

export const taipeiDate = ms => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
export const freshState = () => ({growth:freshGrowth(),nickname:'',food:0,bond:0,days:[],fed:[],roundDays:[],passes:{},claimed:{},items:{},captured:[],selected:CATALOG[0],battle:null,pending:null,challenge:null});
export const milestone = s => s.growth.starter===25 || s.growth.stage===1 ? 100 : 50;
export const itemName = (starter,at) => starter===25?'雷晶石':({1:['草之徽章','盛放之證'],4:['火之徽章','烈焰之證'],7:['水之徽章','滄海之證']}[starter]?.[at===50?0:1]);
export const requiredDays = at => at===50?7:14;
export function fail(message,status=400){throw Object.assign(new Error(message),{status});}
export const publicQuestion = q => q ? {id:q.id,question:q.question,options:q.options,optionTexts:q.optionTexts,timeLimit:q.timeLimit,expires:q.expires} : null;
export function publicState(s){const {pending,challenge,...out}=s;return {...out,selected:s.growth.starter?(ownedSpirit(s,s.selected?.id)||partnerFor(s.growth)):s.selected,bag:bagOf(s),challenge:challenge?{at:challenge.at,index:challenge.index,total:challenge.questions.length,correct:challenge.correct,done:challenge.done,passed:challenge.passed,question:publicQuestion(challenge.questions[challenge.index])}:null};}
function needPartner(s){if(!s.growth.starter)fail('請先選擇專屬夥伴。');}
function questionFor(bank,diff,now){
 let q;
 if(bank){const pool=bank.questions.filter(x=>x.status==='active');if(!pool.length)fail('這份題庫沒有可使用的題目。'); const matched=pool.filter(x=>x.difficulty===diff); const x=(matched.length?matched:pool)[Math.floor(Math.random()*(matched.length||pool.length))]; q={question:x.stem,answer:x.answer,options:['A','B','C','D'],optionTexts:x.options,explanation:x.explanation,sourceRef:x.sourceRef,questionId:x.id};}
 else q=generateMathProblem(diff);
 return {...q,id:crypto.randomUUID(),bankId:bank?.bankId||'math-auto',timeLimit:bank?.timeLimitSeconds||({easy:10,medium:12,hard:15}[diff]||18),expires:now+(bank?.timeLimitSeconds||({easy:10,medium:12,hard:15}[diff]||18))*1000};
}
function resolve(q,choice,now){if(choice!==null&&!q.options.includes(choice))fail('答案不在選項中。');return {correct:choice!==null&&now<=q.expires&&choice===q.answer,question:q.question,answer:q.answer,answerText:q.optionTexts?.[q.answer]??String(q.answer),explanation:q.explanation||'仔細檢查運算步驟，再試一次。',sourceRef:q.sourceRef||'',timedOut:now>q.expires||choice===null};}
export function applyAction(s,route,b,now,bank=null){
 const today=taipeiDate(now); let event={};
 if(route==='/starter'){
  if(s.growth.starter)fail('已選定專屬夥伴，不能重選。');
  s.growth=chooseStarter(s.growth,Number(b.id));needPartner(s);s.selected=partnerFor(s.growth);s.captured=[s.selected];
 }else if(route==='/nickname'){
  needPartner(s);const value=String(b.nickname||'').trim();if(!value||Array.from(value).length>12||/[\x00-\x1f]/.test(value))fail('暱稱請填寫 1～12 個字。');s.nickname=value;
 }else if(route==='/shop/buy'){
  needPartner(s);const item=itemById(b.itemId);if(!item)fail('找不到這個道具。');if(s.food<item.price+1)fail(`需要 ${item.price} 份食物，並保留 1 份給夥伴餵食。`);const bag=bagOf(s);if(!Number.isSafeInteger(bag[item.id]+1))fail('背包數量已超出可保存範圍。');s.food-=item.price;bag[item.id]++;s.bag=bag;event.message=`已購買 1 個${item.name}，放入背包。`;
 }else if(route==='/bag/use'){
  needPartner(s);if(b.itemId!=='potion')fail('請到共同討伐背包使用這個道具。');const bag=bagOf(s);if(!bag.potion)fail('背包沒有傷藥。');if(s.battle?.status!=='ready'||s.battle.playerHp<=0)fail('請在進行中的個人對戰使用傷藥。');const amount=Math.min(30,s.battle.playerMaxHp-s.battle.playerHp);if(amount<=0)fail('目前已滿血，不消耗傷藥。');s.battle.playerHp+=amount;bag.potion--;s.bag=bag;event.message=`已使用傷藥，回復 ${amount} HP。`;
 }else if(route==='/feed'){
  needPartner(s);if(s.food<1)fail('先完成一輪 10 題，取得食物。');if(!s.roundDays.includes(today))fail('今天先完成一輪 10 題，再餵食夥伴。');if(s.fed.includes(today))fail('今天已完成陪伴，明天再來吧！');
  s.food--;s.bond++;s.fed.push(today);s.days.push(today);event.message='今天的陪伴已保存！親密度 ＋1。';
 }else if(route==='/battle/start'){
  needPartner(s);if(s.challenge&&!s.challenge.done)fail('先完成或離開進化挑戰。');
  const selected=b.playerId===undefined?partnerFor(s.growth):ownedSpirit(s,b.playerId);if(!selected)fail('尚未成功收服這個角色，不能選擇出戰。',403);s.selected=selected;
  const pool=CATALOG.filter(p=>p.id!==selected.id);const enemy=pool[Math.floor(Math.random()*pool.length)];const level=23+Math.floor(Math.random()*5);
  const playerHp=b.heal||!s.battle||s.battle.status==='lost'?185:s.battle.playerHp;
  s.battle={id:crypto.randomUUID(),enemy,level,maxHp:80+level*4,hp:80+level*4,playerMaxHp:185,playerHp,status:'ready'};s.pending=null;
 }else if(route==='/question'){
  needPartner(s);if(!ownedSpirit(s,s.selected?.id))fail('這個角色尚未收服，請重新選擇自己的夥伴。',403);if(!s.battle||s.battle.status!=='ready')fail('請重新開始一場對戰。');
  const move=String(b.move);if(!['quick','special','critical','catch'].includes(move))fail('招式無效。');
  if(s.pending&&s.pending.expires>=now){event.question=publicQuestion(s.pending);return event;}
  if(move==='catch'&&!canCapture(s.battle.hp,s.battle.maxHp))fail('對手 HP 須剩 5% 以下且尚未倒下才能收服。');
  s.pending={...questionFor(bank,move==='quick'||move==='catch'?'easy':move==='critical'?'hard':'medium',now),move,battleId:s.battle.id};event.question=publicQuestion(s.pending);
 }else if(route==='/answer'){
  if(!ownedSpirit(s,s.selected?.id))fail('這個角色尚未收服，請重新選擇自己的夥伴。',403);const q=s.pending;if(!q||q.id!==b.questionId||q.battleId!==s.battle?.id)fail('這題已結束，請重新取得題目。',409);
  event=resolve(q,b.choice,now);const result=recordAnswer(s.growth,q.bankId,q,event.correct);s.growth=result.state;event.reward=result.reward;
  if(result.reward.complete){s.food++;if(!s.roundDays.includes(today))s.roundDays.push(today);}
  const battle=s.battle;let damage=0,caught=false;
  if(event.correct){if(q.move==='catch'){caught=canCapture(battle.hp,battle.maxHp)&&Math.random()<0.92;}else{damage=({quick:22,special:45,critical:75}[q.move])+Math.floor(Math.random()*({quick:10,special:18,critical:22}[q.move]));battle.hp=Math.max(0,battle.hp-damage);}}
  if(caught){battle.status='caught';if(!s.captured.some(p=>p.id===battle.enemy.id))s.captured.push(battle.enemy);}
  else if(battle.hp===0)battle.status='won';
  const enemyDamage=battle.status==='ready'?18+Math.floor(Math.random()*16):0;
  battle.playerHp=Math.max(0,battle.playerHp-enemyDamage);if(battle.playerHp===0)battle.status='lost';
  event.combat={damage,enemyDamage,caught,...battle};s.pending=null;
 }else if(route==='/challenge/start'){
  needPartner(s);const at=milestone(s);if(!nextEvolution(s.growth))fail('這位夥伴已完成所有進化。');if(s.days.length<requiredDays(at))fail(`需先累積 ${requiredDays(at)} 天有效陪伴。`);
  if(s.claimed[at])fail('這階段的道具已領取。');
  const total=at===50?10:15;let questions=[];
  if(bank){const active=bank.questions.filter(q=>q.status==='active');if(active.length<total)fail(`題庫至少需要 ${total} 道可用題目，目前只有 ${active.length} 題。`);const pool=[...active];for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}questions=pool.slice(0,total).map(x=>questionFor({...bank,questions:[x]},x.difficulty||'medium',now));}
  else{const seen=new Set();while(questions.length<total){const q=questionFor(null,at===50?'medium':'hard',now);if(!seen.has(q.question)){seen.add(q.question);questions.push(q);}}}
  s.challenge={at,bankId:bank?.bankId||'math-auto',questions,index:0,correct:0,done:false,passed:false};s.pending=null;s.battle=null;
 }else if(route==='/challenge/leave'){
  s.challenge=null;
 }else if(route==='/challenge/answer'){
  const c=s.challenge;if(!c||c.done)fail('請先開始進化挑戰。');const q=c.questions[c.index];if(q.id!==b.questionId)fail('這題已結束，請作答下一題。',409);
  event=resolve(q,b.choice,now);c.correct+=Number(event.correct);c.index++;c.done=c.index===c.questions.length;
  if(c.done){c.passed=c.correct>=(c.at===50?8:12);if(c.passed)s.passes[c.at]=true;}else c.questions[c.index].expires=0;
 }else if(route==='/challenge/next'){
  const c=s.challenge;if(!c||c.done)fail('挑戰已結束。');const q=c.questions[c.index];if(q.expires===0)q.expires=now+q.timeLimit*1000;
 }else if(route==='/claim'){
  needPartner(s);const at=milestone(s);if(s.claimed[at])fail('道具已領取，請到背包查看。');if(!s.passes[at]||s.days.length<requiredDays(at))fail('請先完成陪伴任務與專屬挑戰。');s.items[at]=1;s.claimed[at]=true;event.message=`已獲得${itemName(s.growth.starter,at)}！`;
 }else if(route==='/evolve'){
  needPartner(s);const at=milestone(s);if(!nextEvolution(s.growth)||levelFor(s.growth.xp)<at||s.items[at]!==1)fail('等級或進化道具尚未達標。');s.items[at]=0;const prev=partnerFor(s.growth);s.growth=evolve(s.growth);const partner=partnerFor(s.growth);if(s.selected.id===prev.id)s.selected=partner;if(!s.captured.some(p=>p.id===partner.id))s.captured.push(partner);s.challenge=null;event.message=`${s.nickname||prev.zhName}進化成${partner.zhName}！`;
 }else if(route==='/bank/change'){
  s.challenge=null;s.pending=null;
 }else fail('找不到此操作。',404);
 return event;
}
