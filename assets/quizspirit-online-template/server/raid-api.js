import {sha} from './auth.js';import {RAID,live,raidError} from '../shared/raid-rules.js';
import {ownedSpirit} from '../shared/ownership.js';
import {claimActivity,releaseActivity} from './activity.js';
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const actorOf=user=>({id:user.id,name:user.display_name,className:user.class_name,role:user.role,tokenHash:user.token_hash,sessionExpires:user.session_expires});
export const roomStub=(env,code)=>env.RAIDS.get(env.RAIDS.idFromName(code));
async function forward(env,code,path,user,body,upgrade=false){const headers={'X-Raid-Actor':encodeURIComponent(JSON.stringify(actorOf(user)))};if(upgrade)headers.Upgrade='websocket';return roomStub(env,code).fetch(new Request('https://raid.internal'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)}));}
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(id);
export async function currentMembership(env,user){const row=await env.DB.prepare('SELECT room_code FROM raid_members WHERE user_id=?').bind(user.id).first();if(!row)return null;const r=await forward(env,row.room_code,'/status',user);const s=await r.json();return {...row,status:s.status};}
export async function handleRaid(req,env,user,path,body){
 if(!env.RAIDS)raidError('討伐服務尚未設定。',503);
 if(path==='/raid/current'&&req.method==='GET'){
  const row=user.role==='teacher'?await env.DB.prepare('SELECT code,config FROM raid_rooms WHERE host_id=? ORDER BY created_at DESC LIMIT 1').bind(user.id).first():await env.DB.prepare('SELECT room_code AS code FROM raid_members WHERE user_id=?').bind(user.id).first();if(!row)return json({room:null});const response=await forward(env,row.code,'/snapshot',user);if(response.status===404&&user.role==='teacher'&&row.config){const config=JSON.parse(row.config);if(config.code===row.code&&config.hostId===user.id)return forward(env,row.code,'/init',user,config);}return response;
 }
 if(path==='/raid/create'&&req.method==='POST'){
  if(user.role!=='teacher')raidError('只有老師可以開房。',403);if(!validId(body.requestId))raidError('操作識別無效。');
  const className=String(body.className||'').trim(),minutes=Number(body.minutes??10),customHp=body.bossHp?Number(body.bossHp):null,bankId=String(body.bankId||'math-auto');
  if(!className||className.length>30||!Number.isInteger(minutes)||minutes<1||minutes>30||(customHp!==null&&(!Number.isInteger(customHp)||customHp<50||customHp>100000)))raidError('請填班級、1～30 分鐘時間，以及有效魔王血量。');
  let bankTitle='自動數學練習';if(bankId!=='math-auto'){const bank=await env.DB.prepare('SELECT title,data FROM banks WHERE id=?').bind(bankId).first();if(!bank||!JSON.parse(bank.data).questions.some(x=>x.status==='active'))raidError('請選擇有有效題目的題庫。');bankTitle=bank.title;}
  const hash=await sha(JSON.stringify({className,minutes,customHp,bankId}));let row=await env.DB.prepare('SELECT code,body_hash FROM raid_rooms WHERE host_id=? AND request_id=?').bind(user.id,body.requestId).first();
  if(row&&row.body_hash!==hash)raidError('操作識別衝突。',409);
  if(!row){
   const old=await env.DB.prepare("SELECT code FROM raid_rooms WHERE host_id=? AND status IN ('waiting','active','paused') ORDER BY created_at DESC LIMIT 1").bind(user.id).first();if(old){const data=await (await forward(env,old.code,'/status',user)).json();if(live(data.status))raidError('請先回到原房間，結束後再建立下一場。',409);}
   const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code='';for(const x of crypto.getRandomValues(new Uint8Array(6)))code+=chars[x%chars.length];
   const config={code,hostId:user.id,className,bankId,bankTitle,duration:minutes*60000,customHp};
   try{await env.DB.prepare('INSERT INTO raid_rooms(code,host_id,class_name,created_at,request_id,body_hash,config) VALUES(?,?,?,?,?,?,?)').bind(code,user.id,className,Date.now(),body.requestId,hash,JSON.stringify(config)).run();row={code,body_hash:hash};}catch{row=await env.DB.prepare('SELECT code,body_hash FROM raid_rooms WHERE host_id=? AND request_id=?').bind(user.id,body.requestId).first();if(!row)raidError('房間碼建立失敗，請重試。',409);}
  }
  return forward(env,row.code,'/init',user,{code:row.code,hostId:user.id,className,bankId,bankTitle,duration:minutes*60000,customHp});
 }
 const match=path.match(/^\/raid\/([A-Z2-9]{6})\/(join|partner|snapshot|socket|start|pause|resume|cancel|next|answer|skill|item)$/);if(!match)raidError('房間碼格式不正確。',404);const [,code,action]=match;
 if(['snapshot','socket'].includes(action)&&req.method!=='GET')raidError('請使用 GET。',405);if(!['snapshot','socket'].includes(action)&&req.method!=='POST')raidError('請使用 POST。',405);
 const row=await env.DB.prepare('SELECT class_name FROM raid_rooms WHERE code=?').bind(code).first();if(!row)raidError('找不到這個房間。',404);
 if(action==='socket'){const origin=req.headers.get('Origin');if(origin&&origin!==new URL(req.url).origin)raidError('不允許跨網站連線。',403);}
 let membershipAdded=false,activityAdded=false;
 if(action==='join'){
  if(user.role!=='student'||user.class_name!==row.class_name)raidError('只能加入自己班級的房間。',403);
  const current=await currentMembership(env,user);if(current&&current.room_code!==code&&live(current.status))raidError('你已在另一場討伐中，請先回到該房間。',409);
  const p=await env.DB.prepare('SELECT data FROM progress WHERE user_id=?').bind(user.id).first(),state=JSON.parse(p.data);if(!state.growth.starter)raidError('先回養成頁選定專屬夥伴。');if(body.playerId!==undefined&&!ownedSpirit(state,body.playerId))raidError('只能選擇自己的固定夥伴或已收服角色。',403);
  const status=await (await forward(env,code,'/status',user)).json();if(!live(status.status)&&current?.room_code!==code)raidError('本次討伐已結束。',409);
  if(env.PVPS&&live(status.status))activityAdded=await claimActivity(env,user,'raid',code);
  if(current&&current.room_code!==code)await env.DB.prepare('DELETE FROM raid_members WHERE user_id=? AND room_code=?').bind(user.id,current.room_code).run();
  await env.DB.prepare('INSERT OR IGNORE INTO raid_members(user_id,room_code) VALUES(?,?)').bind(user.id,code).run();const confirmed=await currentMembership(env,user);if(confirmed.room_code!==code)raidError('已有其他加入操作，請重新取得房間。',409);membershipAdded=current?.room_code!==code;
 }
 const response=await forward(env,code,'/'+action,user,action==='socket'||action==='snapshot'?undefined:body,action==='socket');
 if(action==='join'&&!response.ok){const check=await forward(env,code,'/snapshot',user);if([403,404].includes(check.status)){if(env.PVPS)await releaseActivity(env,user.id,'raid',code);await env.DB.prepare('DELETE FROM raid_members WHERE user_id=? AND room_code=?').bind(user.id,code).run();}}return response;
}
