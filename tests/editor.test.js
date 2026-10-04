const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const context = { window: {} };
vm.createContext(context);
for (const file of ['js/editor/fonts.js', 'js/editor/model.js', 'js/vendor/squiggy.js', 'js/editor/ink2.js', 'js/editor/render.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const { EditorModel: model, EditorRender: renderer } = context.window.YINK;
assert.equal(Object.keys(context.window.YINK.EditorFonts.presets).length, 15);
for (const key of ['zhi-mang-xing', 'liu-jian-mao-cao', 'long-cang']) {
  assert.ok(fs.existsSync(path.join(root, context.window.YINK.EditorFonts.presets[key].file)));
}
const loadedFonts = [];
context.document = { fonts: { add(face) { loadedFonts.push(face.family); } } };
context.window.FontFace = class {
  constructor(family, source) { this.family = family; this.source = source; }
  load() { return this.source.includes('CORRUPT') ? Promise.reject(new Error('bad font')) : Promise.resolve(this); }
};
const bars = [
  { date: '2026-09-01', open: 100, high: 104, low: 98, close: 102, volume: 100 },
  { date: '2026-09-02', open: 102, high: 112, low: 101, close: 110, volume: 120 }
];
const trade = { buy: { date: '2026-09-01', price: 102 }, sell: { date: '2026-09-02', price: 110 }, returnPct: (110 - 102) / 102 * 100, holdingDays: 1, capital: null, profit: null };
const design = model.createDesign({ security: { symbol: 'TEST', name: 'Test' }, bars, trade, currency: 'USD' }, { mode: 'line', up: '#b25937', down: '#42685c', surface: 'transparent', labels: true });
const rawDesign = model.createDesign({ security: { symbol: 'TEST', name: 'Test' }, bars, trade: null, currency: 'USD' }, { mode: 'line', up: '#b25937', down: '#42685c', surface: 'transparent', labels: false, buyMarker: 'none', sellMarker: 'none' });
assert.equal(model.validateDesign(rawDesign).source.trade, null);
assert.equal(rawDesign.layers.find(layer => layer.type === 'kline').trade, null);
assert.equal(rawDesign.layers.some(layer => layer.binding === 'returnPct'), false);
const invalidRaw = model.clone(rawDesign);
invalidRaw.layers.find(layer => layer.type === 'kline').trade = {};
assert.throws(() => model.validateDesign(invalidRaw), /K 线图层数据缺失/);
const hourBars = [
  { date: '2026-09-01 09:30', open: 100, high: 103, low: 99, close: 102, volume: 10 },
  { date: '2026-09-01 10:30', open: 102, high: 111, low: 101, close: 110, volume: 12 }
];
const hourTrade = { ...trade, buy: { date: hourBars[0].date, price: 102 }, sell: { date: hourBars[1].date, price: 110 }, endDate: hourBars[1].date, holdingDays: 0, holdingHours: 1 };
assert.equal(model.validateDesign(model.createDesign({ security: { symbol: 'TEST' }, bars: hourBars, trade: hourTrade }, { mode: 'line' })).source.trade.holdingHours, 1);
const sameBarTrade = {
  mode: 'quantity', events: [
    { type: 'BUY', date: hourBars[0].date, price: 102, quantity: 2 },
    { type: 'SELL', date: hourBars[0].date, price: 110, quantity: 2 }
  ], buy: { date: hourBars[0].date, price: 102 }, sell: { date: hourBars[0].date, price: 110 },
  endDate: hourBars[0].date, returnPct: 110 / 102 * 100 - 100, holdingHours: 0, capital: null, profit: 16
};
assert.equal(model.validateDesign(model.createDesign({ security: { symbol: 'TEST' }, bars: hourBars, trade: sameBarTrade }, { mode: 'line' })).source.trade.profit, 16);
assert.equal(design.layers.length, 6);
assert.equal(design.layers.find(layer => layer.name === '收益率').binding, 'returnPct');
assert.equal(design.layers.find(layer => layer.type === 'kline').style.mode, 'line');
const a4 = model.setRatio(design, 'A4');
assert.equal(a4.height, 1414);
assert.equal(design.height, 1250);
assert.ok(a4.layers.every((layer, index) => layer.w === design.layers[index].w && layer.h === design.layers[index].h));
const square = model.setRatio(design, '1:1');
const originalChart = design.layers.find(layer => layer.type === 'kline');
const squareChart = square.layers.find(layer => layer.type === 'kline');
assert.equal(squareChart.h, originalChart.h);
assert.ok(Math.abs((squareChart.y + squareChart.h / 2) / square.height - (originalChart.y + originalChart.h / 2) / design.height) < 0.001);
assert.equal(model.validateDesign(a4).ratio, 'A4');
const landscapeA4 = model.setOrientation(a4, 'landscape');
assert.equal(landscapeA4.ratio, 'A4-landscape');
assert.equal(landscapeA4.height, 707);
assert.equal(landscapeA4.presetOrientation, 'landscape');
assert.equal(model.validateDesign(landscapeA4).ratio, 'A4-landscape');
assert.equal(model.setOrientation(landscapeA4, 'portrait').ratio, 'A4');
assert.equal(model.setOrientation(model.setRatio(design, '9:16'), 'landscape').ratio, '16:9');
const landscapeSquare = model.setOrientation(square, 'landscape');
assert.equal(landscapeSquare.ratio, '1:1');
assert.equal(landscapeSquare.presetOrientation, 'landscape');
assert.equal(model.presetRatio('4:5', landscapeSquare.presetOrientation), '5:4');
const oldLandscape = model.clone(landscapeA4);
delete oldLandscape.presetOrientation;
assert.equal(model.validateDesign(oldLandscape).presetOrientation, 'landscape');
const custom = model.setRatio(design, 'custom', { width: 16, height: 9 });
assert.throws(() => model.setOrientation(custom, 'portrait'), /自定义比例/);
assert.equal(custom.height, 563);
assert.equal(custom.ratio, 'custom');
assert.deepEqual(JSON.parse(JSON.stringify(custom.customRatio)), { width: 16, height: 9 });
assert.ok(custom.layers.every((layer, index) => layer.w === design.layers[index].w && layer.h === design.layers[index].h));
assert.equal(model.validateDesign(custom).height, 563);
const presetFromCustom = model.setRatio(custom, 'A4');
assert.equal(presetFromCustom.height, 1414);
assert.deepEqual(JSON.parse(JSON.stringify(presetFromCustom.customRatio)), { width: 16, height: 9 });
assert.throws(() => model.setRatio(design, 'custom', { width: 1, height: 5 }), /宽高比限/);
assert.throws(() => model.setRatio(design, 'custom', { width: 1.5, height: 2 }), /整数/);
const invalidCustom = model.clone(custom);
invalidCustom.height = 564;
assert.throws(() => model.validateDesign(invalidCustom), /项目文件格式/);
const duplicateIds = model.clone(a4);
duplicateIds.layers[1].id = duplicateIds.layers[0].id;
assert.throws(() => model.validateDesign(duplicateIds), /重复图层标识/);
const badBinding = model.clone(a4);
badBinding.layers.find(layer => layer.name === '收益率').binding = 'unknown';
assert.throws(() => model.validateDesign(badBinding), /交易数据绑定/);
const badTextFit = model.clone(a4);
badTextFit.layers.find(layer => layer.name === '收益率').textFit = 'squash';
assert.throws(() => model.validateDesign(badTextFit), /排版方式/);
const legacyTextFit = model.clone(a4);
delete legacyTextFit.layers.find(layer => layer.name === '收益率').textFit;
assert.equal(model.validateDesign(legacyTextFit).layers.find(layer => layer.name === '收益率').textFit, 'auto');
const signs = { tl: [-1, -1], tr: [1, -1], bl: [-1, 1], br: [1, 1] };
const worldCorner = (box, corner) => {
  const angle = (box.rotation || 0) * Math.PI / 180, cosine = Math.cos(angle), sine = Math.sin(angle);
  const [sx, sy] = signs[corner];
  return {
    x: box.x + box.w / 2 + sx * box.w * cosine / 2 - sy * box.h * sine / 2,
    y: box.y + box.h / 2 + sx * box.w * sine / 2 + sy * box.h * cosine / 2
  };
};
for (const rotation of [0, 37, 90, -45]) {
  const start = { x: 100, y: 100, w: 100, h: 50, rotation };
  const angle = rotation * Math.PI / 180;
  for (const [corner, [sx, sy]] of Object.entries(signs)) {
    const localDx = sx * 20, localDy = sy * 10;
    const dx = localDx * Math.cos(angle) - localDy * Math.sin(angle);
    const dy = localDx * Math.sin(angle) + localDy * Math.cos(angle);
    const resized = model.resizeFromCorner(start, dx, dy, corner, Math.round);
    assert.equal(resized.w, 120);
    assert.equal(resized.h, 60);
    const opposite = Object.keys(signs).find(key => signs[key][0] === -sx && signs[key][1] === -sy);
    const before = worldCorner(start, opposite), after = worldCorner({ ...resized, rotation }, opposite);
    assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9);
  }
}
assert.throws(() => model.validateDesign({ ...a4, background: { color: '#fff', image: 'https://example.com/a.png' } }), /背景图片/);
assert.throws(() => model.validateDesign({ ...a4, background: 'broken' }), /背景格式/);
assert.throws(() => model.validateDesign({ ...a4, background: { color: '#ffffff', image: null, fit: 'stretch' } }), /背景图片填充/);
assert.equal(model.validateDesign({ ...a4, background: { color: '#ffffff', image: null } }).background.fit, 'cover');
assert.equal(model.validateDesign({ ...a4, background: { color: '#ffffff', image: null } }).background.focusX, 50);
assert.throws(() => model.validateDesign({ ...a4, background: { color: '#ffffff', image: null, focusX: 120 } }), /背景图片裁切位置/);
const badStyle = model.clone(a4);
badStyle.layers.find(layer => layer.type === 'kline').style = 'broken';
assert.throws(() => model.validateDesign(badStyle), /样式无效/);
const badMarkerStyle = model.clone(a4);
badMarkerStyle.layers.find(layer => layer.type === 'kline').style.buyMarker = 'starburst';
assert.throws(() => model.validateDesign(badMarkerStyle), /样式无效/);
badMarkerStyle.layers.find(layer => layer.type === 'kline').style.buyMarker = 'image';
assert.throws(() => model.validateDesign(badMarkerStyle), /样式无效/);
const badSource = model.clone(a4);
badSource.source.bars = [];
assert.throws(() => model.validateDesign(badSource), /来源交易/);
const badBars = model.clone(a4);
badBars.layers.find(layer => layer.type === 'kline').bars.reverse();
assert.throws(() => model.validateDesign(badBars), /K 线图层数据/);
const invalidCalendar = model.clone(a4);
invalidCalendar.layers.find(layer => layer.type === 'kline').bars[0].date = '2026-02-30';
assert.throws(() => model.validateDesign(invalidCalendar), /K 线图层数据/);
const fontDesign = model.clone(design);
const fontLayer = fontDesign.layers.find(layer => layer.type === 'text');
fontLayer.font = 'noto-sans-sc';
assert.equal(model.validateDesign(fontDesign).layers.find(layer => layer.type === 'text').font, 'noto-sans-sc');
fontLayer.font = 'unknown-font';
assert.throws(() => model.validateDesign(fontDesign), /字体无效/);
fontLayer.font = 'custom';
fontLayer.fontData = 'data:font/ttf;base64,AAAA';
fontLayer.fontName = 'My Font.ttf';
assert.equal(model.validateDesign(fontDesign).layers.find(layer => layer.type === 'text').fontName, 'My Font.ttf');
fontLayer.fontData = 'https://example.com/font.ttf';
assert.throws(() => model.validateDesign(fontDesign), /字体无效/);
fontLayer.fontData = 'data:font/ttf;base64,AAAA';

const labels = [];
const textDraws = [];
let imagesDrawn = 0;
const imageDraws = [];
context.window.Image = class { set src(_value) { this.width = 400; this.height = 300; this.onload(); } };
const ctx = {
  setTransform() {}, fillRect() {}, beginPath() {}, rect() {}, clip() {}, save() {}, restore() {}, translate() {}, rotate() {}, strokeRect() {}, setLineDash() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {}, closePath() {}, ellipse() {}, drawImage() {},
  fillText(value) { labels.push(String(value)); textDraws.push({ value: String(value), font: this.font, arguments: arguments.length }); },
  measureText(value) { return { width: Array.from(String(value)).length * (parseFloat(this.font) || 12) * 0.6 }; }
};
const canvas = { width: 0, height: 0, getContext: () => ctx };
const traceColors = { strokes: [], fills: [], markers: 0, markerPositions: [], labels: 0 };
const traceContext = {
  globalAlpha: 1,
  save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, moveTo() {}, lineTo() {}, closePath() {},
  stroke() { traceColors.strokes.push(this.strokeStyle); },
  fill() { traceColors.fills.push(this.fillStyle); },
  arc(x, y) { traceColors.markers++; traceColors.markerPositions.push({ x, y }); }, fillRect() {}, fillText() { traceColors.labels++; }
};
const inkStyle = { renderer: 'ink', mode: 'candles', surface: 'transparent', strokeWidth: 1.5, inkLine: true, inkMarkers: false };
const inkDesign = model.createDesign({ security: { symbol: 'TEST' }, bars, trade }, inkStyle);
assert.equal(model.validateDesign(inkDesign).layers.find(layer => layer.type === 'kline').style.renderer, 'ink');
const ink2Style = { renderer: 'ink2', mode: 'line', surface: 'transparent', strokeWidth: 1.5, inkDryness: 1, inkGhost: true, inkMarkers: false };
const ink2Design = model.createDesign({ security: { symbol: 'TEST' }, bars, trade }, ink2Style);
assert.equal(model.validateDesign(ink2Design).layers.find(layer => layer.type === 'kline').style.renderer, 'ink2');
const invalidInk2 = model.clone(ink2Design);
invalidInk2.layers.find(layer => layer.type === 'kline').style.mode = 'candles';
assert.throws(() => model.validateDesign(invalidInk2), /贴图样式无效/);
const ink2Calls = { images: [], clear: 0, webgl: 0, fills: [] };
context.window.brush = { spline() { throw new Error('Ink wash 2 must not use WebGL brush'); } };
context.document.createElement = () => ({
  width: 0, height: 0, kind: null,
  getContext(type) {
    this.kind = type;
    if (type === 'webgl2') { ink2Calls.webgl++; throw new Error('WebGL must not be requested'); }
    return {
      globalAlpha: 1, setTransform() {}, clearRect() { assert.equal(this.globalCompositeOperation, 'source-over'); ink2Calls.clear++; },
      save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
      fill() { ink2Calls.fills.push(this.fillStyle); }, stroke() {}, fillRect() { throw new Error('Ink sticker must not draw a background'); }
    };
  }
});
const ink2Context = {
  globalAlpha: 1, save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, moveTo() {}, lineTo() {}, stroke() {},
  fillRect() { throw new Error('Ink sticker must not draw a background'); },
  drawImage(canvas) { ink2Calls.images.push(canvas.kind); }
};
const ink2Layer = model.makeLayer('kline', { w: 40, h: 40, bars, trade, style: { ...ink2Style, labels: false } });
renderer.drawKline(ink2Context, ink2Layer);
renderer.drawKline(ink2Context, model.makeLayer('kline', { w: 40, h: 40, bars, trade: null, style: { ...ink2Style, labels: false } }));
assert.deepEqual(ink2Calls.images, ['2d', '2d']);
assert.equal(ink2Calls.webgl, 0);
assert.equal(ink2Calls.clear, 2);
assert.ok(ink2Calls.fills.length > 0);
assert.ok(ink2Calls.fills.every(color => color === '#181614'));
delete context.window.brush;
delete context.document.createElement;
const invalidInk = model.clone(inkDesign);
invalidInk.layers.find(layer => layer.type === 'kline').style.surface = 'paper';
assert.throws(() => model.validateDesign(invalidInk), /贴图样式无效/);
const inkDraws = { fills: [], strokes: [], backgrounds: 0, gradients: [], segments: 0 };
const inkContext = {
  globalAlpha: 1,
  save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, rect() {}, clip() {}, moveTo() {}, lineTo() { inkDraws.segments++; }, closePath() {}, arc() {},
  createRadialGradient() { const stops = []; inkDraws.gradients.push(stops); return { addColorStop(position, color) { stops.push([position, color]); } }; },
  stroke() { inkDraws.strokes.push(this.strokeStyle); }, fill() { inkDraws.fills.push(this.fillStyle); }, fillRect() { inkDraws.backgrounds++; }
};
renderer.drawKline(inkContext, model.makeLayer('kline', { bars: [bars[0], { ...bars[1], close: 101 }], trade, style: inkStyle }));
assert.equal(inkDraws.backgrounds, 0);
assert.ok(inkDraws.fills.includes('#ffffff'));
assert.ok(inkDraws.fills.includes('#181614'));
assert.ok(inkDraws.strokes.some(color => String(color).startsWith('rgba(24,22,20,')));
assert.ok(inkDraws.strokes.includes('rgba(255,255,255,0.55)'));
assert.ok(inkDraws.fills.filter(color => color === '#181614').length > 1);
assert.ok(inkDraws.fills.includes('rgba(24,22,20,0.045)'));
assert.ok(inkDraws.fills.includes('rgba(24,22,20,0.075)'));
assert.ok(inkDraws.segments > 50);
assert.equal(inkDraws.gradients.length, 0);
inkDraws.strokes.length = 0;
renderer.drawKline(inkContext, model.makeLayer('kline', { bars, trade, style: { ...inkStyle, inkLine: false } }));
assert.ok(!inkDraws.strokes.includes('rgba(255,255,255,0.55)'));
for (const shape of ['ink-blot', 'ink-ring', 'ink-stamp', 'ink-brush']) {
  const markerStyle = { ...inkStyle, buyMarker: shape, sellMarker: shape, markerSize: 12, labels: false, inkMarkers: true };
  assert.equal(model.validateDesign(model.createDesign({ security: { symbol: 'TEST' }, bars, trade }, markerStyle)).layers.find(layer => layer.type === 'kline').style.buyMarker, shape);
  renderer.drawKline(inkContext, model.makeLayer('kline', { bars, trade, style: markerStyle }));
}
const invalidBleed = model.clone(inkDesign);
invalidBleed.layers.find(layer => layer.type === 'kline').style.inkBleed = 9;
assert.throws(() => model.validateDesign(invalidBleed), /贴图样式无效/);
const lossTrade = { ...trade, sell: { date: trade.sell.date, price: 90 }, returnPct: -12 };
const lossLayer = model.makeLayer('kline', { bars, trade: lossTrade, style: { mode: 'line', up: '#ff0000', down: '#00aa00', labels: false } });
renderer.drawKline(traceContext, lossLayer);
assert.equal(traceColors.strokes[0], '#00aa00');
assert.equal(traceColors.markers, 2);
assert.equal(traceColors.labels, 0);
traceColors.markerPositions.length = 0;
renderer.drawKline(traceContext, model.makeLayer('kline', { bars: hourBars, trade: sameBarTrade, style: { mode: 'line', labels: false } }));
assert.equal(traceColors.markerPositions.length, 2);
assert.notEqual(traceColors.markerPositions[0].y, traceColors.markerPositions[1].y);
lossLayer.style.mode = 'area';
traceColors.strokes.length = 0;
traceColors.fills.length = 0;
renderer.drawKline(traceContext, lossLayer);
assert.equal(traceColors.fills[0], '#00aa00');
assert.equal(traceColors.strokes[0], '#00aa00');
const profitLayer = model.makeLayer('kline', { bars, trade, style: { mode: 'line', up: '#b25937', down: '#42685c', labels: false, profitMode: 'red', profitColor: '#c3483b' } });
traceColors.strokes.length = 0;
renderer.drawKline(traceContext, profitLayer);
assert.ok(traceColors.strokes.includes('#c3483b'));
const rotatingBars = [
  { date: '2026-09-01', open: 200, high: 210, low: 190, close: 200 },
  { date: '2026-09-02', open: 200, high: 225, low: 90, close: 130 },
  { date: '2026-09-03', open: 130, high: 145, low: 125, close: 140 }
];
const rotatingTrade = {
  buy: { date: '2026-09-01', price: 200 }, sell: { date: '2026-09-03', price: 180 }, returnPct: 5,
  events: [
    { type: 'BUY', date: '2026-09-01', price: 200, quantity: 10 },
    { type: 'SELL', date: '2026-09-02', price: 220, quantity: 10 },
    { type: 'BUY', date: '2026-09-02', price: 100, quantity: 10 },
    { type: 'SELL', date: '2026-09-03', price: 140, quantity: 10 }
  ]
};
traceColors.strokes.length = 0;
renderer.drawKline(traceContext, model.makeLayer('kline', { bars: rotatingBars, trade: rotatingTrade, style: { mode: 'line', labels: false, profitMode: 'red', profitColor: '#c3483b' } }));
assert.ok(traceColors.strokes.includes('#c3483b'));
let contextCandles = 0;
const contextBars = [bars[0], bars[1], { date: '2026-09-03', open: 110, high: 116, low: 108, close: 114, volume: 90 }];
const contextualTrade = { buy: { date: bars[1].date, price: 110 }, sell: { date: contextBars[2].date, price: 114 }, endDate: contextBars[2].date };
renderer.drawKline({ save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {}, fillRect() { contextCandles++; } }, model.makeLayer('kline', { bars: contextBars, trade: contextualTrade, style: { mode: 'candles', labels: false } }));
assert.equal(contextCandles, 3);
(async () => {
  await renderer.render(canvas, design, 1920, 2400, null, false);
  assert.equal(canvas.width, 1920);
  assert.equal(canvas.height, 2400);
  assert.ok(labels.some(label => label.includes('TEST')));
  const textDesign = model.clone(design);
  const slogan = model.makeLayer('text', { text: 'A LONG CUSTOM SLOGAN ABOUT ONE MEMORABLE TRADE', x: 20, y: 20, w: 180, h: 130, fontSize: 60 });
  textDesign.layers = [slogan];
  const firstDraw = textDraws.length;
  await renderer.render(canvas, textDesign, 1000, 1250, null, false);
  const autoDraws = textDraws.slice(firstDraw);
  assert.ok(autoDraws.length > 1);
  assert.ok(parseFloat(autoDraws[0].font) < 60);
  assert.ok(autoDraws.every(item => item.arguments === 3 && Array.from(item.value).length * parseFloat(item.font) * 0.6 <= slogan.w));
  slogan.textFit = 'fixed';
  const fixedStart = textDraws.length;
  await renderer.render(canvas, textDesign, 1000, 1250, null, false);
  assert.equal(parseFloat(textDraws[fixedStart].font), 60);
  const kline = design.layers.find(layer => layer.type === 'kline');
  assert.equal(renderer.hitTest(design, kline.x + 30, kline.y + 30).id, kline.id);
  const handleLayer = model.makeLayer('rect', { x: 100, y: 100, w: 100, h: 50 });
  const handleDesign = { layers: [handleLayer] };
  for (const corner of Object.keys(signs)) {
    const point = worldCorner(handleLayer, corner);
    assert.equal(renderer.hitTest(handleDesign, point.x, point.y, handleLayer.id).corner, corner);
    assert.equal(renderer.hitTest(handleDesign, point.x, point.y).action, 'move');
  }
  handleDesign.layers.push(model.makeLayer('rect', { x: 90, y: 90, w: 150, h: 100 }));
  assert.equal(renderer.hitTest(handleDesign, 100, 100).id, handleDesign.layers[1].id);
  assert.equal(renderer.hitTest(handleDesign, 100, 100, handleLayer.id).corner, 'tl');
  handleLayer.rotation = 37;
  for (const corner of Object.keys(signs)) {
    const point = worldCorner(handleLayer, corner);
    assert.equal(renderer.hitTest(handleDesign, point.x, point.y, handleLayer.id).corner, corner);
  }
  kline.locked = true;
  assert.equal(renderer.hitTest(design, kline.x + 30, kline.y + 30), null);
  const imageDesign = model.clone(design);
  const src = 'data:image/png;base64,AAAA';
  imageDesign.background.image = src;
  imageDesign.background.fit = 'contain';
  imageDesign.layers.push(model.makeLayer('image', { src, fit: 'contain' }));
  ctx.drawImage = (...args) => { imagesDrawn++; imageDraws.push(args); };
  await renderer.render(canvas, imageDesign, 1000, 1250, null, false);
  assert.equal(imagesDrawn, 2);
  assert.equal(imageDraws[0][3], 1000);
  assert.equal(imageDraws[0][4], 750);
  assert.equal(imageDraws[1][3], 360);
  assert.equal(imageDraws[1][4], 270);
  imageDesign.background.fit = 'cover';
  imageDesign.layers.at(-1).fit = 'cover';
  imageDesign.background.focusX = 0;
  imageDesign.layers.at(-1).focusX = 0;
  imageDraws.length = 0;
  await renderer.render(canvas, imageDesign, 1000, 1250, null, false);
  const backgroundLeft = imageDraws[0][1], layerLeft = imageDraws[1][1];
  imageDesign.background.focusX = 100;
  imageDesign.layers.at(-1).focusX = 100;
  imageDraws.length = 0;
  await renderer.render(canvas, imageDesign, 1000, 1250, null, false);
  assert.ok(imageDraws[0][1] < backgroundLeft);
  assert.equal(imageDraws[1][1], layerLeft - 40);
  assert.equal(model.validateDesign(imageDesign).layers.at(-1).focusX, 100);
  imageDesign.layers.at(-1).focusY = -1;
  assert.throws(() => model.validateDesign(imageDesign), /图片图层裁切位置/);
  imageDesign.layers.at(-1).focusY = 50;
  const legacyImageProject = model.clone(imageDesign);
  delete legacyImageProject.background.focusX;
  delete legacyImageProject.background.focusY;
  delete legacyImageProject.layers.at(-1).focusX;
  delete legacyImageProject.layers.at(-1).focusY;
  const normalizedLegacy = model.validateDesign(legacyImageProject);
  assert.equal(normalizedLegacy.background.focusX, 50);
  assert.equal(normalizedLegacy.layers.at(-1).focusY, 50);
  const markerDesign = model.clone(design);
  markerDesign.layers.find(layer => layer.type === 'kline').style = { mode: 'line', up: '#b25937', down: '#42685c', labels: true, buyMarker: 'image', buyMarkerImage: src, sellMarker: 'diamond', markerSize: 12, profitMode: 'dashed', profitColor: '#c3483b' };
  const imagesBeforeMarkers = imagesDrawn;
  await renderer.render(canvas, markerDesign, 1000, 1250, null, false);
  assert.equal(imagesDrawn, imagesBeforeMarkers + 1);
  imageDesign.layers.at(-1).fit = 'stretch';
  assert.throws(() => model.validateDesign(imageDesign), /填充方式/);
  context.window.Image = class { set src(value) { if (value.includes('CORRUPT')) this.onerror(); else { this.width = 400; this.height = 300; this.onload(); } } };
  const brokenDesign = model.clone(design);
  brokenDesign.background.image = 'data:image/png;base64,CORRUPT';
  await assert.rejects(renderer.prepare(brokenDesign), /本地图片无法解码/);
  fontLayer.font = 'inter';
  await renderer.render(canvas, fontDesign, 1000, 1250, null, false);
  assert.ok(loadedFonts.includes('YINK Inter'));
  assert.ok(textDraws.some(draw => draw.font.includes('YINK Inter')));
  fontLayer.font = 'zhi-mang-xing';
  await renderer.render(canvas, fontDesign, 1000, 1250, null, false);
  assert.ok(loadedFonts.includes('YINK Zhi Mang Xing'));
  fontLayer.font = 'custom';
  await renderer.render(canvas, fontDesign, 1000, 1250, null, false);
  assert.ok(loadedFonts.some(name => name.startsWith('YINK Custom')));
  assert.ok(textDraws.some(draw => draw.font.includes('YINK Custom')));
  console.log('Editor tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
