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
const APPV='14';
let swReg=null,hadSW=!!(navigator.serviceWorker&&navigator.serviceWorker.controller),updShown=false;
function showUpdate(){
  if(updShown)return;updShown=true;
  document.body.insertAdjacentHTML('beforeend','<div id="x-upd" role="status"><span>A new version is ready.</span><button type="button" id="x-upd-go">Update now</button></div>');
  document.getElementById('x-upd-go').onclick=()=>location.reload();
}
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').then(r=>{swReg=r;}).catch(()=>{}));
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadSW)showUpdate();hadSW=true;});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&swReg)swReg.update().catch(()=>{});});
}
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
   <div><label class="x-label" for="x-p">USD per gram</label><input id="x-p" class="x-input" inputmode="decimal" autocomplete="off" placeholder="0.00"></div></div>
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
  persist();scheduleSync();
}
function loadSaved(){try{const r=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(r)?r:[];}catch(e){return [];}}
function status(){
  $('file-info').textContent=(allData.length?`${allData.length} entries`:'No entries yet')+(cfg()?` · ${syncState||'Signed in'}`:' · saved on this phone');
  const b=readPrefs().lastBackup;$('x-data-hint').textContent=b?`Last export ${b}`:'';
  const ba=shared.backupAt?new Date(shared.backupAt):null;
  $('x-data-sub').textContent=cfg()
    ?('Your entries are saved to your shared ledger. '+(shared.ok?`It keeps a weekly copy by itself${ba?` (last one ${ba.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][ba.getMonth()]})`:''}, and the last 8 stay in the Sheet as “Backup” tabs.`:(shared.ok===false?'Update the ledger script to get weekly automatic copies, shared settings and the monthly email.':'')))
    :'Entries live on this phone only. Sign in to share them, or export a backup now and then.';
  $('x-ver').textContent=`Version ${APPV}`+(cfg()&&shared.ok!=null?` · ledger script ${shared.ok?'up to date':'older version'}`:'');
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
const goldNow=d=>{const p=px24();return p>0?(d.gold||0)*p*rowKarat(d)/24:(d.gold||0)*(d.goldPrice||0);};
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
  if(S.kind==='gold'){const g=num($('x-g').value),v=g*num($('x-p').value);if(v>0)t=`${g} g worth ${money2(v)} · net worth +${money2(v)}`;}
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
    $('x-amt').value=row.gold>0?'':Math.abs(row.usd||0)||'';$('x-g').value=row.gold>0?row.gold:'';$('x-p').value=row.goldPrice||'';$('x-k').value=(/(\d{2})\s*k/i.exec(row.type||'')||['',''])[1];
    $('x-date').value=toYMD(row.sortTs)||toYMD(Date.now());
  }else{
    setKind(pr.kind||'deposit');setWho(pr.who||'');
    $('x-amt').value='';$('x-g').value='';$('x-p').value=pr.price||'';$('x-k').value=pr.karat||'';$('x-date').value=toYMD(Date.now());
  }
  preview();$('x-scrim').hidden=false;$('x-sheet').hidden=false;document.body.style.overflow='hidden';
  setTimeout(()=>$(S.kind==='gold'?'x-g':'x-amt').focus(),60);
}
function closeSheet(){$('x-sheet').hidden=true;$('x-scrim').hidden=true;document.body.style.overflow='';}
function submit(again){
  const err=$('x-err');err.textContent='';
  const ymd=$('x-date').value;if(!ymd){err.textContent='Pick a date.';return;}
  const [y,m,d]=ymd.split('-').map(Number),now=new Date();
  const date=`${p2(d)}/${p2(m)}/${y} ${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`;
  const k=S.kind,row={id:S.editId||uid(),date,sortTs:parseSortDate(date),yyyyMM:parseDateToYYYYMM(date),type:'Cash USD',gold:0,eur:0,usd:0,goldPrice:0,name:S.who.toLowerCase()};
  if(!S.who){err.textContent='Choose who this is for, or tap + New to add a name.';return;}
  if(k==='gold'){
    const g=num($('x-g').value),p=num($('x-p').value);
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
  if(again){$('x-amt').value='';$('x-g').value='';preview();$('x-' + (k==='gold'?'g':'amt')).focus();}else closeSheet();
}
$('x-fab').onclick=()=>openSheet(null);$('x-empty').addEventListener('click',e=>{if(e.target.closest('button'))openSheet(null);});
$('x-close').onclick=closeSheet;$('x-scrim').onclick=closeSheet;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('x-sheet').hidden)closeSheet();});
$('x-kinds').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setKind(b.dataset.kind);});
$('x-who').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.new){const n=addPerson(prompt('Name of the person'));if(n)setWho(n);}else setWho(b.dataset.who);});
['x-amt','x-g','x-p'].forEach(id=>$(id).addEventListener('input',preview));
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
 <div class="table-container" style="margin-top:10px"><table id="x-raw-table"><thead><tr><th>Date</th><th>Type</th><th class="r">Grams</th><th class="r">EUR</th><th class="r">USD</th><th>Name</th><th class="r">Gold price</th><th aria-label="Delete"></th></tr></thead><tbody></tbody></table></div>
 <p class="x-note">Dates read as dd/mm/yyyy, with an optional time. A name containing “loan” makes the row a loan: a negative USD amount is borrowed, a positive one is repaid. Gold rows use grams × gold price.</p>
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
/* Account-specific local cache: never let another ledger inherit financial settings. */
const ACCOUNT_KEYS=[KEY,TOMB,'lg-shu-v1','lg-shs-v1','lg-cfg-v1','lg-gold-v1','lg-gold-history-v1','lg-delivery-v1','lg-xp-v1','lg-ledger-seeded'];
const ACCOUNT_ACTIVE='lg-active-account-v2';
const accountId=(kind,id)=>kind+':'+id;
const accountSnapshot=()=>{const o={};ACCOUNT_KEYS.forEach(k=>o[k]=localStorage.getItem(k));return o;};
const accountSave=()=>{const id=localStorage.getItem(ACCOUNT_ACTIVE);if(id)localStorage.setItem('lg-account-cache-v2:'+id,JSON.stringify(accountSnapshot()));};
function accountSwitch(id){
  const previous=localStorage.getItem(ACCOUNT_ACTIVE);
  if(previous===id)return;
  if(!previous && !localStorage.getItem('lg-account-cache-v2:original-device'))localStorage.setItem('lg-account-cache-v2:original-device',JSON.stringify(accountSnapshot()));
  accountSave();
  let snapshot={};try{snapshot=JSON.parse(localStorage.getItem('lg-account-cache-v2:'+id)||'{}')||{};}catch(e){}
  ACCOUNT_KEYS.forEach(k=>snapshot[k]==null?localStorage.removeItem(k):localStorage.setItem(k,snapshot[k]));
  localStorage.setItem(ACCOUNT_ACTIVE,id);
  CFG=JSON.parse(localStorage.getItem(CFGKEY)||'{}');_ppl=null;
  allData=loadSaved();try{tomb=JSON.parse(localStorage.getItem(TOMB)||'{}')||{};}catch(e){tomb={};}
  lastSig={};allData.forEach(r=>lastSig[r.id]=sig(r));ver++;
  renderAll();
}
/* Do not treat default preferences on a new phone as edits before remote settings arrive. */
window.addEventListener('pagehide',accountSave);
setInterval(accountSave,12000);
$('x-google-login').onclick=async()=>{
  try{
    if(!window.LGGoogle)throw Error('Google integration not loaded');
    // Google OAuth must be initiated directly from the user gesture.
    const result=await LGGoogle.login();
    // Switch only after Google has successfully identified its spreadsheet.
    accountSwitch(accountId('google',result.spreadsheetId));
    localStorage.setItem('lg-google-sheet-id',result.spreadsheetId);
    $('x-google-info').textContent='Connected: '+result.email+' · Google Sheet '+result.spreadsheetId;
    $('x-google-login').textContent='Google account · Reconnect';
    await sync({manual:true,adopt:true});
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
function errText(e){const m=String(e?.message||'');if(m==='unauthorized')return 'Wrong password.';if(m==='bad-reply')return 'Could not sign in. Check the ledger login.';if(m==='offline'||!navigator.onLine)return 'Offline. Changes are saved here and will sync later.';return 'Sync failed: '+m.slice(0,160);}
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
    const L=o.adopt?[]:allData,T=o.adopt?{}:tomb,lmap={};
    L.forEach(r=>{lmap[r.id]=r;});
    const ids=new Set([...L.map(r=>r.id),...Object.keys(T),...Object.keys(rmap)]);
    const rows=[],nt={},push=[];
    ids.forEach(id=>{
      const l=lmap[id],lt=T[id],x=rmap[id],lu=l?(l.updated||1):(lt||0),ru=x?(+x.updated||0):-1;
      if(x&&ru>=lu){if(isTrue(x.deleted))nt[id]=ru;else rows.push(fromRemote(x));}
      else if(l){rows.push(l);push.push(toRemote(l));}
      else if(lt){nt[id]=lt;if(x)push.push({id,deleted:true,updated:lt});}
    });
    if(push.length||sp)await api('POST',sp?{rows:push,settings:sp}:{rows:push});
    if(ver!==v0)syncAgain=true;
    else{
      const sg=a=>JSON.stringify(a.map(r=>r.id+'|'+r.updated+'|'+sig(r)).sort());
      const changed=sg(rows)!==sg(allData);
      allData=rows;tomb=nt;lastSig={};allData.forEach(r=>{lastSig[r.id]=sig(r);});persist();
      if(changed||shared.applied){shared.applied=false;renderAll();}
    }
    const n=new Date();setSyncState(`Synced ${p2(n.getHours())}:${p2(n.getMinutes())}`);status();if(window.lgAfterSync)window.lgAfterSync();
  }catch(e){setSyncState(errText(e));if(o.manual)toast(errText(e));}
  finally{syncing=false;if(syncAgain){syncAgain=false;scheduleSync();}}
}
$('x-sync-connect').onclick=async()=>{
  const url=toUrl($('x-sync-url').value),token=$('x-sync-token').value.trim();
  if(!url||!token){toast('Enter your ledger login and password.');return;}
  // Authenticate BEFORE switching cached data, so a wrong password never changes the account.
  const previous=localStorage.getItem(SYNC);
  localStorage.setItem(SYNC,JSON.stringify({url,token}));setSyncState('Connecting…');
  let reply;
  try{reply=await api('GET');if(!Array.isArray(reply.rows))throw Error('Invalid ledger response');}
  catch(e){previous==null?localStorage.removeItem(SYNC):localStorage.setItem(SYNC,previous);setSyncState('');status();toast(errText(e));return;}
  const ledgerKey=accountId('legacy',url); // password is not stored in the cache key
  accountSwitch(ledgerKey);
  localStorage.setItem(SYNC,JSON.stringify({url,token}));
  // Remote settings are authoritative on first connection to a ledger.
  await sync({manual:true,adopt:true});
  accountSave();
};
$('x-sync-invite').onclick=async()=>{
  const c=cfg();if(!c){toast('Sign in first.');return;}if(c.mode==='google'){toast('To share a Google ledger, use Google Drive sharing. Each collaborator needs Google access.');return;}
  const link=location.origin+location.pathname+'#join='+btoa(unescape(encodeURIComponent(JSON.stringify({u:c.url,t:c.token}))));
  try{await navigator.clipboard.writeText(link);toast('Invite copied. Send it privately: anyone with it signs in and can edit the ledger.');}
  catch(e){prompt('Copy this invite and send it privately:',link);}
};
$('x-sync-now').onclick=()=>{if(!cfg()){toast('Sign in first.');return;}sync({manual:true});};
$('x-sync-off').onclick=()=>{
  accountSave();
  if(window.LGGoogle?.active())LGGoogle.signout();
  localStorage.removeItem('lg-google-sheet-id');
  localStorage.removeItem(SYNC);
  accountSwitch('signed-out');
  $('x-sync-token').value='';$('x-sync-url').value='';setSyncState('');status();toast('Signed out. Ledger data is isolated.');
};
setInterval(()=>{if(cfg()&&!document.hidden)sync({quiet:true});},45000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cfg())sync({quiet:true});});
window.addEventListener('online',()=>{if(cfg())sync({quiet:true});});

