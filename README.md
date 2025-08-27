
config.gs：環境、開關、常數

utils.gs：小工具（log、日期、人數驗證…）

line_service.gs：與 LINE API 溝通（reply/push），統一錯誤處理

sheet_service.gs：封裝試算表存取（init、append、查重）

queue_worker.gs：排程處理佇列（processQueue_）

router.gs：路由與意圖判斷（關鍵字→處理器）

handlers/*.gs：各功能處理器（預約泳池、裝備租借…）

webhook.gs：doPost（只做極速回200 + 入佇列）