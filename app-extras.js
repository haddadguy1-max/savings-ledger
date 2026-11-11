/* Savings Ledger: in-app entry, on-device storage, backup, and PWA wiring.
   Loaded after the main page script, so it can use its data and render functions. */
(function(){
const KEY='lg-ledger-v1', PREF='lg-ledger-prefs-v1', TOMB='lg-ledger-tomb-v1', SYNC='lg-sync-v1';
let lastSig={},tomb={},ver=0,syncing=false,syncAgain=false,syncTimer=null,syncState='';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=parseFloat(String(v).replace(/\s/g,'').replace(',','.'));return isNaN(n)?0:n;};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const p2=x=>String(x).padStart(2,'0');
const toYMD=ts=>{if(!ts)return '';const d=new Date(ts);return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;};
const readPrefs=()=>{try{return JSON.parse(localStorage.getItem(PREF)||'{}');}catch(e){return {};}};
const writePrefs=o=>{try{localStorage.setItem(PREF,JSON.stringify(Object.assign(readPrefs(),o)));}catch(e){}};

/* ---------- PWA wiring ---------- */
function headTag(tag,attrs){const el=document.createElement(tag);for(const k in attrs)el.setAttribute(k,attrs[k]);document.head.appendChild(el);}
if(!document.querySelector('link[rel="manifest"]'))headTag('link',{rel:'manifest',href:'manifest.json'});
if(!document.querySelector('link[rel="apple-touch-icon"]'))headTag('link',{rel:'apple-touch-icon',href:'icon-180.png'});
[['theme-color','#16232F'],['apple-mobile-web-app-capable','yes'],['mobile-web-app-capable','yes'],
 ['apple-mobile-web-app-title','Savings'],['apple-mobile-web-app-status-bar-style','default']]
 .forEach(([n,c])=>{if(!document.querySelector(`meta[name="${n}"]`))headTag('meta',{name:n,content:c});});
const APPV='29',APPDATE='11 Nov 2026';
let swReg=null,hadSW=!!(navigator.serviceWorker&&navigator.serviceWorker.controller),updShown=false;
function showUpdate(){
  if(updShown)return;updShown=true;
  document.body.insertAdjacentHTML('beforeend','<div id="x-upd" role="status"><span>A new version is ready.</span><button type="button" id="x-upd-go">Update now</button></div>');
  document.getElementById('x-upd-go').onclick=async()=>{try{if(swReg)await swReg.update();}catch(e){}location.reload();};
}
/* a second, plain check that does not depend on the service worker: compare this copy with the one on the site */
let verAt=0;
async function checkVersion(){
  if(Date.now()-verAt<5*60*1000||!navigator.onLine)return;verAt=Date.now();
  try{const r=await fetch('version.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)return;const j=await r.json();
    if(j&&j.v&&String(j.v)!==APPV&&Number(j.v)>Number(APPV))showUpdate();}catch(e){}
}
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').then(r=>{swReg=r;}).catch(()=>{}));
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadSW)showUpdate();hadSW=true;});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&swReg)swReg.update().catch(()=>{});});
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkVersion();});
setTimeout(checkVersion,4000);
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();}catch(e){}

/* ---------- styles and markup ---------- */
const css=`
[hidden]{display:none!important}
body{padding-bottom:calc(96px + env(safe-area-inset-bottom))!important}
#x-fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:150;background:var(--ink);color:#fff;border:0;
 border-radius:999px;padding:14px 22px;font:600 15px "IBM Plex Sans",sans-serif;box-shadow:0 6px 20px rgba(22,35,47,.3);cursor:pointer;-webkit-tap-highlight-color:transparent}
#x-fab:active{transform:scale(.97)}
#x-upd{position:fixed;left:12px;right:12px;top:calc(10px + env(safe-area-inset-top));z-index:500;background:var(--ink);color:#fff;border-radius:14px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:14px;box-shadow:0 8px 24px rgba(22,35,47,.35);max-width:520px;margin:0 auto}
#x-upd button{background:#D8B25C;color:#16232F;border:0;border-radius:999px;font:700 13px "IBM Plex Sans",sans-serif;padding:8px 14px;cursor:pointer}
#x-scrim{position:fixed;inset:0;background:rgba(22,35,47,.45);z-index:300}
#x-sheet{position:fixed;left:0;right:0;bottom:0;margin:0 auto;max-width:520px;max-height:92vh;overflow-y:auto;z-index:310;background:var(--card);
 border-radius:20px 20px 0 0;padding:10px 18px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -8px 30px rgba(22,35,47,.25)}
#x-sheet:not([hidden]){animation:xup .22s ease-out}
@keyframes xup{from{transform:translateY(40px);opacity:.4}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){#x-sheet:not([hidden]){animation:none}}
.x-grab{width:40px;height:4px;border-radius:4px;background:var(--line);margin:0 auto 10px}
.x-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
.x-head h2{margin:0;font-family:"Newsreader",serif;font-weight:600;font-size:21px}
#x-close{background:none;border:0;font-size:18px;color:var(--muted);padding:8px;cursor:pointer}
.x-label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin:14px 0 6px}
.x-input{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:12px;font:inherit;font-size:16px;background:var(--card);color:var(--ink)}
.x-input:focus{outline:2px solid var(--cash);outline-offset:-1px}
.x-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.x-prev{min-height:20px;margin:12px 0 0;font-size:13px;color:var(--ink-2)}
.x-err{min-height:18px;margin:4px 0 0;font-size:13px;color:var(--debt);font-weight:600}
.x-actions{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.x-primary,.x-secondary{font:600 15px "IBM Plex Sans",sans-serif;padding:14px;border-radius:12px;cursor:pointer;border:1px solid var(--ink)}
.x-primary{background:var(--ink);color:#fff}.x-secondary{background:var(--card);color:var(--ink)}
#x-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));z-index:400;background:var(--ink);color:#fff;
 padding:11px 16px;border-radius:12px;font-size:14px;display:flex;gap:14px;align-items:center;box-shadow:0 6px 20px rgba(22,35,47,.3);max-width:92vw}
#x-toast button{background:none;border:0;color:#D8B25C;font:700 14px "IBM Plex Sans",sans-serif;cursor:pointer;padding:0}
.x-link{background:none;border:0;color:var(--cash);font:600 13px "IBM Plex Sans",sans-serif;cursor:pointer;padding:4px 6px}
.x-link.x-del{color:var(--debt)}
.x-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.x-btns button{font:600 14px "IBM Plex Sans",sans-serif;padding:10px 16px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}
.x-btns button.danger{color:var(--debt)}
.x-about{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:12.5px;color:var(--muted)}
.x-btns label{font:600 14px "IBM Plex Sans",sans-serif;padding:10px 16px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}
#x-raw summary{cursor:pointer;font-family:"Newsreader",serif;font-weight:600;font-size:19px;list-style:none;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
#x-raw summary::-webkit-details-marker{display:none}
#x-raw summary::before{content:'▸';color:var(--muted)}
#x-raw details[open] summary::before{content:'▾'}
#x-raw summary .hint{font:400 12px "IBM Plex Sans",sans-serif;color:var(--muted)}
#x-raw-table{min-width:860px}
#x-raw-table td{padding:4px 6px}
.x-cell{width:100%;min-width:64px;border:1px solid transparent;background:transparent;font:inherit;font-size:14px;padding:8px 6px;border-radius:8px;color:var(--ink)}
.x-cell:focus{border-color:var(--cash);background:#fff;outline:none}
.x-cell.bad{border-color:var(--debt);background:#F7E7E5}
select.x-cell{-webkit-appearance:none;appearance:none}
.x-note{font-size:12px;color:var(--muted);margin:10px 2px 0;line-height:1.5}
`;
const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);

const KINDS=[['deposit','Deposit'],['withdraw','Withdrawal'],['gold','Gold'],['loan_taken','Loan taken'],['loan_repaid','Loan repaid']];
document.body.insertAdjacentHTML('beforeend',`
<button id="x-fab" type="button">+ Add entry</button>
<div id="x-scrim" hidden></div>
<div id="x-sheet" role="dialog" aria-modal="true" aria-labelledby="x-title" hidden>
 <div class="x-grab"></div>
 <div class="x-head"><h2 id="x-title">New entry</h2><button type="button" id="x-close" aria-label="Close">✕</button></div>
 <form id="x-form" novalidate>
  <div class="x-label">Type</div>
  <div class="filter-chips" id="x-kinds">${KINDS.map(([k,l])=>`<button type="button" data-kind="${k}">${l}</button>`).join('')}</div>
  <div class="x-label">Who</div>
  <div class="toggle-group" id="x-who" style="flex-wrap:wrap"></div>
  <div id="x-cashbox"><label class="x-label" for="x-amt">Amount (USD)</label>
   <input id="x-amt" class="x-input" inputmode="decimal" autocomplete="off" placeholder="0.00"></div>
  <div id="x-goldbox" hidden><div class="x-row">
   <div><label class="x-label" for="x-g">Grams</label><input id="x-g" class="x-input" inputmode="decimal" autocomplete="off" placeholder="0"></div>
   <div><label class="x-label" for="x-p">Purchase price per gram (USD)</label><input id="x-p" class="x-input" inputmode="decimal" autocomplete="off" placeholder="0.00"></div></div>
   <label class="x-label" for="x-total-paid">Or total amount paid (USD, including fees)</label><input id="x-total-paid" class="x-input" inputmode="decimal" autocomplete="off" placeholder="Optional — enter total paid instead of price/gram">
   <p class="x-note" style="margin:6px 0 12px">Enter either the purchase price per gram or the full amount you paid. The total includes any dealer fees or premium. Market value is calculated separately using the live gold price.</p>
   <label class="x-label" for="x-k">Purity</label><select id="x-k" class="x-input"><option value="">Default (set in Gold valuation)</option><option value="24">24k</option><option value="22">22k</option><option value="21">21k</option><option value="18">18k</option></select></div>
  <label class="x-label" for="x-date">Date</label><input type="date" id="x-date" class="x-input">
  <p class="x-prev" id="x-prev"></p><p class="x-err" id="x-err" role="alert"></p>
  <div class="x-actions"><button type="submit" class="x-primary" id="x-save">Save entry</button>
   <button type="button" class="x-secondary" id="x-again">Save and add another</button></div>
 </form>
</div>`);
$('x-fab').insertAdjacentHTML('afterend','<div id="x-toast" hidden></div>');

const main=document.querySelector('main');
main.insertAdjacentHTML('afterbegin',`<div class="kpi-card" id="x-empty" style="margin-bottom:18px" hidden>
 <div class="kpi-value" style="font-family:'Newsreader',serif;font-size:22px">Your ledger is empty</div>
 <div class="kpi-sub" style="font-size:13.5px;margin-top:8px">Already have a shared ledger? <strong>Sign in</strong> just below and your entries appear. Starting fresh? Tap <strong>Add entry</strong>, or import a CSV at the bottom.</div></div>`);
main.insertAdjacentHTML('beforeend',`<div class="section" id="x-data"><div class="section-header"><h2>Your data</h2><span class="hint" id="x-data-hint"></span></div>
 <div class="kpi-card"><div class="kpi-sub" style="font-size:13px;margin:0" id="x-data-sub"></div>
 <div class="x-btns"><button type="button" id="x-export">Export backup (CSV)</button><label for="file-input">Import CSV</label><button type="button" id="x-reset">Restore original data</button><button type="button" id="x-clear" class="danger">Clear all data</button></div>
 <div class="x-about"><span id="x-ver"></span><button type="button" class="x-link" id="x-upd-check">Check for updates</button></div></div></div>`);
$('x-reset').hidden=!$('seed-csv');
$('x-upd-check').onclick=async()=>{
  if(!swReg){toast('Updates are checked when the app is installed or opened from its web address.');return;}
  toast('Checking…');
  try{await swReg.update();}catch(e){toast('Could not check. Are you offline?');return;}
  verAt=0;await checkVersion();
  setTimeout(()=>{if(!updShown)toast('You have the latest version.');},2500);
};
const thr=document.querySelector('#tx-table thead tr');
if(thr){const th=document.createElement('th');th.className='r';th.setAttribute('aria-label','Actions');thr.appendChild(th);}

/* ---------- storage ---------- */
let undoSnap=null,toastTimer=null;
const snapshot=()=>{undoSnap=JSON.stringify(allData);};
const SIGF=['date','type','gold','eur','usd','name','goldPrice'];
const sig=r=>JSON.stringify(SIGF.map(f=>r[f]));
function persist(){dataRev++;try{localStorage.setItem(KEY,JSON.stringify(allData));localStorage.setItem(TOMB,JSON.stringify(tomb));}catch(e){toast('Could not save on this device. Export a backup.');}}
/* Every local change goes through save(): it stamps changed rows, remembers deletions, then schedules a sync. */
function save(){
  const now=Date.now(),seen={};ver++;
  allData.forEach(r=>{seen[r.id]=1;const s=sig(r);if(lastSig[r.id]!==s){r.updated=now;lastSig[r.id]=s;delete tomb[r.id];}});
  Object.keys(lastSig).forEach(id=>{if(!seen[id]){tomb[id]=now;delete lastSig[id];}});
  persist();markDirty();scheduleSync();
}
function loadSaved(){try{const r=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(r)?r:[];}catch(e){return [];}}
function status(){
  $('file-info').textContent=(allData.length?`${allData.length} entries`:'No entries yet')+(cfg()?` · ${syncState||'Signed in'}${isDirty()&&!/Sync|Connect/.test(syncState)?' · changes waiting to upload':''}`:' · saved on this phone');
  const b=readPrefs().lastBackup;$('x-data-hint').textContent=b?`Last export ${b}`:'';
  const ba=shared.backupAt?new Date(shared.backupAt):null;
  $('x-data-sub').textContent=cfg()
    ?('Your entries are saved to your shared ledger. '+(shared.ok?`Your settings are saved there too, so they follow you to any phone. `+(shared.api>=2?`The ledger keeps a weekly copy by itself${ba?` (last one ${ba.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][ba.getMonth()]})`:''}, and the last 8 stay in the Sheet as “Backup” tabs.`:'Update the ledger script (Code.gs) to add weekly automatic copies and a second source for gold prices.'):(shared.ok===false?'This ledger runs an old script that cannot store settings. Update the ledger script (Code.gs) so your names, target and gold options are saved with the ledger.':'')))
    :'Entries live on this phone only. Sign in to share them, or export a backup now and then.';
  $('x-ver').textContent=`Version ${APPV} · ${APPDATE}`+(cfg()&&shared.ok!=null?` · ledger script ${shared.ok&&shared.api>=5?'up to date':'update Code.gs'}`:'');
}
function setData(rows){allData=rows;save();status();renderAll();}
function toast(msg,undo){
  const t=$('x-toast');clearTimeout(toastTimer);t.hidden=false;t.innerHTML=`<span>${esc(msg)}</span>${undo?'<button type="button" id="x-undo">Undo</button>':''}`;
  if(undo)$('x-undo').onclick=()=>{if(undoSnap){allData=JSON.parse(undoSnap);undoSnap=null;save();status();renderAll();}t.hidden=true;};
  toastTimer=setTimeout(()=>{t.hidden=true;},6000);
}

/* ---------- render overrides ---------- */
const baseRenderAll=renderAll;
renderAll=function(){
  const sec=['hero','kpi-grid','filter-section','charts-section','bridge-section','insights-section','trends-section','variance-section'];
  if(!allData.length){sec.forEach(id=>$(id).hidden=true);$('tx-search').hidden=true;$('x-empty').hidden=false;renderTable([]);return;}
  $('x-empty').hidden=true;
  const filtered=getFilteredData();
  if(!computeAnalytics(filtered).keys.length){
    sec.forEach(id=>{$(id).hidden=id!=='filter-section';});$('tx-search').hidden=false;renderTable(filtered);return;
  }
  baseRenderAll();
};
/* ---------- ledger: filters, market value, clickable cells ---------- */
const LF={who:'',cat:'',year:''};
const kOf=d=>{const m=/(\d{2})\s*k/i.exec(d.type||'');return m?+m[1]:0;};
const isLoanRow=d=>isLoanName(d.name);
const isGoldRow=d=>!isLoanRow(d)&&(d.gold||0)>0;
const goldNow=d=>{const p=pxNow();return p>0?(d.gold||0)*p*rowKarat(d)/24:(d.gold||0)*(d.goldPrice||0);};   /* falls back to what was paid only when no price exists at all */
function lfPass(d){
  const n=d.name||'',loan=isLoanRow(d),gold=isGoldRow(d);
  if(LF.who&&ownerKey(n)!==LF.who)return false;
  if(LF.cat==='Loan'&&!loan)return false;
  if(LF.cat==='Cash'&&(loan||gold))return false;
  if(LF.cat==='Gold'&&!gold)return false;
  if(/^Gold \d+k$/.test(LF.cat)&&!(gold&&kOf(d)===+LF.cat.slice(5,-1)))return false;
  if(LF.year&&!String(d.yyyyMM||'').startsWith(LF.year))return false;
  return true;
}
function lfControls(rows){
  const years=[...new Set(rows.map(d=>String(d.yyyyMM||'').slice(0,4)).filter(Boolean))].sort().reverse();
  const ks=[...new Set(rows.filter(isGoldRow).map(kOf).filter(Boolean))].sort((a,b)=>b-a);
  const set=(id,opts,val)=>{const el=$(id);if(!el)return;el.innerHTML=opts.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('');el.value=val;};
  if(LF.who&&!people().some(p=>ownerKey(p)===LF.who))LF.who='';
  set('x-lf-who',[['','Everyone'],...people().map(p=>[ownerKey(p),p])],LF.who);
  set('x-lf-cat',[['','All types'],['Cash','Cash'],['Gold','Gold'],...ks.map(k=>[`Gold ${k}k`,`Gold ${k}k`]),['Loan','Loans']],LF.cat);
  set('x-lf-year',[['','All years'],...years.map(y=>[y,y])],LF.year);
}
renderTable=function(filtered){
  const tbody=document.querySelector('#tx-table tbody');tbody.innerHTML='';
  const q=txQuery.trim().toLowerCase();
  lfControls(filtered);
  let rows=[...filtered].sort((a,b)=>b.sortTs-a.sortTs).filter(lfPass);
  if(q)rows=rows.filter(d=>(d.name||'').includes(q)||(d.type||'').toLowerCase().includes(q));
  let paid=0,now=0,cash=0;
  if(!rows.length){
    tbody.innerHTML=`<tr><td colspan="8" class="empty-note">${allData.length?'No entries match these filters':'No entries yet. Tap Add entry or upload a CSV.'}</td></tr>`;
    $('tx-count').innerText='(0)';if($('x-lf-sum'))$('x-lf-sum').textContent='';return;
  }
  rows.forEach(d=>{
    const gVal=(d.gold||0)*(d.goldPrice||0),loan=isLoanRow(d),gold=isGoldRow(d);
    const cat=loan?'Loan':(gold?'Gold':'Cash');
    const gn=gold?goldNow(d):0;
    if(!loan){cash+=d.usd||0;if(gold){paid+=gVal;now+=gn;}}else cash+=d.usd||0;
    const gain=gold&&gVal>0?gn/gVal-1:null;
    const tr=document.createElement('tr');
    tr.innerHTML=`<td style="white-space:nowrap">${esc((d.date||'').split(' ')[0])}</td>
      <td class="x-click" data-lf="who" data-val="${esc(ownerKey(d.name))}" style="font-weight:500;text-transform:capitalize">${esc(d.name)}</td>
      <td class="num ${d.usd<0?'neg':''}" data-v="${d.usd||0}">${d.usd<0?'−':''}$${Math.abs(d.usd).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      <td class="num" data-v="${d.gold||0}">${d.gold?d.gold.toFixed(2)+' g'+(kOf(d)?' · '+kOf(d)+'k':''):'—'}</td>
      <td class="num" data-v="${gVal||0}">${gVal?money2(gVal):'—'}</td>
      <td class="num" data-v="${gold?gn:0}">${gold?money2(gn)+(gain==null?'':`<div class="x-sub ${gain>=0?'pos':'neg'}">${(gain>=0?'+':'−')+Math.abs(gain*100).toFixed(1)}%</div>`):'—'}</td>
      <td class="x-click" data-lf="cat" data-val="${cat}"><span class="badge ${cat.toLowerCase()}">${cat}</span></td>
      <td class="num"><button class="x-link" data-act="edit" data-id="${esc(d.id)}">Edit</button><button class="x-link x-del" data-act="del" data-id="${esc(d.id)}">Delete</button></td>`;
    tbody.appendChild(tr);
  });
  $('tx-count').innerText=`(${rows.length})`;
  if($('x-lf-sum'))$('x-lf-sum').textContent=`${rows.length} entr${rows.length>1?'ies':'y'} · ${money0(cash)} in dollars`+(paid?` · gold paid ${money0(paid)}, worth ${money0(now)} now`:'');
  if(window.lgApplySort)window.lgApplySort('tx-table');
};
loadFile=function(file){
  $('file-info').textContent=`Loading ${file.name}…`;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const parsed=parseCSV(ev.target.result);
      if(!parsed.length){alert('No valid rows found in this CSV.');status();return;}
      if(allData.length&&!confirm(`Replace the ${allData.length} saved entries with the ${parsed.length} rows in this file?`)){status();return;}
      snapshot();parsed.forEach(r=>{r.id=uid();});setData(parsed);toast(`Imported ${parsed.length} entries`,true);
    }catch(err){alert('Could not read the CSV: '+err.message);status();}
  };
  reader.readAsText(file);$('file-input').value='';
};

/* ---------- entry sheet ---------- */
const S={kind:'deposit',who:'',editId:null};
function renderWho(){
  const P=people();
  if(!P.some(p=>ownerKey(p)===ownerKey(S.who)))S.who=P[0]||'';
  $('x-who').innerHTML=P.map(p=>`<button type="button" data-who="${esc(p)}">${esc(p)}</button>`).join('')+`<button type="button" data-new="1">+ New</button>`;
  document.querySelectorAll('#x-who button[data-who]').forEach(b=>b.classList.toggle('active',ownerKey(b.dataset.who)===ownerKey(S.who)));
}
function addPerson(name){
  name=String(name||'').trim().replace(/\s+/g,' ');if(!name||!ownerKey(name))return '';
  if(/loan/i.test(name)){toast('A name cannot contain the word "loan".');return '';}
  const P=people(),hit=P.find(p=>ownerKey(p)===ownerKey(name));if(hit)return hit;
  saveCfg({people:[...P,name]});return name;
}
function setKind(k){S.kind=k;document.querySelectorAll('#x-kinds button').forEach(b=>b.classList.toggle('active',b.dataset.kind===k));
  $('x-goldbox').hidden=k!=='gold';$('x-cashbox').hidden=k==='gold';preview();}
function setWho(w){S.who=w||'';renderWho();}
function preview(){
  let t='';
  if(S.kind==='gold'){const g=num($('x-g').value),v=g*num($('x-p').value);if(v>0)t=`Purchase cost ${money2(v)} (${money2(num($('x-p').value))}/g). Market value and unrealized gain/loss are calculated separately.`;}
  else{const a=num($('x-amt').value);if(a>0)t={deposit:`Cash +${money2(a)} · net worth +${money2(a)}`,withdraw:`Cash −${money2(a)} · net worth −${money2(a)}`,
    loan_taken:`Loans +${money2(a)} · net worth −${money2(a)}`,loan_repaid:`Loans −${money2(a)} · net worth +${money2(a)}`}[S.kind];}
  $('x-prev').textContent=t;
}
function openSheet(row){
  const pr=readPrefs();S.editId=row?row.id:null;S.dupOk='';$('x-err').textContent='';
  $('x-title').textContent=row?'Edit entry':'New entry';$('x-again').hidden=!!row;$('x-save').textContent=row?'Save changes':'Save entry';
  if(row){
    const n=row.name||'',loan=n.includes('loan');
    setKind(loan?(row.usd<0?'loan_taken':'loan_repaid'):row.gold>0?'gold':(row.usd<0?'withdraw':'deposit'));
    setWho(people()[personIdx(row)]||'');
    $('x-amt').value=row.gold>0?'':Math.abs(row.usd||0)||'';$('x-g').value=row.gold>0?row.gold:'';$('x-p').value=row.goldPrice||'';$('x-total-paid').value=row.gold>0&&row.goldPrice>0?String(Math.round(row.gold*row.goldPrice*100)/100):'';$('x-k').value=(/(\d{2})\s*k/i.exec(row.type||'')||['',''])[1];
    $('x-date').value=toYMD(row.sortTs)||toYMD(Date.now());
  }else{
    setKind(pr.kind||'deposit');setWho(pr.who||'');
    $('x-amt').value='';$('x-g').value='';$('x-p').value=pr.price||'';$('x-total-paid').value='';$('x-k').value=pr.karat||'';$('x-date').value=toYMD(Date.now());
  }
  preview();$('x-scrim').hidden=false;$('x-sheet').hidden=false;document.body.style.overflow='hidden';
  setTimeout(()=>$(S.kind==='gold'?'x-g':'x-amt').focus(),60);
}
function closeSheet(){$('x-sheet').hidden=true;$('x-scrim').hidden=true;document.body.style.overflow='';}
function submit(again){
  const err=$('x-err');err.textContent='';
  const ymd=$('x-date').value;if(!ymd){err.textContent='Pick a date.';return;}
  if(ymd>toYMD(Date.now())){err.textContent='That date is in the future. Use today or an earlier date.';return;}
  const [y,m,d]=ymd.split('-').map(Number),now=new Date();
  const date=`${p2(d)}/${p2(m)}/${y} ${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`;
  const k=S.kind,row={id:S.editId||uid(),date,sortTs:parseSortDate(date),yyyyMM:parseDateToYYYYMM(date),type:'Cash USD',gold:0,eur:0,usd:0,goldPrice:0,name:S.who.toLowerCase()};
  if(!S.who){err.textContent='Choose who this is for, or tap + New to add a name.';return;}
  if(k==='gold'){
    const g=num($('x-g').value),p=num($('x-p').value);
    if(!Number.isFinite(g)||!Number.isFinite(p)||g<=0||p<=0){err.textContent='Enter the grams and what you paid, both above zero.';return;}
    if(!(g>0)||!(p>0)){err.textContent='Enter grams and a price per gram above zero.';return;}
    const kt=$('x-k').value;row.type=kt?`Gold ${kt}k`:'Gold';row.gold=g;row.goldPrice=p;writePrefs({price:p,karat:kt});
  }else{
    const a=num($('x-amt').value);
    if(!(a>0)){err.textContent='Enter an amount above zero.';return;}
    row.usd=(k==='withdraw'||k==='loan_taken')?-a:a;
    if(k==='loan_taken'||k==='loan_repaid')row.name=S.who.toLowerCase()+' - loan';
  }
  if(!S.editId){
    const dsig=[ownerKey(row.name),isLoanName(row.name)?1:0,ymd,row.usd,row.gold].join('|');
    const dup=allData.find(r=>ownerKey(r.name)===ownerKey(row.name)&&isLoanName(r.name)===isLoanName(row.name)&&toYMD(r.sortTs)===ymd&&Math.abs((r.usd||0)-row.usd)<0.005&&Math.abs((r.gold||0)-row.gold)<0.0005);
    if(dup&&S.dupOk!==dsig){S.dupOk=dsig;err.textContent='You already have this entry: same person, amount and day. Tap Save again to add it anyway.';return;}
  }
  S.dupOk='';
  snapshot();
  if(S.editId){
    const i=allData.findIndex(r=>r.id===S.editId);
    if(i>=0){const o=allData[i];if(ymd===toYMD(o.sortTs)){row.date=o.date;row.sortTs=o.sortTs;row.yyyyMM=o.yyyyMM;}allData[i]=row;}
  }else allData.push(row);
  writePrefs({kind:k,who:S.who});save();status();renderAll();
  toast(S.editId?'Entry updated':'Entry saved',true);
  if(again){$('x-amt').value='';$('x-g').value='';$('x-total-paid').value='';preview();$('x-' + (k==='gold'?'g':'amt')).focus();}else closeSheet();
}
$('x-fab').onclick=()=>openSheet(null);$('x-empty').addEventListener('click',e=>{if(e.target.closest('button'))openSheet(null);});
$('x-close').onclick=closeSheet;$('x-scrim').onclick=closeSheet;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('x-sheet').hidden)closeSheet();});
$('x-kinds').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setKind(b.dataset.kind);});
$('x-who').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.new){const n=addPerson(prompt('Name of the person'));if(n)setWho(n);}else setWho(b.dataset.who);});
['x-amt','x-g','x-p'].forEach(id=>$(id).addEventListener('input',()=>{if(id==='x-g'||id==='x-p'){const g=num($('x-g').value),p=num($('x-p').value);$('x-total-paid').value=g>0&&p>0?String(Math.round(g*p*100)/100):'';}preview();}));
$('x-total-paid').addEventListener('input',()=>{const g=num($('x-g').value),total=num($('x-total-paid').value);$('x-p').value=g>0&&total>0?String(Math.round(total/g*100000000)/100000000):'';preview();});
$('x-form').addEventListener('submit',e=>{e.preventDefault();submit(false);});
$('x-again').onclick=()=>submit(true);
document.querySelector('#tx-table').addEventListener('click',e=>{
  const b=e.target.closest('button[data-act]');if(!b)return;
  const row=allData.find(r=>r.id===b.dataset.id);if(!row)return;
  if(b.dataset.act==='edit')openSheet(row);
  else{snapshot();allData=allData.filter(r=>r.id!==row.id);save();status();renderAll();toast('Entry deleted',true);}
});

/* ---------- backup ---------- */
const title=s=>s.replace(/\b\w/g,c=>c.toUpperCase());
function toCSV(){
  const head='Timestamp,Saving Type,Amount (g),Amount (EUR),Amount (USD),Name,Column 1,Gold Price';
  const lines=[...allData].sort((a,b)=>a.sortTs-b.sortTs).map(r=>[r.date,r.type||'Cash USD',r.gold||'','',
    (r.usd===0&&r.gold>0)?'':r.usd,title(r.name||''),r.yyyyMM?+r.yyyyMM.split('-')[1]:'',r.goldPrice||''].join(','));
  return [head,...lines].join('\n');
}
$('x-export').onclick=async()=>{
  if(!allData.length){toast('Nothing to export yet.');return;}
  const name=`savings-ledger-${toYMD(Date.now())}.csv`,file=new File([toCSV()],name,{type:'text/csv'});
  writePrefs({lastBackup:toYMD(Date.now())});status();
  if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:name});return;}catch(e){if(e.name==='AbortError')return;}}
  const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=name;document.body.appendChild(a);a.click();a.remove();
};
$('x-clear').onclick=()=>{
  if(!allData.length)return;
  if(confirm(`Delete all ${allData.length} entries from this device? Export a backup first if you need one.`)){snapshot();setData([]);toast('All data cleared',true);}
};

/* ---------- raw data editor ---------- */
let skipRaw=false;
$('x-data').insertAdjacentHTML('beforebegin',`<div class="section" id="x-raw"><details id="x-raw-d">
 <summary>Raw data <span id="x-raw-n"></span><span class="hint">tap any cell to edit, changes save as you go</span></summary>
 <div class="table-container" style="margin-top:10px"><table id="x-raw-table"><thead><tr><th>Date</th><th>Type</th><th class="r">Grams</th><th class="r">EUR</th><th class="r">USD</th><th>Name</th><th class="r">Gold purchase price / g</th><th aria-label="Delete"></th></tr></thead><tbody></tbody></table></div>
 <p class="x-note">Dates read as dd/mm/yyyy, with an optional time. A name containing “loan” makes the row a loan: a negative USD amount is borrowed, a positive one is repaid. Gold rows store the original purchase price per gram (including fees when entered as a total); current market value is calculated separately.</p>
 <div class="x-btns"><button type="button" id="x-raw-add">+ Add blank row</button></div></details></div>`);
