var CONFIG = {
  SHEET_ID: '<<YOUR_SHEET_ID>>',
  CHANNEL_ACCESS_TOKEN: '<<YOUR_LONG_LIVED_TOKEN>>',

  // 基礎表
  SHEETS: {
    ERROR: 'error',
    EVENTS: 'events',
    QUEUE: 'queue',
    BOOKINGS: 'bookings',
    RENTAL: 'rental'
  },

  // 行為開關
  USE_QUEUE: true,             // webhook 只入列，排程再處理
  REPLY_FAST_TEMPLATE: true,   // webhook 內先回輕量訊息
  REPLY_FRESH_MS: 50*1000,     // replyToken 新鮮期限（50s）

  // 共用規則
  ALLOWED_SESSIONS: ['早','午','全'],
  BOOKING_WINDOW_DAYS: 60,
  PEOPLE_TOTAL_MAX: 6          // N+N 總和上限
};
