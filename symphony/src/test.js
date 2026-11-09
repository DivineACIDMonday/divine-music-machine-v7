// Run: node symphony/src/test.js  (all forms x eras: parallels, ranges, final tonic, MIDI)
const Y=require(require('path').join(__dirname,'sym-engine.js'));
const forms=Object.keys(Y.FORMS), eras=Object.keys(Y.ERAS);
let fail=0;
for(const f of forms)for(const e of eras)for(const s of [1,7]){
 const key=s===7?'g':'D';
 try{const t0=Date.now();const g=Y.generate({form:f,era:e,key,seed:s,len:2,chain:[{form:'overture',seed:s},{form:'aria',seed:s+1},{form:'waltz',seed:s+2},{form:'fugue',seed:s+3}]});
  for(const m of g.movements){const c=Y.check(m);const mid=Y.writeMidi(m);
   const secs=(m.end/480)*60/m.tempo;
   console.log(f.padEnd(10),e.padEnd(13),key,'mv'+(m.movement||1),'par',c.parallels,'str',c.structural,'rng',c.range,'fin',c.finalTonic,c.melEndsTonic,'n',c.notes,'tr',m.tracks.length,Math.round(secs)+'s',(Date.now()-t0)+'ms');}
 }catch(err){fail++;console.log('FAIL',f,e,s,err.stack.split('\n').slice(0,3).join(' | '));}
}
console.log('fails',fail);