/* ---------- gold valuation: market price instead of purchase price ---------- */
const GKEY='lg-gold-v1',OZ=31.1034768;
const gDefault={mode:'market',karat:21,manual:'',px:0,at:0};
const gset=()=>{try{const o=Object.assign({},gDefault,JSON.parse(localStorage.getItem(GKEY)||'{}'));if(!o.kset)o.karat=21;return o;}catch(e){return Object.assign({},gDefault);}};   /* 21k until someone picks another purity */
const gsave=o=>{try{localStorage.setItem(GKEY,JSON.stringify(Object.assign(gset(),o)));}catch(e){}};
/* Live and typed prices are turned into a 24k price per gram, then each gold entry is scaled by its own purity. */
function px24(){
  const g=gset();if(g.mode!=='market')return 0;
  const m=num(g.manual);if(m>0)return m*24/g.karat;
  return g.px;
}
const rowKarat=r=>{const m=/(\d{2})\s*k/i.exec(r.type||'');const k=m?+m[1]:0;return(k>=8&&k<=24)?k:gset().karat;};
const baseCompute=computeAnalytics;
computeAnalytics=function(rows){
  const t=baseCompute(rows);t.goldCost=t.gold;t.goldPx=0;const p=px24();
  if(p>0&&t.goldGrams>0){
    let v=0;rows.forEach(r=>{if(!(r.name||'').includes('loan')&&(r.gold||0)>0)v+=r.gold*p*rowKarat(r)/24;});
    t.gold=v;t.goldPx=v/t.goldGrams;t.net=t.cash+t.gold-t.loan;
    const adj=goldAdj(rows);t.cumulativeCost=Object.assign({},t.cumulative);t.goldGain={};
    t.keys.forEach(k=>{const a=adj(k);t.goldGain[k]=a;t.cumulative[k]+=a;});
  }
  return t;
};
/* market value minus price paid for the gold held at the end of month k (0 when gold is valued at cost) */
function goldAdj(rows){
  if(!(px24()>0))return ()=>0;
  let m={};try{goldMonthly(rows).forEach(r=>{if(r.value!=null)m[r.k]=r.value-r.cost;});}catch(e){m={};}
  const ks=Object.keys(m).sort();
  return k=>{if(k in m)return m[k];let v=0;for(const kk of ks){if(kk<=k)v=m[kk];else break;}return ks.length&&k>ks[ks.length-1]?m[ks[ks.length-1]]:(ks.length&&k<ks[0]?0:v);};
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
    const src=manual?'your typed price':(g.via==='ledger'?'from your ledger, not live':'live price');
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
      const gain=now-paid,net=computeAnalytics(allData).net;
      hold.hidden=false;
      hold.innerHTML=`<div class="xg-h">Your gold <span class="x-src mix">Ours × market</span></div>
        <div class="xg-grid"><div><span>Holding</span><b>${grams.toFixed(1)} g</b><em>${Object.keys(byK).sort((a,b)=>b-a).map(x=>`${byK[x].toFixed(1)} g of ${x}k`).join(', ')}</em></div>
        <div><span>Worth now</span><b>${money0(now)}</b><em>${net>0?Math.round(now/net*100)+'% of net worth':''}</em></div>
        <div><span>Paid</span><b>${money0(paid)}</b><em>${rows.length} purchase${rows.length>1?'s':''}</em></div>
        <div><span>Gain</span><b class="${gain>=0?'pos':'neg'}">${signed0(gain)}</b><em class="${gain>=0?'pos':'neg'}">${paid?(gain>=0?'+':'−')+Math.abs(gain/paid*100).toFixed(1)+'% on what you paid':''}</em></div></div>`;
    }
  }catch(e){console.error(e);}
  if(g.mode!=='market')t='valued at what you paid';
  else if(num(g.manual)>0)t='your typed price';
  else if(g.px>0)t=g.via==='ledger'?'from your ledger':'live';
  else t='no price yet';
  $('x-gold-status').textContent=t+(extra?' · '+extra:'');
}
$('x-gold').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.k){GV.k=+b.dataset.k;goldStatus();try{renderGoldChart();}catch(x){}}
  else if(b.id==='xg-ref')$('x-gold-refresh').click();
});
async function fetchGold(){
  let oz=0;
  try{const r=await fetch('https://api.gold-api.com/price/XAU',{cache:'no-store'});oz=Number((await r.json()).price);}catch(e){oz=0;}
  if(oz>500&&oz<20000){
    gsave({px:oz/OZ,at:Date.now(),via:'live'});const k=toYMD(Date.now()).slice(0,7),sn=(hget().snap)||{};sn[k]=oz/OZ;hsave({snap:sn});return true;
  }
  const sv=hget().srv;   /* second source: the price the ledger fetched */
  if(sv&&sv.px>0&&Date.now()-sv.at<36*3600*1000){gsave({px:sv.px,at:sv.at,via:'ledger'});return true;}
  return false;
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
$('x-gold-refresh').onclick=async()=>{const ok=await fetchGold();goldStatus(ok?'':'live price unavailable');renderAll();toast(ok?'Gold price refreshed':'Could not reach the price service. Type a price instead.');};
setInterval(()=>{if(!document.hidden)refreshGold();},15*60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshGold();});

