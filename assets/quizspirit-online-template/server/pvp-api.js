import {sha} from './auth.js';import {ownedSpirit} from '../shared/ownership.js';import {partnerFor} from '../src/growth.js';import {pvpLive,pvpError} from '../shared/pvp-rules.js';import {activeActivity,claimActivity,releaseActivity} from './activity.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const actor=user=>({id:user.id,name:user.display_name,className:user.class_name,role:user.role,tokenHash:user.token_hash,sessionExpires:user.session_expires});
export const pvpStub=(env,code)=>env.PVPS.get(env.PVPS.idFromName(code));
async function forward(env,code,path,user,body,upgrade=false){const headers={'X-Battle-Actor':encodeURIComponent(JSON.stringify(actor(user)))};if(upgrade)headers.Upgrade='websocket';return pvpStub(env,code).fetch(new Request('https://pvp.internal'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)}));}
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(id);
export async function handlePvp(req,env,user,path,body){
 if(!env.PVPS)pvpError('PVP 服務尚未設定。',503);if(user.role!=='student')pvpError('PVP 由同班學生建立與加入。',403);
 if(path==='/pvp/current'&&req.method==='GET'){
  const row=await env.DB.prepare('SELECT r.code,r.host_id,r.config FROM pvp_members m JOIN pvp_rooms r ON r.code=m.room_code WHERE m.user_id=?').bind(user.id).first();if(!row)return json({room:null});const response=await forward(env,row.code,'/snapshot',user);if(response.status===404&&row.host_id===user.id)return forward(env,row.code,'/init',user,JSON.parse(row.config));return response;
 }
 if(path==='/pvp/create'&&req.method==='POST'){
  if(!validId(body.requestId))pvpError('操作識別無效。');if(!user.class_name)pvpError('請先請老師設定班級。');
  const bankId=String(body.bankId||'math-auto'),playerId=body.playerId===undefined?undefined:Number(body.playerId),fingerprint=await sha(JSON.stringify({bankId,playerId}));
  const previous=await env.DB.prepare('SELECT code,body_hash,config FROM pvp_rooms WHERE host_id=? AND request_id=?').bind(user.id,body.requestId).first();if(previous){if(previous.body_hash!==fingerprint)pvpError('操作識別內容不一致。',409);return forward(env,previous.code,'/init',user,JSON.parse(previous.config));}
  if(await activeActivity(env,user))pvpError('請先完成或離開原本的戰鬥房間。',409);
  const row=await env.DB.prepare('SELECT data FROM progress WHERE user_id=?').bind(user.id).first(),state=JSON.parse(row.data),fixed=partnerFor(state.growth);if(!fixed)pvpError('請先選定養成夥伴。');const partner=playerId===undefined?fixed:ownedSpirit(state,playerId);if(!partner)pvpError('只能選擇自己的固定夥伴或已收服角色。',403);
  let bankTitle='自動數學練習';if(bankId!=='math-auto'){const bank=await env.DB.prepare('SELECT title,data FROM banks WHERE id=?').bind(bankId).first();if(!bank||!JSON.parse(bank.data).questions.some(q=>q.status==='active'))pvpError('請選有有效題目的題庫。');bankTitle=bank.title;}
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',code=Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>chars[n%chars.length]).join(''),config={code,hostId:user.id,className:user.class_name,bankId,bankTitle,creator:{id:user.id,name:user.display_name,partner,nickname:partner.id===fixed.id?state.nickname:''}};
  try{await env.DB.batch([
   env.DB.prepare('INSERT INTO pvp_rooms(code,host_id,class_name,created_at,config,request_id,body_hash) VALUES(?,?,?,?,?,?,?)').bind(code,user.id,user.class_name,Date.now(),JSON.stringify(config),body.requestId,fingerprint),
   env.DB.prepare("INSERT INTO activity_locks(user_id,mode,room_code) VALUES(?,'pvp',?)").bind(user.id,code),
   env.DB.prepare('INSERT INTO pvp_members(user_id,room_code) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET room_code=excluded.room_code').bind(user.id,code)
  ]);}catch{const same=await env.DB.prepare('SELECT code,body_hash,config FROM pvp_rooms WHERE host_id=? AND request_id=?').bind(user.id,body.requestId).first();if(same&&same.body_hash===fingerprint)return forward(env,same.code,'/init',user,JSON.parse(same.config));pvpError('已有其他開房或加入操作，請重新讀取原房間。',409);}
  return forward(env,code,'/init',user,config);
 }
 const match=path.match(/^\/pvp\/([A-Z2-9]{6})\/(join|snapshot|socket|partner|ready|start|next|answer|potion|cancel|forfeit)$/);if(!match)pvpError('房間碼格式不正確。',404);const [,code,action]=match;
 if(['snapshot','socket'].includes(action)?req.method!=='GET':req.method!=='POST')pvpError('操作方法不正確。',405);
 const room=await env.DB.prepare('SELECT class_name FROM pvp_rooms WHERE code=?').bind(code).first();if(!room)pvpError('找不到這個 PVP 房間。',404);
 if(action==='socket'){const origin=req.headers.get('Origin');if(origin&&origin!==new URL(req.url).origin)pvpError('不允許跨網站連線。',403);}
 let added=false;
 if(action==='join'){
  if(user.class_name!==room.class_name)pvpError('只能加入自己班級的 PVP 房間。',403);
  const held=await activeActivity(env,user);if(held&&(held.mode!=='pvp'||held.room_code!==code))pvpError('你已在另一場戰鬥中，請先回到原房間。',409);
  const row=await env.DB.prepare('SELECT data FROM progress WHERE user_id=?').bind(user.id).first(),state=JSON.parse(row.data);if(!partnerFor(state.growth))pvpError('請先選定養成夥伴。');if(body.playerId!==undefined&&!ownedSpirit(state,body.playerId))pvpError('這個角色尚未收服。',403);
  const statusResponse=await forward(env,code,'/status',user);if(!statusResponse.ok)pvpError('開房者尚未準備好，請稍後再試。',409);const status=(await statusResponse.json()).status,current=await env.DB.prepare('SELECT room_code FROM pvp_members WHERE user_id=?').bind(user.id).first();if(!pvpLive(status)&&current?.room_code!==code)pvpError('這場對決已結束。',409);
  if(pvpLive(status))added=await claimActivity(env,user,'pvp',code);
  await env.DB.prepare('INSERT INTO pvp_members(user_id,room_code) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET room_code=excluded.room_code').bind(user.id,code).run();
 }
 const response=await forward(env,code,'/'+action,user,['snapshot','socket'].includes(action)?undefined:body,action==='socket');
 if(action==='join'&&!response.ok){const check=await forward(env,code,'/snapshot',user);if([403,404].includes(check.status)){await releaseActivity(env,user.id,'pvp',code);await env.DB.prepare('DELETE FROM pvp_members WHERE user_id=? AND room_code=?').bind(user.id,code).run();}}return response;
}
