(function (root) {
  'use strict';
  const ns = root.YINK;
  const $ = function (id) { return document.getElementById(id); };
  const STORAGE_KEY = 'yink.session.v1';
  const studio = { data: null, events: [], selectedIndex: -1, restoring: false, template: 'gallery', persistRawCsv: true };
  const chart = new ns.KlineChart($('chart-canvas'), selectBar, hoverBar);

  function dataIdentity(data) {
    if (data.source === 'eastmoney' && data.security.secid) return 'eastmoney:' + data.security.secid;
    let hash = 2166136261;
    const sourceBars = data.rawBars || data.bars;
    sourceBars.forEach(function (bar) {
      const line = [bar.date, bar.open, bar.high, bar.low, bar.close, bar.volume].join(',');
      for (let index = 0; index < line.length; index++) hash = Math.imul(hash ^ line.charCodeAt(index), 16777619) >>> 0;
    });
    return (data.source || 'csv') + ':' + sourceBars.length + ':' + hash.toString(16);
  }

  function currency() {
    if (studio.data && studio.data.security.currency) return studio.data.security.currency;
    const code = studio.data && studio.data.security.marketCode;
    return code === '0' || code === '1' ? 'CNY' : code === '116' ? 'HKD' : 'USD';
  }

  function format(value, digits) {
    return Number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function posterOptions() {
    return {
      template: studio.template,
      background: $('poster-background').value,
      showName: $('show-name').checked,
      showSymbol: $('show-symbol').checked,
      showCapital: $('show-capital').checked,
      showProfit: $('show-profit').checked,
      showReturn: $('show-return').checked,
      showDays: $('show-days').checked,
      showPrices: $('show-prices').checked,
      showDates: $('show-dates').checked,
      quote: $('poster-quote').value
    };
  }

  function buildPosterState() {
    if (!studio.data) throw new Error('请先加载 K 线数据。');
    return {
      security: studio.data.security,
      bars: studio.data.bars,
      trade: ns.calculateTrade(studio.events, $('capital').value, studio.data.bars.at(-1).close, studio.data.bars.at(-1).date),
      currency: currency(),
      options: posterOptions()
    };
  }

  function save() {
    if (studio.restoring || !studio.data) return;
    const data = Object.assign({}, studio.data);
    if (!studio.persistRawCsv) delete data.rawBars;
    const session = {
      data: data,
      events: studio.events,
      capital: $('capital').value,
      options: posterOptions(),
      posterVisible: !$('poster-section').hidden
    };
    try {
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (_) {
      if (data.rawBars) {
        studio.persistRawCsv = false;
        delete data.rawBars;
        try {
          root.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
          $('session-save-status').textContent = '原始 CSV 超出浏览器存储空间；本次编辑仍可继续，刷新后切换时间级别需重新导入 CSV。';
          return;
        } catch (_) { /* storage may be unavailable */ }
      }
      $('session-save-status').textContent = '当前数据无法自动保存；请下载艺术项目 JSON 保留作品。';
    }
  }

  function onDataLoaded(data) {
    data.identity = dataIdentity(data);
    studio.data = data;
    studio.persistRawCsv = true;
    $('session-save-status').textContent = '';
    studio.events = [];
    studio.selectedIndex = -1;
    $('studio-section').hidden = false;
    $('poster-section').hidden = true;
    $('style-section').hidden = true;
    $('selected-date').textContent = '点击一根 K 线以选择日期';
    $('mark-buy').disabled = true;
    $('mark-sell').disabled = true;
    $('chart-interval-label').textContent = ({ minute5: '5-MIN', hour: 'HOURLY', day: 'DAILY', week: 'WEEKLY' }[data.interval] || 'DAILY') + ' PRICE TRACE';
    $('chart-title').textContent = data.security.name + '  /  ' + data.security.symbol + ' · ' + ({ minute5: '5 分钟 K', hour: '小时 K', day: '日 K', week: '周 K' }[data.interval] || '日 K');
    $('currency-label').textContent = '单位：' + currency();
    $('capital').value = '';
    chart.setData(data.bars);
    chart.setEvents([]);
    $('trade-event-status').textContent = '';
    syncTradeFields();
    refreshTrade();
    if (ns.onArtworkDataLoaded) ns.onArtworkDataLoaded(data);
    save();
  }

  function onDataCleared() {
    studio.data = null;
    studio.events = [];
    studio.selectedIndex = -1;
    $('studio-section').hidden = true;
    $('poster-section').hidden = true;
    $('style-section').hidden = true;
    $('mark-buy').disabled = true;
    $('mark-sell').disabled = true;
  }

  function hoverBar(bar) {
    $('chart-hover').textContent = bar
      ? bar.date + '   O ' + format(bar.open, 2) + '   H ' + format(bar.high, 2) + '   L ' + format(bar.low, 2) + '   C ' + format(bar.close, 2) + '   VOL ' + format(bar.volume, 0)
      : '将鼠标移到 K 线上查看 OHLC。';
  }

  function selectBar(index, bar) {
    studio.selectedIndex = index;
    $('selected-date').textContent = '已选择 ' + bar.date + ' · 收盘 ' + format(bar.close, 2);
    $('mark-buy').disabled = false;
    $('mark-sell').disabled = false;
  }

  function syncTradeFields() {
    ['BUY', 'SELL'].forEach(function (type) {
      const event = studio.events.find(function (item) { return item.type === type; });
      const prefix = type.toLowerCase();
      $(prefix + '-price').value = event ? event.price : '';
      $(prefix + '-price').disabled = !event;
      $(prefix + '-date').textContent = event ? event.date : '—';
    });
    $('capital').disabled = !studio.events.length;
  }

  function renderTradeEvents() {
    const host = $('trade-events');
    host.replaceChildren();
    $('trade-count').textContent = studio.events.length + ' 笔';
    studio.events.map(function (event, index) { return { event: event, index: index }; }).sort(function (a, b) {
      return a.event.date.localeCompare(b.event.date) || a.index - b.index;
    }).forEach(function (item) {
      const event = item.event, index = item.index;
      const row = document.createElement('div'); row.className = 'trade-event-row';
      const caption = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = event.type + ' · ' + event.date;
      const detail = document.createElement('small'); detail.textContent = '第 ' + (index + 1) + ' 个标点';
      caption.append(title, detail);
      function field(labelText, value, key) {
        const label = document.createElement('label'); label.textContent = labelText;
        const input = document.createElement('input'); input.type = 'number'; input.min = '0.000001'; input.step = 'any';
        input.value = value == null ? '' : String(value);
        input.addEventListener('change', function () {
          try {
            studio.events = ns.updateTradeEvent(studio.events, index, { [key]: input.value });
            $('trade-event-status').textContent = '';
            syncTradeFields(); refreshTrade();
          } catch (error) { input.value = value == null ? '' : String(value); $('trade-event-status').textContent = error.message; }
        });
        label.appendChild(input);
        return label;
      }
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '删除';
      remove.addEventListener('click', function () {
        studio.events = studio.events.filter(function (_value, position) { return position !== index; });
        $('trade-event-status').textContent = '';
        syncTradeFields(); refreshTrade();
      });
      row.append(caption, field('成交价', event.price, 'price'), field('数量', event.quantity, 'quantity'), remove);
      host.appendChild(row);
    });
  }

  function refreshTrade() {
    chart.setEvents(studio.events);
    renderTradeEvents();
    const box = $('trade-result');
    try {
      const enoughBars = studio.data && studio.data.bars.length >= 2;
      if (!studio.events.length) {
        box.textContent = enoughBars ? '尚未标记买卖点，可直接制作原始 K 线贴图。' : '制作贴图至少需要两根 K 线；请扩大日期或时刻范围后重新加载。';
        $('make-poster').disabled = !enoughBars;
        $('make-poster-label').textContent = '选择 K 线风格 · 制作原始贴图';
        $('open-classic').disabled = true;
        $('poster-section').hidden = true;
        if (!enoughBars) $('style-section').hidden = true;
        else if (!$('style-section').hidden && ns.showStyleStep) ns.showStyleStep();
        save();
        return;
      }
      const lastBar = studio.data && studio.data.bars.at(-1);
      const result = ns.calculateTrade(studio.events, $('capital').value, lastBar && lastBar.close, lastBar && lastBar.date);
      const sign = result.returnPct >= 0 ? '+' : '';
      box.replaceChildren();
      const headline = document.createElement('strong');
      headline.textContent = sign + format(result.returnPct, 2) + '%';
      box.appendChild(headline);
      box.append(document.createTextNode(result.mode === 'quantity'
        ? result.events.length + ' 笔 · 累计买入 ' + format(result.buyQuantity, 4) + ' · 累计卖出 ' + format(result.sellQuantity, 4) + ' · 收益率基于' + result.returnBasis
        : ns.formatHoldingDuration(result, 'zh') + ' · ' + format(result.buy.price, 2) + ' → ' + format(result.sell.price, 2)));
      if (result.mode === 'quantity') {
        const detail = document.createElement('span'); detail.className = 'subresult';
        detail.textContent = '已实现 ' + currency() + ' ' + format(result.realizedProfit, 2) + ' · 未实现 ' + currency() + ' ' + format(result.unrealizedProfit, 2) + ' · 剩余 ' + format(result.remainingQuantity, 4) + ' · 合计 ' + currency() + ' ' + format(result.profit, 2) + (result.finalAmount == null ? '' : ' · 参考最终金额 ' + currency() + ' ' + format(result.finalAmount, 2));
        box.appendChild(detail);
      } else if (result.capital != null) {
        const detail = document.createElement('span');
        detail.className = 'subresult';
        detail.textContent = '盈亏 ' + currency() + ' ' + (result.profit >= 0 ? '+' : '') + format(result.profit, 2) + ' · 最终金额 ' + currency() + ' ' + format(result.finalAmount, 2);
        box.appendChild(detail);
      }
      $('make-poster').disabled = !enoughBars;
      $('make-poster-label').textContent = '固定交易轨迹 · 选择 K 线风格';
      $('open-classic').disabled = false;
      if (enoughBars) {
        if (!$('poster-section').hidden) preview();
        if (!$('style-section').hidden && ns.showStyleStep) ns.showStyleStep();
      } else {
        const hint = document.createElement('span');
        hint.className = 'subresult';
        hint.textContent = '制作贴图至少需要两根 K 线；请扩大日期或时刻范围后重新加载。';
        box.appendChild(hint);
        $('poster-section').hidden = true;
        $('style-section').hidden = true;
      }
    } catch (error) {
      box.textContent = error.message;
      $('make-poster').disabled = true;
      $('open-classic').disabled = true;
      $('poster-section').hidden = true;
      $('style-section').hidden = true;
    }
    save();
  }

  function mark(type) {
    if (!studio.data || studio.selectedIndex < 0) return;
    studio.events = ns.addTradeEvent(studio.events, type, studio.data.bars[studio.selectedIndex]);
    $('trade-event-status').textContent = '';
    syncTradeFields();
    refreshTrade();
  }

  function preview() {
    try {
      ns.renderPoster($('poster-canvas'), buildPosterState(), 700, 875);
      $('export-status').textContent = '';
    } catch (error) { $('export-status').textContent = error.message; }
  }

  function setTemplate(value) {
    studio.template = value;
    $('template-gallery').classList.toggle('active', value === 'gallery');
    $('template-obsidian').classList.toggle('active', value === 'obsidian');
    if (!$('poster-section').hidden) preview();
    save();
  }

  function restore() {
    let saved;
    try { saved = JSON.parse(root.localStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) { return; }
    if (!saved) return;
    if (!saved.data) {
      try { root.localStorage.removeItem(STORAGE_KEY); } catch (_) { /* storage unavailable */ }
      return;
    }
    studio.restoring = true;
    try {
      ns.restoreSessionData(saved.data);
      studio.events = Array.isArray(saved.events) ? saved.events.filter(function (event) {
        return (event.type === 'BUY' || event.type === 'SELL') && ns.isValidDate(event.date) && Number.isFinite(event.price) && event.price > 0 && studio.data.bars.some(function (bar) { return bar.date === event.date; });
      }) : [];
      $('capital').value = saved.capital || '';
      const opt = saved.options || {};
      setTemplate(opt.template === 'obsidian' ? 'obsidian' : 'gallery');
      $('poster-background').value = ['default', 'light', 'dark'].includes(opt.background) ? opt.background : 'default';
      ['showName', 'showSymbol', 'showCapital', 'showProfit', 'showReturn', 'showDays', 'showPrices', 'showDates'].forEach(function (key) {
        const id = key.replace(/[A-Z]/g, function (letter) { return '-' + letter.toLowerCase(); });
        $(id).checked = opt[key] !== false;
      });
      $('poster-quote').value = String(opt.quote || '').slice(0, 90);
      syncTradeFields();
      refreshTrade();
      if (saved.posterVisible && !$('make-poster').disabled) { $('poster-section').hidden = false; preview(); }
    } catch (error) {
      try { root.localStorage.removeItem(STORAGE_KEY); } catch (_) { /* storage unavailable */ }
      $('status').textContent = '上次会话无法恢复：' + error.message;
      $('status').className = 'status error';
    } finally { studio.restoring = false; }
  }

  $('zoom-in').addEventListener('click', function () { chart.zoom(1); });
  $('zoom-out').addEventListener('click', function () { chart.zoom(-1); });
  $('zoom-reset').addEventListener('click', function () { chart.reset(); });
  $('mark-buy').addEventListener('click', function () { mark('BUY'); });
  $('mark-sell').addEventListener('click', function () { mark('SELL'); });
  ['BUY', 'SELL'].forEach(function (type) {
    const input = $(type.toLowerCase() + '-price');
    input.addEventListener('change', function () {
      try {
        const index = studio.events.findIndex(function (event) { return event.type === type; });
        studio.events = ns.updateTradeEvent(studio.events, index, { price: input.value });
        $('trade-event-status').textContent = '';
        syncTradeFields(); refreshTrade();
      } catch (error) { $('trade-result').textContent = error.message; $('make-poster').disabled = true; $('style-section').hidden = true; $('poster-section').hidden = true; }
    });
  });
  $('capital').addEventListener('input', refreshTrade);
  $('make-poster').addEventListener('click', function () {
    if ($('make-poster').disabled) return;
    $('style-section').hidden = false;
    if (ns.showStyleStep) ns.showStyleStep();
    save();
    $('style-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('open-classic').addEventListener('click', function () {
    if ($('open-classic').disabled) return;
    $('poster-section').hidden = false;
    preview();
    save();
    $('poster-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('template-gallery').addEventListener('click', function () { setTemplate('gallery'); });
  $('template-obsidian').addEventListener('click', function () { setTemplate('obsidian'); });
  ['poster-background', 'show-name', 'show-symbol', 'show-capital', 'show-profit', 'show-return', 'show-days', 'show-prices', 'show-dates', 'poster-quote'].forEach(function (id) {
    $(id).addEventListener('input', function () { if (!$('poster-section').hidden) preview(); save(); });
  });
  ['share', 'print'].forEach(function (kind) {
    $('export-' + kind).addEventListener('click', async function () {
      const button = $('export-' + kind);
      button.disabled = true;
      $('export-status').textContent = '正在绘制高清 PNG…';
      try {
        const result = await ns.exportPoster(buildPosterState(), kind);
        $('export-status').textContent = '已生成 ' + result.filename + '（' + result.width + ' × ' + result.height + '）。';
      } catch (error) { $('export-status').textContent = error.message; }
      finally { button.disabled = false; }
    });
  });

  ns.onDataLoaded = onDataLoaded;
  ns.onDataCleared = onDataCleared;
  ns.getTradeSnapshot = function (crop) {
    if (!studio.data) throw new Error('请先加载 K 线数据。');
    const source = studio.data.bars;
    const trade = studio.events.length ? ns.calculateTrade(studio.events, $('capital').value, source.at(-1).close, source.at(-1).date) : null;
    const choice = crop && crop.mode || (trade ? 'trade' : 'range');
    let bars;
    if (choice === 'range' || (choice === 'trade' && !trade)) bars = source.slice();
    else if (choice === 'custom') {
      ns.validateRange(crop);
      const first = source[0].date.slice(0, 10), last = source.at(-1).date.slice(0, 10);
      if (crop.start < first || crop.end > last) throw new Error('自定义截取日期须位于已加载的 K 线区间内。');
      if (trade && (crop.start > trade.buy.date.slice(0, 10) || crop.end < trade.events.at(-1).date.slice(0, 10))) throw new Error('截取范围须包含所有买卖节点。');
      bars = source.filter(function (bar) { return bar.date.slice(0, 10) >= crop.start && bar.date.slice(0, 10) <= crop.end; });
    } else if (choice === 'trade') {
      bars = source.filter(function (bar) { return bar.date >= trade.buy.date && bar.date <= trade.endDate; });
      if (bars.length === 1 && source.length > 1) {
        const index = source.findIndex(function (bar) { return bar.date === bars[0].date; });
        bars = index < source.length - 1 ? source.slice(index, index + 2) : source.slice(index - 1, index + 1);
      }
    }
    else throw new Error('K 线截取方式无效。');
    if (bars.length < 2) throw new Error('截取范围至少需要两根 K 线。');
    const snapshotTrade = trade && choice === 'custom' ? ns.calculateTrade(studio.events, $('capital').value, bars.at(-1).close, bars.at(-1).date) : trade;
    return { security: studio.data.security, bars: bars, trade: snapshotTrade, currency: currency(), identity: studio.data.identity, crop: trade ? choice : choice === 'trade' ? 'range' : choice };
  };
  ns.onSecurityChanged = function () {
    $('chart-title').textContent = studio.data.security.name + '  /  ' + studio.data.security.symbol + ' · ' + ({ minute5: '5 分钟 K', hour: '小时 K', day: '日 K', week: '周 K' }[studio.data.interval] || '日 K');
    $('currency-label').textContent = '单位：' + currency();
    refreshTrade();
  };
  restore();
})(window);
