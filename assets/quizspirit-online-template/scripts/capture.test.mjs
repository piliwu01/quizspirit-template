import test from 'node:test';
import assert from 'node:assert/strict';
import {canCapture,captureSucceeds} from '../src/capture.js';
test('capture is blocked above 5 percent even with a winning random draw',()=>{
  for(const hp of [100,35,6,5.01]){assert.equal(canCapture(hp,100),false);assert.equal(captureSucceeds(hp,100,()=>0),false);}
});
test('exactly 5 percent and lower are eligible but fainted enemies are not',()=>{
  for(const hp of [5,4,1])assert.equal(canCapture(hp,100),true);
  for(const [hp,max] of [[0,100],[-1,100],[1,0],[NaN,100],[1,Infinity]])assert.equal(canCapture(hp,max),false);
});
test('integer HP uses precise ratio against non-round max HP',()=>{
  assert.equal(canCapture(9,180),true);assert.equal(canCapture(10,180),false);
  assert.equal(canCapture(9,188),true);assert.equal(canCapture(10,188),false);
});
test('eligible capture retains original 92 percent success rate',()=>{
  assert.equal(captureSucceeds(5,100,()=>.9199),true);assert.equal(captureSucceeds(5,100,()=>.92),false);
});