const fmtN=v=>(v||v===0)&&v!==0?String(v):'';
function renderRaw(){
  $('x-raw-n').textContent=`(${allData.length} rows)`;
  if(!$('x-raw-d').open)return;
  const types=['Cash USD','Gold','Gold 24k','Gold 22k','Gold 21k','Gold 18k'],tb=document.querySelector('#x-raw-table tbody');
  tb.innerHTML=[...allData].sort((a,b)=>b.sortTs-a.sortTs).map(r=>{
    const ts=types.includes(r.type)?types:[...types,r.type];
    const cell=(f,w)=>`<td><input class="x-cell" data-f="${f}" inputmode="decimal" value="${esc(fmtN(r[f]))}"${w?` style="text-align:right"`:''}></td>`;
    return `<tr data-id="${esc(r.id)}"><td style="min-width:150px"><input class="x-cell" data-f="date" value="${esc(r.date)}"></td>
     <td><select class="x-cell" data-f="type">${ts.map(t=>`<option${t===r.type?' selected':''}>${esc(t)}</option>`).join('')}</select></td>
     ${cell('gold',1)}${cell('eur',1)}${cell('usd',1)}
     <td style="min-width:120px"><input class="x-cell" data-f="name" style="text-transform:capitalize" value="${esc(r.name)}"></td>
     ${cell('goldPrice',1)}<td><button type="button" class="x-link x-del" data-del="1" aria-label="Delete row">✕</button></td></tr>`;
  }).join('');
}
const prevRenderAll=renderAll;
renderAll=function(){prevRenderAll();if(skipRaw)skipRaw=false;else renderRaw();};
$('x-raw-d').addEventListener('toggle',renderRaw);
document.querySelector('#x-raw-table tbody').addEventListener('change',e=>{
  const el=e.target.closest('[data-f]');if(!el)return;
  const row=allData.find(r=>r.id===el.closest('tr').dataset.id);if(!row)return;
  const f=el.dataset.f,v=el.value.trim();
  if(f==='date'){
    if(parseDateToYYYYMM(v)===null){el.classList.add('bad');toast('Date not recognised. Use dd/mm/yyyy, optionally with hh:mm:ss.');return;}
    el.classList.remove('bad');snapshot();row.date=v;row.sortTs=parseSortDate(v);row.yyyyMM=parseDateToYYYYMM(v);
  }else{
    snapshot();
    if(f==='type')row.type=v;else if(f==='name')row.name=v.toLowerCase();else row[f]=num(v);
  }
  skipRaw=true;save();status();renderAll();toast('Saved',true);
});
document.querySelector('#x-raw-table tbody').addEventListener('click',e=>{
  const b=e.target.closest('[data-del]');if(!b)return;
  snapshot();allData=allData.filter(r=>r.id!==b.closest('tr').dataset.id);save();status();renderAll();toast('Row deleted',true);
});
$('x-raw-add').onclick=()=>{
  const n=new Date(),date=`${p2(n.getDate())}/${p2(n.getMonth()+1)}/${n.getFullYear()} ${p2(n.getHours())}:${p2(n.getMinutes())}:${p2(n.getSeconds())}`;
  const row={id:uid(),date,sortTs:parseSortDate(date),yyyyMM:parseDateToYYYYMM(date),type:'Cash USD',gold:0,eur:0,usd:0,goldPrice:0,name:(people()[0]||'').toLowerCase()};
  snapshot();allData.push(row);save();status();renderAll();
  const c=document.querySelector(`#x-raw-table tr[data-id="${row.id}"] [data-f="usd"]`);if(c)c.focus();
};

/* ---------- built-in starting data ---------- */
function seedRows(){const el=$('seed-csv');if(!el)return [];const r=parseCSV(el.textContent);r.forEach((x,i)=>{x.id='s'+i;x.updated=1;});return r;}
$('x-reset').onclick=()=>{
  const s=seedRows();if(!s.length)return;
  if(confirm(`Replace everything on this device with the original ${s.length} rows?`)){snapshot();setData(s);toast('Original data restored',true);}
};
if($('add-btn'))$('add-btn').onclick=()=>openSheet(null);


/* ---------- Google Sheets sync ---------- */
$('x-data').insertAdjacentHTML('beforebegin',`<div class="section" id="x-sync"><div class="section-header"><h2>Sign in</h2><span class="hint" id="x-sync-status"></span></div>
 <div class="kpi-card"><div class="kpi-sub" style="font-size:13px;margin:0 0 4px">Sign in to share one ledger between your phones. Everything you add is saved to it automatically, and what the others add appears here. Keep your login and password private.</div>
 <label class="x-label" for="x-sync-url">Ledger login</label><input id="x-sync-url" class="x-input" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Your ledger login">
 <label class="x-label" for="x-sync-token">Password</label><input id="x-sync-token" type="password" class="x-input" autocomplete="current-password" autocapitalize="off">
 <div class="x-btns"><button type="button" id="x-sync-connect">Sign in</button><button type="button" id="x-sync-invite">Invite someone</button><button type="button" id="x-sync-now">Sync now</button><button type="button" id="x-sync-off" class="danger">Sign out</button></div></div></div>`);
$('x-sync').querySelector('.kpi-card').insertAdjacentHTML('afterbegin',`<div style="margin-bottom:16px"><button type="button" id="x-google-login" class="x-primary" style="width:100%">Sign up with Google · My Drive</button><p class="x-note" id="x-google-info">Your own Google Sheet is created automatically. No Apps Script required. On iPhone, sign in through Safari if the home-screen app blocks Google login.</p></div>`);
$('x-google-login').parentElement.hidden=!(window.LGGoogle&&LGGoogle.ready());
/* Each ledger keeps its own copy of the data on this phone. The live keys are always the truth for the
   ledger in use; a ledger that is not in use is tucked away whole and comes back when you sign in to it again. */
const ACCOUNT_KEYS=[KEY,TOMB,'lg-shu-v1','lg-shs-v1','lg-cfg-v1','lg-gold-v1','lg-goldhist-v1','lg-delivery-v1','lg-xp-v1','lg-ledger-seeded','lg-report-seen','lg-notes-v1','lg-dirty-v1'];
const ACCOUNT_ACTIVE='lg-active-account-v2',DEVICE='device',DIRTY='lg-dirty-v1';
const accountId=(kind,id)=>kind+':'+id;
const activeAccount=()=>{try{return localStorage.getItem(ACCOUNT_ACTIVE)||DEVICE;}catch(e){return DEVICE;}};
const stashKey=id=>'lg-account-cache-v2:'+id;
const hasStash=id=>{try{return !!localStorage.getItem(stashKey(id));}catch(e){return false;}};
/* storage only. carry=true: this phone's own data goes into the ledger instead of being set aside */
function accountMove(id,carry,keepStamps){
  const prev=activeAccount();if(prev===id)return false;
  if(carry&&!hasStash(id)){
    localStorage.removeItem(stashKey(prev));
    if(!keepStamps)['lg-shu-v1','lg-shs-v1'].forEach(k=>localStorage.removeItem(k));   /* first meeting: the ledger's settings win */
  }else{
    const snap={};ACCOUNT_KEYS.forEach(k=>{snap[k]=localStorage.getItem(k);});
    localStorage.setItem(stashKey(prev),JSON.stringify(snap));
    let next={};try{next=JSON.parse(localStorage.getItem(stashKey(id))||'{}')||{};}catch(e){}
    ACCOUNT_KEYS.forEach(k=>next[k]==null?localStorage.removeItem(k):localStorage.setItem(k,next[k]));
    localStorage.removeItem(stashKey(id));
  }
  localStorage.setItem(ACCOUNT_ACTIVE,id);return true;
}
function accountReload(){
  try{CFG=JSON.parse(localStorage.getItem(CFGKEY)||'{}')||{};}catch(e){CFG={};}
  _ppl=null;allData=loadSaved();try{tomb=JSON.parse(localStorage.getItem(TOMB)||'{}')||{};}catch(e){tomb={};}
  lastSig={};allData.forEach(r=>{if(!r.updated)r.updated=1;lastSig[r.id]=sig(r);});ver++;dataRev++;
  shared.ok=null;shared.backupAt=0;shared.applied=false;
  heroYear=null;status();renderAll();
}
const isDirty=()=>{try{return !!localStorage.getItem(DIRTY);}catch(e){return false;}};
const markDirty=()=>{try{if(cfg()&&!localStorage.getItem(DIRTY))localStorage.setItem(DIRTY,String(Date.now()));}catch(e){}};
$('x-google-login').onclick=async()=>{
  try{
    if(!window.LGGoogle)throw Error('Google integration not loaded');
    // Google OAuth must be initiated directly from the user gesture.
    const result=await LGGoogle.login();
    // Switch only after Google has successfully identified its spreadsheet.
    const gid=accountId('google',result.spreadsheetId);
    if(activeAccount()!==gid){accountMove(gid,activeAccount()===DEVICE&&!hasStash(gid)&&result.created);accountReload();}
    localStorage.setItem('lg-google-sheet-id',result.spreadsheetId);
    $('x-google-info').textContent='Connected: '+result.email+' · Google Sheet '+result.spreadsheetId;
    $('x-google-login').textContent='Google account · Reconnect';
    await sync({manual:true});
  }catch(e){toast(e.message||'Google sign-in failed');}
};
/* the login is the ledger's ID, a full link also works; both end up as the same address */
const toUrl=v=>{v=String(v||'').trim();if(/^https:\/\/script\.google\.com\/\S+/.test(v))return v;return /^[A-Za-z0-9_-]{20,}$/.test(v)?'https://script.google.com/macros/s/'+v+'/exec':'';};
const toLogin=u=>{const m=/\/macros\/s\/([^/]+)/.exec(u||'');return m?m[1]:(u||'');};
const cfg=()=>{if(window.LGGoogle?.active())return {mode:'google'};try{return JSON.parse(localStorage.getItem(SYNC)||'null');}catch(e){return null;}};
const isTrue=v=>v===true||v===1||String(v).toLowerCase()==='true';
function setSyncState(t){syncState=t;const el=$('x-sync-status');if(el)el.textContent=t;status();}
function scheduleSync(){if(!cfg())return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>sync({quiet:true}),1500);}
function busy(){const a=document.activeElement;return !$('x-sheet').hidden||!!(a&&a.classList&&a.classList.contains('x-cell'));}
function errText(e){const m=String(e?.message||'');if(m==='unauthorized')return 'Wrong password.';if(m==='bad-reply')return 'The ledger did not answer. Check the ledger login.';if(m==='offline'||!navigator.onLine)return 'Offline. Changes are saved here and will sync later.';return 'Sync failed: '+m.slice(0,160);}
async function api(method,body){
  const c=cfg();if(c?.mode==='google')return method==='GET'?LGGoogle.get():LGGoogle.post(body||{});let r,j;
  try{
    r=await fetch(method==='GET'?`${c.url}${c.url.includes('?')?'&':'?'}token=${encodeURIComponent(c.token)}`:c.url,
      method==='GET'?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({token:c.token},body))});
  }catch(e){throw new Error('offline');}
  try{j=await r.json();}catch(e){throw new Error('bad-reply');}
  if(j.error)throw new Error(j.error==='unauthorized'?'unauthorized':'bad-reply');
  return j;
}
const toRemote=r=>({id:r.id,date:r.date,type:r.type,gold:r.gold||0,eur:r.eur||0,usd:r.usd||0,name:r.name||'',goldPrice:r.goldPrice||0,updated:r.updated||1,deleted:false});
function fromRemote(x){const date=String(x.date||'').trim();
  return {id:String(x.id),date,sortTs:parseSortDate(date),yyyyMM:parseDateToYYYYMM(date),type:x.type||'Cash USD',gold:num(x.gold),eur:num(x.eur),usd:num(x.usd),name:String(x.name||'').toLowerCase(),goldPrice:num(x.goldPrice),updated:+x.updated||1};}
async function sync(o){
  o=o||{};
  if(!cfg())return;
  if(syncing){syncAgain=true;return;}
  if(!o.manual&&busy()){scheduleSync();return;}
  syncing=true;const v0=ver;
  if(!o.quiet)setSyncState('Syncing…');
  try{
    const reply=await api('GET'),remote=reply.rows||[],rmap={};srvGold(reply);const sp=shMerge(reply);
    remote.forEach(x=>{rmap[String(x.id)]=x;});
    const L=allData,T=tomb,lmap={};
    L.forEach(r=>{lmap[r.id]=r;});
    const ids=new Set([...L.map(r=>r.id),...Object.keys(T),...Object.keys(rmap)]);
    const rows=[],nt={},push=[],arrived=[],hadRows=L.length>0;
    ids.forEach(id=>{
      const l=lmap[id],lt=T[id],x=rmap[id],lu=l?(l.updated||1):(lt||0),ru=x?(+x.updated||0):-1;
      if(x&&ru>=lu){if(isTrue(x.deleted))nt[id]=ru;else{rows.push(fromRemote(x));if(!l&&!lt)arrived.push(rows[rows.length-1]);}}
      else if(l){rows.push(l);push.push(toRemote(l));}
      else if(lt){nt[id]=lt;if(x)push.push({id,deleted:true,updated:lt});}
    });
    const pp=window.lgPush?await window.lgPush(reply):null;
    if(push.length||sp||pp){
      const body={rows:push,dev:window.lgDev||''};if(sp)body.settings=sp;if(pp)body.push=pp.info;
      const ans=await api('POST',body);if(pp&&window.lgPushDone)window.lgPushDone(pp,ans);
    }
    if(ver!==v0)syncAgain=true;
    else{
      try{localStorage.removeItem(DIRTY);}catch(e){}
      const sg=a=>JSON.stringify(a.map(r=>r.id+'|'+r.updated+'|'+sig(r)).sort());
      const changed=sg(rows)!==sg(allData);
      allData=rows;tomb=nt;lastSig={};allData.forEach(r=>{lastSig[r.id]=sig(r);});persist();
      if(changed||shared.applied){shared.applied=false;renderAll();}
    }
    const n=new Date();setSyncState(`Synced ${p2(n.getHours())}:${p2(n.getMinutes())}`);status();if(window.lgAfterSync)window.lgAfterSync(ver===v0&&hadRows?arrived:[]);
  }catch(e){setSyncState(errText(e));if(o.manual)toast(errText(e));}
  finally{syncing=false;if(syncAgain){syncAgain=false;scheduleSync();}}
}
$('x-sync-connect').onclick=async()=>{
  const url=toUrl($('x-sync-url').value),token=$('x-sync-token').value.trim();
  if(!url||!token){toast('Enter your ledger login and password.');return;}
  /* check the login first, so a wrong password changes nothing on this phone */
  const previous=localStorage.getItem(SYNC);
  localStorage.setItem(SYNC,JSON.stringify({url,token}));setSyncState('Connecting…');
  let reply;
  try{reply=await api('GET');if(!Array.isArray(reply.rows))throw Error('bad-reply');}
  catch(e){previous==null?localStorage.removeItem(SYNC):localStorage.setItem(SYNC,previous);setSyncState('');status();toast(errText(e));return;}
  const target=accountId('legacy',url),prev=activeAccount();
  if(prev!==target){
    const remoteN=reply.rows.filter(x=>!isTrue(x.deleted)).length;
    let carry=false;
    if(prev===DEVICE&&!hasStash(target)){
      carry=!allData.length||!remoteN||confirm(`This ledger already has ${remoteN} entries, and this phone has ${allData.length} of its own.\n\nOK: add this phone's entries to the ledger.\nCancel: keep them aside and show only the ledger.`);
    }
    accountMove(target,carry);accountReload();
  }
  try{localStorage.setItem('lg-last-login',toLogin(url));}catch(e){}
  await sync({manual:true});
  if(shared.ok!=null)toast(`Signed in. ${allData.length} entr${allData.length===1?'y':'ies'} and your settings are loaded.`,false);
};
$('x-sync-invite').onclick=async()=>{
  const c=cfg();if(!c){toast('Sign in first.');return;}if(c.mode==='google'){toast('To share a Google ledger, use Google Drive sharing. Each collaborator needs Google access.');return;}
  const link=location.origin+location.pathname+'#join='+btoa(unescape(encodeURIComponent(JSON.stringify({u:c.url,t:c.token}))));
  try{await navigator.clipboard.writeText(link);toast('Invite copied. Send it privately: anyone with it signs in and can edit the ledger.');}
  catch(e){prompt('Copy this invite and send it privately:',link);}
};
$('x-sync-now').onclick=()=>{if(!cfg()){toast('Sign in first.');return;}sync({manual:true});};
$('x-sync-off').onclick=async()=>{
  if(!cfg()){toast('You are not signed in.');return;}
  if(isDirty()&&navigator.onLine)await sync({manual:true});
  if(isDirty()&&!confirm('Some changes have not reached the ledger yet.\n\nSign out anyway? They stay on this phone and upload when you sign in again.'))return;
  try{if(window.lgPushOff)await window.lgPushOff();}catch(e){}
  if(window.LGGoogle?.active())LGGoogle.signout();
  localStorage.removeItem('lg-google-sheet-id');
  localStorage.removeItem(SYNC);
  accountMove(DEVICE,false);accountReload();
  $('x-sync-token').value='';setSyncState('');status();
  toast('Signed out. This ledger and its settings stay saved on this phone and come back when you sign in again.',false);
};
setInterval(()=>{if(cfg()&&!document.hidden)sync({quiet:true});},45000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cfg())sync({quiet:true});});
window.addEventListener('online',()=>{if(cfg())sync({quiet:true});});

/* ---------- gold valuation: market price instead of purchase price ---------- */
const GKEY='lg-gold-v1',OZ=31.1034768;
const GOLD_REFRESH_MS=30*60*1000;   /* a quote is labelled live only when its source timestamp is within 30 minutes */
const goldPriceFresh=g=>g&&g.px>0&&g.at>0&&Date.now()-g.at<GOLD_REFRESH_MS;
const gDefault={mode:'market',karat:21,manual:'',px:0,at:0};
const gset=()=>{try{const o=Object.assign({},gDefault,JSON.parse(localStorage.getItem(GKEY)||'{}'));if(!o.kset)o.karat=21;return o;}catch(e){return Object.assign({},gDefault);}};   /* 21k until someone picks another purity */
const gsave=o=>{try{const old=gset(),next=Object.assign({},old,o);localStorage.setItem(GKEY,JSON.stringify(next));if((old.mode!==next.mode||old.karat!==next.karat||old.manual!==next.manual||old.kset!==next.kset)&&!window.lgApplyingRemoteSettings&&window.lgCfgChanged)window.lgCfgChanged();}catch(e){}};
/* Live and typed prices are turned into a 24k price per gram, then each gold entry is scaled by its own purity. */
function px24(){
  const g=gset();if(g.mode!=='market')return 0;
  const m=num(g.manual);if(m>0)return m*24/g.karat;
  // A stale cached price is not a current market quotation.
  return Number(g.px)>0?Number(g.px):0; // Last successful quote remains usable, with stale status shown separately
}
const rowKarat=r=>{const m=/(\d{2})\s*k/i.exec(r.type||'');const k=m?+m[1]:0;return(k>=8&&k<=24)?k:gset().karat;};
const baseCompute=computeAnalytics;
computeAnalytics=function(rows){
  const t=baseCompute(rows);t.goldCost=t.gold;t.goldPx=0;
  if(gset().mode==='market'&&t.goldGrams>0){
    const gm=goldMonthly(rows),nk=toYMD(Date.now()).slice(0,7),cur=gm.find(r=>r.k===nk)||gm[gm.length-1];
    if(cur&&cur.px){
      t.gold=cur.value;t.goldPx=cur.value/t.goldGrams;t.net=t.cash+t.gold-t.loan;
      const adj=goldAdj(rows,gm);t.cumulativeCost=Object.assign({},t.cumulative);t.goldGain={};
      t.keys.forEach(k=>{const a=adj(k);t.goldGain[k]=a;t.cumulative[k]+=a;});
    }
  }
  return t;
};
/* market value minus price paid for the gold held at the end of month k (0 when gold is valued at cost) */
function goldAdj(rows,gm){
  if(gset().mode!=='market')return ()=>0;
  const m={};try{(gm||goldMonthly(rows)).forEach(r=>{if(r.px)m[r.k]=r.value-r.cost;});}catch(e){}
  const ks=Object.keys(m).sort();
  if(!ks.length)return ()=>0;
  return k=>{if(k in m)return m[k];if(k<ks[0])return 0;let v=0;for(const kk of ks){if(kk<=k)v=m[kk];else break;}return v;};
}
window.lgGoldAdj=rows=>goldAdj(rows);
const baseKPIs=updateKPIs;
updateKPIs=function(t){
  baseKPIs(t);
  if(t.goldGrams>0)$('gold-sub').textContent=t.goldPx>0
    ?`${t.goldGrams.toFixed(1)} g at ${money2(t.goldPx)}/g · ${signed0(t.gold-t.goldCost)} vs cost`
    :`${t.goldGrams.toFixed(1)} g at purchase price`;
};
$('x-sync').insertAdjacentHTML('beforebegin',`<div class="section" id="x-gold"><div class="section-header"><h2>Gold today</h2><span class="hint" id="x-gold-status"></span></div>
 <div class="xg-card" id="xg-now"></div>
 <div class="xg-card" id="xg-hold" hidden></div>
 <details class="xg-set" id="xg-set"><summary>Gold settings</summary>
  <div class="kpi-sub" style="font-size:13px;margin:10px 0 0">Gold in your balance follows the market price, scaled by each entry's purity. What you saved, year-over-year and averages keep using what you paid.</div>
  <label class="x-label" for="x-gold-mode">Value gold at</label><select id="x-gold-mode" class="x-input"><option value="market">Market price</option><option value="cost">Purchase price</option></select>
  <label class="x-label" for="x-gold-karat">Default purity, for entries without one</label><select id="x-gold-karat" class="x-input"><option value="24">24k</option><option value="22">22k</option><option value="21">21k</option><option value="18">18k</option></select>
  <label class="x-label" for="x-gold-manual">Or type today's price per gram at the default purity, in USD (optional)</label><input id="x-gold-manual" class="x-input" inputmode="decimal" autocomplete="off" placeholder="Leave empty to use the live price">
  <div class="x-btns"><button type="button" id="x-gold-refresh">Refresh price</button></div>
 </details></div>`);
const GV={k:0,range:'1y',series:'price'};
const KS=[24,22,21,18];
const chg=(l,v)=>v==null?'':`<span class="xg-chip ${v>=0?'up':'dn'}"><i>${l}</i>${v>=0?'▲':'▼'} ${Math.abs(v*100).toFixed(1)}%</span>`;
function goldStatus(extra){
  const g=gset();let t;
  try{
    const p=px24(),k=GV.k||g.karat,d=new Date(g.at||Date.now()),manual=num(g.manual)>0;
    let last=null;try{const gm=goldMonthly(allData).filter(r=>r.px);last=gm[gm.length-1]||null;}catch(e){}
    /* without gold entries the changes still come from the price history */
    const nk=toYMD(Date.now()).slice(0,7),pm=monthPx(addMonths(nk,-1)),py=monthPx(addMonths(nk,-12)),pd=monthPx(`${+nk.slice(0,4)-1}-12`);
    const mom=last&&last.mom!=null?last.mom:(p&&pm?p/pm-1:null),yoy=last&&last.yoy!=null?last.yoy:(p&&py?p/py-1:null),ytdv=last&&last.ytd!=null?last.ytd:(p&&pd?p/pd-1:null);
    const src=manual?'your typed price':(goldPriceFresh(g)?(g.via==='ledger'?'ledger quote · '+(g.source||'market'):'live · '+(g.source||'Gold-API.com')):`cached · ${g.source||'last known market quote'} · ${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}`);
    $('xg-now').innerHTML=p>0
      ?`<div class="xg-top"><div><div class="xg-l">Price per gram, ${k}k</div><div class="xg-v">${money2(p*k/24)}</div></div><button type="button" class="xg-ref" id="xg-ref" aria-label="Refresh price">↻</button></div>
        <div class="xg-ks">${KS.map(x=>`<button type="button" data-k="${x}" class="${x===k?'active':''}">${x}k${x===g.karat?'<b>·</b>':''}</button>`).join('')}</div>
        <div class="xg-chs">${chg('vs last month',mom)}${chg('vs last year',yoy)}${chg('this year',ytdv)}</div>
        <div class="xg-s">${money0(p*OZ)} per ounce (24k) · ${src}${manual?'':` · updated ${p2(d.getHours())}:${p2(d.getMinutes())}`}</div>`
      :`<div class="xg-l">Gold price</div><div class="xg-s" style="margin-top:6px">${g.mode==='market'?'No live price yet. Open Gold settings below and tap Refresh price, or type a price.':'Gold is valued at what you paid. Change this in Gold settings below.'}</div>`;
    const rows=allData.filter(isGoldRow),hold=$('xg-hold');
    if(!rows.length)hold.hidden=true;
    else{
      let grams=0,paid=0,now=0;const byK={};
      rows.forEach(r=>{const kk=kOf(r)||g.karat;grams+=r.gold;paid+=r.gold*(r.goldPrice||0);now+=goldNow(r);byK[kk]=(byK[kk]||0)+r.gold;});
      const hasMarket=pxNow()>0;const gain=hasMarket?now-paid:null,net=computeAnalytics(allData).net;
      hold.hidden=false;
      hold.innerHTML=`<div class="xg-h">Your gold <span class="x-src mix">Ours × market</span></div>
        <div class="xg-grid"><div><span>Holding</span><b>${grams.toFixed(1)} g</b><em>${Object.keys(byK).sort((a,b)=>b-a).map(x=>`${byK[x].toFixed(1)} g of ${x}k`).join(', ')}</em></div>
        <div><span>Worth now</span><b>${money0(now)}</b><em>${net>0?Math.round(now/net*100)+'% of net worth':''}</em></div>
        <div><span>Paid</span><b>${money0(paid)}</b><em>${rows.length} purchase${rows.length>1?'s':''}</em></div>
        <div><span>Gain</span><b class="${gain!=null&&gain>=0?'pos':'neg'}">${gain==null?'—':signed0(gain)}</b><em>${gain!=null&&paid?(gain>=0?'+':'−')+Math.abs(gain/paid*100).toFixed(1)+'% on what you paid':(hasMarket?'':'no price yet, shown at what you paid')}</em></div></div>`;
    }
  }catch(e){console.error(e);}
  if(g.mode!=='market')t='valued at what you paid';
  else if(num(g.manual)>0)t='your typed price';
  else if(goldPriceFresh(g))t=g.via==='ledger'?'latest ledger quote':'live · '+(g.source||'Gold-API.com');
  else if(g.px>0)t='last known price';
  else t='no price yet';
  $('x-gold-status').textContent=t+(extra?' · '+extra:'');
}
$('x-gold').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.k){GV.k=+b.dataset.k;goldStatus();try{renderGoldChart();}catch(x){}}
  else if(b.id==='xg-ref')$('x-gold-refresh').click();
});
let goldFetchPending=null;
async function fetchGold(force=false){
  const g0=gset();
  if(!force&&g0.px>0&&g0.via==='live'&&goldPriceFresh(g0)&&Date.now()-(g0.checkedAt||0)<5*60*1000)return true;
  if(goldFetchPending)return goldFetchPending;
  goldFetchPending=(async()=>{
    try{
      const r=await fetch('https://api.gold-api.com/price/XAU',{cache:'no-store'});
      if(!r.ok)throw new Error('Gold-API HTTP '+r.status);
      const j=await r.json(),oz=Number(j.price),at=Date.parse(j.updatedAt||'');
      if(!Number.isFinite(oz)||oz<=500||oz>=20000||j.symbol!=='XAU'||j.currency!=='USD')throw new Error('invalid gold spot quote');
      if(!Number.isFinite(at)||at>Date.now()+5*60000||at<Date.now()-7*86400000)throw new Error('gold quote has invalid timestamp');
      /* An older response must never replace a newer price saved on this device. */
      if(at>=Number(gset().at||0))gsave({px:oz/OZ,at,checkedAt:Date.now(),via:'live',source:'Gold-API.com'});
      const k=toYMD(at).slice(0,7),h=hget(),sn={...(h.snap||{})};sn[k]={px:oz/OZ,at,source:'Gold-API.com'};hsave({snap:sn});
      return goldPriceFresh(gset());
    }catch(e){
      /* A second, independent spot feed before using cached prices. The dealer's
         bid/ask midpoint is indicative, not an executable spot transaction. */
      try{
        const r=await fetch('https://standardbullion.com/spot-prices.json',{cache:'no-store'});
        if(!r.ok)throw Error('Fallback quote HTTP '+r.status);
        const j=await r.json(),x=(j.metals||[]).find(m=>m.symbol==='XAU');
        const bid=Number(x&&x.bid),ask=Number(x&&x.ask),at=Date.parse(j.updated||'');
        if(!(bid>500&&ask>=bid&&ask<20000&&Number.isFinite(at)&&at<=Date.now()+300000&&at>=Date.now()-7*86400000))throw Error('Invalid secondary quote');
        if(at>=Number(gset().at||0))gsave({px:(bid+ask)/2/OZ,at,checkedAt:Date.now(),via:'fallback',source:'Standard Bullion bid/ask midpoint'});
        return goldPriceFresh(gset());
      }catch(err){}
      /* A second device or Apps Script may already have saved a later quote. */
      const sv=hget().srv,previous=gset();
      if(sv&&sv.px>0&&sv.at>Number(previous.at||0)){
        gsave({px:sv.px,at:sv.at,checkedAt:Date.now(),via:'ledger',source:sv.source||'ledger cached quote'});
      }
      return goldPriceFresh(gset());
    }
  })();
  try{return await goldFetchPending;}finally{goldFetchPending=null;}
}
async function refreshGold(){
  if(gset().mode!=='market'||num(gset().manual)>0){goldStatus();return;}
  const ok=await fetchGold();
  goldStatus(ok?'':'live price unavailable');
  if(!busy())renderAll();
}
const stg=document.createElement('style');stg.textContent=`
.xg-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:10px}
.xg-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.xg-l{font-size:12px;font-weight:600;color:var(--muted)}
.xg-v{font:700 38px/1.1 "IBM Plex Sans",sans-serif;letter-spacing:-.8px;margin-top:2px;font-variant-numeric:tabular-nums}
.xg-ref{flex:0 0 40px;height:40px;border-radius:12px;border:1px solid var(--line);background:var(--card);font-size:19px;color:var(--ink);cursor:pointer}
.xg-ks{display:flex;gap:6px;margin:12px 0 10px}
.xg-ks button{flex:1;padding:8px 0;border-radius:10px;border:1px solid var(--line);background:var(--card);font:600 13px "IBM Plex Sans",sans-serif;color:var(--ink);cursor:pointer}
.xg-ks button.active{background:var(--ink);color:#fff;border-color:var(--ink)}.xg-ks button b{color:var(--gold);margin-left:2px}
.xg-chs{display:flex;flex-wrap:wrap;gap:6px}
.xg-chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 10px;font-size:12.5px;font-weight:700}
.xg-chip i{font-style:normal;font-weight:500;color:var(--ink-2)}
.xg-chip.up{background:#E4F1EA;color:var(--pos)}.xg-chip.dn{background:#F7E7E5;color:var(--debt)}
.xg-s{font-size:12px;color:var(--muted);margin-top:10px}
.xg-h{font:600 17px "Newsreader",serif;margin-bottom:10px}
.xg-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 14px}
.xg-grid span{display:block;font-size:11px;font-weight:600;color:var(--muted)}
.xg-grid b{display:block;font:700 19px "IBM Plex Sans",sans-serif;font-variant-numeric:tabular-nums;margin-top:1px}
.xg-grid em{display:block;font-style:normal;font-size:11.5px;color:var(--muted);margin-top:1px}
.xg-grid em.pos{color:var(--pos)}.xg-grid em.neg{color:var(--debt)}
.xg-set{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.xg-set summary{cursor:pointer;font-weight:600;font-size:14px}
.xg-rg{display:flex;gap:6px;margin-bottom:8px}
.xg-rg button{padding:5px 12px;border-radius:999px;border:1px solid var(--line);background:var(--card);font:600 12px "IBM Plex Sans",sans-serif;color:var(--ink);cursor:pointer}
.xg-rg button.active{background:var(--ink);color:#fff;border-color:var(--ink)}`;document.head.appendChild(stg);
const gm=gset();$('x-gold-mode').value=gm.mode;$('x-gold-karat').value=String(gm.karat);$('x-gold-manual').value=gm.manual;
$('x-gold-mode').onchange=e=>{gsave({mode:e.target.value});goldStatus();renderAll();if(e.target.value==='market')refreshGold();};
$('x-gold-karat').onchange=e=>{gsave({karat:+e.target.value,kset:true});goldStatus();renderAll();};
$('x-gold-manual').onchange=e=>{gsave({manual:e.target.value.trim()});goldStatus();renderAll();if(!e.target.value.trim())refreshGold();};
$('x-gold-refresh').onclick=async()=>{const ok=await fetchGold(true);goldStatus(ok?'':'live price unavailable');renderAll();toast(ok?'Gold price refreshed':(gset().px>0?'Could not reach the price service. Showing the last price received.':'Could not reach the price service. Type a price in Gold settings.'));};
setInterval(()=>{if(!document.hidden)refreshGold();},15*60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshGold();});

