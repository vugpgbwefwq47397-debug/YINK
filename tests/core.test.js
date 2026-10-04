const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const context = { window: {}, setTimeout: callback => callback() };
context.window.YINK = { isValidDate: value => /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(value) };
vm.createContext(context);
for (const file of ['js/trade.js', 'js/poster.js', 'js/export.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const Y = context.window.YINK;
const buyBar = { date: '2026-09-01', open: 98, high: 102, low: 97, close: 100, volume: 1000 };
const sellBar = { date: '2026-09-24', open: 109, high: 113, low: 108, close: 110, volume: 1200 };
let events = Y.setTradeEvent([], 'BUY', buyBar);
events = Y.setTradeEvent(events, 'SELL', sellBar);
events = Y.changeTradePrice(events, 'SELL', 112);
const trade = Y.calculateTrade(events, 10000);
assert.equal(trade.holdingDays, 23);
assert.ok(Math.abs(trade.returnPct - 12) < 1e-9);
assert.ok(Math.abs(trade.profit - 1200) < 1e-9);
assert.ok(Math.abs(trade.finalAmount - 11200) < 1e-9);
const loss = Y.calculateTrade(Y.changeTradePrice(events, 'SELL', 90), 10000);
assert.ok(Math.abs(loss.returnPct + 10) < 1e-9);
assert.ok(Math.abs(loss.profit + 1000) < 1e-9);
assert.ok(Math.abs(loss.finalAmount - 9000) < 1e-9);
assert.equal(Y.calculateTrade(events, '').profit, null);
assert.throws(() => Y.calculateTrade(Y.setTradeEvent(events, 'SELL', buyBar), null), /晚于/);
assert.throws(() => Y.changeTradePrice(events, 'BUY', 0), /大于零/);
assert.throws(() => Y.calculateTrade(Y.changeTradePrice(events, 'BUY', 1e-320), null), /过大/);

const tradeBars = [
  { date: '2026-09-01', close: 100 }, { date: '2026-09-02', close: 120 },
  { date: '2026-09-03', close: 130 }, { date: '2026-09-04', close: 110 }
];
let multiple = Y.addTradeEvent([], 'BUY', tradeBars[0]);
multiple = Y.addTradeEvent(multiple, 'BUY', tradeBars[1]);
multiple = Y.addTradeEvent(multiple, 'SELL', tradeBars[2]);
multiple = Y.addTradeEvent(multiple, 'SELL', tradeBars[3]);
for (const [index, quantity] of [10, 5, 8, 4].entries()) multiple = Y.updateTradeEvent(multiple, index, { quantity });
const multipleResult = Y.calculateTrade(multiple, '', 115);
assert.equal(multipleResult.mode, 'quantity');
assert.ok(Math.abs(multipleResult.realizedProfit - 200) < 1e-8);
assert.ok(Math.abs(multipleResult.unrealizedProfit - 25) < 1e-8);
assert.ok(Math.abs(multipleResult.profit - 225) < 1e-8);
assert.equal(multipleResult.remainingQuantity, 3);
assert.ok(Math.abs(multipleResult.returnPct - 14.0625) < 1e-8);
assert.equal(Y.calculateTrade(multiple, 10000, 115).finalAmount, 10225);
assert.throws(() => Y.calculateTrade(multiple, 1000, 115), /投入金额不足/);
assert.throws(() => Y.calculateTrade(Y.updateTradeEvent(multiple, 2, { quantity: 16 }), '', 115), /卖出数量/);
assert.throws(() => Y.calculateTrade(multiple.map((event, index) => index === 1 ? { ...event, quantity: null } : event), '', 115), /每个 BUY/);
assert.throws(() => Y.updateTradeEvent(multiple, 0, { quantity: 0 }), /数量必须大于零/);
const hourlyTrade = Y.calculateTrade([
  { type: 'BUY', date: '2026-09-01 09:30', price: 100 },
  { type: 'SELL', date: '2026-09-01 10:30', price: 110 }
], '', 110);
assert.equal(hourlyTrade.holdingHours, 1);
assert.equal(hourlyTrade.holdingDays, 0);
const minuteTrade = Y.calculateTrade([
  { type: 'BUY', date: '2026-09-01 09:30', price: 100 },
  { type: 'SELL', date: '2026-09-01 09:35', price: 110 }
], '');
assert.equal(minuteTrade.holdingMinutes, 5);
assert.equal(Y.formatHoldingDuration(minuteTrade, 'zh'), '5 分钟');
assert.equal(Y.formatHoldingDuration(minuteTrade, 'en'), '5 MINUTES HELD');
const sameBarTrade = Y.calculateTrade([
  { type: 'BUY', date: '2026-09-01 09:30', price: 100, quantity: 2 },
  { type: 'SELL', date: '2026-09-01 09:30', price: 110, quantity: 2 }
], '', 110, '2026-09-01 09:30');
assert.equal(sameBarTrade.profit, 20);
assert.equal(sameBarTrade.holdingHours, 0);
assert.equal(sameBarTrade.endDate, '2026-09-01 09:30');
assert.throws(() => Y.calculateTrade([
  { type: 'SELL', date: '2026-09-01 09:30', price: 110, quantity: 2 },
  { type: 'BUY', date: '2026-09-01 09:30', price: 100, quantity: 2 }
], '', 110), /第一笔交易必须是 BUY/);

function fakeCanvas() {
  const labels = [];
  const arcs = [];
  const ctx = {
    setTransform() {}, fillRect() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc(x, y) { arcs.push({ x, y }); }, fill() {},
    fillText(value) { labels.push(String(value)); },
    measureText(value) { return { width: String(value).length * 12 }; }
  };
  return { width: 0, height: 0, labels, arcs, getContext: () => ctx, toBlob: callback => callback({ type: 'image/png' }) };
}

const bars = [buyBar, { date: '2026-09-10', open: 102, high: 106, low: 101, close: 105, volume: 900 }, sellBar];
const base = { security: { symbol: 'TEST', name: '测试股票', market: '美股', marketCode: '105' }, bars, trade, currency: 'USD' };
for (const template of ['gallery', 'obsidian']) {
  const canvas = fakeCanvas();
  Y.renderPoster(canvas, { ...base, options: { template, quote: 'MY TRADE' } }, 1920, 2400);
  assert.equal(canvas.width, 1920);
  assert.equal(canvas.height, 2400);
  assert.ok(canvas.labels.some(value => value.includes('+12.00%')));
  assert.ok(canvas.labels.some(value => value.includes('BUY')));
  assert.ok(canvas.labels.some(value => value.includes('SELL')));
}
const quietCanvas = fakeCanvas();
Y.renderPoster(quietCanvas, { ...base, options: { template: 'gallery', showPrices: false, showDates: false, showDays: false } }, 1920, 2400);
assert.ok(!quietCanvas.labels.some(value => value.includes('100.00  →') || value.includes('2026-09-01') || value.includes('DAYS HELD')));
const sameBarPosterBars = [
  { date: '2026-09-01 09:30', open: 98, high: 103, low: 97, close: 100 },
  { date: '2026-09-01 10:30', open: 100, high: 112, low: 99, close: 110 }
];
for (const template of ['gallery', 'obsidian']) {
  const canvas = fakeCanvas();
  Y.renderPoster(canvas, { security: base.security, bars: sameBarPosterBars, trade: sameBarTrade, currency: 'USD', options: { template } }, 1920, 2400);
  assert.ok(!canvas.labels.includes('CAPITAL'));
  assert.ok(canvas.labels.includes('+USD 20.00'));
  assert.equal(canvas.arcs.length, 2);
  assert.notEqual(canvas.arcs[0].y, canvas.arcs[1].y);
}

(async () => {
  let downloaded = '';
  context.document = {
    createElement(tag) {
      if (tag === 'canvas') return fakeCanvas();
      return { set href(value) { this._href = value; }, get href() { return this._href; }, click() { downloaded = this.download; }, remove() {} };
    },
    body: { appendChild() {} }
  };
  context.URL = { createObjectURL: () => 'blob:yink-test', revokeObjectURL() {} };
  const output = await Y.exportPoster({ ...base, options: { template: 'gallery' } }, 'print');
  assert.equal(output.width, 2480);
  assert.equal(output.height, 3508);
  assert.equal(downloaded, 'YINK-TEST-print.png');
  console.log('Core tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
