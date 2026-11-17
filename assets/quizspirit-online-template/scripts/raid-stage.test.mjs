import test from 'node:test';import assert from 'node:assert/strict';
import {collectStageEvents,formation,effectLabel} from '../src/raid-stage.js';
import {newRoom,startRoom,recordHit,addEvent,RAID_EVENT_BUFFER} from '../shared/raid-rules.js';
const room=(sequence,events=[],extra={})=>({code:'ABC234',createdAt:1000,serverNow:10000,sequence,events,...extra});
test('first snapshot and different room establish baseline, never replay history',()=>{
 const e={sequence:3,type:'hit',at:9999};let r=collectStageEvents(null,room(3,[e]));assert.deepEqual(r.events,[]);
 r=collectStageEvents(r.cursor,room(5,[{...e,sequence:5}],{code:'DIFF34'}));assert.deepEqual(r.events,[]);assert.equal(r.cursor.sequence,5);
 r=collectStageEvents(r.cursor,room(7,[{...e,sequence:7}],{code:'DIFF34',createdAt:2000}));assert.deepEqual(r.events,[]);
});
test('new attack events sort and deduplicate across repeated and old snapshots',()=>{
 const cursor=collectStageEvents(null,room(2)).cursor,events=[{sequence:4,type:'heal',value:5,at:9998},{sequence:3,type:'hit',value:10,at:9998}];
 const result=collectStageEvents(cursor,room(4,events));assert.deepEqual(result.events.map(e=>e.sequence),[3,4]);
 assert.deepEqual(collectStageEvents(result.cursor,room(4,events)).events,[]);assert.deepEqual(collectStageEvents(result.cursor,room(3,events)).events,[]);
});
test('reconnect skips old events but recovers recent attacks; finish does not hide winning hit',()=>{
 const events=[{sequence:8,type:'hit',at:1000},{sequence:9,type:'strong',at:9990},{sequence:10,type:'finish',at:9990}];
 const result=collectStageEvents({identity:'ABC234:1000',sequence:7},room(10,events,{status:'won'}));assert.deepEqual(result.events.map(e=>e.sequence),[9]);
});
test('60-player burst retains every actor event and fixed nonoverlapping formation slots',()=>{
 const state=newRoom({code:'ABC234',duration:600000},1000);
 for(let i=0;i<60;i++)state.members['s'+i]={id:'s'+i,name:'測試 '+i,partner:{zhName:'雷啾啾'},answered:0,correct:0,damage:0,charges:0,energy:0};
 startRoom(state,1000);const cursor=collectStageEvents(null,{...state,serverNow:1000}).cursor;
 for(const m of Object.values(state.members))recordHit(state,m,true,1010);
 const fresh=collectStageEvents(cursor,{...state,serverNow:1020});assert.equal(fresh.events.length,60);assert.equal(new Set(fresh.events.map(e=>e.actorId)).size,60);assert.equal(state.hp,5400);
 const original=formation(Object.values(state.members)),slots=new Set(original.map(p=>`${p.x},${p.y}`));assert.equal(slots.size,60);assert(original.every(p=>p.x>=49&&p.x<=95&&p.y>=30&&p.y<=77));
 state.members.s0.damage=1000;assert.deepEqual(formation(Object.values(state.members)).map(p=>[p.id,p.x,p.y]),original.map(p=>[p.id,p.x,p.y]));
 for(let i=0;i<400;i++)addEvent(state,'join','fixture',1020);assert.equal(state.events.length,RAID_EVENT_BUFFER);
});
test('all room sizes keep unique stable positions and real effect values',()=>{
 for(const n of [1,2,3,8,30,60]){const points=formation(Array.from({length:n},(_,i)=>({id:'s'+i})));assert.equal(new Set(points.map(p=>`${p.x},${p.y}`)).size,n);}
 assert.equal(effectLabel({type:'heal',value:3}),'護盾 ＋3');assert.equal(effectLabel({type:'strong',value:7}),'強攻 −7');
});