/* ---------- gold price history: monthly price, your gold value, and what moved it ---------- */
const HKEY='lg-goldhist-v1';
let _hs=null,_ho={};
const hget=()=>{let s='{}';try{s=localStorage.getItem(HKEY)||'{}';}catch(e){}if(s!==_hs){_hs=s;try{_ho=JSON.parse(s)||{};}catch(e){_ho={};}}return _ho;};
const hsave=o=>{try{localStorage.setItem(HKEY,JSON.stringify(Object.assign({},hget(),o)));}catch(e){}};
/* Daily closes, grouped by UTC calendar month. The most recent dated observation in each
   completed month is its reference close. Do not manufacture a close from purchase prices. */
function standardBullionMonthly(j,now=Date.now()){
  if(!j||j.metal!=='XAU'||!Array.isArray(j.points))throw Error('Unexpected historical price format');
  const current=toYMD(now).slice(0,7),m={},meta={};
  j.points.forEach(x=>{
    const t=String(x.t||''),at=Date.parse(t),p=Number(x.price),k=t.slice(0,7);
    if(!/^\d{4}-\d{2}-\d{2}T/.test(t)||!Number.isFinite(at)||at>now||!Number.isFinite(p)||p<=500||p>=20000||k>=current||k<'2011-01')return;
    if(!meta[k]||at>meta[k].at){m[k]=p/OZ;meta[k]={at,date:t.slice(0,10),source:'Standard Bullion',method:'month-end-close'};}
  });
  return {m,meta};
}
async function fetchGoldHistory(force){
  const h=hget();
  if(!force&&h.provider==='standardbullion-month-end'&&h.at&&Date.now()-h.at<12*3600*1000)return false;
  try{
    const resp=await fetch('https://standardbullion.com/api/v1/market/history?metal=XAU&range=5y',{cache:'no-store'});
    if(!resp.ok)throw Error('Historical gold HTTP '+resp.status);
    const parsed=standardBullionMonthly(await resp.json());
    if(!Object.keys(parsed.m).length)throw Error('No historical gold closes');
    const merged=mergeGoldMonths(h,parsed);
    hsave({at:Date.now(),provider:'standardbullion-month-end',m:merged.m,meta:merged.meta});
    if(cfg())scheduleSync();
    return true;
  }catch(e){console.warn('Historical gold refresh failed; keeping previously saved observations',e);return false;}
}
function goldRank(meta){return meta&&meta.method==='month-end-close'?3:meta&&meta.method==='dated-spot'?2:1;}
function mergeGoldMonths(local,incoming){
  const m={...(local.m||{})},meta={...(local.meta||{})};
  Object.keys(incoming.m||{}).forEach(k=>{
    const p=Number(incoming.m[k]),next=incoming.meta&&incoming.meta[k],old=meta[k];
    if(!/^\d{4}-\d{2}$/.test(k)||!Number.isFinite(p)||p<=10||p>=1000)return;
    if(!(k in m)||goldRank(next)>goldRank(old)||(goldRank(next)===goldRank(old)&&Number(next&&next.at||0)>Number(old&&old.at||0))){m[k]=p;if(next)meta[k]=next;}
  });
  return {m,meta};
}
/* A month's price, per gram of 24k.
   Known, in this order: a price you typed for the month, the market's monthly average (loaded by this phone,
   by another phone, or by the ledger), and for the current month the latest price received.
   A month with none of these is ESTIMATED and always marked as such: spread evenly between the nearest known
   months, with what you paid for gold in a month used as a reference point when the market price is missing. */
function observedMonthPx(k){
  const h=hget(),nowK=toYMD(Date.now()).slice(0,7);
  const typed=Number(h.man&&h.man[k]);if(Number.isFinite(typed)&&typed>0)return {px:typed,src:'manual'};
  const cm=Number(h.m&&h.m[k]),sm=Number(h.srv&&h.srv.months&&h.srv.months[k]);
  const cMeta=h.meta&&h.meta[k],sMeta=h.srv&&h.srv.meta&&h.srv.meta[k];
  /* A verified month-end close wins over an old cached monthly average. */
  const cOK=Number.isFinite(cm)&&cm>0,sOK=Number.isFinite(sm)&&sm>0;
  if(sOK&&(!cOK||goldRank(sMeta)>goldRank(cMeta)))return {px:sm,src:'market',meta:sMeta};
  if(cOK)return {px:cm,src:goldRank(cMeta)>=3?'market':'legacy',meta:cMeta};
  if(sOK)return {px:sm,src:goldRank(sMeta)>=3?'market':'legacy',meta:sMeta};
  const ss=h.snap&&h.snap[k],sp=Number(ss&&typeof ss==='object'?ss.px:ss);
  if(sp>0&&k<=nowK)return {px:sp,src:'snapshot'};
  return null;
}
function monthPx(k){const q=observedMonthPx(k);return q?q.px:0;}
const isEstSrc=s=>s==='carried'||s==='snapshot'||s==='legacy'||s==='cost'||s==='cached'||s==='manual';
function quoteSeries(from,to,rows){
  const nowK=toYMD(Date.now()).slice(0,7),g=gset(),out=[];
  let previous=null;
  for(let k=from;k<=to;k=addMonths(k,1)){
    let q=observedMonthPx(k);
    if(k===nowK&&!(q&&q.src==='manual')){
      const lv=px24();if(lv>0)q={px:lv,src:num(g.manual)>0?'manual':(goldPriceFresh(g)?'live':'cached')};
    }
    if(q&&q.px>0){previous=q;out.push({k,px:q.px,src:q.src,asOf:q.meta&&q.meta.date||'',known:!isEstSrc(q.src)});}
    else if(previous){out.push({k,px:previous.px,src:'carried',asOf:previous.meta&&previous.meta.date||'',known:false});}
    else{out.push({k,px:0,src:'cost',known:false});}
  }
  return out;
}
/* the price used for "worth now": today's price, or the best figure for the current month when none was received */
function pxNow(){
  if(gset().mode!=='market')return 0;
  const p=px24();if(p>0)return p;
  const nk=toYMD(Date.now()).slice(0,7),h=hget(),ks=[...Object.keys(h.man||{}),...Object.keys(h.m||{}),...Object.keys((h.srv&&h.srv.months)||{}),...Object.keys(h.snap||{})].filter(k=>/^\d{4}-\d{2}$/.test(k)&&k<=nk).sort();
  return ks.length?monthPx(ks[ks.length-1]):0;
}
/* One row per month from the first gold purchase: price, value of the gold held, and what moved it. */
let _gmKey='',_gmVal=null;
function goldMonthly(rows){
  const g=rows.filter(r=>!(r.name||'').includes('loan')&&(r.gold||0)>0&&r.yyyyMM);
  if(!g.length)return [];
  const gs=gset(),key=dataRev+'|'+rows.length+'|'+g.length+'|'+_hs+'|'+gs.px+'|'+gs.at+'|'+gs.manual+'|'+gs.karat+'|'+gs.mode+'|'+toYMD(Date.now());
  if(rows===allData&&key===_gmKey&&_gmVal)return _gmVal;
  const first=g.map(r=>r.yyyyMM).sort()[0],nowK=toYMD(Date.now()).slice(0,7);
  const lastRow=g.map(r=>r.yyyyMM).sort().pop(),end=nowK>lastRow?nowK:lastRow;
  let base=quoteSeries(first,end,g);const out=[];let unitsPrev=0;
  if(!base.some(b=>b.px>0))base=base.map(b=>({k:b.k,px:0,src:'cost'}));   /* no price from anywhere: keep gold at what was paid, and say so */
  base.forEach(({k,px,src,asOf},i)=>{
    let units=0,cost=0,grams=0,newUnits=0,newCost=0;
    g.forEach(r=>{if(r.yyyyMM<=k){const u=r.gold*rowKarat(r)/24;units+=u;grams+=r.gold;cost+=r.gold*(r.goldPrice||0);if(r.yyyyMM===k){newUnits+=u;newCost+=r.gold*(r.goldPrice||0);}}});
    const prior=i?base[i-1].px:0,ly=monthPx(addMonths(k,-12)),dec=monthPx(`${+k.slice(0,4)-1}-12`);
    out.push({k,px:px||null,src:px?src:'cost',asOf:asOf||'',est:!px||isEstSrc(src),grams,cost,units,value:px?units*px:cost,
      mom:(px&&prior)?px/prior-1:null,yoy:(px&&ly)?px/ly-1:null,ytd:(px&&dec)?px/dec-1:null,
      priceEffect:px?(i&&prior?unitsPrev*(px-prior):0):null,bought:px?newUnits*px:null,newCost});
    unitsPrev=units;
  });
  if(rows===allData){_gmKey=key;_gmVal=out;}
  return out;
}
window.lgGoldMonthly=goldMonthly;window.lgGset=gset;
document.getElementById('variance-section').insertAdjacentHTML('beforebegin',`<div class="section" id="x-goldhist">
 <div class="section-header"><h2>Gold over time</h2><div class="xp-seg" id="xg-series"><button type="button" data-s="price">Price</button><button type="button" data-s="mine">Your gold</button></div></div>
 <div class="chart-card"><div class="xg-rg" id="xg-range"><button type="button" data-r="6m">6M</button><button type="button" data-r="1y">1Y</button><button type="button" data-r="2y">2Y</button><button type="button" data-r="all">All</button></div>
  <div class="desc" id="x-goldhist-desc"></div><div class="chart-wrap tall"><canvas id="goldhist"></canvas></div></div>
 <h3 class="x-h3">Month by month</h3>
 <div class="table-container"><table id="x-gold-table" style="min-width:680px"><thead><tr><th>Month</th><th class="r">Price / g</th><th class="r">vs last month</th><th class="r">vs last year</th><th class="r">Year to date</th><th class="r">Your gold</th><th class="r">Price effect</th><th class="r">Bought</th></tr></thead><tbody></tbody></table></div>
 <p class="x-note" id="x-goldhist-note"></p>
 <h3 class="x-h3" id="x-lots-h">Your purchases</h3>
 <div class="table-container" id="x-lots-box"><table id="x-lots-table" style="min-width:680px"><thead><tr><th>Date</th><th>Who</th><th class="r">Grams</th><th class="r">Purity</th><th class="r">Paid / g</th><th class="r">Paid</th><th class="r">Worth now</th><th class="r">Gain</th></tr></thead><tbody></tbody></table></div>
 <p class="x-note" id="x-lots-note">Tap a purchase to edit it. Tap a month to type its real price.</p>
 <div class="x-btns"><button type="button" id="x-gh-retry">Reload price history</button></div></div>`);
const pcell=v=>v==null?'<td class="num" data-v="">—</td>':`<td class="num ${v>=0?'pos':'neg'}" data-v="${v}">${v>=0?'▲':'▼'} ${Math.abs(v*100).toFixed(1)}%</td>`;
/* price per month, also for the months before the first purchase, as far back as the history goes */
function priceSeries(){
  const h=hget(),nk=toYMD(Date.now()).slice(0,7);
  const known=[...Object.keys(h.m||{}),...Object.keys((h.srv&&h.srv.months)||{}),...Object.keys(h.man||{}),...Object.keys(h.snap||{}),...allData.filter(d=>isGoldRow(d)&&d.yyyyMM).map(d=>d.yyyyMM)].filter(k=>/^\d{4}-\d{2}$/.test(k)&&k<=nk).sort();
  if(px24()>0)known.push(nk);
  if(!known.length)return [];
  return quoteSeries(known.sort()[0],nk,allData).filter(r=>r.px>0);
}
const rangeN=()=>({'6m':6,'1y':12,'2y':24,'all':999}[GV.range]||12);
function renderGoldChart(){
  const sec=$('x-goldhist'),all=goldMonthly(allData),ps=priceSeries(),k=GV.k||gset().karat,n=rangeN();
  sec.hidden=false;
  $('xg-range').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.r===GV.range));
  $('xg-series').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.s===GV.series));
  $('xg-series').hidden=!all.length;
  const mine=GV.series==='mine'&&all.some(r=>r.px);
  const tag=r=>r.src==='live'||r.src==='cached'?' · today':(isEstSrc(r.src)?' *':'');
  const lab=r=>`${fmtMonthShort(r.k)} ’${r.k.slice(2,4)}${tag(r)}`;
  if(charts.goldhist){charts.goldhist.destroy();charts.goldhist=null;}
  const base={responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
    plugins:{datalabels:{display:false},legend:{position:'bottom',labels:{boxWidth:14,boxHeight:2,padding:12,font:{size:11}}}}};
  if(mine){
    const v=all.slice(-n);
    charts.goldhist=new Chart($('goldhist'),{type:'bar',data:{labels:v.map(lab),datasets:[
      {type:'line',label:'Worth (market / labelled fallback)',data:v.map(r=>r.value),borderColor:C.cash,tension:0.3,borderWidth:2.4,pointRadius:2.5,yAxisID:'y'},
      {type:'line',label:'What you paid',data:v.map(r=>r.cost),borderColor:'#9AA6B1',borderDash:[5,4],stepped:true,borderWidth:1.8,pointRadius:0,yAxisID:'y'},
      {label:'Price effect',data:v.map(r=>r.priceEffect||0),backgroundColor:v.map(r=>(r.priceEffect||0)>=0?'rgba(46,125,91,.5)':'rgba(176,67,58,.55)'),yAxisID:'y1'}]},
      options:Object.assign({},base,{scales:{y:{position:'left',ticks:{callback:x=>'$'+Number(x).toLocaleString()},grid:{color:'#F0F2F5'}},y1:{position:'right',ticks:{callback:x=>'$'+Number(x).toLocaleString()},grid:{display:false}},x:{grid:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:7}}},
        plugins:Object.assign({},base.plugins,{tooltip:{callbacks:{title:i=>fmtMonthFull(v[i[0].dataIndex].k),label:c=>` ${c.dataset.label}: ${c.raw==null?'—':(c.datasetIndex===2?signed0(c.raw):money0(c.raw))}`}}})})});
    const l=v[v.length-1],f=v[0],pe=v.reduce((s,r)=>s+(r.priceEffect||0),0);
    $('x-goldhist-desc').textContent=`Worth ${money0(l.value)} against ${money0(l.cost)} paid. Since ${lab(f).replace(' *','')} the price added ${signed0(pe)} to what you hold.${v.some(r=>r.est)?' Months marked * use an estimated price.':''}`;
  }else if(ps.length){
    const v=ps.slice(-n);
    charts.goldhist=new Chart($('goldhist'),{type:'line',data:{labels:v.map(lab),datasets:[
      {label:`${k}k per gram`,data:v.map(r=>r.px*k/24),borderColor:C.gold,backgroundColor:'rgba(185,137,47,0.12)',fill:true,tension:0.3,borderWidth:2.4,pointRadius:v.length>18?0:2.5,segment:{borderDash:c=>(v[c.p0DataIndex]&&isEstSrc(v[c.p0DataIndex].src))||(v[c.p1DataIndex]&&isEstSrc(v[c.p1DataIndex].src))?[5,4]:undefined}},
      ...(all.length?[{label:'Your purchases',data:v.map(r=>{const b=allData.filter(d=>isGoldRow(d)&&d.yyyyMM===r.k&&d.goldPrice>0);return b.length?b.reduce((s,d)=>s+d.goldPrice*k/(kOf(d)||gset().karat),0)/b.length:null;}),borderColor:C.ink,backgroundColor:C.ink,pointRadius:5,pointStyle:'rectRot',showLine:false}]:[])]},
      options:Object.assign({},base,{scales:{y:{ticks:{callback:x=>'$'+Math.round(x)},grid:{color:'#F0F2F5'}},x:{grid:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:7}}},
        plugins:Object.assign({},base.plugins,{tooltip:{callbacks:{title:i=>fmtMonthFull(v[i[0].dataIndex].k),label:c=>` ${c.dataset.label}: ${c.raw==null?'—':money2(c.raw)}${c.datasetIndex===0&&v[c.dataIndex].asOf?' · observed '+v[c.dataIndex].asOf:''}${c.datasetIndex===0&&isEstSrc(v[c.dataIndex].src)?' · fallback/estimate':''}`}}})})});
    const l=v[v.length-1],f=v[0],hi=v.reduce((a,r)=>r.px>a.px?r:a,v[0]),lo=v.reduce((a,r)=>r.px<a.px?r:a,v[0]);
    $('x-goldhist-desc').textContent=`${k}k gold went from ${money2(f.px*k/24)} to ${money2(l.px*k/24)} per gram since ${lab(f).replace(' *','')} (${l.px>=f.px?'+':'−'}${Math.abs((l.px/f.px-1)*100).toFixed(1)}%). High ${money2(hi.px*k/24)} in ${lab(hi).replace(/\*| · today/g,'')}, low ${money2(lo.px*k/24)} in ${lab(lo).replace(/\*| · today/g,'')}.${all.length?' Diamonds mark what you paid.':''}`;
  }else $('x-goldhist-desc').textContent='No price history yet. It loads by itself when the app can reach the price services.';
  /* month by month: your holding months, or the price alone before you hold any */
  const rowsT=(all.length?all:ps.map((r,i)=>({k:r.k,px:r.px,src:r.src,mom:i?r.px/ps[i-1].px-1:null,yoy:monthPx(addMonths(r.k,-12))?r.px/monthPx(addMonths(r.k,-12))-1:null,ytd:monthPx(`${+r.k.slice(0,4)-1}-12`)?r.px/monthPx(`${+r.k.slice(0,4)-1}-12`)-1:null,value:null,priceEffect:null,bought:null}))).slice(-n);
  $('x-gold-table').querySelector('tbody').innerHTML=[...rowsT].reverse().map(r=>`<tr data-k="${r.k}" class="x-tap"><td data-v="${r.k.replace('-','')}"><strong>${lab(r)}</strong></td>
    <td class="num" data-v="${r.px*k/24}">${r.px?money2(r.px*k/24):'—'}</td>${pcell(r.mom)}${pcell(r.yoy)}${pcell(r.ytd)}
    <td class="num" data-v="${r.value==null?'':r.value}">${r.value==null?'—':money0(r.value)}</td>
    <td class="num ${r.priceEffect==null?'':(r.priceEffect>=0?'pos':'neg')}" data-v="${r.priceEffect==null?'':r.priceEffect}">${r.priceEffect==null?'—':signed0(r.priceEffect)}</td>
    <td class="num" data-v="${r.bought||0}">${r.bought?signed0(r.bought):'—'}</td></tr>`).join('');
  const h=hget(),nm=Math.max(h.m?Object.keys(h.m).length:0,h.srv&&h.srv.months?Object.keys(h.srv.months).length:0),est=rowsT.filter(r=>r.est||isEstSrc(r.src)||!r.px).length;
  $('x-goldhist-note').innerHTML=`Prices are per gram of ${k}k. `+(nm?`Historical months use the last available dated market close in each month, when verified (${nm} months cached); the current month uses the latest spot quote. `:'Historical prices have not been retrieved; previously recorded observations are preserved. ')
    +(est?`${est} month${est>1?'s are':' is'} marked *: a carried-forward quote, legacy monthly average, user-entered price, stale spot quote or snapshot, not a verified month-end close. Never a purchase-price estimate. `:'')+`Price effect reflects changes in gold already held; Bought is gold added that month. <a href="https://standardbullion.com/market-data" target="_blank" rel="noopener noreferrer">Historical data: Standard Bullion</a> · <a href="https://gold-api.com/" target="_blank" rel="noopener noreferrer">Live: Gold-API.com</a>.`; 
  /* purchases */
  const lots=allData.filter(isGoldRow).sort((a,b)=>b.sortTs-a.sortTs);
  $('x-lots-h').hidden=$('x-lots-box').hidden=!lots.length;
  $('x-lots-note').textContent=lots.length?'Tap a purchase to edit its original buying price or total amount paid. Tap a month above to type its real price. A * on purity means the entry has none, so the default is used.':'Tap a month to type its real price.';
  $('x-lots-table').querySelector('tbody').innerHTML=lots.map(d=>{const p=(d.gold||0)*(d.goldPrice||0),w=goldNow(d),kk=kOf(d)||gset().karat,gn=p?w/p-1:null;
    return `<tr class="x-tap" data-id="${esc(d.id)}"><td data-v="${d.sortTs}"><strong>${esc((d.date||'').split(' ')[0])}</strong></td><td style="text-transform:capitalize">${esc(ownerKey(d.name))}</td>
     <td class="num" data-v="${d.gold}">${d.gold.toFixed(2)} g</td><td class="num" data-v="${kk}">${kk}k${kOf(d)?'':' *'}</td><td class="num" data-v="${d.goldPrice||0}">${d.goldPrice?money2(d.goldPrice):'—'}</td>
     <td class="num" data-v="${p}">${money0(p)}</td><td class="num" data-v="${w}">${money0(w)}</td>${pcell(gn)}</tr>`;}).join('');
}
$('xg-range').addEventListener('click',e=>{const b=e.target.closest('button[data-r]');if(b){GV.range=b.dataset.r;renderGoldChart();if(window.lgApplySort)window.lgApplySort('x-gold-table');}});
$('xg-series').addEventListener('click',e=>{const b=e.target.closest('button[data-s]');if(b){GV.series=b.dataset.s;renderGoldChart();}});
$('x-lots-table').addEventListener('click',e=>{const tr=e.target.closest('tbody tr');if(!tr)return;const row=allData.find(r=>r.id===tr.dataset.id);if(row)openSheet(row);});
$('x-gold-table').addEventListener('click',e=>{
  const tr=e.target.closest('tbody tr');if(!tr||!tr.dataset.k)return;
  const cur=(hget().man||{})[tr.dataset.k];
  const v=prompt(`24k gold price per gram in USD for ${fmtMonthFull(tr.dataset.k)}.\nLeave empty to remove your price.`,cur?String(Math.round(cur*100)/100):'');
  if(v===null)return;
  const man=Object.assign({},hget().man||{}),n=num(v);
  if(n>20&&n<1000)man[tr.dataset.k]=n;else if(String(v).trim()==='')delete man[tr.dataset.k];else{toast('That price does not look right. Use USD per gram of 24k gold.');return;}
  hsave({man});window.lgCfgChanged();renderAll();
});
$('x-gh-retry').onclick=()=>{fetchGoldHistory(true).then(ok=>{toast(ok?'Price history loaded':'Could not load price history. Try again later.',false);renderAll();});};
const prevRA=renderAll;
renderAll=function(){prevRA();try{goldStatus();renderGoldChart();}catch(e){console.error(e);}};
setInterval(()=>{if(!document.hidden)fetchGoldHistory().then(ok=>{if(ok&&!busy())renderAll();});},3600*1000);

/* ---------- settings shared between phones through the ledger ----------
   Each shared setting carries its own "last changed" time; the newest one wins on every phone. */
const SHU='lg-shu-v1',SHS='lg-shs-v1';
const SH={
  people:{get:()=>(CFG.people&&CFG.people.length?CFG.people:null),set:v=>{CFG.people=Array.isArray(v)?v:[];}},
  title:{get:()=>CFG.title||null,set:v=>{CFG.title=v||'';}},
  goal:{get:()=>(CFG.goal>0?+CFG.goal:null),set:v=>{CFG.goal=+v||0;}},
  startSaving:{get:()=>(CFG.startSaving==null||CFG.startSaving===''?null:+CFG.startSaving),set:v=>{CFG.startSaving=v;}},
  goldKarat:{get:()=>(gset().kset?gset().karat:null),set:v=>{gsave({karat:+v,kset:true});}},
  goldMode:{get:()=>gset().mode,set:v=>{gsave({mode:v==='cost'?'cost':'market'});}},
  goldManual:{get:()=>gset().manual||null,set:v=>{gsave({manual:v||''});}},
  goldMan:{get:()=>{const m=hget().man;return m&&Object.keys(m).length?m:null;},set:v=>{hsave({man:v||{}});}},
  /* closed months of market history: a phone that could load it shares it with the phones that could not */
  goldHistory:{get:()=>{const h=hget(),m=h.m||{},meta=h.meta||{},nk=toYMD(Date.now()).slice(0,7),o={},om={};
    Object.keys(m).sort().forEach(k=>{if(k<nk&&m[k]>0){o[k]=Math.round(m[k]*10000)/10000;if(meta[k])om[k]=meta[k];}});
    return Object.keys(o).length?{m:o,meta:om}:null;},
    set:v=>{if(v&&typeof v==='object'&&v.m){const h=hget(),merged=mergeGoldMonths(h,v);hsave({m:merged.m,meta:merged.meta});}}},
};
const jget=k=>{try{return JSON.parse(localStorage.getItem(k)||'{}')||{};}catch(e){return {};}};
const jset=(k,o)=>{try{localStorage.setItem(k,JSON.stringify(o));}catch(e){}};
/* notice which shared settings changed on this phone since last time, and stamp them */
function shStamp(){
  const u=jget(SHU),s=jget(SHS),now=Date.now();let ch=false;
  Object.keys(SH).forEach(k=>{const v=SH[k].get(),j=v==null?'':JSON.stringify(v);if((s[k]||'')!==j){s[k]=j;u[k]=now;ch=true;}});
  if(ch){jset(SHU,u);jset(SHS,s);}
  return ch;
}
/* take newer settings from the ledger, and return the ones this phone should send back */
function shMerge(reply){
  if(!reply||typeof reply.settings!=='object'||!reply.settings){shared.ok=false;shared.api=0;return null;}
  shared.ok=true;shared.api=+reply.api||1;shared.backupAt=+reply.backupAt||0;
  const R=reply.settings;let first=false;
  try{first=localStorage.getItem(SHU)==null;}catch(e){}
  if(!first)shStamp();                       /* catch every change made on this phone since the last sync */
  const u=jget(SHU),s=jget(SHS),out={},now=Date.now();let applied=false;
  const take=(k,r,ru)=>{
    try{window.lgApplyingRemoteSettings=true;SH[k].set(r.v===''||r.v==null?null:JSON.parse(r.v));
      const v=SH[k].get();s[k]=v==null?'':JSON.stringify(v);u[k]=ru;applied=true;
      if(k==='goldHistory'&&v!=null&&r.v&&s[k]!==r.v){u[k]=Math.max(Date.now(),ru+1);out[k]={v:s[k],u:u[k]};}}
    catch(e){console.warn('Setting not applied:',k,e);}
    finally{window.lgApplyingRemoteSettings=false;}
  };
  Object.keys(SH).forEach(k=>{
    const r=R[k],ru=r?(+r.u||0):0;
    if(first){
      /* first time this phone meets this ledger: what the ledger holds wins, the phone only fills the gaps */
      if(r&&ru>0)take(k,r,ru);
      else{const v=SH[k].get(),j=v==null?'':JSON.stringify(v);s[k]=j;u[k]=j===''?0:now;if(j!=='')out[k]={v:j,u:now};}
      return;
    }
    const lu=+u[k]||0;
    if(r&&ru>lu)take(k,r,ru);
    else if(lu>ru&&(s[k]||'')!=='')out[k]={v:s[k],u:lu};
    else if(lu>ru&&r)out[k]={v:'',u:lu};
  });
  jset(SHU,u);jset(SHS,s);
  if(applied){try{localStorage.setItem(CFGKEY,JSON.stringify(CFG));}catch(e){}_ppl=null;shared.applied=true;}
  return Object.keys(out).length?out:null;
}
const shared={ok:null,api:0,backupAt:0,applied:false};
/* price help from the ledger: used when this phone cannot reach the price services itself */
function srvGold(reply){
  const g=reply&&reply.gold;if(!g||typeof g!=='object')return;
  const months={},meta={};Object.keys(g.months||{}).forEach(k=>{
    const p=Number(g.months[k]);if(/^\d{4}-\d{2}$/.test(k)&&p>500&&p<20000){months[k]=p/OZ;
      if(g.meta&&g.meta[k])meta[k]=g.meta[k];}
  });
  const px=Number(g.px),old=hget().srv||{},incoming={px:px>500&&px<20000?px/OZ:0,at:+g.at||0,source:g.source||'',months,meta};
  if(old.at>incoming.at){incoming.px=old.px;incoming.at=old.at;incoming.source=old.source;}
  /* Merge per month, favoring correctly dated closes, then keep previously cached records. */
  const merged=mergeGoldMonths({m:old.months||{},meta:old.meta||{}},{m:months,meta});
  incoming.months=merged.m;incoming.meta=merged.meta;
  if(JSON.stringify(incoming)!==JSON.stringify(old)){
    hsave({srv:incoming});shared.applied=true;  /* a price update must also redraw charts and reports */
  }
  if(incoming.px>0&&incoming.at>Number(gset().at||0)&&incoming.at<=Date.now()+300000){
    gsave({px:incoming.px,at:incoming.at,via:'ledger',source:incoming.source});
    shared.applied=true;
  }
}
window.lgCfgChanged=()=>{if(window.lgApplyingRemoteSettings)return;markDirty();scheduleSync();try{status();}catch(e){}};

