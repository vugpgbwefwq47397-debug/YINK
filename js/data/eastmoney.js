(function (root) {
  'use strict';
  const ns = root.YINK = root.YINK || {};
  const SEARCH_URL = 'https://searchapi.eastmoney.com/api/suggest/get';
  const SEARCH_BACKUP_URL = 'https://searchadapter.eastmoney.com/api/suggest/get';
  const KLINE_URL = 'https://push2his.eastmoney.com/api/qt/stock/kline/get';
  const SEARCH_TOKEN = 'D43BF722C8E33BDC906FB84D85E326E8'; // Public site parameter, not a user credential.
  const MARKET_NAMES = { '0': 'A 股 · 深圳', '1': 'A 股 · 上海', '105': '美股 · NASDAQ', '106': '美股 · NYSE', '107': '美股 · AMEX', '116': '港股' };

  function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(value || '')) return false;
    const iso = value.length === 10 ? value + 'T00:00:00Z' : value.replace(' ', 'T') + ':00Z';
    const d = new Date(iso);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, value.length === 10 ? 10 : 16).replace('T', ' ') === value;
  }

  function validateRange(range) {
    if (!range || !/^\d{4}-\d{2}-\d{2}$/.test(range.start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(range.end || '') || !isValidDate(range.start) || !isValidDate(range.end) || range.start > range.end) {
      throw new Error('请选择有效的开始和结束日期。');
    }
    const hasTime = range.startTime != null || range.endTime != null;
    if (hasTime && (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(range.startTime || '') || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(range.endTime || '') || (range.start === range.end && range.startTime > range.endTime))) {
      throw new Error('请选择有效的开始和结束时刻，且开始时间不能晚于结束时间。');
    }
  }

  function normalizeSecurity(item) {
    const code = String(item.Code || '').trim();
    const quoteId = String(item.QuoteID || '').trim();
    const marketCode = String(item.MktNum == null ? quoteId.split('.')[0] : item.MktNum);
    if (!MARKET_NAMES[marketCode] || !/^[\w.\-]+$/.test(code)) return null;
    const secid = new RegExp('^' + marketCode + '\\.[A-Za-z0-9.\-]+$').test(quoteId) ? quoteId : marketCode + '.' + code;
    return { symbol: code, name: String(item.Name || code).trim(), market: MARKET_NAMES[marketCode], marketCode: marketCode, secid: secid, source: 'eastmoney' };
  }

  function normalizeSearchResponse(payload) {
    const table = payload && payload.QuotationCodeTable;
    if (!table || (table.Data != null && !Array.isArray(table.Data))) throw new Error('证券搜索返回了无法识别的数据。');
    const seen = new Set();
    return (table.Data || []).map(normalizeSecurity).filter(function (security) {
      if (!security || seen.has(security.secid)) return false;
      seen.add(security.secid);
      return true;
    });
  }

  function parseKlineRow(line, interval) {
    const fields = String(line).split(',');
    if (fields.length < 6 || !isValidDate(fields[0]) || (['minute5', 'hour'].includes(interval) && fields[0].length !== 16) || (['day', 'week'].includes(interval) && fields[0].length !== 10)) throw new Error('K 线数据中存在无效日期或字段。');
    const values = fields.slice(1, 6).map(Number);
    if (values.some(function (n) { return !Number.isFinite(n) || n < 0; })) throw new Error('日 K 数据中存在无效价格或成交量。');
    const [open, close, high, low, volume] = values;
    if (open <= 0 || close <= 0 || low <= 0 || high < Math.max(open, close, low) || low > Math.min(open, close)) {
      throw new Error('日 K 数据中存在不合理的 OHLC 价格。');
    }
    return { date: fields[0], open: open, high: high, low: low, close: close, volume: volume };
  }

  function normalizeKlineResponse(payload, range, interval) {
    validateRange(range);
    const data = payload && payload.data;
    if (!data || !Array.isArray(data.klines)) throw new Error('行情接口未返回日 K 数据。请稍后重试或导入 CSV。');
    const intraday = ['minute5', 'hour'].includes(interval);
    const start = range.start + ' ' + (range.startTime || '00:00');
    const end = range.end + ' ' + (range.endTime || '23:59');
    const bars = data.klines.map(function (line) { return parseKlineRow(line, interval); }).filter(function (bar) {
      return intraday ? bar.date >= start && bar.date <= end : bar.date >= range.start && bar.date <= range.end;
    });
    bars.sort(function (a, b) { return a.date.localeCompare(b.date); });
    for (let i = 1; i < bars.length; i++) {
      if (bars[i].date === bars[i - 1].date) throw new Error('日 K 数据包含重复日期。');
    }
    if (!bars.length) throw new Error('这个日期范围内没有日 K 数据。请调整日期。');
    return bars;
  }

  function exactCandidates(input) {
    if (/^\d{6}$/.test(input)) return ['1', '0'].map(function (marketCode) { return { code: input, marketCode: marketCode }; });
    if (/^\d{1,5}$/.test(input)) return [{ code: input.padStart(5, '0'), marketCode: '116' }];
    if (/^[A-Za-z][A-Za-z0-9.\-]{0,9}$/.test(input)) return ['105', '106', '107'].map(function (marketCode) { return { code: input.toUpperCase(), marketCode: marketCode }; });
    return [];
  }

  async function probeExact(input) {
    const candidates = exactCandidates(input);
    const results = await Promise.allSettled(candidates.map(async function (candidate) {
      const secid = candidate.marketCode + '.' + candidate.code;
      const payload = await ns.requestJsonp(KLINE_URL, {
        secid: secid, fields1: 'f1,f2,f3,f4,f5,f6', fields2: 'f51,f52,f53,f54,f55,f56',
        klt: 101, fqt: 0, beg: '0', end: '20500101', lmt: 1,
        ut: '7eea3edcaed734bea9cbfc24409ed989'
      }, 8000);
      const data = payload && payload.data;
      if (!data || !Array.isArray(data.klines) || !data.klines.length) return null;
      return { symbol: candidate.code, name: String(data.name || candidate.code), market: MARKET_NAMES[candidate.marketCode], marketCode: candidate.marketCode, secid: secid, source: 'eastmoney' };
    }));
    return results.filter(function (result) { return result.status === 'fulfilled' && result.value; }).map(function (result) { return result.value; });
  }

  class EastmoneyDataSource {
    async search(query) {
      const input = String(query || '').trim();
      if (!input) return [];
      // Exact codes can be checked while the suggestion service is pending.
      const directPromise = exactCandidates(input).length ? probeExact(input) : Promise.resolve([]);
      let lastError = null;
      try {
        const payload = await ns.requestJsonp(SEARCH_URL, { input: input, type: 14, token: SEARCH_TOKEN, count: 12 }, 9000);
        const matches = normalizeSearchResponse(payload);
        if (matches.length) return matches;
      } catch (error) { lastError = error; }
      const direct = await directPromise;
      if (direct.length) return direct;
      try {
        const payload = await ns.requestJsonp(SEARCH_BACKUP_URL, { input: input, type: 14, token: SEARCH_TOKEN, count: 12 }, 7000);
        const matches = normalizeSearchResponse(payload);
        if (matches.length) return matches;
      } catch (error) { lastError = error; }
      if (lastError) throw new Error('证券搜索接口暂不可用。请稍后重试，或导入 CSV。');
      return [];
    }

    async getBars(security, range, options) {
      validateRange(range);
      if (!security || !/^(0|1|105|106|107|116)\.[A-Za-z0-9.\-]+$/.test(security.secid)) throw new Error('请先选择有效的股票。');
      const interval = options && options.interval || 'day';
      const adjustment = options && options.adjustment || 'none';
      if (!['minute5', 'hour', 'day', 'week'].includes(interval) || !['none', 'forward', 'backward'].includes(adjustment)) throw new Error('K 线高级设置无效。');
      const payload = await ns.requestJsonp(KLINE_URL, {
        secid: security.secid,
        fields1: 'f1,f2,f3,f4,f5,f6',
        fields2: 'f51,f52,f53,f54,f55,f56',
        klt: { minute5: 5, hour: 60, day: 101, week: 102 }[interval],
        fqt: { none: 0, forward: 1, backward: 2 }[adjustment],
        beg: range.start.replace(/-/g, ''),
        end: range.end.replace(/-/g, ''),
        ut: '7eea3edcaed734bea9cbfc24409ed989'
      }, 15000);
      return { bars: normalizeKlineResponse(payload, range, interval), interval: interval, adjustment: adjustment };
    }

    async getDailyBars(security, range) {
      return (await this.getBars(security, range, { interval: 'day', adjustment: 'none' })).bars;
    }
  }

  ns.EastmoneyDataSource = EastmoneyDataSource;
  ns.normalizeSearchResponse = normalizeSearchResponse;
  ns.normalizeKlineResponse = normalizeKlineResponse;
  ns.validateRange = validateRange;
  ns.isValidDate = isValidDate;
})(window);
