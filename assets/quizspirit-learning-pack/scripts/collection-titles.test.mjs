import assert from 'node:assert/strict';
import {collectionProgress} from '../src/collection-titles.js';
const catalog=Array.from({length:64},(_,i)=>({id:i+1}));
const at=n=>collectionProgress(catalog.slice(0,n),catalog);
for(const [before,after,name] of [[6,7,'森林探索者'],[15,16,'圖鑑收藏家'],[31,32,'夥伴召集人'],[47,48,'聯盟收藏大師'],[63,64,'全圖鑑傳說']]) {
  assert.notEqual(at(before).current.name,name);assert.equal(at(after).current.name,name);
}
assert.equal(at(1).next.required,7);
assert.equal(at(64).percent,100);assert.equal(at(64).next,undefined);
assert.equal(collectionProgress([{id:1},{id:1},{id:999}],catalog).count,1);
assert.equal(collectionProgress(JSON.parse(JSON.stringify(catalog.slice(0,16))),catalog).current.name,'圖鑑收藏家');
console.log('PASS: all threshold boundaries, duplicate/unknown IDs, 100% completion, reload-derived title');
