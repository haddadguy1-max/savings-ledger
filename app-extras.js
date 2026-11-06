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
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();}catch(e){}

/* ---------- styles and markup ---------- */
const css=`
[hidden]{display:none!important}
body{padding-bottom:calc(96px + env(safe-area-inset-bottom))!important}
#x-fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:150;background:var(--ink);color:#fff;border:0;
 border-radius:999px;padding:14px 22px;font:600 15px "IBM Plex Sans",sans-serif;box-shadow:0 6px 20px rgba(22,35,47,.3);cursor:pointer;-webkit-tap-highlight-color:transparent}
#x-fab:active{transform:scale(.97)}
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
  <div class="toggle-group" id="x-who"><button type="button" data-who="guy">Guy</button><button type="button" data-who="lea">Lea</button></div>
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
 <div class="kpi-sub" style="font-size:13.5px;margin-top:8px">Tap <strong>Add entry</strong> to record a deposit, a gold purchase or a loan, or import a CSV from the Your data section at the bottom.</div></div>`);
main.insertAdjacentHTML('beforeend',`<div class="section" id="x-data"><div class="section-header"><h2>Your data</h2><span class="hint" id="x-data-hint"></span></div>
 <div class="kpi-card"><div class="kpi-sub" style="font-size:13px;margin:0">Entries live on this device only. Export a backup now and then, and use it to move the ledger to another phone.</div>
 <div class="x-btns"><button type="button" id="x-export">Export backup (CSV)</button><label for="file-input">Import CSV</label><button type="button" id="x-reset">Restore original data</button><button type="button" id="x-clear" class="danger">Clear all data</button></div></div></div>`);
const thr=document.querySelector('#tx-table thead tr');
if(thr){const th=document.createElement('th');th.className='r';th.setAttribute('aria-label','Actions');thr.appendChild(th);}