/* ---------- views: tabs, source labels, sortable tables, scorecard, insights, explore ---------- */
(function(){
const st=document.createElement('style');
st.textContent=`
.x-off{display:none!important}
.x-tabs{display:flex;gap:2px;background:#E1E6EB;border-radius:13px;padding:3px;overflow-x:auto;position:sticky;top:0;z-index:40;margin:0 0 18px;scrollbar-width:none;box-shadow:0 6px 14px -10px rgba(22,35,47,.35)}
.x-tabs::-webkit-scrollbar{display:none}
.x-tabs button{flex:1 0 auto;border:0;background:transparent;padding:9px 12px;border-radius:10px;font:600 13px "IBM Plex Sans",sans-serif;color:#4A5866;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .15s,color .15s}
.x-tabs button.active{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(22,35,47,.14)}
.x-src{display:inline-block;font:700 9.5px/1 "IBM Plex Sans",sans-serif;letter-spacing:.6px;text-transform:uppercase;padding:4px 7px;border-radius:999px;vertical-align:middle;margin-left:8px;position:relative;top:-2px;white-space:nowrap}
.x-src.ours{background:#E7EEF5;color:var(--cash)}
.x-src.mkt{background:#F6EEDC;color:#8A661F}
.x-src.mix{background:#EFE8F1;color:var(--lea)}
.table-container table th:first-child,.table-container table td:first-child{position:sticky;left:0;z-index:1;background:var(--card);box-shadow:1px 0 0 var(--line)}
.table-container table thead th:first-child{background:#F6F8FA;z-index:2}
.table-container tr.x-on td{background:#EEF3F8}
.table-container table td:first-child{white-space:nowrap}
.table-container tr.x-tap:active td{background:#F3F6F9}
@media(max-width:560px){.table-container th,.table-container td{padding:10px 12px}.table-container table{font-size:13px}}
th.x-s{cursor:pointer;user-select:none;-webkit-user-select:none}
th.x-s::after{content:" ↕";opacity:.3}
th.x-asc::after{content:" ▲";opacity:1;color:var(--ink)}
th.x-desc::after{content:" ▼";opacity:1;color:var(--ink)}
td.x-click{cursor:pointer}
td.x-click:not(:has(.badge)){text-decoration:underline dotted var(--muted);text-underline-offset:3px}
tr.x-tap{cursor:pointer}
.x-sub{font-size:11px;font-weight:600;margin-top:1px}
.x-lf{display:grid;grid-template-columns:repeat(3,1fr) auto;gap:8px;margin-bottom:8px;align-items:center}
.x-lf .month-select{width:100%;min-width:0}
.x-lf-sum{font-size:12px;color:var(--muted);margin:0 2px 10px}
.x-sc-pick{display:flex;align-items:center;gap:6px;margin:0 0 10px}.x-sc-pick .month-select{flex:1;min-width:0}.x-sc-pick .x-link{font-size:22px;padding:2px 12px}
#x-sc-table td.num small,#x-ytd-table td.num small{display:block;font-size:11px;font-weight:600;margin-top:1px}
#x-sc-table td.cur,#x-ytd-table td.cur{font-weight:700}
.x-h3{margin:20px 0 8px;font-family:"Newsreader",serif;font-weight:600;font-size:17px}
.xi-list{display:grid;gap:8px}
@media(min-width:700px){.xi-list{grid-template-columns:1fr 1fr}}
.xi{display:flex;gap:12px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:13px 14px}
.xi-ic{flex:0 0 30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700}
.xi-ic.pos{background:#E4F1EA;color:var(--pos)}.xi-ic.neg{background:#F7E7E5;color:var(--debt)}.xi-ic.neu{background:#E7EEF5;color:var(--cash)}.xi-ic.gold{background:#F6EEDC;color:#8A661F}
.xi-t{font-size:13.5px;line-height:1.45;color:var(--ink-2)}.xi-t b{color:var(--ink)}
.xi-s{margin-top:6px}.xi-s .x-src{margin-left:0;top:0}
.xp-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 14px 12px}
.xp-top{display:flex;align-items:center;gap:6px}
.xp-pick{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:3px;background:#F6F8FA;border:1px solid var(--line);border-radius:12px;padding:10px 12px;cursor:pointer;text-align:left;font-family:inherit;-webkit-tap-highlight-color:transparent}
.xp-pick .xp-t{font:600 18px "Newsreader",serif;color:var(--ink);display:flex;align-items:center;gap:6px;max-width:100%}
.xp-pick .xp-t span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.xp-pick .xp-caret{font-size:12px;color:var(--muted)}
.xp-step{flex:0 0 40px;height:40px;border-radius:12px;border:1px solid var(--line);background:var(--card);font-size:20px;color:var(--ink);cursor:pointer}
.xp-desc{font-size:12.5px;color:var(--muted);margin:10px 2px 10px;line-height:1.45}
.xp-bar{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:10px}
.xp-seg{display:flex;background:#EEF1F4;border-radius:10px;padding:3px}
.xp-seg button{border:0;background:transparent;padding:7px 14px;border-radius:8px;font:600 12.5px "IBM Plex Sans",sans-serif;color:#4A5866;cursor:pointer}
.xp-seg button.active{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(22,35,47,.14)}
.xp-insight{font-size:13.5px;line-height:1.45;color:var(--ink-2);background:#F6F8FA;border-radius:12px;padding:10px 12px;margin-bottom:10px}
.xp-insight b{color:var(--ink)}
.xp-chart{position:relative;height:280px}
#xp-tablebox{margin-top:2px}
#xp-scrim{position:fixed;inset:0;background:rgba(22,35,47,.45);z-index:300}
#xp-sheet{position:fixed;left:0;right:0;bottom:0;margin:0 auto;max-width:520px;max-height:82vh;overflow-y:auto;z-index:310;background:var(--card);border-radius:20px 20px 0 0;padding:10px 14px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -8px 30px rgba(22,35,47,.25)}
#xp-sheet:not([hidden]){animation:xup .22s ease-out}
.xp-g{font:700 11px "IBM Plex Sans",sans-serif;letter-spacing:.6px;text-transform:uppercase;color:var(--muted);margin:14px 6px 6px;display:flex;align-items:center;gap:6px}
.xp-g .x-src{margin-left:0;top:0}
.xp-item{display:flex;gap:10px;align-items:center;width:100%;text-align:left;background:none;border:0;border-radius:12px;padding:11px 10px;cursor:pointer;font-family:inherit;color:var(--ink)}
.xp-item:active,.xp-item.on{background:#F1F4F7}
.xp-item .t{font-weight:600;font-size:14.5px}.xp-item .d{font-size:12px;color:var(--muted);margin-top:2px;line-height:1.35}
.xp-item .ck{margin-left:auto;color:var(--cash);font-weight:700;visibility:hidden}.xp-item.on .ck{visibility:visible}
.x-set{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}
`;
document.head.appendChild(st);
const SRC={ours:'Our data',mkt:'Market',mix:'Ours × market'};
const badge=k=>`<span class="x-src ${k}">${SRC[k]}</span>`;
function tagSection(id,k){const h=document.querySelector(`#${id} .section-header h2`);if(h&&!h.querySelector('.x-src'))h.insertAdjacentHTML('beforeend',badge(k));}

/* ---------- tabs ---------- */
const VIEWS=[['overview','Overview'],['explore','Explore'],['gold','Gold'],['ledger','Ledger'],['data','Data']];
const VMAP={
  overview:['kpi-grid','filter-section','x-score','x-insight','charts-section','bridge-section','insights-section','trends-section','variance-section'],
  explore:['filter-section','x-explore'],
  gold:['x-gold','x-goldhist'],
  ledger:['filter-section','tx-section'],
  data:['x-sync','x-settings','x-raw','x-data']
};
const ALLV=[...new Set([].concat(...Object.values(VMAP)))];
let view='overview';
try{const v=localStorage.getItem('lg-view-v2');if(VMAP[v])view=v;}catch(e){}
$('hero').insertAdjacentHTML('afterend',`<div class="x-tabs" id="x-tabs" role="tablist">${VIEWS.map(([k,l])=>`<button type="button" data-view="${k}" role="tab">${l}</button>`).join('')}</div>`);
function stickTabs(){const h=document.querySelector('header');$('x-tabs').style.top=(h?h.offsetHeight+6:6)+'px';}
window.addEventListener('resize',stickTabs);
function placeSections(empty){
  try{
    const sync=$('x-sync'),gold=$('x-gold'),set=$('x-settings');
    if(empty){if(sync.previousElementSibling!==$('x-empty')){$('x-empty').insertAdjacentElement('afterend',sync);sync.insertAdjacentElement('afterend',set);set.insertAdjacentElement('afterend',gold);}}
    else if(gold.nextElementSibling!==$('x-goldhist')){$('x-goldhist').insertAdjacentElement('beforebegin',gold);$('x-raw').insertAdjacentElement('beforebegin',sync);if(set)sync.insertAdjacentElement('afterend',set);}
  }catch(e){}
}
function applyView(){
  stickTabs();placeSections($('hero').hidden);
  $('x-tabs').hidden=$('hero').hidden;
  if($('hero').hidden){   /* empty ledger: sign in and import stay in reach */
    ALLV.forEach(id=>{const el=$(id);if(el)el.classList.toggle('x-off',!['x-sync','x-settings','x-data','x-raw','x-gold'].includes(id));});
    const tx=$('tx-search');if(tx)tx.classList.remove('x-off');return;
  }
  $('x-tabs').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  ALLV.forEach(id=>{const el=$(id);if(el)el.classList.toggle('x-off',!VMAP[view].includes(id));});
  const tx=$('tx-search');if(tx)tx.classList.toggle('x-off',view!=='ledger');
}
function goView(v,scrollId){
  view=v;try{localStorage.setItem('lg-view-v2',v);}catch(e){}
  applyView();renderRepCard();renderNotes();
  if(v==='explore')renderExplore();
  const el=scrollId&&$(scrollId);
  const y=el?el.getBoundingClientRect().top+window.scrollY-($('x-tabs').offsetHeight+(document.querySelector('header')||{offsetHeight:0}).offsetHeight+18)
           :$('x-tabs').offsetTop-((document.querySelector('header')||{offsetHeight:0}).offsetHeight+6);
  window.scrollTo({top:Math.max(0,y),behavior:'smooth'});
}
$('x-tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-view]');if(b)goView(b.dataset.view);});

/* ---------- ledger filter bar ---------- */
$('tx-search').insertAdjacentHTML('beforebegin',`<div class="x-lf" id="x-lf"><select class="month-select" id="x-lf-who" aria-label="Person"></select><select class="month-select" id="x-lf-cat" aria-label="Type"></select><select class="month-select" id="x-lf-year" aria-label="Year"></select><button type="button" class="x-link" id="x-lf-clear">Clear</button></div>`);
$('tx-search').insertAdjacentHTML('afterend',`<p class="x-lf-sum" id="x-lf-sum"></p>`);
const redrawLedger=()=>renderTable(getFilteredData());
$('x-lf-who').onchange=e=>{LF.who=e.target.value;redrawLedger();};
$('x-lf-cat').onchange=e=>{LF.cat=e.target.value;redrawLedger();};
$('x-lf-year').onchange=e=>{LF.year=e.target.value;redrawLedger();};
$('x-lf-clear').onclick=()=>{LF.who=LF.cat=LF.year='';txQuery='';$('tx-search').value='';redrawLedger();};
$('tx-table').addEventListener('click',e=>{
  const td=e.target.closest('td.x-click');if(!td)return;
  if(td.dataset.lf==='who')LF.who=LF.who===td.dataset.val?'':td.dataset.val;
  else LF.cat=LF.cat===td.dataset.val?'':td.dataset.val;
  redrawLedger();
});

/* ---------- sorting: tap a header, again to flip, a third time to reset ---------- */
const REG=['tx-table','comparison-table','trend-table','x-gold-table','x-lots-table','xp-table'];
const ST={};
function keyOf(td){
  if(!td)return null;
  if(td.dataset&&td.dataset.v!=null&&td.dataset.v!==''){const n=Number(td.dataset.v);return isNaN(n)?td.dataset.v:n;}
  const s=(td.textContent||'').trim();
  if(!s||s==='—')return null;
  let m=/^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);if(m)return +new Date(+m[3],+m[2]-1,+m[1]);
  const t=s.replace(/[−–]/g,'-').replace(/[$,+%▲▼\s]/g,'').trim();
  const n=parseFloat(t);
  return (!isNaN(n)&&/^-?\d/.test(t))?n:s.toLowerCase();
}
function applySort(id){
  const tb=$(id);if(!tb||!tb.tHead||!tb.tHead.rows||!tb.tHead.rows[0])return;
  const ths=[...tb.tHead.rows[0].cells];
  const sig=ths.map(h=>h.textContent).join('|');
  if(ST[id]&&ST[id].sig!==sig)delete ST[id];
  ths.forEach(h=>{h.classList.remove('x-asc','x-desc');h.classList.toggle('x-s',!!h.textContent.trim());});
  const s=ST[id];if(!s)return;
  if(ths[s.c])ths[s.c].classList.add(s.d>0?'x-asc':'x-desc');
  const body=tb.tBodies[0];
  const rows=[...body.rows].filter(r=>r.cells.length>1);
  rows.forEach((r,i)=>{if(r.dataset.i==null)r.dataset.i=i;});
  const k=rows.map(r=>({r,k:keyOf(r.cells[s.c]),i:+r.dataset.i}));
  k.sort((a,b)=>{
    if(a.k==null&&b.k==null)return a.i-b.i;
    if(a.k==null)return 1;if(b.k==null)return -1;
    let c;
    if(typeof a.k==='number'&&typeof b.k==='number')c=a.k-b.k;
    else if(s.c===0)c=a.i-b.i;
    else c=String(a.k).localeCompare(String(b.k));
    return c?c*s.d:a.i-b.i;
  });
  k.forEach(x=>body.appendChild(x.r));
}
window.lgApplySort=applySort;
document.addEventListener('click',e=>{
  const th=e.target.closest('th');if(!th||!th.classList.contains('x-s'))return;
  const tb=th.closest('table');if(!tb||!REG.includes(tb.id))return;
  const c=th.cellIndex,s=ST[tb.id];
  if(!s||s.c!==c)ST[tb.id]={c,d:1,sig:[...tb.tHead.rows[0].cells].map(h=>h.textContent).join('|')};
  else if(s.d===1)s.d=-1;else delete ST[tb.id];
  if(!ST[tb.id]){const body=tb.tBodies[0];[...body.rows].filter(r=>r.dataset.i!=null).sort((a,b)=>a.dataset.i-b.dataset.i).forEach(r=>body.appendChild(r));}
  applySort(tb.id);
});

/* ---------- variance table: year filter ---------- */
let VY='';
$('btn-qoq').parentNode.insertAdjacentHTML('afterend',`<select class="month-select" id="x-var-year" aria-label="Year"></select>`);
$('x-var-year').parentNode.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap';
$('x-var-year').onchange=e=>{VY=e.target.value;filterVar();};
function filterVar(){document.querySelectorAll('#comparison-table tbody tr').forEach(r=>{r.hidden=!!VY&&r.cells.length>1&&!(r.cells[0].textContent||'').includes(VY);});}
function fillVarYears(t){
  const ys=[...new Set(t.keys.map(k=>k.slice(0,4)))].reverse();
  if(VY&&!ys.includes(VY))VY='';
  $('x-var-year').innerHTML=`<option value="">All years</option>`+ys.map(y=>`<option value="${y}">${y}</option>`).join('');
  $('x-var-year').value=VY;
}

/* ---------- shared maths ---------- */
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fm=(y,m)=>`${MON[m]} ${y}`;
const fk=k=>fm(+k.slice(0,4),+k.slice(5)-1);
const fd=ts=>{const d=new Date(ts);return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;};
function wkStart(ts){const d=new Date(ts);d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d.getTime();}
function shiftD(ts,n){const d=new Date(ts);d.setDate(d.getDate()+n);return d.getTime();}
/* The ledger's first month usually also holds the savings brought in; its "real" saving is a setting. JF scales that month's flows to it. */
const janF=()=>startFactor();
const isFM=k=>startSaving()!=null&&k===firstMonth();
const fmTxt=()=>{const k=firstMonth();return k?fk(k):'the first month';};
const rowAmt=d=>(d.usd||0)+(isLoanRow(d)?0:(d.gold||0)*(d.goldPrice||0));
const pcOf=(a,b)=>(b!=null&&b>0)?a/b-1:null;
const arrow=v=>v==null?'—':`<span class="${v>=0?'pos':'neg'}">${v>=0?'▲':'▼'} ${Math.abs(v*100).toFixed(1)}%</span>`;
const pctTxt=v=>`${v>=0?'+':'−'}${Math.abs(v*100).toFixed(0)}%`;
const nowKey=()=>toYMD(Date.now()).slice(0,7);

/* ---------- scorecard ---------- */
$('filter-section').insertAdjacentHTML('afterend',`<div class="section" id="x-score">
 <div class="section-header"><h2>Scorecard</h2><select class="month-select" id="xs-per" aria-label="Period for the splits and the monthly chart"></select></div>
 <div class="xs-pies">
  <div class="chart-card xs-pie"><div class="title">Who put in</div><div class="desc" id="xs-p1d"></div><div class="xs-pw"><canvas id="xs-p1"></canvas><div class="xs-c" id="xs-p1c"></div></div><div class="xs-leg" id="xs-p1l"></div></div>
  <div class="chart-card xs-pie"><div class="title">Cash and gold</div><div class="desc" id="xs-p2d"></div><div class="xs-pw"><canvas id="xs-p2"></canvas><div class="xs-c" id="xs-p2c"></div></div><div class="xs-leg" id="xs-p2l"></div></div>
 </div>
 <div class="chart-card"><div class="title">Saved per month</div><div class="desc" id="xs-md"></div><div class="chart-wrap"><canvas id="xs-m"></canvas></div></div>
 <div class="xs-sub"><h3 class="x-h3">Compare a month or week</h3><div class="toggle-group" id="x-sc-mode"><button type="button" data-m="month" class="active">Month</button><button type="button" data-m="week">Week</button></div></div>
 <div class="x-sc-pick"><button type="button" class="x-link" id="x-sc-prev" aria-label="Earlier">‹</button><select class="month-select" id="x-sc-sel" aria-label="Period"></select><button type="button" class="x-link" id="x-sc-next" aria-label="Later">›</button></div>
 <div class="table-container"><table id="x-sc-table" style="min-width:540px"><thead></thead><tbody></tbody></table></div>
 <h3 class="x-h3" id="x-ytd-title">Year to date</h3>
 <div class="table-container"><table id="x-ytd-table" style="min-width:420px"><thead></thead><tbody></tbody></table></div>
 <p class="x-note" id="x-sc-note"></p></div>`);
const SC={mode:'month',sel:''};window.lgSC=SC;
function scOptions(rows){
  const ts=rows.map(r=>r.sortTs).filter(Boolean);if(!ts.length)return [];
  const first=Math.min(...ts),last=Math.max(Math.max(...ts),Date.now()),out=[];
  if(SC.mode==='month'){
    const a=new Date(first),b=new Date(last);
    for(let y=b.getFullYear(),m=b.getMonth();y>a.getFullYear()||(y===a.getFullYear()&&m>=a.getMonth());){out.push({v:`${y}-${p2(m+1)}`,l:fm(y,m)});if(--m<0){m=11;y--;}}
  }else{
    for(let w=wkStart(last),i=0;w>=wkStart(first)&&i<80;w=shiftD(w,-7),i++)out.push({v:String(w),l:`Week of ${fd(w)}`});
  }
  return out;
}
function rangeOf(sel,kind){
  if(SC.mode==='month'){
    let [y,m]=sel.split('-').map(Number);m--;
    if(kind==='prev'){m--;if(m<0){m=11;y--;}}
    if(kind==='ly')y--;
    return {a:new Date(y,m,1).getTime(),b:new Date(y,m+1,1).getTime(),l:fm(y,m)};
  }
  let a=+sel;if(kind==='prev')a=shiftD(a,-7);if(kind==='ly')a=shiftD(a,-364);
  return {a,b:shiftD(a,7),l:fd(a)};
}
let JF=1;
function bucket(rows,a,b){
  const o={saved:0,p:people().map(()=>0),gold:0,n:0,touchesJan:false};
  rows.forEach(d=>{
    if(!(d.sortTs>=a&&d.sortTs<b))return;
    const jan=isFM(d.yyyyMM),f=jan?JF:1;if(jan)o.touchesJan=true;
    const u=d.usd||0,gv=(d.gold||0)*(d.goldPrice||0),pi=personIdx(d);
    if(isLoanRow(d)){o.saved+=u*f;return;}
    const tot=u+gv;o.saved+=tot*f;o.gold+=gv*f;o.n++;
    if(pi>=0)o.p[pi]+=tot*f;
  });
  return o;
}
const balanceTo=(rows,b)=>rows.reduce((s,d)=>d.sortTs<b?s+rowAmt(d):s,0)+(window.lgGoldAdj?window.lgGoldAdj(rows)(toYMD(b-1).slice(0,7)):0);   /* gold at that month's market price */
const dcell=(a,b,ok)=>{if(!ok)return '<td class="num">n/a</td>';const v=pcOf(a,b);return `<td class="num">${arrow(v)}<small class="${a-b>=0?'pos':'neg'}">${signed0(a-b)}</small></td>`;};
/* ---------- scorecard top: two splits for a chosen period, then saving per month ---------- */
const st3=document.createElement('style');
st3.textContent=`.xs-bar{display:flex;justify-content:flex-end;margin:-2px 0 10px}
.xs-pies{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
.xs-pie{padding:12px 12px 10px!important;min-width:0}
.xs-pw{position:relative;height:140px;margin-top:4px}
.xs-c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;text-align:center}
.xs-c b{font:700 15px "IBM Plex Sans",sans-serif;color:var(--ink)}.xs-c span{font-size:10px;color:var(--muted);margin-top:1px}
.xs-leg{display:grid;gap:4px;margin-top:10px;font-size:12px;color:var(--ink-2)}
.xs-leg div{display:flex;align-items:center;gap:6px;min-width:0}.xs-leg i{flex:0 0 9px;height:9px;border-radius:3px}
.xs-leg b{margin-left:auto;font-weight:700}.xs-leg span{color:var(--muted);font-size:11px}
.xs-sub{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:18px 0 8px}.xs-sub .x-h3{margin:0}`;
document.head.appendChild(st3);
let XS='ytd';
function perOptions(rows){
  const o=[['ytd','Year to date'],['3m','Last 3 months'],['12m','Last 12 months'],['all','All time']];
  const ts=rows.map(r=>r.sortTs).filter(Boolean);if(!ts.length)return o;
  const a=new Date(Math.min(...ts)),b=new Date(Math.max(Math.max(...ts),Date.now()));
  for(let y=b.getFullYear(),m=b.getMonth();y>a.getFullYear()||(y===a.getFullYear()&&m>=a.getMonth());){o.push([`${y}-${p2(m+1)}`,fm(y,m)]);if(--m<0){m=11;y--;}}
  return o;
}
function perRange(v,rows){
  const now=new Date(),y=now.getFullYear(),m=now.getMonth(),endB=new Date(y,m+1,1).getTime();
  const first=Math.min(...rows.map(r=>r.sortTs).filter(Boolean));
  const monthsFrom=(a,b)=>{const out=[];for(let d=new Date(a);d.getTime()<b;d.setMonth(d.getMonth()+1))out.push(`${d.getFullYear()}-${p2(d.getMonth()+1)}`);return out;};
  if(v==='ytd'){const a=new Date(y,0,1).getTime();return {a,b:endB,label:`${y} so far`,months:monthsFrom(a,endB)};}
  if(v==='3m'||v==='12m'){const n=v==='3m'?3:12,a=new Date(y,m-n+1,1).getTime();return {a,b:endB,label:v==='3m'?'last 3 months':'last 12 months',months:monthsFrom(a,endB)};}
  if(v==='all'){const f=new Date(first),a=new Date(f.getFullYear(),f.getMonth(),1).getTime();return {a:0,b:endB,label:'all time',months:monthsFrom(a,endB)};}
  const [yy,mm]=v.split('-').map(Number),a=new Date(yy,mm-1,1).getTime(),b=new Date(yy,mm,1).getTime();
  return {a,b,label:fm(yy,mm-1),months:monthsFrom(new Date(yy,0,1).getTime(),Math.min(endB,new Date(yy+1,0,1).getTime())),sel:v};
}
const legend=items=>{const tot=items.reduce((s,i)=>s+Math.max(0,i[1]),0);return items.map(([l,v,c])=>`<div><i style="background:${c}"></i>${l}<b>${tot>0&&v>0?Math.round(v/tot*100)+'%':'—'}</b></div><div style="padding-left:15px"><span>${money0(v)}</span></div>`).join('');};
function donut(id,vals,cols){
  if(charts[id]){charts[id].destroy();charts[id]=null;}
  const has=vals.some(v=>v>0);
  charts[id]=new Chart($(id),{type:'doughnut',data:{labels:vals.map((_,i)=>i),datasets:[{data:has?vals.map(v=>Math.max(0,v)):[1],backgroundColor:has?cols:['#E6EAEE'],borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'70%',plugins:{datalabels:{display:false},legend:{display:false},tooltip:{enabled:false}}}});
}
function renderTop(){
  const rows=getFilteredData();if(!rows.length)return;
  JF=janF();
  const opts=perOptions(rows);if(!opts.some(o=>o[0]===XS))XS='ytd';
  $('xs-per').innerHTML=opts.map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('');$('xs-per').value=XS;
  const R=perRange(XS,rows),B=bucket(rows,R.a,R.b),PP=people(),gl=B.p.reduce((a,b)=>a+Math.max(0,b),0);
  /* 1. who put in what during the period */
  donut('xs-p1',B.p,PP.map((_,i)=>pcol(i)));
  $('xs-p1c').innerHTML=gl>0?`<b>${money0(gl)}</b><span>put in</span>`:`<b>—</b><span>nothing yet</span>`;
  $('xs-p1d').textContent=`Deposits, ${R.label}`;
  $('xs-p1l').innerHTML=legend(PP.map((p,i)=>[esc(p),B.p[i],pcol(i)]).filter(x=>PP.length<=4||x[1]>0));
  /* 2. cash and gold: where the money sits at the end of the period, gold at that month's market price */
  const end=R.b,mk=toYMD(Math.min(end,Date.now()+1)-1).slice(0,7);
  let cash=0,loan=0,goldCost=0;rows.forEach(d=>{if(!(d.sortTs<end))return;if(isLoanRow(d))loan-=d.usd||0;else{cash+=d.usd||0;goldCost+=(d.gold||0)*(d.goldPrice||0);}});
  let gold=goldCost;
  try{const gm=(window.lgGoldMonthly?window.lgGoldMonthly(rows):[]).filter(r=>r.k<=mk&&r.px);if(gm.length&&gset().mode==='market')gold=gm[gm.length-1].value;}catch(e){}
  donut('xs-p2',[cash,gold],[C.cash,C.gold]);
  const net=cash+gold-loan;
  $('xs-p2c').innerHTML=`<b>${money0(net)}</b><span>net worth</span>`;
  $('xs-p2d').textContent=R.sel?`At the end of ${R.label}`:'Today, gold at market';
  $('xs-p2l').innerHTML=legend([['Cash',cash,C.cash],['Gold',gold,C.gold]])+(loan>0.5?`<div><i style="background:${C.debt}"></i>Loans<b class="neg">−${money0(loan)}</b></div>`:'');
  /* 3. saving per month, not cumulative */
  const M=R.months.map(k=>{const [yy,mm]=k.split('-').map(Number);return {k,...bucket(rows,new Date(yy,mm-1,1).getTime(),new Date(yy,mm,1).getTime())};});
  const other=M.map(o=>o.saved-o.p.reduce((a,b)=>a+b,0));
  const avg=M.length?M.reduce((s,o)=>s+o.saved,0)/M.length:0;
  if(charts.xsm){charts.xsm.destroy();charts.xsm=null;}
  const hl=k=>!R.sel||k===R.sel?1:.35;
  charts.xsm=new Chart($('xs-m'),{type:'bar',data:{labels:M.map(o=>lbl(o.k)),datasets:[
    ...PP.map((p,i)=>({label:p,data:M.map(o=>o.p[i]),backgroundColor:M.map(o=>rgba(pcol(i),hl(o.k))),stack:'s'})).filter(d=>PP.length<=4||d.data.some(v=>Math.abs(v)>0.5)),
    ...(other.some(v=>Math.abs(v)>0.5)?[{label:'Loans and other',data:other,backgroundColor:M.map(o=>`rgba(176,67,58,${hl(o.k)})`),stack:'s'}]:[]),
    {type:'line',label:'Saved',data:M.map(o=>o.saved),borderColor:C.ink,backgroundColor:C.ink,borderWidth:0,pointRadius:3,pointStyle:'line',showLine:false},
    {type:'line',label:`Average ${money0(avg)}`,data:M.map(()=>avg),borderColor:C.gold,borderDash:[5,4],borderWidth:1.6,pointRadius:0}]},
    options:opt({stacked:true})});
  const best=M.reduce((a,o)=>o.saved>a.saved?o:a,M[0]||{saved:0,k:''});
  $('xs-md').textContent=M.length?`${R.sel?`${R.label}: ${money0((M.find(o=>o.k===R.sel)||{saved:0}).saved)} saved. `:''}Average ${money0(avg)} a month${best&&best.k?`, best ${lbl(best.k)} at ${money0(best.saved)}`:''}.${R.months.some(isFM)?` ${fmTxt()} shows its real saving of ${money0(startSaving())}.`:''}`:'';
}
$('xs-per').onchange=e=>{XS=e.target.value;renderTop();};
function renderScore(){
  try{renderTop();}catch(e){console.error(e);}
  const rows=getFilteredData();if(!allData.length||!rows.length)return;
  JF=janF();
  const opts=scOptions(rows);if(!opts.length)return;
  if(!opts.some(o=>o.v===SC.sel))SC.sel=opts[0].v;
  $('x-sc-sel').innerHTML=opts.map(o=>`<option value="${o.v}">${esc(o.l)}</option>`).join('');$('x-sc-sel').value=SC.sel;
  $('x-sc-mode').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.m===SC.mode));
  const cur=rangeOf(SC.sel,'cur'),prv=rangeOf(SC.sel,'prev'),ly=rangeOf(SC.sel,'ly');
  const first=Math.min(...rows.map(r=>r.sortTs).filter(Boolean));
  const hasPrev=prv.b>first,hasLy=ly.b>first;
  const C0=bucket(rows,cur.a,cur.b),P0=bucket(rows,prv.a,prv.b),L0=bucket(rows,ly.a,ly.b);
  const bal=[balanceTo(rows,cur.b),balanceTo(rows,prv.b),balanceTo(rows,ly.b)];
  const unit=SC.mode==='month'?'month':'week',lab=SC.mode==='month'?'MoM':'WoW';
  $('x-sc-table').tHead.innerHTML=`<tr><th>${SC.mode==='month'?'Month':'Week'}</th><th class="r">${esc(cur.l)}</th><th class="r">${esc(prv.l)}</th><th class="r">${lab}</th><th class="r">${esc(ly.l)}</th><th class="r">YoY</th></tr>`;
  const PP=people();
  const M=[['Saved',o=>o.saved],...PP.map((p,i)=>[`${esc(p)} added`,o=>o.p[i]]).filter((m,i)=>PP.length<=4||Math.abs(C0.p[i])+Math.abs(P0.p[i])+Math.abs(L0.p[i])>0.5),['Gold bought',o=>o.gold]];
  let h=M.map(([l,g])=>`<tr><td><strong>${l}</strong></td><td class="num cur">${money0(g(C0))}</td><td class="num">${hasPrev?money0(g(P0)):'—'}</td>${dcell(g(C0),g(P0),hasPrev)}<td class="num">${hasLy?money0(g(L0)):'—'}</td>${dcell(g(C0),g(L0),hasLy)}</tr>`).join('');
  h+=`<tr><td><strong>Balance at end</strong></td><td class="num cur">${money0(bal[0])}</td><td class="num">${hasPrev?money0(bal[1]):'—'}</td>${dcell(bal[0],bal[1],hasPrev)}<td class="num">${hasLy?money0(bal[2]):'—'}</td>${dcell(bal[0],bal[2],hasLy)}</tr>`;
  $('x-sc-table').tBodies[0].innerHTML=h;
  const y=new Date(cur.b-1).getFullYear(),y0=new Date(y,0,1).getTime(),yl=new Date(y-1,0,1).getTime();
  const lyEnd=SC.mode==='month'?new Date(y-1,new Date(cur.b-1).getMonth()+1,1).getTime():shiftD(cur.b,-364);
  const Y0=bucket(rows,y0,cur.b),YL=bucket(rows,yl,lyEnd),hasYL=lyEnd>first;
  $('x-ytd-title').textContent=`Year to date, ${y}`;
  $('x-ytd-table').tHead.innerHTML=`<tr><th>Since 1 January</th><th class="r">${y}</th><th class="r">${y-1}</th><th class="r">YoY</th></tr>`;
  $('x-ytd-table').tBodies[0].innerHTML=M.map(([l,g])=>`<tr><td><strong>${l}</strong></td><td class="num cur">${money0(g(Y0))}</td><td class="num">${hasYL?money0(g(YL)):'—'}</td>${dcell(g(Y0),g(YL),hasYL)}</tr>`).join('');
  let note=`Follows the filter above. ${lab} compares with the ${unit} before, YoY with the same ${unit} a year earlier, and year to date with the same stretch of last year. Saved, each person’s added amount and Gold bought are what went in during the period, so the opening balance never inflates them. Balance counts gold at market; the other rows count it at what you paid.`;
  if(!hasLy)note+=` There is no ${ly.l} in the ledger, so YoY shows n/a until a year of data exists.`;
  if(C0.touchesJan||P0.touchesJan||L0.touchesJan||Y0.touchesJan||YL.touchesJan)note+=` ${fmTxt()} counts as ${money0(startSaving())}, your real saving that month, not the earlier savings it also held (change it in Data).`;
  if(currentFilter==='all'&&typeof pathFor==='function'){
    try{const t=computeAnalytics(rows),ck=toYMD(cur.b-1).slice(0,7),path=pathFor(y,t);
      if(path){const cb=cumAt(t,ck),g=goalRatio(y,path,t,ck,cb);if(g!=null)note+=` Against the phased goal for ${fk(ck)}: ${(g>=0?'+':'−')+Math.abs(g*100).toFixed(1)}% (${signed0(cb-path.at(ck))}).`;}}catch(e){}
  }
  $('x-sc-note').textContent=note;
}
$('x-sc-mode').addEventListener('click',e=>{const b=e.target.closest('button[data-m]');if(!b)return;SC.mode=b.dataset.m;SC.sel='';renderScore();});
$('x-sc-sel').onchange=e=>{SC.sel=e.target.value;renderScore();};
const stepSc=n=>{const o=scOptions(getFilteredData()),i=o.findIndex(x=>x.v===SC.sel),j=i-n;if(i>=0&&j>=0&&j<o.length){SC.sel=o[j].v;renderScore();}};
$('x-sc-prev').onclick=()=>stepSc(-1);$('x-sc-next').onclick=()=>stepSc(1);

