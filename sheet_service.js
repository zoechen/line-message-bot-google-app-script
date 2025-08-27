function getSS_(){ return SpreadsheetApp.openById(CONFIG.SHEET_ID); }

function ensureSheet_(name, header){
  var ss = getSS_();
  var s = ss.getSheetByName(name) || ss.insertSheet(name);
  if(s.getLastRow()===0 && header) s.appendRow(header);
  return s;
}

// events 去重
function markEvent_(eventId){
  var s = ensureSheet_(CONFIG.SHEETS.EVENTS, ['timestamp','eventId']);
  s.appendRow([new Date(), eventId]);
}
function seenEvent_(eventId){
  var s = ensureSheet_(CONFIG.SHEETS.EVENTS, ['timestamp','eventId']);
  var last = s.getLastRow();
  if(last<2) return false;
  var values = s.getRange(2,2,last-1,1).getValues(); // col2 = eventId
  return values.some(function(r){ return (r[0]||'')===eventId; });
}

// queue
function enqueue_(rawJson){
  var s = ensureSheet_(CONFIG.SHEETS.QUEUE, ['timestamp','raw','status']);
  s.appendRow([new Date(), rawJson, 'NEW']);
}

// bookings
function appendBooking_(row){
  var s = ensureSheet_(CONFIG.SHEETS.BOOKINGS, ['timestamp','userId','userName','keyword','date','session','people','coach','raw']);
  s.appendRow(row);
}

// rental
function appendRental_(row){
  var s = ensureSheet_(CONFIG.SHEETS.RENTAL, ['timestamp','userId','renter','height','weight','shoes','items','raw']);
  s.appendRow(row);
}