/* ---------- storage ---------- */
let undoSnap=null,toastTimer=null;
const snapshot=()=>{undoSnap=JSON.stringify(allData);};
const SIGF=['date','type','gold','eur','usd','name','goldPrice'];
const sig=r=>JSON.stringify(SIGF.map(f=>r[f]));
function persist(){try{localStorage.setItem(KEY,JSON.stringify(allData));localStorage.setItem(TOMB,JSON.stringify(tomb));}catch(e){toast('Could not save on this device. Export a backup.');}}
/* Every local change goes through save(): it stamps changed rows, remembers deletions, then schedules a sync. */
function save(){
  const now=Date.now(),seen={};ver++;
  allData.forEach(r=>{seen[r.id]=1;const s=sig(r);if(lastSig[r.id]!==s){r.updated=now;lastSig[r.id]=s;delete tomb[r.id];}});
  Object.keys(lastSig).forEach(id=>{if(!seen[id]){tomb[id]=now;delete lastSig[id];}});
  persist();scheduleSync();
}
function loadSaved(){try{const r=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(r)?r:[];}catch(e){return [];}}
function status(){
  $('file-info').textContent=(allData.length?`${allData.length} entries`:'No entries yet')+(cfg()?` · ${syncState||'Sheets sync on'}`:' · saved on this device');
  const b=readPrefs().lastBackup;$('x-data-hint').textContent=b?`Last backup ${b}`:'No backup yet';
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
const isLoanRow=d=>(d.name||'').includes('loan');
const isGoldRow=d=>!isLoanRow(d)&&(d.gold||0)>0;
const goldNow=d=>{const p=px24();return p>0?(d.gold||0)*p*rowKarat(d)/24:(d.gold||0)*(d.goldPrice||0);};
function lfPass(d){
  const n=d.name||'',loan=isLoanRow(d),gold=isGoldRow(d);
  if(LF.who==='guy'&&!n.includes('guy'))return false;
  if(LF.who==='lea'&&!n.includes('lea'))return false;
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
  set('x-lf-who',[['','Everyone'],['guy','Guy'],['lea','Lea']],LF.who);
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
      <td class="x-click" data-lf="who" data-val="${esc((d.name||'').includes('guy')?'guy':(d.name||'').includes('lea')?'lea':'')}" style="font-weight:500;text-transform:capitalize">${esc(d.name)}</td>
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
const S={kind:'deposit',who:'guy',editId:null};
function setKind(k){S.kind=k;document.querySelectorAll('#x-kinds button').forEach(b=>b.classList.toggle('active',b.dataset.kind===k));
  $('x-goldbox').hidden=k!=='gold';$('x-cashbox').hidden=k==='gold';preview();}
function setWho(w){S.who=w;document.querySelectorAll('#x-who button').forEach(b=>b.classList.toggle('active',b.dataset.who===w));}
function preview(){
  let t='';
  if(S.kind==='gold'){const g=num($('x-g').value),v=g*num($('x-p').value);if(v>0)t=`${g} g worth ${money2(v)} · net worth +${money2(v)}`;}
  else{const a=num($('x-amt').value);if(a>0)t={deposit:`Cash +${money2(a)} · net worth +${money2(a)}`,withdraw:`Cash −${money2(a)} · net worth −${money2(a)}`,
    loan_taken:`Loans +${money2(a)} · net worth −${money2(a)}`,loan_repaid:`Loans −${money2(a)} · net worth +${money2(a)}`}[S.kind];}
  $('x-prev').textContent=t;
}
function openSheet(row){
  const pr=readPrefs();S.editId=row?row.id:null;$('x-err').textContent='';
  $('x-title').textContent=row?'Edit entry':'New entry';$('x-again').hidden=!!row;$('x-save').textContent=row?'Save changes':'Save entry';
  if(row){
    const n=row.name||'',loan=n.includes('loan');
    setKind(loan?(row.usd<0?'loan_taken':'loan_repaid'):row.gold>0?'gold':(row.usd<0?'withdraw':'deposit'));
    setWho(n.includes('lea')?'lea':'guy');
    $('x-amt').value=row.gold>0?'':Math.abs(row.usd||0)||'';$('x-g').value=row.gold>0?row.gold:'';$('x-p').value=row.goldPrice||'';$('x-k').value=(/(\d{2})\s*k/i.exec(row.type||'')||['',''])[1];
    $('x-date').value=toYMD(row.sortTs)||toYMD(Date.now());
  }else{
    setKind(pr.kind||'deposit');setWho(pr.who||'guy');
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
  const k=S.kind,row={id:S.editId||uid(),date,sortTs:parseSortDate(date),yyyyMM:parseDateToYYYYMM(date),type:'Cash USD',gold:0,eur:0,usd:0,goldPrice:0,name:S.who};
  if(k==='gold'){
    const g=num($('x-g').value),p=num($('x-p').value);
    if(!(g>0)||!(p>0)){err.textContent='Enter grams and a price per gram above zero.';return;}
    const kt=$('x-k').value;row.type=kt?`Gold ${kt}k`:'Gold';row.gold=g;row.goldPrice=p;writePrefs({price:p,karat:kt});
  }else{
    const a=num($('x-amt').value);
    if(!(a>0)){err.textContent='Enter an amount above zero.';return;}
    row.usd=(k==='withdraw'||k==='loan_taken')?-a:a;
    if(k==='loan_taken'||k==='loan_repaid')row.name=S.who+' - loan';
  }
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
$('x-who').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setWho(b.dataset.who);});
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
  const row={id:uid(),date,sortTs:parseSortDate(date),yyyyMM:parseDateToYYYYMM(date),type:'Cash USD',gold:0,eur:0,usd:0,goldPrice:0,name:'guy'};
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
$('x-data').insertAdjacentHTML('beforebegin',`<div class="section" id="x-sync"><div class="section-header"><h2>Google Sheets sync</h2><span class="hint" id="x-sync-status"></span></div>
 <div class="kpi-card"><div class="kpi-sub" style="font-size:13px;margin:0 0 4px">Every entry is copied to your Google Sheet automatically, and changes made by Lea, on another phone or in the Sheet itself flow back here. Treat the web app link and secret token like a password.</div>
 <label class="x-label" for="x-sync-url">Web app link</label><input id="x-sync-url" class="x-input" autocomplete="off" autocapitalize="off" placeholder="https://script.google.com/macros/s/…/exec">
 <label class="x-label" for="x-sync-token">Secret token</label><input id="x-sync-token" type="password" class="x-input" autocomplete="off" autocapitalize="off">
 <div class="x-btns"><button type="button" id="x-sync-connect">Connect</button><button type="button" id="x-sync-invite">Copy invite link</button><button type="button" id="x-sync-now">Sync now</button><button type="button" id="x-sync-off" class="danger">Disconnect</button></div></div></div>`);
const cfg=()=>{try{return JSON.parse(localStorage.getItem(SYNC)||'null');}catch(e){return null;}};
const isTrue=v=>v===true||v===1||String(v).toLowerCase()==='true';
function setSyncState(t){syncState=t;const el=$('x-sync-status');if(el)el.textContent=t;status();}
function scheduleSync(){if(!cfg())return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>sync({quiet:true}),1500);}
function busy(){const a=document.activeElement;return !$('x-sheet').hidden||!!(a&&a.classList&&a.classList.contains('x-cell'));}
function errText(e){return e.message==='unauthorized'?'Wrong secret token.':e.message==='bad-reply'?'The Sheet did not answer. Check the web app link and that access is set to Anyone.':'Offline. Changes are saved here and will sync later.';}
async function api(method,body){
  const c=cfg();let r,j;
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
    const remote=(await api('GET')).rows||[],rmap={};
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
    if(push.length)await api('POST',{rows:push});
    if(ver!==v0)syncAgain=true;
    else{
      const sg=a=>JSON.stringify(a.map(r=>r.id+'|'+r.updated+'|'+sig(r)).sort());
      const changed=sg(rows)!==sg(allData);
      allData=rows;tomb=nt;lastSig={};allData.forEach(r=>{lastSig[r.id]=sig(r);});persist();
      if(changed)renderAll();
    }
    const n=new Date();setSyncState(`Synced ${p2(n.getHours())}:${p2(n.getMinutes())}`);
  }catch(e){setSyncState(errText(e));if(o.manual)toast(errText(e));}
  finally{syncing=false;if(syncAgain){syncAgain=false;scheduleSync();}}
}
$('x-sync-connect').onclick=async()=>{
  const url=$('x-sync-url').value.trim(),token=$('x-sync-token').value.trim();
  if(!/^https:\/\/script\.google\.com\/\S+/.test(url)||!token){toast('Paste the web app link and your secret token.');return;}
  localStorage.setItem(SYNC,JSON.stringify({url,token}));setSyncState('Connecting…');
  let adopt=false;
  try{
    const remote=((await api('GET')).rows||[]).filter(x=>!isTrue(x.deleted));
    if(remote.length&&allData.length)adopt=confirm(`The Sheet already has ${remote.length} rows and this device has ${allData.length}.\n\nOK: use the Sheet's data and replace this device's.\nCancel: merge both (can create duplicates).`);
  }catch(e){localStorage.removeItem(SYNC);setSyncState('');status();toast(errText(e));return;}
  await sync({manual:true,adopt});
};
$('x-sync-invite').onclick=async()=>{
  const c=cfg();if(!c){toast('Connect to your Sheet first.');return;}
  const link=location.origin+location.pathname+'#join='+btoa(unescape(encodeURIComponent(JSON.stringify({u:c.url,t:c.token}))));
  try{await navigator.clipboard.writeText(link);toast('Invite link copied. Send it privately: anyone with it can edit the ledger.');}
  catch(e){prompt('Copy this invite link and send it privately:',link);}
};
$('x-sync-now').onclick=()=>{if(!cfg()){toast('Connect to your Sheet first.');return;}sync({manual:true});};
$('x-sync-off').onclick=()=>{localStorage.removeItem(SYNC);$('x-sync-token').value='';setSyncState('');status();toast('Disconnected. Your data stays on this device.');};
setInterval(()=>{if(cfg()&&!document.hidden)sync({quiet:true});},45000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cfg())sync({quiet:true});});
window.addEventListener('online',()=>{if(cfg())sync({quiet:true});});

