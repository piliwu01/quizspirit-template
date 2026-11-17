export async function api(path,body){
 const response=await fetch('/api'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json','X-QuizSpirit':'1'},body:body===undefined?undefined:JSON.stringify(body)});
 let result;try{result=await response.json();}catch{throw Error('無法讀取伺服器回應，請確認服務已啟動。');}
 if(!response.ok)throw Object.assign(Error(result.error||'操作暫時無法完成。'),{status:response.status});return result;
}
