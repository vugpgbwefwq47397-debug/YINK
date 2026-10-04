(function (root) {
  'use strict';
  const ns = root.YINK;
  const model = ns.EditorModel;
  const renderer = ns.EditorRender;
  const stickers = ns.EditorStickers;
  const $ = function (id) { return document.getElementById(id); };
  const KEY = 'yink.editor.v1';
  const HISTORY_LIMIT = 24 * 1024 * 1024;
  const LEGACY_BINDINGS = { '股票代码': 'symbol', '收益率': 'returnPct', '交易日期': 'dates', '买卖价格': 'prices', '持仓天数': 'days', '投入金额': 'capital', '盈亏金额': 'profit' };
  const canvas = $('editor-canvas');
  let design = null, selectedId = null, drag = null, previewId = 0, stateRevision = 0, viewZoom = 1, lastWorkspaceWidth = 0, stickerPreviewId = 0, fontSizeEditId = null, inkVariant = 'ink';
  const markerImages = { BUY: null, SELL: null };
  let undoStack = [], redoStack = [], touchSelection = null;

  function status(message) { $('editor-status').textContent = message; }
  function selected() { return design && design.layers.find(function (layer) { return layer.id === selectedId; }); }
  function tradeText(snapshot) {
    const trade = snapshot.trade;
    if (!trade) return { '买卖价格': '', '持仓天数': '', '投入金额': '', '盈亏金额': '' };
    const currency = String(snapshot.currency || snapshot.security.currency || 'USD').slice(0, 8);
    const money = function (value) { return Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
    const days = Number.isFinite(trade.holdingDays) ? trade.holdingDays : Math.round((Date.parse(trade.sell.date + 'T00:00:00Z') - Date.parse(trade.buy.date + 'T00:00:00Z')) / 86400000);
    const profit = trade.profit == null ? (trade.capital == null ? null : trade.capital * (trade.sell.price - trade.buy.price) / trade.buy.price) : trade.profit;
    return {
      '买卖价格': (trade.mode === 'quantity' ? 'AVG ' : '') + money(trade.buy.price) + '  →  ' + money(trade.sell.price),
      '持仓天数': ns.formatHoldingDuration(Object.assign({}, trade, { holdingDays: days }), 'en'),
      '投入金额': trade.capital == null ? '' : currency + ' ' + money(trade.capital),
      '盈亏金额': profit == null ? '' : currency + ' ' + (profit >= 0 ? '+' : '-') + money(Math.abs(profit))
    };
  }
  function boundText(snapshot) {
    const details = tradeText(snapshot);
    if (!snapshot.trade) return {
      symbol: snapshot.security.symbol || snapshot.security.name || 'TRADE', returnPct: '',
      dates: snapshot.bars[0].date + '  —  ' + snapshot.bars.at(-1).date,
      prices: '', days: '', capital: '', profit: ''
    };
    const returnPct = Number.isFinite(snapshot.trade.returnPct) ? snapshot.trade.returnPct : (snapshot.trade.sell.price - snapshot.trade.buy.price) / snapshot.trade.buy.price * 100;
    return {
      symbol: snapshot.security.symbol || snapshot.security.name || 'TRADE',
      returnPct: (returnPct >= 0 ? '+' : '') + returnPct.toFixed(2) + '%',
      dates: snapshot.trade.buy.date + '  —  ' + (snapshot.trade.endDate || snapshot.trade.sell.date),
      prices: details['买卖价格'], days: details['持仓天数'], capital: details['投入金额'], profit: details['盈亏金额']
    };
  }
  function remember(stack, snapshot) {
    stack.push(snapshot);
    let size = stack.reduce(function (sum, item) { return sum + item.length; }, 0);
    while (stack.length > 1 && (stack.length > 60 || size > HISTORY_LIMIT)) size -= stack.shift().length;
  }
  function syncHistoryButtons() { $('editor-undo').disabled = !undoStack.length; $('editor-redo').disabled = !redoStack.length; }
  function pushHistory() { if (!design) return; remember(undoStack, JSON.stringify(design)); redoStack = []; syncHistoryButtons(); }
  function saveDraft() {
    if (!design || !design.settings.autosave) return null;
    try { root.localStorage.setItem(KEY, JSON.stringify(design)); status('草稿已自动保存在当前浏览器。'); return true; }
    catch (_) { status('本地存储空间不足；请使用“保存项目”下载 JSON。'); return false; }
  }
  function fontSizeValue(value, fallback) {
    if (String(value).trim() === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(8, Math.min(300, Math.round(number))) : fallback;
  }
  function syncFontSizeControls(value) {
    const size = fontSizeValue(value, 32);
    $('prop-font-size').value = String(size);
    $('prop-font-size-number').value = String(size);
    $('font-size-value').textContent = size + ' px';
  }
  function finishFontSizeEdit() {
    if (fontSizeEditId === null) return;
    fontSizeEditId = null;
    saveDraft();
  }

  function syncCanvasZoom() {
    const workspaceWidth = $('editor-workspace').getBoundingClientRect().width;
    lastWorkspaceWidth = workspaceWidth;
    const computed = root.getComputedStyle && root.getComputedStyle($('editor-workspace'));
    const inset = computed ? (parseFloat(computed.paddingLeft) || 0) + (parseFloat(computed.paddingRight) || 0) + 2 : 48;
    const baseWidth = Math.min(650, Math.max(120, workspaceWidth - inset));
    const displayWidth = Math.round(baseWidth * viewZoom);
    $('editor-canvas-wrap').style.width = displayWidth + 'px';
    return displayWidth;
  }

  function draw() {
    if (!design) return;
    const current = ++previewId;
    const image = design;
    const displayWidth = syncCanvasZoom();
    const width = Math.max(700, Math.min(1400, Math.round(displayWidth * Math.min(root.devicePixelRatio || 1, 1.5))));
    const height = Math.round(width * design.height / design.width);
    $('editor-dimensions').textContent = design.width + ' × ' + design.height;
    renderer.prepare(image).then(function () {
      if (current !== previewId) return;
      renderer.renderPrepared(canvas, image, width, height, selectedId, image.settings.guides);
    }).catch(function (error) { if (current === previewId) status(error.message); });
  }

  function syncLayers() {
    const host = $('editor-layers');
    host.replaceChildren();
    if (!design) return;
    $('layer-count').textContent = String(design.layers.length);
    design.layers.slice().reverse().forEach(function (layer) {
      const row = document.createElement('div');
      row.className = 'layer-row' + (layer.id === selectedId ? ' selected' : '');
      const choose = document.createElement('button');
      choose.type = 'button'; choose.className = 'layer-choose';
      choose.textContent = (layer.type === 'text' ? 'T' : layer.type === 'kline' ? '⌁' : layer.type === 'image' ? '▧' : '▢') + '  ' + layer.name;
      choose.addEventListener('click', function () { selectedId = layer.id; refresh(); });
      const eye = document.createElement('button');
      eye.type = 'button'; eye.title = layer.visible === false ? '显示' : '隐藏'; eye.textContent = layer.visible === false ? '◌' : '◉';
      eye.addEventListener('click', function () { mutate(function () { layer.visible = layer.visible === false; }); });
      const lock = document.createElement('button');
      lock.type = 'button'; lock.title = layer.locked ? '解锁' : '锁定'; lock.textContent = layer.locked ? '🔒' : '◯';
      lock.addEventListener('click', function () { mutate(function () { layer.locked = !layer.locked; }); });
      row.append(choose, eye, lock);
      host.appendChild(row);
    });
    ['layer-up', 'layer-down', 'layer-duplicate', 'layer-delete', 'align-left', 'align-center', 'align-right', 'align-top', 'align-middle', 'align-bottom'].forEach(function (id) { $(id).disabled = !selected() || selected().locked; });
  }

  function syncProperties() {
    const layer = selected();
    if (fontSizeEditId !== null && (!layer || layer.id !== fontSizeEditId)) finishFontSizeEdit();
    const inkLayer = !!(layer && layer.type === 'kline' && layer.style && ['ink', 'ink2'].includes(layer.style.renderer));
    const ink2Layer = !!(inkLayer && layer.style.renderer === 'ink2');
    $('editor-no-selection').hidden = !!layer;
    $('editor-properties').hidden = !layer;
    $('kline-advanced-panel').hidden = !layer || layer.type !== 'kline' || inkLayer;
    if (!layer) return;
    $('prop-name').value = layer.name;
    ['x', 'y', 'w', 'h'].forEach(function (key) { $('prop-' + key).value = Math.round(layer[key]); });
    $('prop-rotation').value = layer.rotation || 0;
    $('rotation-value').textContent = Math.round(layer.rotation || 0) + '°';
    $('prop-opacity').value = Math.round(layer.opacity * 100);
    $('opacity-value').textContent = Math.round(layer.opacity * 100) + '%';
    $('prop-color').value = /^#[0-9a-f]{6}$/i.test(layer.color || '') ? layer.color : '#242724';
    $('text-properties').hidden = layer.type !== 'text';
    $('image-properties').hidden = layer.type !== 'image';
    $('kline-properties').hidden = layer.type !== 'kline' || inkLayer;
    $('ink-properties').hidden = !inkLayer;
    $('prop-ink-hint').textContent = ink2Layer ? '水墨风 2 以真实收盘价绘制折线；笔触保持透明，背景贴图可单独添加。' : '水墨主体保持透明：涨白、跌黑；背景墨点可单独添加。';
    $('prop-ink-bleed-row').hidden = ink2Layer;
    $('prop-ink-line-row').hidden = ink2Layer;
    $('prop-ink2-dryness-row').hidden = !ink2Layer;
    $('prop-ink2-ghost-row').hidden = !ink2Layer;
    $('prop-color-row').hidden = layer.type === 'image' || layer.type === 'kline';
    ['prop-name', 'prop-x', 'prop-y', 'prop-w', 'prop-h', 'prop-rotation', 'prop-opacity', 'prop-color', 'prop-text', 'prop-binding', 'prop-font-size', 'prop-font-size-number', 'prop-font', 'prop-font-upload', 'prop-align', 'prop-text-fit', 'prop-image-fit', 'prop-image-focus-x', 'prop-image-focus-y', 'prop-image-replace', 'prop-kline-mode', 'prop-kline-up', 'prop-kline-down', 'prop-kline-surface', 'prop-kline-labels', 'prop-kline-stroke-width', 'prop-kline-candle-width', 'prop-kline-profit-mode', 'prop-kline-profit-color', 'prop-kline-buy-marker', 'prop-kline-sell-marker', 'prop-kline-marker-size', 'prop-kline-buy-marker-color', 'prop-kline-sell-marker-color', 'prop-kline-buy-image', 'prop-kline-sell-image', 'prop-ink-stroke-width', 'prop-ink-bleed', 'prop-ink-line', 'prop-ink2-dryness', 'prop-ink2-ghost', 'prop-ink-markers', 'prop-ink-buy-marker', 'prop-ink-sell-marker', 'prop-ink-marker-size', 'prop-ink-buy-marker-color', 'prop-ink-sell-marker-color', 'prop-ink-labels', 'prop-ink-buy-image', 'prop-ink-sell-image'].forEach(function (id) { $(id).disabled = !!layer.locked; });
    if (layer.type === 'kline' && !layer.trade) {
      ['prop-kline-labels', 'prop-kline-profit-mode', 'prop-kline-profit-color', 'prop-kline-buy-marker', 'prop-kline-sell-marker', 'prop-kline-marker-size', 'prop-kline-buy-marker-color', 'prop-kline-sell-marker-color', 'prop-kline-buy-image', 'prop-kline-sell-image', 'prop-ink-markers', 'prop-ink-buy-marker', 'prop-ink-sell-marker', 'prop-ink-marker-size', 'prop-ink-buy-marker-color', 'prop-ink-sell-marker-color', 'prop-ink-labels', 'prop-ink-buy-image', 'prop-ink-sell-image'].forEach(function (id) { $(id).disabled = true; });
    }
    if (layer.type === 'text') {
      $('prop-text').value = layer.text || '';
      $('prop-binding').value = layer.binding === undefined ? (LEGACY_BINDINGS[layer.name] || '') : layer.binding;
      $('prop-binding').disabled = !!layer.locked || !design.source;
      Array.from($('prop-binding').options || []).forEach(function (option) {
        if (['returnPct', 'prices', 'days', 'capital', 'profit'].includes(option.value)) option.disabled = !(design.source && design.source.trade);
      });
      syncFontSizeControls(layer.fontSize || 32);
      $('prop-font').value = layer.font || 'serif';
      $('prop-font-note').textContent = layer.font === 'custom' ? '当前字体：' + (layer.fontName || '自定义字体') + '。字体随项目保存。' : '支持 TTF、OTF、WOFF、WOFF2，最大 20 MB。字体随项目保存。';
      $('prop-align').value = layer.align || 'left';
      $('prop-text-fit').value = layer.textFit === 'fixed' ? 'fixed' : 'auto';
    }
    if (layer.type === 'kline') {
      const style = layer.style || {};
      if (inkLayer) {
        $('prop-ink-stroke-width').value = String(style.strokeWidth || (ink2Layer ? 1 : 1.5));
        $('prop-ink-bleed').value = String(style.inkBleed || 1.5);
        $('prop-ink-line').checked = style.inkLine !== false;
        $('prop-ink2-dryness').value = String(style.inkDryness || 1);
        $('prop-ink2-ghost').checked = style.inkGhost !== false;
        $('prop-ink-markers').checked = style.inkMarkers !== false;
        $('prop-ink-buy-marker').value = style.buyMarker || 'ink-stamp';
        $('prop-ink-sell-marker').value = style.sellMarker || 'ink-brush';
        $('prop-ink-marker-size').value = String(style.markerSize || 12);
        $('prop-ink-buy-marker-color').value = style.buyMarkerColor || '#a33d2f';
        $('prop-ink-sell-marker-color').value = style.sellMarkerColor || '#a33d2f';
        $('prop-ink-labels').checked = style.labels === true;
      }
      $('prop-kline-mode').value = ['candles', 'line', 'area'].includes(style.mode) ? style.mode : 'candles';
      $('prop-kline-up').value = /^#[0-9a-f]{6}$/i.test(style.up || '') ? style.up : '#b25937';
      $('prop-kline-down').value = /^#[0-9a-f]{6}$/i.test(style.down || '') ? style.down : '#42685c';
      $('prop-kline-surface').value = ['transparent', 'paper', 'dark'].includes(style.surface) ? style.surface : 'transparent';
      $('prop-kline-labels').checked = style.labels !== false;
      $('prop-kline-stroke-width').value = String(style.strokeWidth || 1);
      $('prop-kline-candle-width').value = String(style.candleWidth || 0.55);
      $('prop-kline-profit-mode').value = style.profitMode || 'transparent';
      $('prop-kline-profit-color').value = style.profitColor || '#c3483b';
      $('prop-kline-buy-marker').value = style.buyMarker || 'dot';
      $('prop-kline-sell-marker').value = style.sellMarker || 'dot';
      $('prop-kline-marker-size').value = String(style.markerSize || 8);
      $('prop-kline-buy-marker-color').value = style.buyMarkerColor || style.up || '#b25937';
      $('prop-kline-sell-marker-color').value = style.sellMarkerColor || style.down || '#42685c';
    }
    if (layer.type === 'image') {
      $('prop-image-fit').value = layer.fit === 'contain' ? 'contain' : 'cover';
      ['x', 'y'].forEach(function (axis) {
        const value = layer['focus' + axis.toUpperCase()] == null ? 50 : layer['focus' + axis.toUpperCase()];
        $('prop-image-focus-' + axis).value = String(value);
        $('prop-image-focus-' + axis + '-value').textContent = value + '%';
        $('prop-image-focus-' + axis).disabled = !!layer.locked || layer.fit === 'contain';
      });
    }
  }

  function refresh() {
    draw(); syncLayers(); syncProperties(); syncHistoryButtons();
    if (!design) return;
    $('editor-bg-color').value = design.background.color;
    $('editor-bg-fit').value = design.background.fit === 'contain' ? 'contain' : 'cover';
    $('editor-bg-fit').disabled = !design.background.image;
    ['x', 'y'].forEach(function (axis) {
      const value = design.background['focus' + axis.toUpperCase()] == null ? 50 : design.background['focus' + axis.toUpperCase()];
      $('editor-bg-focus-' + axis).value = String(value);
      $('editor-bg-focus-' + axis + '-value').textContent = value + '%';
      $('editor-bg-focus-' + axis).disabled = !design.background.image || design.background.fit === 'contain';
    });
    $('editor-autosave').checked = design.settings.autosave;
    $('editor-snap').checked = design.settings.snap;
    $('editor-guides').checked = design.settings.guides;
    $('editor-export-width').value = String(design.settings.exportWidth);
    const preset = model.presetBase(design.ratio);
    document.querySelectorAll('[data-ratio]').forEach(function (button) { button.classList.toggle('active', button.dataset.ratio === preset); });
    const landscape = design.presetOrientation === 'landscape';
    $('ratio-label-share').textContent = landscape ? '5:4' : '4:5';
    $('ratio-label-story').textContent = landscape ? '16:9' : '9:16';
    $('ratio-label-a4').textContent = landscape ? 'A4 横' : 'A4 纵';
    ['portrait', 'landscape'].forEach(function (orientation) {
      const button = $('ratio-' + orientation);
      button.disabled = !preset;
      button.classList.toggle('active', design.presetOrientation === orientation);
      button.setAttribute('aria-pressed', String(design.presetOrientation === orientation));
    });
    $('ratio-width').value = String((design.customRatio || { width: 3 }).width);
    $('ratio-height').value = String((design.customRatio || { height: 4 }).height);
    $('ratio-apply').classList.toggle('active', design.ratio === 'custom');
    const trade = design.source && design.source.trade;
    ['prices', 'days'].forEach(function (key) { $('editor-add-' + key).disabled = !trade; });
    $('editor-add-capital').disabled = !trade || trade.capital == null;
    $('editor-add-profit').disabled = !trade || trade.profit == null;
  }
  function mutate(change) { if (!design) return null; finishFontSizeEdit(); pushHistory(); change(); refresh(); return saveDraft(); }
  function undo() { finishFontSizeEdit(); if (!undoStack.length) return; remember(redoStack, JSON.stringify(design)); design = JSON.parse(undoStack.pop()); if (!selected()) selectedId = null; refresh(); saveDraft(); }
  function redo() { finishFontSizeEdit(); if (!redoStack.length) return; remember(undoStack, JSON.stringify(design)); design = JSON.parse(redoStack.pop()); if (!selected()) selectedId = null; refresh(); saveDraft(); }

  function styleSettings(hasTrade) {
    const marked = hasTrade == null ? !!(design && design.source && design.source.trade) : hasTrade;
    const finish = function (style) { return marked ? style : Object.assign({}, style, { profitMode: 'transparent', labels: false, inkMarkers: false, buyMarker: 'none', sellMarker: 'none' }); };
    const standard = {
      mode: $('kline-style').value || 'candles', up: $('kline-up').value || '#b25937', down: $('kline-down').value || '#42685c', surface: $('kline-surface').value || 'transparent', labels: $('kline-labels').checked,
      strokeWidth: Number($('kline-stroke-width').value) || 1, candleWidth: Number($('kline-candle-width').value) || 0.55,
      profitMode: $('kline-profit-mode').value || 'transparent', profitColor: $('kline-profit-color').value || '#c3483b',
      buyMarker: $('kline-buy-marker').value || 'dot', sellMarker: $('kline-sell-marker').value || 'dot', markerSize: Number($('kline-marker-size').value) || 8,
      buyMarkerColor: $('kline-buy-marker-color').value || '#b25937', sellMarkerColor: $('kline-sell-marker-color').value || '#42685c',
      buyMarkerImage: markerImages.BUY, sellMarkerImage: markerImages.SELL
    };
    if ($('kline-stylized-panel').hidden) return finish(standard);
    if (inkVariant === 'ink2') return finish(Object.assign({}, standard, {
      renderer: 'ink2', mode: 'line', up: '#181614', down: '#181614', surface: 'transparent', profitMode: 'transparent',
      strokeWidth: Number($('ink2-stroke-width').value) || 1, inkDryness: Number($('ink2-dryness').value) || 1.5,
      inkGhost: $('ink2-ghost').checked, inkMarkers: $('ink2-markers').checked,
      buyMarker: $('ink-buy-marker').value || 'ink-stamp', sellMarker: $('ink-sell-marker').value || 'ink-brush', markerSize: Number($('ink-marker-size').value) || 12,
      buyMarkerColor: $('ink-buy-marker-color').value || '#a33d2f', sellMarkerColor: $('ink-sell-marker-color').value || '#a33d2f',
      buyMarkerImage: markerImages.BUY, sellMarkerImage: markerImages.SELL, labels: $('ink-labels').checked
    }));
    return finish(Object.assign({}, standard, {
      renderer: 'ink', mode: 'candles', up: '#ffffff', down: '#181614', surface: 'transparent',
      strokeWidth: Number($('ink-stroke-width').value) || 1.5, inkBleed: Number($('ink-bleed').value) || 1.5, profitMode: 'transparent',
      buyMarker: $('ink-buy-marker').value || 'ink-stamp', sellMarker: $('ink-sell-marker').value || 'ink-brush', markerSize: Number($('ink-marker-size').value) || 12,
      buyMarkerColor: $('ink-buy-marker-color').value || '#a33d2f', sellMarkerColor: $('ink-sell-marker-color').value || '#a33d2f',
      buyMarkerImage: markerImages.BUY, sellMarkerImage: markerImages.SELL,
      inkLine: $('ink-line').checked, inkMarkers: $('ink-markers').checked, labels: $('ink-labels').checked
    }));
  }

  function syncTradeStyleControls(hasTrade) {
    ['kline-labels', 'kline-profit-mode', 'kline-profit-color', 'kline-buy-marker', 'kline-sell-marker', 'kline-marker-size', 'kline-buy-marker-color', 'kline-sell-marker-color', 'kline-buy-marker-image', 'kline-sell-marker-image', 'ink-markers', 'ink2-markers', 'ink-buy-marker', 'ink-sell-marker', 'ink-marker-size', 'ink-buy-marker-color', 'ink-sell-marker-color', 'ink-labels', 'ink-buy-marker-image', 'ink-sell-marker-image', 'open-classic'].forEach(function (id) { $(id).disabled = !hasTrade; });
    $('kline-crop-trade-option').disabled = !hasTrade;
    $('kline-crop-hint').textContent = hasTrade ? '自定义范围须包含所有买卖节点；未平仓持仓按截取末尾的 K 线收盘价估值。' : '未标记买卖点时默认使用完整已加载区间；也可自定义截取范围。';
  }

  function cropSettings() {
    return { mode: $('kline-crop').value || 'trade', start: $('kline-crop-start').value, end: $('kline-crop-end').value };
  }

  function syncCropControls() {
    if (!$('kline-crop').value) $('kline-crop').value = 'trade';
    const data = ns.currentData;
    if (data && data.bars && data.bars.length) {
      const first = data.bars[0].date.slice(0, 10), last = data.bars.at(-1).date.slice(0, 10);
      ['kline-crop-start', 'kline-crop-end'].forEach(function (id) { $(id).min = first; $(id).max = last; });
      if (!$('kline-crop-start').value || $('kline-crop-start').value < first || $('kline-crop-start').value > last) $('kline-crop-start').value = first;
      if (!$('kline-crop-end').value || $('kline-crop-end').value < first || $('kline-crop-end').value > last) $('kline-crop-end').value = last;
    }
    const custom = $('kline-crop').value === 'custom';
    $('kline-crop-start-row').hidden = !custom;
    $('kline-crop-end-row').hidden = !custom;
  }

  function previewSticker(successMessage) {
    const request = ++stickerPreviewId;
    syncCropControls();
    const ink = !$('kline-stylized-panel').hidden;
    const target = $(ink ? 'ink-preview' : 'sticker-preview');
    const statusTarget = $(ink ? 'ink-style-status' : 'kline-style-status');
    let snapshot;
    try { snapshot = ns.getTradeSnapshot(cropSettings()); } catch (error) {
      target.getContext('2d').clearRect(0, 0, target.width, target.height);
      statusTarget.textContent = error.message;
      return;
    }
    if (!snapshot.trade && $('kline-crop').value === 'trade') $('kline-crop').value = 'range';
    syncTradeStyleControls(!!snapshot.trade);
    const layer = model.makeLayer('kline', { w: 600, h: 330, bars: snapshot.bars, trade: snapshot.trade, style: styleSettings(!!snapshot.trade) });
    renderer.prepare({ background: {}, layers: [layer] }).then(function () {
      if (request !== stickerPreviewId) return;
      const ctx = target.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.save(); ctx.translate(300, 165); renderer.drawKline(ctx, layer); ctx.restore();
      statusTarget.textContent = typeof successMessage === 'string' ? successMessage : ink && inkVariant === 'ink2' ? '水墨风 2 · 透明 2D 笔刷 v3 已启用。' : 'K 线贴图预览已更新。';
    }).catch(function (error) { if (request === stickerPreviewId) statusTarget.textContent = error.message; });
  }

  function setKlineEditorMode(mode) {
    const stylized = mode === 'stylized';
    $('kline-standard-panel').hidden = stylized;
    $('kline-stylized-panel').hidden = !stylized;
    $('kline-standard-tab').classList.toggle('active', !stylized);
    $('kline-stylized-tab').classList.toggle('active', stylized);
    $('kline-standard-tab').setAttribute('aria-pressed', String(!stylized));
    $('kline-stylized-tab').setAttribute('aria-pressed', String(stylized));
    if (!$('style-section').hidden && ns.currentData) previewSticker();
  }
  function setInkVariant(mode) {
    inkVariant = mode === 'ink2' ? 'ink2' : 'ink';
    const second = inkVariant === 'ink2';
    $('ink-one-tab').classList.toggle('active', !second);
    $('ink-two-tab').classList.toggle('active', second);
    $('ink-one-tab').setAttribute('aria-pressed', String(!second));
    $('ink-two-tab').setAttribute('aria-pressed', String(second));
    $('ink-one-controls').hidden = second;
    $('ink-two-controls').hidden = !second;
    $('ink-style-title').textContent = second ? '水墨风 2 · 苍劲折线' : '水墨风 1 · 蜡烛图';
    $('ink-style-description').textContent = second
      ? '真实收盘价连成清晰墨线：轻微压感、沿线飞白，可叠加浅墨副线。贴图透明，不绘制蜡烛柱。'
      : '收盘轨迹线采用细线飞白笔触，并沿线轻微晕染；涨白跌黑的蜡烛也有墨色渗开效果。贴图保持透明，背景墨点可作为独立图层添加。';
    $('ink-preview').setAttribute('aria-label', second ? '水墨风 2 预览' : '水墨风 1 预览');
    if (!$('style-section').hidden && ns.currentData && !$('kline-stylized-panel').hidden) previewSticker();
  }
  setKlineEditorMode('standard');
  setInkVariant('ink');

  function sameArtworkSource(previous, current) {
    if (!previous || !previous.security || !current || !current.security) return false;
    if (previous.identity && current.identity) return previous.identity === current.identity;
    if (previous.security.secid || current.security.secid) return previous.security.secid === current.security.secid;
    return previous.security.source === current.security.source &&
      previous.security.symbol === current.security.symbol && previous.security.name === current.security.name;
  }

  function openFromTrade() {
    stateRevision++;
    syncCropControls();
    let snapshot;
    try { snapshot = ns.getTradeSnapshot(cropSettings()); } catch (error) { status(error.message); return; }
    syncTradeStyleControls(!!snapshot.trade);
    const style = styleSettings(!!snapshot.trade);
    const styleStatus = ['ink', 'ink2'].includes(style.renderer) ? $('ink-style-status') : $('kline-style-status');
    if (snapshot.trade && ((style.buyMarker === 'image' && !style.buyMarkerImage) || (style.sellMarker === 'image' && !style.sellMarkerImage))) { styleStatus.textContent = '请先上传所选的自定义 BUY / SELL 标点图片。'; return; }
    styleStatus.textContent = '';
    finishFontSizeEdit();
    if (!design || !sameArtworkSource(design.source, snapshot) || !!design.source.trade !== !!snapshot.trade) {
      let next;
      try { next = model.createDesign(snapshot, style); } catch (error) { status(error.message); return; }
      if (design) pushHistory();
      design = next;
      selectedId = null;
    } else {
      pushHistory();
      design.source = model.clone(snapshot);
      const updatedText = boundText(snapshot);
      design.layers.forEach(function (item) {
        if (item.type !== 'text') return;
        const binding = item.binding === undefined ? LEGACY_BINDINGS[item.name] : item.binding;
        if (Object.prototype.hasOwnProperty.call(updatedText, binding)) { item.binding = binding; item.text = updatedText[binding]; }
      });
      const klines = design.layers.filter(function (item) { return item.type === 'kline'; });
      if (klines.length) {
        klines.forEach(function (layer) { layer.bars = model.clone(snapshot.bars); layer.trade = model.clone(snapshot.trade); });
        klines[0].style = model.clone(style);
        selectedId = klines[0].id;
      }
      else { const next = model.makeLayer('kline', { bars: model.clone(snapshot.bars), trade: model.clone(snapshot.trade), style: model.clone(style) }); design.layers.push(next); selectedId = next.id; }
    }
    $('editor-section').hidden = false;
    refresh(); saveDraft();
    $('editor-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setRatio(ratio, customRatio) {
    if (!design || (design.ratio === ratio && (ratio !== 'custom' || design.customRatio && design.customRatio.width === customRatio.width && design.customRatio.height === customRatio.height))) return;
    let next;
    try { next = model.setRatio(design, ratio, customRatio); }
    catch (error) { $('ratio-status').textContent = error.message; return; }
    mutate(function () { design = next; });
    $('ratio-status').textContent = ratio === 'custom' ? '已应用自定义比例 ' + next.customRatio.width + ':' + next.customRatio.height + '。' : '已切换画布比例。';
  }

  function setOrientation(orientation) {
    if (!design || !model.presetBase(design.ratio) || design.presetOrientation === orientation) return;
    let next;
    try { next = model.setOrientation(design, orientation); }
    catch (error) { $('ratio-status').textContent = error.message; return; }
    mutate(function () { design = next; });
    $('ratio-status').textContent = orientation === 'landscape' ? '已切换为横向画布。' : '已切换为纵向画布。';
  }

  function addLayer(type, extra) {
    if (!design) return;
    if (design.layers.length >= 100) { status('图层已达到 100 个上限。'); return; }
    mutate(function () { const layer = model.makeLayer(type, extra); design.layers.push(layer); selectedId = layer.id; });
    openMobileProperties();
  }

  function openMobileProperties() {
    if (ns.MobileUI && ns.MobileUI.isMobile()) ns.MobileUI.showPanel('layers', true);
  }

  stickers.presets.forEach(function (preset) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', '添加' + preset.name);
    const thumbnail = document.createElement('img');
    thumbnail.src = stickers.preview(preset.id);
    thumbnail.alt = '';
    const label = document.createElement('span');
    label.textContent = preset.name;
    button.append(thumbnail, label);
    button.addEventListener('click', async function () {
      const targetDesign = design;
      if (!targetDesign) return;
      button.disabled = true;
      try {
        const sticker = await stickers.create(preset.id);
        if (design !== targetDesign) return;
        const offset = (design.layers.filter(function (layer) { return layer.type === 'image'; }).length % 4) * 22;
        const layerOptions = {
          name: sticker.name, src: sticker.src, fit: 'contain', w: sticker.w, h: sticker.h,
          x: Math.round((design.width - sticker.w) / 2 + offset),
          y: Math.round((design.height - sticker.h) / 2 + offset)
        };
        if (preset.behindKline) {
          if (design.layers.length >= 100) { status('图层已达到 100 个上限。'); return; }
          mutate(function () {
            const layer = model.makeLayer('image', layerOptions);
            design.layers.unshift(layer);
            selectedId = layer.id;
          });
          openMobileProperties();
        } else addLayer('image', layerOptions);
      } catch (error) { if (design === targetDesign) status(error.message); }
      finally { button.disabled = false; }
    });
    $('editor-sticker-presets').appendChild(button);
  });

  function addTradeLayer(binding, name) {
    if (!design || !design.source || !design.source.trade) return;
    const value = tradeText(design.source)[name];
    if (!value) { status('请先在交易步骤填写投入金额。'); return; }
    addLayer('text', { name: name, binding: binding, text: value, x: 80, y: Math.round(design.height * 0.72), w: 840, h: 70, fontSize: name === '买卖价格' ? 46 : 32, font: name === '持仓天数' ? 'sans' : 'serif' });
  }

  function moveLayer(delta) {
    const layer = selected(); if (!layer || layer.locked) return;
    const index = design.layers.indexOf(layer), next = index + delta;
    if (next < 0 || next >= design.layers.length) return;
    mutate(function () { design.layers[index] = design.layers[next]; design.layers[next] = layer; });
  }

  function alignLayer(side) {
    const layer = selected();
    if (!layer || layer.locked) return;
    mutate(function () {
      const angle = (layer.rotation || 0) * Math.PI / 180;
      const halfWidth = (Math.abs(Math.cos(angle)) * layer.w + Math.abs(Math.sin(angle)) * layer.h) / 2;
      const halfHeight = (Math.abs(Math.sin(angle)) * layer.w + Math.abs(Math.cos(angle)) * layer.h) / 2;
      if (side === 'left') layer.x = Math.round(halfWidth - layer.w / 2);
      if (side === 'center') layer.x = Math.round((design.width - layer.w) / 2);
      if (side === 'right') layer.x = Math.round(design.width - halfWidth - layer.w / 2);
      if (side === 'top') layer.y = Math.round(halfHeight - layer.h / 2);
      if (side === 'middle') layer.y = Math.round((design.height - layer.h) / 2);
      if (side === 'bottom') layer.y = Math.round(design.height - halfHeight - layer.h / 2);
    });
  }

  function duplicate() {
    const layer = selected(); if (!layer || layer.locked) return;
    const copy = model.clone(layer);
    copy.id = model.makeLayer(layer.type).id;
    copy.name += ' 副本'; copy.x += 24; copy.y += 24;
    addLayer(layer.type, copy);
  }

  function remove() {
    if (!selected() || selected().locked) return;
    mutate(function () { design.layers = design.layers.filter(function (layer) { return layer.id !== selectedId; }); selectedId = null; });
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * design.width / rect.width, y: (event.clientY - rect.top) * design.height / rect.height };
  }

  function pointerDown(event) {
    if (!design || drag) return;
    if (event.pointerType === 'touch' && ns.MobileUI && !ns.MobileUI.canDrag()) {
      if (event.isPrimary === false) { touchSelection = null; return; }
      touchSelection = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      return;
    }
    const point = canvasPoint(event);
    const touchRadius = event.pointerType === 'touch' ? Math.max(17, 22 * design.width / Math.max(1, canvas.getBoundingClientRect().width)) : 17;
    const hit = renderer.hitTest(design, point.x, point.y, selectedId, touchRadius);
    selectedId = hit ? hit.id : null;
    refresh();
    if (!hit) return;
    const layer = selected();
    drag = { pointerId: event.pointerId, action: hit.action, corner: hit.corner, x: point.x, y: point.y, start: { x: layer.x, y: layer.y, w: layer.w, h: layer.h, rotation: layer.rotation }, moved: false };
    canvas.setPointerCapture(event.pointerId);
  }

  function pointerMove(event) {
    if (touchSelection && touchSelection.pointerId === event.pointerId) {
      if (Math.hypot(event.clientX - touchSelection.x, event.clientY - touchSelection.y) > 8) touchSelection = null;
      return;
    }
    if (!drag || drag.pointerId !== event.pointerId || !selected()) return;
    const point = canvasPoint(event), dx = point.x - drag.x, dy = point.y - drag.y;
    if (Math.abs(dx) + Math.abs(dy) < 1) return;
    if (!drag.moved) { pushHistory(); drag.moved = true; }
    const layer = selected();
    const snap = function (value) { return design.settings.snap ? Math.round(value / 10) * 10 : Math.round(value); };
    if (drag.action === 'resize') Object.assign(layer, model.resizeFromCorner(drag.start, dx, dy, drag.corner, snap));
    else { layer.x = snap(drag.start.x + dx); layer.y = snap(drag.start.y + dy); }
    draw();
  }

  function pointerUp(event) {
    if (touchSelection && touchSelection.pointerId === event.pointerId) {
      const tap = touchSelection;
      touchSelection = null;
      if (!design || Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8) return;
      const point = canvasPoint(event), hit = renderer.hitTest(design, point.x, point.y, null);
      selectedId = hit ? hit.id : null;
      refresh();
      if (hit) openMobileProperties();
      return;
    }
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (drag.moved) { syncProperties(); syncHistoryButtons(); saveDraft(); }
    drag = null;
  }

  function bindProperty(id, apply) {
    $(id).addEventListener('change', function () {
      if (!selected() || selected().locked) return;
      mutate(function () { apply(selected(), $(id).value); });
    });
  }

  function readImage(file) {
    if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return Promise.reject(new Error('请选择 PNG、JPEG 或 WebP 图片。'));
    if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error('图片请小于 5 MB。'));
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        const src = reader.result;
        if (typeof src !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(src)) { reject(new Error('图片文件格式不受支持。')); return; }
        const image = new root.Image();
        image.onload = function () { image.width && image.height ? resolve(src) : reject(new Error('图片文件无法解码。')); };
        image.onerror = function () { reject(new Error('图片文件无法解码。')); };
        image.src = src;
      };
      reader.onerror = function () { reject(new Error('无法读取本地图片。')); };
      reader.readAsDataURL(file);
    });
  }

  function readFont(file) {
    const extension = file && /\.(ttf|otf|woff|woff2)$/i.exec(file.name || '');
    if (!extension) return Promise.reject(new Error('请选择 TTF、OTF、WOFF 或 WOFF2 字体。'));
    if (file.size > ns.EditorFonts.maxFileBytes) return Promise.reject(new Error('字体文件请小于 20 MB。'));
    if (!file.size) return Promise.reject(new Error('字体文件为空。'));
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        const match = /^data:[^;,]*;base64,([A-Za-z0-9+/]+={0,2})$/.exec(reader.result || '');
        if (!match) { reject(new Error('字体文件格式不受支持。')); return; }
        resolve({ src: 'data:font/' + extension[1].toLowerCase() + ';base64,' + match[1], name: String(file.name).slice(0, 100) });
      };
      reader.onerror = function () { reject(new Error('无法读取本地字体。')); };
      reader.readAsDataURL(file);
    });
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }

  async function exportPng() {
    if (!design) return;
    const button = $('editor-export'); button.disabled = true; status('正在绘制高清作品…');
    try {
      const artwork = model.clone(design);
      let width = Number(artwork.settings.exportWidth) || 1920;
      let height;
      if (artwork.ratio === 'custom') height = Math.round(width * artwork.customRatio.height / artwork.customRatio.width);
      else if (artwork.ratio === 'A4' && width === 2480) height = 3508;
      else if (artwork.ratio === 'A4-landscape' && width === 2480) { width = 3508; height = 2480; }
      else if (artwork.ratio === 'A4') height = Math.round(width * 297 / 210);
      else if (artwork.ratio === 'A4-landscape') height = Math.round(width * 210 / 297);
      else if (artwork.ratio === '9:16') height = Math.round(width * 16 / 9);
      else if (artwork.ratio === '16:9') height = Math.round(width * 9 / 16);
      else height = Math.round(width * artwork.height / artwork.width);
      const output = document.createElement('canvas');
      await renderer.render(output, artwork, width, height, null, false);
      const blob = await new Promise(function (resolve, reject) { output.toBlob(function (value) { value ? resolve(value) : reject(new Error('PNG 生成失败。')); }, 'image/png'); });
      download(blob, 'YINK-artwork-' + artwork.ratio.replace(':', 'x') + '.png');
      if (ns.recordGeneration) ns.recordGeneration(output, artwork, 'editor');
      status('已生成 ' + width + ' × ' + height + ' PNG。');
    } catch (error) { status(error.message); }
    finally { button.disabled = false; }
  }

  function saveProject() {
    if (!design) return;
    try {
      const blob = new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' });
      if (blob.size > 100 * 1024 * 1024) throw new Error('项目超过 100 MB，请减少图片贴图后重试。');
      download(blob, 'YINK-project.json'); status('项目 JSON 已保存到本地。');
    }
    catch (error) { status('项目保存失败：' + error.message); }
  }

  async function openProject(file) {
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { status('项目文件请小于 100 MB。'); $('project-entry-status').textContent = '项目文件请小于 100 MB。'; return; }
    const request = ++stateRevision;
    try {
      const loaded = model.validateDesign(JSON.parse(await file.text()));
      await renderer.prepare(loaded);
      if (request !== stateRevision) return;
      finishFontSizeEdit();
      undoStack = [];
      if (design) remember(undoStack, JSON.stringify(design));
      design = loaded; selectedId = null; redoStack = [];
      $('editor-section').hidden = false;
      refresh();
      const saved = saveDraft();
      if (saved !== false) status('项目已从本地文件打开。');
      $('project-entry-status').textContent = saved === false ? '项目已打开，但草稿无法自动保存；请使用“保存项目”。' : '项目已打开。';
      $('editor-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) { if (request === stateRevision) { status(error.message); $('project-entry-status').textContent = error.message; } }
  }

  async function restoreDraft() {
    let saved;
    try { saved = JSON.parse(root.localStorage.getItem(KEY) || 'null'); } catch (_) { return; }
    if (!saved) return;
    const request = stateRevision;
    try {
      const loaded = model.validateDesign(saved);
      await renderer.prepare(loaded);
      if (request !== stateRevision || design) return;
      design = loaded; $('editor-section').hidden = false; refresh();
      status(ns.currentData && !sameArtworkSource(loaded.source, ns.currentData)
        ? '已恢复上次编辑的作品；它与当前行情不同。生成新 K 线贴图会新建画布。'
        : '已恢复上次编辑的作品。');
    } catch (error) {
      if (request !== stateRevision) return;
      try { root.localStorage.removeItem(KEY); } catch (_) { /* unavailable */ }
      $('project-entry-status').textContent = '上次草稿无法恢复：' + error.message;
    }
  }

  ns.showStyleStep = previewSticker;
  ns.onArtworkDataLoaded = function (data) {
    if (design && !sameArtworkSource(design.source, data)) status('已加载新数据。当前画布仍是上一作品；生成新 K 线贴图后会新建画布，可用撤销返回。');
  };
  $('kline-standard-tab').addEventListener('click', function () { setKlineEditorMode('standard'); });
  $('kline-stylized-tab').addEventListener('click', function () { setKlineEditorMode('stylized'); });
  $('ink-one-tab').addEventListener('click', function () { setInkVariant('ink'); });
  $('ink-two-tab').addEventListener('click', function () { setInkVariant('ink2'); });
  ['kline-style', 'kline-up', 'kline-down', 'kline-surface', 'kline-labels', 'kline-stroke-width', 'kline-candle-width', 'kline-profit-mode', 'kline-profit-color', 'kline-buy-marker', 'kline-sell-marker', 'kline-marker-size', 'kline-buy-marker-color', 'kline-sell-marker-color'].forEach(function (id) { $(id).addEventListener('input', previewSticker); });
  ['ink-stroke-width', 'ink-bleed', 'ink-line', 'ink-markers', 'ink-buy-marker', 'ink-sell-marker', 'ink-marker-size', 'ink-buy-marker-color', 'ink-sell-marker-color', 'ink-labels'].forEach(function (id) { $(id).addEventListener('change', previewSticker); });
  ['ink2-stroke-width', 'ink2-dryness', 'ink2-ghost', 'ink2-markers'].forEach(function (id) { $(id).addEventListener('change', previewSticker); });
  ['kline-crop', 'kline-crop-start', 'kline-crop-end'].forEach(function (id) { $(id).addEventListener('change', previewSticker); });
  [['BUY', 'kline-buy-marker-image', 'kline-buy-marker', 'kline-style-status'], ['SELL', 'kline-sell-marker-image', 'kline-sell-marker', 'kline-style-status'], ['BUY', 'ink-buy-marker-image', 'ink-buy-marker', 'ink-style-status'], ['SELL', 'ink-sell-marker-image', 'ink-sell-marker', 'ink-style-status']].forEach(function (entry) {
    $(entry[1]).addEventListener('change', async function () {
      try {
        markerImages[entry[0]] = await readImage(this.files[0]);
        $(entry[2]).value = 'image';
        $(entry[3]).textContent = entry[0] + ' 标点图片已读取。';
        previewSticker(entry[0] + ' 标点图片已读取。');
      } catch (error) { $(entry[3]).textContent = error.message; }
      finally { this.value = ''; }
    });
  });
  $('open-editor').addEventListener('click', openFromTrade);
  document.querySelectorAll('[data-ratio]').forEach(function (button) { button.addEventListener('click', function () { setRatio(model.presetRatio(button.dataset.ratio, design && design.presetOrientation || 'portrait')); }); });
  ['portrait', 'landscape'].forEach(function (orientation) { $('ratio-' + orientation).addEventListener('click', function () { setOrientation(orientation); }); });
  $('ratio-apply').addEventListener('click', function () { setRatio('custom', { width: Number($('ratio-width').value), height: Number($('ratio-height').value) }); });
  document.querySelectorAll('[data-bg]').forEach(function (button) { button.addEventListener('click', function () { mutate(function () { design.background.color = button.dataset.bg; }); }); });
  $('editor-bg-color').addEventListener('change', function () { mutate(function () { design.background.color = $('editor-bg-color').value; }); });
  $('editor-bg-fit').addEventListener('change', function () { mutate(function () { design.background.fit = $('editor-bg-fit').value === 'contain' ? 'contain' : 'cover'; }); });
  ['x', 'y'].forEach(function (axis) {
    $('editor-bg-focus-' + axis).addEventListener('change', function () {
      if (!design || !design.background.image || design.background.fit === 'contain') return;
      mutate(function () { design.background['focus' + axis.toUpperCase()] = Math.max(0, Math.min(100, Number($('editor-bg-focus-' + axis).value) || 0)); });
    });
  });
  $('editor-clear-bg').addEventListener('click', function () { mutate(function () { design.background.image = null; }); });
  $('editor-bg-image').addEventListener('change', async function () { const target = design; try { const src = await readImage(this.files[0]); if (design === target) mutate(function () { design.background.image = src; }); } catch (error) { if (design === target) status(error.message); } finally { this.value = ''; } });
  $('editor-add-image').addEventListener('change', async function () { const target = design; try { const src = await readImage(this.files[0]); if (design === target) addLayer('image', { src: src }); } catch (error) { if (design === target) status(error.message); } finally { this.value = ''; } });
  $('prop-image-replace').addEventListener('change', async function () {
    const target = selected();
    try {
      if (!target || target.type !== 'image' || target.locked) return;
      const src = await readImage(this.files[0]);
      if (!design || !design.layers.includes(target) || target.locked) return;
      const saved = mutate(function () { target.src = src; });
      if (saved !== false) status('图片贴图已替换。');
    } catch (error) { if (design && design.layers.includes(target)) status(error.message); }
    finally { this.value = ''; }
  });
  $('prop-font-upload').addEventListener('change', async function () {
    const targetDesign = design, target = selected();
    try {
      if (!target || target.type !== 'text' || target.locked) return;
      const font = await readFont(this.files[0]);
      const candidate = Object.assign({}, target, { font: 'custom', fontData: font.src, fontName: font.name });
      await ns.EditorFonts.prepareLayer(candidate);
      if (design !== targetDesign || !design.layers.includes(target) || target.locked) return;
      const saved = mutate(function () { target.font = 'custom'; target.fontData = font.src; target.fontName = font.name; });
      status(saved === false ? '字体已应用；浏览器草稿空间不足，请点击“保存项目”下载 JSON。' : '自定义字体已应用，并会保存在项目文件中。');
    } catch (error) { if (design === targetDesign && target && design.layers.includes(target)) status(error.message); }
    finally { this.value = ''; }
  });
  [['BUY', 'prop-kline-buy-image', 'buyMarkerImage', 'buyMarker'], ['SELL', 'prop-kline-sell-image', 'sellMarkerImage', 'sellMarker'], ['BUY', 'prop-ink-buy-image', 'buyMarkerImage', 'buyMarker'], ['SELL', 'prop-ink-sell-image', 'sellMarkerImage', 'sellMarker']].forEach(function (entry) {
    $(entry[1]).addEventListener('change', async function () {
      const target = selected();
      try {
        if (!target || target.type !== 'kline' || target.locked) return;
        const src = await readImage(this.files[0]);
        if (!design || !design.layers.includes(target) || target.locked) return;
        const saved = mutate(function () { target.style = target.style || {}; target.style[entry[2]] = src; target.style[entry[3]] = 'image'; });
        if (saved !== false) status(entry[0] + ' 标点图片已替换。');
      } catch (error) { if (design && design.layers.includes(target)) status(error.message); }
      finally { this.value = ''; }
    });
  });
  $('editor-add-text').addEventListener('click', function () { addLayer('text'); });
  [['prices', '买卖价格'], ['days', '持仓天数'], ['capital', '投入金额'], ['profit', '盈亏金额']].forEach(function (entry) { $('editor-add-' + entry[0]).addEventListener('click', function () { addTradeLayer(entry[0], entry[1]); }); });
  $('editor-add-rect').addEventListener('click', function () { addLayer('rect'); });
  $('editor-add-circle').addEventListener('click', function () { addLayer('circle'); });
  $('editor-add-kline').addEventListener('click', function () {
    if (!design || !design.source) return;
    const reference = selected() && selected().type === 'kline' ? selected() : design.layers.find(function (layer) { return layer.type === 'kline'; });
    addLayer('kline', { bars: model.clone(design.source.bars), trade: model.clone(design.source.trade), style: reference ? model.clone(reference.style) : styleSettings() });
  });
  $('layer-up').addEventListener('click', function () { moveLayer(1); });
  $('layer-down').addEventListener('click', function () { moveLayer(-1); });
  $('layer-duplicate').addEventListener('click', duplicate);
  $('layer-delete').addEventListener('click', remove);
  ['left', 'center', 'right', 'top', 'middle', 'bottom'].forEach(function (side) { $('align-' + side).addEventListener('click', function () { alignLayer(side); }); });
  $('editor-undo').addEventListener('click', undo);
  $('editor-redo').addEventListener('click', redo);
  $('editor-autosave').addEventListener('change', function () { if (!design) return; design.settings.autosave = this.checked; if (this.checked) saveDraft(); else { try { root.localStorage.removeItem(KEY); } catch (_) { /* unavailable */ } status('自动保存已关闭；请用“保存项目”保留修改。'); } });
  $('editor-snap').addEventListener('change', function () { if (design) { design.settings.snap = this.checked; saveDraft(); } });
  $('editor-guides').addEventListener('change', function () { if (design) { design.settings.guides = this.checked; draw(); saveDraft(); } });
  $('editor-export-width').addEventListener('change', function () { if (design) { design.settings.exportWidth = Number(this.value); saveDraft(); } });
  $('editor-zoom').addEventListener('change', function () { viewZoom = Number(this.value) || 1; draw(); });
  $('editor-export').addEventListener('click', exportPng);
  $('editor-save-project').addEventListener('click', saveProject);
  $('editor-open-project').addEventListener('change', async function () { await openProject(this.files[0]); this.value = ''; });
  $('open-project-entry').addEventListener('change', async function () { await openProject(this.files[0]); this.value = ''; });
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', function (event) { touchSelection = null; pointerUp(event); });
  if (root.ResizeObserver) new root.ResizeObserver(function () { if (design && Math.abs($('editor-workspace').getBoundingClientRect().width - lastWorkspaceWidth) >= 1) draw(); }).observe($('editor-workspace'));
  else root.addEventListener('resize', function () { if (design) draw(); });
  bindProperty('prop-name', function (layer, value) { layer.name = value.slice(0, 40) || layer.type; });
  ['x', 'y', 'w', 'h'].forEach(function (key) { bindProperty('prop-' + key, function (layer, value) { const number = Number(value); if (Number.isFinite(number)) layer[key] = key === 'w' || key === 'h' ? Math.max(20, number) : number; }); });
  bindProperty('prop-rotation', function (layer, value) { layer.rotation = Number(value); });
  bindProperty('prop-opacity', function (layer, value) { layer.opacity = Number(value) / 100; });
  bindProperty('prop-color', function (layer, value) { layer.color = value; });
  bindProperty('prop-text', function (layer, value) { layer.text = value.slice(0, 500); });
  bindProperty('prop-binding', function (layer, value) {
    if (layer.type !== 'text' || !design.source) return;
    layer.binding = Object.values(LEGACY_BINDINGS).includes(value) ? value : '';
    if (layer.binding) layer.text = boundText(design.source)[layer.binding];
  });
  $('prop-font-size').addEventListener('input', function () {
    const layer = selected();
    if (!layer || layer.type !== 'text' || layer.locked) return;
    const size = fontSizeValue(this.value, layer.fontSize || 32);
    if (size !== layer.fontSize) {
      if (fontSizeEditId !== layer.id) { finishFontSizeEdit(); pushHistory(); fontSizeEditId = layer.id; }
      layer.fontSize = size;
      draw();
    }
    syncFontSizeControls(size);
  });
  $('prop-font-size').addEventListener('change', function () {
    const layer = selected();
    if (!layer || layer.type !== 'text' || layer.locked) { finishFontSizeEdit(); return; }
    const size = fontSizeValue(this.value, layer.fontSize || 32);
    if (fontSizeEditId === layer.id) { finishFontSizeEdit(); syncFontSizeControls(size); return; }
    if (size !== layer.fontSize) mutate(function () { layer.fontSize = size; });
    else syncFontSizeControls(size);
  });
  $('prop-font-size-number').addEventListener('change', function () {
    const layer = selected();
    if (!layer || layer.type !== 'text' || layer.locked) return;
    const size = fontSizeValue(this.value, layer.fontSize || 32);
    if (size !== layer.fontSize) mutate(function () { layer.fontSize = size; });
    else syncFontSizeControls(size);
  });
  $('prop-font').addEventListener('change', async function () {
    const layer = selected();
    if (!layer || layer.type !== 'text' || layer.locked) return;
    const targetDesign = design, previous = layer.font || 'serif';
    const value = this.value;
    if (value === 'custom' && !layer.fontData) { this.value = layer.font || 'serif'; status('请先上传自定义字体文件。'); return; }
    if (value !== 'custom' && value !== 'serif' && value !== 'sans' && !ns.EditorFonts.presets[value]) { this.value = layer.font || 'serif'; return; }
    try {
      await ns.EditorFonts.prepareLayer(Object.assign({}, layer, { font: value }));
      if (design !== targetDesign || !design.layers.includes(layer) || layer.locked) return;
      mutate(function () { layer.font = value; if (value !== 'custom') { delete layer.fontData; delete layer.fontName; } });
    } catch (error) { this.value = previous; if (design === targetDesign) status(error.message); }
  });
  bindProperty('prop-align', function (layer, value) { layer.align = value; });
  bindProperty('prop-text-fit', function (layer, value) { layer.textFit = value === 'fixed' ? 'fixed' : 'auto'; });
  bindProperty('prop-image-fit', function (layer, value) { if (layer.type === 'image') layer.fit = value === 'contain' ? 'contain' : 'cover'; });
  ['x', 'y'].forEach(function (axis) {
    bindProperty('prop-image-focus-' + axis, function (layer, value) {
      if (layer.type === 'image' && layer.fit !== 'contain') layer['focus' + axis.toUpperCase()] = Math.max(0, Math.min(100, Number(value) || 0));
    });
  });
  ['mode', 'up', 'down', 'surface'].forEach(function (key) {
    bindProperty('prop-kline-' + key, function (layer, value) { if (layer.type === 'kline') { layer.style = layer.style || {}; layer.style[key] = value; } });
  });
  bindProperty('prop-ink-stroke-width', function (layer, value) {
    if (layer.type === 'kline' && layer.style && ['ink', 'ink2'].includes(layer.style.renderer)) layer.style.strokeWidth = Number(value);
  });
  bindProperty('prop-ink-bleed', function (layer, value) {
    if (layer.type === 'kline' && layer.style && layer.style.renderer === 'ink') layer.style.inkBleed = Number(value);
  });
  bindProperty('prop-ink2-dryness', function (layer, value) {
    if (layer.type === 'kline' && layer.style && layer.style.renderer === 'ink2') layer.style.inkDryness = Number(value);
  });
  $('prop-ink2-ghost').addEventListener('change', function () {
    const layer = selected();
    if (!layer || layer.locked || layer.type !== 'kline' || !layer.style || layer.style.renderer !== 'ink2') return;
    mutate(function () { layer.style.inkGhost = $('prop-ink2-ghost').checked; });
  });
  [['prop-ink-line', 'inkLine'], ['prop-ink-markers', 'inkMarkers']].forEach(function (entry) {
    $(entry[0]).addEventListener('change', function () {
      const layer = selected();
      if (!layer || layer.type !== 'kline' || !layer.style || !['ink', 'ink2'].includes(layer.style.renderer) || layer.locked) return;
      if (entry[1] === 'inkLine' && layer.style.renderer !== 'ink') return;
      mutate(function () { layer.style[entry[1]] = $(entry[0]).checked; });
    });
  });
  [['prop-ink-marker-size', 'markerSize'], ['prop-ink-buy-marker-color', 'buyMarkerColor'], ['prop-ink-sell-marker-color', 'sellMarkerColor']].forEach(function (entry) {
    bindProperty(entry[0], function (layer, value) {
      if (layer.type !== 'kline' || !layer.style || !['ink', 'ink2'].includes(layer.style.renderer)) return;
      layer.style[entry[1]] = entry[1] === 'markerSize' ? Number(value) : value;
    });
  });
  [['prop-ink-buy-marker', 'buyMarker', 'buyMarkerImage'], ['prop-ink-sell-marker', 'sellMarker', 'sellMarkerImage']].forEach(function (entry) {
    $(entry[0]).addEventListener('change', function () {
      const layer = selected();
      if (!layer || layer.locked || layer.type !== 'kline' || !layer.style || !['ink', 'ink2'].includes(layer.style.renderer)) return;
      if (this.value === 'image' && !layer.style[entry[2]]) {
        this.value = layer.style[entry[1]];
        status('请先上传该标点的自定义图片。');
        return;
      }
      mutate(function () { layer.style[entry[1]] = $(entry[0]).value; });
    });
  });
  $('prop-ink-labels').addEventListener('change', function () {
    const layer = selected();
    if (!layer || layer.locked || layer.type !== 'kline' || !layer.style || !['ink', 'ink2'].includes(layer.style.renderer)) return;
    mutate(function () { layer.style.labels = $('prop-ink-labels').checked; });
  });
  [['strokeWidth', 'stroke-width'], ['candleWidth', 'candle-width'], ['profitMode', 'profit-mode'], ['profitColor', 'profit-color'], ['markerSize', 'marker-size'], ['buyMarkerColor', 'buy-marker-color'], ['sellMarkerColor', 'sell-marker-color']].forEach(function (entry) {
    bindProperty('prop-kline-' + entry[1], function (layer, value) {
      if (layer.type !== 'kline') return;
      layer.style = layer.style || {};
      layer.style[entry[0]] = ['strokeWidth', 'candleWidth', 'markerSize'].includes(entry[0]) ? Number(value) : value;
    });
  });
  [['buyMarker', 'buy-marker', 'buyMarkerImage'], ['sellMarker', 'sell-marker', 'sellMarkerImage']].forEach(function (entry) {
    $('prop-kline-' + entry[1]).addEventListener('change', function () {
      const layer = selected();
      if (!layer || layer.locked || layer.type !== 'kline') return;
      if (this.value === 'image' && !(layer.style && layer.style[entry[2]])) {
        this.value = layer.style && layer.style[entry[0]] || 'dot';
        status('请先上传该标点的自定义图片。');
        return;
      }
      mutate(function () { layer.style = layer.style || {}; layer.style[entry[0]] = $('prop-kline-' + entry[1]).value; });
    });
  });
  $('prop-kline-labels').addEventListener('change', function () {
    if (!selected() || selected().locked || selected().type !== 'kline') return;
    mutate(function () { selected().style = selected().style || {}; selected().style.labels = $('prop-kline-labels').checked; });
  });
  root.addEventListener('keydown', function (event) {
    if (!design || $('editor-section').hidden) return;
    const tag = event.target && event.target.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicate(); return; }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selected()) { event.preventDefault(); remove(); return; }
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[event.key] && selected() && !selected().locked) {
      event.preventDefault(); const delta = event.shiftKey ? 10 : 1;
      mutate(function () { selected().x += moves[event.key][0] * delta; selected().y += moves[event.key][1] * delta; });
    }
  });
  restoreDraft();
})(window);