/* ---------- gold valuation: market price instead of purchase price ---------- */
const GKEY='lg-gold-v1',OZ=31.1034768;
const gDefault={mode:'market',karat:24,manual:'',px:0,at:0};
const gset=()=>{try{return Object.assign({},gDefault,JSON.parse(localStorage.getItem(GKEY)||'{}'));}catch(e){return Object.assign({},gDefault);}};
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
  }
  return t;
};
const baseKPIs=updateKPIs;
updateKPIs=function(t){
  baseKPIs(t);
  if(t.goldGrams>0)$('gold-sub').textContent=t.goldPx>0
    ?`${t.goldGrams.toFixed(1)} g at ${money2(t.goldPx)}/g · ${signed0(t.gold-t.goldCost)} vs cost`
    :`${t.goldGrams.toFixed(1)} g at purchase price`;
};
$('x-sync').insertAdjacentHTML('beforebegin',`<div class="section" id="x-gold"><div class="section-header"><h2>Gold valuation</h2><span class="hint" id="x-gold-status"></span></div>
 <div class="kpi-card"><div class="kpi-sub" style="font-size:13px;margin:0 0 4px">Gold in your net worth follows today's market price, scaled by each entry's purity. Savings, targets and the monthly charts keep using what you paid.</div>
 <label class="x-label" for="x-gold-mode">Value gold at</label><select id="x-gold-mode" class="x-input"><option value="market">Market price</option><option value="cost">Purchase price</option></select>
 <label class="x-label" for="x-gold-karat">Default purity, for entries without one</label><select id="x-gold-karat" class="x-input"><option value="24">24k</option><option value="22">22k</option><option value="21">21k</option><option value="18">18k</option></select>
 <label class="x-label" for="x-gold-manual">Or type today's price per gram at the default purity, in USD (optional)</label><input id="x-gold-manual" class="x-input" inputmode="decimal" autocomplete="off" placeholder="Leave empty to use the live price">
 <div class="x-btns"><button type="button" id="x-gold-refresh">Refresh price</button></div></div></div>`);
function goldStatus(extra){
  const g=gset();let t;
  if(g.mode!=='market')t='Using purchase prices';
  else if(num(g.manual)>0)t=`Your price ${money2(num(g.manual))}/g at ${g.karat}k`;
  else if(g.px>0){const d=new Date(g.at);t=`24k ${money2(g.px)}/g · ${p2(d.getHours())}:${p2(d.getMinutes())}`;}
  else t='No price yet, using purchase prices';
  $('x-gold-status').textContent=t+(extra?' · '+extra:'');
}
async function fetchGold(){
  try{
    const r=await fetch('https://api.gold-api.com/price/XAU',{cache:'no-store'});
    const oz=Number((await r.json()).price);
    if(!(oz>500&&oz<20000))return false;
    gsave({px:oz/OZ,at:Date.now()});{const k=toYMD(Date.now()).slice(0,7),s=(hget().snap)||{};s[k]=oz/OZ;hsave({snap:s});}return true;
  }catch(e){return false;}
}
async function refreshGold(){
  if(gset().mode!=='market'||num(gset().manual)>0){goldStatus();return;}
  const ok=await fetchGold();
  goldStatus(ok?'':'live price unavailable');
  if(!busy())renderAll();
}
const gm=gset();$('x-gold-mode').value=gm.mode;$('x-gold-karat').value=String(gm.karat);$('x-gold-manual').value=gm.manual;goldStatus();
$('x-gold-mode').onchange=e=>{gsave({mode:e.target.value});goldStatus();renderAll();if(e.target.value==='market')refreshGold();};
$('x-gold-karat').onchange=e=>{gsave({karat:+e.target.value});goldStatus();renderAll();};
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
function monthPx(k){const h=hget();return(h.m&&h.m[k])||(h.snap&&h.snap[k])||0;}
/* One row per month from the first gold purchase: 24k price, the value of the gold held, and the moves in %.
   Price comes from market history, else from what you paid that month, else the last known price. */
function goldMonthly(rows){
  const g=rows.filter(r=>!(r.name||'').includes('loan')&&(r.gold||0)>0&&r.yyyyMM);
  if(!g.length)return [];
  const paid={};g.forEach(r=>{if(r.goldPrice>0){const p=r.goldPrice*24/(kOf(r)||gset().karat);(paid[r.yyyyMM]=paid[r.yyyyMM]||[]).push(p);}});
  const first=g.map(r=>r.yyyyMM).sort()[0],nowK=toYMD(Date.now()).slice(0,7);
  const lastRow=g.map(r=>r.yyyyMM).sort().pop(),end=nowK>lastRow?nowK:lastRow;
  const out=[];let pxPrev=0,unitsPrev=0;
  for(let i=0,n=monthsBetween(first,end);i<=n;i++){
    const k=addMonths(first,i);let px=monthPx(k),src='market';
    if(!px&&paid[k]){px=paid[k].reduce((a,b)=>a+b,0)/paid[k].length;src='paid';}
    if(!px){px=pxPrev;src='carried';}
    let units=0,cost=0,grams=0,newUnits=0;
    g.forEach(r=>{if(r.yyyyMM<=k){const u=r.gold*rowKarat(r)/24;units+=u;grams+=r.gold;cost+=r.gold*(r.goldPrice||0);if(r.yyyyMM===k)newUnits+=u;}});
    const value=px?units*px:null;
    const ly=monthPx(addMonths(k,-12)),dec=monthPx(`${+k.slice(0,4)-1}-12`);
    out.push({k,px:px||null,src,grams,cost,units,value,
      mom:(px&&pxPrev)?px/pxPrev-1:null,yoy:(px&&ly)?px/ly-1:null,ytd:(px&&dec)?px/dec-1:null,
      priceEffect:(px&&pxPrev&&i>0)?unitsPrev*(px-pxPrev):(i===0&&px?0:null),
      bought:px?newUnits*px:null});
    if(px){pxPrev=px;}unitsPrev=units;
  }
  return out;
}
window.lgGoldMonthly=goldMonthly;
document.getElementById('variance-section').insertAdjacentHTML('beforebegin',`<div class="section" id="x-goldhist">
 <div class="section-header"><h2>Gold, month by month</h2><span class="hint">24k, USD per gram</span></div>
 <div class="chart-card"><div class="title">Price and what your gold is worth</div>
  <div class="desc" id="x-goldhist-desc"></div><div class="chart-wrap tall"><canvas id="goldhist"></canvas></div></div>
 <div class="table-container" style="margin-top:10px"><table id="x-gold-table" style="min-width:680px"><thead><tr><th>Month</th><th class="r">Price / g</th><th class="r">vs last month</th><th class="r">vs last year</th><th class="r">Year to date</th><th class="r">Your gold</th><th class="r">Price effect</th><th class="r">Bought</th></tr></thead><tbody></tbody></table></div>
 <p class="x-note" id="x-goldhist-note"></p>
 <div class="x-btns"><button type="button" id="x-gh-retry">Reload price history</button></div></div>`);
