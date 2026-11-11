/*  Savings Ledger: Google Sheets backend (version 5).

    FIRST TIME
    1. Change TOKEN below to your own password (20+ characters is best). Never share it publicly.
    2. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.

    UPDATING FROM AN OLDER VERSION
    1. Copy your current TOKEN line somewhere, paste this whole file over the old one, put your TOKEN back.
    2. Deploy > Manage deployments > pencil > Version: New version > Deploy.
       (Saving the file is not enough: the app keeps talking to the old version until you do this.)
    3. In this editor, choose the function "setup" in the toolbar and press Run, once. Google asks you to authorize:
       accept. This starts the hourly timer that sends notifications to your phones.

    What this script does:
    - keeps the entries in the "Raw data" tab in step with the app
    - keeps your settings (names, target, first-month saving, gold options, prices you typed) in the "Settings" tab
    - makes a weekly copy of your entries in a "Backup yyyy-mm-dd" tab, and keeps the last 8
    - fetches the gold price and its monthly history into the "Gold prices" tab, as a second source for the app
    - sends push notifications to the phones that allowed them, even when the app is closed ("Push" tab)
    It sends no email.  */
const TOKEN = 'CHANGE-THIS-TO-A-LONG-RANDOM-SECRET';
const TAB = 'Raw data';
const SET_TAB = 'Settings';
const GOLD_TAB = 'Gold prices';
const HEAD = ['ID','Timestamp','Saving Type','Amount (g)','Amount (EUR)','Amount (USD)','Name','Column 1','Gold Price','Updated','Deleted'];
const PUSH_TAB = 'Push';
const API = 5;

function setup(){ tab_(); setTab_(); goldTab_(); pushTab_(); vapid_(); cleanTriggers_(); ensureTick_(); }

function tab_(){
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(TAB);
  if (!s){
    s = ss.insertSheet(TAB);
    s.appendRow(HEAD);
    s.setFrozenRows(1);
    s.getRange('A1:K1').setFontWeight('bold');
    s.getRange('A:B').setNumberFormat('@');   // keep IDs and dates as typed text
    s.getRange('J:J').setNumberFormat('0');
  }
  return s;
}
function setTab_(){
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(SET_TAB);
  if (!s){
    s = ss.insertSheet(SET_TAB);
    s.appendRow(['Setting','Value','Updated']);
    s.setFrozenRows(1);
    s.getRange('A1:C1').setFontWeight('bold');
  }
  s.getRange('A:B').setNumberFormat('@');     // values are stored exactly as the app sends them
  s.getRange('C:C').setNumberFormat('0');
  return s;
}
function goldTab_(){
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(GOLD_TAB);
  if (!s){
    s = ss.insertSheet(GOLD_TAB);
    s.getRange('A:A').setNumberFormat('@');
    s.appendRow(['Month','USD per ounce','USD per gram (24k)','Source','Observation UTC','Saved UTC']);
    s.setFrozenRows(1);
    s.getRange('A1:F1').setFontWeight('bold');
  }
  /* Existing 4-column sheets are upgraded without overwriting saved observations. */
  if(!s.getRange('E1').getValue())s.getRange('E1:F1').setValues([['Observation UTC','Saved UTC']]);
  s.getRange('E:F').setNumberFormat('@');
  return s;
}

