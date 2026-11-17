import {pvpError} from '../shared/pvp-rules.js';
const live=status=>['waiting','active','paused'].includes(status);
export async function activityStatus(env,user,lock){
 const ns=lock.mode==='raid'?env.RAIDS:env.PVPS;if(!ns)pvpError('戰鬥服務尚未就緒。',503);
 const actor={id:user.id,name:user.display_name,className:user.class_name,role:user.role,tokenHash:user.token_hash,sessionExpires:user.session_expires};
 const response=await ns.get(ns.idFromName(lock.room_code)).fetch(new Request('https://battle.internal/status',{headers:{'X-Battle-Actor':encodeURIComponent(JSON.stringify(actor)),'X-Raid-Actor':encodeURIComponent(JSON.stringify(actor))}}));
 if(!response.ok)pvpError('請先回到原本戰鬥房間，確認狀態後再加入。',409);return (await response.json()).status;
}
export async function activeActivity(env,user){
 const lock=await env.DB.prepare('SELECT mode,room_code FROM activity_locks WHERE user_id=?').bind(user.id).first();if(!lock)return null;
 if(live(await activityStatus(env,user,lock)))return lock;
 await env.DB.prepare('DELETE FROM activity_locks WHERE user_id=? AND mode=? AND room_code=?').bind(user.id,lock.mode,lock.room_code).run();return null;
}
export async function claimActivity(env,user,mode,code){
 let lock=await env.DB.prepare('SELECT mode,room_code FROM activity_locks WHERE user_id=?').bind(user.id).first();if(lock?.mode===mode&&lock.room_code===code)return false;
 if(await activeActivity(env,user))pvpError('你已在另一場戰鬥中，請先回到原房間。',409);
 await env.DB.prepare('INSERT OR IGNORE INTO activity_locks(user_id,mode,room_code) VALUES(?,?,?)').bind(user.id,mode,code).run();lock=await env.DB.prepare('SELECT mode,room_code FROM activity_locks WHERE user_id=?').bind(user.id).first();if(lock?.mode!==mode||lock.room_code!==code)pvpError('已有另一個加入操作，請回到原房間。',409);return true;
}
export const releaseActivity=(env,userId,mode,code)=>env.DB.prepare('DELETE FROM activity_locks WHERE user_id=? AND mode=? AND room_code=?').bind(userId,mode,code).run();
