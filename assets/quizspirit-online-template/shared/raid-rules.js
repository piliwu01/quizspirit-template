export const RAID={duration:600000,shield:100,attackEvery:40000,bossDamage:10,hit:10,strong:30,heal:10,energyEvery:5,maxCharges:2,maxPlayers:60,hpPerPlayer:100};
export const live=status=>['waiting','active','paused'].includes(status);
export function raidError(message,status=400){throw Object.assign(Error(message),{status});}
// Enough replay history for a 60-student burst, skills and item events.
export const RAID_EVENT_BUFFER=256;
export function addEvent(s,type,text,now,extra={}){s.sequence++;s.events.unshift({sequence:s.sequence,type,text,at:now,...extra});s.events=s.events.slice(0,RAID_EVENT_BUFFER);}
export function newRoom(config,now){return {...config,status:'waiting',createdAt:now,sequence:0,members:{},shield:100,maxShield:100,hp:0,maxHp:0,endsAt:null,nextAttackAt:null,pausedAt:null,events:[],outbox:[],rankings:null,stunUntil:0,drumUntil:0,guardCharges:0,poisons:[],poisonNextAt:null};}
export function rank(s,field){const order=field==='damage'?'damageOrder':'healOrder';return Object.values(s.members).filter(m=>m[field]>0).sort((a,b)=>b[field]-a[field]||a[order]-b[order]||a.joinOrder-b.joinOrder).slice(0,10).map((m,i)=>({id:m.id,name:m.name,partner:m.partner,nickname:m.nickname,value:m[field],rank:i+1}));}
export function finishRoom(s,status,now){
 if(!live(s.status))return;s.status=status;s.finishedAt=now;s.rankings={damage:rank(s,'damage'),heal:rank(s,'heal')};
 addEvent(s,'finish',({won:'魔王被擊敗！全班一起守住了這裡。',lost:'護盾歸零，本次討伐結束。',timeout:'時間到，謝謝每一位夥伴的努力。',cancelled:'老師已提前結束本次討伐。'})[status],now);
 for(const m of Object.values(s.members)){
  const damageRank=s.rankings.damage.find(r=>r.id===m.id)?.rank||null,healRank=s.rankings.heal.find(r=>r.id===m.id)?.rank||null;
  const badges=status==='cancelled'?[]:[...(damageRank?['破陣先鋒']:[]),...(healRank?['守護之星']:[])];
  s.outbox.push({id:`raid_${s.code}_${m.id}_result`,kind:'result',userId:m.id,roomCode:s.code,at:now,summary:{roomCode:s.code,outcome:status,damage:m.damage,heal:m.heal,answered:m.answered,correct:m.correct,damageRank,healRank,badges,food:badges.length*3,at:now}});
 }
}
export function advanceRoom(s,now){
 if(s.status!=='active')return false;let changed=false;
 while(true){const poisonTime=s.poisons?.length?s.poisonNextAt:Infinity,time=Math.min(s.nextAttackAt,poisonTime);if(time>now||time>=s.endsAt)break;changed=true;
  if(poisonTime<=s.nextAttackAt){const dose=s.poisons[0],m=s.members[dose.actorId];dose.ticks--;if(dose.ticks===0)s.poisons.shift();s.poisonNextAt=s.poisons.length?time+5000:null;const amount=Math.min(10,s.hp);s.hp-=amount;m.damage+=amount;addEvent(s,'poison',`${m.name}的毒霧造成 ${amount} 點傷害`,time,{actorId:m.id,value:amount});m.damageOrder=s.sequence;if(s.hp===0){finishRoom(s,'won',time);return true;}}
  else {s.nextAttackAt+=RAID.attackEvery;const guarded=(s.guardCharges||0)>0;if(guarded)s.guardCharges--;const amount=RAID.bossDamage-(guarded?5:0);s.shield=Math.max(0,s.shield-amount);addEvent(s,'boss',`魔王反擊！全班護盾 −${amount}${guarded?'（守護結晶減傷 5 點）':''}`,time);if(s.shield===0){finishRoom(s,'lost',time);return true;}}
 }
 if(now>=s.endsAt){finishRoom(s,'timeout',s.endsAt);changed=true;}return changed;
}
export function startRoom(s,now){if(s.status!=='waiting')raidError('房間已開始或結束。',409);const n=Object.keys(s.members).length;if(!n)raidError('至少要有 1 位學生加入。');s.status='active';s.maxHp=s.hp=s.customHp||n*RAID.hpPerPlayer;s.endsAt=now+s.duration;s.nextAttackAt=now+RAID.attackEvery;addEvent(s,'start',`${n} 位冒險者集結，討伐開始！`,now);}
export function pauseRoom(s,now){advanceRoom(s,now);if(s.status!=='active')raidError('目前無法暫停。',409);s.status='paused';s.pausedAt=now;addEvent(s,'pause','老師暫停了討伐，計時與題目一起休息。',now);}
export function resumeRoom(s,now){if(s.status!=='paused')raidError('房間目前沒有暫停。',409);const delay=now-s.pausedAt;s.endsAt+=delay;s.nextAttackAt+=delay;if(s.poisonNextAt)s.poisonNextAt+=delay;for(const field of ['stunUntil','drumUntil'])if(s[field]>s.pausedAt)s[field]+=delay;for(const m of Object.values(s.members))if(m.question)m.question.expires+=delay;s.status='active';s.pausedAt=null;addEvent(s,'resume','大家準備好了，繼續討伐！',now);}
export function recordHit(s,m,correct,now){
 m.answered++;if(!correct)return;m.correct++;const damage=Math.min(RAID.hit+(s.drumUntil>now?5:0),s.hp);s.hp-=damage;m.damage+=damage;
 addEvent(s,'hit',`${m.name}與${m.nickname||m.partner.zhName}造成 ${damage} 點傷害`,now,{actorId:m.id,value:damage});m.damageOrder=s.sequence;
 if(m.charges<RAID.maxCharges){m.energy++;if(m.energy===RAID.energyEvery){m.energy=0;m.charges++;}}
 if(s.hp===0)finishRoom(s,'won',now);
}
export function useRaidItem(s,m,id,now){
 if(s.status!=='active')raidError('請在進行中的討伐使用道具。',409);
 let message;
 if(id==='shield'){const amount=Math.min(10,s.maxShield-s.shield);if(amount<=0)raidError('護盾已滿，不消耗補給包。');s.shield+=amount;m.heal+=amount;addEvent(s,'heal',`${m.name}使用補給包，修復 ${amount} 點護盾`,now,{actorId:m.id,value:amount});m.healOrder=s.sequence;return {message:`已回復 ${amount} 點全班護盾。`};}
 if(id==='fire'){const amount=Math.min(30,s.hp);s.hp-=amount;m.damage+=amount;addEvent(s,'fire',`${m.name}投出火焰瓶，造成 ${amount} 點傷害`,now,{actorId:m.id,value:amount});m.damageOrder=s.sequence;if(s.hp===0)finishRoom(s,'won',now);return {message:`火焰瓶造成 ${amount} 點傷害。`};}
 if(id==='energy'){if(m.charges>=RAID.maxCharges)raidError('技能機會已滿，不消耗能量果實。');m.charges++;message=`${m.name}使用能量果實，技能機會 ＋1`;}
 else if(id==='stun'){s.stunUntil=Math.max(now,s.stunUntil||0)+10000;s.nextAttackAt+=10000;message=`${m.name}投出暈眩彈，魔王多暈眩 10 秒`;}
 else if(id==='poison'){s.poisons||=[];const last=s.poisons.at(-1);if(last?.actorId===m.id)last.ticks+=6;else s.poisons.push({actorId:m.id,ticks:6});if(!s.poisonNextAt)s.poisonNextAt=now+5000;message=`${m.name}施放毒霧，增加 6 次毒傷`;}
 else if(id==='guard'){s.guardCharges=(s.guardCharges||0)+1;message=`${m.name}放置守護結晶，增加 1 波減傷保護`;}
 else if(id==='drum'){s.drumUntil=Math.max(now,s.drumUntil||0)+20000;message=`${m.name}敲響戰鼓，全班答對加傷延長 20 秒`;}
 else raidError('無效的討伐道具。');addEvent(s,id,message,now,{actorId:m.id});return {message};
}
export function useSkill(s,m,kind,now){
 if(s.status!=='active')raidError('討伐未進行中。',409);if(m.charges<1)raidError('技能能量不足。');
 if(kind==='strong'){const damage=Math.min(RAID.strong,s.hp);s.hp-=damage;m.damage+=damage;m.charges--;addEvent(s,'strong',`${m.name}發動強力攻擊！造成 ${damage} 點傷害`,now,{actorId:m.id,value:damage});m.damageOrder=s.sequence;if(s.hp===0)finishRoom(s,'won',now);}
 else if(kind==='heal'){const healed=Math.min(RAID.heal,s.maxShield-s.shield);if(!healed)raidError('護盾已滿，不消耗技能。');s.shield+=healed;m.heal+=healed;m.charges--;addEvent(s,'heal',`${m.name}修復 ${healed} 點全班護盾`,now,{actorId:m.id,value:healed});m.healOrder=s.sequence;}
 else raidError('技能無效。');
}
