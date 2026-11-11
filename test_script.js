'use strict';
/* Runs Code.gs outside Google, against a stand-in for the Sheet, and checks the push side end to end:
   the signature is verified with Node's own crypto. Run with: node test_script.js */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
let NOW=Date.UTC(2026,10,11,10,0,0);
const sheets={},props={},cache={},calls=[],triggers=[];let goldPx=5200,pushCode=201;
const MN=['January','February','March','April','May','June','July','August','September','October','November','December'];
function mkSheet(name){const d=[];const rng=(r,c,nr,nc)=>({setValues(v){for(let i=0;i<nr;i++){while(d.length<r+i)d.push([]);for(let j=0;j<nc;j++)d[r-1+i][c-1+j]=v[i][j];}},
  getValues(){const o=[];for(let i=0;i<nr;i++){const row=[];for(let j=0;j<nc;j++)row.push((d[r-1+i]||[])[c-1+j]??'');o.push(row);}return o;},getValue(){return (d[r-1]||[])[c-1]??'';},setValue(v){while(d.length<r)d.push([]);d[r-1][c-1]=v;},
  setFontWeight(){return this},setNumberFormat(){return this},getRow:()=>r,getColumn:()=>c,getNumRows:()=>nr,getNumColumns:()=>nc});
  return {d,getName:()=>name,appendRow(r){d.push(r.slice())},setFrozenRows(){},getLastRow:()=>d.length,deleteRow(r){d.splice(r-1,1)},
    getRange(a,b,c,e){return typeof a==='string'?rng(1,1,1,1):rng(a,b,c||1,e||1)},
    getDataRange(){const w=Math.max(1,...d.map(r=>r.length));return rng(1,1,Math.max(1,d.length),w)},copyTo(){return {setName(){}}}};}
const D=class extends Date{constructor(...a){a.length?super(...a):super(NOW)}static now(){return NOW}};
const ctx={console,JSON,Math,Number,String,Object,Array,BigInt,parseInt,isNaN,Date:D,
  SpreadsheetApp:{getActive:()=>({getSheetByName:n=>sheets[n]||null,insertSheet:n=>(sheets[n]=mkSheet(n)),getSheets:()=>Object.values(sheets),deleteSheet(s){delete sheets[s.getName()]}})},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null,setProperty:(k,v)=>{props[k]=String(v)},deleteProperty:k=>{delete props[k]}})},
  CacheService:{getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>{cache[k]=v}})},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  ContentService:{createTextOutput:t=>({setMimeType(){return this},text:t}),MimeType:{JSON:'json'}},
  Session:{getScriptTimeZone:()=>'GMT',getEffectiveUser:()=>({getEmail:()=>'owner@example.com'})},
  ScriptApp:{getProjectTriggers:()=>triggers,newTrigger:f=>({timeBased(){return this},everyHours(){return this},after(){return this},create(){triggers.push({getHandlerFunction:()=>f})}}),deleteTrigger(t){triggers.splice(triggers.indexOf(t),1)}},
  UrlFetchApp:{fetch(url,o){calls.push({url,o});const r=(c,t)=>({getResponseCode:()=>c,getContentText:()=>t});
    if(url.includes('gold-api'))return r(200,JSON.stringify({name:'Gold',price:goldPx,symbol:'XAU',updatedAt:new Date(NOW).toISOString()}));if(url.includes('push.example'))return r(pushCode,'');return r(500,'');}},
  Utilities:{DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},getUuid:()=>crypto.randomUUID(),
    computeDigest:(a,v)=>[...crypto.createHash('sha256').update(typeof v==='string'?Buffer.from(v,'utf8'):Buffer.from(v.map(b=>(b+256)%256))).digest()].map(b=>b>127?b-256:b),
    computeHmacSha256Signature:(v,k)=>[...crypto.createHmac('sha256',Buffer.from(k.map(b=>(b+256)%256))).update(Buffer.from(v.map(b=>(b+256)%256))).digest()].map(b=>b>127?b-256:b),
    base64EncodeWebSafe:x=>(typeof x==='string'?Buffer.from(x,'utf8'):Buffer.from(x.map(b=>(b+256)%256))).toString('base64').replace(/\+/g,'-').replace(/\//g,'_'),
    formatDate:(dt,tz,f)=>{const p=n=>String(n).padStart(2,'0');return f.replace(/yyyy|MMMM|MMM|MM|dd|HH|mm|ss|d|H|u/g,t=>({u:dt.getUTCDay()||7,yyyy:dt.getUTCFullYear(),MMMM:MN[dt.getUTCMonth()],MMM:MN[dt.getUTCMonth()].slice(0,3),MM:p(dt.getUTCMonth()+1),dd:p(dt.getUTCDate()),HH:p(dt.getUTCHours()),mm:p(dt.getUTCMinutes()),ss:p(dt.getUTCSeconds()),d:dt.getUTCDate(),H:dt.getUTCHours()}[t]));}}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+'/Code.gs','utf8').replace("const TOKEN = 'CHANGE-THIS-TO-A-LONG-RANDOM-SECRET';","const TOKEN = 'pw';"),ctx);
