import {partnerFor} from '../src/growth.js';
export function ownedSpirit(state,id){
 const value=Number(id);if(!Number.isSafeInteger(value)||value<1)return null;
 const partner=partnerFor(state.growth);if(partner?.id===value)return partner;
 return (Array.isArray(state.captured)?state.captured:[]).find(p=>p.id===value)||null;
}
export const canUseSpirit=(state,id)=>!!ownedSpirit(state,id);
export function usableSpirit(state){const partner=partnerFor(state.growth),all=[partner,...(state.captured||[])].filter(Boolean);return [...new Map(all.map(p=>[p.id,p])).values()].map(p=>ownedSpirit(state,p.id)).filter(Boolean);}
