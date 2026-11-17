import React,{useEffect,useRef,useState} from 'react';
import {Swords,Shield,Clock,Zap,Users} from 'lucide-react';
import {collectStageEvents,formation,effectLabel,EFFECT_LIFETIME,roomIdentity} from './raid-stage.js';
import './raid-stage.css';

const clock=n=>`${String(Math.floor(Math.max(0,n)/60)).padStart(2,'0')}:${String(Math.max(0,n)%60).padStart(2,'0')}`;
export function RaidVitals({room,remaining,strike,compact=false}){
 return <div className={`raid-vitals ${compact?'is-compact':''}`}>
  <div className="vital-boss"><span><Swords size={14}/>魔王生命</span><b>{room.hp.toLocaleString()}<small> / {room.maxHp.toLocaleString()||'等待開戰'}</small></b><div className="raid-meter boss-meter" role="progressbar" aria-label="魔王生命值" aria-valuemin={0} aria-valuemax={room.maxHp||1} aria-valuenow={room.hp}><span style={{width:`${room.maxHp?room.hp/room.maxHp*100:100}%`}}/></div></div>
  <div className={`vital-shield ${room.shield<=30?'danger':''}`}><span><Shield size={14}/>全班護盾</span><b>{room.shield}<small> / 100</small></b><div className="raid-meter shield-meter" role="progressbar" aria-label="全班護盾" aria-valuemin={0} aria-valuemax={100} aria-valuenow={room.shield}><span style={{width:`${room.shield}%`}}/></div></div>
  <div className="vital-clock"><span><Clock size={14}/>剩餘時間</span><b>{clock(remaining)}</b></div>
  <div className="vital-strike"><span><Zap size={14}/>魔王反擊</span><b>{['active','paused'].includes(room.status)?`${strike}s`:'—'}</b></div>
 </div>;
}
export function RaidStatuses({room,now}){
 return <div className="stage-statuses">{room.stunUntil>now&&<span>💫 暈眩 {Math.ceil((room.stunUntil-now)/1000)} 秒</span>}{room.poisonTicks>0&&<span>🧪 毒傷剩 {room.poisonTicks} 次</span>}{room.guardCharges>0&&<span>💎 守護 {room.guardCharges} 波</span>}{room.drumUntil>now&&<span>🥁 戰鼓 {Math.ceil((room.drumUntil-now)/1000)} 秒</span>}</div>;
}
export default function RaidStage({room,now,remaining,strike}){
 const cursor=useRef(null),effectId=useRef(0),arenaRef=useRef(null),[size,setSize]=useState({width:1200,height:600}),[effects,setEffects]=useState([]),[reduced,setReduced]=useState(false);
 const positions=formation(room.members),members=new Map(positions.map(m=>[m.id,m]));
 const columns=Math.min(10,Math.max(3,Math.ceil(Math.sqrt(room.members.length*1.6)))),rows=Math.max(1,Math.ceil(room.members.length/columns));
 const spriteSize=Math.max(20,Math.min(90,size.width*.065,size.width*.46/columns*.9,size.height*.47/Math.max(1,rows-1)-(room.members.length>36?24:40)));
 useEffect(()=>{const observer=new ResizeObserver(entries=>{const {width,height}=entries[0].contentRect;setSize({width,height});});observer.observe(arenaRef.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(media.matches);change();media.addEventListener('change',change);return()=>media.removeEventListener('change',change);
 },[]);
 useEffect(()=>{
  const switched=cursor.current?.identity!==roomIdentity(room),result=collectStageEvents(cursor.current,room);cursor.current=result.cursor;
  const incoming=result.events.map(e=>({...e,key:++effectId.current,remaining:EFFECT_LIFETIME}));
  setEffects(previous=>switched?[]:[...previous,...incoming]);
 },[room]);
 useEffect(()=>{
  if(room.status==='paused')return;
  let last=performance.now();const timer=setInterval(()=>{const now=performance.now(),elapsed=now-last;last=now;setEffects(previous=>previous.length?previous.map(e=>({...e,remaining:e.remaining-elapsed})).filter(e=>e.remaining>0):previous);},100);
  return()=>clearInterval(timer);
 },[room.status]);
 const bossHits=effects.filter(e=>['hit','strong','fire','poison'].includes(e.type)),counter=effects.filter(e=>e.type==='boss').at(-1),last=effects.at(-1);
 return <>
  <RaidVitals room={room} remaining={remaining} strike={strike}/>
  <section ref={arenaRef} className={`raid-arena ${room.status==='paused'?'is-paused':''} ${reduced?'reduced-motion':''} ${counter?'is-countering':''} ${room.members.length>36?'is-crowded':''}`} aria-label={`全班共同戰場，${room.members.length} 位角色`} style={{'--formation-columns':columns}}>
   <div className="stage-moon"/><div className="stage-ridge ridge-back"/><div className="stage-ridge ridge-front"/><div className="stage-floor"/>
   <div className="raid-stage-caption"><span>CLASS RAID · LIVE BATTLE</span><h2>暮光裂隙</h2><p>每一位夥伴，都在這裡。</p></div>
   <RaidStatuses room={room} now={now}/>
   <div className={`stage-boss ${bossHits.length?'is-hit':''} ${room.stunUntil>now?'is-stunned':''}`}>
    <div className="stage-boss-aura"/><div className="stage-boss-shadow"/>
    <img src="/assets/150.png" alt="暗影魔王心紋獸"/>
    <div className="stage-boss-name"><span>RAID BOSS</span><h3>暗影魔王 · 心紋獸</h3></div>
    {room.stunUntil>now&&<span className="boss-condition">💫 暈眩中</span>}
    {room.poisonTicks>0&&<span className="boss-poison">毒霧侵蝕中</span>}
   </div>
   <div className="formation-title"><Users size={14}/>我們的隊伍 <b>{room.members.length}</b><span>{room.members.filter(m=>m.online).length} 人在線</span></div>
   {positions.map(m=>{
    const action=effects.filter(e=>e.actorId===m.id).at(-1),attacking=action&&['hit','strong','fire'].includes(action.type),supporting=action&&!attacking;
    return <div key={m.id} className={`stage-unit ${attacking?'is-attacking':''} ${supporting?'is-supporting':''} ${m.online?'is-online':'is-offline'}`} style={{left:`${m.x}%`,top:`${m.y}%`,'--sprite-size':`${spriteSize}px`}} data-member-id={m.id}>
     <div className="unit-plinth"/><div className="unit-sprite" key={action?.key||'idle'}><img src={`/assets/${m.partner.id}.png`} alt={`${m.name}的${m.nickname||m.partner.zhName}`} loading="eager"/></div>
     <span className="unit-name" title={m.name}><i/>{m.name}</span><small className="unit-partner">{m.nickname||m.partner.zhName}</small>
    </div>;
   })}
   {!positions.length&&<div className="stage-empty"><Users size={25}/><h3>等待夥伴入場</h3><p>學生加入後，角色會出現在這裡。</p></div>}
   <svg className="stage-attack-layer" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
    {effects.filter(e=>e.actorId&&members.has(e.actorId)&&['hit','strong','fire','poison'].includes(e.type)).map(e=>{const m=members.get(e.actorId),x=m.x*10,y=m.y*6-22;return <g key={e.key} className={`stage-attack attack-${e.type}`}><path pathLength="1" d={`M ${x} ${y} Q ${x*.6} ${Math.max(40,y-100)} 240 285`}/><circle cx="240" cy="285" r={e.type==='strong'?34:19}/></g>;})}
    {counter&&<g key={counter.key} className="stage-counter"><path pathLength="1" d="M 245 290 Q 500 150 830 330"/><ellipse cx="740" cy="350" rx="220" ry="170"/></g>}
   </svg>
   <div className="stage-floats" aria-hidden="true">{effects.map(e=>{const m=members.get(e.actorId);if(!m)return null;return <div key={e.key} data-actor-id={e.actorId} data-event-sequence={e.sequence} className={`stage-float float-${e.type}`} style={{left:`${m.x}%`,top:`${m.y}%`,'--float-shift':`${(e.sequence%3-1)*8}px`}}><span>{m.name}</span><b>{effectLabel(e)}</b></div>;})}</div>
   {counter&&<div key={counter.key} className="counter-announcement"><Shield size={22}/>{counter.text}</div>}
   {room.status==='paused'&&<div className="arena-pause"><span>Ⅱ</span>老師暫停中 · 夥伴原地待命</div>}
   {!['active','paused','waiting'].includes(room.status)&&<div className={`arena-outcome outcome-${room.status}`}><span>{room.status==='won'?'VICTORY':'BATTLE COMPLETE'}</span><strong>{room.status==='won'?'討伐成功！':room.status==='lost'?'護盾耗盡':room.status==='timeout'?'時間到':'本場已結束'}</strong><small>謝謝每一位夥伴的努力</small></div>}
   <div className="arena-bottom"><div><i/>{room.status==='active'?'全班即時共鬥':room.status==='waiting'?'夥伴集結中':'共同守護的每一刻'}<small>角色依加入順序固定站位</small></div><p role="status">{last?.text||room.events[0]?.text||'帶著你的夥伴，一起出發。'}</p></div>
  </section>
 </>;
}
