const enc=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
export const randomToken=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export const sha=async text=>hex(await crypto.subtle.digest('SHA-256',enc.encode(text)));
export async function hashPassword(password,salt=hex(crypto.getRandomValues(new Uint8Array(16)))){
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations:100000},key,256);
 return `pbkdf2-sha256$100000$${salt}$${hex(bits)}`;
}
export async function checkPassword(password,stored){const salt=stored?.split('$')[2]||'00000000000000000000000000000000';const actual=await hashPassword(password,salt);if(!stored||actual.length!==stored.length)return false;let diff=0;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^stored.charCodeAt(i);return diff===0;}
export function validatePassword(value){if(typeof value!=='string'||value.length<12||value.length>128)throw Object.assign(Error('新密碼請使用 12～128 個字元。'),{status:400});}
export function cookie(token,url,clear=false){return `quizspirit_raid_session=${clear?'':token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear?0:604800}${new URL(url).protocol==='https:'?'; Secure':''}`;}
export async function newSession(db,id,url){const token=randomToken();await db.prepare('INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)').bind(await sha(token),id,Date.now()+604800000).run();return cookie(token,url);}
export async function getUser(db,request){const token=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('quizspirit_raid_session='))?.slice('quizspirit_raid_session='.length);if(!token||!/^[a-f0-9]{64}$/.test(token))return null;return db.prepare('SELECT u.*,s.token_hash,s.expires AS session_expires FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?').bind(await sha(token),Date.now()).first();}
export const visibleUser=u=>({id:u.id,username:u.username,displayName:u.display_name,className:u.class_name,role:u.role,mustChange:!!u.must_change});
