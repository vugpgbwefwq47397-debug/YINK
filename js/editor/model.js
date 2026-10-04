(function (root) {
  'use strict';
  const ns = root.YINK = root.YINK || {};
  let counter = 0;
  const HEIGHTS = { '4:5': 1250, '5:4': 800, '1:1': 1000, '9:16': 1778, '16:9': 563, A4: 1414, 'A4-landscape': 707 };
  const PRESETS = { '4:5': { portrait: '4:5', landscape: '5:4' }, '1:1': { portrait: '1:1', landscape: '1:1' }, '9:16': { portrait: '9:16', landscape: '16:9' }, A4: { portrait: 'A4', landscape: 'A4-landscape' } };
  function presetBase(ratio) { return Object.keys(PRESETS).find(function (base) { return Object.values(PRESETS[base]).includes(ratio); }) || null; }
  function presetRatio(base, orientation) { return PRESETS[base] && PRESETS[base][orientation] || null; }
  function inferredOrientation(ratio, stored) {
    if (['5:4', '16:9', 'A4-landscape'].includes(ratio)) return 'landscape';
    if (['4:5', '9:16', 'A4'].includes(ratio)) return 'portrait';
    return stored === 'landscape' ? 'landscape' : 'portrait';
  }
  function customHeight(customRatio) {
    if (!customRatio || !Number.isInteger(customRatio.width) || !Number.isInteger(customRatio.height) || customRatio.width < 1 || customRatio.width > 1000 || customRatio.height < 1 || customRatio.height > 1000) return null;
    const aspect = customRatio.width / customRatio.height;
    return aspect >= 0.25 && aspect <= 4 ? Math.round(1000 / aspect) : null;
  }
  function ratioHeight(ratio, customRatio) { return ratio === 'custom' ? customHeight(customRatio) : HEIGHTS[ratio] || null; }
  const COLOR = /^#[0-9a-f]{6}$/i;
  const DATE = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/;
  const TEXT_BINDINGS = new Set(['symbol', 'returnPct', 'dates', 'prices', 'days', 'capital', 'profit']);
  function focusValue(value) { return value == null ? 50 : value; }
  function validFocus(value) { return Number.isInteger(value) && value >= 0 && value <= 100; }
  function id() { return 'layer-' + Date.now().toString(36) + '-' + (++counter); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function validStamp(value) {
    if (!DATE.test(value || '')) return false;
    const stamp = value.length === 10 ? value + 'T00:00:00Z' : value.replace(' ', 'T') + ':00Z';
    const date = new Date(stamp);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, value.length === 10 ? 10 : 16).replace('T', ' ') === value;
  }

  function validKline(bars, trade) {
    if (!Array.isArray(bars) || bars.length < 2 || bars.length > 10000) return false;
    let previous = '', buyFound = false, sellFound = false;
    for (const bar of bars) {
      if (!bar || !validStamp(bar.date) || bar.date <= previous || ![bar.open, bar.high, bar.low, bar.close].every(Number.isFinite) || bar.open <= 0 || bar.close <= 0 || bar.low <= 0 || bar.high < Math.max(bar.open, bar.close, bar.low) || bar.low > Math.min(bar.open, bar.close)) return false;
      if (trade && trade.buy && bar.date === trade.buy.date) buyFound = true;
      if (trade && trade.sell && bar.date === trade.sell.date) sellFound = true;
      previous = bar.date;
    }
    if (trade === null) return true;
    if (!trade || !trade.buy || !trade.sell) return false;
    if (!validStamp(trade.buy.date) || !validStamp(trade.sell.date) || trade.buy.date > trade.sell.date || (trade.buy.date === trade.sell.date && trade.mode !== 'quantity') || ![trade.buy.price, trade.sell.price].every(function (value) { return Number.isFinite(value) && value > 0; })) return false;
    if (trade.capital != null && (!Number.isFinite(trade.capital) || trade.capital <= 0)) return false;
    if (!buyFound || !sellFound) return false;
    if (trade.endDate && (!validStamp(trade.endDate) || !bars.some(function (bar) { return bar.date === trade.endDate; }))) return false;
    if (trade.events != null) {
      if (!Array.isArray(trade.events) || trade.events.length < 2 || trade.events.length > 200) return false;
      if (trade.events.some(function (event) {
        return !event || !['BUY', 'SELL'].includes(event.type) || !validStamp(event.date) || !bars.some(function (bar) { return bar.date === event.date; }) || !Number.isFinite(event.price) || event.price <= 0 || (trade.mode === 'quantity' && (!Number.isFinite(event.quantity) || event.quantity <= 0));
      })) return false;
    }
    return true;
  }

  function makeLayer(type, overrides) {
    const base = { id: id(), type: type, name: type, x: 160, y: 400, w: 680, h: 180, rotation: 0, opacity: 1, visible: true, locked: false, color: '#242724' };
    if (type === 'text') Object.assign(base, { name: '文字', binding: '', text: 'YOUR MOMENT.', fontSize: 64, font: 'serif', align: 'left', textFit: 'auto' });
    if (type === 'rect' || type === 'circle') Object.assign(base, { name: type === 'rect' ? '色块' : '圆形', color: '#b25937', w: 220, h: 160 });
    if (type === 'image') Object.assign(base, { name: '图片贴图', src: '', fit: 'cover', focusX: 50, focusY: 50, w: 360, h: 300 });
    if (type === 'kline') Object.assign(base, { name: 'K 线贴图', w: 840, h: 340, x: 80, y: 500, bars: [], trade: null, style: {} });
    return Object.assign(base, overrides || {});
  }

  function createDesign(snapshot, style) {
    if (!snapshot || !snapshot.security || !validKline(snapshot.bars, snapshot.trade) || (snapshot.trade && !Number.isFinite(snapshot.trade.returnPct))) throw new Error('请先加载至少两根有效 K 线，或固定一笔有效交易。');
    const trade = clone(snapshot.trade);
    const symbol = snapshot.security.symbol || snapshot.security.name || 'TRADE';
    if (!trade) return {
      version: 1, ratio: '4:5', presetOrientation: 'portrait', width: 1000, height: 1250,
      background: { color: '#f5f2e9', image: null, fit: 'cover', focusX: 50, focusY: 50 },
      settings: { autosave: true, snap: true, guides: true, exportWidth: 1920 },
      source: clone(snapshot),
      layers: [
        makeLayer('text', { name: '股票代码', binding: 'symbol', text: symbol, x: 80, y: 175, w: 840, h: 120, fontSize: 122, color: '#242724' }),
        makeLayer('kline', { name: '原始 K 线', x: 80, y: 390, w: 840, h: 430, bars: clone(snapshot.bars), trade: null, style: clone(style) }),
        makeLayer('text', { name: '行情区间', binding: 'dates', text: snapshot.bars[0].date + '  —  ' + snapshot.bars.at(-1).date, x: 80, y: 900, w: 840, h: 55, fontSize: 32, font: 'sans' })
      ]
    };
    const pct = (trade.returnPct >= 0 ? '+' : '') + trade.returnPct.toFixed(2) + '%';
    return {
      version: 1, ratio: '4:5', presetOrientation: 'portrait', width: 1000, height: 1250,
      background: { color: '#f5f2e9', image: null, fit: 'cover', focusX: 50, focusY: 50 },
      settings: { autosave: true, snap: true, guides: true, exportWidth: 1920 },
      source: clone(snapshot),
      layers: [
        makeLayer('text', { name: '品牌', text: 'YINK / TRADE ARCHIVE', x: 80, y: 58, w: 840, h: 35, fontSize: 22, font: 'sans', color: '#8c8174' }),
        makeLayer('text', { name: '股票代码', binding: 'symbol', text: symbol, x: 80, y: 152, w: 840, h: 120, fontSize: 122, color: '#242724' }),
        makeLayer('text', { name: '收益率', binding: 'returnPct', text: pct, x: 80, y: 305, w: 840, h: 140, fontSize: 142, color: '#b25937' }),
        makeLayer('kline', { name: '交易 K 线', x: 80, y: 510, w: 840, h: 340, bars: clone(snapshot.bars), trade: trade, style: clone(style) }),
        makeLayer('text', { name: '交易日期', binding: 'dates', text: trade.buy.date + '  —  ' + (trade.endDate || trade.sell.date), x: 80, y: 950, w: 840, h: 55, fontSize: 32, font: 'sans' }),
        makeLayer('text', { name: '交易标语', text: 'THE TRADE I ALMOST MISSED.', x: 80, y: 1085, w: 840, h: 65, fontSize: 32, color: '#8c8174' })
      ]
    };
  }

  function setRatio(design, ratio, customRatio) {
    const selectedCustom = ratio === 'custom' ? customRatio : design.customRatio;
    const height = ratioHeight(ratio, selectedCustom);
    if (!height) throw new Error(ratio === 'custom' ? '自定义比例请输入 1–1000 的整数，宽高比限 1:4 到 4:1。' : '不支持的画布比例。');
    const next = clone(design);
    const factor = height / next.height;
    next.ratio = ratio;
    next.presetOrientation = inferredOrientation(ratio, next.presetOrientation);
    if (ratio === 'custom') next.customRatio = { width: selectedCustom.width, height: selectedCustom.height };
    next.height = height;
    next.layers.forEach(function (layer) { layer.y = Math.round((layer.y + layer.h / 2) * factor - layer.h / 2); });
    return next;
  }

  function setOrientation(design, orientation) {
    if (!['portrait', 'landscape'].includes(orientation)) throw new Error('不支持的画布方向。');
    const base = presetBase(design.ratio);
    if (!base) throw new Error('自定义比例请直接调整宽高数值。');
    const ratio = presetRatio(base, orientation);
    const next = ratio === design.ratio ? clone(design) : setRatio(design, ratio);
    next.presetOrientation = orientation;
    return next;
  }

  function resizeFromCorner(start, dx, dy, corner, snap) {
    const signs = { tl: [-1, -1], tr: [1, -1], bl: [-1, 1], br: [1, 1] }[corner];
    if (!signs) throw new Error('无效的图层缩放控制点。');
    const angle = (start.rotation || 0) * Math.PI / 180;
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    const localDx = dx * cosine + dy * sine;
    const localDy = -dx * sine + dy * cosine;
    const width = Math.max(20, snap(start.w + signs[0] * localDx));
    const height = Math.max(20, snap(start.h + signs[1] * localDy));
    const changeW = width - start.w, changeH = height - start.h;
    const halfDx = signs[0] * changeW / 2, halfDy = signs[1] * changeH / 2;
    return {
      x: start.x + cosine * halfDx - sine * halfDy - changeW / 2,
      y: start.y + sine * halfDx + cosine * halfDy - changeH / 2,
      w: width, h: height
    };
  }

  function validKlineStyle(style) {
    if (!style || typeof style !== 'object' || Array.isArray(style)) return false;
    const choices = {
      renderer: ['standard', 'ink', 'ink2'],
      mode: ['candles', 'line', 'area'], surface: ['transparent', 'paper', 'dark'],
      profitMode: ['transparent', 'dashed', 'red'],
      buyMarker: ['dot', 'triangle', 'diamond', 'square', 'ink-blot', 'ink-ring', 'ink-stamp', 'ink-brush', 'image', 'none'],
      sellMarker: ['dot', 'triangle', 'diamond', 'square', 'ink-blot', 'ink-ring', 'ink-stamp', 'ink-brush', 'image', 'none']
    };
    for (const key of Object.keys(choices)) if (style[key] && !choices[key].includes(style[key])) return false;
    if (style.renderer === 'ink' && (style.mode !== 'candles' || style.surface !== 'transparent')) return false;
    if (style.renderer === 'ink2' && (style.mode !== 'line' || style.surface !== 'transparent')) return false;
    for (const key of ['inkLine', 'inkMarkers']) if (style[key] != null && typeof style[key] !== 'boolean') return false;
    if (style.inkGhost != null && typeof style.inkGhost !== 'boolean') return false;
    for (const key of ['up', 'down', 'profitColor', 'buyMarkerColor', 'sellMarkerColor']) if (style[key] && !COLOR.test(style[key])) return false;
    for (const key of ['buyMarkerImage', 'sellMarkerImage']) if (style[key] && !/^data:image\/(png|jpeg|webp);base64,/.test(style[key])) return false;
    if ((style.buyMarker === 'image' && !style.buyMarkerImage) || (style.sellMarker === 'image' && !style.sellMarkerImage)) return false;
    const sizes = { markerSize: [6, 8, 12, 16], strokeWidth: [0.75, 1, 1.5, 2], candleWidth: [0.35, 0.55, 0.8], inkBleed: [0.5, 1, 1.5, 2], inkDryness: [0.5, 1, 1.5, 2] };
    for (const key of Object.keys(sizes)) if (style[key] != null && !sizes[key].includes(Number(style[key]))) return false;
    return true;
  }

  function validateDesign(input) {
    if (!input || input.version !== 1 || !ratioHeight(input.ratio, input.customRatio) || input.width !== 1000 || input.height !== ratioHeight(input.ratio, input.customRatio) || !Array.isArray(input.layers) || input.layers.length > 100) throw new Error('项目文件格式不受支持。');
    if (input.customRatio != null && !customHeight(input.customRatio)) throw new Error('项目自定义比例无效。');
    if (input.presetOrientation != null && !['portrait', 'landscape'].includes(input.presetOrientation)) throw new Error('项目画布方向无效。');
    const design = clone(input);
    design.presetOrientation = inferredOrientation(design.ratio, design.presetOrientation);
    if (!design.background || typeof design.background !== 'object' || Array.isArray(design.background)) throw new Error('项目背景格式不受支持。');
    if (design.background.image && !/^data:image\/(png|jpeg|webp);base64,/.test(design.background.image)) throw new Error('背景图片格式不受支持。');
    if (design.background.fit && !['cover', 'contain'].includes(design.background.fit)) throw new Error('背景图片填充方式不受支持。');
    design.background.fit = design.background.fit || 'cover';
    design.background.focusX = focusValue(design.background.focusX);
    design.background.focusY = focusValue(design.background.focusY);
    if (!validFocus(design.background.focusX) || !validFocus(design.background.focusY)) throw new Error('背景图片裁切位置无效。');
    if (!COLOR.test(design.background.color || '')) design.background.color = '#f5f2e9';
    if (design.settings && (typeof design.settings !== 'object' || Array.isArray(design.settings))) throw new Error('项目设置格式不受支持。');
    design.settings = Object.assign({ autosave: true, snap: true, guides: true, exportWidth: 1920 }, design.settings || {});
    if (![1920, 2480, 3200].includes(Number(design.settings.exportWidth))) design.settings.exportWidth = 1920;
    if (design.source != null && (!design.source.security || typeof design.source.security !== 'object' || !validKline(design.source.bars, design.source.trade))) throw new Error('项目来源交易数据无效。');
    if (design.source && design.source.identity != null && (typeof design.source.identity !== 'string' || design.source.identity.length > 128)) throw new Error('项目来源标识无效。');
    const layerIds = new Set();
    for (const layer of design.layers) {
      if (!layer || typeof layer !== 'object' || typeof layer.id !== 'string' || !layer.id || layer.id.length > 80 || !['text', 'rect', 'circle', 'image', 'kline'].includes(layer.type) || ![layer.x, layer.y, layer.w, layer.h, layer.rotation, layer.opacity].every(Number.isFinite) || layer.w <= 0 || layer.h <= 0 || layer.opacity < 0 || layer.opacity > 1 || Math.max(Math.abs(layer.x), Math.abs(layer.y), layer.w, layer.h) > 10000) throw new Error('项目文件包含无效图层。');
      if (layerIds.has(layer.id)) throw new Error('项目文件包含重复图层标识。');
      layerIds.add(layer.id);
      if (layer.type === 'text' && layer.binding != null && layer.binding !== '' && !TEXT_BINDINGS.has(layer.binding)) throw new Error('文字图层交易数据绑定无效。');
      if (layer.type === 'text') {
        if (typeof layer.text !== 'string' || layer.text.length > 5000 || (layer.textFit && !['auto', 'fixed'].includes(layer.textFit))) throw new Error('文字图层内容或排版方式无效。');
        if (!ns.EditorFonts.validLayer(layer)) throw new Error('文字图层字体无效。');
        layer.textFit = layer.textFit || 'auto';
      }
      if (layer.type === 'image') {
        if (!/^data:image\/(png|jpeg|webp);base64,/.test(layer.src || '')) throw new Error('图片图层格式不受支持。');
        if (layer.fit && !['cover', 'contain'].includes(layer.fit)) throw new Error('图片填充方式不受支持。');
        layer.fit = layer.fit || 'cover';
        layer.focusX = focusValue(layer.focusX);
        layer.focusY = focusValue(layer.focusY);
        if (!validFocus(layer.focusX) || !validFocus(layer.focusY)) throw new Error('图片图层裁切位置无效。');
      }
      if (layer.type === 'kline') {
        if (!validKline(layer.bars, layer.trade)) throw new Error('K 线图层数据缺失。');
        const style = layer.style;
        if (!validKlineStyle(style)) throw new Error('K 线贴图样式无效。');
      }
    }
    return design;
  }

  ns.EditorModel = { createDesign: createDesign, makeLayer: makeLayer, setRatio: setRatio, setOrientation: setOrientation, presetBase: presetBase, presetRatio: presetRatio, resizeFromCorner: resizeFromCorner, validateDesign: validateDesign, clone: clone, heights: HEIGHTS };
})(window);
