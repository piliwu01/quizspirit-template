export const COLLECTION_TITLES = [
  {name:'新手冒險者',percent:0,icon:'🌱'},
  {name:'森林探索者',percent:10,icon:'🧭'},
  {name:'圖鑑收藏家',percent:25,icon:'📖'},
  {name:'夥伴召集人',percent:50,icon:'🌟'},
  {name:'聯盟收藏大師',percent:75,icon:'🏆'},
  {name:'全圖鑑傳說',percent:100,icon:'👑'},
];
export function collectionProgress(captured, catalog) {
  const ids=new Set(catalog.map(p=>p.id));
  const owned=new Set(captured.filter(p=>ids.has(p.id)).map(p=>p.id));
  const total=ids.size;
  const count=owned.size;
  const milestones=COLLECTION_TITLES.map(t=>({...t,required:Math.ceil(total*t.percent/100)}));
  const current=milestones.filter(t=>count>=t.required).at(-1) || milestones[0];
  const next=milestones.find(t=>count<t.required);
  return {count,total,percent:total?Math.floor(count/total*100):0,current,next,milestones};
}
