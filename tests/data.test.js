const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const context = { window: {}, URLSearchParams, document: { head: { appendChild() {} }, createElement() { return { remove() {} }; } }, setTimeout, clearTimeout };
vm.createContext(context);
for (const file of ['js/data/jsonp.js', 'js/data/eastmoney.js', 'js/data/csv.js', 'js/data/diagnostics.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const Y = context.window.YINK;
const search = Y.normalizeSearchResponse({ QuotationCodeTable: { Data: [
  { Code: '600519', Name: '贵州茅台', MktNum: '1', QuoteID: '1.600519' },
  { Code: '00700', Name: '腾讯控股', MktNum: '116', QuoteID: '116.00700' },
  { Code: 'AAPL', Name: '苹果', MktNum: '105', QuoteID: '105.AAPL' },
  { Code: 'SPX', Name: '指数', MktNum: '100', QuoteID: '100.SPX' }
] } });
assert.equal(search.length, 3);
assert.deepEqual(Array.from(search, x => x.secid), ['1.600519', '116.00700', '105.AAPL']);
assert.equal(Y.normalizeSearchResponse({ QuotationCodeTable: { Data: null } }).length, 0);
const range = { start: '2026-09-01', end: '2026-09-30' };
const bars = Y.normalizeKlineResponse({ data: { klines: ['2026-09-02,213,218,220,211,1200000', '2026-09-01,210,213,215,208,1000000'] } }, range);
assert.deepEqual(Array.from(bars, x => x.date), ['2026-09-01', '2026-09-02']);
assert.equal(bars[0].close, 213);
assert.equal(bars[0].high, 215);
assert.throws(() => Y.normalizeKlineResponse({ data: null }, range));
const csv = new Y.CSVDataSource('\uFEFFdate,open,high,low,close,volume\r\n2026-09-02,213,220,211,218,1200000\r\n2026-09-01,210,215,208,213,1000000');
assert.deepEqual(Array.from(csv.bars, x => x.date), ['2026-09-01', '2026-09-02']);
assert.throws(() => Y.parseCsv('date,open,high,low,close,volume\n2026-09-01,0,215,208,213,100'));
assert.throws(() => Y.parseCsv('date,open,high,low,close,volume\n2026-09-01,210,215,208,213,100\n2026-09-01,210,215,208,213,100'));
assert.equal(Y.isValidDate('2026-09-01 10:30'), true);
assert.equal(Y.isValidDate('2026-09-01 25:30'), false);
assert.throws(() => Y.validateRange({ start: '2026-09-01 10:30', end: '2026-09-02' }), /日期/);
assert.throws(() => Y.validateRange({ start: '2026-09-01', end: '2026-09-01', startTime: '10:00', endTime: '09:59' }), /开始时间/);
assert.throws(() => Y.validateRange({ start: '2026-09-01', end: '2026-09-02', startTime: '25:00', endTime: '09:59' }), /时刻/);
const hourlyCsv = new Y.CSVDataSource('date,open,high,low,close,volume\n2026-09-01 09:30,100,105,99,104,10\n2026-09-01 10:30,104,108,102,107,20\n2026-09-02 09:30,107,110,106,109,15');
assert.equal(hourlyCsv.sourceInterval, 'hour');
const minuteCsv = new Y.CSVDataSource('date,open,high,low,close,volume\n2026-09-01 09:30,100,105,99,104,10\n2026-09-01 09:35,104,108,102,107,20\n2026-09-01 10:00,107,110,106,109,15');
assert.equal(minuteCsv.sourceInterval, 'minute5');
const weeklyCsv = new Y.CSVDataSource('date,open,high,low,close,volume\n2026-09-01,100,105,99,104,10\n2026-09-04,104,110,101,108,20\n2026-09-07,108,112,107,111,15');
(async () => {
  const hours = await hourlyCsv.getBars(null, { start: '2026-09-01', end: '2026-09-01' }, { interval: 'hour', adjustment: 'none' });
  assert.equal(hours.bars.length, 2);
  const hourWindow = await hourlyCsv.getBars(null, { start: '2026-09-01', end: '2026-09-01', startTime: '09:40', endTime: '10:40' }, { interval: 'hour', adjustment: 'none' });
  assert.deepEqual(Array.from(hourWindow.bars, bar => bar.date), ['2026-09-01 10:30']);
  const minutes = await minuteCsv.getBars(null, range, { interval: 'minute5', adjustment: 'none' });
  assert.equal(minutes.bars.length, 3);
  const minuteWindow = await minuteCsv.getBars(null, { start: '2026-09-01', end: '2026-09-01', startTime: '09:32', endTime: '09:38' }, { interval: 'minute5', adjustment: 'none' });
  assert.deepEqual(Array.from(minuteWindow.bars, bar => bar.date), ['2026-09-01 09:35']);
  const minuteHours = await minuteCsv.getBars(null, range, { interval: 'hour', adjustment: 'none' });
  assert.deepEqual(Array.from(minuteHours.bars, bar => [bar.date, bar.open, bar.high, bar.low, bar.close, bar.volume]), [['2026-09-01 09:35', 100, 108, 99, 107, 30], ['2026-09-01 10:00', 107, 110, 106, 109, 15]]);
  const days = await hourlyCsv.getBars(null, range, { interval: 'day', adjustment: 'none' });
  assert.deepEqual(Array.from(days.bars, bar => [bar.date, bar.open, bar.high, bar.low, bar.close, bar.volume]), [['2026-09-01', 100, 108, 99, 107, 30], ['2026-09-02', 107, 110, 106, 109, 15]]);
  const weeks = await weeklyCsv.getBars(null, range, { interval: 'week', adjustment: 'none' });
  assert.deepEqual(Array.from(weeks.bars, bar => [bar.date, bar.open, bar.high, bar.low, bar.close, bar.volume]), [['2026-09-04', 100, 110, 99, 108, 30], ['2026-09-07', 108, 112, 107, 111, 15]]);
  await assert.rejects(weeklyCsv.getBars(null, range, { interval: 'hour', adjustment: 'none' }), /没有小时 K/);
  await assert.rejects(hourlyCsv.getBars(null, range, { interval: 'minute5', adjustment: 'none' }), /没有可识别的 5 分钟 K/);
  await assert.rejects(hourlyCsv.getBars(null, range, { interval: 'day', adjustment: 'forward' }), /不能.*复权/);
  context.document.head.appendChild = script => {
    const url = new URL(script.src);
    assert.equal(url.searchParams.get('input'), '600519');
    const callback = url.searchParams.get('cb');
    assert.equal(typeof context.window[callback], 'function');
    context.window[callback]({ ok: true });
  };
  assert.equal((await Y.requestJsonp('https://example.test/search', { input: '600519' })).ok, true);
  context.document.head.appendChild = script => script.onload();
  await assert.rejects(Y.requestJsonp('https://example.test/search', { input: '600519' }), /JSONP/);
  for (const security of search) {
    const source = new Y.EastmoneyDataSource();
    Y.requestJsonp = async (_url, params) => {
      assert.equal(params.secid, security.secid);
      assert.equal(params.klt, 101);
      assert.equal(params.fqt, 0);
      return { data: { klines: ['2026-09-01,210,213,215,208,1000000'] } };
    };
    const result = await source.getDailyBars(security, range);
    assert.equal(result.length, 1);
    assert.equal(result[0].close, 213);
  }
  Y.requestJsonp = async (_url, params) => {
    assert.equal(params.klt, 60);
    assert.equal(params.fqt, 1);
    return { data: { klines: ['2026-09-01 10:30,100,104,105,99,10'] } };
  };
  const hourResult = await new Y.EastmoneyDataSource().getBars(search[0], range, { interval: 'hour', adjustment: 'forward' });
  assert.equal(hourResult.bars[0].date, '2026-09-01 10:30');
  Y.requestJsonp = async (_url, params) => {
    assert.equal(params.klt, 5);
    assert.equal(params.fqt, 0);
    return { data: { klines: ['2026-09-01 09:30,100,104,105,99,10', '2026-09-01 09:35,104,107,108,102,20'] } };
  };
  const minuteResult = await new Y.EastmoneyDataSource().getBars(search[0], range, { interval: 'minute5', adjustment: 'none' });
  assert.deepEqual(Array.from(minuteResult.bars, bar => bar.date), ['2026-09-01 09:30', '2026-09-01 09:35']);
  const exactMinuteResult = await new Y.EastmoneyDataSource().getBars(search[0], { start: '2026-09-01', end: '2026-09-01', startTime: '09:32', endTime: '09:38' }, { interval: 'minute5', adjustment: 'none' });
  assert.deepEqual(Array.from(exactMinuteResult.bars, bar => bar.date), ['2026-09-01 09:35']);
  Y.requestJsonp = async (_url, params) => {
    assert.equal(params.klt, 102);
    assert.equal(params.fqt, 2);
    return { data: { klines: ['2026-09-04,100,108,110,99,30'] } };
  };
  const weekResult = await new Y.EastmoneyDataSource().getBars(search[0], range, { interval: 'week', adjustment: 'backward' });
  assert.equal(weekResult.bars[0].date, '2026-09-04');
  const directNames = { '1.600519': '贵州茅台', '116.00700': '腾讯控股', '105.AAPL': '苹果' };
  const directCalls = [];
  Y.requestJsonp = async (url, params) => {
    directCalls.push({ url, params });
    if (url.includes('/suggest/')) return { QuotationCodeTable: { Data: [] } };
    return { data: directNames[params.secid] ? { name: directNames[params.secid], klines: ['2025-09-01,1,1,1,1,100'] } : null };
  };
  const directSource = new Y.EastmoneyDataSource();
  for (const [query, secid] of [['600519', '1.600519'], ['00700', '116.00700'], ['AAPL', '105.AAPL']]) {
    const matches = await directSource.search(query);
    assert.equal(matches[0].secid, secid);
    assert.equal(matches[0].name, directNames[secid]);
  }
  assert.ok(directCalls.some(call => call.url.includes('searchapi.eastmoney.com')));
  assert.ok(directCalls.some(call => call.params.secid === '105.AAPL' && call.params.lmt === 1));
  Y.requestJsonp = async (url) => url.includes('searchapi.eastmoney.com')
    ? { QuotationCodeTable: { Data: [] } }
    : { QuotationCodeTable: { Data: [{ Code: '600519', Name: '贵州茅台', MktNum: '1', QuoteID: '1.600519' }] } };
  assert.equal((await directSource.search('贵州茅台'))[0].secid, '1.600519');
  let releasePrimary;
  const pendingPrimary = new Promise(resolve => { releasePrimary = resolve; });
  const pendingCalls = [];
  Y.requestJsonp = (url, params) => {
    pendingCalls.push(url);
    if (url.includes('searchapi.eastmoney.com')) return pendingPrimary;
    if (params.secid === '1.600519') return Promise.resolve({ data: { name: '贵州茅台', klines: ['2025-09-01,1,1,1,1,100'] } });
    return Promise.resolve({ data: null });
  };
  const pendingSearch = directSource.search('600519');
  assert.ok(pendingCalls.some(url => url.includes('push2his.eastmoney.com')));
  releasePrimary({ QuotationCodeTable: { Data: [] } });
  assert.equal((await pendingSearch)[0].secid, '1.600519');
  Y.requestJsonp = async (url) => url.includes('/suggest/')
    ? { QuotationCodeTable: { Data: [] } }
    : { data: null };
  assert.equal((await directSource.search('ZZZZNOTREAL')).length, 0);
  Y.requestJsonp = async () => { throw new Error('offline'); };
  await assert.rejects(directSource.search('贵州茅台'), /搜索接口暂不可用/);
  const filtered = await csv.getDailyBars(null, { start: '2026-09-02', end: '2026-09-02' });
  assert.equal(filtered.length, 1);
  const checks = await Y.verifyMarkets({
    search: async symbol => search.filter(item => item.symbol === symbol),
    getDailyBars: async () => [{ date: '2025-09-01', open: 2, high: 3, low: 1, close: 2, volume: 100 }]
  });
  assert.deepEqual(Array.from(checks, item => item.ok), [true, true, true]);
  const partial = await Y.verifyMarkets({
    search: async symbol => symbol === '00700' ? [] : search.filter(item => item.symbol === symbol),
    getDailyBars: async () => [{ date: '2025-09-01', open: 2, high: 3, low: 1, close: 2, volume: 100 }]
  });
  assert.deepEqual(Array.from(partial, item => item.ok), [true, false, true]);
  assert.match(partial[1].error, /搜索结果/);
  console.log('Data tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
