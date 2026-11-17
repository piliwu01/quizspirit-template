import React from 'react';
import { STARTERS, partnerFor, familyFor, nextEvolution, canEvolve, levelFor } from './growth';
export default function GrowthPanel({ growth, bankId, artwork, onChoose, onEvolve, onStart, notice, reward, compact = false }) {
  const partner = partnerFor(growth);
  const level = levelFor(growth.xp);
  const next = nextEvolution(growth);
  const round = Object.hasOwn(growth.rounds, bankId) ? growth.rounds[bankId] : { count: 0, completed: 0 };
  return <section className={`growth-panel ${compact ? 'growth-compact' : ''}`} aria-label="夥伴養成">
    <div className="growth-heading"><div><span className="section-label">GROW TOGETHER</span><h2>把每次複習，變成一起成長。</h2></div><span className="growth-save-label">瀏覽器自動存檔</span></div>
    {notice && <p className="growth-warning" role="alert">{notice}</p>}
    {!partner ? <><p>選一位長期陪伴你的養成夥伴。出戰仍可自由選擇，複習經驗值都會送給這位夥伴。</p><div className="starter-grid">{STARTERS.map(f => <button key={f[0].id} onClick={() => onChoose(f[0].id)} className={`starter-card type-${f[0].type}`}><img src={artwork(f[0].id)} alt={f[0].zhName}/><strong>{f[0].zhName}</strong><small>Lv. 1 開始同行</small><span>選為養成夥伴 →</span></button>)}</div><small className="growth-note">選定後持續培養同一位夥伴；不會因切換出戰角色或題庫而重設。</small></> : <>
      <div className="growth-body"><div className="growth-portrait"><img key={partner.id} src={artwork(partner.id)} alt={`養成夥伴${partner.zhName}`}/></div><div className="growth-details"><div className="growth-name"><h3>{partner.zhName}</h3><b>Lv. {level}</b></div><div className="growth-xp-label"><span>複習經驗值</span><strong>{level === 100 ? '已滿等' : `${growth.xp % 100} / 100 XP`}</strong></div><div className="growth-track" role="progressbar" aria-label="距離下一級" aria-valuemin={0} aria-valuemax={100} aria-valuenow={level === 100 ? 100 : growth.xp % 100}><span style={{ width: `${level === 100 ? 100 : growth.xp % 100}%` }}/></div><p className="growth-next">{level === 100 ? '滿等達成！繼續複習，讓知識更熟練。' : `再獲得 ${100 - growth.xp % 100} XP，就能升到 Lv. ${level + 1}`}</p>
      <div className="growth-round"><span>目前題庫 · 第 {round.completed + 1} 輪複習</span><b>{round.count} / 10 題</b></div><div className="round-dots" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <span className={i < round.count ? 'done' : ''} key={i}/>)}</div><small>每完成 10 題 ＋30 XP，答錯與逾時也算完成。</small></div><div className="growth-evolution"><span className="section-label">下一個成長里程碑</span>{next ? <><strong>{next.zhName}</strong><span>Lv. {next.at} 可進化</span><button className={canEvolve(growth) ? 'primary-button' : 'secondary-button'} disabled={!canEvolve(growth)} onClick={onEvolve}>{canEvolve(growth) ? '✦ 讓夥伴進化' : `還差 ${Math.max(0, next.at - level)} 級`}</button></> : <><strong>最終進化完成 ✦</strong><span>每一次努力，都一起走過。</span></>}</div></div>
      <div className="evolution-trail">{familyFor(growth).map((p, i) => <span key={p.id} className={i === growth.stage ? 'current' : i < growth.stage ? 'past' : ''}>{i > 0 && <em>→</em>}{p.zhName}<small>Lv. {p.at}</small></span>)}</div>
      {reward && <p className="growth-reward" role="status">{reward}</p>}
      <button className="primary-button growth-start" onClick={onStart}>開始複習，陪夥伴成長 →</button>
      <details className="growth-rules"><summary>經驗值與存檔說明</summary><p>首次答對不同題 ＋20 XP；重複答對 ＋5 XP；答錯或逾時不扣 XP。每完成 10 題再加 30 XP，進度依題庫分開保存。</p><p>每 100 XP 升 1 級，最高 Lv. 100（總計 9,900 XP），滿等後不再累積 XP。進化要手動按鈕確認，不會扣除經驗值。養成等級不調整原版對戰傷害、HP 或收服機率。</p><p>養成、出戰夥伴與收服圖鑑存在這台裝置的同一瀏覽器；換瀏覽器、移動 HTML 或清除瀏覽資料可能無法接續。共用電腦也會共用這份進度。</p></details>
    </>}
  </section>;
}
