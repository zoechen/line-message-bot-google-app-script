function processQueue_(){
  var ss = getSS_();
  var s = ensureSheet_(CONFIG.SHEETS.QUEUE, ['timestamp','raw','status']);
  var rng = s.getDataRange();
  var rows = rng.getNumRows()? rng.getValues(): [];
  if(rows.length<=1) return; // 只有表頭

  for(var i=1;i<rows.length;i++){
    try{
      if(rows[i][2]!=='NEW') continue;
      var body = JSON.parse(rows[i][1]||'{}');
      var events = body.events || [];
      if(!events.length){ rows[i][2]='SKIP'; continue; }

      events.forEach(function(ev){
        if(ev.type!=='message' || ev.message.type!=='text') return;
        routeAndHandleByText_(ev, {asyncMode:true}); // 以 push 回覆
      });

      rows[i][2]='DONE';
    }catch(err){
      rows[i][2]='ERR';
      logError_('processQueue_', String(err));
    }
  }
  if(rows.length>0 && rows[0]) s.getRange(1,1,rows.length,rows[0].length).setValues(rows);
}
