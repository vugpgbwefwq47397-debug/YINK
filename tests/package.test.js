const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = Array.from(html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g), match => match[1]);
const styles = Array.from(html.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g), match => match[1]);
const images = Array.from(html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g), match => match[1]);
assert.ok(scripts.length >= 1 && styles.length >= 1);

function localFile(base, reference) {
  assert.ok(!/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference), `External page dependency: ${reference}`);
  const resolved = path.resolve(base, reference.split('?')[0]);
  const relative = path.relative(root, resolved);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), `Resource leaves project: ${reference}`);
  assert.ok(fs.statSync(resolved).isFile(), `Missing local resource: ${reference}`);
  return resolved;
}

for (const reference of scripts.concat(styles, images)) localFile(root, reference);
localFile(root, 'assets/yink-logo-dark.svg');
const splashData = fs.readFileSync(path.join(root, 'js/editor/ink-splash-data.js'), 'utf8').match(/data:image\/webp;base64,([^']+)/);
assert.ok(splashData, 'Missing embedded splash sticker');
assert.ok(Buffer.from(splashData[1], 'base64').equals(fs.readFileSync(path.join(root, 'assets/ink-splash-background.webp'))), 'Embedded splash sticker differs from its source asset');
for (const reference of styles) {
  const filename = localFile(root, reference);
  const css = fs.readFileSync(filename, 'utf8');
  assert.doesNotMatch(css, /@import\b/i, `CSS import in ${reference}`);
  for (const match of css.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)) localFile(path.dirname(filename), match[1]);
}

const fontSources = fs.readFileSync(path.join(root, 'js/editor/fonts.js'), 'utf8');
for (const match of fontSources.matchAll(/file: '(assets\/fonts\/[^']+)'/g)) {
  const file = localFile(root, match[1]);
  assert.ok(fs.statSync(file).size > 1000, `Empty bundled font: ${match[1]}`);
}
for (const family of ['notosanssc', 'zcoolxiaowei', 'inter', 'dmserifdisplay', 'spacemono', 'notoserifsc', 'mashanzheng', 'zcoolqingkehuangyou', 'bebasneue', 'playfairdisplay', 'caveat', 'bungee']) {
  const license = localFile(root, `assets/fonts/licenses/${family}-OFL.txt`);
  assert.match(fs.readFileSync(license, 'utf8'), /SIL OPEN FONT LICENSE/i);
}

console.log('Local package test passed');