const pcell=v=>v==null?'<td class="num" data-v="">—</td>':`<td class="num ${v>=0?'pos':'neg'}" data-v="${v}">${v>=0?'▲':'▼'} ${Math.abs(v*100).toFixed(1)}%</td>`;
function renderGoldChart(){
  const sec=$('x-goldhist'),all=goldMonthly(allData).filter(r=>r.px);
  sec.hidden=false;
  if(!all.length){$('x-goldhist-desc').textContent='Add a gold entry to see its month by month history here.';$('x-gold-table').querySelector('tbody').innerHTML='';if(charts.goldhist){charts.goldhist.destroy();charts.goldhist=null;}$('x-goldhist-note').textContent='';return;}
  const lab=r=>`${fmtMonthShort(r.k)} ’${r.k.slice(2,4)}${r.src==='market'?'':'*'}`;
  if(charts.goldhist)charts.goldhist.destroy();
  charts.goldhist=new Chart($('goldhist'),{type:'line',
    data:{labels:all.map(lab),datasets:[
      {label:'Gold price per gram (24k)',data:all.map(r=>r.px),borderColor:C.gold,backgroundColor:'rgba(185,137,47,0.10)',fill:true,tension:0.3,borderWidth:2.4,pointRadius:2.5,yAxisID:'y'},
      {label:'Your gold, market value',data:all.map(r=>r.value),borderColor:C.cash,tension:0.3,borderWidth:2.2,pointRadius:2.5,yAxisID:'y1'},
      {label:'Your gold, what you paid',data:all.map(r=>r.cost),borderColor:'#9AA6B1',borderDash:[5,4],tension:0,borderWidth:1.8,pointRadius:0,yAxisID:'y1'}]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      scales:{y:{position:'left',ticks:{callback:v=>'$'+Math.round(v)},grid:{color:'#F0F2F5'}},
              y1:{position:'right',ticks:{callback:v=>'$'+Number(v).toLocaleString()},grid:{display:false}},x:{grid:{display:false}}},
      plugins:{legend:{position:'bottom',labels:{boxWidth:14,boxHeight:2,padding:12,font:{size:11}}},
        tooltip:{callbacks:{title:items=>fmtMonthFull(all[items[0].dataIndex].k),
          label:c=>` ${c.dataset.label}: ${c.raw==null?'—':(c.datasetIndex===0?money2(c.raw):money0(c.raw))}`}}}}});
  const last=all[all.length-1],pct=v=>v==null?null:`${v>=0?'up':'down'} ${Math.abs(v*100).toFixed(1)}%`;
  const bits=[['last month',last.mom],['the same month last year',last.yoy],['the end of last year',last.ytd]].filter(x=>x[1]!=null).map(x=>`${pct(x[1])} on ${x[0]}`);
  $('x-goldhist-desc').textContent=`Gold is ${bits.length?bits.join(', '):'at '+money2(last.px)+' per gram'}. Your holding is worth ${money0(last.value)} against ${money0(last.cost)} paid.`;
  $('x-gold-table').querySelector('tbody').innerHTML=[...all].reverse().map(r=>`<tr><td data-v="${r.k.replace('-','')}"><strong>${lab(r)}</strong></td>
    <td class="num" data-v="${r.px}">${money2(r.px)}</td>${pcell(r.mom)}${pcell(r.yoy)}${pcell(r.ytd)}
    <td class="num" data-v="${r.value}">${money0(r.value)}</td>
    <td class="num ${r.priceEffect==null?'':(r.priceEffect>=0?'pos':'neg')}" data-v="${r.priceEffect==null?'':r.priceEffect}">${r.priceEffect==null?'—':signed0(r.priceEffect)}</td>
    <td class="num" data-v="${r.bought||0}">${r.bought?signed0(r.bought):'—'}</td></tr>`).join('');
  const h=hget(),nm=h.m?Object.keys(h.m).length:0,est=all.some(r=>r.src!=='market');
  $('x-goldhist-note').textContent=(nm?`Market prices are monthly averages from freegoldapi.com (${nm} months loaded). `:'Market price history could not be loaded, so months use what you paid for gold that month, or the last known price. ')
    +(est?'A * means the month has no market price: it uses your purchase price or the last known price. ':'')
    +'Price effect is what the gold you already held gained or lost. Bought is the value of gold added that month.';
}
$('x-gh-retry').onclick=()=>{fetchGoldHistory(true).then(ok=>{toast(ok?'Price history loaded':'Could not load price history. Try again later.',false);renderAll();});};
const prevRA=renderAll;
renderAll=function(){prevRA();try{renderGoldChart();}catch(e){}};
setInterval(()=>{if(!document.hidden)fetchGoldHistory().then(ok=>{if(ok&&!busy())renderAll();});},3600*1000);

/* ---------- views, sortable tables, contribution tables, gold lots ---------- */
(function(){
const st=document.createElement('style');
st.textContent=`
.x-off{display:none!important}
.x-tabs{display:flex;gap:6px;overflow-x:auto;margin:0 0 16px;padding:4px 0;position:sticky;top:0;z-index:40;background:var(--bg);-webkit-overflow-scrolling:touch;scrollbar-width:none}
.x-tabs::-webkit-scrollbar{display:none}
.x-tabs button{flex:0 0 auto;padding:8px 16px;font-size:13px;font-weight:600;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent}
.x-tabs button.active{background:var(--ink);color:#fff;border-color:var(--ink)}
th.x-s{cursor:pointer;user-select:none;-webkit-user-select:none}
th.x-s::after{content:" ↕";opacity:.3}
th.x-asc::after{content:" ▲";opacity:1;color:var(--ink)}
th.x-desc::after{content:" ▼";opacity:1;color:var(--ink)}
td.x-click{cursor:pointer}
td.x-click:not(:has(.badge)){text-decoration:underline dotted var(--muted);text-underline-offset:3px}
tr.x-row{cursor:pointer}
tr.x-row:active td{background:#F6F8FA}
tr.x-on td{background:#EEF3F8}
.x-sub{font-size:11px;font-weight:600;margin-top:1px}
.x-lf{display:grid;grid-template-columns:repeat(3,1fr) auto;gap:8px;margin-bottom:8px;align-items:center}
.x-lf .month-select{width:100%;min-width:0}
.x-lf-sum{font-size:12px;color:var(--muted);margin:0 2px 10px}
.x-h3{margin:20px 0 8px;font-family:"Newsreader",serif;font-weight:600;font-size:17px}
`;
document.head.appendChild(st);

/* tabs */
const VIEWS=[['overview','Overview'],['tables','Tables'],['gold','Gold'],['ledger','Ledger'],['data','Data']];
const VMAP={
  overview:['kpi-grid','filter-section','x-score','charts-section','insights-section'],
  tables:['filter-section','x-score','bridge-section','x-ctc','trends-section','variance-section'],
  gold:['x-gold','x-goldhist','x-lots'],
  ledger:['filter-section','tx-section'],
  data:['x-raw','x-sync','x-data']
};
const ALLV=[...new Set([].concat(...Object.values(VMAP)))];
let view='overview';
try{const v=localStorage.getItem('lg-view-v1');if(VMAP[v])view=v;}catch(e){}
$('hero').insertAdjacentHTML('afterend',`<div class="x-tabs" id="x-tabs" role="tablist">${VIEWS.map(([k,l])=>`<button type="button" data-view="${k}" role="tab">${l}</button>`).join('')}</div>`);
function applyView(){
  $('x-tabs').hidden=$('hero').hidden;
  if($('hero').hidden){   /* nothing in the ledger yet: show the Google link and import tools, never hide them behind a tab */
    ALLV.forEach(id=>{const el=$(id);if(el)el.classList.toggle('x-off',!['x-sync','x-data','x-raw','x-gold'].includes(id));});
    const tx=$('tx-search');if(tx)tx.classList.remove('x-off');return;
  }
  $('x-tabs').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  ALLV.forEach(id=>{const el=$(id);if(el)el.classList.toggle('x-off',!VMAP[view].includes(id));});
  const tx=$('tx-search');if(tx)tx.classList.toggle('x-off',view!=='ledger');
}
function goView(v,scrollId){
  view=v;try{localStorage.setItem('lg-view-v1',v);}catch(e){}
  applyView();
  const el=scrollId&&$(scrollId);
  if(el)el.scrollIntoView({behavior:'smooth',block:'start'});else window.scrollTo({top:$('x-tabs').offsetTop-8,behavior:'smooth'});
}
$('x-tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-view]');if(b)goView(b.dataset.view);});