function out_(o){
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- entries ---------- */
function read_(){
  const v = tab_().getDataRange().getValues(), tz = Session.getScriptTimeZone(), rows = [];
  for (let i = 1; i < v.length; i++){
    const r = v[i];
    if (!r[0]) continue;
    const d = r[1] instanceof Date ? Utilities.formatDate(r[1], tz, 'dd/MM/yyyy HH:mm:ss') : String(r[1]);
    rows.push({ id:String(r[0]), date:d, type:String(r[2]), gold:r[3], eur:r[4], usd:r[5], name:String(r[6]),
                goldPrice:r[8], updated:Number(r[9]) || 0, deleted:(r[10] === true || String(r[10]).toLowerCase() === 'true') });
  }
  return rows;
}

function upsert_(rows){
  const s = tab_(), v = s.getDataRange().getValues(), idx = {}, adds = [], fresh = [];
  for (let i = 1; i < v.length; i++) if (v[i][0]) idx[String(v[i][0])] = i + 1;
  rows.forEach(function(x){
    if (!x || x.id == null || x.id === '') return;
    const at = idx[String(x.id)];
    if (at && (Number(v[at - 1][9]) || 0) > (Number(x.updated) || 0)) return;      // the Sheet's copy is newer
    if (x.deleted){
      if (at) s.getRange(at, 10, 1, 2).setValues([[x.updated || Date.now(), true]]);
      return;
    }
    const mm = (String(x.date || '').match(/^\d{1,2}\/(\d{1,2})\//) || [])[1];
    const line = [String(x.id), x.date || '', x.type || '', x.gold || '', x.eur || '', (x.usd === 0 && x.gold) ? '' : x.usd,
                  x.name || '', mm ? +mm : '', x.goldPrice || '', x.updated || Date.now(), ''];
    if (at) s.getRange(at, 1, 1, 11).setValues([line]); else { adds.push(line); idx[String(x.id)] = -1; fresh.push(x); }
  });
  if (adds.length) s.getRange(s.getLastRow() + 1, 1, adds.length, 11).setValues(adds);
  return fresh;
}

/* ---------- settings: one row per setting, the newest change wins ---------- */
function settings_(){
  const v = setTab_().getDataRange().getValues(), o = {};
  for (let i = 1; i < v.length; i++) if (v[i][0]) o[String(v[i][0])] = { v:String(v[i][1]), u:Number(v[i][2]) || 0 };
  return o;
}
function saveSettings_(inc){
  if (!inc || typeof inc !== 'object') return;
  const s = setTab_(), v = s.getDataRange().getValues(), idx = {};
  for (let i = 1; i < v.length; i++) if (v[i][0]) idx[String(v[i][0])] = i + 1;
  Object.keys(inc).forEach(function(k){
    const x = inc[k]; if (!x || !/^[A-Za-z0-9_]{1,40}$/.test(k)) return;
    const at = idx[k], u = Number(x.u) || Date.now(), val = String(x.v == null ? '' : x.v).slice(0, 40000);
    if (at){
      if ((Number(v[at - 1][2]) || 0) >= u) return;
      s.getRange(at, 1, 1, 3).setValues([[k, val, u]]);
    } else {
      s.appendRow([k, val, u]);
      idx[k] = s.getLastRow();
    }
  });
}

/* ---------- weekly backup: a copy of the entries, last 8 kept ---------- */
function backup_(){
  const props = PropertiesService.getScriptProperties();
  const last = Number(props.getProperty('backupAt')) || 0;
  if (Date.now() - last < 7 * 86400000) return last;
  const ss = SpreadsheetApp.getActive(), src = tab_();
  if (src.getLastRow() < 2) return last;
  const name = 'Backup ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (!ss.getSheetByName(name)) src.copyTo(ss).setName(name);
  const now = Date.now();
  props.setProperty('backupAt', String(now));
  const old = ss.getSheets().filter(function(s){ return /^Backup \d{4}-\d{2}-\d{2}$/.test(s.getName()); })
                .sort(function(a, b){ return a.getName() < b.getName() ? 1 : -1; });
  old.slice(8).forEach(function(s){ ss.deleteSheet(s); });
  return now;
}

/* ---------- gold: latest price and monthly history, kept in the "Gold prices" tab ---------- */
function okPx_(p){ return typeof p === 'number' && p > 500 && p < 20000; }
function fetchJson_(url){
  const r = UrlFetchApp.fetch(url, { muteHttpExceptions:true, headers:{ 'User-Agent':'Mozilla/5.0' } });
  if (r.getResponseCode() !== 200) return null;
  return JSON.parse(r.getContentText());
}
function livePx_(){
  try {
    const j=fetchJson_('https://api.gold-api.com/price/XAU');
    const p=Number(j&&j.price),at=Date.parse(j&&j.updatedAt||'');
    if(j&&j.symbol==='XAU'&&j.currency==='USD'&&okPx_(p)&&isFinite(at)&&at<=Date.now()+300000&&at>=Date.now()-7*86400000)
      return { px:p, at:at, src:'Gold-API.com, spot' };
  } catch (err) {}
  /* A clearly attributed secondary spot quote, not a futures contract. */
  try {
    const j=fetchJson_('https://standardbullion.com/spot-prices.json');
    const x=j&&j.metals&&j.metals.filter(function(m){return m.symbol==='XAU';})[0];
    const bid=Number(x&&x.bid),ask=Number(x&&x.ask),at=Date.parse(j&&j.updated||'');
    if(okPx_(bid)&&okPx_(ask)&&ask>=bid&&isFinite(at)&&at<=Date.now()+300000&&at>=Date.now()-7*86400000)
      return { px:(ask+bid)/2, at:at, src:'Standard Bullion, indicative bid/ask midpoint' };
  } catch (err) {}
  return null;
}
/* One last dated daily close per UTC calendar month, not a mean of prices or a gold purchase. */
function history_(){
  const out={};
  try {
    const j=fetchJson_('https://standardbullion.com/api/v1/market/history?metal=XAU&range=5y');
    if(!j||j.metal!=='XAU'||!Array.isArray(j.points))return out;
    const cur=Utilities.formatDate(new Date(),'GMT','yyyy-MM');
    j.points.forEach(function(x){
      const ts=Date.parse(String(x.t||'')),p=Number(x.price),k=String(x.t||'').slice(0,7);
      if(!isFinite(ts)||ts>Date.now()||!okPx_(p)||k>=cur||k<'2011-01')return;
      if(!out[k]||ts>out[k].at)out[k]={ px:p,src:'Standard Bullion, month-end close', at:ts, date:String(x.t).slice(0,10), method:'month-end-close' };
    });
  } catch (err) {}
  return out;
}
function gold_(){
  const cache=CacheService.getScriptCache(),hit=cache.get('gold-v29');
  if(hit)return JSON.parse(hit);
  const props=PropertiesService.getScriptProperties(),s=goldTab_(),OZ=31.1034768;
  const cur=Utilities.formatDate(new Date(),'GMT','yyyy-MM'),v=s.getDataRange().getValues(),months={},meta={},rowOf={};
  for(let i=1;i<v.length;i++){
    const k=String(v[i][0]),p=Number(v[i][1]);
    if(!/^\d{4}-\d{2}$/.test(k)||!okPx_(p))continue;
    months[k]=p;rowOf[k]=i+1;
    const ob=v[i][4] instanceof Date?v[i][4].toISOString():String(v[i][4]||''),ts=Date.parse(ob),method=/month-end close/.test(String(v[i][3]))?'month-end-close':'legacy';
    meta[k]={at:isFinite(ts)?ts:0,date:ob.slice(0,10),source:String(v[i][3]||'legacy'),method};
  }
  const put=function(k,q){
    const line=[k,Math.round(q.px*100)/100,Math.round(q.px/OZ*10000)/10000,q.src,
      q.at?new Date(q.at).toISOString():'',new Date().toISOString()];
    if(rowOf[k])s.getRange(rowOf[k],1,1,6).setValues([line]);
    else{s.appendRow(line);rowOf[k]=s.getLastRow();}
    months[k]=q.px;meta[k]={at:q.at||0,date:q.date||(q.at?new Date(q.at).toISOString().slice(0,10):''),source:q.src,method:q.method||'dated-spot'};
  };
  if(Date.now()-(Number(props.getProperty('goldHistAtV29'))||0)>12*3600000){
    const h=history_();
    Object.keys(h).sort().forEach(function(k){
      if(k<cur&&(meta[k]&&meta[k].method!=='month-end-close'||!months[k]||Math.abs(months[k]-h[k].px)>0.005))put(k,h[k]);
    });
    if(Object.keys(h).length)props.setProperty('goldHistAtV29',String(Date.now()));
  }
  const live=livePx_(),out={px:0,at:0,source:'',months:{},meta:{}};
  if(live){
    const prior=meta[cur]||{at:0};
    if(live.at>=prior.at)put(cur,Object.assign({method:'dated-spot'},live));
    props.setProperty('goldLiveAt',String(Math.max(live.at,prior.at)));
  }
  if(okPx_(Number(months[cur]))){
    out.px=months[cur];out.at=Number(meta[cur]&&meta[cur].at)||Number(props.getProperty('goldLiveAt'))||0;
    out.source=meta[cur]&&meta[cur].source||'previously saved market quote';
  }else{
    /* Never wipe a last-known quote when the network fetch fails or the month changes. */
    const keys=Object.keys(months).sort().filter(function(k){return k<=cur;});
    if(keys.length){const last=keys[keys.length-1];out.px=months[last];out.at=Number(meta[last]&&meta[last].at)||0;out.source='cached '+(meta[last]&&meta[last].source||'market quote');}
  }
  Object.keys(months).forEach(function(k){if(k<cur){out.months[k]=months[k];out.meta[k]=meta[k];}});
  cache.put('gold-v29',JSON.stringify(out),900);
  return out;
}

/* Earlier versions sent a monthly email. This one does not, so its timer is removed. */
function cleanTriggers_(){
  ScriptApp.getProjectTriggers().forEach(function(t){ if (t.getHandlerFunction() === 'monthly_') ScriptApp.deleteTrigger(t); });
}
function monthly_(){ cleanTriggers_(); }

/* ---------- web app ---------- */
function extras_(){
  const o = { api:API, settings:{}, gold:null, backupAt:0, push:null };
  try { o.push = { key:vapid_().pub }; } catch (err) {}
  try { ensureTick_(); } catch (err) {}
  try { o.settings = settings_(); } catch (err) {}
  try { o.gold = gold_(); } catch (err) {}
  try { o.backupAt = backup_(); } catch (err) {}
  return o;
}

function doGet(e){
  if (!e || !e.parameter || e.parameter.token !== TOKEN) return out_({ error:'unauthorized' });
  if (e.parameter.notes){                       // a phone woken by a push asks what to show
    const lock = LockService.getScriptLock(); lock.waitLock(15000);
    try { return out_({ notes:takeNotes_(String(e.parameter.dev || '')) }); } finally { lock.releaseLock(); }
  }
  const o = extras_();
  o.rows = read_();
  return out_(o);
}

function doPost(e){
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ error:'bad request' }); }
  if (body.token !== TOKEN) return out_({ error:'unauthorized' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let fresh = [], pushed = null, test = null;
  try {
    fresh = upsert_(body.rows || []) || [];
    if (body.settings) saveSettings_(body.settings);
    try { if (body.push) pushed = registerPush_(body.push); } catch (err) {}
    try { if (fresh.length && fresh.length <= 12) partnerNotes_(fresh, String(body.dev || '')); } catch (err) {}
    try { if (body.pushTest) test = testNote_(String(body.dev || '')); } catch (err) { test = String(err); }
  }
  finally { lock.releaseLock(); }
  try { flushPush_(); } catch (err) {}
  return out_({ ok:true, api:API, rows:(body.rows || []).length, settings:body.settings ? Object.keys(body.settings).length : 0, push:pushed, test:test });
}

/* ====================================================================================================
   Push notifications, sent from this script to the phones.
   The script signs a short permission slip (VAPID, ES256) and knocks on the phone's push service with an
   empty message. The phone wakes the app's service worker, which asks this script what to show. Nothing
   about your ledger travels through Apple's or Google's push servers: they only carry the knock.
   ==================================================================================================== */
function pushTab_(){
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(PUSH_TAB);
  if (!s){
    s = ss.insertSheet(PUSH_TAB);
    s.appendRow(['Device','Endpoint','Prefs','State','Queue','Updated']);
    s.setFrozenRows(1);
    s.getRange('A1:F1').setFontWeight('bold');
    s.getRange('A:E').setNumberFormat('@');
  }
  return s;
}
function j_(t, d){ try { const o = JSON.parse(String(t || '')); return o == null ? d : o; } catch (err) { return d; } }
function devices_(){
  const v = pushTab_().getDataRange().getValues(), out = [];
  for (let i = 1; i < v.length; i++){
    if (!v[i][0]) continue;
    out.push({ row:i + 1, dev:String(v[i][0]), endpoint:String(v[i][1] || ''), prefs:j_(v[i][2], {}), state:j_(v[i][3], {}), queue:j_(v[i][4], []), dirty:false, fire:false });
  }
  return out;
}
function saveDev_(d){
  pushTab_().getRange(d.row, 1, 1, 6).setValues([[d.dev, d.endpoint, JSON.stringify(d.prefs), JSON.stringify(d.state), JSON.stringify(d.queue), Date.now()]]);
}
function registerPush_(info){
  const dev = String(info.dev || '').slice(0, 60), ep = String(info.endpoint || '');
  if (!/^[A-Za-z0-9_-]{6,60}$/.test(dev)) return false;
  const s = pushTab_(), list = devices_(), old = list.filter(function(d){ return d.dev === dev; })[0];
  if (!/^https:\/\/[^\s]{10,900}$/.test(ep)){ if (old) s.deleteRow(old.row); return false; }
  const prefs = (info.prefs && typeof info.prefs === 'object') ? info.prefs : {};
  if (info.app && /^https:\/\//.test(String(info.app))) PropertiesService.getScriptProperties().setProperty('appUrl', String(info.app).slice(0, 300));
  if (old){ old.endpoint = ep; old.prefs = prefs; saveDev_(old); }
  else {
    const now = new Date(), tz = Session.getScriptTimeZone();
    /* a phone that joins mid-month is not sent alerts for things that are already old news */
    const cur = Utilities.formatDate(now, tz, 'yyyy-MM'), st = { nudge:cur, report:prevKey_(cur) };
    s.appendRow([dev, ep, JSON.stringify(prefs), JSON.stringify(st), '[]', Date.now()]);
  }
  return true;
}
const MONTHS_ = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function prevKey_(k){ const y = +k.slice(0, 4), m = +k.slice(5); return m === 1 ? (y - 1) + '-12' : y + '-' + ('0' + (m - 1)).slice(-2); }
function enqueue_(d, note){
  d.queue = [note].concat(d.queue.filter(function(n){ return n.tag !== note.tag; })).slice(0, 5);
  d.dirty = true; d.fire = true;
}
function takeNotes_(dev){
  const d = devices_().filter(function(x){ return x.dev === dev; })[0];
  if (!d || !d.queue.length) return [];
  const q = d.queue; d.queue = []; saveDev_(d);
  return q.reverse();
}
/* devices to knock on are remembered until the lock is released, so slow network calls never hold the ledger */
var PENDING_ = [];
function commit_(list){
  list.forEach(function(d){ if (d.dirty) saveDev_(d); if (d.fire && d.endpoint) PENDING_.push({ dev:d.dev, endpoint:d.endpoint }); });
}
function flushPush_(){
  const todo = PENDING_; PENDING_ = [];
  const gone = [];
  todo.forEach(function(d){ const code = sendPush_(d.endpoint); if (code === 404 || code === 410) gone.push(d.dev); });
  if (gone.length){
    const lock = LockService.getScriptLock(); lock.waitLock(15000);
    try { devices_().filter(function(d){ return gone.indexOf(d.dev) >= 0; }).sort(function(a, b){ return b.row - a.row; }).forEach(function(d){ pushTab_().deleteRow(d.row); }); }
    finally { lock.releaseLock(); }
  }
}

/* ----- what to say ----- */
function cap_(t){ return String(t || '').replace(/loan/ig, '').trim().replace(/(^|\s)\S/g, function(c){ return c.toUpperCase(); }); }
function money_(n){ return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function monthKey_(dateText){
  const m = String(dateText || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? m[3] + '-' + ('0' + m[2]).slice(-2) : '';
}
function isLoan_(r){ return /loan/i.test(String(r.name || '')); }
function amount_(r){ return (Number(r.usd) || 0) + (isLoan_(r) ? 0 : (Number(r.gold) || 0) * (Number(r.goldPrice) || 0)); }
function setting_(all, key){ try { return all[key] && all[key].v !== '' ? JSON.parse(all[key].v) : null; } catch (err) { return null; } }
function wants_(d, kind){ return d.endpoint && d.prefs.push !== false && d.prefs[kind] !== false; }

function partnerNotes_(fresh, fromDev){
  const list = devices_().filter(function(d){ return d.dev !== fromDev && wants_(d, 'partner'); });
  if (!list.length) return;
  const who = []; fresh.forEach(function(r){ const n = cap_(r.name) || 'Someone'; if (who.indexOf(n) < 0) who.push(n); });
  const what = function(r){
    const u = Number(r.usd) || 0, g = Number(r.gold) || 0;
    return isLoan_(r) ? 'a loan entry of ' + money_(Math.abs(u)) : (g > 0 ? g + ' g of gold' : (u < 0 ? 'a withdrawal of ' : '') + money_(Math.abs(u)));
  };
  const total = fresh.reduce(function(a, r){ return a + amount_(r); }, 0);
  const note = fresh.length === 1
    ? { title:who[0] + ' added ' + what(fresh[0]), body:'Dated ' + String(fresh[0].date || '').split(' ')[0] + '. Tap to open your ledger.', url:'./', tag:'partner-' + fresh[0].id }
    : { title:fresh.length + ' new entries from ' + who.join(' and '), body:'Together ' + (total >= 0 ? '+' : '-') + money_(Math.abs(total)).replace('-', '') + '. Tap to open your ledger.', url:'./', tag:'partner-' + fresh[0].id };
  list.forEach(function(d){ enqueue_(d, note); });
  commit_(list);
}
function testNote_(dev){
  const list = devices_().filter(function(d){ return d.dev === dev; });
  if (!list.length || !list[0].endpoint) return 'not registered';
  enqueue_(list[0], { title:'Push works', body:'This came from your ledger, through your Google Sheet. It reaches this phone with the app closed.', url:'./', tag:'test' });
  commit_(list);
  return 'sent';
}
/* runs every hour: the dated alerts, and gold moves */
function pushTick_(){
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const list = devices_().filter(function(d){ return d.endpoint && d.prefs.push !== false; });
    if (!list.length) return;
    const tz = Session.getScriptTimeZone(), now = new Date();
    const day = Number(Utilities.formatDate(now, tz, 'd')), hour = Number(Utilities.formatDate(now, tz, 'H'));
    const cur = Utilities.formatDate(now, tz, 'yyyy-MM');
    const prev = prevKey_(cur);
    const rows = read_().filter(function(r){ return !r.deleted; }), all = settings_();
    const keys = rows.map(function(r){ return monthKey_(r.date); }).filter(String).sort(), first = keys[0] || '';
    let savedPrev = 0, savedCur = false;
    rows.forEach(function(r){
      const k = monthKey_(r.date);
      if (k === prev) savedPrev += amount_(r);
      if (k === cur && !isLoan_(r) && amount_(r) > 0) savedCur = true;
    });
    if (first === prev){ const st = setting_(all, 'startSaving'); if (st != null && st !== '' && !isNaN(Number(st))) savedPrev = Number(st); }
    const monthName = MONTHS_[+prev.slice(5) - 1], curName = MONTHS_[+cur.slice(5) - 1];
    list.forEach(function(d){
      const at = Number(d.prefs.hour) || 9;
      if (hour < at) return;
      if (wants_(d, 'report') && day <= 7 && first && first <= prev && d.state.report !== prev){
        enqueue_(d, { title:'Your ' + monthName + ' report is ready', body:'You saved ' + money_(savedPrev) + ' in ' + monthName + '. Tap for net worth, goal and gold.', url:'./#report=' + prev, tag:'report-' + prev });
        d.state.report = prev;
      }
      if (wants_(d, 'nudge') && day >= (Number(d.prefs.nudgeDay) || 10) && first && first < cur && d.state.nudge !== cur){
        if (!savedCur) enqueue_(d, { title:'Nothing saved yet in ' + curName, body:'Add this month\'s savings when you have a minute.', url:'./', tag:'nudge-' + cur });
        d.state.nudge = cur; d.dirty = true;
      }
    });
    /* gold: 3% or more since the last alert */
    try {
      const g = gold_(), props = PropertiesService.getScriptProperties(), ref = Number(props.getProperty('goldRef')) || 0;
      if (g && g.px > 0 && g.at > 0 && Date.now()-g.at < 90*60*1000){
        /* A new provider/source must not create a false 3% alert from the previous version's baseline. */
        if (!ref || props.getProperty('goldRefSource') !== 'gold-v29') {
          props.setProperty('goldRef', String(g.px));
          props.setProperty('goldRefAt', String(Date.now()));
          props.setProperty('goldRefSource', 'gold-v29');
        }
        else {
          const mv = g.px / ref - 1;
          if (Math.abs(mv) >= 0.03){
            const kDef = Number(setting_(all, 'goldKarat')) || 21; let grams = 0, worth = 0;
            rows.forEach(function(r){
              const gr = Number(r.gold) || 0; if (isLoan_(r) || gr <= 0) return;
              const m = /(\d{2})\s*k/i.exec(String(r.type || '')), k = m && +m[1] >= 8 && +m[1] <= 24 ? +m[1] : kDef;
              grams += gr; worth += gr * k / 24 * g.px / 31.1034768;
            });
            if (grams > 0){
              const since = Utilities.formatDate(new Date(Number(props.getProperty('goldRefAt')) || Date.now()), tz, 'd MMM');
              const note = { title:'Gold is ' + (mv >= 0 ? 'up ' : 'down ') + Math.abs(mv * 100).toFixed(1) + '% since ' + since,
                             body:'Your ' + (Math.round(grams * 10) / 10) + ' g is worth about ' + money_(worth) + '. Tap to open the Gold tab.', url:'./', tag:'gold' };
              list.forEach(function(d){ if (wants_(d, 'gold')) enqueue_(d, note); });
            }
            props.setProperty('goldRef', String(g.px)); props.setProperty('goldRefAt', String(Date.now()));
          }
        }
      }
    } catch (err) {}
    commit_(list);
  }
  finally { lock.releaseLock(); }
  flushPush_();
}
function ensureTick_(){
  const has = ScriptApp.getProjectTriggers().some(function(t){ return t.getHandlerFunction() === 'pushTick_'; });
  if (!has) ScriptApp.newTrigger('pushTick_').timeBased().everyHours(1).create();
}

/* ----- the knock: an empty Web Push with a VAPID permission slip ----- */
function sendPush_(endpoint){
  try {
    const m = /^(https:\/\/[^\/]+)\//.exec(endpoint); if (!m) return 0;
    const v = vapid_(), props = PropertiesService.getScriptProperties();
    const app = props.getProperty('appUrl') || '';
    const sub = /^https:\/\//.test(app) ? app : 'mailto:' + (Session.getEffectiveUser().getEmail() || 'owner@example.com');
    const head = b64u_(JSON.stringify({ typ:'JWT', alg:'ES256' }));
    const body = b64u_(JSON.stringify({ aud:m[1], exp:Math.floor(Date.now() / 1000) + 12 * 3600, sub:sub }));
    const sig = ecSign_(head + '.' + body, v.d);
    const r = UrlFetchApp.fetch(endpoint, { method:'post', payload:'', muteHttpExceptions:true,
      headers:{ Authorization:'vapid t=' + head + '.' + body + '.' + sig + ', k=' + v.pub, TTL:'86400', Urgency:'normal' } });
    const code = r.getResponseCode();
    props.setProperty('pushLast', code + ' at ' + new Date().toISOString() + (code >= 300 ? ' ' + String(r.getContentText()).slice(0, 200) : ''));
    return code;
  } catch (err) {
    try { PropertiesService.getScriptProperties().setProperty('pushLast', 'error ' + String(err).slice(0, 200)); } catch (e2) {}
    return 0;
  }
}
/* the script's own key pair, made once and kept in Script Properties. The public half goes to the phones. */
function vapid_(){
  const props = PropertiesService.getScriptProperties();
  let dHex = props.getProperty('vapidD'), pub = props.getProperty('vapidPub');
  if (!dHex || !pub){
    const seed = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, [Utilities.getUuid(), Utilities.getUuid(), Utilities.getUuid(), Utilities.getUuid(), Date.now()].join('|'));
    const d = big_(seed) % (EC_N - B1_) + B1_, Q = ecMul_(d, { x:EC_GX, y:EC_GY });
    dHex = hex_(d); pub = b64u_(unhex_('04' + hex_(Q.x) + hex_(Q.y)));
    props.setProperty('vapidD', dHex); props.setProperty('vapidPub', pub);
  }
  return { d:BigInt('0x' + dHex), pub:pub };
}
/* ----- ES256 (ECDSA on P-256, SHA-256), written out because Apps Script has no built-in for it ----- */
const B0_ = BigInt(0), B1_ = BigInt(1), B2_ = BigInt(2), B3_ = BigInt(3);
const EC_P = BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff');
const EC_N = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
const EC_GX = BigInt('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296');
const EC_GY = BigInt('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5');
function mod_(a, m){ const r = a % m; return r >= B0_ ? r : r + m; }
function inv_(a, m){
  let r0 = mod_(a, m), r1 = m, s0 = B1_, s1 = B0_;
  while (r1 !== B0_){ const q = r0 / r1, r2 = r0 - q * r1, s2 = s0 - q * s1; r0 = r1; r1 = r2; s0 = s1; s1 = s2; }
  return mod_(s0, m);
}
function ecAdd_(P, Q){
  if (!P) return Q; if (!Q) return P;
  let lam;
  if (P.x === Q.x){
    if (mod_(P.y + Q.y, EC_P) === B0_) return null;
    lam = mod_((B3_ * P.x * P.x - B3_) * inv_(B2_ * P.y, EC_P), EC_P);      // the curve's a is -3
  } else lam = mod_((Q.y - P.y) * inv_(Q.x - P.x, EC_P), EC_P);
  const x = mod_(lam * lam - P.x - Q.x, EC_P);
  return { x:x, y:mod_(lam * (P.x - x) - P.y, EC_P) };
}
function ecMul_(k, P){
  let R = null; const bits = k.toString(2);
  for (let i = 0; i < bits.length; i++){ R = ecAdd_(R, R); if (bits[i] === '1') R = ecAdd_(R, P); }
  return R;
}
function hex_(n){ return ('0'.repeat(64) + n.toString(16)).slice(-64); }
function unhex_(h){ const out = []; for (let i = 0; i < h.length; i += 2){ const b = parseInt(h.substr(i, 2), 16); out.push(b > 127 ? b - 256 : b); } return out; }
function big_(bytes){ let h = ''; for (let i = 0; i < bytes.length; i++) h += ('0' + ((bytes[i] + 256) % 256).toString(16)).slice(-2); return BigInt('0x' + (h || '0')); }
function b64u_(x){ return Utilities.base64EncodeWebSafe(x).replace(/=+$/, ''); }
function ecSign_(text, d){
  const z = big_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8));
  for (let n = 0; n < 50; n++){
    /* a fresh secret number for each signature, never reused, never guessable from outside */
    const seed = unhex_(hex_(z)).concat(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + '|' + n + '|' + Date.now()));
    const k = big_(Utilities.computeHmacSha256Signature(seed, unhex_(hex_(d)))) % (EC_N - B1_) + B1_;
    const R = ecMul_(k, { x:EC_GX, y:EC_GY }), r = mod_(R.x, EC_N);
    if (r === B0_) continue;
    const s = mod_(inv_(k, EC_N) * (z + r * d), EC_N);
    if (s === B0_) continue;
    return b64u_(unhex_(hex_(r) + hex_(s)));
  }
  throw new Error('could not sign');
}

/* Keeps edits made by hand in the Sheet visible to the app. */
function onEdit(e){
  const r = e.range, s = r.getSheet();
  if (s.getName() !== TAB) return;
  if (r.getColumn() === 10 && r.getNumColumns() === 1) return;
  const now = Date.now();
  for (let row = r.getRow(); row < r.getRow() + r.getNumRows(); row++){
    if (row < 2) continue;
    const id = s.getRange(row, 1).getValue();
    const vals = s.getRange(row, 2, 1, 8).getValues()[0];
    if (vals.every(function(c){ return c === ''; })){
      if (id) s.getRange(row, 10, 1, 2).setValues([[now, true]]);
      continue;
    }
    if (!id) s.getRange(row, 1).setValue(Utilities.getUuid().slice(0, 8));
    s.getRange(row, 10).setValue(now);
  }
}
