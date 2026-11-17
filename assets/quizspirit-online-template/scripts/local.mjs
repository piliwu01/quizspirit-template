import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';import {spawn,spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import path from 'node:path';
import {hashPassword,randomToken} from '../server/auth.js';import {freshState} from '../shared/game.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);mkdirSync('work',{recursive:true});
const env={...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:path.join(root,'work','wrangler.log')};
function run(script,args=[]){const r=spawnSync(process.execPath,[script,...args],{cwd:root,env,stdio:'inherit'});if(r.status!==0)throw Error('本機準備未完成，請查看上方錯誤。');}
run('node_modules/wrangler/bin/wrangler.js',['d1','migrations','apply','quizspirit-raid-local','--local']);
if(!existsSync('work/teacher-account.local')){
 const username='teacher',password=randomToken().slice(0,18),id=crypto.randomUUID();const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
 const sql=`INSERT INTO users(id,username,display_name,role,password,created_at) VALUES(${quote(id)},'teacher','老師','teacher',${quote(await hashPassword(password))},${Date.now()}); INSERT INTO progress(user_id,data) VALUES(${quote(id)},${quote(JSON.stringify(freshState()))});`;
 writeFileSync('work/seed.sql',sql);run('node_modules/wrangler/bin/wrangler.js',['d1','execute','quizspirit-raid-local','--local','--file','work/seed.sql']);
 writeFileSync('work/teacher-account.local',JSON.stringify({username,password},null,2));
 writeFileSync('work/本機老師帳密.txt',`本機試用網址：http://127.0.0.1:8788\n帳號：${username}\n初始密碼：${password}\n首次登入必須更改密碼。僅供此電腦的本機資料庫使用。\n`);
 console.log('老師初始帳密已寫入 work/本機老師帳密.txt，請開啟該檔案查看。');
}
run('node_modules/vite/bin/vite.js',['build']);
if(process.argv.includes('--setup-only'))process.exit(0);
console.log('\n網站啟動後，請開啟 http://127.0.0.1:8788 。關閉本視窗會停止服務。');
const server=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--local','--ip','127.0.0.1','--port','8788'],{cwd:root,env,stdio:'inherit'});
if(process.argv.includes('--open'))setTimeout(()=>{spawn('cmd.exe',['/c','start','', 'http://127.0.0.1:8788'],{windowsHide:true,stdio:'ignore'});},6000);
server.on('exit',code=>process.exit(code||0));
