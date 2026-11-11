/* Google Drive / Sheets OAuth adapter. No Apps Script and no developer server. */
window.LGGoogle = (() => {
  const CLIENT_ID = 'REPLACE_WITH_YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com';
  const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets';
  const APP_MARKER = 'savings-ledger-google-v1';
  let token = '', expiry = 0, spreadsheetId = '', account = '';
  let client;
  const ready = () => /^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(CLIENT_ID);
  const active = () => Boolean(token && Date.now() < expiry && spreadsheetId);
  async function request(url, opts={}) {
    if (!token || Date.now() >= expiry) throw Error('Google session expired. Sign in again.');
    const response = await fetch(url, {...opts, headers:{Authorization:'Bearer '+token,...(opts.body?{'Content-Type':'application/json'}:{}),...(opts.headers||{})}});
    const raw = await response.text();let result;try{result=raw?JSON.parse(raw):{};}catch{result={};}
    if (!response.ok) throw Error(result.error?.message || `Google API error ${response.status}`);
    return result;
  }
  const sheets = path => 'https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(spreadsheetId)+path;
  async function login() {
    if (!ready()) throw Error('Google sign-up is not activated yet. The app owner must add a Google OAuth Client ID in google-drive.js (Google Cloud Console → Clients).');
    if (!window.google?.accounts?.oauth2) throw Error('Google sign-in library did not load. Check your internet connection.');
    if (!client) client = google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:SCOPES,callback:()=>{}});
    await new Promise((resolve,reject)=>{
      client.callback = r => {if(r.error)reject(Error(r.error));else{token=r.access_token;expiry=Date.now()+(r.expires_in-60)*1000;resolve();}};
      client.requestAccessToken({prompt:'consent'});
    });
    const profile = await request('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)');
    account=profile.user?.emailAddress||'Google account';
    // drive.file grants access to spreadsheets created by this app, not every Drive file.
    const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and appProperties has { key='ledgerApp' and value='"+APP_MARKER+"' }");
    const found=await request('https://www.googleapis.com/drive/v3/files?q='+q+'&fields=nextPageToken,files(id,name,createdTime)&page_size=100');
    if(found.files?.length>1) throw Error('Multiple ledgers found in this account. Choose one in Drive or remove duplicates before connecting.');
    if(found.files?.length) spreadsheetId=found.files[0].id;
    else {
      const created=await request('https://sheets.googleapis.com/v4/spreadsheets',{method:'POST',body:JSON.stringify({properties:{title:'Savings Ledger'},sheets:[{properties:{title:'Raw data'}},{properties:{title:'Settings'}}]})});
      spreadsheetId=created.spreadsheetId;
      await request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(spreadsheetId)+'?fields=id',{method:'PATCH',body:JSON.stringify({appProperties:{ledgerApp:APP_MARKER}})});
      await request(sheets('/values/Raw%20data!A1:K1?valueInputOption=RAW'),{method:'PUT',body:JSON.stringify({values:[['ID','Timestamp','Saving Type','Amount (g)','Amount (EUR)','Amount (USD)','Name','Column 1','Gold Price','Updated','Deleted']]})});
      await request(sheets('/values/Settings!A1:C1?valueInputOption=RAW'),{method:'PUT',body:JSON.stringify({values:[['Key','Value JSON','Updated']]})});
    }
    return {email:account,spreadsheetId,created:!(found.files?.length)};
  }
  async function get() {
    const r=await request(sheets('/values:batchGet?ranges='+encodeURIComponent("'Raw data'!A2:K")+'&ranges='+encodeURIComponent("'Settings'!A2:C")));
    const rr=r.valueRanges?.[0]?.values||[],ss=r.valueRanges?.[1]?.values||[];
    const rows=rr.filter(x=>x[0]).map(x=>({id:x[0],date:x[1]||'',type:x[2]||'',gold:+x[3]||0,eur:+x[4]||0,usd:+x[5]||0,name:x[6]||'',goldPrice:+x[8]||0,updated:+x[9]||1,deleted:String(x[10]).toLowerCase()==='true'}));
    const settings={};for(const x of ss){if(!x[0])continue;settings[x[0]]={v:x[1]||'',u:+x[2]||0};}
    return {rows,settings};
  }
  async function post(payload) {
    // Per-row writes avoid clearing the entire sheet, which could lose data
    // if two devices save at once. Timestamp conflicts remain last-write-wins.
    const response=await request(sheets('/values:batchGet?ranges='+encodeURIComponent("'Raw data'!A2:K")+'&ranges='+encodeURIComponent("'Settings'!A2:C")));
    const raw=response.valueRanges?.[0]?.values||[];
    const settingRows=response.valueRanges?.[1]?.values||[];
    const index=new Map(raw.map((r,i)=>[String(r[0]),{line:i+2,updated:+r[9]||0}]));
    const si=new Map(settingRows.map((r,i)=>[String(r[0]),{line:i+2,updated:+r[2]||0}]));
    const changes=[];
    for(const r of payload.rows||[]){
      const old=index.get(String(r.id));if(old&&(+r.updated||0)<=old.updated)continue;
      const line=old?old.line:raw.length+2;
      if(!old){raw.push([r.id]);index.set(String(r.id),{line,updated:+r.updated||0});}
      changes.push({range:"'Raw data'!A"+line+':K'+line,values:[[r.id,r.date||'',r.type||'',r.gold||0,r.eur||0,r.usd||0,r.name||'','',r.goldPrice||0,r.updated||1,!!r.deleted]]});
    }
    for(const [key,v] of Object.entries(payload.settings||{})){
      const old=si.get(key);if(old&&(+v.u||0)<=old.updated)continue;
      const line=old?old.line:settingRows.length+2;
      if(!old){settingRows.push([key]);si.set(key,{line,updated:+v.u||0});}
      changes.push({range:"'Settings'!A"+line+':C'+line,values:[[key,v.v||'',v.u||0]]});
    }
    if(changes.length)await request(sheets('/values:batchUpdate'),{method:'POST',body:JSON.stringify({valueInputOption:'RAW',data:changes})});
    return {ok:true};
  }
  const signout=()=>{if(token&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(token,()=>{});token='';expiry=0;spreadsheetId='';account='';};
  return {ready,active,login,get,post,signout,get email(){return account;},get spreadsheetId(){return spreadsheetId;}};
})();