/* ---------- gold price history: monthly price, your gold value, and what moved it ---------- */
const HKEY='lg-goldhist-v1';
const hget=()=>{try{return JSON.parse(localStorage.getItem(HKEY)||'{}')||{};}catch(e){return {};}};
const hsave=o=>{try{localStorage.setItem(HKEY,JSON.stringify(Object.assign(hget(),o)));}catch(e){}};
async function fetchGoldHistory(force){
  const h=hget();if(!force&&h.at&&Date.now()-h.at<12*3600*1000)return false;
  try{
    const arr=await(await fetch('https://freegoldapi.com/data/latest.json',{cache:'no-store'})).json();
    if(!Array.isArray(arr))return false;
    const sums={};
    arr.forEach(x=>{const d=String(x.date||''),p=Number(x.price),k=d.slice(0,7);
      if(d.length>=7&&k>='2024-01'&&p>500&&p<20000){const s=sums[k]||(sums[k]=[0,0]);s[0]+=p;s[1]++;}});
    const m={};Object.keys(sums).forEach(k=>{m[k]=sums[k][0]/sums[k][1]/OZ;});   /* monthly average, USD per gram of 24k */
    if(!Object.keys(m).length)return false;
    hsave({at:Date.now(),m});return true;
  }catch(e){return false;}
}
function monthPx(k){const h=hget();return(h.man&&h.man[k])||(h.m&&h.m[k])||(h.srv&&h.srv.months&&h.srv.months[k])||(h.snap&&h.snap[k])||0;}
/* One row per month from the first gold purchase: 24k price, the value of the gold held, and the moves in %.
   A month's price is, in order: one you typed, the market average, today's live price (current month), what you paid that month.
   Months with none of these are estimated by spreading the price evenly between the nearest known months, never held flat. */
function goldMonthly(rows){
  const g=rows.filter(r=>!(r.name||'').includes('loan')&&(r.gold||0)>0&&r.yyyyMM);
  if(!g.length)return [];
  const paid={};g.forEach(r=>{if(r.goldPrice>0){const p=r.goldPrice*24/(kOf(r)||gset().karat);(paid[r.yyyyMM]=paid[r.yyyyMM]||[]).push(p);}});
  const first=g.map(r=>r.yyyyMM).sort()[0],nowK=toYMD(Date.now()).slice(0,7);
  const lastRow=g.map(r=>r.yyyyMM).sort().pop(),end=nowK>lastRow?nowK:lastRow,n=monthsBetween(first,end);
  const hh=hget(),base=[];
  for(let i=0;i<=n;i++){
    const k=addMonths(first,i);let px=monthPx(k),src=(hh.man&&hh.man[k])?'manual':'market';
    if(k===nowK&&src!=='manual'){const lv=px24()||gset().px;if(lv>0){px=lv;src='live';}}
    if(!px&&paid[k]){px=paid[k].reduce((a,b)=>a+b,0)/paid[k].length;src='paid';}
    base.push({k,px:px||0,src:px?src:'est'});
  }
  /* estimate the gaps */
  for(let i=0;i<base.length;i++){
    if(base[i].px)continue;
    let lo=i-1;while(lo>=0&&!base[lo].px)lo--;
    let hi=i+1;while(hi<base.length&&!base[hi].px)hi++;
    if(lo>=0&&hi<base.length)base[i].px=base[lo].px+(base[hi].px-base[lo].px)*(i-lo)/(hi-lo);
    else if(lo>=0)base[i].px=base[lo].px;
    else if(hi<base.length)base[i].px=base[hi].px;
  }
  const out=[];let pxPrev=0,unitsPrev=0;
  base.forEach(({k,px,src},i)=>{
    let units=0,cost=0,grams=0,newUnits=0;
    g.forEach(r=>{if(r.yyyyMM<=k){const u=r.gold*rowKarat(r)/24;units+=u;grams+=r.gold;cost+=r.gold*(r.goldPrice||0);if(r.yyyyMM===k)newUnits+=u;}});
    const value=px?units*px:null;
    const ly=monthPx(addMonths(k,-12)),dec=monthPx(`${+k.slice(0,4)-1}-12`);
    out.push({k,px:px||null,src,grams,cost,units,value,
      mom:(px&&pxPrev)?px/pxPrev-1:null,yoy:(px&&ly)?px/ly-1:null,ytd:(px&&dec)?px/dec-1:null,
      priceEffect:(px&&pxPrev&&i>0)?unitsPrev*(px-pxPrev):(i===0&&px?0:null),
      bought:px?newUnits*px:null});
    if(px){pxPrev=px;}unitsPrev=units;
  });
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
  const gm={};goldMonthly(allData).forEach(r=>{if(r.px)gm[r.k]=r;});
  const h=hget(),known=[...Object.keys(h.m||{}),...Object.keys((h.srv&&h.srv.months)||{}),...Object.keys(h.man||{}),...Object.keys(gm)].filter(k=>/^\d{4}-\d{2}$/.test(k)).sort();
  if(!known.length)return [];
  const nk=toYMD(Date.now()).slice(0,7),out=[];let prev=0;
  for(let k=known[0];k<=nk;k=addMonths(k,1)){
    const r=gm[k];let px=r?r.px:monthPx(k),src=r?r.src:'market';
    if(k===nk&&!r){const lv=px24()||gset().px;if(lv>0){px=lv;src='live';}}
    if(!px){if(!prev)continue;px=prev;src='est';}
    out.push({k,px,src});prev=px;
  }
  return out;
}
const rangeN=()=>({'6m':6,'1y':12,'2y':24,'all':999}[GV.range]||12);
function renderGoldChart(){
  const sec=$('x-goldhist'),all=goldMonthly(allData).filter(r=>r.px),ps=priceSeries(),k=GV.k||gset().karat,n=rangeN();
  sec.hidden=false;
  $('xg-range').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.r===GV.range));
  $('xg-series').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.s===GV.series));
  $('xg-series').hidden=!all.length;
  const mine=GV.series==='mine'&&all.length;
  const tag=r=>r.src==='live'?' · today':((r.src==='market'||r.src==='manual')?'':'*');
  const lab=r=>`${fmtMonthShort(r.k)} ’${r.k.slice(2,4)}${tag(r)}`;
  if(charts.goldhist){charts.goldhist.destroy();charts.goldhist=null;}
  const base={responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
    plugins:{datalabels:{display:false},legend:{position:'bottom',labels:{boxWidth:14,boxHeight:2,padding:12,font:{size:11}}}}};
  if(mine){
    const v=all.slice(-n);
    charts.goldhist=new Chart($('goldhist'),{type:'bar',data:{labels:v.map(lab),datasets:[
      {type:'line',label:'Worth at market',data:v.map(r=>r.value),borderColor:C.cash,tension:0.3,borderWidth:2.4,pointRadius:2.5,yAxisID:'y'},
      {type:'line',label:'What you paid',data:v.map(r=>r.cost),borderColor:'#9AA6B1',borderDash:[5,4],stepped:true,borderWidth:1.8,pointRadius:0,yAxisID:'y'},
      {label:'Price effect',data:v.map(r=>r.priceEffect||0),backgroundColor:v.map(r=>(r.priceEffect||0)>=0?'rgba(46,125,91,.5)':'rgba(176,67,58,.55)'),yAxisID:'y1'}]},
      options:Object.assign({},base,{scales:{y:{position:'left',ticks:{callback:x=>'$'+Number(x).toLocaleString()},grid:{color:'#F0F2F5'}},y1:{position:'right',ticks:{callback:x=>'$'+Number(x).toLocaleString()},grid:{display:false}},x:{grid:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:7}}},
        plugins:Object.assign({},base.plugins,{tooltip:{callbacks:{title:i=>fmtMonthFull(v[i[0].dataIndex].k),label:c=>` ${c.dataset.label}: ${c.raw==null?'—':(c.datasetIndex===2?signed0(c.raw):money0(c.raw))}`}}})})});
    const l=v[v.length-1],f=v[0],pe=v.reduce((s,r)=>s+(r.priceEffect||0),0);
    $('x-goldhist-desc').textContent=`Worth ${money0(l.value)} against ${money0(l.cost)} paid. Since ${lab(f).replace('*','')} the price added ${signed0(pe)} to what you hold.`;
  }else if(ps.length){
    const v=ps.slice(-n);
    charts.goldhist=new Chart($('goldhist'),{type:'line',data:{labels:v.map(lab),datasets:[
      {label:`${k}k per gram`,data:v.map(r=>r.px*k/24),borderColor:C.gold,backgroundColor:'rgba(185,137,47,0.12)',fill:true,tension:0.3,borderWidth:2.4,pointRadius:v.length>18?0:2.5},
      ...(all.length?[{label:'Your purchases',data:v.map(r=>{const b=allData.filter(d=>isGoldRow(d)&&d.yyyyMM===r.k&&d.goldPrice>0);return b.length?b.reduce((s,d)=>s+d.goldPrice*k/(kOf(d)||gset().karat),0)/b.length:null;}),borderColor:C.ink,backgroundColor:C.ink,pointRadius:5,pointStyle:'rectRot',showLine:false}]:[])]},
      options:Object.assign({},base,{scales:{y:{ticks:{callback:x=>'$'+Math.round(x)},grid:{color:'#F0F2F5'}},x:{grid:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:7}}},
        plugins:Object.assign({},base.plugins,{tooltip:{callbacks:{title:i=>fmtMonthFull(v[i[0].dataIndex].k),label:c=>` ${c.dataset.label}: ${c.raw==null?'—':money2(c.raw)}`}}})})});
    const l=v[v.length-1],f=v[0],hi=v.reduce((a,r)=>r.px>a.px?r:a,v[0]),lo=v.reduce((a,r)=>r.px<a.px?r:a,v[0]);
    $('x-goldhist-desc').textContent=`${k}k gold went from ${money2(f.px*k/24)} to ${money2(l.px*k/24)} per gram since ${lab(f).replace('*','')} (${l.px>=f.px?'+':'−'}${Math.abs((l.px/f.px-1)*100).toFixed(1)}%). High ${money2(hi.px*k/24)} in ${lab(hi).replace(/\*| · today/g,'')}, low ${money2(lo.px*k/24)} in ${lab(lo).replace(/\*| · today/g,'')}.${all.length?' Diamonds mark what you paid.':''}`;
  }else $('x-goldhist-desc').textContent='No price history yet. It loads by itself when the app can reach the price services.';
  /* month by month: your holding months, or the price alone before you hold any */
  const rowsT=(all.length?all:ps.map((r,i)=>({k:r.k,px:r.px,src:r.src,mom:i?r.px/ps[i-1].px-1:null,yoy:monthPx(addMonths(r.k,-12))?r.px/monthPx(addMonths(r.k,-12))-1:null,ytd:monthPx(`${+r.k.slice(0,4)-1}-12`)?r.px/monthPx(`${+r.k.slice(0,4)-1}-12`)-1:null,value:null,priceEffect:null,bought:null}))).slice(-n);
  $('x-gold-table').querySelector('tbody').innerHTML=[...rowsT].reverse().map(r=>`<tr data-k="${r.k}" class="x-tap"><td data-v="${r.k.replace('-','')}"><strong>${lab(r)}</strong></td>
    <td class="num" data-v="${r.px*k/24}">${money2(r.px*k/24)}</td>${pcell(r.mom)}${pcell(r.yoy)}${pcell(r.ytd)}
    <td class="num" data-v="${r.value==null?'':r.value}">${r.value==null?'—':money0(r.value)}</td>
    <td class="num ${r.priceEffect==null?'':(r.priceEffect>=0?'pos':'neg')}" data-v="${r.priceEffect==null?'':r.priceEffect}">${r.priceEffect==null?'—':signed0(r.priceEffect)}</td>
    <td class="num" data-v="${r.bought||0}">${r.bought?signed0(r.bought):'—'}</td></tr>`).join('');
  const h=hget(),nm=Math.max(h.m?Object.keys(h.m).length:0,h.srv&&h.srv.months?Object.keys(h.srv.months).length:0),est=rowsT.some(r=>r.src==='paid'||r.src==='est');
  $('x-goldhist-note').textContent=`Prices are per gram of ${k}k. `+(nm?`Past months use the market price for the month (${nm} months loaded); the current month uses today's price. `:'Market price history could not be loaded, so months use what you paid that month, or an estimate between the nearest known months. ')
    +(est?'A * marks a month without a market price. ':'')+'Price effect is what the gold you already held gained or lost; Bought is gold added that month.';
  /* purchases */
  const lots=allData.filter(isGoldRow).sort((a,b)=>b.sortTs-a.sortTs);
  $('x-lots-h').hidden=$('x-lots-box').hidden=!lots.length;
  $('x-lots-note').textContent=lots.length?'Tap a purchase to edit it. Tap a month above to type its real price. A * on purity means the entry has none, so the default is used.':'Tap a month to type its real price.';
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
  hsave({man});renderAll();
});
$('x-gh-retry').onclick=()=>{fetchGoldHistory(true).then(ok=>{toast(ok?'Price history loaded':'Could not load price history. Try again later.',false);renderAll();});};
const prevRA=renderAll;
renderAll=function(){prevRA();try{goldStatus();renderGoldChart();}catch(e){console.error(e);}};
setInterval(()=>{if(!document.hidden)refreshGold();},10*60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-(gset().at||0)>5*60*1000)refreshGold();});
setInterval(()=>{if(!document.hidden)fetchGoldHistory().then(ok=>{if(ok&&!busy())renderAll();});},3600*1000);