const run=c=>vm.runInContext(c,ctx);
const post=b=>JSON.parse(run(`doPost({postData:{contents:${JSON.stringify(JSON.stringify(Object.assign({token:'pw'},b)))}}})`).text);
const get=q=>JSON.parse(run(`doGet({parameter:${JSON.stringify(Object.assign({token:'pw'},q))}})`).text);
const row=(id,date,usd,name,extra)=>Object.assign({id,date,type:'Cash USD',gold:0,eur:0,usd,name,goldPrice:0,updated:NOW,deleted:false},extra||{});
const pushes=()=>calls.filter(c=>c.url.includes('push.example'));

/* 1. the key pair and the signature are real: Node's crypto accepts them */
run('setup()');
const g0=get({});assert.equal(g0.api,6);assert(g0.push&&g0.push.key.length>80);
const raw=Buffer.from(g0.push.key,'base64url');assert.equal(raw.length,65);assert.equal(raw[0],4);
const pub=crypto.createPublicKey({key:{kty:'EC',crv:'P-256',x:raw.subarray(1,33).toString('base64url'),y:raw.subarray(33).toString('base64url')},format:'jwk'});
for(let i=0;i<5;i++){const sig=run(`ecSign_('hello ${i}',vapid_().d)`);assert(crypto.verify('sha256',Buffer.from('hello '+i),{key:pub,dsaEncoding:'ieee-p1363'},Buffer.from(sig,'base64url')),'signature must verify');}
assert.equal(triggers.length,1,'hourly timer created once');run('setup()');assert.equal(triggers.length,1);assert.equal(triggers[0].getHandlerFunction(),'pushTick','a public name, so Google can run it');
triggers.push({getHandlerFunction:()=>'pushTick_'});run('ensureTick_()');assert.deepEqual(triggers.map(t=>t.getHandlerFunction()),['pushTick'],'the old private timer is replaced');
assert.equal(g0.push.timer,true);assert.equal(g0.push.devices,0);assert.equal(g0.push.tz,'GMT');

/* 2. two phones register; an entry from one knocks on the other, with a valid permission slip */
const A={dev:'phoneA1',endpoint:'https://push.example/a/1',prefs:{push:true,hour:9,nudgeDay:10},app:'https://guy.github.io/ledger/'};
const B={dev:'phoneB1',endpoint:'https://push.example/b/2',prefs:{push:true,hour:9,nudgeDay:10}};
assert.equal(post({rows:[row('r1','05/10/2026 10:00:00',928,'guy'),row('r0','03/09/2026 10:00:00',800,'guy')],dev:'phoneA1',push:A}).push,true);
assert.equal(post({rows:[],dev:'phoneB1',push:B}).push,true);
assert.equal(pushes().length,0,'nobody to tell yet');
post({rows:[row('r2','11/11/2026 09:00:00',500,'lea')],dev:'phoneB1'});
assert.equal(pushes().length,1);const k=pushes()[0];assert.equal(k.url,A.endpoint,'the other phone, not the sender');
const au=/^vapid t=([^,]+), k=(.+)$/.exec(k.o.headers.Authorization);assert(au);assert.equal(au[2],g0.push.key);
const [h,b,s]=au[1].split('.');assert(crypto.verify('sha256',Buffer.from(h+'.'+b),{key:pub,dsaEncoding:'ieee-p1363'},Buffer.from(s,'base64url')),'JWT must verify');
const claims=JSON.parse(Buffer.from(b,'base64url'));assert.equal(claims.aud,'https://push.example');assert.equal(claims.sub,'https://guy.github.io/ledger/');assert(claims.exp-NOW/1000<=86400&&claims.exp>NOW/1000);
assert.equal(JSON.parse(Buffer.from(h,'base64url')).alg,'ES256');assert.equal(k.o.payload,'','the knock carries no data');assert.equal(k.o.headers.Urgency,'high');assert.equal(k.o.headers.TTL,'86400');
let n=get({notes:'1',dev:'phoneA1'}).notes;assert.equal(n.length,1);assert.equal(n[0].title,'Lea added $500');
assert.equal(get({notes:'1',dev:'phoneA1'}).notes.length,0,'shown once');
assert.equal(get({notes:'1',dev:'phoneB1'}).notes.length,0,'sender is not told about its own entry');
assert.equal(get({token:'bad',notes:'1',dev:'phoneA1'}).error,'unauthorized');
/* an edit of an existing entry, or a first upload of many, is not announced */
calls.length=0;post({rows:[row('r2','11/11/2026 09:00:00',550,'lea',{updated:NOW+5})],dev:'phoneB1'});assert.equal(pushes().length,0);
post({rows:Array.from({length:20},(_,i)=>row('bulk'+i,'01/08/2026 10:00:00',10,'lea')),dev:'phoneB1'});assert.equal(pushes().length,0);

