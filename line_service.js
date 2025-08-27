function replyMessage_(replyToken, messages){
  if(!replyToken) throw new Error('replyToken required');
  var msgs = Array.isArray(messages)? messages : [{type:'text', text:String(messages)}];
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method:'post',
    contentType:'application/json; charset=UTF-8',
    headers:{Authorization:'Bearer '+CONFIG.CHANNEL_ACCESS_TOKEN},
    payload: JSON.stringify({replyToken: replyToken, messages: msgs}),
    muteHttpExceptions:true
  });
  var code = res.getResponseCode(), body = res.getContentText();
  if(code===400 && /Invalid reply token/i.test(body)) throw new Error('INVALID_REPLY_TOKEN');
  if(code>=300) { logError_('LINE reply', code+' '+body); throw new Error('LINE_REPLY_'+code); }
}

function pushMessage_(userId, messages){
  if(!userId) return;
  var msgs = Array.isArray(messages)? messages : [{type:'text', text:String(messages)}];
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method:'post',
    contentType:'application/json; charset=UTF-8',
    headers:{Authorization:'Bearer '+CONFIG.CHANNEL_ACCESS_TOKEN},
    payload: JSON.stringify({to: userId, messages: msgs}),
    muteHttpExceptions:true
  });
  if(res.getResponseCode()>=300) logError_('LINE push', res.getResponseCode()+' '+res.getContentText());
}

function isFreshReplyToken_(eventTs){
  if(!eventTs) return false;
  var age = Date.now() - Number(eventTs);
  return age>=0 && age<CONFIG.REPLY_FRESH_MS;
}