/* ---------- what stands out ---------- */
$('x-score').insertAdjacentHTML('afterend',`<div class="section" id="x-insight"><div class="section-header"><h2>What stands out</h2><span class="hint">updates with the filter</span></div><div class="xi-list" id="xi-list"></div></div>`);
function renderInsights(){
  const f=getFilteredData(),t=computeAnalytics(f),allT=computeAnalytics(allData);
  if(!t.keys.length){$('xi-list').innerHTML='';return;}
  JF=janF();
  const jf=k=>isFM(k)?JF:1;
  const d=k=>t.comp[k]?t.comp[k].delta*jf(k):0;
  const lastAll=allT.keys[allT.keys.length-1],nk=nowKey();
  const cur=lastAll>nk?lastAll:(nk<=addMonths(lastAll,1)?nk:lastAll);
  const months=[];for(let k=t.keys[0];k<=cur;k=addMonths(k,1))months.push(k);
  const out=[];
  const add=(ic,tone,html,src)=>out.push(`<div class="xi"><div class="xi-ic ${tone}">${ic}</div><div><div class="xi-t">${html}</div><div class="xi-s">${badge(src)}</div></div></div>`);
  /* 1. this month against your recent average */
  const prev=months.filter(k=>k<cur).slice(-6),avg6=prev.length?prev.reduce((s,k)=>s+d(k),0)/prev.length:0,dc=d(cur),partial=cur===nk;
  if(prev.length>=2&&avg6>0){
    const r=dc/avg6-1;
    add(r>=0?'↗':'↘',r>=0?'pos':'neg',`${partial?`So far in <b>${fk(cur)}</b>`:`In <b>${fk(cur)}</b>`} you saved <b>${money0(dc)}</b>, ${pctTxt(r)} vs your ${prev.length}-month average of ${money0(avg6)}.${partial?' The month is not over yet.':''}`,'ours');
  }
  /* 2. pace to the target */
  if(currentFilter==='all'&&typeof pathFor==='function'){
    const Y=+cur.slice(0,4),path=pathFor(Y,t);
    if(path){
      const last3=months.filter(k=>k<=cur).slice(-3),run=last3.length?last3.reduce((s,k)=>s+d(k),0)/last3.length:0;
      const bal=cumAt(t,cur),left=Math.max(0,monthsBetween(cur,`${Y}-12`)),proj=bal+run*left,gap=path.goal-bal;
      if(gap<=0)add('★','pos',`You passed the <b>${money0(path.goal)}</b> target for ${Y}: the balance is ${money0(bal)}.`,'ours');
      else{
        const need=left>0?gap/left:gap,n=run>0?Math.ceil(gap/run):null,when=n!=null?fk(addMonths(cur,n)):null;
        add(proj>=path.goal?'◎':'!',proj>=path.goal?'pos':'neg',`At your 3-month pace of <b>${money0(run)}/month</b> you would end ${Y} at <b>${money0(proj)}</b>, ${proj>=path.goal?`${money0(proj-path.goal)} above`:`${money0(path.goal-proj)} short of`} the ${money0(path.goal)} target.${proj<path.goal?` Keeping on track needs ${money0(need)}/month${when?`; at today's pace you get there in ${when}`:''}.`:''}`,'ours');
      }
    }
  }
  /* 3. year to date against last year */
  const Yc=+cur.slice(0,4),mi=+cur.slice(5);
  if(hasYear(t,Yc-1)){
    const a=ytd(t,Yc,mi),b=ytd(t,Yc-1,mi),r=pcOf(a,b);
    if(r!=null)add(r>=0?'↗':'↘',r>=0?'pos':'neg',`Year to date you saved <b>${money0(a)}</b>, <b>${pctTxt(r)}</b> vs the same months of ${Yc-1} (${money0(b)}).`,'ours');
  }
  /* 4. best and weakest month, and consistency */
  const full=months.filter(k=>k<cur||!partial);
  if(full.length>=3){
    let best=full[0],worst=full[0];full.forEach(k=>{if(d(k)>d(best))best=k;if(d(k)<d(worst))worst=k;});
    const pos=full.filter(k=>d(k)>0).length;let streak=0;for(let i=full.length-1;i>=0&&d(full[i])>0;i--)streak++;
    add('▲','neu',`Best month <b>${fk(best)}</b> (${money0(d(best))}), weakest <b>${fk(worst)}</b> (${money0(d(worst))}). You saved in ${pos} of ${full.length} months${streak>1?`, and the last ${streak} in a row`:''}.`,'ours');
  }
  /* 5. who contributed this year */
  if(currentFilter==='all'){
    const v=t.P.map(()=>0);t.keys.filter(k=>k.startsWith(Yc+'-')).forEach(k=>{t.comp[k].pt.forEach((x,i)=>{v[i]+=x*jf(k);});});
    const tot=v.reduce((a,b)=>a+Math.max(0,b),0),parts=t.P.map((p,i)=>[p,v[i]]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
    if(tot>0&&parts.length>1)add('⚖','neu',`In ${Yc}, `+parts.map(([p,x])=>`${esc(p)} put in <b>${Math.round(x/tot*100)}%</b> (${money0(x)})`).join(', ').replace(/, ([^,]*)$/,' and $1')+'.','ours');
  }
  /* 6. gold at market */
  if(t.goldGrams>0&&t.goldPx>0){
    const r=t.gold/t.goldCost-1,share=t.net>0?t.gold/t.net:0;
    add('◆','gold',`Your ${t.goldGrams.toFixed(1)} g of gold is worth <b>${money0(t.gold)}</b> at today's price, <b>${pctTxt(r)}</b> on the ${money0(t.goldCost)} you paid, and is ${Math.round(share*100)}% of net worth.`,'mix');
  }
  /* 7. loans */
  if(t.loan>0.5)add('⇄','neg',`Loans outstanding: <b>${money0(t.loan)}</b>. ${money0(t.loanRepaid)} of ${money0(t.loanBorrowed)} borrowed is repaid.`,'ours');
  $('xi-list').innerHTML=out.join('');
}

/* ---------- explore: any table, or its chart, picked from a drop-up menu ---------- */
$('x-insight').insertAdjacentHTML('afterend',`<div class="section" id="x-explore"><div class="xp-card">
 <div class="xp-top"><button type="button" class="xp-step" id="xp-prev" aria-label="Previous view">‹</button>
  <button type="button" class="xp-pick" id="xp-pick" aria-haspopup="dialog"><span id="xp-src"></span><span class="xp-t"><span id="xp-title"></span><span class="xp-caret">▲▼</span></span></button>
  <button type="button" class="xp-step" id="xp-next" aria-label="Next view">›</button></div>
 <p class="xp-desc" id="xp-desc"></p>
 <div class="xp-bar"><div class="xp-seg" id="xp-seg"><button type="button" data-m="chart">Chart</button><button type="button" data-m="table">Table</button><button type="button" data-m="both">Both</button></div><select class="month-select" id="xp-year" aria-label="Year"></select></div>
 <div class="xp-insight" id="xp-insight"></div>
 <div id="xp-chartbox"><div class="xp-chart"><canvas id="xp-chart"></canvas></div></div>
 <div class="table-container" id="xp-tablebox"><table id="xp-table"><thead></thead><tbody></tbody></table></div>
 <p class="x-note" id="xp-note"></p></div></div>`);
document.body.insertAdjacentHTML('beforeend',`<div id="xp-scrim" hidden></div><div id="xp-sheet" role="dialog" aria-modal="true" aria-label="Choose a view" hidden><div class="x-grab"></div><div id="xp-list"></div></div>`);
const XP={id:'ctc',mode:'chart',year:''};
try{Object.assign(XP,JSON.parse(localStorage.getItem('lg-xp-v1')||'{}'));}catch(e){}
const xpSave=()=>{try{localStorage.setItem('lg-xp-v1',JSON.stringify(XP));}catch(e){}};
const cell=(h,v,c)=>({h,v,c:c||''});
const mC=v=>cell(money0(v),v,'num');
const sC=v=>cell(v==null?'—':`<span class="${v>=0?'pos':'neg'}">${signed0(v)}</span>`,v,'num');
const pC=v=>cell(arrow(v),v,'num');
const kC=k=>cell(`<strong>${fk(k)}</strong>`,k.replace('-',''));
const BASE={responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
  plugins:{datalabels:{display:false},legend:{position:'bottom',labels:{boxWidth:12,boxHeight:12,padding:12,font:{size:11}}},
    tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${c.raw==null?'—':(c.dataset.pct?(c.raw*100).toFixed(1)+'%':money0(c.raw))}`}}},
  scales:{x:{grid:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:8}},y:{grid:{color:'#F0F2F5'},ticks:{callback:v=>'$'+Number(v).toLocaleString()}}}};
const opt=extra=>{const o=JSON.parse(JSON.stringify(BASE));o.plugins.tooltip.callbacks=BASE.plugins.tooltip.callbacks;o.scales.y.ticks.callback=BASE.scales.y.ticks.callback;
  if(extra&&extra.stacked){o.scales.x.stacked=true;o.scales.y.stacked=true;}
  if(extra&&extra.y1){o.scales.y1={position:'right',grid:{display:false},ticks:{callback:BASE.scales.y.ticks.callback}};}
  if(extra&&extra.pctY){o.scales.y.ticks.callback=v=>(v*100).toFixed(0)+'%';}
  return o;};
const lbl=k=>`${MON[+k.slice(5)-1]} ’${k.slice(2,4)}`;
const janNote=ks=>ks.some(isFM)?` ${fmTxt()} includes the savings you had before it; its real saving counts as ${money0(startSaving())} wherever a comparison needs it.`:'';

const XV=[
 {id:'ctc',src:'ours',grp:'ours',title:'Contribution to change',desc:'What moved your balance each month: each person’s cash, gold bought and loans.',years:'all',
  build(x){
   const ks=x.ks,pe=x.pe,t=x.t,ip=activeP(t),G=ip.map(()=>0);let Au=0,Lo=0,P=0,S=0;
   const rows=[...ks].reverse().map(k=>{const c=t.comp[k];ip.forEach((i,j)=>{G[j]+=c.pc[i];});Au+=c.gold;Lo+=c.loan;S+=c.delta;const p=pe[k];if(p!=null)P+=p;
     return {k,cells:[kC(k),...ip.map(i=>sC(c.pc[i])),sC(c.gold),c.loan?sC(c.loan):cell('—','', 'num'),cell(`<strong>${c.delta>=0?'+':'−'}$${Math.abs(Math.round(c.delta)).toLocaleString('en-US')}</strong>`,c.delta,'num'),p==null?cell('—','','num'):sC(p),sC(c.delta+(p||0))]};});
   const parts=[...ip.map((i,j)=>[`${t.P[i]} cash`,G[j]]),['Gold bought',Au],['Loans',Lo]].filter(p=>p[1]>0).sort((a,b)=>b[1]-a[1]);
   const top=parts[0];
   return {cols:['Month',...ip.map(i=>`${t.P[i]} cash`),'Gold bought','Loans','Saved','Gold price','Total change'],rows,
    insight:top?`<b>${esc(top[0])}</b> brought in ${S>0?Math.round(top[1]/S*100):0}% of the ${money0(S)} saved${x.year?` in ${x.year}`:''}.${Object.keys(pe).length?` The gold price added <b>${signed0(P)}</b> on top.`:''}`:'',
    note:'Saved is what went in, at what you paid. Gold price is how much the gold you already held gained or lost with the market (shown when the filter is All). Saved plus gold price gives the total change. Tap a month to open its scorecard.'+janNote(ks),
    chart:{type:'bar',data:{labels:ks.map(lbl),datasets:[
      ...ip.map(i=>({label:`${t.P[i]} cash`,data:ks.map(k=>t.comp[k].pc[i]),backgroundColor:pcol(i),stack:'s'})),
      {label:'Gold bought',data:ks.map(k=>t.comp[k].gold),backgroundColor:C.gold,stack:'s'},
      {label:'Loans',data:ks.map(k=>t.comp[k].loan),backgroundColor:C.debt,stack:'s'},
      ...(Object.keys(pe).length?[{label:'Gold price',data:ks.map(k=>pe[k]==null?0:pe[k]),backgroundColor:'#E7D3A6',stack:'s'}]:[]),
      {type:'line',label:'Total change',data:ks.map(k=>t.comp[k].delta+(pe[k]||0)),borderColor:C.ink,backgroundColor:C.ink,borderWidth:2,pointRadius:2,tension:.25}]},options:opt({stacked:true})}};
  }},
 {id:'balance',src:'ours',grp:'ours',title:'Balance month by month',desc:'Where the balance ended each month, how much it moved, and the change in %.',years:'all',
  build(x){
   const ks=x.ks,t=x.t;
   const rows=[...ks].reverse().map(k=>{const i=t.keys.indexOf(k),pb=i>0?t.cumulative[t.keys[i-1]]:null,b=t.cumulative[k],ch=b-(pb||0);
     return {k,cells:[kC(k),mC(b),sC(ch),pC(pb!=null&&pb>0?ch/pb:null),pC(yoyYtd(t,k))]};});
   const a=ks[0],z=ks[ks.length-1],i0=t.keys.indexOf(a),start=i0>0?t.cumulative[t.keys[i0-1]]:0,end=t.cumulative[z];
   return {cols:['Month','Balance','Change','Change %','Saved YoY'],rows,
    insight:`The balance went from <b>${money0(start)}</b> to <b>${money0(end)}</b>${x.year?` in ${x.year}`:''}, ${signed0(end-start)}.`,
    note:'Balance counts gold at that month’s market price, so Change includes what the gold price did. Change % is the move on the balance at the start of the month. Saved YoY compares what you saved from January to that month with the same months last year.'+janNote(ks),
    chart:{type:'bar',data:{labels:ks.map(lbl),datasets:[
      {type:'line',label:'Balance',data:ks.map(k=>t.cumulative[k]),borderColor:C.cash,backgroundColor:'rgba(47,93,138,0.10)',fill:true,tension:.3,borderWidth:2.4,pointRadius:2,yAxisID:'y'},
      {label:'Change',data:ks.map(k=>{const i=t.keys.indexOf(k);return t.cumulative[k]-(i>0?t.cumulative[t.keys[i-1]]:0);}),backgroundColor:ks.map(k=>{const i=t.keys.indexOf(k);return t.cumulative[k]-(i>0?t.cumulative[t.keys[i-1]]:0);}).map(v=>v>=0?'rgba(46,125,91,.55)':'rgba(176,67,58,.6)'),yAxisID:'y1'}]},options:opt({y1:true})}};
  }},
 {id:'yoy',src:'ours',grp:'ours',title:'This year vs last year',desc:'Each month and the year to date, against the same months of the year before.',years:'one',
  build(x){
   const t=x.t,Y=+x.year,P=Y-1,jf=x.jf,dm=(y,m)=>{const k=`${y}-${p2(m)}`;return t.comp[k]?t.comp[k].delta*jf(k):null;};
   const end=x.lastAll.startsWith(Y+'-')?+x.lastAll.slice(5):(x.lastAll<`${Y}-01`?0:12);
   const rows=[],has=hasYear(t,P);
   for(let m=1;m<=12;m++){const a=dm(Y,m),b=dm(P,m);if(m>end&&b==null)continue;
     rows.push({k:`${Y}-${p2(m)}`,cells:[cell(`<strong>${MON[m-1]}</strong>`,m),a==null&&m>end?cell('—','','num'):mC(a||0),b==null?cell('—','','num'):mC(b),m<=end&&has?pC(pcOf(a||0,b)):cell(has?'—':'n/a','','num'),
       m<=end?mC(ytd(t,Y,m)):cell('—','','num'),has?mC(ytd(t,P,m)):cell('—','','num'),m<=end&&has?pC(pcOf(ytd(t,Y,m),ytd(t,P,m))):cell(has?'—':'n/a','','num')]});}
   const r=end&&has?pcOf(ytd(t,Y,end),ytd(t,P,end)):null;
   return {cols:['Month',`${Y}`,`${P}`,'YoY',`${Y} to date`,`${P} to date`,'YTD YoY'],rows:rows.reverse(),
    insight:!has?`There is no ${P} in the ledger, so ${Y} has nothing to compare with yet. From January ${Y+1} this view compares ${Y+1} with ${Y}.`:(r==null?`No ${Y} entries yet.`:`Year to date, ${Y} is <b>${pctTxt(r)}</b> vs ${P}: ${money0(ytd(t,Y,end))} saved against ${money0(ytd(t,P,end))} by ${MON[end-1]}.`),
    note:'Saved amounts only, so the opening balance never inflates the comparison. Follows the filter: each person is compared with themselves.'+((isFM(`${Y}-${firstMonth().slice(5)}`)||isFM(`${P}-${firstMonth().slice(5)}`))?` ${fmTxt()} counts as ${money0(startSaving())}.`:''),
    chart:{type:'bar',data:{labels:MON,datasets:[
      {label:`${P} saved`,data:MON.map((_,i)=>dm(P,i+1)),backgroundColor:'#C9D1D9'},
      {label:`${Y} saved`,data:MON.map((_,i)=>i+1<=end?(dm(Y,i+1)||0):null),backgroundColor:C.cash},
      {type:'line',label:`${P} to date`,data:MON.map((_,i)=>has?ytd(t,P,i+1):null),borderColor:'#9AA6B1',borderDash:[5,4],borderWidth:1.8,pointRadius:0,yAxisID:'y1'},
      {type:'line',label:`${Y} to date`,data:MON.map((_,i)=>i+1<=end?ytd(t,Y,i+1):null),borderColor:C.ink,borderWidth:2.2,pointRadius:2,yAxisID:'y1'}]},options:opt({y1:true})}};
  }},
 {id:'goal',src:'ours',grp:'ours',title:'Balance vs phased goal',desc:'Your balance against the straight path to the year’s target, month by month.',years:'one',
  build(x){
   const t=x.t,Y=+x.year;
   if(currentFilter!=='all')return {cols:['Month'],rows:[],insight:'Targets cover both of you. Set the filter to <b>Everyone</b> to see this view.',note:'',chart:null};
   const path=pathFor(Y,t);
   if(!path)return {cols:['Month'],rows:[],insight:`The ${Y} target is set once ${Y-1} has entries.`,note:'',chart:null};
   const ax=[];for(let i=0;i<=path.span;i++)ax.push(addMonths(path.firstKey,i));
   const end=x.lastAll;
   const rows=ax.filter(k=>k<=end&&k>=`${Y}-01`).reverse().map(k=>{const b=cumAt(t,k),g=path.at(k);return {k,cells:[kC(k),mC(b),mC(g),sC(b-g),pC(goalRatio(Y,path,t,k,b))]};});
   const lk=ax.filter(k=>k<=end).pop(),b=cumAt(t,lk),g=path.at(lk);
   return {cols:['Month','Balance','Phased goal','Gap','vs goal'],rows,
    insight:`Target <b>${money0(path.goal)}</b> by December ${Y}. In ${fk(lk)} you are <b>${signed0(b-g)}</b> vs the path.`,
    note:`The path is a straight line from ${Y>+t.keys[0].slice(0,4)?`the ${Y-1} closing balance`:'your first month'} to the target. "vs goal" compares what you saved this year with what the path expected by that month.`,
    chart:{type:'line',data:{labels:ax.map((k,i)=>i===0&&Y>+t.keys[0].slice(0,4)?`Dec ’${String(Y-1).slice(2)}`:lbl(k)),datasets:[
      {label:'Balance',data:ax.map(k=>k<=end?cumAt(t,k):null),borderColor:C.cash,backgroundColor:'rgba(47,93,138,0.10)',fill:true,tension:.3,borderWidth:2.4,pointRadius:2},
      {label:'Phased goal',data:ax.map(k=>path.at(k)),borderColor:C.gold,borderDash:[6,5],borderWidth:1.8,pointRadius:0}]},options:opt()}};
  }},
 {id:'people',src:'ours',grp:'ours',title:'Who put in, by month',desc:'What each person put in every month, gold included, and the split.',years:'all',
  build(x){
   const ks=x.ks,t=x.t,ip=activeP(t),G=ip.map(()=>0);
   const rows=[...ks].reverse().map(k=>{const c=t.comp[k],v=ip.map(i=>c.pt[i]),s=v.reduce((a,b)=>a+b,0);v.forEach((z,j)=>{G[j]+=z;});
     return {k,cells:[kC(k),...v.map(mC),mC(s),cell(s>0?Math.round(Math.max(...v)/s*100)+'%':'—',s>0?Math.max(...v)/s:'','num')]};});
   const tot=G.reduce((a,b)=>a+Math.max(0,b),0);
   return {cols:['Month',...ip.map(i=>t.P[i]),'Together','Largest share'],rows,
    insight:tot>0?`${x.year||'Since the start'}: `+ip.map((i,j)=>`${esc(t.P[i])} <b>${money0(G[j])}</b> (${Math.round(Math.max(0,G[j])/tot*100)}%)`).join(', ')+'.':'',
    note:'Deposits only, loans excluded, gold at what you paid.'+janNote(ks),
    chart:{type:'bar',data:{labels:ks.map(lbl),datasets:ip.map(i=>({label:t.P[i],data:ks.map(k=>t.comp[k].pt[i]),backgroundColor:pcol(i)}))},options:opt()}};
  }},
 {id:'years',src:'ours',grp:'ours',title:'Year by year',desc:'Opening balance, what each person added, and the closing balance for every year.',years:false,
  build(x){
   const t=x.t,jf=x.jf,Y={},ip=activeP(t);
   t.keys.forEach(k=>{const y=k.slice(0,4),c=t.comp[k],o=Y[y]||(Y[y]={pp:ip.map(()=>0),lo:0,s:0,raw:0,last:k,first:k});const f=jf(k);
     ip.forEach((i,j)=>{o.pp[j]+=c.pt[i]*f;});o.lo+=c.loan;o.s+=c.delta*f;o.raw+=c.delta;o.last=k;});
   const ys=Object.keys(Y).sort();let open=0;const list=ys.map(y=>{const o=Y[y],close=t.cumulative[o.last],brought=o.raw-o.s,r={y,open,brought,...o,close,gp:close-open-brought-o.s};open=close;return r;});
   const rows=[...list].reverse().map(r=>{const p=list.find(z=>+z.y===+r.y-1);
     return {y:r.y,cells:[cell(`<strong>${r.y}</strong>`,+r.y),mC(r.open),Math.abs(r.brought)>0.5?mC(r.brought):cell('—','','num'),...r.pp.map(mC),r.lo?sC(r.lo):cell('—','','num'),mC(r.s),Math.abs(r.gp)>0.5?sC(r.gp):cell('—','','num'),mC(r.close),pC(p?pcOf(r.s,p.s):null)]};});
   const last=list[list.length-1];
   return {cols:['Year','Opening','Brought in',...ip.map(i=>t.P[i]),'Loans','Saved','Gold price','Closing','Saved YoY'],rows,
    insight:last?`${last.y}: saved <b>${money0(last.s)}</b> so far, closing at <b>${money0(last.close)}</b>.`:'',
    note:`Opening + brought in + saved + gold price = closing. Gold price is what the market did to the gold you hold (closing balances count gold at market).${startSaving()!=null?` Brought in is the savings you already had when the ledger started (${fmTxt()} minus its real saving of ${money0(startSaving())}).`:''} Saved YoY compares full years; the current year is only partly done. Tap a year to open it at the top.`,
    chart:{type:'bar',data:{labels:list.map(r=>r.y),datasets:[
      {label:'Brought in',data:list.map(r=>r.brought||0),backgroundColor:'#C9D1D9',stack:'s'},
      ...ip.map((i,j)=>({label:t.P[i],data:list.map(r=>r.pp[j]),backgroundColor:pcol(i),stack:'s'})),
      {label:'Gold price',data:list.map(r=>r.gp),backgroundColor:'#E7D3A6',stack:'s'},
      {type:'line',label:'Closing balance',data:list.map(r=>r.close),borderColor:C.ink,borderWidth:2,pointRadius:3}]},options:opt({stacked:true})}};
  }},
 {id:'weeks',src:'ours',grp:'ours',title:'Week by week',desc:'What you saved each week, against the week before and your 4-week average.',years:'all',
  build(x){
   const W={};x.f.forEach(d=>{if(!d.sortTs)return;const w=wkStart(d.sortTs);W[w]=(W[w]||0)+rowAmt(d)*(isFM(d.yyyyMM)?x.JF:1);});
   const first=Math.min(...Object.keys(W).map(Number)),last=Math.max(wkStart(Date.now()),...Object.keys(W).map(Number)),all=[];
   for(let w=first;w<=last;w=shiftD(w,7))all.push(w);
   const ws=all.filter(w=>!x.year||new Date(w).getFullYear()===+x.year).slice(-52);
   const v=w=>W[w]||0,avg4=w=>{const i=all.indexOf(w),p=all.slice(Math.max(0,i-4),i);return p.length?p.reduce((s,z)=>s+v(z),0)/p.length:null;};
   const rows=[...ws].reverse().map(w=>{const i=all.indexOf(w),pw=i>0?all[i-1]:null;return {cells:[cell(`<strong>${fd(w)}</strong>`,w),mC(v(w)),pw!=null?sC(v(w)-v(pw)):cell('—','','num'),avg4(w)==null?cell('—','','num'):mC(avg4(w)),pC(avg4(w)>0?v(w)/avg4(w)-1:null)]};});
   const lw=ws[ws.length-1],a4=avg4(lw);
   return {cols:['Week of','Saved','vs week before','4-week avg','vs average'],rows,
    insight:lw!=null?`${lw===wkStart(Date.now())?'So far this week':'Last week shown'}: <b>${money0(v(lw))}</b>${a4?`, ${pctTxt(v(lw)/a4-1)} vs your 4-week average of ${money0(a4)}`:''}.`:'',
    note:'Weeks start on Monday. Most savings land on one day a month, so weekly numbers swing a lot; the 4-week average smooths that out.'+(ws.some(w=>isFM(toYMD(shiftD(w,3)).slice(0,7)))?` ${fmTxt()} is scaled to its real saving of ${money0(startSaving())}.`:''),
    chart:{type:'bar',data:{labels:ws.map(w=>{const d=new Date(w);return `${d.getDate()} ${MON[d.getMonth()]}`;}),datasets:[
      {label:'Saved',data:ws.map(v),backgroundColor:ws.map(w=>v(w)>=0?C.cash:C.debt)},
      {type:'line',label:'4-week average',data:ws.map(avg4),borderColor:C.gold,borderWidth:2,pointRadius:0,tension:.3}]},options:opt()}};
  }},
 {id:'types',src:'mix',grp:'ours',title:'What you hold',desc:'Cash, each gold purity and loans: what you paid and what it is worth today.',years:false,
  build(x){
   const T={},add=(n,p,w,c)=>{const o=T[n]||(T[n]={n:0,p:0,w:0});o.n+=c;o.p+=p;o.w+=w;};
   x.f.forEach(d=>{if(isLoanRow(d))add('Loans',d.usd||0,d.usd||0,1);else if(isGoldRow(d)){const gp=(d.gold||0)*(d.goldPrice||0);add(kOf(d)?`Gold ${kOf(d)}k`:`Gold ${gset().karat}k`,gp,goldNow(d),1);if(d.usd)add('Cash',d.usd,d.usd,0);}else add('Cash',d.usd||0,d.usd||0,1);});
   const names=Object.keys(T).sort((a,b)=>T[b].w-T[a].w),tot=names.reduce((s,n)=>s+T[n].w,0);
   const rows=names.map(n=>{const o=T[n],ch=o.p?o.w/o.p-1:null;return {cat:n.startsWith('Gold')?(kOf({type:n})?n:'Gold'):n==='Loans'?'Loan':'Cash',cells:[cell(`<span class="badge ${n==='Loans'?'loan':n==='Cash'?'cash':'gold'}">${esc(n)}</span>`,n),cell(String(o.n),o.n,'num'),mC(o.p),mC(o.w),pC(n.startsWith('Gold')&&ch!=null&&Math.abs(ch)>1e-9?ch:null),cell(tot?Math.round(o.w/tot*100)+'%':'—',tot?o.w/tot:'','num')]};});
   const pos=names.filter(n=>T[n].w>0);
   return {cols:['Type','Entries','Paid','Worth now','Change','Share'],rows,
    insight:`Net worth today is <b>${money0(tot)}</b>${pos.length?`, ${Math.round(T[pos[0]].w/tot*100)}% in ${pos[0].toLowerCase()}`:''}.`,
    note:'Gold is worth its market value when market pricing is on; everything else is at face value. Loans count as negative. Tap a type to see its entries in the Ledger.',
    chart:{type:'doughnut',data:{labels:pos,datasets:[{data:pos.map(n=>T[n].w),backgroundColor:pos.map(n=>n==='Cash'?C.cash:n.startsWith('Gold')?(n.includes('24')?'#D8B25C':C.gold):'#9AA6B1'),borderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{datalabels:{display:false},legend:{position:'bottom',labels:{boxWidth:12,boxHeight:12,padding:12,font:{size:11}}},tooltip:{callbacks:{label:c=>` ${c.label}: ${money0(c.raw)} (${Math.round(c.raw/tot*100)}%)`}}}}}};
  }},
 {id:'goldpx',src:'mkt',grp:'mkt',title:'Gold price by month',desc:'The 24k price per gram and its move vs last month, last year and the start of the year.',years:'all',
  build(x){
   const all=(window.lgGoldMonthly?window.lgGoldMonthly(allData):[]).filter(r=>r.px),k=gset().karat,list=all.filter(r=>!x.year||r.k.startsWith(x.year));
   if(!list.length)return {cols:['Month'],rows:[],insight:'Add a gold entry to see gold prices here.',note:'',chart:null};
   const tag=r=>r.src==='live'||r.src==='cached'?' · today':(r.est?' *':'');
   const rows=[...list].reverse().map(r=>({cells:[cell(`<strong>${lbl(r.k)}${tag(r)}</strong>`,r.k.replace('-','')),cell(money2(r.px),r.px,'num'),cell(money2(r.px*k/24),r.px*k/24,'num'),pC(r.mom),pC(r.yoy),pC(r.ytd)]}));
   const l=list[list.length-1],f0=list[0];
   return {cols:['Month','24k / g',`${k}k / g`,'vs last month','vs last year','Year to date'],rows,
    insight:`Gold is at <b>${money2(l.px*k/24)}</b> per gram of ${k}k, ${pctTxt(l.px/f0.px-1)} since ${lbl(f0.k)}${l.mom!=null?`, ${pctTxt(l.mom)} on last month`:''}.`,
    note:'Past months use the last dated market close in that month (Standard Bullion); the current month uses the latest Gold-API.com spot quote. A * indicates a cached earlier quote, snapshot, or legacy average rather than a verified close. Historical source: standardbullion.com.',
    chart:{type:'line',data:{labels:list.map(r=>lbl(r.k)),datasets:[
      {label:`${k}k per gram`,data:list.map(r=>r.px*k/24),borderColor:C.gold,backgroundColor:'rgba(185,137,47,0.12)',fill:true,tension:.3,borderWidth:2.4,pointRadius:list.map(r=>r.est?0:2.5)}]},
      options:(()=>{const o=opt();o.scales.y.ticks.callback=v=>'$'+Math.round(v);o.plugins.tooltip.callbacks={label:c=>` ${c.dataset.label}: ${money2(c.raw)}`};return o;})()}};
  }},
 {id:'goldval',src:'mix',grp:'mkt',title:'Your gold: worth vs paid',desc:'Your grams at each month’s market price, against what you paid, with the price effect.',years:'all',
  build(x){
   const list=(window.lgGoldMonthly?window.lgGoldMonthly(allData):[]).filter(r=>r.px&&(!x.year||r.k.startsWith(x.year)));
   if(!list.length)return {cols:['Month'],rows:[],insight:'Add a gold entry to see this view.',note:'',chart:null};
   const rows=[...list].reverse().map(r=>({cells:[cell(`<strong>${lbl(r.k)}</strong>`,r.k.replace('-','')),cell(r.grams.toFixed(1)+' g',r.grams,'num'),mC(r.cost),mC(r.value),pC(r.cost?r.value/r.cost-1:null),r.priceEffect==null?cell('—','','num'):sC(r.priceEffect),r.bought?sC(r.bought):cell('—','','num')]}));
   const l=list[list.length-1],pe=list.reduce((s,r)=>s+(r.priceEffect||0),0);
   return {cols:['Month','Grams','Paid','Worth','Gain','Price effect','Bought'],rows,
    insight:`Your gold is worth <b>${money0(l.value)}</b> against ${money0(l.cost)} paid (${pctTxt(l.value/l.cost-1)}). Price moves ${x.year?`in ${x.year} `:''}added <b>${signed0(pe)}</b>.`,
    note:'Your grams (our data) valued at each month’s close (market data, or a labelled fallback where the Gold tab shows a *), each entry at its own purity. Price effect is the gain or loss on gold you already held; Bought is gold added that month at that month’s price.',
    chart:{type:'bar',data:{labels:list.map(r=>lbl(r.k)),datasets:[
      {type:'line',label:'Worth (market / labelled fallback)',data:list.map(r=>r.value),borderColor:C.cash,borderWidth:2.4,pointRadius:2,tension:.3},
      {type:'line',label:'What you paid',data:list.map(r=>r.cost),borderColor:'#9AA6B1',borderDash:[5,4],borderWidth:1.8,pointRadius:0,stepped:true},
      {label:'Price effect',data:list.map(r=>r.priceEffect||0),backgroundColor:list.map(r=>(r.priceEffect||0)>=0?'rgba(46,125,91,.5)':'rgba(176,67,58,.55)'),yAxisID:'y1'}]},options:opt({y1:true})}};
  }},
 {id:'lots',src:'mix',grp:'mkt',title:'Gold purchases',desc:'Every gold entry with its purity, what you paid and what it is worth today.',years:'all',
  build(x){
   const list=allData.filter(isGoldRow).filter(d=>!x.year||String(d.yyyyMM).startsWith(x.year)).sort((a,b)=>b.sortTs-a.sortTs);
   if(!list.length)return {cols:['Date'],rows:[],insight:'No gold entries yet.',note:'',chart:null};
   let P=0,W=0;
   const rows=list.map(d=>{const p=(d.gold||0)*(d.goldPrice||0),w=goldNow(d),k=kOf(d)||gset().karat;P+=p;W+=w;
     return {id:d.id,cells:[cell(`<strong>${esc((d.date||'').split(' ')[0])}</strong>`,d.sortTs),cell(`<span style="text-transform:capitalize">${esc(d.name)}</span>`,d.name),cell(d.gold.toFixed(2)+' g',d.gold,'num'),cell(k+'k'+(kOf(d)?'':' *'),k,'num'),cell(d.goldPrice?money2(d.goldPrice):'—',d.goldPrice||0,'num'),mC(p),mC(w),pC(p?w/p-1:null)]};});
   const ch=[...list].reverse();
   return {cols:['Date','Who','Grams','Purity','Paid / g','Paid','Worth now','Gain'],rows,
    insight:`${list.length} purchase${list.length>1?'s':''}: paid <b>${money0(P)}</b>, worth <b>${money0(W)}</b> today (${pctTxt(W/P-1)}).`,
    note:'A * on purity means the entry has none, so the default purity is used. Tap a purchase to edit it.',
    chart:{type:'bar',data:{labels:ch.map(d=>(d.date||'').split(' ')[0].slice(0,5)+'/'+String(d.yyyyMM).slice(2,4)),datasets:[
      {label:'Paid',data:ch.map(d=>(d.gold||0)*(d.goldPrice||0)),backgroundColor:'#C9D1D9'},
      {label:'Worth now',data:ch.map(goldNow),backgroundColor:C.gold}]},options:opt()}};
  }}
];
const GRP=[['ours','Our savings','ours'],['mkt','Gold and the market','mkt']];
function xpView(){return XV.find(v=>v.id===XP.id)||XV[0];}
function renderSheet(){
  $('xp-list').innerHTML=GRP.map(([g,l,b])=>`<div class="xp-g">${l} ${badge(b)}</div>`+XV.filter(v=>v.grp===g).map(v=>`<button type="button" class="xp-item${v.id===XP.id?' on':''}" data-id="${v.id}"><div><div class="t">${v.title} ${v.src!==g&&v.src==='mix'?badge('mix'):''}</div><div class="d">${v.desc}</div></div><span class="ck">✓</span></button>`).join('')).join('');
}
function openSheetXP(){renderSheet();$('xp-scrim').hidden=false;$('xp-sheet').hidden=false;document.body.style.overflow='hidden';}
function closeSheetXP(){$('xp-scrim').hidden=true;$('xp-sheet').hidden=true;document.body.style.overflow='';}
$('xp-pick').onclick=openSheetXP;$('xp-scrim').onclick=closeSheetXP;
$('xp-list').addEventListener('click',e=>{const b=e.target.closest('.xp-item');if(!b)return;XP.id=b.dataset.id;XP.year='';xpSave();closeSheetXP();renderExplore();});
const stepXP=n=>{const i=XV.findIndex(v=>v.id===XP.id);XP.id=XV[(i+n+XV.length)%XV.length].id;XP.year='';xpSave();renderExplore();};
$('xp-prev').onclick=()=>stepXP(-1);$('xp-next').onclick=()=>stepXP(1);
$('xp-seg').addEventListener('click',e=>{const b=e.target.closest('button[data-m]');if(!b)return;XP.mode=b.dataset.m;xpSave();renderExplore();});
$('xp-year').onchange=e=>{XP.year=e.target.value;xpSave();renderExplore();};
$('xp-table').addEventListener('click',e=>{
  const tr=e.target.closest('tr.x-tap');if(!tr)return;
  if(tr.dataset.k&&XP.id!=='yoy'){SC.mode='month';SC.sel=tr.dataset.k;renderScore();goView('overview','x-score');}
  else if(tr.dataset.k){SC.mode='month';SC.sel=tr.dataset.k;renderScore();goView('overview','x-score');}
  else if(tr.dataset.y){heroYear=+tr.dataset.y;renderAll();window.scrollTo({top:0,behavior:'smooth'});}
  else if(tr.dataset.cat){LF.who='';LF.year='';LF.cat=tr.dataset.cat;txQuery='';$('tx-search').value='';redrawLedger();goView('ledger','tx-section');}
  else if(tr.dataset.id){const row=allData.find(r=>r.id===tr.dataset.id);if(row)openSheet(row);}
});
function renderExplore(){
  if(!allData.length)return;
  const v=xpView(),f=getFilteredData(),t=computeAnalytics(f);
  if(!t.keys.length)return;
  JF=janF();
  const allT=computeAnalytics(allData),lastAll=allT.keys[allT.keys.length-1];
  const ys=[...new Set(allT.keys.map(k=>k.slice(0,4)))].reverse();
  const cy=String(Math.max(+ys[ys.length-1],Math.min(+ys[0],new Date().getFullYear())));
  if(v.years==='one'){if(!ys.includes(XP.year))XP.year=String(heroYear&&ys.includes(String(heroYear))?heroYear:cy);}
  else if(v.years==='all'){if(XP.year&&!ys.includes(XP.year))XP.year='';}
  else XP.year='';
  const sel=$('xp-year');sel.hidden=!v.years;
  sel.innerHTML=(v.years==='all'?'<option value="">All years</option>':'')+ys.map(y=>`<option value="${y}">${y}</option>`).join('');sel.value=XP.year;
  let pe={};
  if(currentFilter==='all'&&window.lgGoldMonthly){try{window.lgGoldMonthly(allData).forEach(r=>{if(r.priceEffect!=null)pe[r.k]=r.priceEffect;});}catch(e){}}
  const x={f,t,allT,lastAll,year:XP.year,ks:t.keys.filter(k=>!XP.year||k.startsWith(XP.year)),pe,JF,jf:k=>isFM(k)?JF:1};
  let out;try{out=v.build(x);}catch(e){console.error(e);out={cols:['—'],rows:[],insight:'This view could not be built.',note:'',chart:null};}
  $('xp-src').innerHTML=badge(v.src);$('xp-title').textContent=v.title;$('xp-desc').textContent=v.desc;
  $('xp-seg').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.m===XP.mode));
  $('xp-insight').innerHTML=out.insight||'';$('xp-insight').hidden=!out.insight;
  $('xp-note').textContent=out.note||'';
  const showC=XP.mode!=='table'&&!!out.chart,showT=XP.mode!=='chart'||!out.chart;
  $('xp-chartbox').hidden=!showC;$('xp-tablebox').hidden=!showT||!out.rows.length;
  if(charts.xp){charts.xp.destroy();charts.xp=null;}
  if(showC)charts.xp=new Chart($('xp-chart'),out.chart);
  const tb=$('xp-table');tb.style.minWidth=Math.max(360,out.cols.length*96)+'px';
  tb.tHead.innerHTML='<tr>'+out.cols.map((c,i)=>`<th${i?' class="r"':''}>${esc(c)}</th>`).join('')+'</tr>';
  tb.tBodies[0].innerHTML=out.rows.map(r=>`<tr class="${r.k||r.y||r.cat||r.id?'x-tap':''}"${r.k?` data-k="${r.k}"`:''}${r.y?` data-y="${r.y}"`:''}${r.cat?` data-cat="${esc(r.cat)}"`:''}${r.id?` data-id="${esc(r.id)}"`:''}>`+r.cells.map(c=>`<td class="${c.c}" data-v="${c.v==null?'':esc(c.v)}">${c.h}</td>`).join('')+'</tr>').join('');
  applySort('xp-table');
}

/* ---------- Data: your ledger (people, name, target, first month) ---------- */
$('x-sync').insertAdjacentHTML('afterend',`<div class="section" id="x-settings"><div class="section-header"><h2>Your ledger</h2><span class="hint" id="x-set-hint"></span></div><div class="x-set">
 <div class="x-label" style="margin-top:0">Who is saving</div>
 <div class="x-ppl" id="x-ppl"></div>
 <div class="x-addp"><input id="x-newp" class="x-input" autocomplete="off" autocapitalize="words" placeholder="Add a name" aria-label="Add a name"><button type="button" id="x-addp">Add</button></div>
 <label class="x-label" for="x-title-in">Ledger name, shown at the top (optional)</label>
 <input id="x-title-in" class="x-input" autocomplete="off" placeholder="Leave empty to use the names">
 <label class="x-label" for="x-goal-in">Target for your first year, in USD</label>
 <input id="x-goal-in" class="x-input" inputmode="decimal" autocomplete="off" placeholder="For example 30000">
 <p class="x-note">Later years set themselves: last year’s average monthly saving × 12 × 1.2, plus last year’s closing balance.</p>
 <label class="x-label" for="x-start-in">Real saving in your first month<span id="x-start-m"></span> (optional)</label>
 <input id="x-start-in" class="x-input" inputmode="decimal" autocomplete="off" placeholder="Leave empty if it was a normal month">
 <p class="x-note">If your first month also holds savings you already had, type what you really saved that month. Year-over-year, averages and best-month figures then use it, so later years are compared fairly.</p>
</div></div>`);
const st4=document.createElement('style');
st4.textContent=`.x-ppl{display:flex;flex-wrap:wrap;gap:8px}
.x-pchip{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:999px;padding:6px 6px 6px 12px;font-size:14px;font-weight:600;background:var(--card)}
.x-pchip i{width:10px;height:10px;border-radius:3px}
.x-pchip button{border:0;background:#F1F4F7;border-radius:999px;font:600 12px "IBM Plex Sans",sans-serif;color:var(--ink-2);padding:5px 10px;cursor:pointer}
.x-addp{display:flex;gap:8px;margin-top:10px}.x-addp .x-input{flex:1;min-width:0}
.x-addp button{font:600 14px "IBM Plex Sans",sans-serif;padding:0 18px;border-radius:12px;border:1px solid var(--ink);background:var(--ink);color:#fff;cursor:pointer}`;
document.head.appendChild(st4);
function renderSettings(){
  const P=people();
  $('x-ppl').innerHTML=P.length?P.map((p,i)=>`<span class="x-pchip"><i style="background:${pcol(i)}"></i>${esc(p)}<button type="button" data-ren="${i}">Rename</button><button type="button" data-rm="${i}" aria-label="Remove ${esc(p)}">✕</button></span>`).join('')
    :'<span class="x-note" style="margin:0">No names yet. Add the people who save into this ledger.</span>';
  const a=document.activeElement&&document.activeElement.id;
  if(a!=='x-title-in')$('x-title-in').value=CFG.title||'';
  if(a!=='x-goal-in')$('x-goal-in').value=CFG.goal>0?String(CFG.goal):'';
  if(a!=='x-start-in')$('x-start-in').value=startSaving()==null?'':String(startSaving());
  const fmk=firstMonth();$('x-start-m').textContent=fmk?`, ${fk(fmk)}`:'';
  $('x-set-hint').textContent=cfg()?(shared.ok===false?'on this phone only: update the ledger script':(shared.ok?(isDirty()?'saving to your ledger…':'saved in your ledger'):'')):'saved on this phone';
}
function cfgChanged(){renderAll();}
$('x-addp').onclick=()=>{const n=addPerson($('x-newp').value);if(n){$('x-newp').value='';toast(`${n} added`,false);cfgChanged();}};
$('x-newp').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('x-addp').click();}});
$('x-ppl').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  const P=[...people()],i=+(b.dataset.ren!=null?b.dataset.ren:b.dataset.rm),old=P[i];if(old==null)return;
  const n=allData.filter(r=>ownerKey(r.name)===ownerKey(old)).length;
  if(b.dataset.rm!=null){
    if(n){toast(`${old} has ${n} entr${n>1?'ies':'y'}. Rename instead, or delete those entries first.`);return;}
    P.splice(i,1);saveCfg({people:P});cfgChanged();return;
  }
  const nn=String(prompt(`New name for ${old}`,old)||'').trim().replace(/\s+/g,' ');
  if(!nn||nn===old)return;
  if(/loan/i.test(nn)||!ownerKey(nn)){toast('That name cannot be used.');return;}
  if(P.some((p,j)=>j!==i&&ownerKey(p)===ownerKey(nn))){toast('That name is already in the list.');return;}
  if(n){snapshot();allData.forEach(r=>{if(ownerKey(r.name)===ownerKey(old))r.name=nn.toLowerCase()+(isLoanName(r.name)?' - loan':'');});}
  P[i]=nn;saveCfg({people:P});if(n){save();status();}cfgChanged();toast(`Renamed to ${nn}${n?` in ${n} entr${n>1?'ies':'y'}`:''}`,!!n);
});
/* ---------- notifications ----------
   Five alerts, each worked out on the phone from the ledger itself. They appear as cards at the top of Overview and,
   once notifications are allowed, as system notifications whenever the app is open or is brought back.
   A notification while the app is fully closed needs a push server; the calendar reminders cover the two dated ones without one. */
