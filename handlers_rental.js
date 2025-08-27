function replyTemplate_Rental_(replyToken){
  replyMessage_(replyToken, [
    {type:'text', text:'請依下列格式回覆（可直接複製後修改）：'},
    {type:'text', text:'裝備租借\n租借人：\n身高：(ex:160cm)\n體重：(ex:60kg)\n鞋號：(ex:24cm)\n租借項目：（重裝、輕裝、BCD、調節器、面鏡、防寒衣、套鞋、蛙鞋、呼吸管、電腦表、配重、手電筒）'}
  ]);
}
function pushTemplate_Rental_(userId){
  pushMessage_(userId, [
    {type:'text', text:'請依下列格式回覆（可直接複製後修改）：'},
    {type:'text', text:'裝備租借\n租借人：\n身高：(ex:160cm)\n體重：(ex:60kg)\n鞋號：(ex:24cm)\n租借項目：（重裝、輕裝、BCD、調節器、面鏡、防寒衣、套鞋、蛙鞋、呼吸管、電腦表、配重、手電筒）'}
  ]);
}

function handleRental_(ev, opt){
  var userId = ev.source && ev.source.userId;
  var text = normalizeText_(ev.message.text||'');

  var renter = ((text.match(/租借人：(.+)/)||[])[1]||'').trim();
  var height = ((text.match(/身高：(\d+cm)/)||[])[1]||'').trim();
  var weight = ((text.match(/體重：(\d+kg)/)||[])[1]||'').trim();
  var shoes  = ((text.match(/鞋號：(\d+cm)/)||[])[1]||'').trim();
  var items  = ((text.match(/租借項目：(.+)/)||[])[1]||'').trim();

  var errs = [];
  if(!renter) errs.push('缺少租借人');
  if(!/^\d+cm$/.test(height)) errs.push('身高需為「數字+cm」，如 160cm');
  if(!/^\d+kg$/.test(weight)) errs.push('體重需為「數字+kg」，如 60kg');
  if(!/^\d+cm$/.test(shoes))  errs.push('鞋號需為「數字+cm」，如 24cm');
  if(!items) errs.push('請填寫租借項目');

  if(errs.length){
    var msg = ['格式有誤：'].concat(errs.map(function(e){return '- '+e;})).join('\n');
    return (opt && opt.mode==='push') ? pushMessage_(userId, [
      {type:'text', text:'請依下列範例修正：'},
      {type:'text', text:'裝備租借\n租借人：王小明\n身高：160cm\n體重：60kg\n鞋號：24cm\n租借項目：重裝、面鏡、蛙鞋'},
      {type:'text', text:msg}
    ]) : null;
  }

  appendRental_([new Date(), userId||'', renter, height, weight, shoes, items, ev.message.text||'']);

  var confirm = '已收到租借單 ✅\n'
              + '租借人：'+renter+'\n'
              + '身高：'+height+' 體重：'+weight+'\n'
              + '鞋號：'+shoes+'\n'
              + '項目：'+items;
  (opt && opt.mode==='push') ? pushMessage_(userId, confirm) : null;
}
