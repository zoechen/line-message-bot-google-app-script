function replyTemplate_Booking_(replyToken){
  replyMessage_(replyToken, [
    {type:'text', text:'請依下列格式回覆（可直接複製後修改）：'},
    {type:'text', text:'預約泳池\n日期：2025/08/24\n場次：（早｜午｜全）\n人數：1+1\n教練：'}
  ]);
}
function pushTemplate_Booking_(userId){
  pushMessage_(userId, [
    {type:'text', text:'請依下列格式回覆（可直接複製後修改）：'},
    {type:'text', text:'預約泳池\n日期：2025/08/24\n場次：（早｜午｜全）\n人數：1+1\n教練：'}
  ]);
}

function handleBooking_(ev, opt){
  var userId = ev.source && ev.source.userId;
  var text = normalizeText_(ev.message.text||'');
  // 解析
  var date = (text.match(/日期：(\d{4}\/\d{2}\/\d{2})/)||[])[1];
  var session = (text.match(/場次：([早午全])/)||[])[1];
  var people = (text.match(/人數：(\d+\+\d+)/)||[])[1];
  var coach = ((text.match(/教練：(.*)$/m)||[])[1]||'').trim();

  // 驗證
  var errs = [];
  var dv = validateDateWindow_(date, CONFIG.BOOKING_WINDOW_DAYS); if(!dv.ok) errs.push(dv.error);
  if(CONFIG.ALLOWED_SESSIONS.indexOf(session)<0) errs.push('場次僅限：'+CONFIG.ALLOWED_SESSIONS.join('、'));
  var pv = validatePeopleNN_(people, CONFIG.PEOPLE_TOTAL_MAX); if(!pv.ok) errs.push(pv.error);

  if(errs.length){
    var msg = ['格式有誤：'].concat(errs.map(function(e){return '- '+e;})).join('\n');
    return (opt && opt.mode==='push') ? pushMessage_(userId, [
      {type:'text', text:'請依下列範例修正：'},
      {type:'text', text:'預約泳池\n日期：2025/08/24\n場次：（早｜午｜全）\n人數：1+1\n教練：'},
      {type:'text', text:msg}
    ]) : null;
  }

  // 入表
  appendBooking_([new Date(), userId||'', '', '預約泳池', date, session, people, coach, ev.message.text||'']);

  // 回覆
  var confirm = '已收到預約 ✅\n'
              + '日期：'+date+'\n'
              + '場次：'+session+'\n'
              + '人數：'+people+'\n'
              + '教練：'+(coach||'（未填）');
  (opt && opt.mode==='push') ? pushMessage_(userId, confirm) : null;
}
