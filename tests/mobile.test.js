const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture({ small = true, reduce = false, observer = true } = {}) {
  function node() {
    const classes = new Set();
    return { attrs: {}, checked: true, listeners: {},
      classList: { add: name => classes.add(name), contains: name => classes.has(name) },
      setAttribute(name, value) { this.attrs[name] = value; },
      addEventListener(name, callback) { this.listeners[name] = callback; },
      scrollIntoView(options) { this.scrolled = options; }
    };
  }
  const nodes = Object.fromEntries(['editor-section', 'mobile-editor-nav', 'mobile-canvas-drag', 'mobile-panel-canvas', 'mobile-panel-add', 'mobile-panel-layers'].map(id => [id, node()]));
  const html = node(), sections = [node(), node()];
  const narrow = { matches: small, addEventListener(_, cb) { this.change = cb; } };
  const reduced = { matches: reduce, addEventListener(_, cb) { this.change = cb; } };
  let io;
  const window = { matchMedia: q => q.includes('680') ? narrow : reduced };
  if (observer) window.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; this.observed = new Set(); io = this; }
    observe(target) { this.observed.add(target); }
    unobserve(target) { this.observed.delete(target); }
  };
  const document = { documentElement: html, getElementById: id => nodes[id], querySelectorAll: () => sections };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/mobile-ui.js'), 'utf8'), { window, document });
  return { ui: window.YINK.MobileUI, nodes, html, sections, narrow, reduced, io };
}

const f = fixture();
assert.equal(f.ui.isMobile(), true);
assert.equal(f.ui.canDrag(), false, 'Touch browsing must not move modules by default');
assert.equal(f.nodes['editor-section'].attrs['data-mobile-panel'], 'canvas');
f.nodes['mobile-panel-add'].listeners.click();
assert.equal(f.nodes['editor-section'].attrs['data-mobile-panel'], 'add');
assert.equal(f.nodes['mobile-panel-canvas'].attrs['aria-pressed'], 'false');
assert.equal(f.nodes['mobile-panel-add'].attrs['aria-pressed'], 'true');
f.ui.showPanel('layers', true);
assert.equal(f.nodes['mobile-editor-nav'].scrolled.behavior, 'smooth');
f.nodes['mobile-canvas-drag'].checked = true;
f.nodes['mobile-canvas-drag'].listeners.change();
assert.equal(f.ui.canDrag(), true);
assert.equal(f.nodes['editor-section'].attrs['data-mobile-drag'], 'true');
assert.equal(f.html.attrs['data-mobile-motion'], 'on');
f.io.callback([{ isIntersecting: true, target: f.sections[0] }]);
assert.equal(f.sections[0].classList.contains('is-visible'), true);
assert.equal(f.io.observed.has(f.sections[0]), false);
f.reduced.matches = true; f.reduced.change();
assert.equal(f.html.attrs['data-mobile-motion'], 'off');
f.ui.showPanel('canvas', true);
assert.equal(f.nodes['mobile-editor-nav'].scrolled.behavior, 'auto');
f.narrow.matches = false; f.narrow.change();
assert.equal(f.ui.isMobile(), false);
assert.equal(f.ui.canDrag(), true);
assert.equal(fixture({ observer: false }).html.attrs['data-mobile-motion'], 'off', 'Unsupported animation API must leave content visible');
console.log('Mobile controls and motion tests passed');

// Scroll must move both the orange point and the page light on a phone.
const attrs = {}, properties = {}, events = {};
const hero = { style: { setProperty() {} }, getBoundingClientRect: () => ({ top: 400 - motionWindow.scrollY }) };
const curve = { style: {}, getTotalLength: () => 100, getPointAtLength: distance => ({ x: distance * 5, y: 280 - distance * 2 }) };
const point = { setAttribute: (name, value) => { attrs[name] = value; } };
const motionReduced = { matches: false, addEventListener() {} };
const motionWindow = { scrollY: 0, innerHeight: 800,
  matchMedia: query => query.includes('900') ? { matches: true } : motionReduced,
  requestAnimationFrame(callback) { this.frame = callback; return 1; },
  addEventListener(name, callback) { events[name] = callback; }
};
const motionDocument = {
  getElementById: id => ({ 'hero-visual': hero, 'hero-trace-path': curve, 'hero-trace-point': point, 'hero-trace-halo': point })[id],
  documentElement: { scrollHeight: 2400 }, body: { style: { setProperty: (name, value) => { properties[name] = value; } } }
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/hero-motion.js'), 'utf8'), { window: motionWindow, document: motionDocument });
const startY = attrs.cy, startLight = parseFloat(properties['--page-light-y']);
motionWindow.scrollY = 140; events.scroll(); motionWindow.frame();
assert.ok(attrs.cy < startY, 'Orange point should climb the curve as the page scrolls');
assert.ok(parseFloat(properties['--page-light-y']) > startLight, 'Page light should move down');
motionReduced.matches = true; events.scroll(); motionWindow.frame();
const reducedPoint = attrs.cy, reducedLight = properties['--page-light-y'];
motionWindow.scrollY = 500; events.scroll(); motionWindow.frame();
assert.equal(attrs.cy, reducedPoint); assert.equal(properties['--page-light-y'], reducedLight);
console.log('Mobile scroll motion tests passed');
