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
 <div class="kpi-sub" style="font-size:13.5px;margin-top:8px">Already have a shared ledger? <strong>Sign in</strong> just below and your entries appear. Starting fresh? Tap <strong>Add entry</strong>, or import a CSV at the bottom.</div></div>`);
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
  $('file-info').textContent=(allData.length?`${allData.length} entries`:'No entries yet')+(cfg()?` · ${syncState||'Signed in'}`:' · saved on this phone');
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
$('x-data').insertAdjacentHTML('beforebegin',`<div class="section" id="x-sync"><div class="section-header"><h2>Sign in</h2><span class="hint" id="x-sync-status"></span></div>
 <div class="kpi-card"><div class="kpi-sub" style="font-size:13px;margin:0 0 4px">Sign in to share one ledger between your phones. Everything you add is saved to it automatically, and what Lea adds appears here. Keep your login and password private.</div>
 <label class="x-label" for="x-sync-url">Ledger login</label><input id="x-sync-url" class="x-input" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Your ledger login">
 <label class="x-label" for="x-sync-token">Password</label><input id="x-sync-token" type="password" class="x-input" autocomplete="current-password" autocapitalize="off">
 <div class="x-btns"><button type="button" id="x-sync-connect">Sign in</button><button type="button" id="x-sync-invite">Invite someone</button><button type="button" id="x-sync-now">Sync now</button><button type="button" id="x-sync-off" class="danger">Sign out</button></div></div></div>`);
/* the login is the ledger's ID, a full link also works; both end up as the same address */
const toUrl=v=>{v=String(v||'').trim();if(/^https:\/\/script\.google\.com\/\S+/.test(v))return v;return /^[A-Za-z0-9_-]{20,}$/.test(v)?'https://script.google.com/macros/s/'+v+'/exec':'';};
const toLogin=u=>{const m=/\/macros\/s\/([^/]+)/.exec(u||'');return m?m[1]:(u||'');};
const cfg=()=>{try{return JSON.parse(localStorage.getItem(SYNC)||'null');}catch(e){return null;}};
const isTrue=v=>v===true||v===1||String(v).toLowerCase()==='true';
function setSyncState(t){syncState=t;const el=$('x-sync-status');if(el)el.textContent=t;status();}
function scheduleSync(){if(!cfg())return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>sync({quiet:true}),1500);}
function busy(){const a=document.activeElement;return !$('x-sheet').hidden||!!(a&&a.classList&&a.classList.contains('x-cell'));}
function errText(e){return e.message==='unauthorized'?'Wrong password.':e.message==='bad-reply'?'Could not sign in. Check the ledger login.':'Offline. Changes are saved here and will sync later.';}
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
  const url=toUrl($('x-sync-url').value),token=$('x-sync-token').value.trim();
  if(!url||!token){toast('Enter your ledger login and password.');return;}
  localStorage.setItem(SYNC,JSON.stringify({url,token}));setSyncState('Connecting…');
  let adopt=false;
  try{
    const remote=((await api('GET')).rows||[]).filter(x=>!isTrue(x.deleted));
    if(remote.length&&allData.length)adopt=confirm(`This ledger already has ${remote.length} entries and this phone has ${allData.length}.\n\nOK: use the ledger's entries and replace this phone's.\nCancel: merge both (can create duplicates).`);
  }catch(e){localStorage.removeItem(SYNC);setSyncState('');status();toast(errText(e));return;}
  await sync({manual:true,adopt});
};
$('x-sync-invite').onclick=async()=>{
  const c=cfg();if(!c){toast('Sign in first.');return;}
  const link=location.origin+location.pathname+'#join='+btoa(unescape(encodeURIComponent(JSON.stringify({u:c.url,t:c.token}))));
  try{await navigator.clipboard.writeText(link);toast('Invite copied. Send it privately: anyone with it signs in and can edit the ledger.');}
  catch(e){prompt('Copy this invite and send it privately:',link);}
};
$('x-sync-now').onclick=()=>{if(!cfg()){toast('Sign in first.');return;}sync({manual:true});};
$('x-sync-off').onclick=()=>{localStorage.removeItem(SYNC);$('x-sync-token').value='';setSyncState('');status();toast('Signed out. Your entries stay on this phone.');};
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
$('x-sync').insertAdjacentHTML('beforebegin',`<div class="section" id="x-gold"><div class="section-header"><h2>Gold valuation</h2><span class="hint" id="x-gold-status"></span></div>
 <div class="kpi-card"><div class="kpi-sub" style="font-size:13px;margin:0 0 4px">Gold in your net worth follows today's market price, scaled by each entry's purity. Savings, targets and the monthly charts keep using what you paid.</div>
 <div id="x-gold-now" class="x-goldnow"></div>
 <label class="x-label" for="x-gold-mode">Value gold at</label><select id="x-gold-mode" class="x-input"><option value="market">Market price</option><option value="cost">Purchase price</option></select>
 <label class="x-label" for="x-gold-karat">Default purity, for entries without one</label><select id="x-gold-karat" class="x-input"><option value="24">24k</option><option value="22">22k</option><option value="21">21k</option><option value="18">18k</option></select>
 <label class="x-label" for="x-gold-manual">Or type today's price per gram at the default purity, in USD (optional)</label><input id="x-gold-manual" class="x-input" inputmode="decimal" autocomplete="off" placeholder="Leave empty to use the live price">
 <div class="x-btns"><button type="button" id="x-gold-refresh">Refresh price</button></div></div></div>`);
function goldStatus(extra){
  const g=gset();let t;
  try{
    const p=px24(),k=g.karat,d=new Date(g.at||Date.now());
    $('x-gold-now').innerHTML=p>0
      ?`<div class="x-gn-l">Gold today${num(g.manual)>0?' (your price)':' (live price, not an average)'}</div><div class="x-gn-v">${money2(p*k/24)} <span>per gram, ${k}k</span></div><div class="x-gn-s">24k ${money2(p)}/g${num(g.manual)>0?'':` · updated ${p2(d.getHours())}:${p2(d.getMinutes())}`}</div>`
      :`<div class="x-gn-l">Gold today</div><div class="x-gn-s">${g.mode==='market'?'No live price yet. Tap Refresh price, or type one below.':'Gold is valued at what you paid.'}</div>`;
  }catch(e){}
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
const stg=document.createElement('style');stg.textContent='.x-goldnow{background:#F6F8FA;border-radius:12px;padding:12px 14px;margin:6px 0 4px}.x-gn-l{font-size:11px;font-weight:600;color:var(--muted)}.x-gn-v{font:700 24px "IBM Plex Sans",sans-serif;margin:2px 0}.x-gn-v span{font-size:13px;font-weight:500;color:var(--muted)}.x-gn-s{font-size:12px;color:var(--muted)}';document.head.appendChild(stg);
const gm=gset();$('x-gold-mode').value=gm.mode;$('x-gold-karat').value=String(gm.karat);$('x-gold-manual').value=gm.manual;goldStatus();
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
function monthPx(k){const h=hget();return(h.man&&h.man[k])||(h.m&&h.m[k])||(h.snap&&h.snap[k])||0;}
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
  const lab=r=>`${fmtMonthShort(r.k)} ’${r.k.slice(2,4)}${r.src==='live'?' · today':((r.src==='market'||r.src==='manual')?'':'*')}`;
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
  $('x-gold-table').querySelector('tbody').innerHTML=[...all].reverse().map(r=>`<tr data-k="${r.k}" class="x-tap"><td data-v="${r.k.replace('-','')}"><strong>${lab(r)}</strong></td>
    <td class="num" data-v="${r.px}">${money2(r.px)}</td>${pcell(r.mom)}${pcell(r.yoy)}${pcell(r.ytd)}
    <td class="num" data-v="${r.value}">${money0(r.value)}</td>
    <td class="num ${r.priceEffect==null?'':(r.priceEffect>=0?'pos':'neg')}" data-v="${r.priceEffect==null?'':r.priceEffect}">${r.priceEffect==null?'—':signed0(r.priceEffect)}</td>
    <td class="num" data-v="${r.bought||0}">${r.bought?signed0(r.bought):'—'}</td></tr>`).join('');
  const h=hget(),nm=h.m?Object.keys(h.m).length:0,est=all.some(r=>r.src==='paid'||r.src==='est');
  $('x-goldhist-note').textContent=(nm?`Past months use the monthly average price from freegoldapi.com (${nm} months loaded). The current month uses today's price. `:'Market price history could not be loaded, so months use what you paid for gold that month, or an estimate between the nearest known months. ')
    +(est?'A * means that month has no market price: it uses what you paid, or an estimate spread between the nearest known months. Tap a month to type its real price per gram (24k). ':'')
    +'Price effect is what the gold you already held gained or lost. Bought is the value of gold added that month.';
}
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
renderAll=function(){prevRA();try{renderGoldChart();}catch(e){}};
setInterval(()=>{if(!document.hidden)refreshGold();},10*60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-(gset().at||0)>5*60*1000)refreshGold();});
setInterval(()=>{if(!document.hidden)fetchGoldHistory().then(ok=>{if(ok&&!busy())renderAll();});},3600*1000);

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
    if(empty){if(sync.previousElementSibling!==$('x-empty')){$('x-empty').insertAdjacentElement('afterend',sync);sync.insertAdjacentElement('afterend',gold);}}
    else if(gold.nextElementSibling!==$('x-goldhist')){$('x-goldhist').insertAdjacentElement('beforebegin',gold);$('x-raw').insertAdjacentElement('beforebegin',sync);if(set)sync.insertAdjacentElement('afterend',set);}
  }catch(e){}
}
function applyView(){
  stickTabs();placeSections($('hero').hidden);
  $('x-tabs').hidden=$('hero').hidden;
  if($('hero').hidden){   /* empty ledger: sign in and import stay in reach */
    ALLV.forEach(id=>{const el=$(id);if(el)el.classList.toggle('x-off',!['x-sync','x-data','x-raw','x-gold'].includes(id));});
    const tx=$('tx-search');if(tx)tx.classList.remove('x-off');return;
  }
  $('x-tabs').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  ALLV.forEach(id=>{const el=$(id);if(el)el.classList.toggle('x-off',!VMAP[view].includes(id));});
  const tx=$('tx-search');if(tx)tx.classList.toggle('x-off',view!=='ledger');
}
function goView(v,scrollId){
  view=v;try{localStorage.setItem('lg-view-v2',v);}catch(e){}
  applyView();
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
const REG=['tx-table','comparison-table','trend-table','x-gold-table','xp-table'];
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
/* January 2026 also holds the savings from before; its "real" saving is a setting. jf scales that month's flows to it. */
function janF(){const all=computeAnalytics(allData).comp['2026-01'];return (all&&all.delta)?jan26()/all.delta:1;}
const rowAmt=d=>(d.usd||0)+(isLoanRow(d)?0:(d.gold||0)*(d.goldPrice||0));
const pcOf=(a,b)=>(b!=null&&b>0)?a/b-1:null;
const arrow=v=>v==null?'—':`<span class="${v>=0?'pos':'neg'}">${v>=0?'▲':'▼'} ${Math.abs(v*100).toFixed(1)}%</span>`;
const pctTxt=v=>`${v>=0?'+':'−'}${Math.abs(v*100).toFixed(0)}%`;
const nowKey=()=>toYMD(Date.now()).slice(0,7);

/* ---------- scorecard ---------- */
$('filter-section').insertAdjacentHTML('afterend',`<div class="section" id="x-score">
 <div class="section-header"><h2>Scorecard</h2><select class="month-select" id="xs-per" aria-label="Period for the splits and the monthly chart"></select></div>
 <div class="xs-pies">
  <div class="chart-card xs-pie"><div class="title">Guy and Lea</div><div class="desc" id="xs-p1d"></div><div class="xs-pw"><canvas id="xs-p1"></canvas><div class="xs-c" id="xs-p1c"></div></div><div class="xs-leg" id="xs-p1l"></div></div>
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
  const R=perRange(XS,rows),B=bucket(rows,R.a,R.b),gl=B.guy+B.lea;
  /* 1. Guy and Lea: what each put in during the period */
  donut('xs-p1',[B.guy,B.lea],[C.cash,C.lea]);
  $('xs-p1c').innerHTML=gl>0?`<b>${money0(gl)}</b><span>put in</span>`:`<b>—</b><span>nothing yet</span>`;
  $('xs-p1d').textContent=`Deposits, ${R.label}`;
  $('xs-p1l').innerHTML=legend([['Guy',B.guy,C.cash],['Lea',B.lea,C.lea]]);
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
  const other=M.map(o=>o.saved-o.guy-o.lea);
  const avg=M.length?M.reduce((s,o)=>s+o.saved,0)/M.length:0;
  if(charts.xsm){charts.xsm.destroy();charts.xsm=null;}
  const hl=k=>!R.sel||k===R.sel?1:.35;
  charts.xsm=new Chart($('xs-m'),{type:'bar',data:{labels:M.map(o=>lbl(o.k)),datasets:[
    {label:'Guy',data:M.map(o=>o.guy),backgroundColor:M.map(o=>`rgba(47,93,138,${hl(o.k)})`),stack:'s'},
    {label:'Lea',data:M.map(o=>o.lea),backgroundColor:M.map(o=>`rgba(138,78,125,${hl(o.k)})`),stack:'s'},
    ...(other.some(v=>Math.abs(v)>0.5)?[{label:'Loans',data:other,backgroundColor:M.map(o=>`rgba(176,67,58,${hl(o.k)})`),stack:'s'}]:[]),
    {type:'line',label:'Saved',data:M.map(o=>o.saved),borderColor:C.ink,backgroundColor:C.ink,borderWidth:0,pointRadius:3,pointStyle:'line',showLine:false},
    {type:'line',label:`Average ${money0(avg)}`,data:M.map(()=>avg),borderColor:C.gold,borderDash:[5,4],borderWidth:1.6,pointRadius:0}]},
    options:opt({stacked:true})});
  const best=M.reduce((a,o)=>o.saved>a.saved?o:a,M[0]||{saved:0,k:''});
  $('xs-md').textContent=M.length?`${R.sel?`${R.label}: ${money0((M.find(o=>o.k===R.sel)||{saved:0}).saved)} saved. `:''}Average ${money0(avg)} a month${best&&best.k?`, best ${lbl(best.k)} at ${money0(best.saved)}`:''}.${R.months.includes('2026-01')?` January 2026 shows its real saving of ${money0(jan26())}.`:''}`:'';
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
  const M=[['Saved','saved'],['Guy added','guy'],['Lea added','lea'],['Gold bought','gold']];
  let h=M.map(([l,k])=>`<tr><td><strong>${l}</strong></td><td class="num cur">${money0(C0[k])}</td><td class="num">${hasPrev?money0(P0[k]):'—'}</td>${dcell(C0[k],P0[k],hasPrev)}<td class="num">${hasLy?money0(L0[k]):'—'}</td>${dcell(C0[k],L0[k],hasLy)}</tr>`).join('');
  h+=`<tr><td><strong>Balance at end</strong></td><td class="num cur">${money0(bal[0])}</td><td class="num">${hasPrev?money0(bal[1]):'—'}</td>${dcell(bal[0],bal[1],hasPrev)}<td class="num">${hasLy?money0(bal[2]):'—'}</td>${dcell(bal[0],bal[2],hasLy)}</tr>`;
  $('x-sc-table').tBodies[0].innerHTML=h;
  const y=new Date(cur.b-1).getFullYear(),y0=new Date(y,0,1).getTime(),yl=new Date(y-1,0,1).getTime();
  const lyEnd=SC.mode==='month'?new Date(y-1,new Date(cur.b-1).getMonth()+1,1).getTime():shiftD(cur.b,-364);
  const Y0=bucket(rows,y0,cur.b),YL=bucket(rows,yl,lyEnd),hasYL=lyEnd>first;
  $('x-ytd-title').textContent=`Year to date, ${y}`;
  $('x-ytd-table').tHead.innerHTML=`<tr><th>Since 1 January</th><th class="r">${y}</th><th class="r">${y-1}</th><th class="r">YoY</th></tr>`;
  $('x-ytd-table').tBodies[0].innerHTML=M.map(([l,k])=>`<tr><td><strong>${l}</strong></td><td class="num cur">${money0(Y0[k])}</td><td class="num">${hasYL?money0(YL[k]):'—'}</td>${dcell(Y0[k],YL[k],hasYL)}</tr>`).join('');
  let note=`Follows the filter above. ${lab} compares with the ${unit} before, YoY with the same ${unit} a year earlier, and year to date with the same stretch of last year. Saved, Guy added, Lea added and Gold bought are what went in during the period, so the opening balance never inflates them. Balance counts gold at market; the other rows count it at what you paid.`;
  if(!hasLy)note+=` There is no ${ly.l} in the ledger, so YoY shows n/a until a year of data exists.`;
  if(C0.touchesJan||P0.touchesJan||L0.touchesJan||Y0.touchesJan||YL.touchesJan)note+=` January 2026 counts as ${money0(jan26())}, your real saving that month, not the earlier savings it also held (change it in Data).`;
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
  const jf=k=>k==='2026-01'?JF:1;
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
    let g=0,l=0;t.keys.filter(k=>k.startsWith(Yc+'-')).forEach(k=>{g+=t.comp[k].guyTotal*jf(k);l+=t.comp[k].leaTotal*jf(k);});
    if(g+l>0)add('⚖','neu',`In ${Yc}, Guy put in <b>${Math.round(g/(g+l)*100)}%</b> (${money0(g)}) and Lea <b>${Math.round(l/(g+l)*100)}%</b> (${money0(l)}).`,'ours');
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
const janNote=ks=>ks.includes('2026-01')?' January 2026 includes the savings you had before it; '+'its real saving counts as '+money0(jan26())+' wherever a comparison needs it.':'';

const XV=[
 {id:'ctc',src:'ours',grp:'ours',title:'Contribution to change',desc:'What moved your balance each month: Guy cash, Lea cash, gold bought and loans.',years:'all',
  build(x){
   const ks=x.ks,pe=x.pe;let G=0,L=0,Au=0,Lo=0,P=0,S=0;
   const rows=[...ks].reverse().map(k=>{const c=x.t.comp[k];G+=c.guyCash;L+=c.leaCash;Au+=c.gold;Lo+=c.loan;S+=c.delta;const p=pe[k];if(p!=null)P+=p;
     return {k,cells:[kC(k),sC(c.guyCash),sC(c.leaCash),sC(c.gold),c.loan?sC(c.loan):cell('—','', 'num'),cell(`<strong>${c.delta>=0?'+':'−'}$${Math.abs(Math.round(c.delta)).toLocaleString('en-US')}</strong>`,c.delta,'num'),p==null?cell('—','','num'):sC(p),sC(c.delta+(p||0))]};});
   const parts=[['Guy cash',G],['Lea cash',L],['Gold bought',Au],['Loans',Lo]].filter(p=>p[1]>0).sort((a,b)=>b[1]-a[1]);
   const top=parts[0];
   return {cols:['Month','Guy cash','Lea cash','Gold bought','Loans','Saved','Gold price','Total change'],rows,
    insight:top?`<b>${top[0]}</b> brought in ${S>0?Math.round(top[1]/S*100):0}% of the ${money0(S)} saved${x.year?` in ${x.year}`:''}.${Object.keys(pe).length?` The gold price added <b>${signed0(P)}</b> on top.`:''}`:'',
    note:'Saved is what went in, at what you paid. Gold price is how much the gold you already held gained or lost with the market (shown when the filter is Everyone). Saved plus gold price gives the total change. Tap a month to open its scorecard.'+janNote(ks),
    chart:{type:'bar',data:{labels:ks.map(lbl),datasets:[
      {label:'Guy cash',data:ks.map(k=>x.t.comp[k].guyCash),backgroundColor:C.cash,stack:'s'},
      {label:'Lea cash',data:ks.map(k=>x.t.comp[k].leaCash),backgroundColor:C.lea,stack:'s'},
      {label:'Gold bought',data:ks.map(k=>x.t.comp[k].gold),backgroundColor:C.gold,stack:'s'},
      {label:'Loans',data:ks.map(k=>x.t.comp[k].loan),backgroundColor:C.debt,stack:'s'},
      ...(Object.keys(pe).length?[{label:'Gold price',data:ks.map(k=>pe[k]==null?0:pe[k]),backgroundColor:'#E7D3A6',stack:'s'}]:[]),
      {type:'line',label:'Total change',data:ks.map(k=>x.t.comp[k].delta+(pe[k]||0)),borderColor:C.ink,backgroundColor:C.ink,borderWidth:2,pointRadius:2,tension:.25}]},options:opt({stacked:true})}};
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
    note:'Saved amounts only, so the opening balance never inflates the comparison. Follows the filter: Guy is compared with Guy, Lea with Lea.'+(Y===2027||P===2026?` January 2026 counts as ${money0(jan26())}.`:''),
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
 {id:'people',src:'ours',grp:'ours',title:'Guy and Lea by month',desc:'What each of you put in every month, gold included, and the split.',years:'all',
  build(x){
   const ks=x.ks,t=x.t;let g=0,l=0;
   const rows=[...ks].reverse().map(k=>{const c=t.comp[k],s=c.guyTotal+c.leaTotal;g+=c.guyTotal;l+=c.leaTotal;
     return {k,cells:[kC(k),mC(c.guyTotal),mC(c.leaTotal),mC(s),cell(s>0?Math.round(c.guyTotal/s*100)+'%':'—',s>0?c.guyTotal/s:'','num')]};});
   return {cols:['Month','Guy','Lea','Together','Guy share'],rows,
    insight:g+l>0?`${x.year||'Since the start'}: Guy <b>${money0(g)}</b> (${Math.round(g/(g+l)*100)}%), Lea <b>${money0(l)}</b> (${Math.round(l/(g+l)*100)}%).`:'',
    note:'Deposits only, loans excluded, gold at what you paid.'+janNote(ks),
    chart:{type:'bar',data:{labels:ks.map(lbl),datasets:[
      {label:'Guy',data:ks.map(k=>t.comp[k].guyTotal),backgroundColor:C.cash},
      {label:'Lea',data:ks.map(k=>t.comp[k].leaTotal),backgroundColor:C.lea}]},options:opt()}};
  }},
 {id:'years',src:'ours',grp:'ours',title:'Year by year',desc:'Opening balance, what each of you added, and the closing balance for every year.',years:false,
  build(x){
   const t=x.t,jf=x.jf,Y={};
   t.keys.forEach(k=>{const y=k.slice(0,4),c=t.comp[k],o=Y[y]||(Y[y]={g:0,l:0,lo:0,s:0,raw:0,last:k,first:k});const f=jf(k);
     o.g+=c.guyTotal*f;o.l+=c.leaTotal*f;o.lo+=c.loan;o.s+=c.delta*f;o.raw+=c.delta;o.last=k;});
   const ys=Object.keys(Y).sort();let open=0;const list=ys.map(y=>{const o=Y[y],close=t.cumulative[o.last],brought=o.raw-o.s,r={y,open,brought,...o,close,gp:close-open-brought-o.s};open=close;return r;});
   const rows=[...list].reverse().map((r,i,arr)=>{const p=list.find(z=>+z.y===+r.y-1);
     return {y:r.y,cells:[cell(`<strong>${r.y}</strong>`,+r.y),mC(r.open),r.brought?mC(r.brought):cell('—','','num'),mC(r.g),mC(r.l),r.lo?sC(r.lo):cell('—','','num'),mC(r.s),Math.abs(r.gp)>0.5?sC(r.gp):cell('—','','num'),mC(r.close),pC(p?pcOf(r.s,p.s):null)]};});
   const last=list[list.length-1];
   return {cols:['Year','Opening','Brought in','Guy','Lea','Loans','Saved','Gold price','Closing','Saved YoY'],rows,
    insight:last?`${last.y}: saved <b>${money0(last.s)}</b> so far, closing at <b>${money0(last.close)}</b>.`:'',
    note:`Opening + brought in + saved + gold price = closing. Gold price is what the market did to the gold you hold (closing balances count gold at market). Brought in is the savings you already had when the ledger started (January 2026 minus its real saving of ${money0(jan26())}). Saved YoY compares full years; the current year is only partly done. Tap a year to open it at the top.`,
    chart:{type:'bar',data:{labels:list.map(r=>r.y),datasets:[
      {label:'Brought in',data:list.map(r=>r.brought||0),backgroundColor:'#C9D1D9',stack:'s'},
      {label:'Guy',data:list.map(r=>r.g),backgroundColor:C.cash,stack:'s'},
      {label:'Lea',data:list.map(r=>r.l),backgroundColor:C.lea,stack:'s'},
      {label:'Gold price',data:list.map(r=>r.gp),backgroundColor:'#E7D3A6',stack:'s'},
      {type:'line',label:'Closing balance',data:list.map(r=>r.close),borderColor:C.ink,borderWidth:2,pointRadius:3}]},options:opt({stacked:true})}};
  }},
 {id:'weeks',src:'ours',grp:'ours',title:'Week by week',desc:'What you saved each week, against the week before and your 4-week average.',years:'all',
  build(x){
   const W={};x.f.forEach(d=>{if(!d.sortTs)return;const w=wkStart(d.sortTs);W[w]=(W[w]||0)+rowAmt(d)*(d.yyyyMM==='2026-01'?x.JF:1);});
   const first=Math.min(...Object.keys(W).map(Number)),last=Math.max(wkStart(Date.now()),...Object.keys(W).map(Number)),all=[];
   for(let w=first;w<=last;w=shiftD(w,7))all.push(w);
   const ws=all.filter(w=>!x.year||new Date(w).getFullYear()===+x.year).slice(-52);
   const v=w=>W[w]||0,avg4=w=>{const i=all.indexOf(w),p=all.slice(Math.max(0,i-4),i);return p.length?p.reduce((s,z)=>s+v(z),0)/p.length:null;};
   const rows=[...ws].reverse().map(w=>{const i=all.indexOf(w),pw=i>0?all[i-1]:null;return {cells:[cell(`<strong>${fd(w)}</strong>`,w),mC(v(w)),pw!=null?sC(v(w)-v(pw)):cell('—','','num'),avg4(w)==null?cell('—','','num'):mC(avg4(w)),pC(avg4(w)>0?v(w)/avg4(w)-1:null)]};});
   const lw=ws[ws.length-1],a4=avg4(lw);
   return {cols:['Week of','Saved','vs week before','4-week avg','vs average'],rows,
    insight:lw!=null?`${lw===wkStart(Date.now())?'So far this week':'Last week shown'}: <b>${money0(v(lw))}</b>${a4?`, ${pctTxt(v(lw)/a4-1)} vs your 4-week average of ${money0(a4)}`:''}.`:'',
    note:'Weeks start on Monday. Most savings land on one day a month, so weekly numbers swing a lot; the 4-week average smooths that out.'+(ws.some(w=>new Date(w).getFullYear()===2026&&new Date(w).getMonth()===0)?` January 2026 is scaled to its real saving of ${money0(jan26())}.`:''),
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
  const x={f,t,allT,lastAll,year:XP.year,ks:t.keys.filter(k=>!XP.year||k.startsWith(XP.year)),pe,JF,jf:k=>k==='2026-01'?JF:1};
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

/* ---------- Data: comparison setting ---------- */
$('x-sync').insertAdjacentHTML('afterend',`<div class="section" id="x-settings"><div class="section-header"><h2>Comparison setting</h2></div><div class="x-set">
 <label class="x-label" for="x-jan26" style="margin-top:0">January 2026 real saving, without the savings you had before</label>
 <input id="x-jan26" class="x-input" inputmode="decimal" autocomplete="off" placeholder="800">
 <p class="x-note">January 2026 also holds everything you had saved before the ledger started. Year-over-year, averages and best-month figures use this amount for that month instead, so 2027 is compared fairly.</p></div></div>`);
try{const j=parseFloat(localStorage.getItem('lg-jan26-v1'));$('x-jan26').value=isNaN(j)?'800':String(j);}catch(e){$('x-jan26').value='800';}
$('x-jan26').onchange=e=>{const v=num(e.target.value);try{localStorage.setItem('lg-jan26-v1',String(v));}catch(x){}renderAll();toast('Saved',false);};

/* ---------- source labels on the classic sections ---------- */
[['x-score','ours'],['x-insight','mix'],['charts-section','ours'],['bridge-section','ours'],['insights-section','ours'],['trends-section','ours'],['variance-section','ours'],['tx-section','ours'],['x-gold','mkt'],['x-goldhist','mix']].forEach(([id,k])=>tagSection(id,k));

const prevRA2=renderAll;
renderAll=function(){
  prevRA2();
  try{
    if(allData.length){
      const t=computeAnalytics(getFilteredData());
      if(t.keys.length){fillVarYears(t);filterVar();renderScore();renderInsights();if(view==='explore')renderExplore();}
    }
    REG.forEach(applySort);
    applyView();
  }catch(e){console.error(e);}
};
window.lgGoView=goView;
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
allData=loadSaved();
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