/* 3. test button; the permission slip is reused, not re-signed each time (Apple's rule) */
const t1=post({rows:[],dev:'phoneA1',pushTest:true});assert.equal(t1.test,'sent');assert(/^201 at /.test(t1.last),t1.last);assert.equal(pushes().length,1);assert.equal(get({notes:'1',dev:'phoneA1'}).notes[0].title,'Push works');
assert.equal(pushes()[0].o.headers.Authorization,k.o.headers.Authorization,'same slip within six hours');
assert.equal(get({}).push.devices,2);assert(/^201 at .* push\.example/.test(get({}).push.last));
/* 3b. delayed test: nothing now, then the timer sends it */
calls.length=0;assert.equal(post({rows:[],dev:'phoneA1',pushTest:'later'}).test,'later');assert.equal(pushes().length,0);
assert(triggers.some(t=>t.getHandlerFunction()==='pushLater'));run('pushLater()');assert.equal(pushes().length,1);
assert.equal(get({notes:'1',dev:'phoneA1'}).notes[0].title,'Delayed test arrived');assert(!triggers.some(t=>t.getHandlerFunction()==='pushLater'),'one-off timer removed');
/* 3c. weekly summary on Monday, once */
NOW=Date.UTC(2026,10,16,9,30,0);calls.length=0;run('pushTick()');assert.equal(pushes().length,2);
n=get({notes:'1',dev:'phoneA1'}).notes;assert.equal(n[0].title,'Last week: +$550',n[0].title);assert(/saved so far in November/.test(n[0].body));get({notes:'1',dev:'phoneB1'});
calls.length=0;run('pushTick()');assert.equal(pushes().length,0);assert(get({}).push.tickAt>0);
NOW=Date.UTC(2026,10,17,10,0,0);

/* 4. hourly timer: nothing mid-month when savings exist; report on the 1st, once, after the chosen hour */
calls.length=0;run('pushTick()');assert.equal(pushes().length,0);
NOW=Date.UTC(2026,11,1,7,0,0);run('pushTick()');assert.equal(pushes().length,0,'before 9:00 nothing');
NOW=Date.UTC(2026,11,1,9,5,0);run('pushTick()');assert.equal(pushes().length,2);
n=get({notes:'1',dev:'phoneB1'}).notes;assert.equal(n[0].title,'Your November report is ready');assert.equal(n[0].url,'./#report=2026-11');assert(n[0].body.includes('$550'),n[0].body);
calls.length=0;NOW=Date.UTC(2026,11,1,11,0,0);run('pushTick()');assert.equal(pushes().length,0,'once only');
/* 5. reminder on the chosen day, only if nothing was saved */
NOW=Date.UTC(2026,11,10,9,30,0);run('pushTick()');assert.equal(pushes().length,2);
n=get({notes:'1',dev:'phoneA1'}).notes;assert(n.some(x=>x.title==='Nothing saved yet in December'));
calls.length=0;run('pushTick()');assert.equal(pushes().length,0);
NOW=Date.UTC(2027,0,3,9,30,0);post({rows:[row('r9','02/01/2027 09:00:00',300,'guy')],dev:'phoneA1'});get({notes:'1',dev:'phoneB1'});get({notes:'1',dev:'phoneA1'});
NOW=Date.UTC(2027,0,12,9,30,0);calls.length=0;run('pushTick()');
assert.equal(get({notes:'1',dev:'phoneA1'}).notes.filter(x=>/Nothing saved/.test(x.title)).length,0,'saved this month: no reminder');
/* 6. a preference switched off is respected */
post({rows:[],dev:'phoneA1',push:Object.assign({},A,{prefs:{push:true,partner:false}})});calls.length=0;
post({rows:[row('r10','12/01/2027 10:00:00',70,'lea')],dev:'phoneB1'});assert.equal(pushes().length,0);
/* 7. gold: 3% or more, only for a ledger holding gold */
post({rows:[row('g1','04/01/2026 21:00:00',0,'guy',{type:'Gold',gold:24,goldPrice:116.47})],dev:'phoneA1'});get({notes:'1',dev:'phoneB1'});
for(const key of Object.keys(cache))delete cache[key];goldPx=5200;run('pushTick()');calls.length=0;
for(const key of Object.keys(cache))delete cache[key];goldPx=5250;run('pushTick()');assert.equal(pushes().length,0,'under 3%: quiet');
for(const key of Object.keys(cache))delete cache[key];goldPx=5400;run('pushTick()');assert.equal(pushes().length,2);
n=get({notes:'1',dev:'phoneB1'}).notes;assert(/^Gold is up 3\.8% since/.test(n[0].title),n[0].title);assert(n[0].body.includes('24 g'));
/* 8. a phone that removed the app is forgotten */
pushCode=410;post({rows:[],dev:'phoneA1',pushTest:true});assert.equal(run('devices_().length'),1);assert.equal(run('devices_()[0].dev'),'phoneB1');
/* 9. turning notifications off removes the phone */
post({rows:[],dev:'phoneB1',push:{dev:'phoneB1',endpoint:''}});assert.equal(run('devices_().length'),0);
console.log('PASS: push through the ledger script, 12 scenarios, signatures verified by Node crypto');
