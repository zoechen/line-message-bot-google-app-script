/***********************
 * 01 CONFIG
 ***********************/
var CONFIG = {
  SHEET_ID: '<<YOUR_SHEET_ID>>',                 // ★換成你的試算表ID
  CHANNEL_ACCESS_TOKEN: '<<YOUR_LONG_LIVED_TOKEN>>', // ★換成你的長效Token

  SHEETS: {
    ERROR: 'error',
    EVENTS: 'events',
    QUEUE: 'queue',
    BOOKINGS: 'bookings',
    RENTAL: 'rental'
  },

  // 行為
  USE_QUEUE: true,                  // Webhook只入列，排程再處理
  REPLY_FAST_TEMPLATE: true,        // Webhook 內先輕量回覆（避免靜默）
  REPLY_FRESH_MS: 50 * 1000,        // replyToken 新鮮度門檻（50秒）

  // 預約泳池 規則
  ALLOWED_SESSIONS: ['早', '午', '全'],
  BOOKING_WINDOW_DAYS: 60,
  PEOPLE_TOTAL_MAX: 6,              // N+N 總和上限，兩邊皆≥1

  // 裝備租借 規則
  RENTAL_WINDOW_DAYS: 60            // 租借日期視窗：今天起 N 天內
};


/***********************
 * 02 UTILS
 ***********************/
function ok_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj || { ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function logError_(title, payload) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var s = ss.getSheetByName(CONFIG.SHEETS.ERROR) || ss.insertSheet(CONFIG.SHEETS.ERROR);
    s.appendRow([new Date(), title, (typeof payload === 'string') ? payload : JSON.stringify(payload)]);
  } catch (_) { }
}

// 全形數字/冒號/斜線 → 半形；去除多餘空白
function normalizeText_(s) {
  if (!s) return s;
  s = s.replace(/[\uFF10-\uFF19]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFF10 + 0x30));
  s = s.replace(/\uFF0F/g, '/').replace(/\uFF1A/g, '：');
  s = s.replace(/[ \t]+/g, '');
  return s;
}

// N+N 驗證（兩邊皆正整數；總和 ≤ 上限）
function validatePeopleNN_(s, maxTotal) {
  s = String(s).trim();
  var m = s.match(/^(\d+)\+(\d+)$/);
  if (!m) return { ok: false, error: '人數格式需為 N+N（例如 1+1、2+1）' };
  var a = parseInt(m[1], 10), b = parseInt(m[2], 10);
  if (a <= 0 || b <= 0) return { ok: false, error: '人數兩邊都需為正整數' };
  var total = a + b;
  if (typeof maxTotal === 'number' && total > maxTotal) {
    return { ok: false, error: '人數總和不可超過 ' + maxTotal + ' 人' };
  }
  return { ok: true };
}

// 日期 YYYY/MM/DD（今天起、未來 N 天內）
function validateDateWindow_(dateStr, windowDays) {
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) return { ok: false, error: '日期格式需為 YYYY/MM/DD' };
  var p = dateStr.split('/').map(Number);
  var dt = new Date(p[0], p[1] - 1, p[2]);
  if (isNaN(dt) || dt.getMonth() !== p[1] - 1 || dt.getDate() !== p[2]) return { ok: false, error: '日期無效' };
  var tz = 8 * 3600 * 1000, now = new Date(), todayLocal = new Date(now.getTime() + tz);
  var today0 = new Date(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate());
  var dt0 = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  if (dt0 < today0) return { ok: false, error: '日期不可早於今天' };
  if (typeof windowDays === 'number') {
    var last = new Date(today0); last.setDate(last.getDate() + windowDays);
    if (dt0 > last) return { ok: false, error: '日期超出可預約視窗（未來 ' + windowDays + ' 天內）' };
  }
  return { ok: true };
}


/***********************
 * 03 LINE SERVICE
 ***********************/
