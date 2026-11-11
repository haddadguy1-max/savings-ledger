'use strict';
/* No external requests. Verifies the documented provider schemas, timestamp rules and history migration. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/app-extras.js','utf8');
const backend=fs.readFileSync(__dirname+'/Code.gs','utf8');
const between=(s,a,b)=>{const i=s.indexOf(a);assert(i>=0,a);const j=s.indexOf(b,i);assert(j>i,b);return s.slice(i,j)};
const NOW=Date.UTC(2026,10,11,9,0),mockDate=class extends Date{constructor(...a){super(...(a.length?a:[NOW]));}static now(){return NOW;}};
const kdate=ms=>new Date(ms).toISOString().slice(0,10);
const history={m:{'2026-09':110,'2020-02':60},meta:{}}, urls=[];
let nextHistory={metal:'XAU',points:[
 {t:'2026-09-30T21:00:00.000Z',price:3550},
 {t:'2026-10-29T21:00:00.000Z',price:3980},
 {t:'2026-10-30T21:00:00.000Z',price:4010},
 {t:'2026-10-30T19:00:00.000Z',price:4000},
 {t:'2026-11-10T21:00:00.000Z',price:4080},
 {t:'2026-11-20T21:00:00.000Z',price:4600},
 {t:'2026-03-31T21:00:00.000Z',price:350}, // invalid gold price
 {t:'bad-date',price:4100}
]};
let freeHistory=[{date:'2026-08-28',price:3400,source:'x'},{date:'2026-08-31',price:3440,source:'x'},{date:'2026-10-29',price:4999,source:'x'}];
const context={Date:mockDate,JSON,Number,Math,Object,console:{warn(){},log:console.log,error:console.error},Error,Promise,isFinite,
 OZ:31.1034768,toYMD:kdate,
 hget:()=>history,hsave:o=>Object.assign(history,o),
 cfg:()=>null,scheduleSync:()=>{},
 fetch:async (url)=>{urls.push(url);if(url.includes('freegoldapi'))return {ok:true,json:async()=>freeHistory};return {ok:true,json:async()=>nextHistory}},
};vm.createContext(context);
vm.runInContext(between(source,'/* Daily closes, grouped by UTC calendar month.',"/* A month's price, per gram of 24k."),context);
const run=s=>vm.runInContext(s,context);
const extracted=run('standardBullionMonthly('+JSON.stringify(nextHistory)+')');
assert.deepEqual(Object.keys(extracted.m).sort(),['2026-09','2026-10']);
assert.equal(extracted.meta['2026-10'].date,'2026-10-30');
assert.equal(extracted.meta['2026-10'].method,'month-end-close');
assert(Math.abs(extracted.m['2026-10']-4010/31.1034768)<1e-8);
assert.equal(run("goldRank({method:'month-end-close'})"),3);

/* Google Apps Script must use the same provider conventions as the browser. */
const backendResponses={
 'gold-api':{name:'Gold',price:4100,symbol:'XAU',updatedAt:new Date(NOW-1000).toISOString()},   // the real service sends no currency field
 'market/history':nextHistory
};
const backendContext={Date:mockDate,JSON,Number,Math,Object,String,Array,Error,isFinite,
 UrlFetchApp:{fetch:(u)=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify(u.includes('gold-api')?backendResponses['gold-api']:u.includes('market/history')?backendResponses['market/history']:u.includes('freegoldapi')?freeHistory:null)})},
 Utilities:{formatDate:(d,tz,format)=>d.toISOString().slice(0,7)}};
vm.createContext(backendContext);
vm.runInContext(between(backend,'function okPx_(p)','function gold_(){'),backendContext);
const bhr=vm.runInContext('history_()',backendContext);
assert.equal(bhr['2026-10'].px,4010);
assert.equal(bhr['2026-10'].method,'month-end-close');
assert.equal(bhr['2026-08'].px,3440,'a second source fills the month the first one lacks');assert.equal(bhr['2026-10'].src,'Standard Bullion, month-end close','and never overrides it');
assert.equal(bhr['2026-11'],undefined,'backend must not write current month history as close');
const bl=vm.runInContext('livePx_()',backendContext);
assert.equal(bl.px,4100);assert.equal(bl.src,'Gold-API.com, spot');

(async()=>{
 assert.equal(await run('fetchGoldHistory(false)'),true);
 assert(urls[0].includes('standardbullion.com/api/v1/market/history'));
 assert.equal(history.provider,'standardbullion-month-end');
 assert.equal(history.m['2020-02'],60,'old history not destroyed');
 assert(Math.abs(history.m['2026-09']-3550/31.1034768)<1e-8,'verified close replaces legacy average');
 assert.equal(history.meta['2026-10'].method,'month-end-close');
 assert(Math.abs(history.m['2026-08']-3440/31.1034768)<1e-8,'second source fills a missing month with its last dated price');
 assert(Math.abs(history.m['2026-10']-4010/31.1034768)<1e-8,'first source keeps its month');
 assert.equal(await run('fetchGoldHistory(false)'),false,'cached for 12 hours');
 nextHistory={error:'bad result'};freeHistory={error:'bad'};
 assert.equal(await run('fetchGoldHistory(true)'),false,'invalid responses rejected');
 assert.equal(history.meta['2026-10'].method,'month-end-close','failed refresh cannot erase saved history');
 assert(!source.includes("j.currency!=='USD')throw"),'a quote without a currency field must be accepted');
 assert(backend.includes('freegoldapi.com/data/latest.json')&&backend.includes('query1.finance.yahoo.com'),'three history sources on the ledger side');
 console.log('PASS: gold sources, month-end selection, second source, old cache kept, failed refresh protection');
})().catch(e=>{console.error(e);process.exitCode=1});
