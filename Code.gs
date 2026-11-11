/*  Savings Ledger: Google Sheets backend (version 3).

    FIRST TIME
    1. Change TOKEN below to your own password (20+ characters is best). Never share it publicly.
    2. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.

    UPDATING FROM AN OLDER VERSION
    1. Copy your current TOKEN line somewhere, paste this whole file over the old one, put your TOKEN back.
    2. Deploy > Manage deployments > pencil > Version: New version > Deploy.
       (Saving the file is not enough: the app keeps talking to the old version until you do this.)
    3. Google may ask you to authorize again, because this version also fetches gold prices.

    What this script does:
    - keeps the entries in the "Raw data" tab in step with the app
    - keeps your settings (names, target, first-month saving, gold options, prices you typed) in the "Settings" tab
    - makes a weekly copy of your entries in a "Backup yyyy-mm-dd" tab, and keeps the last 8
    - fetches the gold price and its monthly history into the "Gold prices" tab, as a second source for the app
    It sends no email.  */
const TOKEN = 'CHANGE-THIS-TO-A-LONG-RANDOM-SECRET';
const TAB = 'Raw data';
const SET_TAB = 'Settings';
const GOLD_TAB = 'Gold prices';
const HEAD = ['ID','Timestamp','Saving Type','Amount (g)','Amount (EUR)','Amount (USD)','Name','Column 1','Gold Price','Updated','Deleted'];
const API = 3;

function setup(){ tab_(); setTab_(); goldTab_(); cleanTriggers_(); }

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
    s.appendRow(['Month','USD per ounce','USD per gram (24k)','Source']);
    s.setFrozenRows(1);
    s.getRange('A1:D1').setFontWeight('bold');
  }
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
  const s = tab_(), v = s.getDataRange().getValues(), idx = {}, adds = [];
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
    if (at) s.getRange(at, 1, 1, 11).setValues([line]); else { adds.push(line); idx[String(x.id)] = -1; }
  });
  if (adds.length) s.getRange(s.getLastRow() + 1, 1, adds.length, 11).setValues(adds);
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
  try { const j = fetchJson_('https://api.gold-api.com/price/XAU'); if (j && okPx_(Number(j.price))) return { px:Number(j.price), src:'gold-api.com' }; } catch (err) {}
  try {
    const j = fetchJson_('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1d&interval=1d');
    const p = Number(j.chart.result[0].meta.regularMarketPrice);
    if (okPx_(p)) return { px:p, src:'Yahoo Finance (GC=F)' };
  } catch (err) {}
  return null;
}
function history_(){
  const out = {};
  try {
    const arr = fetchJson_('https://freegoldapi.com/data/latest.json'), sum = {};
    arr.forEach(function(x){
      const d = String(x.date || ''), p = Number(x.price), k = d.slice(0, 7);
      if (k >= '2024-01' && okPx_(p)){ const s = sum[k] || (sum[k] = [0, 0]); s[0] += p; s[1]++; }
    });
    Object.keys(sum).forEach(function(k){ out[k] = { px:sum[k][0] / sum[k][1], src:'freegoldapi.com, month average' }; });
  } catch (err) {}
  try {
    const j = fetchJson_('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=3y&interval=1mo');
    const r = j.chart.result[0], ts = r.timestamp, cl = r.indicators.quote[0].close;
    for (let i = 0; i < ts.length; i++){
      const p = Number(cl[i]), k = Utilities.formatDate(new Date(ts[i] * 1000), 'GMT', 'yyyy-MM');
      if (okPx_(p) && !out[k]) out[k] = { px:p, src:'Yahoo Finance, month close' };
    }
  } catch (err) {}
  return out;
}
function gold_(){
  const cache = CacheService.getScriptCache(), hit = cache.get('gold3');
  if (hit) return JSON.parse(hit);
  const props = PropertiesService.getScriptProperties(), s = goldTab_(), OZ = 31.1034768;
  const now = new Date(), cur = Utilities.formatDate(now, 'GMT', 'yyyy-MM');
  const v = s.getDataRange().getValues(), months = {}, rowOf = {};
  for (let i = 1; i < v.length; i++){ const k = String(v[i][0]); if (/^\d{4}-\d{2}$/.test(k)){ months[k] = Number(v[i][1]); rowOf[k] = i + 1; } }
  const put = function(k, px, src){
    const line = [k, Math.round(px * 100) / 100, Math.round(px / OZ * 100) / 100, src];
    if (rowOf[k]) s.getRange(rowOf[k], 1, 1, 4).setValues([line]); else { s.appendRow(line); rowOf[k] = s.getLastRow(); }
    months[k] = px;
  };
  if (Date.now() - (Number(props.getProperty('goldHistAt')) || 0) > 12 * 3600000){
    const h = history_();
    Object.keys(h).sort().forEach(function(k){ if (k < cur && (!months[k] || Math.abs(months[k] - h[k].px) > 0.5)) put(k, h[k].px, h[k].src); });
    if (Object.keys(h).length) props.setProperty('goldHistAt', String(Date.now()));
  }
  const live = livePx_(), out = { px:0, at:0, months:{} };
  if (live){ put(cur, live.px, live.src + ', latest'); out.px = live.px; out.at = Date.now(); }
  Object.keys(months).forEach(function(k){ if (k < cur) out.months[k] = months[k]; });   // closed months only: the app has the latest price separately
  cache.put('gold3', JSON.stringify(out), 900);
  return out;
}

/* Earlier versions sent a monthly email. This one does not, so its timer is removed. */
function cleanTriggers_(){
  ScriptApp.getProjectTriggers().forEach(function(t){ if (t.getHandlerFunction() === 'monthly_') ScriptApp.deleteTrigger(t); });
}
function monthly_(){ cleanTriggers_(); }

/* ---------- web app ---------- */
function extras_(){
  const o = { api:API, settings:{}, gold:null, backupAt:0 };
  try { o.settings = settings_(); } catch (err) {}
  try { o.gold = gold_(); } catch (err) {}
  try { o.backupAt = backup_(); } catch (err) {}
  return o;
}

function doGet(e){
  if (!e || !e.parameter || e.parameter.token !== TOKEN) return out_({ error:'unauthorized' });
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
  try {
    upsert_(body.rows || []);
    if (body.settings) saveSettings_(body.settings);
    return out_({ ok:true, api:API, rows:(body.rows || []).length, settings:body.settings ? Object.keys(body.settings).length : 0 });
  }
  finally { lock.releaseLock(); }
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
