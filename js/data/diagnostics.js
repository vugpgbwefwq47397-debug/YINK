(function (root) {
  'use strict';
  const ns = root.YINK = root.YINK || {};
  const CASES = [
    { symbol: '600519', marketCode: '1', secid: '1.600519' },
    { symbol: '00700', marketCode: '116', secid: '116.00700' },
    { symbol: 'AAPL', marketCode: '105', secid: '105.AAPL' }
  ];
  const RANGE = { start: '2025-09-01', end: '2025-09-30' };

  async function verifyMarkets(source, onResult) {
    const report = [];
    for (const item of CASES) {
      let result;
      try {
        const matches = await source.search(item.symbol);
        const security = matches.find(function (match) {
          return match.symbol.toUpperCase() === item.symbol && match.marketCode === item.marketCode;
        });
        if (!security) throw new Error('搜索结果中未找到预期市场的股票。');
        if (security.secid !== item.secid) throw new Error('证券代码映射不一致：' + security.secid);
        const bars = await source.getDailyBars(security, RANGE);
        if (!bars.length) throw new Error('未取得历史日 K。');
        result = { symbol: item.symbol, ok: true, security: security, count: bars.length, first: bars[0], last: bars[bars.length - 1] };
      } catch (error) {
        result = { symbol: item.symbol, ok: false, error: error.message || String(error) };
      }
      report.push(result);
      if (onResult) onResult(result, report.length, CASES.length);
    }
    return report;
  }

  ns.verifyMarkets = verifyMarkets;
})(window);
