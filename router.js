/** Router: 依文字/關鍵字派給對應的 handler */
function routeAndHandleByText_(ev, opt){
  var text = (ev.message.text||'').trim();
  var userId = ev.source && ev.source.userId;
  var replyToken = ev.replyToken;
  var fresh = isFreshReplyToken_(ev.timestamp);

  // 1) 意圖：預約泳池（模板 / 內容）
  if(/^預約泳池\s*$/i.test(text)){
    if(opt && opt.asyncMode){ // queue 模式：只能 push
      pushTemplate_Booking_(userId);
    }else if(CONFIG.REPLY_FAST_TEMPLATE && fresh){
      replyTemplate_Booking_(replyToken);
    }else{
      pushTemplate_Booking_(userId);
    }
    return;
  }
  if(/^預約泳池/.test(text)){
    if(opt && opt.asyncMode){
      handleBooking_(ev, {mode:'push'});
    }else{
      // webhook 先輕量 reply，再入列
      if(CONFIG.REPLY_FAST_TEMPLATE && fresh) try{ replyMessage_(replyToken,'收到～我們正在為您確認預約 🙌'); }catch(e){}
      enqueue_(JSON.stringify({events:[ev]}));
    }
    return;
  }

  // 2) 意圖：裝備租借（模板 / 內容）
  if(/^裝備租借\s*$/i.test(text)){
    if(opt && opt.asyncMode){ pushTemplate_Rental_(userId); }
    else if(CONFIG.REPLY_FAST_TEMPLATE && fresh){ replyTemplate_Rental_(replyToken); }
    else { pushTemplate_Rental_(userId); }
    return;
  }
  if(/^裝備租借/.test(text)){
    if(opt && opt.asyncMode){
      handleRental_(ev, {mode:'push'});
    }else{
      if(CONFIG.REPLY_FAST_TEMPLATE && fresh) try{ replyMessage_(replyToken,'收到～我們正在處理您的租借單 🙌'); }catch(e){}
      enqueue_(JSON.stringify({events:[ev]}));
    }
    return;
  }

  // 3) 其他：小幫手提示
  if(opt && opt.asyncMode){ pushMessage_(userId,'可輸入：「預約泳池」或「裝備租借」開始。'); }
  else if(fresh){ try{ replyMessage_(replyToken,'可輸入：「預約泳池」或「裝備租借」開始。'); }catch(e){ if(userId) pushMessage_(userId,'可輸入：「預約泳池」或「裝備租借」開始。'); } }
  else if(userId){ pushMessage_(userId,'可輸入：「預約泳池」或「裝備租借」開始。'); }
}
