const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/i18n.js'), 'utf8');
const storage = new Map();

function createPage() {
  const buttons = [];
  for (const size of ['small', 'medium', 'large']) buttons.push({ dataset: { uiSize: size }, attrs: {}, listeners: {}, setAttribute(name, value) { this.attrs[name] = value; }, addEventListener(name, callback) { this.listeners[name] = callback; } });
  for (const language of ['zh-CN', 'en']) buttons.push({ dataset: { uiLanguage: language }, attrs: {}, listeners: {}, setAttribute(name, value) { this.attrs[name] = value; }, addEventListener(name, callback) { this.listeners[name] = callback; } });
  for (const theme of ['light', 'dark']) buttons.push({ dataset: { uiTheme: theme }, attrs: {}, listeners: {}, setAttribute(name, value) { this.attrs[name] = value; }, addEventListener(name, callback) { this.listeners[name] = callback; } });
  const html = { attrs: {}, setAttribute(name, value) { this.attrs[name] = value; }, lang: 'zh-CN' };
  const document = { documentElement: html, querySelectorAll(selector) { return selector === '[data-ui-size]' ? buttons.slice(0, 3) : selector === '[data-ui-language]' ? buttons.slice(3, 5) : selector === '[data-ui-theme]' ? buttons.slice(5) : []; } };
  const window = { localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) } };
  const context = { window, document };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { document, buttons, i18n: window.YINK.i18n };
}

const page = createPage();
assert.equal(page.i18n.getLanguage(), 'zh-CN');
assert.equal(page.i18n.getSize(), 'medium');
assert.equal(page.i18n.getTheme(), 'light');
const largeButton = page.buttons.find(button => button.dataset.uiSize === 'large');
const englishButton = page.buttons.find(button => button.dataset.uiLanguage === 'en');
const darkButton = page.buttons.find(button => button.dataset.uiTheme === 'dark');
largeButton.listeners.click.call(largeButton);
englishButton.listeners.click.call(englishButton);
darkButton.listeners.click.call(darkButton);
assert.equal(page.document.documentElement.lang, 'en');
assert.equal(page.document.documentElement.attrs['data-ui-size'], 'large');
assert.equal(page.document.documentElement.attrs['data-ui-theme'], 'dark');
assert.equal(darkButton.attrs['aria-pressed'], 'true');
assert.equal(page.buttons.find(button => button.dataset.uiLanguage === 'en').attrs['aria-pressed'], 'true');
assert.equal(JSON.parse(storage.get('yink.ui.settings.v1')).size, 'large');
assert.equal(createPage().i18n.getLanguage(), 'en');
assert.equal(createPage().i18n.getSize(), 'large');
assert.equal(createPage().i18n.getTheme(), 'dark');
const lightButton = page.buttons.find(button => button.dataset.uiTheme === 'light');
lightButton.listeners.click.call(lightButton);
assert.equal(page.i18n.getTheme(), 'light');
assert.equal(lightButton.attrs['aria-pressed'], 'true');

const t = page.i18n.translate;
assert.equal(t('已加载 3 条日 K 数据。'), 'Loaded 3 daily candles.');
assert.equal(t('已加载 78 条 5 分钟 K 数据。'), 'Loaded 78 5 minute candles.');
assert.equal(t('CSV 已读取：3 条日 K。可调整日期后加载。'), 'CSV read: 3 daily candles. Adjust dates and load.');
assert.equal(t('3 笔 · 累计买入 10 · 累计卖出 5 · 收益率基于累计买入成本'), '3 trades · Total bought 10 · Total sold 5 · Return based on total buy cost');
assert.equal(t('示例交易  /  YINK-DEMO · 日 K'), 'Sample trade / YINK-DEMO · Daily candles');
assert.equal(t('YINK-DEMO · 自定义数据 · 2026-09-01'), 'YINK-DEMO · Custom data · 2026-09-01');
assert.equal(t('⌁  交易 K 线'), '⌁  Trade chart');

const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const staticStrings = new Set(htmlSource.replace(/<[^>]*>/g, '\n').split('\n').map(value => value.trim()).filter(value => /[\u4e00-\u9fff]/.test(value)));
for (const match of htmlSource.matchAll(/(?:placeholder|title|aria-label)="([^"]+)"/g)) if (/[\u4e00-\u9fff]/.test(match[1])) staticStrings.add(match[1]);
const untranslated = [...staticStrings].filter(value => value !== '中文' && t(value) === value);
assert.deepEqual(untranslated, []);
console.log('I18n tests passed');
