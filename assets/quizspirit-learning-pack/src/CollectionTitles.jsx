import React from 'react';
import {collectionProgress} from './collection-titles';
import './collection-titles.css';
export default function CollectionTitles({captured,catalog,compact=false}) {
  const p=collectionProgress(captured,catalog);
  return <section className={`collection-titles ${compact?'title-compact':''}`} aria-label="圖鑑收集稱號">
    <div className="title-award"><span className="title-medal" aria-hidden="true">{p.current.icon}</span><div><small>目前稱號</small><h2>{p.current.name}</h2></div><strong>{p.percent}%</strong></div>
    <p>已收集 {p.count} / {p.total} 種題靈</p>
    <progress aria-label="圖鑑收集度" value={p.count} max={p.total}/>
    <p className="title-next">{p.next?`再收集 ${p.next.required-p.count} 種，就能解鎖「${p.next.name}」！`:'全圖鑑完成！每一位夥伴，都是你的冒險勳章。'}</p>
    {!compact && <><div className="title-milestones">{p.milestones.map(t=>{const unlocked=p.count>=t.required;return <article key={t.name} className={unlocked?'unlocked':'locked'}><span aria-hidden="true">{unlocked?t.icon:'🔒'}</span><h3>{t.name}</h3><p>{t.percent===0?'出發即獲得':`${t.percent}% · ${t.required} 種`}</p><small>{unlocked?'已解鎖':'尚未解鎖'}</small></article>;})}</div><small>以遊戲內可收服的 {p.total} 種為準；初始雷啾啾計入，重複收服只算一次。稱號依已保存的圖鑑自動更新。</small></>}
  </section>;
}