/* ledger filter bar */
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

/* sorting: tap a column header, again to flip, a third time to reset */
const REG=['tx-table','comparison-table','trend-table','x-gold-table','x-ctc-table','x-year-table','x-type-table','x-lots-table'];
const ST={};
function keyOf(td){
  if(!td)return null;
  if(td.dataset&&td.dataset.v!=null&&td.dataset.v!==''){const n=Number(td.dataset.v);return isNaN(n)?td.dataset.v:n;}
  const s=(td.textContent||'').trim();
  if(!s||s==='—')return null;
  let m=/^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);if(m)return +new Date(+m[3],+m[2]-1,+m[1]);
  const t=s.replace(/[−–]/g,'-').replace(/[$,+%]/g,'').trim();
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
    else if(s.c===0&&(typeof a.k==='string'||typeof b.k==='string'))c=a.i-b.i;
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
  if(!ST[tb.id]){
    const body=tb.tBodies[0];const rows=[...body.rows].filter(r=>r.dataset.i!=null).sort((a,b)=>a.dataset.i-b.dataset.i);
    rows.forEach(r=>body.appendChild(r));
  }
  applySort(tb.id);
});

/* variance table: year filter */
let VY='';
$('btn-qoq').parentNode.insertAdjacentHTML('afterend',`<select class="month-select" id="x-var-year" aria-label="Year"></select>`);
$('x-var-year').parentNode.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap';
$('x-var-year').onchange=e=>{VY=e.target.value;filterVar();};
function filterVar(){
  const rows=document.querySelectorAll('#comparison-table tbody tr');
  rows.forEach(r=>{r.hidden=!!VY&&r.cells.length>1&&!(r.cells[0].textContent||'').includes(VY);});
}
function fillVarYears(t){
  const ys=[...new Set(t.keys.map(k=>k.slice(0,4)))].reverse();
  if(VY&&!ys.includes(VY))VY='';
  $('x-var-year').innerHTML=`<option value="">All years</option>`+ys.map(y=>`<option value="${y}">${y}</option>`).join('');
  $('x-var-year').value=VY;
}

