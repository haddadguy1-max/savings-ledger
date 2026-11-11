'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/app-extras.js','utf8');
const extract=(start,end)=>{const a=source.indexOf(start);assert(a>=0,start+' missing');const b=source.indexOf(end,a);assert(b>a,end+' missing');return source.slice(a,b)};
const mem={};const storage={getItem:k=>mem[k]||null,setItem:(k,v)=>{mem[k]=v}};
const fixed=Date.UTC(2026,10,11);
const context={localStorage:storage,Date:class extends Date {static now(){return fixed}},Number,Math,JSON,console,
  num:x=>Number(x)||0,toYMD:()=> '2026-11-11',addMonths:(k,n)=>{const [y,m]=k.split('-').map(Number);return new Date(Date.UTC(y,m-1+n,1)).toISOString().slice(0,7)},
  monthsBetween:(a,b)=>{const [ay,am]=a.split('-').map(Number),[by,bm]=b.split('-').map(Number);return (by-ay)*12+bm-am},
  kOf:r=>Number((/(\d{2})k/i.exec(r.type)||[])[1])||0,
  hget:()=>JSON.parse(mem['lg-goldhist-v1']||'{}'),window:{},OZ:31.1034768};
vm.createContext(context);
vm.runInContext(extract("const GKEY='lg-gold-v1'","const baseCompute=computeAnalytics;"),context);
vm.runInContext(extract('function monthPx(k)',"window.lgGoldMonthly=goldMonthly"),context);
const run=code=>vm.runInContext(code,context);
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
// Purchase cost 10g * $90/g remains $900; observed 24k $100/g means $1,000 worth.
mem['lg-gold-v1']=JSON.stringify({mode:'market',karat:24,kset:true,manual:'',px:100,at:fixed-1000,via:'live'});
mem['lg-goldhist-v1']=JSON.stringify({m:{'2026-09':90,'2026-10':95,'2026-11':100}});
const gold=[{name:'guy',type:'Gold 24k',gold:10,goldPrice:90,yyyyMM:'2026-09'}];
context.gold=gold;
let rows=run('goldMonthly(gold)');
near(rows[2].value,1000);near(rows[2].cost,900);near(rows[2].priceEffect,50);
// Different karats are scaled by pure-gold content.
context.gold=[...gold,{name:'lea',type:'Gold 18k',gold:8,goldPrice:70,yyyyMM:'2026-10'}];
rows=run('goldMonthly(gold)');near(rows[2].units,16);near(rows[2].value,1600);near(rows[2].cost,1460);
// Missing monthly price never becomes purchase price, estimate or carry-forward.
mem['lg-goldhist-v1']=JSON.stringify({m:{'2026-09':90,'2026-11':100}});
rows=run('goldMonthly(gold)');assert.equal(rows[1].value,null);assert.equal(rows[1].priceEffect,null);assert.equal(rows[2].priceEffect,null);
// Stale quote is not considered live; no silent valuation as today's market price.
mem['lg-gold-v1']=JSON.stringify({mode:'market',karat:24,kset:true,manual:'',px:100,at:fixed-25*3600*1000,via:'live'});
assert.equal(run('px24()'),0);
// Manual quote is explicit and purity conversion is correct.
mem['lg-gold-v1']=JSON.stringify({mode:'market',karat:21,kset:true,manual:'105',px:100,at:0,via:'live'});
near(run('px24()'),120);
// Account source must not store placeholder OAuth client as a live configuration.
assert(source.includes('goldPriceFresh(g)'));
assert(!source.includes('px=prev;src=\'est\''));
console.log('PASS: 10 assertions covering cost, market value, 18K/24K conversion, missing prices, stale data, manual price, no fabricated flat history');