const NKEY='lg-notes-v1',DKEY='lg-delivery-v1';
const NTYPES=[['report','Monthly report is ready','On the 1st, with the month’s saving, net worth and goal.'],
 ['partner','Someone else added an entry','As soon as their entry reaches this phone.'],
 ['nudge','Nothing saved yet this month','A reminder on the day you choose, with what the goal needs.'],
 ['goal','Goal milestones','When you pass 25%, 50%, 75%, 90% and 100% of the year’s target. Shown when you open the app.'],
 ['gold','Gold moves 3% or more','Only if you hold gold, with what it did to its value.']];
function deliveryPrefs(){const d={push:true,hour:9,nudgeDay:10,report:true,partner:true,nudge:true,goal:true,gold:true};try{return Object.assign(d,JSON.parse(localStorage.getItem(DKEY)||'{}')||{});}catch(e){return d;}}
function saveDelivery(p){try{localStorage.setItem(DKEY,JSON.stringify(Object.assign(deliveryPrefs(),p)));}catch(e){}if(window.lgCfgChanged)window.lgCfgChanged();}
const nget=()=>{try{return JSON.parse(localStorage.getItem(NKEY)||'null');}catch(e){return null;}};
const nset=o=>{try{localStorage.setItem(NKEY,JSON.stringify(o));}catch(e){}};
const canNotify=()=>('Notification' in window)&&('serviceWorker' in navigator);
const isIOS=()=>/iPhone|iPad|iPod/.test(navigator.userAgent);
/* ----- real push, sent by the ledger script: works with the app closed -----
   The script holds a key pair. This phone subscribes with the public half and tells the script where to knock.
   The knock carries no data; the service worker then asks the ledger what to show. */
const DEVK='lg-dev-v1',PSENT='lg-push-sent',PON='lg-push-on';
window.lgDev=(()=>{let d='';try{d=localStorage.getItem(DEVK)||'';if(!d){d='d'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);localStorage.setItem(DEVK,d);}}catch(e){}return d;})();
const pushState={key:''};
/* never wait forever for a service worker that is not there */
const swReady=()=>Promise.race([navigator.serviceWorker.ready,new Promise(r=>setTimeout(()=>r(null),3000))]);
const pushOn=()=>{try{return localStorage.getItem(PON)==='1'&&('Notification' in window)&&Notification.permission==='granted';}catch(e){return false;}};
const b64uBytes=s=>{const b=atob(String(s).replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((String(s).length+3)%4)),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;};
const bytesB64u=buf=>{const u=new Uint8Array(buf);let s='';for(let i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');};
async function swCfg(on){
  try{if(!('caches' in window))return;const c=await caches.open('lg-push-cfg'),k=new Request('./__push-cfg');
    const s=on?cfg():null;if(!s||!s.url){await c.delete(k);return;}
    const want=JSON.stringify({url:s.url,token:s.token,dev:window.lgDev});
    const have=await c.match(k);if(have&&await have.text()===want)return;
    await c.put(k,new Response(want,{headers:{'Content-Type':'application/json'}}));
  }catch(e){}
}
async function pushEnsure(key){
  if(!key||!canNotify()||!('PushManager' in window)||Notification.permission!=='granted'||!deliveryPrefs().push)return '';
  const reg=await swReady();if(!reg||!reg.pushManager)throw new Error('the app is not installed yet');
  let sub=await reg.pushManager.getSubscription();
  if(sub){let have='';try{have=bytesB64u(sub.options.applicationServerKey);}catch(e){}
    if(have&&have!==key){try{await sub.unsubscribe();}catch(e){}sub=null;}}
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64uBytes(key)});
  return sub?sub.endpoint:'';
}
/* called on every sync, with the ledger's reply: returns what to tell the ledger, or nothing when it already knows */
window.lgPush=async reply=>{
  try{
    const key=(reply&&reply.push&&reply.push.key)||'';pushState.key=key;
    await swCfg(true);
    if(!key){try{localStorage.removeItem(PON);}catch(e){}return null;}
    let endpoint='';try{endpoint=await pushEnsure(key);}catch(e){pushState.err=String(e&&e.message||e);}
    const c=cfg(),info={dev:window.lgDev,endpoint,prefs:deliveryPrefs(),app:location.origin+location.pathname},sg=JSON.stringify(info)+'|'+(c&&c.url||'');
    if(!endpoint&&!localStorage.getItem(PSENT))return null;
    if(localStorage.getItem(PSENT)===sg)return null;
    return {info,sg};
  }catch(e){return null;}
};
window.lgPushDone=(pp,ans)=>{try{
  if(pp.info.endpoint&&ans&&ans.push===true){localStorage.setItem(PSENT,pp.sg);localStorage.setItem(PON,'1');}
  else{localStorage.removeItem(PON);if(!pp.info.endpoint)localStorage.removeItem(PSENT);}
  drawDelivery();}catch(e){}};
window.lgPushOff=async()=>{
  let had=false;try{had=!!localStorage.getItem(PSENT);}catch(e){}
  if(had&&cfg()){try{await api('POST',{rows:[],dev:window.lgDev,push:{dev:window.lgDev,endpoint:''}});}catch(e){}}
  try{localStorage.removeItem(PSENT);localStorage.removeItem(PON);}catch(e){}
  try{const c=await caches.open('lg-push-cfg');await c.delete(new Request('./__push-cfg'));}catch(e){}
  if(had)swReady().then(reg=>reg&&reg.pushManager.getSubscription()).then(sub=>sub&&sub.unsubscribe()).catch(()=>{});
};
$('x-settings').insertAdjacentHTML('beforeend',`<div class="x-set" id="x-delivery" style="margin-top:14px">
 <div class="x-label" style="margin-top:0">Notifications on this phone</div>
 <p class="x-note" id="x-push-state" style="margin-top:0"></p>
 <div class="x-btns" style="margin-top:8px"><button type="button" id="x-push-on">Allow notifications</button><button type="button" id="x-push-test">Send a test</button></div>
 <div id="x-push-list" style="margin-top:12px">${NTYPES.map(([id,l,s])=>`<label class="x-nrow"><input type="checkbox" data-n="${id}"><span><b>${l}</b><em>${s}</em></span></label>`).join('')}</div>
 <label class="x-label" for="x-nudge-day">Remind me if nothing is saved by the</label>
 <select class="x-input" id="x-nudge-day">${[5,10,15,20,25].map(d=>`<option value="${d}">${d}th of the month</option>`).join('')}</select>
 <div class="x-label">When the app is closed</div>
 <p class="x-note" id="x-push-closed" style="margin-top:0"></p>
 <div class="x-btns" style="margin-top:8px"><button type="button" id="x-cal">Add reminders to my calendar instead</button></div>
 <p id="x-push-result" class="x-note" role="status"></p></div>`);