/* contribution-to-change tables */
$('bridge-section').insertAdjacentHTML('afterend',`<div class="section" id="x-ctc">
 <div class="section-header"><h2>Contribution to change</h2><select class="month-select" id="x-ctc-year" aria-label="Year"></select></div>
 <div class="table-container"><table id="x-ctc-table" style="min-width:720px"><thead><tr><th>Month</th><th class="r">Guy cash</th><th class="r">Lea cash</th><th class="r">Gold bought</th><th class="r">Loans</th><th class="r">Saved</th><th class="r">Gold price</th><th class="r">Total change</th></tr></thead><tbody></tbody></table></div>
 <p class="x-note" id="x-ctc-note"></p>
 <h3 class="x-h3">By year</h3>
 <div class="table-container"><table id="x-year-table" style="min-width:600px"><thead><tr><th>Year</th><th class="r">Guy</th><th class="r">Lea</th><th class="r">Guy share</th><th class="r">Loans</th><th class="r">Saved</th><th class="r">Closing balance</th></tr></thead><tbody></tbody></table></div>
 <p class="x-note">Tap a year to open its tab at the top. 2026 includes the savings you had before January.</p>
 <label class="x-label" for="x-jan26">January 2026 real saving, without the earlier savings (used for year-over-year)</label>
 <input id="x-jan26" class="x-input" inputmode="decimal" autocomplete="off" placeholder="800">
 <h3 class="x-h3">By type</h3>
 <div class="table-container"><table id="x-type-table" style="min-width:560px"><thead><tr><th>Type</th><th class="r">Entries</th><th class="r">Paid</th><th class="r">Worth now</th><th class="r">Change</th><th class="r">Share</th></tr></thead><tbody></tbody></table></div>
 <p class="x-note">Tap a type to see its entries in the Ledger. Gold is worth its market value when market pricing is on. Loans count as negative.</p>
</div>`);
let CY='';
$('x-ctc-year').onchange=e=>{CY=e.target.value;renderCtc();};
try{const j=parseFloat(localStorage.getItem('lg-jan26-v1'));$('x-jan26').value=isNaN(j)?'800':String(j);}catch(e){$('x-jan26').value='800';}
$('x-jan26').onchange=e=>{const v=num(e.target.value);try{localStorage.setItem('lg-jan26-v1',String(v));}catch(x){}renderAll();};
function renderCtc(){
  if(!allData.length)return;
  const f=getFilteredData(),t=computeAnalytics(f);
  const ys=[...new Set(t.keys.map(k=>k.slice(0,4)))].reverse();
  if(CY&&!ys.includes(CY))CY='';
  $('x-ctc-year').innerHTML=`<option value="">All years</option>`+ys.map(y=>`<option value="${y}">${y}</option>`).join('');
  $('x-ctc-year').value=CY;
  let pe={};
  if(currentFilter==='all'&&window.lgGoldMonthly){try{window.lgGoldMonthly(allData).forEach(r=>{if(r.priceEffect!=null)pe[r.k]=r.priceEffect;});}catch(e){}}
  const tb=document.querySelector('#x-ctc-table tbody');tb.innerHTML='';
  const sg=v=>`<span class="${v>=0?'pos':'neg'}">${signed0(v)}</span>`;
  let sumS=0,sumP=0;
  [...t.keys].reverse().filter(k=>!CY||k.startsWith(CY)).forEach(k=>{
    const c=t.comp[k],p=pe[k];sumS+=c.delta;sumP+=p||0;
    const tr=document.createElement('tr');tr.className='x-row'+(k===bridgeMonth?' x-on':'');tr.dataset.k=k;
    tr.innerHTML=`<td data-v="${k.replace('-','')}"><strong>${fmtMonthFull(k)}</strong></td><td class="num" data-v="${c.guyCash}">${signed0(c.guyCash)}</td><td class="num" data-v="${c.leaCash}">${signed0(c.leaCash)}</td>
      <td class="num" data-v="${c.gold}">${signed0(c.gold)}</td><td class="num" data-v="${c.loan}">${c.loan?signed0(c.loan):'—'}</td><td class="num" data-v="${c.delta}"><strong>${sg(c.delta)}</strong></td>
      <td class="num" data-v="${p==null?'':p}">${p==null?'—':sg(p)}</td><td class="num" data-v="${c.delta+(p||0)}">${sg(c.delta+(p||0))}</td>`;
    tb.appendChild(tr);
  });
  $('x-ctc-note').textContent=`Saved is what went in. Gold price is what the gold you already held gained or lost with the market (shown for Everyone only). Together they give the total change. ${CY||'All time'}: saved ${signed0(sumS)}${Object.keys(pe).length?`, gold price ${signed0(sumP)}`:''}. Tap a month to open it in the chart above.`;
  /* by year */
  const yb=document.querySelector('#x-year-table tbody');yb.innerHTML='';
  const Y={};t.keys.forEach(k=>{const y=k.slice(0,4),c=t.comp[k];const o=Y[y]||(Y[y]={g:0,l:0,loan:0,s:0,last:k});o.g+=c.guyTotal;o.l+=c.leaTotal;o.loan+=c.loan;o.s+=c.delta;o.last=k;});
  Object.keys(Y).sort().reverse().forEach(y=>{
    const o=Y[y],tot=o.g+o.l,tr=document.createElement('tr');tr.className='x-row';tr.dataset.y=y;
    tr.innerHTML=`<td data-v="${y}"><strong>${y}</strong></td><td class="num" data-v="${o.g}">${money0(o.g)}</td><td class="num" data-v="${o.l}">${money0(o.l)}</td>
      <td class="num" data-v="${tot>0?o.g/tot:''}">${tot>0?Math.round(o.g/tot*100)+'%':'—'}</td><td class="num" data-v="${o.loan}">${o.loan?signed0(o.loan):'—'}</td>
      <td class="num" data-v="${o.s}"><strong>${sg(o.s)}</strong></td><td class="num" data-v="${t.cumulative[o.last]}">${money0(t.cumulative[o.last])}</td>`;
    yb.appendChild(tr);
  });
  /* by type */
  const T={};
  const add=(name,paid,now,n)=>{const o=T[name]||(T[name]={n:0,paid:0,now:0});o.n+=n;o.paid+=paid;o.now+=now;};
  f.forEach(d=>{
    if(isLoanRow(d))add('Loan',d.usd||0,d.usd||0,1);
    else if(isGoldRow(d)){const gp=(d.gold||0)*(d.goldPrice||0);add(kOf(d)?`Gold ${kOf(d)}k`:'Gold',gp,goldNow(d),1);if(d.usd)add('Cash',d.usd,d.usd,0);}
    else add('Cash',d.usd||0,d.usd||0,1);
  });
  const tot=Object.values(T).reduce((a,o)=>a+o.now,0);
  const tyb=document.querySelector('#x-type-table tbody');tyb.innerHTML='';
  Object.keys(T).sort((a,b)=>T[b].now-T[a].now).forEach(name=>{
    const o=T[name],ch=o.paid?o.now/o.paid-1:null,tr=document.createElement('tr');tr.className='x-row';tr.dataset.cat=name;
    tr.innerHTML=`<td data-v="${esc(name)}"><span class="badge ${name==='Loan'?'loan':name==='Cash'?'cash':'gold'}">${esc(name)}</span></td><td class="num" data-v="${o.n}">${o.n}</td><td class="num" data-v="${o.paid}">${signed0(o.paid).replace('+','')}</td>
      <td class="num" data-v="${o.now}">${signed0(o.now).replace('+','')}</td><td class="num" data-v="${ch==null?'':ch}">${ch==null||Math.abs(ch)<1e-9?'—':`<span class="${ch>=0?'pos':'neg'}">${(ch>=0?'+':'−')+Math.abs(ch*100).toFixed(1)}%</span>`}</td>
      <td class="num" data-v="${tot?o.now/tot:''}">${tot?Math.round(o.now/tot*100)+'%':'—'}</td>`;
    tyb.appendChild(tr);
  });
}
$('x-ctc').addEventListener('click',e=>{
  const tr=e.target.closest('tr.x-row');if(!tr)return;
  if(tr.dataset.k){
    bridgeMonth=tr.dataset.k;const sel=$('bridge-month');sel.value=bridgeMonth;
    drawBridge(computeAnalytics(getFilteredData()));
    document.querySelectorAll('#x-ctc-table tr.x-row').forEach(r=>r.classList.toggle('x-on',r===tr));
    $('bridge-section').scrollIntoView({behavior:'smooth',block:'start'});
  }else if(tr.dataset.y){
    heroYear=+tr.dataset.y;renderAll();window.scrollTo({top:0,behavior:'smooth'});
  }else if(tr.dataset.cat){
    LF.who='';LF.year='';LF.cat=tr.dataset.cat;txQuery='';$('tx-search').value='';
    redrawLedger();goView('ledger','tx-section');
  }
});

