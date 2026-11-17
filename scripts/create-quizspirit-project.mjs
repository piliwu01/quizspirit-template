import { cpSync, existsSync, mkdirSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const targetArg=process.argv[2];
if(!targetArg){console.error('用法：node create-quizspirit-project.mjs <新的專案資料夾>');process.exit(1);}
const target=resolve(targetArg);
const skillRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const template=resolve(skillRoot,'assets/quizspirit-template');
if(target===skillRoot || target.startsWith(skillRoot + '/') || target.startsWith(skillRoot + '\\'))throw new Error('專案需建立在技能目錄之外。');
if(existsSync(target)&&readdirSync(target).length)throw new Error('目標資料夾不是空的，已停止，沒有覆寫檔案。');
mkdirSync(target,{recursive:true});
cpSync(template,target,{recursive:true});
console.log(JSON.stringify({created:realpathSync(target),next:'安裝 package.json 的相依套件，build 後執行 scripts/export-standalone.mjs；或修改後提供可直接開啟的 HTML。'}));
