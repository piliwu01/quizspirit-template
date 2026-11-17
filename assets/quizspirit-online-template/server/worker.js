import {freshState,publicState,applyAction,fail} from '../shared/game.js';
import {hashPassword,checkPassword,validatePassword,newSession,getUser,visibleUser,sha,cookie,randomToken} from './auth.js';
import {validateBank} from '../src/question-bank.js';
import {handleRaid,currentMembership} from './raid-api.js';
import {handlePvp} from './pvp-api.js';
import {activeActivity} from './activity.js';
export {RaidRoom} from './raid-room.js';
export {PvpRoom} from './pvp-room.js';

const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
async function bodyOf(req){const reader=req.body?.getReader();if(!reader)return {};let size=0,chunks=[];for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>5*1024*1024){await reader.cancel();fail('內容超過 5 MB。',413);}chunks.push(value);}const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail('資料格式不正確。');}}
async function stateOf(db,id){const row=await db.prepare('SELECT * FROM progress WHERE user_id=?').bind(id).first();if(!row)fail('找不到養成進度。',500);return row;}
async function mutate(db,user,route,body,bank){
 const requestId=body.requestId;if(typeof requestId!=='string'||!/^[a-zA-Z0-9_-]{16,80}$/.test(requestId))fail('操作識別無效，請重新操作。');
 const fingerprint=await sha(route+JSON.stringify(body));
 for(let retry=0;retry<5;retry++){
  const previous=await db.prepare('SELECT route,result FROM operations WHERE user_id=? AND request_id=?').bind(user.id,requestId).first();
  if(previous){if(previous.route!==fingerprint)fail('操作識別重複，內容不一致。',409);return {state:publicState(JSON.parse((await stateOf(db,user.id)).data)),event:JSON.parse(previous.result),replayed:true};}
  const row=await stateOf(db,user.id),state=JSON.parse(row.data);const event=applyAction(state,route,body,Date.now(),bank);const guard=crypto.randomUUID();
  try{await db.batch([
   db.prepare('UPDATE progress SET data=?,version=version+1 WHERE user_id=? AND version=?').bind(JSON.stringify(state),user.id,row.version),
   db.prepare('INSERT INTO state_guards(id,ok) VALUES(?,changes())').bind(guard),
   db.prepare('INSERT INTO operations(user_id,request_id,route,result,created_at) VALUES(?,?,?,?,?)').bind(user.id,requestId,fingerprint,JSON.stringify(event),Date.now()),
   db.prepare('DELETE FROM state_guards WHERE id=?').bind(guard)
  ]);return {state:publicState(state),event};}catch(e){if(retry===4)throw Object.assign(Error('有另一台裝置正在更新，請重新載入後再試。'),{status:409});}
 }
}
async function route(req,env){
 const url=new URL(req.url),path=url.pathname.replace(/^\/api/,'');const db=env.DB;
 if(!url.pathname.startsWith('/api/')){const response=await env.ASSETS.fetch(req);const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');return new Response(response.body,{status:response.status,headers});}
 if(!['GET','POST'].includes(req.method))fail('不支援此操作。',405);
 if(req.method==='POST'){
  if(req.headers.get('X-QuizSpirit')!=='1')fail('請從網站內操作。',403);
  const origin=req.headers.get('Origin');if(origin&&origin!==url.origin)fail('不允許跨網站操作。',403);
 }
 if(path==='/health')return json({ok:true});
 const body=req.method==='POST'?await bodyOf(req):{};
 if(path==='/login'&&req.method==='POST'){
  const username=String(body.username||'').trim().toLowerCase(),password=String(body.password||'');if(username.length>40||password.length>128)fail('帳號或密碼不正確。',401);
  const key=await sha((req.headers.get('CF-Connecting-IP')||'local')+':'+username);const window=Math.floor(Date.now()/900000);const id=key+':'+window;
  const limit=await db.prepare('INSERT INTO login_limits(id,attempts,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(id,Date.now()+900000).first();
  if(limit.attempts>10)fail('嘗試次數過多，請稍後再試或請老師協助。',429);
  const user=await db.prepare('SELECT * FROM users WHERE username=?').bind(username).first();const valid=await checkPassword(password,user?.password);if(!valid)fail('帳號或密碼不正確。',401);
  return json({user:visibleUser(user)},200,{'Set-Cookie':await newSession(db,user.id,req.url)});
 }
 const user=await getUser(db,req);if(!user)fail('請先登入。',401);
 if(path==='/me'&&req.method==='GET')return json({user:visibleUser(user),state:publicState(JSON.parse((await stateOf(db,user.id)).data))});
 if(path==='/logout'&&req.method==='POST'){await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(user.token_hash).run();return json({ok:true},200,{'Set-Cookie':cookie('',req.url,true)});}
 if(path==='/password'&&req.method==='POST'){
  validatePassword(body.password);if(body.password===body.currentPassword)fail('新密碼不能與原密碼相同。');if(!await checkPassword(String(body.currentPassword||''),user.password))fail('目前密碼不正確。',403);
  const password=await hashPassword(body.password);await db.batch([db.prepare('UPDATE users SET password=?,must_change=0 WHERE id=? AND password=?').bind(password,user.id,user.password),db.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id)]);
  return json({ok:true},200,{'Set-Cookie':await newSession(db,user.id,req.url)});
 }
 if(user.must_change)fail('請先更改初始密碼。',403);
 if(path.startsWith('/pvp/'))return handlePvp(req,env,user,path,body);
 if(path.startsWith('/raid/'))return handleRaid(req,env,user,path,body);
 if(path==='/banks'&&req.method==='GET'){const {results}=await db.prepare('SELECT id,title,data FROM banks ORDER BY created_at').all();return json({banks:results.map(r=>({bankId:r.id,title:r.title,count:JSON.parse(r.data).questions.filter(q=>q.status==='active').length}))});}
 if(path.startsWith('/admin/')){
  if(user.role!=='teacher')fail('只有老師可以使用此功能。',403);
  if(path==='/admin/users'&&req.method==='GET'){const {results}=await db.prepare("SELECT id,username,display_name,class_name,must_change FROM users WHERE role='student' ORDER BY class_name,username").all();return json({users:results});}
  if(path==='/admin/users'&&req.method==='POST'){
   const rows=body.students;if(!Array.isArray(rows)||rows.length<1||rows.length>50)fail('每次請建立 1～50 個帳號。');const ids=new Set(),statements=[],credentials=[];
   for(const r of rows){const name=String(r.username||'').trim().toLowerCase(),display=String(r.displayName||name).trim(),className=String(r.className||'').trim();if(!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(name)||ids.has(name)||display.length>40||className.length>30)fail('帳號需為 3～32 碼英文小寫、數字、底線或連字號，且不可重複。');ids.add(name);const id=crypto.randomUUID(),password=randomToken().slice(0,16);statements.push(db.prepare("INSERT INTO users(id,username,display_name,class_name,role,password,created_at) VALUES(?,?,?,?,'student',?,?)").bind(id,name,display,className,await hashPassword(password),Date.now()),db.prepare('INSERT INTO progress(user_id,data) VALUES(?,?)').bind(id,JSON.stringify(freshState())));credentials.push({username:name,displayName:display,className,password});}
   try{await db.batch(statements);}catch{fail('有帳號已存在，本批次未建立，請檢查後再試。',409);}return json({credentials});
  }
  if(path==='/admin/reset'&&req.method==='POST'){
   const target=await db.prepare("SELECT id FROM users WHERE id=? AND role='student'").bind(String(body.userId)).first();if(!target)fail('找不到學生帳號。',404);const password=randomToken().slice(0,16);
   await db.batch([db.prepare('UPDATE users SET password=?,must_change=1 WHERE id=?').bind(await hashPassword(password),target.id),db.prepare('DELETE FROM sessions WHERE user_id=?').bind(target.id)]);return json({password});
  }
  if(path==='/admin/banks'&&req.method==='POST'){
   const bank=body.bank,result=validateBank(bank);if(!result.ok)fail(result.errors.slice(0,3).join('；'));if(bank.questions.length>2000)fail('每份題庫最多 2,000 題。');
   try{await db.prepare('INSERT INTO banks(id,title,data,created_at) VALUES(?,?,?,?)').bind(bank.bankId,bank.title,JSON.stringify(bank),Date.now()).run();}catch{fail('題庫 ID 已存在，請使用新的版本 ID。',409);}return json({ok:true,count:result.active});
  }
  fail('找不到此管理功能。',404);
 }
 if(req.method!=='POST')fail('找不到此功能。',404);
 const allowed=['/starter','/nickname','/feed','/shop/buy','/bag/use','/battle/start','/question','/answer','/challenge/start','/challenge/answer','/challenge/next','/challenge/leave','/claim','/evolve','/bank/change'];if(!allowed.includes(path))fail('找不到此操作。',404);
 if(env.RAIDS&&['/bag/use','/battle/start','/question','/answer','/challenge/start','/challenge/answer','/challenge/next','/evolve'].includes(path)){const member=await currentMembership(env,user);if(member&&['waiting','active','paused'].includes(member.status))fail('你正在共同討伐房間中，請先回到討伐。',409);}
 if(env.PVPS&&['/bag/use','/battle/start','/question','/answer','/challenge/start','/challenge/answer','/challenge/next','/evolve'].includes(path)){const activity=await activeActivity(env,user);if(activity?.mode==='pvp')fail('你正在 PVP 房間中，請先回到對決。',409);}
 let bank=null;if(body.bankId&&body.bankId!=='math-auto'){const row=await db.prepare('SELECT data FROM banks WHERE id=?').bind(String(body.bankId)).first();if(!row)fail('找不到題庫，請重新選擇。',404);bank=JSON.parse(row.data);}
 return json(await mutate(db,user,path,body,bank));
}
export default {async fetch(req,env){try{return await route(req,env);}catch(error){return json({error:error.status?error.message:'服務暫時無法完成，請稍後再試。'},error.status||500);}}};
