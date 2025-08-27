function ok_(obj){ return ContentService.createTextOutput(JSON.stringify(obj||{ok:true})).setMimeType(ContentService.MimeType.JSON); }

function logError_(title, payload){
  try{
    var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var s = ss.getSheetByName(CONFIG.SHEETS.ERROR) || ss.insertSheet(CONFIG.SHEETS.ERROR);
    s.appendRow([new Date(), title, typeof payload==='string'?payload:JSON.stringify(payload)]);
  }catch(_){}
}

function normalizeText_(s){
  if(!s) return s;
  s = s.replace(/[\uFF10-\uFF19]/g, d=>String.fromCharCode(d.charCodeAt(0)-0xFF10+0x30));
  s = s.replace(/\uFF0F/g,'/').replace(/\uFF1A/g,'：');
  s = s.replace(/[ \t]+/g,'');
  return s;
}

// N+N 驗證（兩邊皆正整數；若需允許 0，改成 >=0）
function validatePeopleNN_(s, maxTotal){
  s = String(s).trim();
  var m = s.match(/^(\d+)\+(\d+)$/);
  if(!m) return {ok:false, error:'人數格式需為 N+N（例如 1+1、2+1）'};
  var a = parseInt(m[1],10), b = parseInt(m[2],10);
  if(a<=0 || b<=0) return {ok:false, error:'人數兩邊都需為正整數'};
  var total = a+b;
  if(typeof maxTotal==='number' && total>maxTotal) return {ok:false, error:'人數總和不可超過 '+maxTotal+' 人'};
  return {ok:true};
}

// 日期 YYYY/MM/DD（今天起、未來 N 天內）
function validateDateWindow_(dateStr, windowDays){
  if(!/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) return {ok:false, error:'日期格式需為 YYYY/MM/DD'};
  var parts = dateStr.split('/').map(Number);
  var dt = new Date(parts[0], parts[1]-1, parts[2]);
  if(isNaN(dt) || dt.getMonth()!==parts[1]-1 || dt.getDate()!==parts[2]) return {ok:false, error:'日期無效'};
  var tz = 8*3600*1000, now = new Date(), todayLocal = new Date(now.getTime()+tz);
  var today0 = new Date(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate());
  var dt0 = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  if(dt0<today0) return {ok:false, error:'日期不可早於今天'};
  if(typeof windowDays==='number'){
    var last = new Date(today0); last.setDate(last.getDate()+windowDays);
    if(dt0>last) return {ok:false, error:'日期超出可預約視窗（未來 '+windowDays+' 天內）'};
  }
  return {ok:true};
}
