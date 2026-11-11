/*  Savings Ledger: Google Sheets backend.
    1. Change TOKEN below to a long random secret (20+ characters).
    2. Deploy as a Web app (Execute as: Me, Who has access: Anyone).
    The secret is what protects your data, so keep it private. */
const TOKEN = 'CHANGE-THIS-TO-A-LONG-RANDOM-SECRET';
const TAB = 'Raw data';
const HEAD = ['ID','Timestamp','Saving Type','Amount (g)','Amount (EUR)','Amount (USD)','Name','Column 1','Gold Price','Updated','Deleted'];

function setup(){ tab_(); }

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

function out_(o){
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

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
    const at = idx[String(x.id)];
    if (at && (Number(v[at - 1][9]) || 0) > (Number(x.updated) || 0)) return;      // sheet copy is newer
    if (x.deleted){
      if (at) s.getRange(at, 10, 1, 2).setValues([[x.updated || Date.now(), true]]);
      return;
    }
    const mm = (String(x.date || '').match(/^\d{1,2}\/(\d{1,2})\//) || [])[1];
    const line = [x.id, x.date || '', x.type || '', x.gold || '', x.eur || '', (x.usd === 0 && x.gold) ? '' : x.usd,
                  x.name || '', mm ? +mm : '', x.goldPrice || '', x.updated || Date.now(), ''];
    if (at) s.getRange(at, 1, 1, 11).setValues([line]); else adds.push(line);
  });
  if (adds.length) s.getRange(s.getLastRow() + 1, 1, adds.length, 11).setValues(adds);
}

function settingsTab_(){const ss=SpreadsheetApp.getActive();let s=ss.getSheetByName('Settings');if(!s){s=ss.insertSheet('Settings');s.appendRow(['Key','Value JSON','Updated']);}return s;}
function readSettings_(){const v=settingsTab_().getDataRange().getValues(),out={};for(let i=1;i<v.length;i++){if(v[i][0])out[String(v[i][0])]={v:String(v[i][1]||''),u:Number(v[i][2])||0};}return out;}
function saveSettings_(changes){const s=settingsTab_(),v=s.getDataRange().getValues(),ix={};for(let i=1;i<v.length;i++)ix[String(v[i][0])]=i+1;Object.keys(changes||{}).forEach(k=>{const x=changes[k],at=ix[k];if(at&&(Number(v[at-1][2])||0)>=Number(x.u||0))return;const row=[k,String(x.v||''),Number(x.u)||Date.now()];if(at)s.getRange(at,1,1,3).setValues([row]);else{s.appendRow(row);ix[k]=s.getLastRow();}});}

function doGet(e){
  if(!e || !e.parameter || e.parameter.token !== TOKEN)return out_({error:'unauthorized'});
  return out_({rows:read_(),settings:readSettings_()});
}

function doPost(e){
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ error:'bad request' }); }
  if (body.token !== TOKEN) return out_({ error:'unauthorized' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { upsert_(body.rows || []);saveSettings_(body.settings||{});return out_({ ok:true }); }
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