function replyMessage_(replyToken, messages) {
  if (!replyToken) throw new Error('replyToken required');
  var msgs = Array.isArray(messages) ? messages : [{ type: 'text', text: String(messages) }];
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    headers: { Authorization: 'Bearer ' + CONFIG.CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify({ replyToken: replyToken, messages: msgs }),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode(), body = res.getContentText();
  if (code === 400 && /Invalid reply token/i.test(body)) throw new Error('INVALID_REPLY_TOKEN');
  if (code >= 300) { logError_('LINE reply', code + ' ' + body); throw new Error('LINE_REPLY_' + code); }
}

function pushMessage_(userId, messages) {
  if (!userId) return;
  var msgs = Array.isArray(messages) ? messages : [{ type: 'text', text: String(messages) }];
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    headers: { Authorization: 'Bearer ' + CONFIG.CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify({ to: userId, messages: msgs }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) logError_('LINE push', res.getResponseCode() + ' ' + res.getContentText());
}

function isFreshReplyToken_(eventTs) {
  if (!eventTs) return false;
  var age = Date.now() - Number(eventTs);
  return age >= 0 && age < CONFIG.REPLY_FRESH_MS;
}


/***********************
 * 04 SHEET SERVICE
 ***********************/
function getSS_() { return SpreadsheetApp.openById(CONFIG.SHEET_ID); }

function ensureSheet_(name, header) {
  var ss = getSS_();
  var s = ss.getSheetByName(name) || ss.insertSheet(name);
  if (s.getLastRow() === 0 && header) s.appendRow(header);
  return s;
}

// events 去重
function markEvent_(eventId) {
  var s = ensureSheet_(CONFIG.SHEETS.EVENTS, ['timestamp', 'eventId']);
  s.appendRow([new Date(), eventId]);
}
function seenEvent_(eventId) {
  var s = ensureSheet_(CONFIG.SHEETS.EVENTS, ['timestamp', 'eventId']);
  var last = s.getLastRow();
  if (last < 2) return false;
  var values = s.getRange(2, 2, last - 1, 1).getValues();
  return values.some(function (r) { return (r[0] || '') === eventId; });
}

// queue
function enqueue_(rawJson) {
  var s = ensureSheet_(CONFIG.SHEETS.QUEUE, ['timestamp', 'raw', 'status']);
  s.appendRow([new Date(), rawJson, 'NEW']);
}

// bookings
function appendBooking_(row) {
  var s = ensureSheet_(CONFIG.SHEETS.BOOKINGS,
    ['timestamp', 'userId', 'userName', 'keyword', 'date', 'session', 'people', 'coach', 'raw']);
  s.appendRow(row);
}

// rental
function appendRental_(row) {
  var s = ensureSheet_(CONFIG.SHEETS.RENTAL,
    ['timestamp', 'userId', 'renter', 'rental_date', 'height', 'weight', 'shoes', 'items', 'raw']);
  s.appendRow(row);
}


/***********************
 * 05 QUEUE WORKER
 ***********************/
function processQueue_() {
  var s = ensureSheet_(CONFIG.SHEETS.QUEUE, ['timestamp', 'raw', 'status']);
  var rng = s.getDataRange();
  var rows = rng.getNumRows() ? rng.getValues() : [];
  if (rows.length <= 1) return; // 只有表頭

  for (var i = 1; i < rows.length; i++) {
    try {
      if (rows[i][2] !== 'NEW') continue;
      var body = JSON.parse(rows[i][1] || '{}');
      var events = body.events || [];
      if (!events.length) { rows[i][2] = 'SKIP'; continue; }

      events.forEach(function (ev) {
        if (ev.type !== 'message' || ev.message.type !== 'text') return;
        routeAndHandleByText_(ev, { asyncMode: true }); // 非同步：以 push 回覆
      });

      rows[i][2] = 'DONE';
    } catch (err) {
      rows[i][2] = 'ERR';
      logError_('processQueue_', String(err));
    }
  }

  if (rows.length > 0 && rows[0]) s.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
}


/***********************
 * 06 ROUTER
 ***********************/
function routeAndHandleByText_(ev, opt) {
  var text = (ev.message.text || '').trim();
  var userId = ev.source && ev.source.userId;
  var replyToken = ev.replyToken;
  var fresh = isFreshReplyToken_(ev.timestamp);

  // --- 預約泳池：模板 ---
  if (/^預約泳池\s*$/i.test(text)) {
    if (opt && opt.asyncMode) { pushTemplate_Booking_(userId); }
    else if (CONFIG.REPLY_FAST_TEMPLATE && fresh) { replyTemplate_Booking_(replyToken); }
    else { pushTemplate_Booking_(userId); }
    return;
  }

  // --- 預約泳池：內容 ---
  if (/^預約泳池/.test(text)) {
    if (opt && opt.asyncMode) {
      handleBooking_(ev, { mode: 'push' });
    } else {
      if (CONFIG.REPLY_FAST_TEMPLATE && fresh) try { replyMessage_(replyToken, '收到～我們正在為您確認預約 🙌'); } catch (_) { }
      enqueue_(JSON.stringify({ events: [ev] }));
    }
    return;
  }

  // --- 裝備租借：模板 ---
  if (/^裝備租借\s*$/i.test(text)) {
    if (opt && opt.asyncMode) { pushTemplate_Rental_(userId); }
    else if (CONFIG.REPLY_FAST_TEMPLATE && fresh) { replyTemplate_Rental_(replyToken); }
    else { pushTemplate_Rental_(userId); }
    return;
  }

  // --- 裝備租借：內容 ---
  if (/^裝備租借/.test(text)) {
    if (opt && opt.asyncMode) {
      handleRental_(ev, { mode: 'push' });
    } else {
      if (CONFIG.REPLY_FAST_TEMPLATE && fresh) try { replyMessage_(replyToken, '收到～我們正在處理您的租借單 🙌'); } catch (_) { }
      enqueue_(JSON.stringify({ events: [ev] }));
    }
    return;
  }

  // 其他：提示
  var tip = '可輸入：「預約泳池」或「裝備租借」開始。';
  if (opt && opt.asyncMode) { pushMessage_(userId, tip); }
  else if (fresh) { try { replyMessage_(replyToken, tip); } catch (_) { if (userId) pushMessage_(userId, tip); } }
  else if (userId) { pushMessage_(userId, tip); }
}


/***********************
 * 07 HANDLERS - BOOKING
 ***********************/
function replyTemplate_Booking_(replyToken) {
  replyMessage_(replyToken, [
    { type: 'text', text: '請依下列格式回覆（可直接複製後修改）：' },
    { type: 'text', text: '預約泳池\n日期：2025/08/24\n場次：（早｜午｜全）\n人數：1+1\n教練：' }
  ]);
}
function pushTemplate_Booking_(userId) {
  pushMessage_(userId, [
    { type: 'text', text: '請依下列格式回覆（可直接複製後修改）：' },
    { type: 'text', text: '預約泳池\n日期：2025/08/24\n場次：（早｜午｜全）\n人數：1+1\n教練：' }
  ]);
}

function handleBooking_(ev, opt) {
  var userId = ev.source && ev.source.userId;
  var text = normalizeText_(ev.message.text || '');

  var date = (text.match(/日期：(\d{4}\/\d{2}\/\d{2})/) || [])[1];
  var session = (text.match(/場次：([早午全])/) || [])[1];
  var people = (text.match(/人數：(\d+\+\d+)/) || [])[1]; // ★ 只允許 N+N
  var coach = ((text.match(/教練：(.*)$/m) || [])[1] || '').trim();

  var errs = [];
  var dv = validateDateWindow_(date, CONFIG.BOOKING_WINDOW_DAYS); if (!dv.ok) errs.push(dv.error);
  if (CONFIG.ALLOWED_SESSIONS.indexOf(session) < 0) errs.push('場次僅限：' + CONFIG.ALLOWED_SESSIONS.join('、'));
  var pv = validatePeopleNN_(people, CONFIG.PEOPLE_TOTAL_MAX); if (!pv.ok) errs.push(pv.error);

  if (errs.length) {
    var msg = ['格式有誤：'].concat(errs.map(function (e) { return '- ' + e; })).join('\n');
    var help = '預約泳池\n日期：2025/08/24\n場次：（早｜午｜全）\n人數：1+1\n教練：';
    if (opt && opt.mode === 'push') {
      pushMessage_(userId, [{ type: 'text', text: '請依下列範例修正：' }, { type: 'text', text: help }, { type: 'text', text: msg }]);
    }
    return;
  }

  appendBooking_([new Date(), userId || '', '', '預約泳池', date, session, people, coach, ev.message.text || '']);

  var confirm = '已收到預約 ✅\n'
    + '日期：' + date + '\n'
    + '場次：' + session + '\n'
    + '人數：' + people + '\n'
    + '教練：' + (coach || '（未填）');
  if (opt && opt.mode === 'push') pushMessage_(userId, confirm);
}


/***********************
 * 08 HANDLERS - RENTAL (含租借日期)
 ***********************/
function replyTemplate_Rental_(replyToken) {
  replyMessage_(replyToken, [
    { type: 'text', text: '請依下列格式回覆（可直接複製後修改）：' },
    {
      type: 'text', text:
        '裝備租借\n' +
        '租借日期：2025/09/01\n' +   // ★ 新增日期欄位
        '租借人：\n' +
        '身高：(ex:160cm)\n' +
        '體重：(ex:60kg)\n' +
        '鞋號：(ex:24cm)\n' +
        '租借項目：（重裝、輕裝、BCD、調節器、面鏡、防寒衣、套鞋、蛙鞋、呼吸管、電腦表、配重、手電筒）'
    }
  ]);
}
function pushTemplate_Rental_(userId) {
  pushMessage_(userId, [
    { type: 'text', text: '請依下列格式回覆（可直接複製後修改）：' },
    {
      type: 'text', text:
        '裝備租借\n' +
        '租借日期：2025/09/01\n' +   // ★ 新增日期欄位
        '租借人：\n' +
        '身高：(ex:160cm)\n' +
        '體重：(ex:60kg)\n' +
        '鞋號：(ex:24cm)\n' +
        '租借項目：（重裝、輕裝、BCD、調節器、面鏡、防寒衣、套鞋、蛙鞋、呼吸管、電腦表、配重、手電筒）'
    }
  ]);
}

function handleRental_(ev, opt) {
  var userId = ev.source && ev.source.userId;
  var text = normalizeText_(ev.message.text || '');

  var rdate = ((text.match(/租借日期：(\d{4}\/\d{2}\/\d{2})/) || [])[1] || '').trim(); // ★ 新增
  var renter = ((text.match(/租借人：(.+)/) || [])[1] || '').trim();
  var height = ((text.match(/身高：(\d+cm)/) || [])[1] || '').trim();
  var weight = ((text.match(/體重：(\d+kg)/) || [])[1] || '').trim();
  var shoes = ((text.match(/鞋號：(\d+cm)/) || [])[1] || '').trim();
  var items = ((text.match(/租借項目：(.+)/) || [])[1] || '').trim();

  var errs = [];
  var dv = validateDateWindow_(rdate, CONFIG.RENTAL_WINDOW_DAYS); if (!dv.ok) errs.push('租借日期：' + dv.error);
  if (!renter) errs.push('缺少租借人');
  if (!/^\d+cm$/.test(height)) errs.push('身高需為「數字+cm」，如 160cm');
  if (!/^\d+kg$/.test(weight)) errs.push('體重需為「數字+kg」，如 60kg');
  if (!/^\d+cm$/.test(shoes)) errs.push('鞋號需為「數字+cm」，如 24cm');
  if (!items) errs.push('請填寫租借項目');

  if (errs.length) {
    var msg = ['格式有誤：'].concat(errs.map(function (e) { return '- ' + e; })).join('\n');
    var help = '裝備租借\n租借日期：2025/09/01\n租借人：王小明\n身高：160cm\n體重：60kg\n鞋號：24cm\n租借項目：重裝、面鏡、蛙鞋';
    if (opt && opt.mode === 'push') {
      pushMessage_(userId, [
        { type: 'text', text: '請依下列範例修正：' },
        { type: 'text', text: help },
        { type: 'text', text: msg }
      ]);
    }
    return;
  }

  appendRental_([
    new Date(),
    userId || '',
    renter,
    rdate,           // ★ 新增寫入
    height,
    weight,
    shoes,
    items,
    ev.message.text || ''
  ]);

  var confirm = '已收到租借單 ✅\n'
    + '租借日期：' + rdate + '\n'
    + '租借人：' + renter + '\n'
    + '身高：' + height + '  體重：' + weight + '\n'
    + '鞋號：' + shoes + '\n'
    + '項目：' + items;
  if (opt && opt.mode === 'push') pushMessage_(userId, confirm);
}


/***********************
 * 99 WEBHOOK
 ***********************/
function doPost(e) {
  try {
    if (CONFIG.USE_QUEUE) {
      // 1) 極速入列，避免 timeout
      var raw = (e && e.postData && e.postData.contents) || '{}';
      enqueue_(raw);

      // 2) 可選：在 webhook 內先回輕量訊息（reply），提升體驗
      if (CONFIG.REPLY_FAST_TEMPLATE) {
        var body = JSON.parse(raw);
        (body.events || []).forEach(function (ev) {
          if (ev.type === 'message' && ev.message.type === 'text' && isFreshReplyToken_(ev.timestamp)) {
            try { routeAndHandleByText_(ev, { asyncMode: false }); } catch (_) { }
          }
        });
      }
      return ok_({ queued: true });
    } else {
      // 不用佇列：直接處理（小量訊息可）
      var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
      var events = body.events || [];
      events.forEach(function (ev) {
        var id = ev.webhookEventId || ev.eventId || (ev.message && ev.message.id);
        if (id && seenEvent_(id)) return;  // 去重
        if (id) markEvent_(id);
        routeAndHandleByText_(ev, { asyncMode: false }); // reply 為主
      });
      return ok_({ ok: true });
    }
  } catch (err) {
    logError_('doPost', String(err));
    return ok_({ ok: false, error: String(err) });
  }
}
