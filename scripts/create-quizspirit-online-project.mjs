import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const skillRoot=fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
function canonical(p){
  const missing=[];let cursor=path.resolve(p);
  while(!fs.existsSync(cursor)){const parent=path.dirname(cursor);if(parent===cursor)throw Error('找不到目標的上層目錄。');missing.unshift(path.basename(cursor));cursor=parent;}
  return path.resolve(fs.realpathSync(cursor),...missing);
}
function inside(parent,child){const rel=path.relative(parent,child);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));}
export function createProject(target){
  if(!target)throw Error('請指定新的空資料夾。');
  const dest=canonical(target);
  if(inside(skillRoot,dest))throw Error('目標不可位於技能內部。');
  if(fs.existsSync(dest)&&(!fs.statSync(dest).isDirectory()||fs.readdirSync(dest).length))throw Error('目標必須是空資料夾，不會覆寫既有檔案。');
  fs.mkdirSync(dest,{recursive:true});
  fs.cpSync(path.join(skillRoot,'assets/quizspirit-online-template'),dest,{recursive:true,errorOnExist:true,force:false});
  return dest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log('已建立本機多人遊戲來源：'+createProject(process.argv[2]));console.log('請依 README 安裝依賴並驗證；尚未部署。');}
  catch(e){console.error(e.message);process.exitCode=1;}
}
