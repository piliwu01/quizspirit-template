import React from 'react';
import { BookOpen, Upload } from 'lucide-react';
import { AUTO_BANK_ID, activeQuestions } from './question-bank';

export default function QuestionBankPanel({ banks, selectedId, onChange, onImport, notice, canImport }) {
  return <section className="bank-panel" aria-label="題庫管理"><div className="bank-title"><BookOpen size={20}/><div><h2>今天，挑戰哪份題庫？</h2><p>換題庫，保留夥伴與戰鬥玩法。</p></div></div><div className="bank-actions"><label className="bank-select-label" htmlFor="question-bank">目前題庫</label><select id="question-bank" value={selectedId} onChange={e=>onChange(e.target.value)}><option value={AUTO_BANK_ID}>自動數學練習</option>{banks.map(bank=><option key={bank.bankId} value={bank.bankId} disabled={!bank.count}>{bank.title}（{bank.count} 題可用）</option>)}</select>{canImport && <label className="bank-import"><Upload size={17}/>匯入 JSON 題庫<input aria-label="匯入 JSON 題庫" type="file" accept=".json,application/json" multiple onChange={onImport}/></label>}</div><p className="bank-notice" role="status">{notice || '題庫由老師匯入，全班登入後皆可選用；待確認的題目不會出題。'}</p></section>;
}
