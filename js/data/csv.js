(function (root) {
  'use strict';
  const ns = root.YINK = root.YINK || {};
  const REQUIRED = ['date', 'open', 'high', 'low', 'close', 'volume'];

  function splitCsv(text) {
    const records = [];
    let record = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
        else if (!quoted && cell !== '') throw new Error('CSV 引号格式不正确。');
        else quoted = !quoted;
      } else if (c === ',' && !quoted) { record.push(cell); cell = ''; }
      else if ((c === '\n' || c === '\r') && !quoted) {
        if (c === '\r' && text[i + 1] === '\n') i++;
        record.push(cell); cell = '';
        if (record.some(function (v) { return v.trim() !== ''; })) records.push(record);
        record = [];
      } else { cell += c; }
    }
    if (quoted) throw new Error('CSV 存在未闭合的引号。');
    record.push(cell);
    if (record.some(function (v) { return v.trim() !== ''; })) records.push(record);
    return records;
  }

  function parseCsv(text) {
    const records = splitCsv(String(text || '').replace(/^\uFEFF/, ''));
    if (records.length < 2) throw new Error('CSV 必须包含表头和至少一条数据。');
    const header = records.shift().map(function (v) { return v.trim().toLowerCase(); });
    const indexes = REQUIRED.map(function (key) { return header.indexOf(key); });
    if (indexes.some(function (i) { return i < 0; })) throw new Error('CSV 表头需包含：' + REQUIRED.join(', '));
    const bars = records.map(function (record, rowIndex) {
      if (record.length !== header.length) throw new Error('CSV 第 ' + (rowIndex + 2) + ' 行列数不正确。');
      const values = indexes.map(function (i) { return record[i].trim(); });
      const date = values[0];
      if (!ns.isValidDate(date)) throw new Error('CSV 第 ' + (rowIndex + 2) + ' 行日期无效。');
      const nums = values.slice(1).map(function (value) { return value === '' ? NaN : Number(value); });
      if (nums.some(function (value) { return !Number.isFinite(value) || value < 0; })) throw new Error('CSV 第 ' + (rowIndex + 2) + ' 行包含无效数值。');
      const [open, high, low, close, volume] = nums;
      if (open <= 0 || close <= 0 || low <= 0 || high < Math.max(open, close, low) || low > Math.min(open, close)) {
        throw new Error('CSV 第 ' + (rowIndex + 2) + ' 行 OHLC 价格不合理。');
      }
      return { date: date, open: open, high: high, low: low, close: close, volume: volume };
    });
    bars.sort(function (a, b) { return a.date.localeCompare(b.date); });
    if (bars.some(function (bar) { return bar.date.length !== bars[0].date.length; })) throw new Error('CSV 请统一使用日期或日期时间，不能混用。');
    for (let i = 1; i < bars.length; i++) {
      if (bars[i].date === bars[i - 1].date) throw new Error('CSV 包含重复日期：' + bars[i].date);
    }
    return bars;
  }

  function aggregate(bars, interval) {
    const groups = new Map();
    bars.forEach(function (bar) {
      const day = bar.date.slice(0, 10);
      let key = interval === 'hour' ? bar.date.slice(0, 13) : day;
      if (interval === 'week') {
        const monday = new Date(day + 'T00:00:00Z');
        monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
        key = monday.toISOString().slice(0, 10);
      }
      if (!groups.has(key)) groups.set(key, { date: interval === 'hour' ? bar.date : day, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: 0 });
      const item = groups.get(key);
      item.date = interval === 'hour' ? bar.date : day; item.high = Math.max(item.high, bar.high); item.low = Math.min(item.low, bar.low);
      item.close = bar.close; item.volume += bar.volume;
    });
    const result = Array.from(groups.values());
    if (result.some(function (bar) { return !Number.isFinite(bar.volume); })) throw new Error('CSV 聚合后的成交量过大。');
    return result;
  }

  class CSVDataSource {
    constructor(text) {
      this.bars = parseCsv(text);
      const intraday = this.bars[0].date.length === 16;
      const fiveMinuteBars = intraday && this.bars.every(function (bar) { return Number(bar.date.slice(14, 16)) % 5 === 0; }) && this.bars.some(function (bar, index, bars) {
        if (!index || bar.date.slice(0, 10) !== bars[index - 1].date.slice(0, 10)) return false;
        return (Date.parse(bar.date.replace(' ', 'T') + ':00Z') - Date.parse(bars[index - 1].date.replace(' ', 'T') + ':00Z')) === 5 * 60000;
      });
      this.sourceInterval = !intraday ? 'day' : fiveMinuteBars ? 'minute5' : 'hour';
    }
    selectBars(_security, range, options) {
      ns.validateRange(range);
      const interval = options && options.interval || 'day';
      if (!['minute5', 'hour', 'day', 'week'].includes(interval)) throw new Error('不支持的 K 线时间级别。');
      if (options && options.adjustment && options.adjustment !== 'none') throw new Error('CSV 价格由文件提供，不能在浏览器中计算前复权或后复权。');
      if (interval === 'minute5' && this.sourceInterval !== 'minute5') throw new Error('该 CSV 没有可识别的 5 分钟 K 数据；请导入连续的 5 分钟记录。');
      if (interval === 'hour' && this.sourceInterval === 'day') throw new Error('该 CSV 没有小时 K 数据；请选择日 K 或周 K。');
      const start = range.start + ' ' + (range.startTime || '00:00');
      const end = range.end + ' ' + (range.endTime || '23:59');
      const filtered = this.bars.filter(function (bar) {
        return bar.date.length === 16 && ['minute5', 'hour'].includes(interval)
          ? bar.date >= start && bar.date <= end
          : bar.date.slice(0, 10) >= range.start && bar.date.slice(0, 10) <= range.end;
      });
      const bars = interval === 'minute5' || (interval === 'hour' && this.sourceInterval === 'hour') || (interval === 'day' && this.sourceInterval === 'day') ? filtered : aggregate(filtered, interval);
      if (!bars.length) throw new Error('CSV 在选定日期范围内没有数据。');
      return { bars: bars, interval: interval, adjustment: 'none' };
    }
    async getBars(security, range, options) { return this.selectBars(security, range, options); }
    async getDailyBars(security, range) {
      return (await this.getBars(security, range, { interval: 'day', adjustment: 'none' })).bars;
    }
  }

  ns.CSVDataSource = CSVDataSource;
  ns.parseCsv = parseCsv;
})(window);
