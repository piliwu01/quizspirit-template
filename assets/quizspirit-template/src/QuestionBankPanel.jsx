import React from 'react';
import { BookOpen, Upload } from 'lucide-react';
import { AUTO_BANK_ID, activeQuestions } from './question-bank';

export default function QuestionBankPanel({ banks, selectedId, onChange, onImport, notice }) {
  return <section className="bank-panel" aria-label="題庫管理"><div className="bank-title"><BookOpen size={20}/><div><h2>今天，挑戰哪份題庫？</h2><p>換題庫，保留夥伴與戰鬥玩法。</p></div></div><div className="bank-actions"><label className="bank-select-label" htmlFor="question-bank">目前題庫</label><select id="question-bank" value={selectedId} onChange={e=>onChange(e.target.value)}><option value={AUTO_BANK_ID}>自動數學練習</option>{banks.map(bank=><option key={bank.bankId} value={bank.bankId} disabled={!activeQuestions(bank).length}>{bank.title}（{activeQuestions(bank).length} 題可用）</option>)}</select><label className="bank-import"><Upload size={17}/>匯入 JSON 題庫<input aria-label="匯入 JSON 題庫" type="file" accept=".json,application/json" multiple onChange={onImport}/></label></div><p className="bank-notice" role="status">{notice || '已匯入題庫會保存在此瀏覽器；待教師確認的 review 題目不會出題。'}</p></section>;
}
