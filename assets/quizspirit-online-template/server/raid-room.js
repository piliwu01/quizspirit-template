import {DurableObject} from 'cloudflare:workers';
import {RAID,newRoom,advanceRoom,startRoom,pauseRoom,resumeRoom,finishRoom,recordHit,useSkill,useRaidItem,addEvent,raidError,live} from '../shared/raid-rules.js';
import {generateMathProblem} from '../shared/questions.js';import {publicQuestion} from '../shared/game.js';import {settleRaidAward} from './raid-awards.js';import {sha} from './auth.js';
import {consumeRaidItem} from './inventory.js';
import {partnerFor} from '../src/growth.js';
import {ownedSpirit} from '../shared/ownership.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export class RaidRoom extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.queue=Promise.resolve();this.bank=null;}
 lock(fn){const result=this.queue.then(fn,fn);this.queue=result.catch(()=>{});return result;}
 async choosePartner(actor,id){
  const row=await this.env.DB.prepare('SELECT data FROM progress WHERE user_id=?').bind(actor.id).first(),state=JSON.parse(row.data),fixed=partnerFor(state.growth);if(!fixed)raidError('先到養成頁選擇專屬夥伴。');
  const partner=id===undefined?fixed:ownedSpirit(state,id);if(!partner)raidError('只能選擇自己的固定夥伴或已收服角色。',403);
  return {partner,nickname:partner.id===fixed.id?state.nickname:''};
 }
 async recoverItem(){
  const intent=await this.ctx.storage.get('itemIntent');if(!intent)return null;
  try{await consumeRaidItem(this.env.DB,intent);}catch(e){if([400,404].includes(e.status))await this.ctx.storage.delete('itemIntent');else await this.ctx.storage.setAlarm(Date.now()+5000);throw e;}
  const s=intent.proposed;s.revision=(s.revision||0)+1;
  await this.ctx.storage.transaction(async tx=>{await tx.put('room',s);await tx.put(intent.key,{fingerprint:intent.fingerprint,event:intent.event});await tx.delete('itemIntent');});
  await this.plan(s);return s;
 }
 async plan(s){let time=s.status==='active'?Math.min(s.nextAttackAt,s.endsAt,s.poisons?.length?s.poisonNextAt:Infinity,s.stunUntil>Date.now()?s.stunUntil:Infinity,s.drumUntil>Date.now()?s.drumUntil:Infinity):null;if(s.outbox.length)time=Math.min(time||Infinity,Date.now()+5000);if(time)await this.ctx.storage.setAlarm(Math.max(Date.now()+100,time));else await this.ctx.storage.deleteAlarm();}
 async save(s,operation){s.revision=(s.revision||0)+1;await this.ctx.storage.transaction(async tx=>{await tx.put('room',s);if(operation)await tx.put(operation.key,operation.value);});await this.plan(s);}
 async flush(s){let changed=false;for(const entry of [...s.outbox]){try{await settleRaidAward(this.env.DB,entry);s.outbox=s.outbox.filter(x=>x.id!==entry.id);changed=true;}catch{break;}}if(changed)await this.save(s);await this.env.DB.prepare('UPDATE raid_rooms SET status=? WHERE code=?').bind(s.status,s.code).run().catch(()=>{});return s;}
 snapshot(s,user){
  const m=s.members[user.id];const host=s.hostId===user.id&&user.role==='teacher';if(!host&&!m)raidError('你尚未加入這個房間。',403);
  const online=new Set(this.ctx.getWebSockets().map(w=>w.deserializeAttachment()?.id));
  return {code:s.code,className:s.className,host,stunUntil:s.stunUntil||0,drumUntil:s.drumUntil||0,guardCharges:s.guardCharges||0,poisonTicks:(s.poisons||[]).reduce((n,p)=>n+p.ticks,0),bankTitle:s.bankTitle,status:s.status,sequence:s.sequence,revision:s.revision||0,serverNow:Date.now(),createdAt:s.createdAt,endsAt:s.endsAt,nextAttackAt:s.nextAttackAt,pausedAt:s.pausedAt,duration:s.duration,hp:s.hp,maxHp:s.maxHp,shield:s.shield,maxShield:s.maxShield,rankings:s.rankings,events:host?s.events:s.events.slice(0,24),members:Object.values(s.members).map(p=>({id:p.id,name:p.name,partner:p.partner,nickname:p.nickname,damage:p.damage,heal:p.heal,correct:p.correct,answered:p.answered,online:online.has(p.id)})),me:m?{id:m.id,charges:m.charges,energy:m.energy,damage:m.damage,heal:m.heal,answered:m.answered,correct:m.correct,question:publicQuestion(m.question),feedback:m.feedback,pendingRewards:s.outbox.some(e=>e.userId===m.id)}:null,pendingRewards:s.outbox.length};
 }
 broadcast(s){for(const ws of this.ctx.getWebSockets()){const actor=ws.deserializeAttachment();if(!actor)continue;if(actor.sessionExpires<Date.now()){try{ws.close(4001,'請重新登入');}catch{}continue;}try{ws.send(JSON.stringify({type:'snapshot',room:this.snapshot(s,actor)}));}catch{}}}
 async loadBank(s){if(s.bankId==='math-auto')return null;if(this.bank?.bankId===s.bankId)return this.bank;const row=await this.env.DB.prepare('SELECT data FROM banks WHERE id=?').bind(s.bankId).first();if(!row)raidError('原題庫已不存在。',409);this.bank=JSON.parse(row.data);return this.bank;}
 async nextQuestion(s,m,now){
  if(m.question)return;m.feedback=null;const bank=await this.loadBank(s);let q;
  if(bank){const active=bank.questions.filter(x=>x.status==='active');if(!active.length)raidError('沒有有效題目。');if(!m.deck?.length){m.deck=active.map(x=>x.id);for(let i=m.deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[m.deck[i],m.deck[j]]=[m.deck[j],m.deck[i]];}}const pickedId=m.deck.pop();const x=active.find(x=>x.id===pickedId);q={question:x.stem,answer:x.answer,questionId:x.id,options:['A','B','C','D'],optionTexts:x.options,explanation:x.explanation,sourceRef:x.sourceRef};}
  else q=generateMathProblem('medium');
  m.question={...q,id:crypto.randomUUID(),timeLimit:bank?.timeLimitSeconds||30,expires:now+(bank?.timeLimitSeconds||30)*1000};
 }
 async fetch(req){return this.lock(async()=>{
  try{
   await this.recoverItem();const path=new URL(req.url).pathname;const actor=JSON.parse(decodeURIComponent(req.headers.get('X-Raid-Actor')||'null'));if(!actor)raidError('缺少登入資料。',401);
   let s=await this.ctx.storage.get('room');
   if(path==='/init'){
    const b=await req.json();if(actor.role!=='teacher'||actor.id!==b.hostId)raidError('老師身份不符。',403);
    if(!s){s=newRoom(b,Date.now());await this.save(s);}else if(s.hostId!==actor.id)raidError('房間已被使用。',409);
    return json({room:this.snapshot(s,actor)});
   }
   if(!s)raidError('找不到討伐房間。',404);
   if(advanceRoom(s,Date.now()))await this.save(s);
   s=await this.flush(s);
   const host=s.hostId===actor.id&&actor.role==='teacher';
   if(path==='/status')return json({status:s.status});
   if(path==='/join'){
    if(actor.role!=='student'||actor.className!==s.className)raidError('這不是你的班級房間。',403);
    const body=await req.json();if(s.members[actor.id]&&body.playerId!==undefined&&Number(body.playerId)!==s.members[actor.id].partner.id)raidError('已加入房間，請在開戰前使用更換出戰角色；開戰後不能更換。',409);
    if(!s.members[actor.id]){if(!live(s.status))raidError('本次討伐已結束。',409);if(Object.keys(s.members).length>=RAID.maxPlayers)raidError('房間已滿。');
     const appearance=await this.choosePartner(actor,body.playerId);
     s.members[actor.id]={id:actor.id,name:actor.name,...appearance,joinOrder:Object.keys(s.members).length,damage:0,heal:0,charges:0,energy:0,correct:0,answered:0,damageOrder:0,healOrder:0,question:null,feedback:null,deck:[]};addEvent(s,'join',`${actor.name}帶著${appearance.nickname||appearance.partner.zhName}加入了討伐`,Date.now());await this.save(s);
    }
    this.broadcast(s);return json({room:this.snapshot(s,actor)});
   }
   if(!host&&!s.members[actor.id])raidError('你尚未加入這個房間。',403);
   if(path==='/socket'){
    if(req.headers.get('Upgrade')?.toLowerCase()!=='websocket')raidError('需要 WebSocket 連線。',426);
    const pair=new WebSocketPair(),[client,server]=Object.values(pair);this.ctx.acceptWebSocket(server);server.serializeAttachment(actor);server.send(JSON.stringify({type:'snapshot',room:this.snapshot(s,actor)}));this.broadcast(s);return new Response(null,{status:101,webSocket:client});
   }
   if(path==='/snapshot'){this.broadcast(s);return json({room:this.snapshot(s,actor)});}
   if(req.method!=='POST')raidError('不支援此操作。',405);
   const b=await req.json();if(typeof b.requestId!=='string'||!/^[a-zA-Z0-9_-]{16,80}$/.test(b.requestId))raidError('操作識別無效。');
   const key=`op:${actor.id}:${b.requestId}`,fingerprint=await sha(path+JSON.stringify(b));const old=await this.ctx.storage.get(key);
   if(old){if(old.fingerprint!==fingerprint)raidError('操作識別衝突。',409);return json({room:this.snapshot(s,actor),event:old.event,replayed:true});}
   const now=Date.now();let event={};
   if(['/start','/pause','/resume','/cancel'].includes(path)){
    if(!host)raidError('只有開房老師可操作。',403);
    if(path==='/start')startRoom(s,now);if(path==='/pause')pauseRoom(s,now);if(path==='/resume')resumeRoom(s,now);if(path==='/cancel'){if(!live(s.status))raidError('討伐已結束。',409);finishRoom(s,'cancelled',now);}
   }else if(path==='/partner'){
    const m=s.members[actor.id];if(!m||actor.role!=='student')raidError('只有參戰學生可以更換自己的角色。',403);if(s.status!=='waiting')raidError('討伐開始後，本場出戰角色已固定。',409);
    const appearance=await this.choosePartner(actor,b.playerId);Object.assign(m,appearance);addEvent(s,'partner',`${actor.name}改由${appearance.nickname||appearance.partner.zhName}出戰`,now);event.message='討伐出戰角色已保存，開始後本場固定使用。';
   }else{
    const m=s.members[actor.id];if(!m||actor.role!=='student')raidError('只有參戰學生可以操作。',403);if(s.status!=='active')raidError('討伐尚未開始、已暫停或已結束。',409);
    if(path==='/next')await this.nextQuestion(s,m,now);
    else if(path==='/answer'){
     const q=m.question;if(!q||q.id!==b.questionId)raidError('這題已結束，請取得最新戰況。',409);if(b.choice!==null&&!q.options.includes(b.choice))raidError('答案不在選項中。');
     const correct=b.choice!==null&&now<=q.expires&&b.choice===q.answer;
     event={questionId:q.id,correct,answerText:q.optionTexts?.[q.answer]??String(q.answer),explanation:q.explanation||'慢慢檢查運算步驟，再試一次。',timedOut:b.choice===null||now>q.expires};m.feedback=event;m.question=null;
     s.outbox.push({id:`raid_${s.code}_${m.id}_${q.id}`,kind:'answer',userId:m.id,bankId:s.bankId,question:{question:q.question,answer:q.answer,questionId:q.questionId},correct,at:now});recordHit(s,m,correct,now);
    }else if(path==='/item'){
     const proposed=structuredClone(s),event=useRaidItem(proposed,proposed.members[actor.id],b.itemId,now);
     await this.ctx.storage.put('itemIntent',{actorId:actor.id,itemId:b.itemId,key,fingerprint,event,proposed});await this.ctx.storage.setAlarm(Date.now()+1000);
     s=await this.recoverItem();this.broadcast(s);await this.flush(s);this.broadcast(s);return json({room:this.snapshot(s,actor),event});
    }else if(path==='/skill')useSkill(s,m,b.kind,now);else raidError('找不到此操作。',404);
   }
   await this.save(s,{key,value:{fingerprint,event}});this.broadcast(s);await this.flush(s);this.broadcast(s);return json({room:this.snapshot(s,actor),event});
  }catch(e){return json({error:e.status?e.message:'房間暫時無法處理，請重新取得戰況。'},e.status||500);}
 });}
 async alarm(){return this.lock(async()=>{try{await this.recoverItem();}catch{await this.ctx.storage.setAlarm(Date.now()+5000);return;}const s=await this.ctx.storage.get('room');if(!s)return;advanceRoom(s,Date.now());await this.save(s);this.broadcast(s);await this.flush(s);await this.plan(s);this.broadcast(s);});}
 async webSocketMessage(ws,message){return this.lock(async()=>{const actor=ws.deserializeAttachment();if(!actor)return;const valid=await this.env.DB.prepare('SELECT s.token_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.user_id=? AND s.expires>? AND u.must_change=0').bind(actor.tokenHash,actor.id,Date.now()).first();if(!valid){ws.close(4001,'登入已失效');return;}try{await this.recoverItem();}catch{await this.ctx.storage.setAlarm(Date.now()+5000);return;}const s=await this.ctx.storage.get('room');if(s){if(advanceRoom(s,Date.now()))await this.save(s);await this.flush(s);ws.send(JSON.stringify({type:'snapshot',room:this.snapshot(s,actor)}));}});}
 async webSocketClose(ws,code,reason,wasClean){try{ws.close(code===1005?1000:code,reason);}catch{}const s=await this.ctx.storage.get('room');if(s)this.broadcast(s);}
 webSocketError(ws){try{ws.close(1011,'連線中斷，請重新連接');}catch{}}
}
