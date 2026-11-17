import React, {useState} from 'react';
import {summarize} from './learning';
import './learning.css';
export default function LearningPanel({bank, records, onAnswer, saveNotice}) {
  const [session, setSession] = useState(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState(null);
  if (!bank) return null;
  const stats = summarize(bank, records);
  const wrong = bank.questions.filter(q => q.status==='active' && records[`${bank.bankId}:${q.id}`]?.lastCorrect === false);
  const q = session?.[index];
  const start = () => {setSession(wrong);setIndex(0);setAnswer(null);};
  return <section className="learning-panel" aria-label="我的學習進度">
    <div className="learning-heading"><div><span className="section-label">LEARNING JOURNEY</span><h2>每一次練習，都留下進步</h2></div><button className="secondary-button" disabled={!wrong.length || !!session} onClick={start}>錯題複習（{wrong.length} 題）</button></div>
    <p role="status" className="save-notice">{saveNotice} 同一瀏覽器可接續夥伴、圖鑑及學習紀錄；對戰重新開始。</p>
    <div className="learning-summary"><span>已練習 <b>{stats.attempted} / {stats.total}</b></span><span>第一次答對率 <b>{stats.attempted ? Math.round(stats.first/stats.attempted*100)+'%' : '尚未作答'}</b></span><span>目前已掌握 <b>{stats.mastered} 題</b></span></div>
    <div className="mastery-grid">{[...new Set(bank.questions.filter(q=>q.status==='active').map(q=>q.unit))].map(unit=>{const s=summarize(bank,records,unit);return <article key={unit}><h3>{unit}</h3><b>{s.mastered} / {s.total} 題</b><progress aria-label={`${unit}掌握度`} max={s.total} value={s.mastered}/><small>首次答對 {s.first} / 已練習 {s.attempted} · 待複習 {s.wrong}</small></article>;})}</div>
    <p className="learning-help">掌握度依最近一次作答計算；重答正確可移出錯題本，再次答錯會重新加入。首次答對率包含逾時答錯。</p>
    {!wrong.length && !session && <p>錯題本目前是空的。到冒險中練習，答錯的題目會自動收集在這裡。</p>}
    {q && <div className="review-card" aria-label="錯題練習"><div className="learning-heading"><strong>錯題複習 {index+1} / {session.length} · 不限時</strong><button className="secondary-button" onClick={()=>setSession(null)}>結束複習</button></div><h3>{q.stem}</h3><div className="review-options">{Object.entries(q.options).map(([key,text])=><button key={key} disabled={answer!==null} onClick={()=>{if(answer!==null)return;setAnswer(key);onAnswer(`${bank.bankId}:${q.id}`,key===q.answer);}}>{key}．{text}</button>)}</div>{answer!==null && <div className="review-feedback" role="status"><strong>{answer===q.answer?'答對了，已移出待複習！':'再看一次解析，下次繼續加油。'} 正確答案：{q.answer}．{q.options[q.answer]}</strong><p>{q.explanation}</p><button className="primary-button" onClick={()=>{if(index+1>=session.length)setSession(null);else{setIndex(index+1);setAnswer(null);}}}>{index+1>=session.length?'完成本輪複習':'下一題'}</button></div>}</div>}
  </section>;
}