/* gold lots: each gold entry, valued at today's market */
$('x-goldhist').insertAdjacentHTML('afterend',`<div class="section" id="x-lots"><div class="section-header"><h2>Gold purchases</h2><span class="hint" id="x-lots-hint"></span></div>
 <div class="table-container"><table id="x-lots-table" style="min-width:720px"><thead><tr><th>Date</th><th>Who</th><th class="r">Grams</th><th class="r">Purity</th><th class="r">Paid per g</th><th class="r">Paid</th><th class="r">Worth now</th><th class="r">Gain</th></tr></thead><tbody></tbody></table></div>
 <p class="x-note">Tap a purchase to edit it. Worth now uses the live or typed price and each entry's own purity.</p></div>`);
function renderLots(){
  const tb=document.querySelector('#x-lots-table tbody');tb.innerHTML='';
  const rows=allData.filter(isGoldRow).sort((a,b)=>b.sortTs-a.sortTs);
  let g=0,paid=0,now=0;
  if(!rows.length){tb.innerHTML=`<tr><td colspan="8" class="empty-note">No gold entries yet</td></tr>`;$('x-lots-hint').textContent='';return;}
  rows.forEach(d=>{
    const p=(d.gold||0)*(d.goldPrice||0),n=goldNow(d),gain=p?n/p-1:null,k=kOf(d)||gset().karat;
    g+=d.gold;paid+=p;now+=n;
    const tr=document.createElement('tr');tr.className='x-row';tr.dataset.id=d.id;
    tr.innerHTML=`<td style="white-space:nowrap">${esc((d.date||'').split(' ')[0])}</td><td style="text-transform:capitalize;font-weight:500">${esc(d.name)}</td>
      <td class="num" data-v="${d.gold}">${d.gold.toFixed(2)} g</td><td class="num" data-v="${k}">${k}k${kOf(d)?'':' <span class="hint">default</span>'}</td>
      <td class="num" data-v="${d.goldPrice||0}">${d.goldPrice?money2(d.goldPrice):'—'}</td><td class="num" data-v="${p}">${money2(p)}</td>
      <td class="num" data-v="${n}">${money2(n)}</td><td class="num" data-v="${gain==null?'':gain}">${gain==null?'—':`<span class="${gain>=0?'pos':'neg'}">${(gain>=0?'+':'−')+Math.abs(gain*100).toFixed(1)}%</span>`}</td>`;
    tb.appendChild(tr);
  });
  $('x-lots-hint').textContent=`${g.toFixed(1)} g · paid ${money0(paid)} · worth ${money0(now)} (${now>=paid?'+':'−'}${paid?Math.abs((now/paid-1)*100).toFixed(1):0}%)`;
}
$('x-lots').addEventListener('click',e=>{
  const tr=e.target.closest('tr.x-row');if(!tr)return;
  const row=allData.find(r=>r.id===tr.dataset.id);if(row)openSheet(row);
});

/* scorecard: this period against last period and the same period last year, then year to date */
$('filter-section').insertAdjacentHTML('afterend',`<div class="section" id="x-score">
 <div class="section-header"><h2>Scorecard</h2><div class="toggle-group" id="x-sc-mode"><button type="button" data-m="month" class="active">Month</button><button type="button" data-m="week">Week</button></div></div>
 <div class="x-sc-pick"><button type="button" class="x-link" id="x-sc-prev" aria-label="Earlier">‹</button><select class="month-select" id="x-sc-sel" aria-label="Period"></select><button type="button" class="x-link" id="x-sc-next" aria-label="Later">›</button></div>
 <div class="table-container"><table id="x-sc-table" style="min-width:540px"><thead></thead><tbody></tbody></table></div>
 <h3 class="x-h3" id="x-ytd-title">Year to date</h3>
 <div class="table-container"><table id="x-ytd-table" style="min-width:540px"><thead></thead><tbody></tbody></table></div>
 <p class="x-note" id="x-sc-note"></p></div>`);
