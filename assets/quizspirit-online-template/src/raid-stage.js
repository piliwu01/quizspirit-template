// Presentation only: no HP, rewards or room state is calculated here.
export const EFFECT_LIFETIME=1900;
export const RECENT_EVENT_WINDOW=5000;
export const visualTypes=new Set(['hit','strong','heal','fire','energy','stun','poison','guard','drum','boss']);
export function roomIdentity(room){return `${room.code}:${room.createdAt}`;}
export function collectStageEvents(cursor,room){
 const identity=roomIdentity(room),sequence=Number(room.sequence)||0;
 if(!cursor||cursor.identity!==identity)return {cursor:{identity,sequence},events:[]};
 if(sequence<=cursor.sequence)return {cursor,events:[]};
 const events=(room.events||[]).filter(e=>e.sequence>cursor.sequence&&e.sequence<=sequence&&visualTypes.has(e.type)&&room.serverNow-e.at<=RECENT_EVENT_WINDOW&&room.serverNow>=e.at).sort((a,b)=>a.sequence-b.sequence);
 return {cursor:{identity,sequence},events};
}
export function formation(members){
 const columns=Math.min(10,Math.max(3,Math.ceil(Math.sqrt(members.length*1.6)))),rows=Math.max(1,Math.ceil(members.length/columns));
 return members.map((member,i)=>({...member,x:49+(i%columns)*46/Math.max(1,columns-1),y:rows===1?55:30+Math.floor(i/columns)*47/Math.max(1,rows-1)}));
}
export function effectLabel(e){
 if(['hit','strong','fire'].includes(e.type))return `${e.type==='strong'?'強攻 ':e.type==='fire'?'火焰 ':''}−${e.value}`;
 if(e.type==='heal')return `護盾 ＋${e.value}`;
 if(e.type==='boss')return e.text;
 if(e.type==='poison'&&Number.isFinite(e.value))return `毒傷 −${e.value}`;
 return {energy:'能量 ＋1',stun:'暈眩 10 秒',poison:'毒霧施放',guard:'守護結晶',drum:'團隊戰鼓'}[e.type]||'';
}
