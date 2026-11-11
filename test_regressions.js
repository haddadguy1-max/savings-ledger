'use strict';
/* Guards against the defects found in versions 24 to 26. Run with: node test_regressions.js */
const assert=require('node:assert/strict'),fs=require('node:fs');
const a=fs.readFileSync(__dirname+'/app-extras.js','utf8'),g=fs.readFileSync(__dirname+'/Code.gs','utf8'),sw=fs.readFileSync(__dirname+'/sw.js','utf8'),html=fs.readFileSync(__dirname+'/index.html','utf8');
const v=/const APPV='(\d+)'/.exec(a)[1];
assert(!a.includes('Recover the selected ledger cache after a reload'),'saved copy must never be restored over live data on reload');
assert(!a.includes('setInterval(accountSave'),'no periodic copies');
assert(!a.includes('fullDataConfig'),'one setting, one key');
assert(!a.includes('Unavailable'),'report never shows Unavailable');
assert(!a.includes('chartJpeg')&&!a.includes('buildOnePagePdf'),'one PDF, drawn as vectors');
assert(a.includes('if(!first)shStamp();'),'changes on this phone are stamped before every merge');
assert(a.includes("'lg-goldhist-v1'")&&a.includes("'lg-dirty-v1'"),'gold history and the unsynced flag belong to the ledger');
assert(g.includes('function doGet(e)')&&g.includes('settings_()')&&g.includes('saveSettings_(body.settings)'),'script reads and writes settings');
assert(!/MailApp/.test(g),'no email');
assert(g.includes("const TOKEN = 'CHANGE-THIS-TO-A-LONG-RANDOM-SECRET';"),'no real password in the published file');
assert(sw.includes(`const V='lg-ledger-v${v}'`),'service worker cache matches the app version');
assert(html.includes(`app-extras.js?v=${v}`),'page asks for this version of the script');
assert.equal(JSON.parse(fs.readFileSync(__dirname+'/version.json','utf8')).v,v,'version.json matches');
console.log('PASS: 13 structural checks, version '+v);
