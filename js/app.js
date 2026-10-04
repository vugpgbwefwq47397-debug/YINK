(function (root) {
  'use strict';
  const ns = root.YINK;
  const $ = function (id) { return document.getElementById(id); };
  const onlineSource = new ns.EastmoneyDataSource();
  const state = { mode: 'online', security: null, csvSource: null, searchId: 0, loadId: 0, csvReadId: 0, busy: false, sampleMeta: false };
  const SAMPLE_CSV = [
    'date,open,high,low,close,volume',
    '2026-09-01,210,215,208,213,1000000',
    '2026-09-02,213,220,211,218,1200000',
    '2026-09-03,218,222,214,216,980000'
  ].join('\n');
  const RECENT_KEY = 'yink.recent.v1';
  const query = $('stock-query');
  const results = $('search-results');
  let searchTimer;

  function clearData() {
    ns.currentData = null;
    if (ns.onDataCleared) ns.onDataCleared();
  }

  function setStatus(message, kind) {
    $('status').textContent = message;
    $('status').className = 'status' + (kind ? ' ' + kind : '');
  }

  function readRecent() {
    try {
      const value = JSON.parse(root.localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(value) ? value.filter(function (item) { return item && /^(0|1|105|106|107|116)\.[A-Za-z0-9.\-]+$/.test(item.secid); }).slice(0, 5) : [];
    } catch (_) { return []; }
  }

  let recent = readRecent();
  function renderRecent() {
    const host = $('recent-searches');
    host.replaceChildren();
    if (query.value.trim() || !recent.length || state.mode !== 'online') return;
    const label = document.createElement('p');
    label.textContent = '最近使用';
    host.appendChild(label);
    recent.forEach(function (security) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = security.symbol + ' · ' + security.name;
      button.addEventListener('click', function () { chooseSecurity(security); });
      host.appendChild(button);
    });
  }

  function chooseSecurity(security) {
    state.security = security;
    state.loadId++;
    state.busy = false;
    $('load-button').disabled = false;
    clearData();
    query.value = security.symbol;
    results.replaceChildren();
    $('data-section').hidden = true;
    recent = [security].concat(recent.filter(function (item) { return item.secid !== security.secid; })).slice(0, 5);
    try { root.localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch (_) { /* storage unavailable */ }
    renderRecent();
    setStatus('已选择 ' + security.name + '（' + security.symbol + '，' + security.market + '）。请选择日期并加载 K 线。', 'success');
  }

  function setMode(mode) {
    state.mode = mode;
    state.searchId++;
    state.loadId++;
    state.csvReadId++;
    clearData();
    state.busy = false;
    $('load-button').disabled = false;
    $('tab-online').classList.toggle('active', mode === 'online');
    $('tab-csv').classList.toggle('active', mode === 'csv');
    $('tab-online').setAttribute('aria-selected', String(mode === 'online'));
    $('tab-csv').setAttribute('aria-selected', String(mode === 'csv'));
    $('online-panel').hidden = mode !== 'online';
    $('csv-panel').hidden = mode !== 'csv';
    $('kline-adjustment').disabled = mode === 'csv';
    if (mode === 'csv') $('kline-adjustment').value = 'none';
    updateTimeControls();
    $('data-section').hidden = true;
    renderRecent();
    setStatus(mode === 'online' ? '输入股票名称或代码，选择搜索结果。' : '选择 CSV 文件，数据会在本地解析。');
  }

  function showResults(items) {
    results.replaceChildren();
    if (!items.length) {
      const p = document.createElement('p');
      p.className = 'empty-search';
      p.textContent = '没有找到支持的 A 股、港股或美股。请尝试代码或 CSV 导入。';
      results.appendChild(p);
      return;
    }
    const list = document.createElement('div');
    list.className = 'result-list';
    items.forEach(function (security) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'result-item';
      const title = document.createElement('strong');
      const meta = document.createElement('span');
      title.textContent = security.symbol + '  ·  ' + security.name;
      meta.textContent = security.market;
      button.append(title, meta);
      button.addEventListener('click', function () { chooseSecurity(security); });
      list.appendChild(button);
    });
    results.appendChild(list);
  }

  async function search() {
    clearTimeout(searchTimer);
    const input = query.value.trim();
    const searchId = ++state.searchId;
    state.security = null;
    state.loadId++;
    state.busy = false;
    $('load-button').disabled = false;
    clearData();
    $('data-section').hidden = true;
    if (!input) { results.replaceChildren(); setStatus('请输入股票名称或代码。'); return; }
    setStatus('正在搜索证券…', 'loading');
    try {
      const items = await onlineSource.search(input);
      if (searchId !== state.searchId || state.mode !== 'online') return;
      showResults(items);
      setStatus(items.length ? '请选择一条搜索结果。' : '未找到证券；也可以导入 CSV。', items.length ? '' : 'error');
    } catch (error) {
      if (searchId !== state.searchId || state.mode !== 'online') return;
      results.replaceChildren();
      setStatus(error.message, 'error');
    }
  }

  async function readCsv() {
    const file = $('csv-file').files[0];
    const csvReadId = ++state.csvReadId;
    state.loadId++;
    state.busy = false;
    $('load-button').disabled = false;
    clearData();
    state.csvSource = null;
    $('data-section').hidden = true;
    if (!file) { setStatus('请选择 CSV 文件。'); return; }
    if (file.size > 8 * 1024 * 1024) { setStatus('CSV 文件请小于 8 MB。', 'error'); return; }
    if (state.sampleMeta) {
      if ($('csv-symbol').value === 'YINK-DEMO') $('csv-symbol').value = '';
      if ($('csv-name').value === '示例交易') $('csv-name').value = '';
      state.sampleMeta = false;
    }
    try {
      const source = new ns.CSVDataSource(await file.text());
      if (csvReadId !== state.csvReadId || state.mode !== 'csv') return;
      state.csvSource = source;
      $('start-date').value = source.bars[0].date.slice(0, 10);
      $('end-date').value = source.bars[source.bars.length - 1].date.slice(0, 10);
      $('start-time').value = '00:00';
      $('end-time').value = '23:59';
      updateTimeControls();
      setStatus('CSV 已读取：' + source.bars.length + ' 条' + ({ minute5: '5 分钟', hour: '小时', day: '日' }[source.sourceInterval]) + ' K。可调整日期后加载。', 'success');
    } catch (error) { if (csvReadId === state.csvReadId && state.mode === 'csv') setStatus(error.message, 'error'); }
  }

  async function loadSample() {
    if (state.mode !== 'csv') setMode('csv');
    const source = new ns.CSVDataSource(SAMPLE_CSV);
    state.csvReadId++;
    state.loadId++;
    state.busy = false;
    $('load-button').disabled = false;
    clearData();
    state.csvSource = source;
    state.sampleMeta = true;
    $('csv-file').value = '';
    $('csv-symbol').value = 'YINK-DEMO';
    $('csv-name').value = '示例交易';
    $('csv-currency').value = 'USD';
    $('start-date').value = source.bars[0].date.slice(0, 10);
    $('end-date').value = source.bars[source.bars.length - 1].date.slice(0, 10);
    $('kline-interval').value = 'auto';
    $('start-time').value = '00:00';
    $('end-time').value = '23:59';
    updateTimeControls();
    await load();
    if (state.mode === 'csv' && state.csvSource === source && ns.currentData) setStatus('示例数据已加载。可直接在 K 线上标记 BUY 和 SELL。', 'success');
  }

  function renderData(security, bars, sourceName, selection) {
    const meta = selection || { interval: 'day', adjustment: 'none' };
    ns.currentData = { security: security, range: selectedRange(), bars: bars, source: sourceName, interval: meta.interval, adjustment: meta.adjustment };
    if (sourceName === 'csv' && state.csvSource) {
      const raw = state.csvSource.bars;
      if (raw.length !== bars.length || raw.some(function (bar, index) {
        return ['date', 'open', 'high', 'low', 'close', 'volume'].some(function (key) { return bar[key] !== bars[index][key]; });
      })) ns.currentData.rawBars = raw;
    }
    const intervalName = { minute5: '5-MIN', hour: 'HOURLY', day: 'DAILY', week: 'WEEKLY' }[meta.interval] || 'DAILY';
    $('source-label').textContent = (sourceName === 'eastmoney' ? 'EASTMONEY' : 'LOCAL CSV') + ' / ' + intervalName + ' OHLCV';
    $('security-title').textContent = security.name || security.symbol || '未命名股票';
    $('security-meta').textContent = [security.symbol, security.market, bars[0].date + ' — ' + bars[bars.length - 1].date].filter(Boolean).join(' · ');
    $('bar-count').textContent = bars.length.toLocaleString();
    $('bar-count-label').textContent = intervalName + ' BARS';
    const body = $('bar-rows');
    const fragment = document.createDocumentFragment();
    const tableBars = bars.length > 500 ? bars.slice(-500) : bars;
    $('table-hint').textContent = bars.length > 500 ? '为保持页面流畅，表格只显示最近 500 条；图表和海报仍使用完整 K 线数据。' : '这里保留当前时间级别的 K 线数据，便于核对交易区间和价格。';
    tableBars.forEach(function (bar) {
      const row = document.createElement('tr');
      [bar.date, bar.open, bar.high, bar.low, bar.close, bar.volume].forEach(function (value, index) {
        const cell = document.createElement('td');
        cell.textContent = index === 0 ? value : Number(value).toLocaleString('en-US', { maximumFractionDigits: index === 5 ? 0 : 4 });
        row.appendChild(cell);
      });
      fragment.appendChild(row);
    });
    body.replaceChildren(fragment);
    $('data-section').hidden = false;
    if (ns.onDataLoaded) ns.onDataLoaded(ns.currentData);
  }

  function selectedInterval(range) {
    const choice = $('kline-interval').value || 'auto';
    if (choice !== 'auto') return choice;
    const days = Math.round((Date.parse(range.end + 'T00:00:00Z') - Date.parse(range.start + 'T00:00:00Z')) / 86400000) + 1;
    if (days <= 2 && (state.mode === 'online' || state.csvSource && state.csvSource.sourceInterval === 'minute5')) return 'minute5';
    if (days <= 14 && (state.mode === 'online' || state.csvSource && ['minute5', 'hour'].includes(state.csvSource.sourceInterval))) return 'hour';
    return days <= 180 ? 'day' : 'week';
  }

  function timeSelectionActive() {
    return ['minute5', 'hour'].includes(selectedInterval({ start: $('start-date').value, end: $('end-date').value }));
  }

  function updateTimeControls() {
    const active = timeSelectionActive();
    $('time-range-row').hidden = !active;
    $('time-range-hint').hidden = !active;
    $('start-time').disabled = !active;
    $('end-time').disabled = !active;
  }

  function selectedRange() {
    const range = { start: $('start-date').value, end: $('end-date').value };
    if (timeSelectionActive()) {
      range.startTime = $('start-time').value;
      range.endTime = $('end-time').value;
    }
    return range;
  }

  async function load() {
    if (state.busy) return;
    const mode = state.mode;
    const loadId = ++state.loadId;
    const range = selectedRange();
    let source, security;
    try {
      ns.validateRange(range);
      if (state.mode === 'online') {
        if (!state.security) throw new Error('请先从搜索结果中选择一只股票。');
        source = onlineSource;
        security = state.security;
      } else {
        if (!state.csvSource) throw new Error('请先导入有效的 CSV 文件。');
        source = state.csvSource;
        security = { symbol: $('csv-symbol').value.trim(), name: $('csv-name').value.trim() || $('csv-symbol').value.trim() || '我的交易', market: '自定义数据', currency: $('csv-currency').value, source: 'csv' };
      }
      state.busy = true;
      $('load-button').disabled = true;
      $('data-section').hidden = true;
      clearData();
      setStatus('正在加载并校验 K 线数据…', 'loading');
      const interval = selectedInterval(range);
      const adjustment = state.mode === 'online' ? $('kline-adjustment').value || 'none' : 'none';
      const exactTimeWindow = range.startTime && (range.startTime !== '00:00' || range.endTime !== '23:59');
      const choices = $('kline-interval').value !== 'auto' || interval === 'day' || exactTimeWindow ? [interval]
        : interval === 'minute5' ? ['minute5', 'hour', 'day'] : [interval, 'day'];
      let result, lastError;
      for (const choice of choices) {
        try {
          const candidate = await source.getBars(security, range, { interval: choice, adjustment: adjustment });
          if (!result || candidate.bars.length > result.bars.length) result = candidate;
          if (candidate.bars.length >= 2) { result = candidate; break; }
        } catch (error) { lastError = error; }
      }
      if (!result) throw lastError;
      if (result.interval !== interval) result.fallbackFrom = interval;
      if (loadId !== state.loadId) return;
      renderData(security, result.bars, state.mode === 'online' ? 'eastmoney' : 'csv', result);
      const enoughBars = result.bars.length >= 2;
      setStatus('已加载 ' + result.bars.length + ' 条 ' + ({ minute5: '5 分钟', hour: '小时', day: '日', week: '周' }[result.interval] || '日') + ' K 数据。' + (result.fallbackFrom ? '自动模式已回退到' + ({ minute5: '5 分钟', hour: '小时', day: '日', week: '周' }[result.interval]) + ' K。' : '') + (enoughBars ? '' : '制作贴图至少需要两根 K 线；请扩大日期或时刻范围后重新加载。'), enoughBars ? 'success' : 'error');
    } catch (error) { if (loadId === state.loadId && mode === state.mode) setStatus(error.message, 'error'); }
    finally { if (loadId === state.loadId) { state.busy = false; $('load-button').disabled = false; } }
  }

  $('tab-online').addEventListener('click', function () { setMode('online'); });
  $('tab-csv').addEventListener('click', function () { setMode('csv'); });
  $('search-button').addEventListener('click', search);
  query.addEventListener('input', function () {
    clearTimeout(searchTimer);
    state.security = null;
    state.searchId++;
    state.loadId++;
    state.busy = false;
    $('load-button').disabled = false;
    clearData();
    results.replaceChildren();
    renderRecent();
    if (query.value.trim().length >= 2) searchTimer = setTimeout(search, 350);
  });
  query.addEventListener('keydown', function (event) { if (event.key === 'Enter') { clearTimeout(searchTimer); search(); } });
  $('csv-file').addEventListener('change', readCsv);
  $('load-sample').addEventListener('click', loadSample);
  ['csv-symbol', 'csv-name', 'csv-currency'].forEach(function (id) {
    $(id).addEventListener('change', function () {
      if (!ns.currentData || ns.currentData.source !== 'csv') return;
      const security = ns.currentData.security;
      security.symbol = $('csv-symbol').value.trim();
      security.name = $('csv-name').value.trim() || security.symbol || '我的交易';
      security.currency = $('csv-currency').value;
      $('security-title').textContent = security.name;
      $('security-meta').textContent = [security.symbol, security.market, ns.currentData.bars[0].date + ' — ' + ns.currentData.bars[ns.currentData.bars.length - 1].date].filter(Boolean).join(' · ');
      if (ns.onSecurityChanged) ns.onSecurityChanged();
    });
  });
  $('load-button').addEventListener('click', load);
  $('diagnostic-button').addEventListener('click', async function () {
    const button = $('diagnostic-button');
    const list = $('diagnostic-results');
    button.disabled = true;
    list.replaceChildren();
    let pending = document.createElement('li');
    pending.textContent = '正在检查 600519…';
    list.appendChild(pending);
    try {
      const report = await ns.verifyMarkets(onlineSource, function (result, index, total) {
        pending.remove();
        const row = document.createElement('li');
        row.className = result.ok ? 'diagnostic-pass' : 'diagnostic-fail';
        row.textContent = result.ok
          ? result.symbol + ' · ' + result.security.name + ' · ' + result.security.secid + ' · ' + result.count + ' 条 · ' + result.first.date + '—' + result.last.date + ' · 区间末收盘 ' + result.last.close
          : result.symbol + ' · 失败：' + result.error;
        list.appendChild(row);
        if (index < total) {
          pending = document.createElement('li');
          pending.textContent = '正在检查 ' + ['600519', '00700', 'AAPL'][index] + '…';
          list.appendChild(pending);
        }
      });
      const passed = report.filter(function (item) { return item.ok; }).length;
      const summary = document.createElement('li');
      summary.className = 'diagnostic-summary';
      summary.textContent = '结果：' + passed + ' / 3 通过。' + (passed < 3 ? '可改用 CSV 导入。' : '三地搜索和日 K 均已返回有效数据。');
      list.appendChild(summary);
    } finally { button.disabled = false; }
  });
  ['start-date', 'end-date', 'start-time', 'end-time', 'kline-interval', 'kline-adjustment'].forEach(function (id) {
    $(id).addEventListener('change', function () { updateTimeControls(); state.loadId++; state.busy = false; $('load-button').disabled = false; clearData(); $('data-section').hidden = true; setStatus('设置已更新，请重新加载 K 线。'); });
  });

  ns.restoreSessionData = function (saved) {
    if (!saved || !saved.security || !Array.isArray(saved.bars) || !saved.bars.length || !['csv', 'eastmoney'].includes(saved.source)) throw new Error('上次保存的行情数据无效。');
    ns.validateRange(saved.range);
    if (saved.source === 'eastmoney' && !/^(0|1|105|106|107|116)\.[A-Za-z0-9.\-]+$/.test(saved.security.secid || '')) throw new Error('上次保存的证券代码无效。');
    const lines = ['date,open,high,low,close,volume'].concat(saved.bars.map(function (bar) {
      if (!bar || typeof bar !== 'object') throw new Error('上次保存的 K 线数据无效。');
      return [bar.date, bar.open, bar.high, bar.low, bar.close, bar.volume].join(',');
    }));
    const source = new ns.CSVDataSource(lines.join('\n'));
    const bars = source.bars;
    if (bars[0].date.slice(0, 10) < saved.range.start || bars[bars.length - 1].date.slice(0, 10) > saved.range.end || bars.some(function (bar, index) { return bar.date !== saved.bars[index].date; })) throw new Error('上次保存的日期区间与 K 线不一致。');
    const interval = ['minute5', 'hour', 'day', 'week'].includes(saved.interval) ? saved.interval : (bars[0].date.length === 16 ? 'hour' : 'day');
    const adjustment = ['none', 'forward', 'backward'].includes(saved.adjustment) ? saved.adjustment : 'none';
    if (['minute5', 'hour'].includes(interval) && bars.some(function (bar) { return bar.date.length !== 16; })) throw new Error('上次保存的分时 K 日期格式无效。');
    if (['minute5', 'hour'].includes(interval) && bars.some(function (bar) {
      return bar.date < saved.range.start + ' ' + (saved.range.startTime || '00:00') || bar.date > saved.range.end + ' ' + (saved.range.endTime || '23:59');
    })) throw new Error('上次保存的时刻区间与 K 线不一致。');
    const mode = saved.source === 'csv' ? 'csv' : 'online';
    let rawSource = null;
    if (mode === 'csv' && Array.isArray(saved.rawBars) && saved.rawBars.length <= 100000) {
      try {
        const rawLines = ['date,open,high,low,close,volume'].concat(saved.rawBars.map(function (bar) {
          return [bar.date, bar.open, bar.high, bar.low, bar.close, bar.volume].join(',');
        }));
        const candidate = new ns.CSVDataSource(rawLines.join('\n'));
        const selected = candidate.selectBars(saved.security, saved.range, { interval: interval, adjustment: 'none' });
        if (JSON.stringify(selected.bars) === JSON.stringify(bars)) rawSource = candidate;
      } catch (_) { /* keep the selected bars even if the original CSV cannot be restored */ }
    }
    setMode(mode);
    $('start-date').value = saved.range.start;
    $('end-date').value = saved.range.end;
    $('start-time').value = saved.range.startTime || '00:00';
    $('end-time').value = saved.range.endTime || '23:59';
    $('kline-interval').value = interval;
    updateTimeControls();
    $('kline-adjustment').value = mode === 'online' ? adjustment : 'none';
    if (mode === 'online') {
      state.security = saved.security;
      query.value = saved.security.symbol;
      renderRecent();
    } else {
      state.csvSource = rawSource || (interval === 'week' ? null : source);
      $('csv-symbol').value = saved.security.symbol || '';
      $('csv-name').value = saved.security.name || '';
      $('csv-currency').value = ['USD', 'CNY', 'HKD'].includes(saved.security.currency) ? saved.security.currency : 'USD';
    }
    renderData(saved.security, bars, mode === 'online' ? 'eastmoney' : 'csv', { interval: interval, adjustment: mode === 'online' ? adjustment : 'none' });
    setStatus(interval === 'week' && mode === 'csv' && !rawSource ? '已恢复周 K 作品；切换时间级别请重新导入原始 CSV。' : '已恢复上次编辑的数据。', 'success');
  };

  function localDate(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  const today = new Date();
  const yearAgo = new Date(today);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  $('start-date').value = localDate(yearAgo);
  $('end-date').value = localDate(today);
  $('start-time').value = '00:00';
  $('end-time').value = '23:59';
  updateTimeControls();
  renderRecent();
})(window);