/* ---------- settings shared between phones through the ledger ----------
   Each shared setting carries its own "last changed" time; the newest one wins on every phone. */
const SHU='lg-shu-v1',SHS='lg-shs-v1';
const SH={
  fullDataConfig:{get:()=>{const o={...CFG};delete o.emails;return o;},set:v=>{if(v&&typeof v==='object'){const keep=CFG.emails;CFG={...CFG,...v};if(keep)CFG.emails=keep;}}},
  people:{get:()=>(CFG.people&&CFG.people.length?CFG.people:null),set:v=>{CFG.people=Array.isArray(v)?v:[];}},
  title:{get:()=>CFG.title||null,set:v=>{CFG.title=v||'';}},
  goal:{get:()=>(CFG.goal>0?+CFG.goal:null),set:v=>{CFG.goal=+v||0;}},
  startSaving:{get:()=>(CFG.startSaving==null||CFG.startSaving===''?null:+CFG.startSaving),set:v=>{CFG.startSaving=v;}},
  goldKarat:{get:()=>(gset().kset?gset().karat:null),set:v=>{gsave({karat:+v,kset:true});}},
  goldMode:{get:()=>gset().mode,set:v=>{gsave({mode:v==='cost'?'cost':'market'});}},
  goldManual:{get:()=>gset().manual||null,set:v=>{gsave({manual:v||''});}},
  goldMan:{get:()=>{const m=hget().man;return m&&Object.keys(m).length?m:null;},set:v=>{hsave({man:v||{}});}},
  delivery:{get:()=>deliveryPrefs(),set:v=>{if(v&&typeof v==='object'){localStorage.setItem('lg-delivery-v1',JSON.stringify(v));drawDelivery();}}},
  appUrl:{get:()=>location.origin+location.pathname,set:()=>{}}
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
  if(!reply||typeof reply.settings!=='object'||!reply.settings){shared.ok=false;return null;}
  shared.ok=true;shared.backupAt=+reply.backupAt||0;
  // On first Google connection, remote settings must win over device defaults.
  if(Object.keys(jget(SHU)).length)shStamp();
  const u=jget(SHU),s=jget(SHS),R=reply.settings,out={};let applied=false;
  Object.keys(SH).forEach(k=>{
    const r=R[k],lu=+u[k]||0,ru=r?(+r.u||0):0;
    if(r&&ru>lu){try{SH[k].set(r.v===''||r.v==null?null:JSON.parse(r.v));s[k]=r.v||'';u[k]=ru;applied=true;}catch(e){}}
    else if(lu>ru&&(s[k]||'')!=='')out[k]={v:s[k],u:lu};
    else if(lu>ru&&r)out[k]={v:'',u:lu};
  });
  if(applied){try{localStorage.setItem(CFGKEY,JSON.stringify(CFG));}catch(e){}jset(SHU,u);jset(SHS,s);_ppl=null;shared.applied=true;}
  // After adopting remote values, stamp any genuinely missing local keys for first sync.
  if(applied)shStamp();
  return Object.keys(out).length?out:null;
}
const shared={ok:null,backupAt:0,applied:false};
/* price help from the ledger: used when this phone cannot reach the price services itself */
function srvGold(reply){
  const g=reply&&reply.gold;if(!g||typeof g!=='object')return;
  const months={};Object.keys(g.months||{}).forEach(k=>{const p=Number(g.months[k]);if(/^\d{4}-\d{2}$/.test(k)&&p>500&&p<20000)months[k]=p/OZ;});
  const px=Number(g.px);
  hsave({srv:{px:px>500&&px<20000?px/OZ:0,at:+g.at||0,months}});
}
window.lgCfgChanged=()=>{shStamp();scheduleSync();};

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
  applyView();renderRepCard();
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
  try{const gm=(window.lgGoldMonthly?window.lgGoldMonthly(rows):[]).filter(r=>r.k<=mk&&r.value!=null);if(gm.length&&px24()>0)gold=gm[gm.length-1].value;}catch(e){}
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
   const tag=r=>r.src==='live'?' · today':((r.src==='market'||r.src==='manual')?'':'*');
   const rows=[...list].reverse().map(r=>({cells:[cell(`<strong>${lbl(r.k)}${tag(r)}</strong>`,r.k.replace('-','')),cell(money2(r.px),r.px,'num'),cell(money2(r.px*k/24),r.px*k/24,'num'),pC(r.mom),pC(r.yoy),pC(r.ytd)]}));
   const l=list[list.length-1],f0=list[0];
   return {cols:['Month','24k / g',`${k}k / g`,'vs last month','vs last year','Year to date'],rows,
    insight:`Gold is at <b>${money2(l.px*k/24)}</b> per gram of ${k}k, ${pctTxt(l.px/f0.px-1)} since ${lbl(f0.k)}${l.mom!=null?`, ${pctTxt(l.mom)} on last month`:''}.`,
    note:'Market data. Past months are monthly averages; the current month is today’s live price. A * marks a month without a market price (your purchase price, or an estimate between known months); tap that month in the Gold tab to type the real one.',
    chart:{type:'line',data:{labels:list.map(r=>lbl(r.k)),datasets:[
      {label:`${k}k per gram`,data:list.map(r=>r.px*k/24),borderColor:C.gold,backgroundColor:'rgba(185,137,47,0.12)',fill:true,tension:.3,borderWidth:2.4,pointRadius:list.map(r=>r.src==='market'||r.src==='live'||r.src==='manual'?2.5:0)}]},
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
    note:'Your grams (our data) valued at the market price (market data), each entry at its own purity. Price effect is the gain or loss on gold you already held; Bought is gold added that month at that month’s price.',
    chart:{type:'bar',data:{labels:list.map(r=>lbl(r.k)),datasets:[
      {type:'line',label:'Worth at market',data:list.map(r=>r.value),borderColor:C.cash,borderWidth:2.4,pointRadius:2,tension:.3},
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
  $('x-set-hint').textContent=cfg()?(shared.ok===false?'not shared yet: update the ledger script':(shared.ok?'shared with everyone signed in':'')):'saved on this phone';
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
/* Account delivery preferences: stored in the same settings object and synced by the ledger settings adapter. */
$('x-settings').insertAdjacentHTML('beforeend', `<div class="x-set" id="x-delivery" style="margin-top:16px;border-top:1px solid var(--line);padding-top:16px">
 <h3 style="font-family:Newsreader,serif;font-size:22px;margin:0 0 8px">Notifications</h3>
 <p class="x-note">Notifications are enabled by default in preferences. Allow permission to test on this device. Scheduled push when the app is closed still needs a push server.</p>
 <label class="x-label"><input type="checkbox" id="x-push-enabled"> Monthly push notification enabled</label>
 <label class="x-label" for="x-push-hour">Preferred notification hour (local)</label>
 <select class="x-input" id="x-push-hour"><option value="8">08:00</option><option value="9">09:00</option><option value="10">10:00</option><option value="12">12:00</option><option value="18">18:00</option></select>
 <div class="x-btns"><button type="button" id="x-push-test">Test notification on this device</button></div>
 <p id="x-push-result" class="x-note" role="status"></p>
 </div>`);
function deliveryPrefs(){try{return {push:true,hour:9,...JSON.parse(localStorage.getItem('lg-delivery-v1')||'{}')};}catch{return {push:true,hour:9};}}
function saveDelivery(p){const n={...deliveryPrefs(),...p};localStorage.setItem('lg-delivery-v1',JSON.stringify(n));if(window.lgCfgChanged)window.lgCfgChanged();}
function drawDelivery(){const p=deliveryPrefs();$('x-push-enabled').checked=!!p.push;$('x-push-hour').value=String(p.hour||9);}
['x-push-enabled','x-push-hour'].forEach(id=>$(id).addEventListener('change',()=>{saveDelivery({push:$('x-push-enabled').checked,hour:+$('x-push-hour').value});toast('Notification preference saved. Scheduled push needs server activation.',false);}));
$('x-push-test').onclick=async()=>{
 const el=$('x-push-result');if(!('Notification' in window)||!('serviceWorker' in navigator)){el.textContent='Notifications are not supported in this browser.';return;}
 if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&!window.navigator.standalone){el.textContent='On iPhone, first add this site to your Home Screen and open it from there.';return;}
 try{const permission=await Notification.requestPermission();if(permission!=='granted'){el.textContent='Notification permission was not granted.';return;}
 const reg=await navigator.serviceWorker.ready;await reg.showNotification('Savings Ledger · Test notification',{body:'Your monthly report notification preview. This is a device test, not a scheduled push.',icon:'icon-192.png',tag:'savings-ledger-test',data:{url:location.origin+location.pathname+'#report='+new Date().toISOString().slice(0,7)}});
 el.textContent='Local notification displayed. Scheduled push is not active until a server is configured.';
 }catch(e){el.textContent='Notification test failed: '+e.message;}
};drawDelivery();
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
function reportData(k){
  const rows=allData,t=computeAnalytics(rows),PP=people();
  JF=janF();
  const R=mRange(k),pk=addMonths(k,-1),lk=addMonths(k,-12),Rp=mRange(pk),Rl=mRange(lk);
  const first=Math.min(...rows.map(r=>r.sortTs).filter(Boolean));
  const C0=bucket(rows,R.a,R.b),P0=bucket(rows,Rp.a,Rp.b),L0=bucket(rows,Rl.a,Rl.b),hasPrev=Rp.b>first,hasLy=Rl.b>first;
  const bal=balanceTo(rows,R.b),balP=balanceTo(rows,Rp.b),balL=balanceTo(rows,Rl.b);
  const y0=new Date(R.y,0,1).getTime(),Y0=bucket(rows,y0,R.b),YL=bucket(rows,new Date(R.y-1,0,1).getTime(),new Date(R.y-1,R.m,1).getTime()),hasYL=new Date(R.y-1,R.m,1).getTime()>first;
  const path=pathFor(R.y,t),cb=cumAt(t,k),gr=path?goalRatio(R.y,path,t,k,cb):null,gap=path?cb-path.at(k):null;
  const label=fk(k),partial=k===nowKey();
  const mom=hasPrev?pcOf(C0.saved,P0.saved):null,yoy=hasLy?pcOf(C0.saved,L0.saved):null,ytdYoy=hasYL?pcOf(Y0.saved,YL.saved):null;
  /* gold at the end of the month */
  let gm=null;try{gm=(window.lgGoldMonthly(rows)||[]).filter(r=>r.k<=k&&r.px).pop()||null;}catch(e){}
  let cash=0,loan=0,goldCost=0,grams=0;
  rows.forEach(d=>{if(!(d.sortTs<R.b))return;if(isLoanRow(d))loan-=d.usd||0;else{cash+=d.usd||0;goldCost+=(d.gold||0)*(d.goldPrice||0);grams+=d.gold||0;}});
  const goldW=grams>0?(gm&&gm.value!=null&&px24()>0?gm.value:goldCost):0,net=cash+goldW-loan;
  const D={k,label,partial,title:appTitle(),sections:[]};
  D.sub=`${partial?'Month in progress, figures so far. ':''}Prepared ${fd(Date.now())}.`;
  /* headline tiles */
  D.sections.push({type:'tiles',tiles:[
    {l:`Saved in ${label}`,v:money0(C0.saved),s:hasPrev?`${pS(mom)} vs ${fk(pk)} (${money0(P0.saved)})`:'first month of the ledger',tone:tone(mom)},
    {l:'Against last year',v:hasLy?pS(yoy):'n/a',s:hasLy?`${fk(lk)}: ${money0(L0.saved)}`:`no ${fk(lk)} in the ledger`,tone:tone(yoy)},
    {l:'Balance at month end',v:money0(bal),s:hasPrev?`${signed0(bal-balP)} in the month, gold at market`:'gold at market',tone:''},
    {l:`Saved in ${R.y} so far`,v:money0(Y0.saved),s:hasYL?`${pS(ytdYoy)} vs the same months of ${R.y-1}`:`no ${R.y-1} to compare with`,tone:tone(ytdYoy)},
    {l:'Against the phased goal',v:gr==null?'n/a':pS(gr),s:path?`${signed0(gap)} vs the path · target ${money0(path.goal)}`:'no target set for this year',tone:tone(gr)},
    {l:'Net worth',v:money0(net),s:`cash ${money0(cash)}${grams>0?` · gold ${money0(goldW)}`:''}${loan>0.5?` · loans −${money0(loan)}`:''}`,tone:''}]});
  /* Report v3: reconciliation, contributor detail, gold market versus invested cost. */
  const gmAll=goldMonthly(rows),gmCur=gmAll.find(x=>x.k===k),gmPrev=gmAll.find(x=>x.k===pk);
  const priorGoldValue=gmPrev&&gmPrev.value!=null?gmPrev.value:0;
  const currentGoldValue=gmCur&&gmCur.value!=null?gmCur.value:goldW;
  const goldPriceEffect=gmCur&&Number.isFinite(gmCur.priceEffect)?gmCur.priceEffect:null;
  const goldBought=C0.gold;
  const contributorSum=C0.p.reduce((a,b)=>a+b,0);
  const nonContributor=C0.saved-contributorSum;
  const netChange=hasPrev?net-(function(){let pc=0,pl=0,pg=0;rows.forEach(d=>{if(d.sortTs>=Rp.b)return;if(isLoanRow(d))pl-=d.usd||0;else{pc+=d.usd||0;pg+=(d.gold||0)*(d.goldPrice||0);}});return pc+(gmPrev&&gmPrev.value!=null?gmPrev.value:pg)-pl;})():null;
  const bridgeResidual=netChange==null||goldPriceEffect==null?null:netChange-C0.saved-goldPriceEffect;
  const signedMoney=n=>n==null?'—':signed0(n);
  const contributorRows=PP.map((name,i)=>[name,money0(C0.p[i]),money0(Y0.p[i]),contributorSum>0?pS(C0.p[i]/contributorSum):'—']);
  if(Math.abs(nonContributor)>.005)contributorRows.push(['Loans / adjustments / unattributed',signedMoney(nonContributor),signedMoney(Y0.saved-Y0.p.reduce((a,b)=>a+b,0)),'—']);
  contributorRows.push(['Total saved',money0(C0.saved),money0(Y0.saved),'100% of monthly total']);
  D.sections.push({type:'table',title:'Contribution breakdown · month and year to date',cols:[['Contributor',0],['Month',1],['YTD',1],['Share of deposits',1]],rows:contributorRows,boldLast:true,
    note:'Individual contributions reflect named deposits. The reconciliation row explains any difference between deposits and total savings (including loan entries or adjustments).'});
  if(hasPrev){
    D.sections.push({type:'table',title:'Why net worth changed · monthly bridge',cols:[['Driver',0],['Amount',1]],rows:[
      ['Opening net worth',money0(net-netChange)],['Net savings recorded',signedMoney(C0.saved)],
      ['Gold market price effect',goldPriceEffect==null?'Not available':signedMoney(goldPriceEffect)],
      ['Other changes / reconciliation',bridgeResidual==null?'Not available':signedMoney(bridgeResidual)],
      ['Closing net worth',money0(net)]],boldLast:true,
      note:goldPriceEffect==null?'Gold price impact cannot be isolated without a comparable price for both months.':'The reconciliation line is shown explicitly instead of attributing unexplained changes to contributions. Gold purchases are not counted as market gains.'});
  }
  if(gmAll.length){
    const hist=gmAll.filter(x=>x.k<=k).slice(-18),cGold='#B68B3E',cCost='#346F9E',cMarket='#267C6A';
    D.sections.push({type:'chart',title:'Gold price history · USD per 24k gram (recorded / estimated)',cfg:{type:'line',data:{labels:hist.map(x=>lbl(x.k)),datasets:[{label:'Market price / g (24k)',data:hist.map(x=>x.px),borderColor:cGold,backgroundColor:'rgba(182,139,62,.10)',tension:.25,pointRadius:2,spanGaps:false}]},options:opt()}});
    D.sections.push({type:'chart',title:'Your gold · cumulative cost vs market value',cfg:{type:'line',data:{labels:hist.map(x=>lbl(x.k)),datasets:[
      {label:'Cumulative amount invested',data:hist.map(x=>x.cost),borderColor:cCost,tension:.2,pointRadius:2},
      {label:'Market value of holdings',data:hist.map(x=>x.value),borderColor:cMarket,tension:.2,pointRadius:2,spanGaps:false}]},options:opt()}});
    D.sections.push({type:'table',title:'Gold investment · monthly and cumulative',cols:[['Metric',0],['This month',1],['Total to date',1]],rows:[
      ['Gold bought · paid',money0(goldBought),money0(goldCost)],
      ['Gold bought · grams',`${rows.filter(x=>x.yyyyMM===k&&!isLoanRow(x)).reduce((a,x)=>a+(x.gold||0),0).toFixed(2)} g`,`${grams.toFixed(2)} g`],
      ['Gold market value',signedMoney(currentGoldValue-priorGoldValue),money0(goldW)],
      ['Gold price-only effect',goldPriceEffect==null?'—':signedMoney(goldPriceEffect),'—'],
      ['Unrealized gain / loss', '—',signedMoney(goldW-goldCost)]],
      note:'The market-value change includes both purchases and price movement. The price-only effect excludes newly purchased gold. Historical prices may be estimated or manually entered.'});
    const buys=rows.filter(d=>d.sortTs<R.b&&!isLoanRow(d)&&(d.gold||0)>0).sort((a,b)=>b.sortTs-a.sortTs);
    if(buys.length)D.sections.push({type:'table',title:'Gold purchase ledger · recorded lots',cols:[['Date',0],['Contributor',0],['Gold',1],['Paid',1]],rows:buys.map(d=>[(d.date||'').split(' ')[0],cap(ownerKey(d.name))||'—',`${Number(d.gold||0).toFixed(2)} g`,money0((d.gold||0)*(d.goldPrice||0))]),note:'Purchase prices reflect amounts recorded in the ledger. For detailed purity and individual lot valuation, use Gold over time on the dashboard.'});
  }
  /* what stands out */
  const ins=[];
  const prev6=[];for(let i=1;i<=6;i++){const kk=addMonths(k,-i);if(t.comp[kk])prev6.push(t.comp[kk].delta*(isFM(kk)?JF:1));}
  if(prev6.length>=2){const a=prev6.reduce((s,x)=>s+x,0)/prev6.length;if(a>0)ins.push(`You saved ${money0(C0.saved)} in ${label}, ${pS(C0.saved/a-1)} against your ${prev6.length}-month average of ${money0(a)}.`);}
  const tp=PP.map((p,i)=>[p,C0.p[i]]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]),tps=tp.reduce((s,x)=>s+x[1],0);
  if(tp.length>1)ins.push(tp.map(([p,x])=>`${p} put in ${money0(x)} (${Math.round(x/tps*100)}%)`).join(', ')+'.');
  if(Math.abs(nonContributor)>0.5)ins.push(`Named contributions total ${money0(contributorSum)} but net savings are ${money0(C0.saved)}. Difference: ${signedMoney(nonContributor)} from loan entries, withdrawals or other adjustments. Review the contribution breakdown.`);
  else if(tp.length===1)ins.push(`${tp[0][0]} put in all ${money0(tp[0][1])} of the month's deposits.`);
  if(hasYL&&ytdYoy!=null)ins.push(`Year to date you saved ${money0(Y0.saved)}, ${pS(ytdYoy)} against ${money0(YL.saved)} by ${MON[R.m-1]} ${R.y-1}.`);
  if(path&&gap!=null){
    const left=Math.max(0,12-R.m),need=left>0?(path.goal-cb)/left:0;
    ins.push(gap>=0?`You are ${money0(gap)} ahead of the path to ${money0(path.goal)} by December ${R.y}.`
      :`You are ${money0(-gap)} behind the path to ${money0(path.goal)}.${left>0?` Landing on target needs ${money0(need)} a month for the ${left} month${left>1?'s':''} left.`:''}`);
  }
  if(gm&&gm.priceEffect!=null&&gm.k===k&&Math.abs(gm.priceEffect)>0.5)ins.push(`The gold price ${gm.priceEffect>=0?'added':'took off'} ${money0(Math.abs(gm.priceEffect))} ${gm.priceEffect>=0?'to':'from'} the gold you hold${gm.mom!=null?` (gold ${pS(gm.mom)} on the month)`:''}.`);
  const ents=rows.filter(d=>d.sortTs>=R.a&&d.sortTs<R.b&&Math.abs(rowAmt(d))>0.005).sort((a,b)=>a.sortTs-b.sortTs);
  if(ents.length){const big=ents.reduce((a,d)=>Math.abs(rowAmt(d))>Math.abs(rowAmt(a))?d:a,ents[0]);ins.push(`${ents.length} entr${ents.length>1?'ies':'y'} this month. The largest was ${money0(Math.abs(rowAmt(big)))} from ${cap(ownerKey(big.name))||'an unnamed entry'} on ${(big.date||'').split(' ')[0]}.`);}
  else ins.push('No entries were recorded this month.');
  D.sections.push({type:'insights',title:'What stands out',items:ins});
  /* charts */
  if(path){
    const ax=[];for(let i=0;i<=path.span;i++)ax.push(addMonths(path.firstKey,i));
    const fy=+t.keys[0].slice(0,4);
    D.sections.push({type:'chart',title:`Balance against the phased goal, ${R.y}`,cfg:{type:'line',data:{labels:ax.map((kk,i)=>i===0&&R.y>fy?`Dec ’${String(R.y-1).slice(2)}`:lbl(kk)),datasets:[
      {label:'Balance',data:ax.map(kk=>kk<=k?cumAt(t,kk):null),borderColor:C.cash,backgroundColor:'rgba(47,93,138,0.10)',fill:true,tension:.3,borderWidth:2.4,pointRadius:2},
      {label:'Phased goal',data:ax.map(kk=>path.at(kk)),borderColor:C.gold,borderDash:[6,5],borderWidth:1.8,pointRadius:0}]},options:opt()}});
  }
  const ym=[];for(let m=1;m<=R.m;m++){const kk=`${R.y}-${p2(m)}`;if(kk>=firstMonth())ym.push(kk);}
  const MB=ym.map(kk=>{const r=mRange(kk);return {k:kk,...bucket(rows,r.a,r.b)};});
  const actP=PP.map((_,i)=>i).filter(i=>MB.some(o=>Math.abs(o.p[i])>0.5));
  D.sections.push({type:'chart',title:`Saved per month, ${R.y}`,cfg:{type:'bar',data:{labels:MB.map(o=>lbl(o.k)),datasets:[
    ...actP.map(i=>({label:PP[i],data:MB.map(o=>o.p[i]),backgroundColor:pcol(i),stack:'s'})),
    ...(MB.some(o=>Math.abs(o.saved-o.p.reduce((a,b)=>a+b,0))>0.5)?[{label:'Loans and other',data:MB.map(o=>o.saved-o.p.reduce((a,b)=>a+b,0)),backgroundColor:C.debt,stack:'s'}]:[])]},options:opt({stacked:true})}});
  /* scorecard */
  const M=[['Saved',o=>o.saved],...PP.map((p,i)=>[`${p} added`,o=>o.p[i]]).filter((m,i)=>Math.abs(C0.p[i])+Math.abs(P0.p[i])+Math.abs(L0.p[i])+Math.abs(Y0.p[i])>0.5),['Gold bought',o=>o.gold]];
  const dc=(a,b,ok)=>{if(!ok)return tc('n/a');const v=pcOf(a,b);return tc(v==null?signed0(a-b):`${pS(v)}  (${signed0(a-b)})`,a-b>=0?'pos':'neg');};
  D.sections.push({type:'table',title:`${label} against last month and last year`,cols:[['',0],[label,1],[fk(pk),1],['Month on month',1],[fk(lk),1],['Year on year',1]],
    rows:[...M.map(([l,g])=>[l,money0(g(C0)),hasPrev?money0(g(P0)):'—',dc(g(C0),g(P0),hasPrev),hasLy?money0(g(L0)):'—',dc(g(C0),g(L0),hasLy)]),
      ['Balance at end',money0(bal),hasPrev?money0(balP):'—',dc(bal,balP,hasPrev),hasLy?money0(balL):'—',dc(bal,balL,hasLy)]]});
  D.sections.push({type:'table',title:`Year to date, 1 January to end of ${label}`,cols:[['',0],[String(R.y),1],[String(R.y-1),1],['Year on year',1]],
    rows:M.map(([l,g])=>[l,money0(g(Y0)),hasYL?money0(g(YL)):'—',dc(g(Y0),g(YL),hasYL)])});
  /* the year month by month */
  D.sections.push({type:'table',title:`${R.y} month by month`,cols:[['Month',0],['Saved',1],...actP.map(i=>[PP[i],1]),['Gold bought',1],['Balance',1],['vs goal',1]],
    rows:MB.map(o=>{const b=cumAt(t,o.k),g=path?goalRatio(R.y,path,t,o.k,b):null;return [fk(o.k),money0(o.saved),...actP.map(i=>money0(o.p[i])),o.gold?money0(o.gold):'—',money0(b),tc(g==null?'—':pS(g),tone(g))];})});
  /* what you hold */
  const hold=[['Cash',money0(cash),money0(cash),'—']];
  if(grams>0)hold.push([`Gold, ${grams.toFixed(1)} g`,money0(goldCost),money0(goldW),tc(goldCost?pS(goldW/goldCost-1):'—',goldW>=goldCost?'pos':'neg')]);
  if(loan>0.5)hold.push(['Loans',`−${money0(loan)}`,`−${money0(loan)}`,'—']);
  hold.push(['Net worth',money0(cash+goldCost-loan),money0(net),tc(Math.abs(goldW-goldCost)>0.5?signed0(goldW-goldCost):'—',goldW>=goldCost?'pos':'neg')]);
  D.sections.push({type:'table',title:`What you hold at the end of ${label}`,cols:[['',0],['Paid',1],['Worth',1],['Change',1]],rows:hold,boldLast:true});
  if(gm&&grams>0){
    const kk=gset().karat;
    D.sections.push({type:'table',title:'Gold and the market',cols:[['',0],['',1]],rows:[
      [`Price per gram, ${kk}k`,money2(gm.px*kk/24)],[`Price per gram, 24k`,money2(gm.px)],
      ['Change on the month before',tc(gm.mom==null?'n/a':pS(gm.mom),tone(gm.mom))],['Change on a year before',tc(gm.yoy==null?'n/a':pS(gm.yoy),tone(gm.yoy))],
      ['What the price did to your gold this month',tc(gm.priceEffect==null||gm.k!==k?'—':signed0(gm.priceEffect),tone(gm.priceEffect))]],
      note:gm.src==='market'||gm.src==='live'||gm.src==='manual'?'':'The gold price for this month is an estimate, because no market price was available.'});
  }
  /* entries */
  D.sections.push({type:'table',title:`Entries in ${label}`,cols:[['Date',0],['Who',0],['Type',0],['Amount',1]],
    rows:ents.length?ents.map(d=>[(d.date||'').split(' ')[0],cap(ownerKey(d.name))||'—',isLoanRow(d)?'Loan':(d.gold>0?`Gold ${d.gold} g${kOf(d)?` ${kOf(d)}k`:''}`:'Cash'),tc(signed0(rowAmt(d)),rowAmt(d)>=0?'pos':'neg')]):[['No entries','','','']]});
  D.foot='Saved, each person’s added amount and Gold bought count gold at what you paid. Balances and net worth count gold at the market price of the month.'+(R.y===firstYearAll()&&startSaving()!=null?` ${fmTxt()} counts as ${money0(startSaving())}, your real saving that month, not the savings brought in.`:'');
  return D;
}

/* ----- on screen ----- */
document.body.insertAdjacentHTML('beforeend',`<div id="rp" hidden><div class="rp-bar"><button type="button" id="rp-close" aria-label="Close">✕</button><select class="month-select" id="rp-sel" aria-label="Month"></select><button type="button" id="rp-pdf">Export PDF</button></div><div class="rp-body" id="rp-body"></div></div>`);
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
    else if(s.type==='chart'){h+=`<div class="rp-h2">${esc(s.title)}</div><div class="rp-ch"><div><canvas id="rp-c${cfgs.length}"></canvas></div></div>`;cfgs.push(s.cfg);}
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
  $('x-rep-s').textContent='Contributors, wealth bridge, gold market charts and all entries. Export to PDF.';
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
function chartJpeg(cfg,w,h){
  const box=document.createElement('div');box.style.cssText=`position:fixed;left:-9999px;top:0;width:${w}px;height:${h}px`;
  const cv=document.createElement('canvas');cv.width=w*2;cv.height=h*2;cv.style.width=w+'px';cv.style.height=h+'px';box.appendChild(cv);document.body.appendChild(box);
  let url='';
  try{
    const c=JSON.parse(JSON.stringify({type:cfg.type,data:cfg.data}));const o=opt(cfg.options&&cfg.options.scales&&cfg.options.scales.x&&cfg.options.scales.x.stacked?{stacked:true}:null);
    o.responsive=false;o.animation=false;o.devicePixelRatio=2;c.options=o;
    const ch=new Chart(cv,c);
    const out=document.createElement('canvas');out.width=cv.width;out.height=cv.height;const g=out.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,out.width,out.height);g.drawImage(cv,0,0);
    url=out.toDataURL('image/jpeg',0.9);try{ch.destroy();}catch(e){}
    return {url,pw:out.width,ph:out.height};
  }catch(e){console.error(e);return null;}
  finally{box.remove();}
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
      const h=172;need(h+34);P.text(L,y+10,s.title,{size:12.5,bold:true});y+=20;
      const im=chartJpeg(s.cfg,Math.round(CW),h);
      if(im)P.image(im.url,L,y,CW,h,im.pw,im.ph);else P.text(L,y+20,'Chart not available.',{size:9,color:MUT});
      P.rect(L,y,CW,h,null,LINE);y+=h+16;
    }else if(s.type==='table'){
      const n=s.cols.length,fs=n>7?7.6:(n>5?8.4:9.2),rh=fs+8.5,first=n<=2?CW*0.62:Math.max(96,Math.min(170,CW-(n-1)*78)),cw=(CW-first)/Math.max(1,n-1);
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
/* Compact A4 executive report; the existing detailed report remains available on screen. */
function buildOnePagePdf(D){
  const P=PdfDoc(),L=38,R=P.W-38,W=R-L,N='#162A3A',M='#687786',B='#E5EAF0',GREEN='#187A62',RED='#B6534E',GOLD='#B68B3E';
  P.page();const row=allData,range=mRange(D.k),prev=mRange(addMonths(D.k,-1)),year=new Date(range.y,0,1).getTime();
  const cur=bucket(row,range.a,range.b),ytd=bucket(row,year,range.b),previous=bucket(row,prev.a,prev.b);
  const t=computeAnalytics(row),path=pathFor(range.y,t),actual=cumAt(t,D.k),target=path?path.at(D.k):null;
  const value=(end)=>{let cash=0,cost=0,g=0,loans=0;row.forEach(d=>{if(!(d.sortTs<end))return;if(isLoanRow(d))loans-=d.usd||0;else{cash+=d.usd||0;cost+=(d.gold||0)*(d.goldPrice||0);g+=d.gold||0;}});let price=null;try{const gs=goldMonthly(row).filter(x=>x.k<=(end===range.b?D.k:addMonths(D.k,-1))&&x.px);if(gs.length)price=gs[gs.length-1].px;}catch(e){};const units=row.filter(d=>d.sortTs<end&&!isLoanRow(d)).reduce((a,d)=>a+(d.gold||0)*rowKarat(d)/24,0);return {cash,cost,grams:g,loans,gold:g>0?(price!=null?units*price:cost):0,price};};
  const now=value(range.b),before=value(prev.b),nw=now.cash+now.gold-now.loans,pw=before.cash+before.gold-before.loans,change=nw-pw;
  const goldFlow=now.gold-before.gold,acquired=now.cost-before.cost;
  // New gold purchases transfer value from cash to gold, not new net worth.
  const market=goldFlow-acquired,contribution=cur.saved,other=change-contribution-market;
  const fmt=n=>money0(n),sign=n=>(n>=0?'+':'−')+fmt(Math.abs(n)),pct=n=>n==null?'—':pS(n);
  const txt=(x,y,v,size=10,color=N,bold=false,align='left')=>P.text(x,y,v,{size,color,bold,align});
  const line=(y)=>P.line(L,y,R,y,B,.8);
  const title=(y,v)=>txt(L,y,v.toUpperCase(),9,M,true);
  txt(L,43,'SAVINGS LEDGER  /  MONTHLY WEALTH REVIEW',9,M,true);
  txt(L,77,D.label,27,N,true);txt(R,75,D.partial?'MONTH TO DATE':'MONTH CLOSED',8,M,true,'right');
  line(91);
  const cards=[['NET WORTH',fmt(nw),sign(change)+' vs prior month'],['MONTHLY SAVED',fmt(cur.saved),'YTD '+fmt(ytd.saved)],['VS PHASED PLAN',target==null?'Not set':sign(actual-target),target==null?'Set target in Data':(actual>=target?'Ahead of plan':'Behind plan')]];
  cards.forEach((c,i)=>{const x=L+i*(W/3+1),w=W/3-8;P.rect(x,105,w,78,'#F3F6F8');txt(x+10,123,c[0],8,M,true);txt(x+10,148,c[1],17,i===2&&target!=null?(actual>=target?GREEN:RED):N,true);txt(x+10,169,c[2],8,M);});
  title(212,'Monthly wealth bridge');txt(R,212,'Change in net worth '+sign(change),9,N,true,'right');
  const bridge=[['Opening wealth',pw],['Net contributions',contribution],['Gold market effect',market],['Other / reconciliation',other],['Closing wealth',nw]];
  bridge.forEach(([label,n],i)=>{const yy=235+i*27;txt(L+5,yy,label,10,i===0||i===4?N:M,i===0||i===4);txt(R-5,yy,i===0||i===4?fmt(n):sign(n),10,i===2?(n>=0?GREEN:RED):N,true,'right');if(i!==4)P.line(L,yy+9,R,yy+9,B,.45);});
  title(391,'Savings trajectory · actual vs plan');
  const months=[];for(let i=1;i<=range.m;i++){const k=range.y+'-'+String(i).padStart(2,'0');if(k>=firstMonth())months.push(k);}
  const data=months.map(k=>({k,a:cumAt(t,k),p:path?path.at(k):null}));
  const vals=data.flatMap(d=>[d.a,d.p]).filter(Number.isFinite),min=Math.min(...vals,0),max=Math.max(...vals,1),span=max-min||1;
  const X=L+16,Y=416,CW=W-32,CH=91;
  for(let i=0;i<4;i++)P.line(X,Y+i*CH/3,X+CW,Y+i*CH/3,B,.5);
  const plot=(key,color)=>{for(let i=1;i<data.length;i++){const a=data[i-1][key],b=data[i][key];if(a==null||b==null)continue;const x1=X+(i-1)*CW/Math.max(1,data.length-1),x2=X+i*CW/Math.max(1,data.length-1);P.line(x1,Y+CH-(a-min)/span*CH,x2,Y+CH-(b-min)/span*CH,color,2);}};
  plot('a','#306B9B');if(path)plot('p',GOLD);
  txt(X,Y+CH+14,months.length?lbl(months[0]):'',8,M);txt(X+CW,Y+CH+14,months.length?lbl(months[months.length-1]):'',8,M,false,'right');
  txt(L,542,'— Actual',9,'#306B9B',true);if(path)txt(L+88,542,'— Phased goal',9,GOLD,true);
  line(553);title(575,'Gold · position and performance');
  const gmetrics=[['HOLDINGS',now.grams.toFixed(2)+' g'],['INVESTED COST',fmt(now.cost)],['MARKET VALUE',fmt(now.gold)],['UNREALIZED P/L',sign(now.gold-now.cost)]];
  gmetrics.forEach((m,i)=>{const x=L+(i%2)*W/2,yy=599+Math.floor(i/2)*38;txt(x,yy,m[0],8,M,true);txt(x,yy+18,m[1],13,N,true);});
  txt(L,680,'Gold price impact this month: '+sign(market)+'  |  Gold acquired: '+Math.max(0,now.grams-before.grams).toFixed(2)+' g',9,market<0?RED:GREEN);
  line(699);title(722,'Performance at a glance');
  txt(L,743,'',9);txt(L,743,'NET CONTRIBUTIONS',8,M,true);txt(L+218,743,'MONTH',8,M,true);txt(R,743,'YTD',8,M,true,'right');
  txt(L,762,'Savings added',10,N);txt(L+218,762,fmt(cur.saved),10,N,true);txt(R,762,fmt(ytd.saved),10,N,true,'right');
  const remaining=Math.max(0,12-range.m),need=path&&remaining?(path.goal-actual)/remaining:null;
  const insight=target==null?'Set a savings goal in Data to unlock plan tracking.':(actual>=target?'Savings are ahead of the phased plan.':'Savings are below the phased plan.')+(need!=null?' Remaining monthly pace: '+fmt(Math.max(0,need))+'.':'');
  txt(L,790,insight,8,M);txt(L,813,'Market gold values are estimates; internal asset transfers are not new savings.',7,M);
  txt(R,813,'Generated '+new Date().toISOString().slice(0,10),7,M,false,'right');
  return P.bytes();
}
window.lgBuildDetailedPdf=k=>buildPdf(reportData(k));
window.lgBuildPdf=k=>buildPdf(reportData(k));

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
function reportFromHash(){const m=/^#report=(\d{4}-\d{2})$/.exec(location.hash);if(m&&allData.length){history.replaceState(null,'',location.pathname+location.search);openReport(m[1]);}}
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
    applyView();renderRepCard();
    if(!$('rp').hidden)renderReport();
  }catch(e){console.error(e);}
};
window.lgGoView=goView;
window.lgAfterSync=()=>{try{renderSettings();}catch(e){}};
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
    }
    history.replaceState(null,'',location.pathname+location.search);
  }
}catch(e){}
// Recover the selected ledger cache after a reload. Older unscoped installations
// are left intact until the user explicitly connects to a ledger.
try{const id=localStorage.getItem(ACCOUNT_ACTIVE);if(id){
  const cached=JSON.parse(localStorage.getItem('lg-account-cache-v2:'+id)||'null');
  if(cached){ACCOUNT_KEYS.forEach(k=>cached[k]==null?localStorage.removeItem(k):localStorage.setItem(k,cached[k]));CFG=JSON.parse(localStorage.getItem(CFGKEY)||'{}');_ppl=null;}
}}catch(e){}
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
const c0=cfg();if(c0){$('x-sync-url').value=toLogin(c0.url);$('x-sync-token').value=c0.token;}
status();renderAll();
if(c0)sync({quiet:true});
refreshGold();
fetchGoldHistory().then(ok=>{if(ok&&!busy())renderAll();});
})();
