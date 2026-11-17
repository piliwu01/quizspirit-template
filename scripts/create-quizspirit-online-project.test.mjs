import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createProject,skillRoot} from './create-quizspirit-online-project.mjs';
test('新空目錄可建立、範本無執行資料，非空目錄與技能內路徑被拒',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'quizspirit-skill-test-'));
 try{
  const dest=createProject(path.join(temp,'new'));
  for(const f of ['package.json','README.md','server/pvp-room.js'])assert.ok(fs.existsSync(path.join(dest,f)),f);
  assert.ok(fs.readdirSync(path.join(dest,'migrations')).length>=4);
  for(const name of ['node_modules','dist','work','.wrangler','.env','teacher-account.local'])assert.ok(!fs.existsSync(path.join(dest,name)),name);
  fs.writeFileSync(path.join(dest,'marker'),'keep');
  assert.throws(()=>createProject(dest),/空資料夾/);assert.equal(fs.readFileSync(path.join(dest,'marker'),'utf8'),'keep');
  assert.throws(()=>createProject(path.join(skillRoot,'must-not-create')), /技能內部/);
  const alias=path.join(temp,'skill-alias');fs.symlinkSync(skillRoot,alias,'junction');
  try{assert.throws(()=>createProject(path.join(alias,'must-not-create')),/技能內部/);}finally{fs.unlinkSync(alias);}
 }finally{
  const resolved=fs.realpathSync(temp),parent=fs.realpathSync(os.tmpdir());
  assert.equal(path.dirname(resolved),parent);assert.ok(path.basename(resolved).startsWith('quizspirit-skill-test-'));
  fs.rmSync(resolved,{recursive:true});
 }
});