const stn=document.createElement('style');
stn.textContent=`.x-nrow{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--line);cursor:pointer}
.x-nrow:last-child{border-bottom:0}.x-nrow input{width:20px;height:20px;margin:1px 0 0;flex:0 0 20px;accent-color:var(--ink)}
.x-nrow b{display:block;font-size:14px;font-weight:600}.x-nrow em{display:block;font-style:normal;font-size:12px;color:var(--muted);margin-top:1px}
#x-notes{display:flex;flex-direction:column;gap:8px;margin:0 0 14px}
.x-note-c{display:flex;align-items:flex-start;gap:10px;background:#FBF6EA;border:1px solid var(--gold);border-radius:14px;padding:11px 8px 11px 14px}
.x-note-c div{flex:1;min-width:0;cursor:pointer}.x-note-c b{display:block;font-size:14px}.x-note-c span{display:block;font-size:12.5px;color:var(--ink-2);margin-top:2px;line-height:1.4}
.x-note-c button{flex:0 0 auto;border:0;background:none;color:var(--muted);font-size:15px;padding:4px 8px;cursor:pointer}`;
document.head.appendChild(stn);
$('x-tabs').insertAdjacentHTML('afterend','<div id="x-notes" hidden></div>');
function drawDelivery(){
  const p=deliveryPrefs(),st=$('x-push-state');
  $('x-push-list').querySelectorAll('input[data-n]').forEach(c=>{c.checked=p[c.dataset.n]!==false;});
  $('x-nudge-day').value=String(p.nudgeDay||10);
  let t,on=false;
  if(!canNotify())t=isIOS()&&!navigator.standalone?'To get notifications on iPhone, add this app to your Home Screen (Share, then Add to Home Screen) and open it from there. Until then the alerts show as cards at the top of Overview.':'This browser does not support notifications. The alerts show as cards at the top of Overview.';
  else if(Notification.permission==='granted'){t=pushOn()?'Push is on. Alerts reach this phone even when the app is closed.':'Notifications are allowed on this phone.';on=true;}
  else if(Notification.permission==='denied')t='Notifications are blocked for this app in your phone’s settings. The alerts still show as cards at the top of Overview.';
  else t='Allow notifications to get the alerts below on this phone. They also show as cards at the top of Overview.';
  st.textContent=t;$('x-push-on').hidden=on||!canNotify()||Notification.permission==='denied';$('x-push-test').hidden=!on;
  const c=$('x-push-closed');
  if(pushOn())c.textContent='Your ledger sends the alerts itself, through your Google Sheet: the report on the 1st, the reminder, new entries from someone else, and gold moves. Entries arrive within seconds, the others within the hour. Nothing about your savings passes through Apple’s or Google’s push servers; they only carry a signal to wake the app.';
  else if(!cfg())c.textContent='Sign in to a ledger and allow notifications: the ledger then sends the alerts to this phone even when the app is closed.';
  else if(shared.ok!=null&&!(shared.api>=4))c.textContent='To get alerts while the app is closed, update the ledger script (Code.gs) to version 4 and run its “setup” once. Until then alerts show when you open the app.';
  else if(!on)c.textContent='Allow notifications above: your ledger then sends the alerts to this phone even when the app is closed.';
  else c.textContent=pushState.err?('This phone could not subscribe to push: '+pushState.err+'. On iPhone the app must be opened from the Home Screen (iOS 16.4 or later).'):'Setting up push with your ledger… this finishes at the next sync.';
}
$('x-push-list').addEventListener('change',e=>{const c=e.target.closest('input[data-n]');if(c){saveDelivery({[c.dataset.n]:c.checked});toast('Saved',false);}});
$('x-nudge-day').onchange=e=>{saveDelivery({nudgeDay:+e.target.value});toast('Saved',false);};
async function showSys(n){
  try{
    if(!canNotify()||Notification.permission!=='granted'||!deliveryPrefs().push)return false;
    if(pushOn()&&/^(report|partner|nudge|gold)-/.test(n.id))return false;   /* the ledger sends these itself: no doubles */
    const reg=await swReady();if(!reg)return false;
    await reg.showNotification(n.title,{body:n.body,icon:'icon-192.png',badge:'icon-192.png',tag:'lg-'+n.id,data:{url:location.origin+location.pathname+(n.hash||'')}});
    return true;
  }catch(e){return false;}
}
$('x-push-on').onclick=async()=>{
  try{const r=await Notification.requestPermission();drawDelivery();
    if(r==='granted'){
      try{if(pushState.key)await pushEnsure(pushState.key);}catch(e){pushState.err=String(e&&e.message||e);}
      if(cfg()){await sync({manual:true});drawDelivery();}
      if(!pushOn())await showSys({id:'hello',title:'Notifications are on',body:'You will hear from your ledger here.'});
      else $('x-push-result').textContent='Push is on. Tap “Send a test”, then close the app to see it arrive.';
      runNotes();}
    else $('x-push-result').textContent='Not allowed. You can change this later in your phone’s settings.';
  }catch(e){$('x-push-result').textContent='Could not ask for permission: '+e.message;}
};
$('x-push-test').onclick=async()=>{
  if(pushOn()&&cfg()){
    $('x-push-result').textContent='Asking your ledger to send it…';
    try{const a=await api('POST',{rows:[],dev:window.lgDev,pushTest:true});
      $('x-push-result').textContent=a&&a.test==='sent'?'Sent by your ledger. It arrives in a few seconds. Try again and close the app straight away to see it arrive with the app closed.':'Your ledger does not know this phone yet. Tap Sync now on the Data tab, then try again.';}
    catch(e){$('x-push-result').textContent='Could not reach your ledger: '+errText(e);}
    return;
  }
  const lc=lastClosedMonth(),ok=await showSys(lc?reportNote(lc):{id:'test',title:'Savings Ledger',body:'This is what an alert looks like.'});
  $('x-push-result').textContent=ok?'Sent. If you do not see it, check that notifications for this app are allowed in your phone’s settings.':'Could not send it. Allow notifications first.';
};
/* reminders in the phone's own calendar: these fire with the app closed, with no server */
$('x-cal').onclick=async()=>{
  const p=deliveryPrefs(),url=location.origin+location.pathname,z=n=>String(n).padStart(2,'0'),now=new Date();
  const stamp=`${now.getUTCFullYear()}${z(now.getUTCMonth()+1)}${z(now.getUTCDate())}T${z(now.getUTCHours())}${z(now.getUTCMinutes())}00Z`;
  const next=d=>{const x=new Date(now.getFullYear(),now.getMonth(),d,p.hour||9);if(x<=now)x.setMonth(x.getMonth()+1);return `${x.getFullYear()}${z(x.getMonth()+1)}${z(x.getDate())}T${z(x.getHours())}0000`;};
  const ev=(uid,day,sum,desc,link)=>['BEGIN:VEVENT',`UID:${uid}@savings-ledger`,`DTSTAMP:${stamp}`,`DTSTART:${next(day)}`,'DURATION:PT15M',`RRULE:FREQ=MONTHLY;BYMONTHDAY=${day}`,`SUMMARY:${sum}`,`DESCRIPTION:${desc} ${link}`,`URL:${link}`,'BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${sum}`,'TRIGGER:PT0M','END:VALARM','END:VEVENT'];
  const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Savings Ledger//EN','CALSCALE:GREGORIAN',
    ...ev('report',1,'Your savings report is ready','Open last month’s report:',url+'#report=last'),
    ...ev('nudge',p.nudgeDay||10,'Add this month’s savings','Open the ledger:',url),'END:VCALENDAR'].join('\r\n');
  const file=new File([ics],'savings-ledger-reminders.ics',{type:'text/calendar'});
  try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:'Savings Ledger reminders'});$('x-push-result').textContent='Choose Calendar to add the two monthly reminders.';return;}}catch(e){if(e&&e.name==='AbortError')return;}
  const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=file.name;document.body.appendChild(a);a.click();a.remove();
  $('x-push-result').textContent='Open the downloaded file to add the two monthly reminders to your calendar.';
};
/* the inbox of alerts, on Overview */
function renderNotes(){
  const el=$('x-notes'),s=nget(),list=(s&&s.inbox)||[];
  if(!list.length||!allData.length||$('hero').hidden||view!=='overview'){el.hidden=true;el.innerHTML='';return;}
  el.hidden=false;
  el.innerHTML=list.slice(0,3).map(n=>`<div class="x-note-c" data-id="${esc(n.id)}"><div><b>${esc(n.title)}</b><span>${esc(n.body)}</span></div><button type="button" aria-label="Dismiss">✕</button></div>`).join('');
}
$('x-notes').addEventListener('click',e=>{
  const c=e.target.closest('.x-note-c');if(!c)return;
  const s=nget()||{},n=(s.inbox||[]).find(x=>x.id===c.dataset.id);
  s.inbox=(s.inbox||[]).filter(x=>x.id!==c.dataset.id);nset(s);renderNotes();
  if(e.target.closest('button')||!n)return;
  const m=/^#report=(\d{4}-\d{2})$/.exec(n.hash||'');
  if(m)openReport(m[1]);else if(n.view)goView(n.view);
});
function fire(s,n){
  s.inbox=[Object.assign({at:Date.now()},n),...(s.inbox||[]).filter(x=>x.id!==n.id)].slice(0,6);
  showSys(n);
}
function reportNote(k){
  const D=reportData(k),c=D.check,t=computeAnalytics(allData),R=mRange(k),path=pathFor(R.y,t),cb=cumAt(t,k),gap=path?cb-path.at(k):null;
  return {id:'report-'+k,title:`Your ${fk(k)} report is ready`,hash:'#report='+k,
    body:`Saved ${money0(c.saved)} · net worth ${money0(c.net)}${gap==null?'':` · ${money0(Math.abs(gap))} ${gap>=0?'ahead of':'behind'} your goal`}. Tap to open it.`};
}
let partnerQueue=[];
function notePartner(arrived){
  if(!arrived.length||arrived.length>12||!deliveryPrefs().partner)return;
  const recent=arrived.filter(r=>Date.now()-(+r.updated||0)<3*86400000);
  if(recent.length)partnerQueue.push(...recent);
}
function runNotes(){
  if(!allData.length)return;
  const p=deliveryPrefs(),nk=nowKey(),now=new Date();
  let s=nget();const firstRun=!s;if(!s)s={inbox:[]};
  const t=computeAnalytics(allData),y=now.getFullYear(),path=pathFor(y,t),cb=cumAt(t,nk);
  /* 1. monthly report */
  const lc=lastClosedMonth();
  if(p.report&&lc&&lc<nk&&(s.report||'')<lc){
    let seen='';try{seen=localStorage.getItem('lg-report-seen')||'';}catch(e){}
    if(seen<lc)showSys(reportNote(lc));   /* on screen, the report card at the top of Overview already says it */
    s.report=lc;
  }
  /* 2. entries from another phone */
  if(partnerQueue.length){
    const q=partnerQueue;partnerQueue=[];
    const who=[...new Set(q.map(r=>cap(ownerKey(r.name))||'Someone'))];
    const what=r=>isLoanRow(r)?`a loan entry of ${money0(Math.abs(r.usd||0))}`:(r.gold>0?`${r.gold} g of gold`:`${(r.usd||0)<0?'a withdrawal of ':''}${money0(Math.abs(r.usd||0))}`);
    fire(s,{id:'partner-'+q[0].id,view:'ledger',title:q.length===1?`${who[0]} added ${what(q[0])}`:`${q.length} new entries from ${who.join(' and ')}`,
      body:q.length===1?`Dated ${(q[0].date||'').split(' ')[0]}. Net worth is now ${money0(t.net)}.`:`Together ${signed0(q.reduce((a,r)=>a+rowAmt(r),0))}. Net worth is now ${money0(t.net)}.`});
  }
  /* 3. nothing saved yet this month */
  {const R0=mRange(nk);if(s.inbox&&allData.some(d=>d.sortTs>=R0.a&&d.sortTs<R0.b&&!isLoanRow(d)&&rowAmt(d)>0))s.inbox=s.inbox.filter(x=>x.id!=='nudge-'+nk);}
  if(p.nudge&&now.getDate()>=(p.nudgeDay||10)&&(s.nudge||'')<nk&&firstMonth()<nk){
    const R=mRange(nk),any=allData.some(d=>d.sortTs>=R.a&&d.sortTs<R.b&&!isLoanRow(d)&&rowAmt(d)>0);
    if(!any){
      const left=12-now.getMonth(),need=path?(path.goal-cb)/left:null;
      fire(s,{id:'nudge-'+nk,title:`Nothing saved yet in ${fk(nk)}`,body:need>0?`Staying on your goal needs about ${money0(need)} a month for the ${left} month${left>1?'s':''} left.`:'Add this month’s savings when you have a minute.'});
      s.nudge=nk;
    }
  }
  /* 4. goal milestones */
  if(path&&path.goal>0){
    const pct=cb/path.goal*100,step=[100,90,75,50,25].find(x=>pct>=x)||0;s.goal=s.goal||{};
    if(firstRun||s.goal[y]==null)s.goal[y]=step;
    else if(step>s.goal[y]){
      if(p.goal)fire(s,{id:`goal-${y}-${step}`,title:step>=100?`You reached your ${y} target`:`You passed ${step}% of your ${y} target`,
        body:step>=100?`${money0(cb)} against a target of ${money0(path.goal)}. Well done.`:`${money0(cb)} of ${money0(path.goal)}, with ${money0(path.goal-cb)} to go.`});
      s.goal[y]=step;
    }else if(step<s.goal[y])s.goal[y]=step;
  }
  /* 5. gold moves */
  const g=gset(),px=px24();
  if(px>0&&goldPriceFresh(g)&&t.goldGrams>0){
    if(!s.goldPx||firstRun){s.goldPx=px;s.goldAt=Date.now();}
    else{const mv=px/s.goldPx-1;
      if(Math.abs(mv)>=0.03){
        if(p.gold){const d=new Date(s.goldAt||Date.now()),dv=t.gold-t.gold/(1+mv);
          fire(s,{id:'gold-'+toYMD(Date.now()),view:'gold',title:`Gold is ${mv>=0?'up':'down'} ${Math.abs(mv*100).toFixed(1)}% since ${d.getDate()} ${MON[d.getMonth()]}`,body:`Your gold is worth ${money0(t.gold)}, ${signed0(dv)} from the move.`});}
        s.goldPx=px;s.goldAt=Date.now();
      }}
  }
  nset(s);renderNotes();
}
window.lgRunNotes=runNotes;
drawDelivery();
document.addEventListener('visibilitychange',()=>{if(!document.hidden){drawDelivery();setTimeout(()=>{try{runNotes();}catch(e){}},1500);}});
setTimeout(()=>{try{runNotes();}catch(e){console.error(e);}},2500);
$('x-title-in').onchange=e=>{saveCfg({title:e.target.value.trim()});cfgChanged();};
$('x-goal-in').onchange=e=>{saveCfg({goal:num(e.target.value)});cfgChanged();toast('Target saved',false);};
$('x-start-in').onchange=e=>{const v=e.target.value.trim();saveCfg({startSaving:v===''?null:num(v)});cfgChanged();toast('Saved',false);};

/* ---------- source labels on the classic sections ---------- */
[['x-score','ours'],['x-insight','mix'],['charts-section','ours'],['bridge-section','ours'],['insights-section','ours'],['trends-section','ours'],['variance-section','ours'],['tx-section','ours'],['x-gold','mkt'],['x-goldhist','mix']].forEach(([id,k])=>tagSection(id,k));

/* ---------- monthly report: one month in full, on screen and as a PDF made on the phone ---------- */
const mRange=k=>{const [y,m]=k.split('-').map(Number);return {a:new Date(y,m-1,1).getTime(),b:new Date(y,m,1).getTime(),y,m};};
const pS=v=>v==null?'n/a':`${v>=0?'+':'−'}${Math.abs(v*100).toFixed(1)}%`;
const tone=v=>v==null?'':(v>=0?'pos':'neg');
const tc=(t,tn)=>({t,tone:tn||''});
function lastClosedMonth(){
  const nk=nowKey(),fmk=firstMonth();if(!fmk)return null;
  const pk=addMonths(nk,-1);return pk>=fmk?pk:fmk;
}
function reportMonths(){
  const fmk=firstMonth();if(!fmk)return [];
  const out=[];for(let k=nowKey();k>=fmk;k=addMonths(k,-1))out.push(k);return out;
}
/* what is held at the end of month k: cash, gold at what was paid, gold at that month's price, loans */
function holdAt(rows,endTs,k,gmAll){
  let cash=0,loan=0,cost=0,grams=0;
  rows.forEach(d=>{if(!(d.sortTs<endTs))return;if(isLoanRow(d))loan-=d.usd||0;else{cash+=d.usd||0;cost+=(d.gold||0)*(d.goldPrice||0);grams+=d.gold||0;}});
  let g=null;if(grams>0){for(const r of gmAll){if(r.k<=k)g=r;else break;}}
  const market=gset().mode==='market'&&g&&g.px;
  const worth=grams>0?(market?g.value:cost):0;
  return {cash,loan,cost,grams,worth,net:cash+worth-loan,g:market?g:null};
}
function reportData(k){
  const rows=allData,t=computeAnalytics(rows),PP=people();
  JF=janF();
  const R=mRange(k),pk=addMonths(k,-1),lk=addMonths(k,-12),Rp=mRange(pk),Rl=mRange(lk);
  const first=Math.min(...rows.map(r=>r.sortTs).filter(Boolean));
  const C0=bucket(rows,R.a,R.b),P0=bucket(rows,Rp.a,Rp.b),L0=bucket(rows,Rl.a,Rl.b),hasPrev=Rp.b>first,hasLy=Rl.b>first;
  const y0=new Date(R.y,0,1).getTime(),Y0=bucket(rows,y0,R.b),YL=bucket(rows,new Date(R.y-1,0,1).getTime(),new Date(R.y-1,R.m,1).getTime()),hasYL=new Date(R.y-1,R.m,1).getTime()>first;
  const path=pathFor(R.y,t),cb=cumAt(t,k),gr=path?goalRatio(R.y,path,t,k,cb):null,gap=path?cb-path.at(k):null;
  const label=fk(k),partial=k===nowKey();
  const mom=hasPrev?pcOf(C0.saved,P0.saved):null,yoy=hasLy?pcOf(C0.saved,L0.saved):null,ytdYoy=hasYL?pcOf(Y0.saved,YL.saved):null;
  /* one set of figures for the screen and the PDF */
  let gmAll=[];try{gmAll=goldMonthly(rows)||[];}catch(e){}
  const H=holdAt(rows,R.b,k,gmAll),Hp=holdAt(rows,Rp.b,pk,gmAll),Hl=holdAt(rows,Rl.b,lk,gmAll);
  const {cash,loan,grams}=H,goldCost=H.cost,goldW=H.worth,net=H.net,gm=H.g,kk=gset().karat;
  let dep=0,goldIn=0,goldInG=0,loanMove=0;
  rows.forEach(d=>{if(!(d.sortTs>=R.a&&d.sortTs<R.b))return;if(isLoanRow(d))loanMove+=d.usd||0;else{dep+=d.usd||0;goldIn+=(d.gold||0)*(d.goldPrice||0);goldInG+=d.gold||0;}});
  const priceEff=(goldW-Hp.worth)-goldIn;                  /* what the price alone did, so the bridge always adds up */
  const est=!!(gm&&gm.est);
  const D={k,label,partial,title:appTitle(),sections:[]};
  D.sub=`${partial?'Month in progress, figures so far. ':''}Prepared ${fd(Date.now())}.`;
  D.check={net,open:Hp.net,dep,goldIn,loanMove,priceEff,goldW,goldCost,cash,loan,saved:C0.saved,ytd:Y0.saved};
  /* headline tiles */
  const gainG=goldW-goldCost;
  D.sections.push({type:'tiles',tiles:[
    {l:`Saved in ${label}`,v:money0(C0.saved),s:hasPrev?`${pS(mom)} vs ${fk(pk)} (${money0(P0.saved)})`:'first month of the ledger',tone:tone(mom)},
    {l:`Saved in ${R.y} so far`,v:money0(Y0.saved),s:hasYL?`${pS(ytdYoy)} vs the same months of ${R.y-1}`:`no ${R.y-1} to compare with`,tone:tone(ytdYoy)},
    {l:`Net worth, end of ${label}`,v:money0(net),s:hasPrev?`${signed0(net-Hp.net)} in the month`:`cash ${money0(cash)}${grams>0?` · gold ${money0(goldW)}`:''}`,tone:hasPrev?tone(net-Hp.net):''},
    {l:'Against the phased goal',v:gr==null?'n/a':pS(gr),s:path?`${signed0(gap)} vs the path · target ${money0(path.goal)}`:'no target set for this year',tone:tone(gr)},
    grams>0?{l:`Gold, ${grams.toFixed(1)} g`,v:money0(goldW),s:gm?`${signed0(gainG)} on what you paid${est?' · estimated price':''}`:'valued at what you paid',tone:gm?tone(gainG):''}
           :{l:'Cash',v:money0(cash),s:loan>0.5?`loans −${money0(loan)}`:'no gold, no loans',tone:''},
    {l:'Against last year',v:hasLy?pS(yoy):'n/a',s:hasLy?`${fk(lk)}: ${money0(L0.saved)}`:`no ${fk(lk)} in the ledger`,tone:tone(yoy)}]});
  /* what stands out */
  const ins=[];
  const prev6=[];for(let i=1;i<=6;i++){const m2=addMonths(k,-i);if(t.comp[m2])prev6.push(t.comp[m2].delta*(isFM(m2)?JF:1));}
  if(prev6.length>=2){const a=prev6.reduce((s,x)=>s+x,0)/prev6.length;if(a>0)ins.push(`You saved ${money0(C0.saved)} in ${label}, ${pS(C0.saved/a-1)} against your ${prev6.length}-month average of ${money0(a)}.`);}
  const tp=PP.map((p,i)=>[p,C0.p[i]]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]),tps=tp.reduce((s,x)=>s+x[1],0);
  if(tp.length>1)ins.push(tp.map(([p,x])=>`${p} put in ${money0(x)} (${Math.round(x/tps*100)}%)`).join(', ')+'.');
  else if(tp.length===1)ins.push(`${tp[0][0]} put in all ${money0(tp[0][1])} of the month's deposits.`);
  if(Math.abs(loanMove)>0.5)ins.push(`Loans ${loanMove<0?'took':'gave back'} ${money0(Math.abs(loanMove))} this month, so the month's saving is ${money0(C0.saved)} after ${money0(tps)} of deposits.`);
  if(hasYL&&ytdYoy!=null)ins.push(`Year to date you saved ${money0(Y0.saved)}, ${pS(ytdYoy)} against ${money0(YL.saved)} by ${MON[R.m-1]} ${R.y-1}.`);
  if(path&&gap!=null){
    const left=Math.max(0,12-R.m),need=left>0?(path.goal-cb)/left:0;
    ins.push(gap>=0?`You are ${money0(gap)} ahead of the path to ${money0(path.goal)} by December ${R.y}.`
      :`You are ${money0(-gap)} behind the path to ${money0(path.goal)}.${left>0?` Landing on target needs ${money0(need)} a month for the ${left} month${left>1?'s':''} left.`:''}`);
  }
  if(gm&&hasPrev&&Hp.grams>0&&Math.abs(priceEff)>0.5)ins.push(`The gold price ${priceEff>=0?'added':'took off'} ${money0(Math.abs(priceEff))} ${priceEff>=0?'to':'from'} your gold${gm.mom!=null?` (gold ${pS(gm.mom)} on the month)`:''}${est?', on an estimated price':''}.`);
  const ents=rows.filter(d=>d.sortTs>=R.a&&d.sortTs<R.b&&Math.abs(rowAmt(d))>0.005).sort((a,b)=>a.sortTs-b.sortTs);
  if(ents.length){const big=ents.reduce((a,d)=>Math.abs(rowAmt(d))>Math.abs(rowAmt(a))?d:a,ents[0]);ins.push(`${ents.length} entr${ents.length>1?'ies':'y'} this month. The largest was ${money0(Math.abs(rowAmt(big)))} from ${cap(ownerKey(big.name))||'an unnamed entry'} on ${(big.date||'').split(' ')[0]}.`);}
  else ins.push('No entries were recorded this month.');
  D.sections.push({type:'insights',title:'What stands out',items:ins});
  /* bridge: opening + what you did + what the gold price did = closing, to the dollar */
  if(hasPrev){
    const br=[[`Net worth, end of ${fk(pk)}`,money0(Hp.net)],['Cash put in, less withdrawals',tc(signed0(dep),tone(dep))]];
    if(Math.abs(goldIn)>0.5)br.push([`Gold bought, ${goldInG.toFixed(2)} g at what you paid`,tc(signed0(goldIn),'pos')]);
    if(Math.abs(loanMove)>0.5)br.push(['Loans: taken (−), repaid (+)',tc(signed0(loanMove),tone(loanMove))]);
    if(grams>0&&gm)br.push([`Gold price change${est?' (estimate)':''}`,tc(signed0(priceEff),tone(priceEff))]);
    br.push([`Net worth, end of ${label}`,money0(net)]);
    D.sections.push({type:'table',title:`How your net worth moved in ${label}`,cols:[['',0],['',1]],rows:br,boldLast:true,
      note:`The first lines add up to what you saved in the month (${money0(dep+goldIn+loanMove)}).${grams>0&&gm?' Gold price change is the rise or fall in the value of your gold beyond what you paid for it.':''}`});
  }
  /* charts */
  if(path){
    const ax=[];for(let i=0;i<=path.span;i++)ax.push(addMonths(path.firstKey,i));
    const fy=+t.keys[0].slice(0,4);
    D.sections.push({type:'chart',title:`Net worth against the phased goal, ${R.y}`,cfg:{type:'line',data:{labels:ax.map((m2,i)=>i===0&&R.y>fy?`Dec ’${String(R.y-1).slice(2)}`:lbl(m2)),datasets:[
      {label:'Net worth',data:ax.map(m2=>m2<=k?cumAt(t,m2):null),borderColor:C.cash,backgroundColor:'rgba(47,93,138,0.10)',fill:true,tension:.3,borderWidth:2.4,pointRadius:2},
      {label:'Phased goal',data:ax.map(m2=>path.at(m2)),borderColor:C.gold,borderDash:[6,5],borderWidth:1.8,pointRadius:0}]},options:opt()}});
  }
  const ym=[];for(let m=1;m<=R.m;m++){const m2=`${R.y}-${p2(m)}`;if(m2>=firstMonth())ym.push(m2);}
  const MB=ym.map(m2=>{const r=mRange(m2);return {k:m2,...bucket(rows,r.a,r.b)};});
  const actP=PP.map((_,i)=>i).filter(i=>MB.some(o=>Math.abs(o.p[i])>0.5));
  const other=o=>o.saved-o.p.reduce((a,b)=>a+b,0);
  D.sections.push({type:'chart',title:`Saved per month, ${R.y}`,cfg:{type:'bar',data:{labels:MB.map(o=>lbl(o.k)),datasets:[
    ...actP.map(i=>({label:PP[i],data:MB.map(o=>o.p[i]),backgroundColor:pcol(i),stack:'s'})),
    ...(MB.some(o=>Math.abs(other(o))>0.5)?[{label:'Loans and other',data:MB.map(other),backgroundColor:C.debt,stack:'s'}]:[])]},options:opt({stacked:true})}});
  /* who saved what */
  const cs=C0.p.reduce((a,b)=>a+b,0),ys=Y0.p.reduce((a,b)=>a+b,0);
  const who=PP.map((name,i)=>[name,money0(C0.p[i]),cs>0?`${Math.round(C0.p[i]/cs*100)}%`:'—',money0(Y0.p[i]),ys>0?`${Math.round(Y0.p[i]/ys*100)}%`:'—']).filter((r,i)=>Math.abs(C0.p[i])+Math.abs(Y0.p[i])>0.5);
  if(Math.abs(C0.saved-cs)>0.5||Math.abs(Y0.saved-ys)>0.5)who.push(['Loans and other',tc(signed0(C0.saved-cs),tone(C0.saved-cs)),'—',tc(signed0(Y0.saved-ys),tone(Y0.saved-ys)),'—']);
  who.push(['Saved',money0(C0.saved),'',money0(Y0.saved),'']);
  D.sections.push({type:'table',title:'Who saved what',cols:[['',0],[label,1],['Share',1],[`${R.y} so far`,1],['Share',1]],rows:who,boldLast:true});
  /* scorecard */
  const M=[['Saved',o=>o.saved],...PP.map((p,i)=>[`${p} added`,o=>o.p[i]]).filter((m,i)=>Math.abs(C0.p[i])+Math.abs(P0.p[i])+Math.abs(L0.p[i])+Math.abs(Y0.p[i])>0.5),['Gold bought',o=>o.gold]];
  const dc=(a,b,ok)=>{if(!ok)return tc('n/a');const v=pcOf(a,b);return tc(v==null?signed0(a-b):`${pS(v)} (${signed0(a-b)})`,a-b>=0?'pos':'neg');};
  D.sections.push({type:'table',title:`${label} against last month and last year`,cols:[['',0],[label,1],[fk(pk),1],['Month on month',1],[fk(lk),1],['Year on year',1]],
    rows:[...M.map(([l,g])=>[l,money0(g(C0)),hasPrev?money0(g(P0)):'—',dc(g(C0),g(P0),hasPrev),hasLy?money0(g(L0)):'—',dc(g(C0),g(L0),hasLy)]),
      ['Net worth at end',money0(net),hasPrev?money0(Hp.net):'—',dc(net,Hp.net,hasPrev),hasLy?money0(Hl.net):'—',dc(net,Hl.net,hasLy)]]});
  if(hasYL)D.sections.push({type:'table',title:`Year to date, 1 January to end of ${label}`,cols:[['',0],[String(R.y),1],[String(R.y-1),1],['Year on year',1]],
    rows:M.map(([l,g])=>[l,money0(g(Y0)),money0(g(YL)),dc(g(Y0),g(YL),true)])});
  /* the year month by month */
  D.sections.push({type:'table',title:`${R.y} month by month`,cols:[['Month',0],['Saved',1],...actP.map(i=>[PP[i],1]),['Gold bought',1],['Net worth',1],['vs goal',1]],
    rows:MB.map(o=>{const b=cumAt(t,o.k),g=path?goalRatio(R.y,path,t,o.k,b):null;return [fk(o.k),money0(o.saved),...actP.map(i=>money0(o.p[i])),o.gold?money0(o.gold):'—',money0(b),tc(g==null?'—':pS(g),tone(g))];})});
  /* what you hold */
  const hold=[['Cash',money0(cash),money0(cash),'—']];
  if(grams>0)hold.push([`Gold, ${grams.toFixed(1)} g`,money0(goldCost),money0(goldW),tc(goldCost&&gm?`${signed0(gainG)} (${pS(goldW/goldCost-1)})`:'—',tone(gainG))]);
  if(loan>0.5)hold.push(['Loans',`−${money0(loan)}`,`−${money0(loan)}`,'—']);
  hold.push(['Net worth',money0(cash+goldCost-loan),money0(net),tc(Math.abs(gainG)>0.5?signed0(gainG):'—',tone(gainG))]);
  D.sections.push({type:'table',title:`What you hold at the end of ${label}`,cols:[['',0],['Paid',1],[grams>0?'Worth':'Value',1],['Gain',1]],rows:hold,boldLast:true});
  /* gold */
  if(grams>0&&gm){
    const gr2=[['Holding',`${grams.toFixed(2)} g`],['Paid in total',money0(goldCost)],[`Worth at the end of ${label}`,money0(goldW)],
      ['Gain on what you paid',tc(goldCost?`${signed0(gainG)} (${pS(goldW/goldCost-1)})`:signed0(gainG),tone(gainG))],
      [`Price per gram, ${kk}k${est?' (estimate)':''}`,money2(gm.px*kk/24)]];
    if(gm.mom!=null)gr2.push(['Price against the month before',tc(pS(gm.mom),tone(gm.mom))]);
    if(gm.yoy!=null)gr2.push(['Price against a year before',tc(pS(gm.yoy),tone(gm.yoy))]);
    if(hasPrev&&Hp.grams>0)gr2.push(['What the price did to your gold this month',tc(signed0(priceEff),tone(priceEff))]);
    if(goldInG>0)gr2.push(['Bought this month',`${goldInG.toFixed(2)} g for ${money0(goldIn)}`]);
    D.sections.push({type:'table',title:'Your gold',cols:[['',0],['',1]],rows:gr2,
      note:est?`A verified historical month-end close was unavailable for ${label}. The displayed value is an explicitly marked fallback, not a verified closing quote. You can type a price in the Gold tab.`
        :(gm.src==='market'?'The price is the last dated market close recorded for this month.':(gm.src==='manual'?'The price is the one you typed.':'The price is the latest one received.'))});
    const hist=gmAll.filter(x=>x.k<=k).slice(-18),anyEst=hist.some(x=>x.est);
    if(hist.length>1){
      const pv=hist.map(x=>x.px?Math.round(x.px*kk/24*100)/100:null);
      const estLine=hist.map((x,i)=>(x.est||(hist[i-1]&&hist[i-1].est)||(hist[i+1]&&hist[i+1].est))?pv[i]:null);
      D.sections.push({type:'chart',title:`Gold price per gram, ${kk}k`,money2:true,cfg:{type:'line',data:{labels:hist.map(x=>lbl(x.k)),datasets:[
        {label:'Market price',data:hist.map((x,i)=>x.est?null:pv[i]),borderColor:C.gold,backgroundColor:C.gold,tension:.25,borderWidth:2.4,pointRadius:2.5,spanGaps:false},
        ...(anyEst?[{label:'Estimate',data:estLine,borderColor:'#C9B58B',backgroundColor:'#C9B58B',borderDash:[5,4],tension:.25,borderWidth:1.8,pointRadius:0,spanGaps:false}]:[])]},options:opt()},
        note:anyEst?'The dashed part is estimated: no market price was available for those months.':''});
      D.sections.push({type:'chart',title:'Your gold: what you paid and what it is worth',cfg:{type:'line',data:{labels:hist.map(x=>lbl(x.k)),datasets:[
        {label:'Worth',data:hist.map(x=>Math.round(x.value)),borderColor:C.cash,backgroundColor:C.cash,tension:.25,borderWidth:2.4,pointRadius:2.5},
        {label:'What you paid',data:hist.map(x=>Math.round(x.cost)),borderColor:'#9AA6B1',backgroundColor:'#9AA6B1',borderDash:[5,4],stepped:true,borderWidth:1.8,pointRadius:0}]},options:opt()}});
    }
    const buys=rows.filter(d=>d.sortTs<R.b&&!isLoanRow(d)&&(d.gold||0)>0).sort((a,b)=>b.sortTs-a.sortTs);
    if(buys.length)D.sections.push({type:'table',title:'Your gold purchases',cols:[['Date',0],['Who',0],['Gold',1],['Paid',1],['Worth',1],['Gain',1]],
      rows:buys.map(d=>{const p=(d.gold||0)*(d.goldPrice||0),w=(d.gold||0)*rowKarat(d)/24*gm.px;return [(d.date||'').split(' ')[0],cap(ownerKey(d.name))||'—',`${Number(d.gold||0).toFixed(2)} g ${rowKarat(d)}k`,money0(p),money0(w),tc(p?pS(w/p-1):'—',tone(w-p))];})});
  }
  /* entries */
  D.sections.push({type:'table',title:`Entries in ${label}`,cols:[['Date',0],['Who',0],['Type',0],['Amount',1]],
    rows:ents.length?ents.map(d=>[(d.date||'').split(' ')[0],cap(ownerKey(d.name))||'—',isLoanRow(d)?'Loan':(d.gold>0?`Gold ${d.gold} g${kOf(d)?` ${kOf(d)}k`:''}`:'Cash'),tc(signed0(rowAmt(d)),rowAmt(d)>=0?'pos':'neg')]):[['No entries','','','']]});
  D.foot='Saved, each person’s amount and Gold bought count gold at what you paid. Net worth values gold at the last dated close for completed months (Standard Bullion), and the latest spot quote for the current month (Gold-API.com); any fallback is labelled as an estimate. Historical data: standardbullion.com.'+(R.y===firstYearAll()&&startSaving()!=null?` ${fmTxt()} counts as ${money0(startSaving())}, your real saving that month, not the savings brought in.`:'');
  return D;
}

