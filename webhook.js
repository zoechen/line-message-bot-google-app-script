function doPost(e){
  try{
    if(CONFIG.USE_QUEUE){
      // 極速入列、回 200，避免 timeout
      var raw = (e && e.postData && e.postData.contents) || '{}';
      enqueue_(raw);

      // 若要在 webhook 內回一段輕量訊息，需解析一次 event（僅 reply）
      if(CONFIG.REPLY_FAST_TEMPLATE){
        var body = JSON.parse(raw);
        (body.events||[]).forEach(function(ev){
          if(ev.type==='message' && ev.message.type==='text' && isFreshReplyToken_(ev.timestamp)){
            try{ routeAndHandleByText_(ev, {asyncMode:false}); }catch(_){}
          }
        });
      }
      return ok_({queued:true});
    }else{
      // 不用 queue，直接處理（小量專案可）
      var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
      var events = body.events || [];
      events.forEach(function(ev){
        var id = ev.webhookEventId || ev.eventId || (ev.message && ev.message.id);
        if(id && seenEvent_(id)) return;
        if(id) markEvent_(id);
        routeAndHandleByText_(ev, {asyncMode:false}); // reply 為主
      });
      return ok_({ok:true});
    }
  }catch(err){
    logError_('doPost', String(err));
    return ok_({ok:false, error:String(err)});
  }
}