const st2=document.createElement('style');
st2.textContent=`.x-sc-pick{display:flex;align-items:center;gap:6px;margin:0 0 10px}.x-sc-pick .month-select{flex:1;min-width:0}.x-sc-pick .x-link{font-size:22px;padding:2px 12px}
#x-sc-table td.num small,#x-ytd-table td.num small{display:block;font-size:11px;font-weight:600;margin-top:1px}#x-sc-table td.cur,#x-ytd-table td.cur{font-weight:700}`;
document.head.appendChild(st2);
const SC={mode:'month',sel:''};window.lgSC=SC;
const DAY=864e5,MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fm=(y,m)=>`${MON[m]} ${y}`;
const fd=ts=>{const d=new Date(ts);return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;};
function wkStart(ts){const d=new Date(ts);d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d.getTime();}
function shiftD(ts,n){const d=new Date(ts);d.setDate(d.getDate()+n);return d.getTime();}
function scOptions(rows){
  const ts=rows.map(r=>r.sortTs).filter(Boolean);if(!ts.length)return [];
  const first=Math.min(...ts),now=Date.now(),last=Math.max(Math.max(...ts),now),out=[];
  if(SC.mode==='month'){
    const a=new Date(first),b=new Date(last);
    for(let y=b.getFullYear(),m=b.getMonth();y>a.getFullYear()||(y===a.getFullYear()&&m>=a.getMonth());){out.push({v:`${y}-${p2(m+1)}`,l:fm(y,m)});if(--m<0){m=11;y--;}}
  }else{
    for(let w=wkStart(last),i=0;w>=wkStart(first)&&i<80;w=shiftD(w,-7),i++)out.push({v:String(w),l:`Week of ${fd(w)}`});
  }
  return out;
}
function rangeOf(sel,kind){   /* kind: cur, prev, ly */
  if(SC.mode==='month'){
    let [y,m]=sel.split('-').map(Number);m--;
    if(kind==='prev'){m--;if(m<0){m=11;y--;}}
    if(kind==='ly')y--;
    return {a:new Date(y,m,1).getTime(),b:new Date(y,m+1,1).getTime(),l:fm(y,m),y,m};
  }
  let a=+sel;if(kind==='prev')a=shiftD(a,-7);if(kind==='ly')a=shiftD(a,-364);
  return {a,b:shiftD(a,7),l:fd(a)};
}
let JF=1;
function bucket(rows,a,b){
  const o={saved:0,guy:0,lea:0,gold:0,n:0,touchesJan:false};
  rows.forEach(d=>{
    if(!(d.sortTs>=a&&d.sortTs<b))return;
    const jan=d.yyyyMM==='2026-01',f=jan?JF:1;if(jan)o.touchesJan=true;
    const u=d.usd||0,gv=(d.gold||0)*(d.goldPrice||0),nm=d.name||'';
    if(isLoanRow(d)){o.saved+=u*f;return;}
    const tot=u+gv;o.saved+=tot*f;o.gold+=gv*f;o.n++;
    if(nm.includes('guy'))o.guy+=tot*f;else if(nm.includes('lea'))o.lea+=tot*f;
  });
  return o;
}
const balanceTo=(rows,b)=>rows.reduce((s,d)=>d.sortTs<b?s+(isLoanRow(d)?(d.usd||0):(d.usd||0)+(d.gold||0)*(d.goldPrice||0)):s,0);
const pcOf=(a,b)=>(b!=null&&b>0)?a/b-1:null;
const arrow=v=>v==null?'—':`<span class="${v>=0?'pos':'neg'}">${v>=0?'▲':'▼'} ${Math.abs(v*100).toFixed(1)}%</span>`;
const dcell=(a,b,ok)=>{if(!ok)return '<td class="num">n/a</td>';const v=pcOf(a,b);return `<td class="num">${arrow(v)}<small class="${a-b>=0?'pos':'neg'}">${signed0(a-b)}</small></td>`;};
function renderScore(){
  const rows=getFilteredData();if(!allData.length||!rows.length)return;
  const all=computeAnalytics(allData).comp['2026-01'];JF=(all&&all.delta)?jan26()/all.delta:1;
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
  const M=[['Saved','saved'],['Guy added','guy'],['Lea added','lea'],['Gold bought','gold']];
  let h=M.map(([l,k])=>`<tr><td><strong>${l}</strong></td><td class="num cur">${money0(C0[k])}</td><td class="num">${hasPrev?money0(P0[k]):'—'}</td>${dcell(C0[k],P0[k],hasPrev)}<td class="num">${hasLy?money0(L0[k]):'—'}</td>${dcell(C0[k],L0[k],hasLy)}</tr>`).join('');
  h+=`<tr><td><strong>Balance at end</strong></td><td class="num cur">${money0(bal[0])}</td><td class="num">${hasPrev?money0(bal[1]):'—'}</td>${dcell(bal[0],bal[1],hasPrev)}<td class="num">${hasLy?money0(bal[2]):'—'}</td>${dcell(bal[0],bal[2],hasLy)}</tr>`;
  $('x-sc-table').tBodies[0].innerHTML=h;
  /* year to date, from 1 January to the end of the selected period */
  const y=new Date(cur.b-1).getFullYear(),y0=new Date(y,0,1).getTime(),yl=new Date(y-1,0,1).getTime();
  const lyEnd=SC.mode==='month'?new Date(y-1,new Date(cur.b-1).getMonth()+1,1).getTime():shiftD(cur.b,-364);
  const Y0=bucket(rows,y0,cur.b),YL=bucket(rows,yl,lyEnd),hasYL=lyEnd>first;
  $('x-ytd-title').textContent=`Year to date, ${y}`;
  $('x-ytd-table').tHead.innerHTML=`<tr><th>Since 1 January</th><th class="r">${y}</th><th class="r">${y-1}</th><th class="r">YoY</th></tr>`;
  $('x-ytd-table').tBodies[0].innerHTML=M.map(([l,k])=>`<tr><td><strong>${l}</strong></td><td class="num cur">${money0(Y0[k])}</td><td class="num">${hasYL?money0(YL[k]):'—'}</td>${dcell(Y0[k],YL[k],hasYL)}</tr>`).join('');
  let note=`Every figure follows the filter above. ${lab} compares with the ${unit} before. YoY compares with the same ${unit} a year earlier, and year to date with the same stretch of last year. Saved, Guy added, Lea added and Gold bought are what went in during the period, so the opening balance never inflates them.`;
  if(!hasLy)note+=` There is no ${ly.l} in the ledger yet, so YoY shows n/a until a year of data exists.`;
  if(C0.touchesJan||P0.touchesJan||L0.touchesJan||Y0.touchesJan||YL.touchesJan)note+=` January 2026 counts as ${money0(jan26())} (your real saving that month, set under By year in Tables), not the earlier savings it also held.`;
  if(currentFilter==='all'&&typeof pathFor==='function'){
    try{const t=computeAnalytics(rows),ck=toYMD(cur.b-1).slice(0,7),path=pathFor(y,t);
      if(path){const cb=cumAt(t,ck),g=goalRatio(y,path,t,ck,cb);if(g!=null)note+=` Against the phased goal for ${MON[+ck.slice(5)-1]} ${y}, you are ${(g>=0?'+':'−')+Math.abs(g*100).toFixed(1)}% (${signed0(cb-path.at(ck))}).`;}}catch(e){}
  }
  $('x-sc-note').textContent=note;
}
$('x-sc-mode').addEventListener('click',e=>{const b=e.target.closest('button[data-m]');if(!b)return;SC.mode=b.dataset.m;SC.sel='';renderScore();});
$('x-sc-sel').onchange=e=>{SC.sel=e.target.value;renderScore();};
const stepSc=n=>{const o=scOptions(getFilteredData()),i=o.findIndex(x=>x.v===SC.sel);const j=i-n;if(i>=0&&j>=0&&j<o.length){SC.sel=o[j].v;renderScore();}};
$('x-sc-prev').onclick=()=>stepSc(-1);$('x-sc-next').onclick=()=>stepSc(1);

const prevRA2=renderAll;
renderAll=function(){
  prevRA2();
  try{
    if(allData.length){
      const t=computeAnalytics(getFilteredData());
      if(t.keys.length){fillVarYears(t);renderCtc();filterVar();renderLots();renderScore();}
    }
    REG.forEach(applySort);
    applyView();
  }catch(e){console.error(e);}
};
window.lgGoView=goView;
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
allData=loadSaved();
try{tomb=JSON.parse(localStorage.getItem(TOMB)||'{}')||{};}catch(e){tomb={};}
try{if(!allData.length&&!localStorage.getItem('lg-ledger-seeded')){allData=seedRows();localStorage.setItem('lg-ledger-seeded','1');}}catch(e){}
allData.forEach(r=>{if(!r.updated)r.updated=1;lastSig[r.id]=sig(r);});
persist();
const c0=cfg();if(c0){$('x-sync-url').value=c0.url;$('x-sync-token').value=c0.token;}
status();renderAll();
if(c0)sync({quiet:true});
refreshGold();
fetchGoldHistory().then(ok=>{if(ok&&!busy())renderAll();});
})();