/* ----- on screen ----- */
document.body.insertAdjacentHTML('beforeend',`<div id="rp" hidden><div class="rp-bar"><button type="button" id="rp-close" aria-label="Close">✕</button><select class="month-select" id="rp-sel" aria-label="Month"></select><button type="button" id="rp-pdf">Save PDF</button></div><div class="rp-body" id="rp-body"></div></div>`);
const st5=document.createElement('style');
st5.textContent=`#rp{position:fixed;inset:0;z-index:600;background:var(--bg);overflow-y:auto;-webkit-overflow-scrolling:touch}
.rp-bar{position:sticky;top:0;z-index:2;display:flex;gap:8px;align-items:center;padding:calc(10px + env(safe-area-inset-top)) 14px 10px;background:var(--card);border-bottom:1px solid var(--line)}
.rp-bar .month-select{flex:1;min-width:0}
#rp-close{flex:0 0 40px;height:40px;border-radius:12px;border:1px solid var(--line);background:var(--card);font-size:16px;color:var(--ink);cursor:pointer}
#rp-pdf{font:600 14px "IBM Plex Sans",sans-serif;padding:0 16px;height:40px;border-radius:12px;border:0;background:var(--ink);color:#fff;cursor:pointer}
.rp-body{max-width:760px;margin:0 auto;padding:18px 16px calc(40px + env(safe-area-inset-bottom))}
.rp-k{font:700 11px "IBM Plex Sans",sans-serif;letter-spacing:.8px;text-transform:uppercase;color:var(--muted)}
.rp-h{font:600 30px/1.15 "Newsreader",serif;margin:4px 0 4px}.rp-s{font-size:12.5px;color:var(--muted);margin-bottom:16px}
.rp-tiles{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px}
@media(min-width:640px){.rp-tiles{grid-template-columns:repeat(3,1fr)}}
.rp-t{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px}
.rp-t span{display:block;font-size:11px;font-weight:600;color:var(--muted)}.rp-t b{display:block;font:700 21px "IBM Plex Sans",sans-serif;margin:2px 0;font-variant-numeric:tabular-nums}
.rp-t em{display:block;font-style:normal;font-size:11.5px;color:var(--muted);line-height:1.35}.rp-t em.pos{color:var(--pos)}.rp-t em.neg{color:var(--debt)}
.rp-h2{font:600 18px "Newsreader",serif;margin:22px 0 8px}
.rp-ins{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:6px 14px}
.rp-ins p{margin:0;padding:9px 0;font-size:13.5px;line-height:1.45;color:var(--ink-2);border-bottom:1px solid var(--line)}.rp-ins p:last-child{border-bottom:0}
.rp-ch{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px}.rp-ch div{position:relative;height:230px}
.rp-note{font-size:12px;color:var(--muted);margin:8px 2px 0;line-height:1.5}
.x-repcard{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:11px 12px 11px 14px;margin:0 0 16px}
.x-repcard.new{border-color:var(--gold);background:#FBF6EA}
.x-repcard div{min-width:0}.x-repcard b{display:block;font-size:14px}.x-repcard span{display:block;font-size:12px;color:var(--muted);margin-top:1px}
.x-repcard button{flex:0 0 auto;font:600 13px "IBM Plex Sans",sans-serif;padding:9px 16px;border-radius:999px;border:0;background:var(--ink);color:#fff;cursor:pointer}`;
const stResponsive=document.createElement('style');stResponsive.textContent='\n/* Native continuous report: no PDF iframe, page clipping, or horizontal viewport overflow. */\n#rp{width:100%;max-width:100vw;overscroll-behavior:contain}\n#rp .rp-bar{box-sizing:border-box;width:100%;flex-wrap:wrap;gap:8px;padding-left:max(12px,env(safe-area-inset-left));padding-right:max(12px,env(safe-area-inset-right))}\n#rp .rp-bar .month-select{min-width:100px;flex:1 1 110px;max-width:100%}\n#rp #rp-pdf{flex:0 0 auto;white-space:nowrap;font-size:12px;padding:0 12px}\n#rp .rp-body{box-sizing:border-box;width:100%;max-width:900px;padding:clamp(16px,4vw,32px) max(14px,env(safe-area-inset-left)) calc(55px + env(safe-area-inset-bottom));overflow-x:hidden}\n#rp .rp-h{font-size:clamp(27px,7vw,42px);overflow-wrap:anywhere}\n#rp .rp-t{min-width:0;overflow:hidden}\n#rp .rp-t b{font-size:clamp(16px,4.7vw,23px);overflow-wrap:anywhere}\n#rp .rp-t em{overflow-wrap:anywhere}\n#rp .rp-ch{min-width:0;overflow:hidden;padding:clamp(10px,3vw,18px);border-radius:18px}\n#rp .rp-ch>div{height:clamp(220px,60vw,320px);min-width:0}\n#rp .rp-ch canvas{max-width:100%!important}\n#rp .table-container{width:100%;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:14px}\n#rp .rp-ins{border-radius:18px}\n#rp .rp-h2{font-size:clamp(19px,5vw,24px);margin-top:28px}\n@media(max-width:380px){#rp .rp-tiles{grid-template-columns:1fr 1fr;gap:7px}#rp .rp-t{padding:10px}#rp .rp-bar{gap:6px}}\n';document.head.appendChild(stResponsive);
document.head.appendChild(st5);
const RP={k:null,charts:[],pdfUrl:null};
// Responsive HTML is the primary report view; PDF remains a separate export.

const cellH=c=>typeof c==='string'?esc(c):`<span class="${c.tone||''}">${esc(c.t)}</span>`;
function renderReport(){
  const ms=reportMonths();if(!ms.length)return;
  if(!ms.includes(RP.k))RP.k=lastClosedMonth()||ms[0];
  $('rp-sel').innerHTML=ms.map(k=>`<option value="${k}">${fk(k)}${k===nowKey()?' (so far)':''}</option>`).join('');$('rp-sel').value=RP.k;
  RP.charts.forEach(c=>{try{c.destroy();}catch(e){}});RP.charts=[];
  const D=reportData(RP.k);
  if(RP.pdfUrl){URL.revokeObjectURL(RP.pdfUrl);RP.pdfUrl=null;}
  let h=`<div class="rp-k">${esc(D.title)} · monthly report</div><div class="rp-h">${esc(D.label)}</div><div class="rp-s">${esc(D.sub)}</div>`;
  const cfgs=[];
  D.sections.forEach(s=>{
    if(s.type==='tiles')h+=`<div class="rp-tiles">${s.tiles.map(x=>`<div class="rp-t"><span>${esc(x.l)}</span><b class="${/^[+−]/.test(x.v)?x.tone:''}">${esc(x.v)}</b><em class="${/^[+−]/.test(x.v)?'':x.tone}">${esc(x.s)}</em></div>`).join('')}</div>`;
    else if(s.type==='insights')h+=`<div class="rp-h2">${esc(s.title)}</div><div class="rp-ins">${s.items.map(x=>`<p>${esc(x)}</p>`).join('')}</div>`;
    else if(s.type==='chart'){h+=`<div class="rp-h2">${esc(s.title)}</div><div class="rp-ch"><div><canvas id="rp-c${cfgs.length}"></canvas></div></div>${s.note?`<p class="rp-note">${esc(s.note)}</p>`:''}`;if(s.money2){s.cfg.options.scales.y.ticks.callback=v=>'$'+Math.round(v);s.cfg.options.plugins.tooltip.callbacks={label:c=>` ${c.dataset.label}: ${c.raw==null?'—':money2(c.raw)}${c.datasetIndex===0&&v[c.dataIndex].asOf?' · observed '+v[c.dataIndex].asOf:''}${c.datasetIndex===0&&isEstSrc(v[c.dataIndex].src)?' · fallback/estimate':''}`};}cfgs.push(s.cfg);}
    else if(s.type==='table')h+=`<div class="rp-h2">${esc(s.title)}</div><div class="table-container"><table style="min-width:${Math.max(320,s.cols.length*92)}px"><thead><tr>${s.cols.map(([l,r])=>`<th${r?' class="r"':''}>${esc(l)}</th>`).join('')}</tr></thead><tbody>${s.rows.map((r,i)=>`<tr>${r.map((c,j)=>`<td class="${s.cols[j]&&s.cols[j][1]?'num':''}">${j===0||(s.boldLast&&i===s.rows.length-1)?`<strong>${cellH(c)}</strong>`:cellH(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${s.note?`<p class="rp-note">${esc(s.note)}</p>`:''}`;
  });
  h+=`<p class="rp-note">${esc(D.foot)}</p>`;
  $('rp-body').innerHTML=h;
  cfgs.forEach((c,i)=>{try{RP.charts.push(new Chart($('rp-c'+i),c));}catch(e){}});
}
function openReport(k){
  if(!allData.length){toast('Add entries first, then your report appears here.');return;}
  if(k)RP.k=k;
  $('rp').hidden=false;document.body.style.overflow='hidden';renderReport();$('rp').scrollTop=0;
  const lc=lastClosedMonth();if(lc&&RP.k>=lc){try{localStorage.setItem('lg-report-seen',lc);}catch(e){}renderRepCard();}
  try{const s=nget();if(s&&s.inbox&&s.inbox.some(x=>x.id==='report-'+RP.k)){s.inbox=s.inbox.filter(x=>x.id!=='report-'+RP.k);nset(s);renderNotes();}}catch(e){}
}
function closeReport(){if(RP.pdfUrl){URL.revokeObjectURL(RP.pdfUrl);RP.pdfUrl=null;}$('rp').hidden=true;document.body.style.overflow='';RP.charts.forEach(c=>{try{c.destroy();}catch(e){}});RP.charts=[];}
$('rp-close').onclick=closeReport;
$('rp-sel').onchange=e=>{RP.k=e.target.value;renderReport();$('rp').scrollTop=0;};
window.lgOpenReport=openReport;

/* card on Overview: always one tap away, highlighted when a new month has closed */
$('x-tabs').insertAdjacentHTML('afterend',`<div class="x-repcard" id="x-repcard" hidden><div><b id="x-rep-t"></b><span id="x-rep-s"></span></div><button type="button" id="x-rep-open">Open</button></div>`);
$('x-rep-open').onclick=()=>openReport(lastClosedMonth());
function renderRepCard(){
  const lc=lastClosedMonth(),el=$('x-repcard');
  if(!lc||!allData.length||$('hero').hidden||view!=='overview'){el.hidden=true;return;}
  let seen='';try{seen=localStorage.getItem('lg-report-seen')||'';}catch(e){}
  const isNew=seen<lc&&lc<nowKey();
  el.hidden=false;el.classList.toggle('new',isNew);
  $('x-rep-t').textContent=isNew?`Your ${fk(lc)} report is ready`:`Monthly report, ${fk(lc)}`;
  let sub='Scorecard, how your net worth moved, gold and every entry. Save it as a PDF.';
  if(isNew){try{sub=reportNote(lc).body.replace(' Tap to open it.','');}catch(e){}}
  $('x-rep-s').textContent=sub;
}

/* ----- PDF: written directly, no outside library ----- */
function PdfDoc(){
  const W=595.28,H=841.89,pages=[],imgs=[];let ops=null;
  const mc=document.createElement('canvas').getContext('2d');
  const MAP={0x2212:45,0x2013:150,0x2014:151,0x2018:145,0x2019:146,0x201C:147,0x201D:148,0x2022:149,0x2026:133,0x20AC:128,0x25B2:43,0x25BC:45};
  const clean=s=>String(s==null?'':s).replace(/[   ]/g,' ');
  const enc=s=>{let o='';for(const ch of clean(s)){let c=ch.codePointAt(0);if(MAP[c]!=null)c=MAP[c];else if(c>255)c=63;
    if(c===40||c===41||c===92)o+='\\'+String.fromCharCode(c);else if(c<32||c>126)o+='\\'+c.toString(8).padStart(3,'0');else o+=String.fromCharCode(c);}return o;};
  const rgb=h=>{const n=parseInt(h.slice(1),16);return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255].map(x=>x.toFixed(3)).join(' ');};
  const n2=x=>(Math.round(x*100)/100).toString();
  const api={W,H,
    width(s,size,bold){mc.font=`${bold?'bold ':''}${size}px Helvetica, Arial, sans-serif`;return mc.measureText(clean(s).replace(/[−]/g,'-')).width;},
    page(){ops=[];pages.push(ops);},
    text(x,y,s,o){o=o||{};const size=o.size||10,w=o.align&&o.align!=='left'?api.width(s,size,o.bold):0,tx=o.align==='right'?x-w:(o.align==='center'?x-w/2:x);
      ops.push(`BT /F${o.bold?2:1} ${size} Tf ${rgb(o.color||'#16232F')} rg ${n2(tx)} ${n2(H-y)} Td (${enc(s)}) Tj ET`);},
    rect(x,y,w,h,fill,stroke){ops.push(`${fill?rgb(fill)+' rg ':''}${stroke?rgb(stroke)+' RG 0.6 w ':''}${n2(x)} ${n2(H-y-h)} ${n2(w)} ${n2(h)} re ${fill&&stroke?'B':(fill?'f':'S')}`);},
    line(x1,y1,x2,y2,color,w){ops.push(`${rgb(color||'#E1E5EA')} RG ${w||0.6} w ${n2(x1)} ${n2(H-y1)} m ${n2(x2)} ${n2(H-y2)} l S`);},
    path(pts,color,w,dash){if(pts.length<2)return;ops.push(`${rgb(color||'#16232F')} RG ${w||1} w 1 j 1 J ${dash?`[${dash.join(' ')}] 0 d `:''}${pts.map((p,i)=>`${n2(p[0])} ${n2(H-p[1])} ${i?'l':'m'}`).join(' ')} S${dash?' [] 0 d':''}`);},
    wrap(s,size,maxW,bold){const out=[];let line='';clean(s).split(/\s+/).forEach(w=>{const t=line?line+' '+w:w;if(api.width(t,size,bold)<=maxW||!line)line=t;else{out.push(line);line=w;}});if(line)out.push(line);return out;},
    image(dataUrl,x,y,w,h,pw,ph){const b=atob(dataUrl.split(',')[1]),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);
      imgs.push({u,pw,ph});ops.push(`q ${n2(w)} 0 0 ${n2(h)} ${n2(x)} ${n2(H-y-h)} cm /Im${imgs.length} Do Q`);},
    pageCount:()=>pages.length,
    bytes(){
      const chunks=[],offs=[];let len=0;
      const put=s=>{const u=typeof s==='string'?Uint8Array.from(s,c=>c.charCodeAt(0)&255):s;chunks.push(u);len+=u.length;};
      const nImg=imgs.length,nPg=pages.length,total=4+nImg+nPg*2;
      const obj=(i,body)=>{offs[i]=len;put(`${i} 0 obj\n`);put(body);put('\nendobj\n');};
      put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
      const kids=pages.map((_,i)=>`${5+nImg+i*2} 0 R`).join(' ');
      obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
      obj(2,`<< /Type /Pages /Kids [${kids}] /Count ${nPg} >>`);
      obj(3,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      obj(4,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      imgs.forEach((im,i)=>{offs[5+i]=len;put(`${5+i} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${im.pw} /Height ${im.ph} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.u.length} >>\nstream\n`);put(im.u);put('\nendstream\nendobj\n');});
      const xo=imgs.length?`/XObject << ${imgs.map((_,i)=>`/Im${i+1} ${5+i} 0 R`).join(' ')} >>`:'';
      pages.forEach((p,i)=>{const pn=5+nImg+i*2,body=p.join('\n');
        obj(pn,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${xo} >> /Contents ${pn+1} 0 R >>`);
        obj(pn+1,`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);});
      const xref=len;put(`xref\n0 ${total+1}\n0000000000 65535 f \n`);
      for(let i=1;i<=total;i++)put(String(offs[i]).padStart(10,'0')+' 00000 n \n');
      put(`trailer\n<< /Size ${total+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
      const out=new Uint8Array(len);let o=0;chunks.forEach(c=>{out.set(c,o);o+=c.length;});return out;
    }};
  return api;
}
/* charts are drawn straight into the PDF as lines and bars: sharp at any zoom, and no hidden canvas to go wrong on a phone */
const hexOf=c=>{c=String(c||'#16232F');if(c[0]==='#')return c.length===4?'#'+[1,2,3].map(i=>c[i]+c[i]).join(''):c.slice(0,7);
  const m=/rgba?\(([^)]+)\)/.exec(c);if(!m)return '#16232F';const p=m[1].split(',').map(Number),a=p.length>3?p[3]:1;
  return '#'+[0,1,2].map(i=>Math.round(p[i]*a+255*(1-a)).toString(16).padStart(2,'0')).join('');};
function niceStep(span,n){const raw=span/Math.max(1,n),mag=Math.pow(10,Math.floor(Math.log10(raw||1))),r=raw/mag;return (r<=1?1:r<=2?2:r<=2.5?2.5:r<=5?5:10)*mag;}
function pdfChart(P,s,x,y,w,h){
  const cfg=s.cfg,ds=cfg.data.datasets||[],labels=cfg.data.labels||[],n=labels.length,MUT='#69737F',LINE='#E9EDF1';
  const stacked=!!(cfg.options&&cfg.options.scales&&cfg.options.scales.x&&cfg.options.scales.x.stacked);
  const isBar=d=>(d.type||cfg.type)==='bar';
  let lo=Infinity,hi=-Infinity;
  ds.filter(d=>!isBar(d)).forEach(d=>d.data.forEach(v=>{if(v!=null&&isFinite(v)){lo=Math.min(lo,v);hi=Math.max(hi,v);}}));
  const bars=ds.filter(isBar);
  if(bars.length){for(let i=0;i<n;i++){let p=0,q=0;bars.forEach(d=>{const v=+d.data[i]||0;if(stacked){if(v>=0)p+=v;else q+=v;}else{p=Math.max(p,v);q=Math.min(q,v);}});hi=Math.max(hi,p);lo=Math.min(lo,q,0);}}
  if(!isFinite(lo)||!isFinite(hi)){P.text(x+10,y+24,'Nothing to chart yet.',{size:9,color:MUT});return;}
  if(hi===lo){hi+=1;lo-=1;}
  const pad=(hi-lo)*0.08;if(!bars.length)lo=lo-pad<0&&lo>=0?0:lo-pad;hi+=pad;
  const step=niceStep(hi-lo,4);lo=Math.floor(lo/step)*step;hi=Math.ceil(hi/step)*step;
  const fmtY=v=>{const a=Math.abs(v),sg=v<0?'−':'';return s.money2?sg+'$'+(step<1?a.toFixed(2):Math.round(a)):(hi-lo>=20000?sg+'$'+(a/1000).toFixed(step%1000?1:0)+'k':sg+'$'+Math.round(a).toLocaleString('en-US'));};
  const px0=x+46,px1=x+w-10,py0=y+10,py1=y+h-34,pw=px1-px0,ph=py1-py0;
  const Y=v=>py1-(v-lo)/(hi-lo)*ph,slot=pw/Math.max(1,n),X=i=>bars.length?px0+slot*(i+0.5):(n>1?px0+pw*i/(n-1):px0+pw/2);
  for(let v=lo;v<=hi+step/2;v+=step){P.line(px0,Y(v),px1,Y(v),Math.abs(v)<step/1e6?'#C9D0D8':LINE,0.5);P.text(px0-5,Y(v)+2.6,fmtY(v),{size:7,color:MUT,align:'right'});}
  const every=Math.max(1,Math.ceil(n/9));
  labels.forEach((l,i)=>{if(i%every===0||i===n-1&&(n-1)%every>every/2)P.text(X(i),py1+11,String(l),{size:7,color:MUT,align:'center'});});
  if(bars.length){
    const bw=Math.min(26,slot*0.62);
    for(let i=0;i<n;i++){let up=0,dn=0;bars.forEach((d,j)=>{const v=+d.data[i]||0;if(!v)return;const c=hexOf(Array.isArray(d.backgroundColor)?d.backgroundColor[i]:d.backgroundColor);
      if(stacked){const a=v>=0?up:dn,b=a+v;P.rect(X(i)-bw/2,Math.min(Y(a),Y(b)),bw,Math.abs(Y(a)-Y(b)),c);if(v>=0)up=b;else dn=b;}
      else{const w1=bw/bars.length;P.rect(X(i)-bw/2+j*w1,Math.min(Y(0),Y(v)),w1,Math.abs(Y(0)-Y(v)),c);}});}
  }
  ds.filter(d=>!isBar(d)).forEach(d=>{
    const c=hexOf(d.borderColor),lw=d.borderDash?1.2:1.7;let seg=[];
    const flush=()=>{if(seg.length>1)P.path(seg,c,lw,d.borderDash?[4,3]:null);seg=[];};
    d.data.forEach((v,i)=>{if(v==null||!isFinite(v)){flush();return;}
      if(d.stepped&&seg.length)seg.push([X(i),seg[seg.length-1][1]]);seg.push([X(i),Y(v)]);});
    flush();
    if(d.pointRadius!==0&&n<=24)d.data.forEach((v,i)=>{if(v!=null&&isFinite(v))P.rect(X(i)-1.6,Y(v)-1.6,3.2,3.2,c);});
  });
  let lx=px0;ds.forEach(d=>{const c=hexOf(isBar(d)?(Array.isArray(d.backgroundColor)?d.backgroundColor[0]:d.backgroundColor):d.borderColor),t=String(d.label||'');
    if(isBar(d))P.rect(lx,y+h-13,7,7,c);else P.path([[lx,y+h-9.5],[lx+10,y+h-9.5]],c,1.7,d.borderDash?[3,2]:null);
    const off=isBar(d)?10:14;P.text(lx+off,y+h-7,t,{size:7.5,color:'#2B3B4A'});lx+=off+P.width(t,7.5)+14;});
}
function buildPdf(D){
  const P=PdfDoc(),L=42,Rt=P.W-42,CW=Rt-L,INK='#16232F',MUT='#69737F',LINE='#E1E5EA',POS='#2E7D5B',NEG='#B0433A';
  const col=t=>t==='pos'?POS:(t==='neg'?NEG:INK);
  let y=0;
  const foot=()=>{P.line(L,P.H-40,Rt,P.H-40,LINE);P.text(L,P.H-27,`${D.title} · ${D.label} report`,{size:8,color:MUT});P.text(Rt,P.H-27,`Page ${P.pageCount()}`,{size:8,color:MUT,align:'right'});};
  const newPage=()=>{P.page();foot();y=46;};
  const need=h=>{if(y+h>P.H-54)newPage();};
  newPage();
  P.text(L,y,`${D.title} · monthly report`.toUpperCase(),{size:8,bold:true,color:MUT});y+=26;
  P.text(L,y,D.label,{size:26,bold:true});y+=16;
  P.text(L,y,D.sub,{size:9,color:MUT});y+=18;
  D.sections.forEach(s=>{
    if(s.type==='tiles'){
      const per=3,gap=8,w=(CW-gap*(per-1))/per,h=62;
      s.tiles.forEach((t,i)=>{const c=i%per;if(c===0){need(h+gap);}const x=L+c*(w+gap);
        P.rect(x,y,w,h,'#F6F8FA');P.text(x+9,y+15,t.l,{size:7.5,bold:true,color:MUT});const chgv=/^[+−]/.test(t.v);P.text(x+9,y+35,t.v,{size:15,bold:true,color:chgv?col(t.tone):INK});
        P.wrap(t.s,7.2,w-18).slice(0,2).forEach((ln,j)=>P.text(x+9,y+47+j*8.5,ln,{size:7.2,color:chgv||!t.tone?MUT:col(t.tone)}));
        if(c===per-1||i===s.tiles.length-1)y+=h+gap;});
      y+=6;
    }else if(s.type==='insights'){
      need(40);P.text(L,y+10,s.title,{size:12.5,bold:true});y+=22;
      s.items.forEach(it=>{const lines=P.wrap(it,9.5,CW-14);need(lines.length*12.5+5);P.rect(L,y-6.5,3,3,'#B9892F');lines.forEach((ln,j)=>P.text(L+12,y+j*12.5,ln,{size:9.5,color:'#2B3B4A'}));y+=lines.length*12.5+5;});
      y+=8;
    }else if(s.type==='chart'){
      const h=178;need(h+34+(s.note?12:0));P.text(L,y+10,s.title,{size:12.5,bold:true});y+=20;
      P.rect(L,y,CW,h,null,LINE);
      try{pdfChart(P,s,L,y,CW,h);}catch(e){console.error(e);P.text(L+10,y+24,'Chart not available.',{size:9,color:MUT});}
      y+=h+(s.note?4:16);
      if(s.note){P.wrap(s.note,8,CW).forEach(ln=>{need(11);P.text(L,y+8,ln,{size:8,color:MUT});y+=10.5;});y+=12;}
    }else if(s.type==='table'){
      const n=s.cols.length,fs=n>7?7.4:(n>5?7.8:9.2),rh=fs+8.5,first=n<=2?CW*0.62:(n>5?Math.max(70,CW-(n-1)*86):Math.max(96,Math.min(170,CW-(n-1)*78))),cw=(CW-first)/Math.max(1,n-1);
      const xs=s.cols.map((_,i)=>i===0?L:L+first+(i-1)*cw);
      const hasHead=s.cols.some(c=>c[0]);
      const head=()=>{if(!hasHead){P.line(L,y,Rt,y,LINE,0.4);return;}P.rect(L,y,CW,rh+2,'#F6F8FA');s.cols.forEach(([l,r],i)=>{if(l)P.text(r?xs[i]+cw-5:xs[i]+5,y+rh-4,String(l).toUpperCase(),{size:fs-1.6,bold:true,color:MUT,align:r?'right':'left'});});y+=rh+2;};
      need(s.rows.length<=12?rh*(s.rows.length+1)+30:rh*3+34);P.text(L,y+10,s.title,{size:12.5,bold:true});y+=20;head();
      s.rows.forEach((r,ri)=>{if(y+rh>P.H-54){newPage();head();}
        const last=s.boldLast&&ri===s.rows.length-1;
        r.forEach((c,i)=>{const t=typeof c==='string'?c:c.t,tn=typeof c==='string'?'':c.tone,rt=s.cols[i]&&s.cols[i][1];
          let txt=t;const maxW=(i===0?first:cw)-8;while(txt.length>3&&P.width(txt,fs,i===0||last)>maxW)txt=txt.slice(0,-2);if(txt!==t)txt=txt.replace(/.$/,'…');
          P.text(rt?xs[i]+cw-5:xs[i]+5,y+rh-5,txt,{size:fs,bold:i===0||last,color:col(tn),align:rt?'right':'left'});});
        y+=rh;P.line(L,y,Rt,y,LINE,0.4);});
      if(s.note){y+=4;P.wrap(s.note,8,CW).forEach(ln=>{need(11);P.text(L,y+8,ln,{size:8,color:MUT});y+=10.5;});}
      y+=16;
    }
  });
  need(34);P.wrap(D.foot,8,CW).forEach(ln=>{P.text(L,y+8,ln,{size:8,color:MUT});y+=10.5;});
  return P.bytes();
}

window.lgBuildPdf=k=>buildPdf(reportData(k));window.lgReportData=k=>reportData(k);

$('rp-pdf').onclick=async()=>{
  const b=$('rp-pdf'),old=b.textContent;b.textContent='Making…';b.disabled=true;
  try{
    const bytes=buildPdf(reportData(RP.k)),name=`Savings report ${RP.k}.pdf`,blob=new Blob([bytes],{type:'application/pdf'});
    let done=false;
    try{const file=new File([blob],name,{type:'application/pdf'});
      if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});done=true;}
    }catch(e){if(e&&e.name==='AbortError')done=true;}
    if(!done){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),20000);toast('PDF saved to your downloads.',false);}
  }catch(e){console.error(e);toast('Could not make the PDF. Try again.');}
  b.textContent=old;b.disabled=false;
};
/* a link from the monthly email opens that month's report */
function reportFromHash(){const m=/^#report=(\d{4}-\d{2}|last)$/.exec(location.hash);if(m&&allData.length){history.replaceState(null,'',location.pathname+location.search);openReport(m[1]==='last'?lastClosedMonth():m[1]);}}
window.addEventListener('hashchange',reportFromHash);

const prevRA2=renderAll;
renderAll=function(){
  prevRA2();
  try{
    if(allData.length){
      const t=computeAnalytics(getFilteredData());
      if(t.keys.length){fillVarYears(t);filterVar();renderScore();renderInsights();if(view==='explore')renderExplore();}
    }
    if(!allData.length)renderChips();
    renderSettings();renderWho();
    REG.forEach(applySort);
    applyView();renderRepCard();renderNotes();
    if(!$('rp').hidden)renderReport();
  }catch(e){console.error(e);}
};
window.lgGoView=goView;
window.lgAfterSync=arrived=>{try{renderSettings();drawDelivery();}catch(e){}try{notePartner(arrived||[]);runNotes();}catch(e){console.error(e);}};
setTimeout(reportFromHash,600);
/* a new year opens on its own tab, even when the app was left open in the background over New Year */
let seenYear=new Date().getFullYear();
document.addEventListener('visibilitychange',()=>{if(document.hidden)return;const y=new Date().getFullYear();if(y!==seenYear){seenYear=y;heroYear=null;SC.sel='';renderAll();}});
})();

/* ---------- start ---------- */
try{
  const m=location.hash.match(/^#join=(.+)$/);
  if(m){
    const o=JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    if(/^https:\/\/script\.google\.com\//.test(o.u)&&o.t){
      localStorage.setItem(SYNC,JSON.stringify({url:o.u,token:o.t}));
      localStorage.setItem('lg-ledger-seeded','1');   // joiners get the shared Sheet's data, never a built-in copy
      try{sessionStorage.setItem('lg-joined','1');}catch(e){}
    }
    history.replaceState(null,'',location.pathname+location.search);
  }
}catch(e){}
/* Line the stored data up with the ledger this phone is signed in to. Nothing is ever restored over live data. */
try{
  const od=stashKey('original-device');                      /* set aside by versions 24 to 26 */
  if(localStorage.getItem(od)){
    /* keep it only if it holds entries the current ledger does not have: otherwise it is just an old copy of the same ledger */
    let extra=false;
    try{const old=JSON.parse(JSON.parse(localStorage.getItem(od))[KEY]||'[]'),have={};
      JSON.parse(localStorage.getItem(KEY)||'[]').forEach(r=>{have[r.id]=1;});Object.keys(JSON.parse(localStorage.getItem(TOMB)||'{}')||{}).forEach(id=>{have[id]=1;});
      extra=old.some(r=>!have[r.id]);}catch(e){}
    if(extra&&!hasStash(DEVICE)&&activeAccount()!==DEVICE)localStorage.setItem(stashKey(DEVICE),localStorage.getItem(od));
    localStorage.removeItem(od);
  }
  if(localStorage.getItem(ACCOUNT_ACTIVE)==='signed-out'){
    localStorage.setItem(ACCOUNT_ACTIVE,'legacy:none');accountMove(DEVICE,false);
  }
  const c=JSON.parse(localStorage.getItem(SYNC)||'null'),want=c&&c.url?accountId('legacy',c.url):null;
  if(want&&want!==activeAccount()){
    const joined=!!sessionStorage.getItem('lg-joined');
    accountMove(want,activeAccount()===DEVICE&&!joined,true);
  }
  if(want)localStorage.setItem('lg-ledger-seeded','1');
  const act=activeAccount();if(act!==DEVICE)localStorage.removeItem(stashKey(act));   /* stale periodic copies from versions 24 to 26 */
}catch(e){}
allData=loadSaved();
try{
  if(!localStorage.getItem(CFGKEY)&&allData.length){
    const j=parseFloat(localStorage.getItem('lg-jan26-v1'));
    const keys=[...new Set(allData.map(r=>ownerKey(r.name)).filter(Boolean))].sort().join(',');
    CFG=Object.assign({goal:30000,startSaving:isNaN(j)?800:j},keys==='guy,lea'?{title:'Lea & Guy'}:{});
    localStorage.setItem(CFGKEY,JSON.stringify(CFG));
  }else if(!localStorage.getItem(CFGKEY))localStorage.setItem(CFGKEY,'{}');   /* a fresh ledger starts with no fixed names or target */
}catch(e){}
try{tomb=JSON.parse(localStorage.getItem(TOMB)||'{}')||{};}catch(e){tomb={};}
try{if(!allData.length&&!localStorage.getItem('lg-ledger-seeded')){allData=seedRows();localStorage.setItem('lg-ledger-seeded','1');}}catch(e){}
allData.forEach(r=>{if(!r.updated)r.updated=1;lastSig[r.id]=sig(r);});
persist();
try{sessionStorage.removeItem('lg-joined');}catch(e){}
const c0=cfg();if(c0&&c0.url){$('x-sync-url').value=toLogin(c0.url);$('x-sync-token').value=c0.token;}else{try{$('x-sync-url').value=localStorage.getItem('lg-last-login')||'';}catch(e){}}
status();renderAll();
if(c0)sync({quiet:true});
refreshGold();
fetchGoldHistory().then(ok=>{if(ok&&!busy())renderAll();});
})();
