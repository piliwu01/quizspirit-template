export const ITEMS=[
 {id:'potion',name:'傷藥',icon:'💊',price:3,scope:'solo',description:'個人對戰／PVP 回復 30 HP，最多回到滿血。'},
 {id:'shield',name:'護盾補給包',icon:'🛡️',price:5,scope:'raid',description:'回復全班 10 點護盾，實際修復列入修復榜。'},
 {id:'stun',name:'暈眩彈',icon:'💫',price:6,scope:'raid',description:'暈眩 10 秒，停止反擊倒數；討伐總時間照常走。'},
 {id:'poison',name:'毒霧瓶',icon:'🧪',price:8,scope:'raid',description:'每 5 秒毒傷 10 點，共 6 次；多瓶依序接續。'},
 {id:'fire',name:'火焰瓶',icon:'🔥',price:5,scope:'raid',description:'立即造成 30 點傷害，計入自己的傷害榜。'},
 {id:'energy',name:'能量果實',icon:'🍒',price:4,scope:'raid',description:'補充自己的 1 次技能機會，最多存 2 次。'},
 {id:'guard',name:'守護結晶',icon:'💎',price:4,scope:'raid',description:'下一波反擊少扣 5 點護盾，多顆依序保護後續波次。'},
 {id:'drum',name:'團隊戰鼓',icon:'🥁',price:10,scope:'raid',description:'全班答對額外造成 5 點傷害，持續 20 秒。'},
];
export const itemById=id=>ITEMS.find(x=>x.id===id);
export const bagOf=s=>Object.fromEntries(ITEMS.map(x=>[x.id,Number.isSafeInteger(s?.bag?.[x.id])&&s.bag[x.id]>0?s.bag[x.id]:0]));
