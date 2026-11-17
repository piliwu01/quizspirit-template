import {bagOf,itemById} from '../shared/items.js';import {sha} from './auth.js';
const fail=(message,status)=>{throw Object.assign(Error(message),{status});};
export const consumeRaidItem=(db,intent)=>consumeItem(db,intent,'raid');
export const consumePvpPotion=(db,intent)=>consumeItem(db,intent,'pvp');
async function consumeItem(db,intent,scope){
 const {actorId,itemId,key}=intent,requestId='item:'+key,fingerprint=await sha(key+':'+itemId);
 if(scope==='pvp'?itemId!=='potion':itemById(itemId)?.scope!=='raid')fail('無效的討伐道具。',400);
 for(let retry=0;retry<6;retry++){
  const prior=await db.prepare('SELECT route,result FROM operations WHERE user_id=? AND request_id=?').bind(actorId,requestId).first();if(prior){if(prior.route!==fingerprint)fail('道具識別衝突。',409);return JSON.parse(prior.result);}
  const row=await db.prepare('SELECT data,version FROM progress WHERE user_id=?').bind(actorId).first();if(!row)fail('找不到個人背包。',404);const state=JSON.parse(row.data),bag=bagOf(state);if(bag[itemId]<1)fail('背包沒有這個道具，請先到補給商店購買。',400);bag[itemId]--;state.bag=bag;const guard=crypto.randomUUID(),result={bag};
  try{await db.batch([
   db.prepare('UPDATE progress SET data=?,version=version+1 WHERE user_id=? AND version=?').bind(JSON.stringify(state),actorId,row.version),
   db.prepare('INSERT INTO state_guards(id,ok) VALUES(?,changes())').bind(guard),
   db.prepare('INSERT INTO operations(user_id,request_id,route,result,created_at) VALUES(?,?,?,?,?)').bind(actorId,requestId,fingerprint,JSON.stringify(result),Date.now()),
   db.prepare('DELETE FROM state_guards WHERE id=?').bind(guard)
  ]);return result;}catch(e){if(retry===5)throw e;}
 }
}
