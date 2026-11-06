/* Savings Ledger: in-app entry, on-device storage, backup, and PWA wiring.
   Loaded after the main page script, so it can use its data and render functions. */
(function(){
const KEY='lg-ledger-v1', PREF='lg-ledger-prefs-v1';
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
   <div><label class="x-label" for="x-p">USD per gram</label><input id="x-p" class="x-input" inputmode="decimal" autocomplete="off" placeholder="0.00"></div></div></div>
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
function save(){try{localStorage.setItem(KEY,JSON.stringify(allData));}catch(e){toast('Could not save on this device. Export a backup.');}}
function loadSaved(){try{const r=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(r)?r:[];}catch(e){return [];}}
function status(){
  $('file-info').textContent=allData.length?`${allData.length} entries · saved on this device`:'No entries yet';
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
  const sec=['hero','kpi-grid','filter-section','charts-section','bridge-section','insights-section','variance-section'];
  if(!allData.length){sec.forEach(id=>$(id).hidden=true);$('tx-search').hidden=true;$('x-empty').hidden=false;renderTable([]);return;}
  $('x-empty').hidden=true;
  const filtered=getFilteredData();
  if(!computeAnalytics(filtered).keys.length){
    sec.forEach(id=>{$(id).hidden=id!=='filter-section';});$('tx-search').hidden=false;renderTable(filtered);return;
  }
  baseRenderAll();
};
renderTable=function(filtered){
  const tbody=document.querySelector('#tx-table tbody');tbody.innerHTML='';
  const q=txQuery.trim().toLowerCase();
  let rows=[...filtered].sort((a,b)=>b.sortTs-a.sortTs);
  if(q)rows=rows.filter(d=>(d.name||'').includes(q)||(d.type||'').toLowerCase().includes(q));
  if(!rows.length){
    tbody.innerHTML=`<tr><td colspan="7" class="empty-note">${allData.length?'No entries match':'No entries yet. Tap Add entry or upload a CSV.'}</td></tr>`;
    $('tx-count').innerText='(0)';return;
  }
  rows.forEach(d=>{
    const gVal=(d.gold||0)*(d.goldPrice||0),isLoan=(d.name||'').includes('loan'),isGold=(d.gold||0)>0;
    const cat=isLoan?'Loan':(isGold?'Gold':'Cash');
    const tr=document.createElement('tr');
    tr.innerHTML=`<td style="white-space:nowrap">${esc((d.date||'').split(' ')[0])}</td>
      <td style="font-weight:500;text-transform:capitalize">${esc(d.name)}</td>
      <td class="num ${d.usd<0?'neg':''}">${d.usd<0?'−':''}$${Math.abs(d.usd).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      <td class="num">${d.gold?d.gold.toFixed(2)+' g':'—'}</td>
      <td class="num">${gVal?money2(gVal):'—'}</td>
      <td><span class="badge ${cat.toLowerCase()}">${cat}</span></td>
      <td class="num"><button class="x-link" data-act="edit" data-id="${esc(d.id)}">Edit</button><button class="x-link x-del" data-act="del" data-id="${esc(d.id)}">Delete</button></td>`;
    tbody.appendChild(tr);
  });
  $('tx-count').innerText=`(${rows.length})`;
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
    $('x-amt').value=row.gold>0?'':Math.abs(row.usd||0)||'';$('x-g').value=row.gold>0?row.gold:'';$('x-p').value=row.goldPrice||'';
    $('x-date').value=toYMD(row.sortTs)||toYMD(Date.now());
  }else{
    setKind(pr.kind||'deposit');setWho(pr.who||'guy');
    $('x-amt').value='';$('x-g').value='';$('x-p').value=pr.price||'';$('x-date').value=toYMD(Date.now());
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
    row.type='Gold';row.gold=g;row.goldPrice=p;writePrefs({price:p});
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
  const types=['Cash USD','Gold'],tb=document.querySelector('#x-raw-table tbody');
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
function seedRows(){const el=$('seed-csv');if(!el)return [];const r=parseCSV(el.textContent);r.forEach(x=>{x.id=uid();});return r;}
$('x-reset').onclick=()=>{
  const s=seedRows();if(!s.length)return;
  if(confirm(`Replace everything on this device with the original ${s.length} rows?`)){snapshot();setData(s);toast('Original data restored',true);}
};
if($('add-btn'))$('add-btn').onclick=()=>openSheet(null);

/* ---------- start ---------- */
allData=loadSaved();
try{
  if(!allData.length&&!localStorage.getItem('lg-ledger-seeded')){allData=seedRows();localStorage.setItem('lg-ledger-seeded','1');save();}
}catch(e){}
status();renderAll();
})();
