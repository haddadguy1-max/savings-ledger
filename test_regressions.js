const assert=require('node:assert/strict');const fs=require('node:fs');
const a=fs.readFileSync(__dirname+'/app-extras.js','utf8');const b=fs.readFileSync(__dirname+'/Code.gs','utf8');
assert(a.includes("'lg-goldhist-v1','lg-delivery-v1'"));
assert(!a.includes('if(!Object.keys(R).length && !Object.keys(jget(SHU)).length)shStamp();'));
assert(a.includes('const R=reply.settings;'));
assert(b.includes('function doGet(e)'));assert(b.includes('settings:readSettings_()'));
assert(a.includes('m:{...(h.m||{}),...m}'));
assert(a.includes("{l:'Balance at month end',v:net==null?'Unavailable':money0(net)"));
console.log('PASS: 6 structural regressions');
