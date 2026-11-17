import {recordAnswer} from '../src/growth.js';import {taipeiDate} from '../shared/game.js';import {sha} from './auth.js';
export async function settleRaidAward(db,entry){
 const fingerprint=await sha(JSON.stringify(entry));
 for(let retry=0;retry<6;retry++){
  const done=await db.prepare('SELECT route FROM operations WHERE user_id=? AND request_id=?').bind(entry.userId,entry.id).first();if(done){if(done.route!==fingerprint)throw Error('獎勵識別衝突');return;}
  const row=await db.prepare('SELECT data,version FROM progress WHERE user_id=?').bind(entry.userId).first();if(!row)throw Error('找不到學生進度');const state=JSON.parse(row.data);
  if(entry.kind==='answer'){
   const r=recordAnswer(state.growth,entry.bankId,entry.question,entry.correct);state.growth=r.state;
   if(r.reward?.complete){state.food++;const day=taipeiDate(entry.at);if(!state.roundDays.includes(day))state.roundDays.push(day);}
  }else if(entry.kind==='pvpResult'){
   state.pvpHistory=[entry.summary,...(state.pvpHistory||[]).filter(x=>x.roomCode!==entry.summary.roomCode)].slice(0,40);
  }else{
   state.food+=entry.summary.food;state.raidHistory=[entry.summary,...(state.raidHistory||[]).filter(x=>x.roomCode!==entry.roomCode)].slice(0,40);
   state.badges=[...new Set([...(state.badges||[]),...entry.summary.badges])];
  }
  const guard=crypto.randomUUID();try{await db.batch([
   db.prepare('UPDATE progress SET data=?,version=version+1 WHERE user_id=? AND version=?').bind(JSON.stringify(state),entry.userId,row.version),
   db.prepare('INSERT INTO state_guards(id,ok) VALUES(?,changes())').bind(guard),
   db.prepare('INSERT INTO operations(user_id,request_id,route,result,created_at) VALUES(?,?,?,?,?)').bind(entry.userId,entry.id,fingerprint,'{}',entry.at),
   db.prepare('DELETE FROM state_guards WHERE id=?').bind(guard)
  ]);return;}catch(e){if(retry===5)throw e;}
 }
}
