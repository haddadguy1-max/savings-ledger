'use strict';
/* Gold price model, run with: node test_calculations.js */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/app-extras.js','utf8');
const extract=(start,end)=>{const a=source.indexOf(start);assert(a>=0,start+' missing');const b=source.indexOf(end,a);assert(b>a,end+' missing');return source.slice(a,b)};
const mem={};const fixed=new Date(2026,10,11,12).getTime();
const p2=x=>String(x).padStart(2,'0');
const ctx={localStorage:{getItem:k=>mem[k]||null,setItem:(k,v)=>{mem[k]=v}},Date:class extends Date{constructor(...a){a.length?super(...a):super(fixed)}static now(){return fixed}},Number,Math,JSON,console,Object,
  num:x=>Number(x)||0,toYMD:ts=>{const d=new Date(ts);return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`},
  addMonths:(k,n)=>{const [y,m]=k.split('-').map(Number),d=new Date(y,m-1+n,1);return `${d.getFullYear()}-${p2(d.getMonth()+1)}`},
  hget:()=>JSON.parse(mem['lg-goldhist-v1']||'{}'),window:{},dataRev:0,allData:null,_hs:''};
vm.createContext(ctx);
vm.runInContext(extract("const GKEY='lg-gold-v1'","const baseCompute=computeAnalytics;"),ctx);
vm.runInContext(extract('function goldRank(meta)','/* A month\'s price, per gram of 24k.') ,ctx);
vm.runInContext(extract('function observedMonthPx(k)','window.lgGoldMonthly=goldMonthly'),ctx);
const run=c=>vm.runInContext(c,ctx),near=(a,b,m)=>assert(Math.abs(a-b)<1e-6,`${m||''} ${a} != ${b}`);
const setG=o=>{mem['lg-gold-v1']=JSON.stringify(Object.assign({mode:'market',karat:24,kset:true,manual:'',px:0,at:0},o))};
const setH=o=>{mem['lg-goldhist-v1']=JSON.stringify(o)};
const buy=[{name:'guy',type:'Gold 24k',gold:10,goldPrice:90,yyyyMM:'2026-08'}];
let r;

/* 1. full history: value is grams x that month's price, cost stays what was paid */
setG({px:100,at:fixed-1000,via:'live'});setH({m:{'2026-08':88,'2026-09':90,'2026-10':95},meta:Object.fromEntries(['2026-08','2026-09','2026-10'].map(k=>[k,{method:'month-end-close',at:fixed-86400000}]))});
ctx.g=buy;r=run('goldMonthly(g)');
assert.equal(r.length,4);near(r[1].value,900);near(r[1].cost,900);near(r[2].value,950);near(r[2].priceEffect,50);
near(r[3].value,1000,'current month uses the latest price');assert.equal(r[3].src,'live');assert.equal(r.some(x=>x.est),false);

/* 2. purity: 18k counts for 18/24 of its weight */
ctx.g=[...buy,{name:'lea',type:'Gold 18k',gold:8,goldPrice:70,yyyyMM:'2026-10'}];r=run('goldMonthly(g)');
near(r[3].units,16);near(r[3].value,1600);near(r[3].cost,1460);

/* 3. a missing month uses the last earlier recorded observation, never future prices. */
setH({m:{'2026-08':88,'2026-10':96}});ctx.g=buy;r=run('goldMonthly(g)');
near(r[1].px,88);assert.equal(r[1].est,true);assert.equal(r[1].src,'carried');
assert.equal(r[0].est,true);assert.equal(r[2].est,true); // legacy cache lacks proof of dated closes

/* 4. when only today's price exists, historic net worth stays at cost rather than
   manufacturing past market quotes from what the person paid. */
setH({});r=run('goldMonthly(g)');
assert.equal(r.slice(0,3).every(x=>x.px===null&&x.src==='cost'&&x.value===900),true);
assert.equal(r[3].px,100);near(r[3].value,1000);

/* 5. no price from anywhere: gold stays at what was paid, and says so */
setG({});r=run('goldMonthly(g)');
assert.equal(r.every(x=>x.src==='cost'&&x.px===null),true);near(r[3].value,900);

/* 6. a price typed for a month wins over the market's */
setG({px:100,at:fixed-1000,via:'live'});setH({m:{'2026-09':90},man:{'2026-09':93}});r=run('goldMonthly(g)');
near(r[1].px,93);assert.equal(r[1].src,'manual');

/* 7. today's typed price is per gram of the default purity */
setG({karat:21,manual:'105'});near(run('px24()'),120);

/* 8. an old price is kept and shown as the last one received, never dropped */
setG({px:100,at:fixed-3*86400000,via:'live'});near(run('px24()'),100);assert.equal(run('goldPriceFresh(gset())'),false);
setH({m:{'2026-08':88,'2026-09':90,'2026-10':95}});r=run('goldMonthly(g)');assert.equal(r[3].src,'cached');near(r[3].value,1000);

/* 9. a verified market close from Sheets beats a legacy cached monthly average. */
setH({m:{'2026-09':88},srv:{months:{'2026-09':95},meta:{'2026-09':{method:'month-end-close',at:Date.UTC(2026,8,30)}}}});
near(run("observedMonthPx('2026-09').px"),95);
assert.equal(run("observedMonthPx('2026-09').src"),'market');

/* 10. the ledger's price is the second source */
assert(source.includes("const sv=hget().srv,previous=gset();"));
console.log('PASS: 10 gold price checks');
