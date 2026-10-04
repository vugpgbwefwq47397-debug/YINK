(function (root) {
  'use strict';
  const ns = root.YINK = root.YINK || {};
  const cache = new Map();

  function imageFor(src) {
    if (!src) return Promise.resolve(null);
    if (!cache.has(src)) {
      let resolveImage, rejectImage;
      const pending = new Promise(function (resolve, reject) { resolveImage = resolve; rejectImage = reject; });
      cache.set(src, pending);
      const image = new root.Image();
      image.onload = function () { cache.set(src, image); resolveImage(image); };
      image.onerror = function () { cache.delete(src); rejectImage(new Error('本地图片无法解码。')); };
      image.src = src;
      return pending;
    }
    return Promise.resolve(cache.get(src));
  }

  async function prepare(design) {
    const sources = [design.background && design.background.image].concat(design.layers.flatMap(function (layer) {
      if (layer.type === 'image') return [layer.src];
      if (layer.type === 'kline') return [layer.style && layer.style.buyMarkerImage, layer.style && layer.style.sellMarkerImage];
      return [];
    })).filter(Boolean);
    await Promise.all(sources.map(imageFor).concat(design.layers.filter(function (layer) { return layer.type === 'text'; }).map(ns.EditorFonts.prepareLayer)));
  }

  function cover(ctx, image, x, y, w, h, focusX, focusY) {
    const ratio = Math.max(w / image.width, h / image.height);
    const iw = image.width * ratio, ih = image.height * ratio;
    ctx.drawImage(image, x + (w - iw) * (focusX == null ? 0.5 : focusX / 100), y + (h - ih) * (focusY == null ? 0.5 : focusY / 100), iw, ih);
  }

  function contain(ctx, image, x, y, w, h) {
    const ratio = Math.min(w / image.width, h / image.height);
    const iw = image.width * ratio, ih = image.height * ratio;
    ctx.drawImage(image, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  }

  function wrapParagraph(ctx, paragraph, width) {
    const lines = [];
    let line = '';
    const tokens = paragraph.match(/\S+|\s+/g) || [];
    tokens.forEach(function (token) {
      if (/^\s+$/.test(token)) {
        if (line && ctx.measureText(line + token).width <= width) line += token;
        return;
      }
      if (ctx.measureText(line + token).width <= width) { line += token; return; }
      if (line) { lines.push(line.trimEnd()); line = ''; }
      if (ctx.measureText(token).width <= width) { line = token; return; }
      Array.from(token).forEach(function (character) {
        if (line && ctx.measureText(line + character).width > width) { lines.push(line); line = ''; }
        line += character;
      });
    });
    lines.push(line.trimEnd());
    return lines;
  }

  function textLayout(ctx, layer, size, family) {
    ctx.font = size + 'px ' + family;
    const lines = String(layer.text || '').split('\n').flatMap(function (paragraph) { return wrapParagraph(ctx, paragraph, layer.w); });
    return { size: size, lines: lines, lineHeight: size * 1.18 };
  }

  function drawText(ctx, layer) {
    const family = ns.EditorFonts.familyFor(layer);
    const requested = Math.max(8, Math.min(300, Math.round(layer.fontSize || 32)));
    let layout = textLayout(ctx, layer, requested, family);
    if (layer.textFit !== 'fixed' && layout.lines.length * layout.lineHeight > layer.h) {
      let low = 8, high = requested - 1, best = textLayout(ctx, layer, 8, family);
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const trial = textLayout(ctx, layer, middle, family);
        if (trial.lines.length * trial.lineHeight <= layer.h) { best = trial; low = middle + 1; }
        else high = middle - 1;
      }
      layout = best;
    }
    ctx.font = layout.size + 'px ' + family;
    ctx.fillStyle = layer.color || '#242724';
    ctx.textBaseline = 'top';
    ctx.textAlign = layer.align || 'left';
    const x = layer.align === 'center' ? 0 : layer.align === 'right' ? layer.w / 2 : -layer.w / 2;
    ctx.beginPath(); ctx.rect(-layer.w / 2, -layer.h / 2, layer.w, layer.h); ctx.clip();
    const visibleLines = Math.min(layout.lines.length, Math.ceil(layer.h / layout.lineHeight));
    for (let index = 0; index < visibleLines; index++) ctx.fillText(layout.lines[index], x, -layer.h / 2 + index * layout.lineHeight);
  }

  function drawInkMarker(ctx, event, x, y, size, shape) {
    const seed = String(event.date || '') + event.type;
    const buy = event.type === 'BUY';
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = size * 0.38;
    if (shape === 'ink-blot') {
      ctx.beginPath();
      for (let i = 0; i < 18; i++) {
        const angle = i * Math.PI / 9;
        const radius = size * (0.77 + inkVariation(seed, 0, 900 + i) * 0.48);
        const px = Math.cos(angle) * radius, py = Math.sin(angle) * radius;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0; ctx.globalAlpha *= 0.4;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(size * (0.95 + i * 0.2), size * inkVariation(seed, 0, 940 + i), size * (0.08 + i * 0.025), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (shape === 'ink-ring') {
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineCap = 'round';
      for (let pass = 0; pass < 2; pass++) {
        ctx.globalAlpha *= pass ? 0.56 : 0.9;
        ctx.lineWidth = Math.max(0.9, size * (pass ? 0.13 : 0.23));
        ctx.beginPath();
        ctx.arc(0, 0, size * (pass ? 0.86 : 0.78), pass ? 2.4 : 0.3, pass ? 6.9 : 5.55);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(0, 0, Math.max(0.8, size * 0.1), 0, Math.PI * 2); ctx.fill();
    } else if (shape === 'ink-stamp') {
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
      ctx.lineWidth = Math.max(1.1, size * 0.23);
      const r = size * 0.86;
      ctx.beginPath();
      ctx.moveTo(-r, -r * 0.3); ctx.lineTo(-r * 0.91, -r); ctx.lineTo(r * 0.82, -r * 0.96);
      ctx.lineTo(r, -r * 0.28); ctx.moveTo(r, r * 0.12); ctx.lineTo(r * 0.94, r);
      ctx.lineTo(-r * 0.84, r * 0.92); ctx.lineTo(-r, r * 0.12); ctx.stroke();
      ctx.shadowBlur = 0; ctx.lineWidth = Math.max(0.7, size * 0.15);
      ctx.beginPath(); ctx.moveTo(-r * 0.38, r * 0.1); ctx.lineTo(r * 0.36, -r * 0.13); ctx.stroke();
    } else if (shape === 'ink-brush') {
      const direction = buy ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(0, direction * size * 1.18);
      ctx.lineTo(size * 0.72, -direction * size * 0.12);
      ctx.lineTo(size * 0.3, -direction * size * 0.28);
      ctx.lineTo(size * 0.2, -direction * size * 0.92);
      ctx.lineTo(-size * 0.18, -direction * size * 0.76);
      ctx.lineTo(-size * 0.33, -direction * size * 0.23);
      ctx.lineTo(-size * 0.8, -direction * size * 0.07);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0; ctx.strokeStyle = ctx.fillStyle; ctx.globalAlpha *= 0.42;
      ctx.lineWidth = Math.max(0.6, size * 0.09);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo((i - 1) * size * 0.16, -direction * size * 0.6);
        ctx.lineTo((i - 1) * size * 0.25, -direction * size * (0.82 + i * 0.16));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawMarker(ctx, event, x, y, style) {
    const buy = event.type === 'BUY';
    const shape = buy ? style.buyMarker || 'dot' : style.sellMarker || 'dot';
    if (shape === 'none') return false;
    const size = Number(style.markerSize) || 8;
    const source = buy ? style.buyMarkerImage : style.sellMarkerImage;
    ctx.save();
    ctx.fillStyle = buy ? style.buyMarkerColor || style.up || '#b25937' : style.sellMarkerColor || style.down || '#42685c';
    if (shape === 'image' && source && cache.get(source) && cache.get(source).width) {
      ctx.drawImage(cache.get(source), x - size * 1.6, y - size * 1.6, size * 3.2, size * 3.2);
    } else if (shape === 'ink-blot' || shape === 'ink-ring' || shape === 'ink-stamp' || shape === 'ink-brush') {
      drawInkMarker(ctx, event, x, y, size, shape);
    } else if (shape === 'diamond') {
      ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size, y); ctx.lineTo(x, y + size); ctx.lineTo(x - size, y); ctx.closePath(); ctx.fill();
    } else if (shape === 'triangle') {
      ctx.beginPath(); ctx.moveTo(x, y + (buy ? -size : size)); ctx.lineTo(x + size, y + (buy ? size : -size)); ctx.lineTo(x - size, y + (buy ? size : -size)); ctx.closePath(); ctx.fill();
    } else if (shape === 'square') {
      ctx.fillRect(x - size * 0.8, y - size * 0.8, size * 1.6, size * 1.6);
    } else {
      ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    return true;
  }

  function profitablePoints(bars, events) {
    const ordered = events.map(function (event, index) { return { event: event, index: index }; }).sort(function (a, b) { return a.event.date.localeCompare(b.event.date) || a.index - b.index; });
    const result = [];
    let held = 0, cost = 0, eventIndex = 0;
    bars.forEach(function (bar, index) {
      let profitableAtExit = false;
      while (eventIndex < ordered.length && ordered[eventIndex].event.date <= bar.date) {
        const event = ordered[eventIndex++].event;
        const quantity = Number(event.quantity) || 1;
        if (event.type === 'BUY') {
          held += quantity; cost += event.price * quantity;
        } else if (held > 0) {
          if (quantity >= held - 1e-10 && bar.close >= cost / held) profitableAtExit = true;
          const sold = Math.min(held, quantity);
          cost -= cost / held * sold;
          held -= sold;
          if (held < 1e-10) { held = 0; cost = 0; }
        }
      }
      result.push((held > 0 ? bar.close >= cost / held : profitableAtExit) ? index : null);
    });
    return result;
  }

  function inkVariation(date, index, step) {
    let hash = (index + 1) * 2166136261;
    for (let i = 0; i < date.length; i++) hash = Math.imul(hash ^ date.charCodeAt(i), 16777619);
    hash = Math.imul(hash ^ step, 2246822519);
    hash ^= hash >>> 13;
    return (hash >>> 0) / 4294967295 - 0.5;
  }

  function inkBodyPath(ctx, xx, top, bodyWidth, bodyHeight, seed, index, spread) {
    const left = xx - bodyWidth / 2 - spread;
    const right = xx + bodyWidth / 2 + spread;
    const edge = Math.min(bodyWidth * 0.24, 2.1) + spread * 0.16;
    const cap = Math.min(bodyHeight * 0.12, 1.25) + spread * 0.12;
    const sections = Math.max(5, Math.min(28, Math.ceil(bodyHeight / 3)));
    ctx.beginPath();
    ctx.moveTo(left + inkVariation(seed, index, 301) * edge, top + inkVariation(seed, index, 302) * cap);
    ctx.lineTo(xx - bodyWidth * 0.2, top + inkVariation(seed, index, 303) * cap);
    ctx.lineTo(xx + bodyWidth * 0.16, top + inkVariation(seed, index, 304) * cap);
    ctx.lineTo(right + inkVariation(seed, index, 305) * edge, top + inkVariation(seed, index, 306) * cap);
    for (let i = 1; i <= sections; i++) {
      const t = i / sections;
      const wobble = Math.sin(t * 17 + index * 1.3) * edge * 0.2;
      ctx.lineTo(right + wobble + inkVariation(seed, index, 310 + i) * edge,
        top + bodyHeight * t + inkVariation(seed, index, 340 + i) * cap);
    }
    ctx.lineTo(xx + bodyWidth * 0.14, top + bodyHeight + inkVariation(seed, index, 371) * cap);
    ctx.lineTo(xx - bodyWidth * 0.24, top + bodyHeight + inkVariation(seed, index, 372) * cap);
    for (let i = sections; i >= 0; i--) {
      const t = i / sections;
      const wobble = Math.sin(t * 19 + index * 1.7) * edge * 0.2;
      ctx.lineTo(left + wobble + inkVariation(seed, index, 380 + i) * edge,
        top + bodyHeight * t + inkVariation(seed, index, 410 + i) * cap);
    }
    ctx.closePath();
  }

  function inkBrushPath(ctx, sample, x, y, strokeWidth, bleed) {
    if (sample.length < 2) return;
    const squiggy = root.squiggy || globalThis.squiggy;
    if (!squiggy) throw new Error('本地水墨笔刷未加载。');
    const control = sample.map(function (item) { return [x(item.index), y(item.bar.close)]; });
    const path = squiggy.preprocess(control, [
      { type: 'catmull-rom', resolution: 6, alpha: 0.5 },
      { type: 'resample', step: 2.4 }
    ]);
    const base = Math.max(1.6, strokeWidth * 2.7);
    function fillStroke(radius, color, alpha, phase) {
      const brush = squiggy.tube_brush(function (point) {
        const pressure = 0.84 + 0.13 * Math.sin(point.d * 0.085 + phase) + 0.1 * Math.sin(point.d * 0.21 + phase * 0.7);
        return { w: Math.max(0.3, radius * pressure) };
      }, { join: 'round', cap: 'round' });
      const polygons = brush(path, { clean: false });
      ctx.fillStyle = color;
      ctx.globalAlpha *= alpha;
      polygons.forEach(function (polygon) {
        if (polygon.length < 3) return;
        ctx.beginPath();
        polygon.forEach(function (point, index) { if (index) ctx.lineTo(point[0], point[1]); else ctx.moveTo(point[0], point[1]); });
        ctx.closePath(); ctx.fill();
      });
    }
    ctx.save();
    ctx.shadowColor = 'rgba(24,22,20,0.24)';
    ctx.shadowBlur = base * bleed * 1.8;
    fillStroke(base * (2.05 + bleed * 0.32), '#181614', 0.035 + bleed * 0.012, 0.7);
    ctx.restore();
    ctx.save();
    fillStroke(base * (1.4 + bleed * 0.16), '#181614', 0.075 + bleed * 0.025, 1.1);
    ctx.restore();
    ctx.save();
    fillStroke(base * 0.93, '#181614', 0.69, 1.8);
    ctx.restore();
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let strand = 0; strand < 7; strand++) {
      const offset = (strand - 3) * base * 0.43;
      ctx.strokeStyle = strand === 3 ? 'rgba(255,255,255,0.55)' : 'rgba(24,22,20,' + (0.25 + strand * 0.035) + ')';
      ctx.lineWidth = strand === 3 ? Math.max(0.45, base * 0.13) : Math.max(0.35, base * (0.085 + strand * 0.006));
      ctx.beginPath();
      let drawing = false;
      for (let i = 0; i < path.length; i++) {
        const previous = path[Math.max(0, i - 1)], next = path[Math.min(path.length - 1, i + 1)];
        const dx = next[0] - previous[0], dy = next[1] - previous[1], length = Math.max(0.01, Math.hypot(dx, dy));
        const run = (i + strand * 17) % (34 + strand * 3) < 17 + strand * 2;
        if (!run) { drawing = false; continue; }
        const weave = offset + Math.sin(i * 0.23 + strand * 2.1) * base * 0.13;
        const px = path[i][0] - dy / length * weave;
        const py = path[i][1] + dx / length * weave;
        if (drawing) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        drawing = true;
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawInkCandles(ctx, sample, x, y, width, strokeWidth, withLine, bleed) {
    const bodyWidth = Math.max(2.8, Math.min(16, width / sample.length * 0.59));
    const black = '#181614';
    if (withLine) inkBrushPath(ctx, sample, x, y, strokeWidth, bleed);
    sample.forEach(function (item) {
      const bar = item.bar, xx = x(item.index), rising = bar.close >= bar.open;
      const top = Math.min(y(bar.open), y(bar.close));
      const bottom = Math.max(y(bar.open), y(bar.close));
      const bodyHeight = Math.max(1.2 * strokeWidth, bottom - top);
      const seed = String(bar.date || '');
      const wash = Math.min(bodyWidth * 0.5, (1.2 + strokeWidth) * bleed);
      // Two translucent, uneven silhouettes make ink travel along the candle rather than form round spots.
      ctx.save();
      ctx.fillStyle = 'rgba(24,22,20,' + (rising ? 0.045 : 0.075) + ')';
      ctx.shadowColor = 'rgba(24,22,20,' + (rising ? 0.08 : 0.16) + ')';
      ctx.shadowBlur = wash * 2.3;
      inkBodyPath(ctx, xx, top, bodyWidth, bodyHeight, seed, item.index, wash);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.fillStyle = 'rgba(24,22,20,' + (rising ? 0.09 : 0.17) + ')';
      inkBodyPath(ctx, xx, top, bodyWidth, bodyHeight, seed, item.index, wash * 0.48);
      ctx.fill();
      ctx.restore();

      // Keep the actual high and low at the wick endpoints; vary only the interior of the stroke.
      ctx.save();
      ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(xx, y(bar.high));
      for (let part = 1; part < 7; part++) {
        ctx.lineTo(xx + inkVariation(seed, item.index, 500 + part) * Math.min(1.8, bodyWidth * 0.23),
          y(bar.high) + (y(bar.low) - y(bar.high)) * part / 7);
      }
      ctx.lineTo(xx, y(bar.low));
      ctx.strokeStyle = rising ? 'rgba(24,22,20,0.65)' : 'rgba(24,22,20,0.84)';
      ctx.lineWidth = Math.max(0.7, strokeWidth * (rising ? 1.28 : 1.48));
      ctx.shadowColor = 'rgba(24,22,20,0.24)'; ctx.shadowBlur = strokeWidth * bleed * 1.6;
      ctx.stroke();
      if (rising) {
        ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,0.82)';
        ctx.lineWidth = Math.max(0.35, strokeWidth * 0.52); ctx.stroke();
      }
      ctx.restore();

      inkBodyPath(ctx, xx, top, bodyWidth, bodyHeight, seed, item.index, 0);
      ctx.fillStyle = rising ? '#ffffff' : black;
      ctx.fill();
      ctx.save(); ctx.clip();
      // Broken vertical grain sits inside the ink, with sparse paper-colored gaps on black candles.
      const grainCount = Math.max(3, Math.min(8, Math.round(bodyWidth * 0.52)));
      for (let grain = 0; grain < grainCount; grain++) {
        const gx = xx - bodyWidth * 0.42 + bodyWidth * 0.84 * (grain + 0.5) / grainCount;
        const start = top + bodyHeight * (0.04 + Math.abs(inkVariation(seed, item.index, 600 + grain)) * 0.4);
        const length = bodyHeight * (0.22 + Math.abs(inkVariation(seed, item.index, 620 + grain)) * 0.58);
        ctx.strokeStyle = rising ? 'rgba(24,22,20,0.22)' : 'rgba(255,255,255,0.32)';
        ctx.lineWidth = Math.max(0.28, strokeWidth * (0.23 + grain % 3 * 0.07));
        ctx.beginPath(); ctx.moveTo(gx, start);
        ctx.lineTo(gx + inkVariation(seed, item.index, 640 + grain) * bodyWidth * 0.14,
          Math.min(top + bodyHeight, start + length));
        ctx.stroke();
      }
      ctx.restore();

      // The outline is made of short, uneven fibers; a continuous rectangle reads as a digital bar.
      const fringeCount = Math.max(5, Math.min(18, Math.ceil(bodyHeight / 4)));
      ctx.save(); ctx.lineCap = 'round';
      for (let side = -1; side <= 1; side += 2) {
        for (let fiber = 0; fiber < fringeCount; fiber++) {
          const level = (fiber + 0.5) / fringeCount;
          const yy = top + bodyHeight * level;
          const edgeX = xx + side * bodyWidth * 0.48;
          const reach = (0.25 + Math.abs(inkVariation(seed, item.index, 700 + fiber + (side + 1) * 20))) * wash;
          ctx.strokeStyle = rising ? 'rgba(24,22,20,0.38)' : 'rgba(24,22,20,0.24)';
          ctx.lineWidth = Math.max(0.28, strokeWidth * (0.2 + Math.abs(inkVariation(seed, item.index, 760 + fiber)) * 0.35));
          ctx.beginPath();
          ctx.moveTo(edgeX - side * bodyWidth * 0.08, yy);
          ctx.lineTo(edgeX + side * reach, yy + inkVariation(seed, item.index, 800 + fiber) * Math.min(3, bodyHeight * 0.2));
          ctx.stroke();
        }
      }
      ctx.restore();
    });
  }

  function drawKline(ctx, layer) {
    const style = layer.style || {};
    const inkRenderer = style.renderer === 'ink' || style.renderer === 'ink2';
    const x0 = -layer.w / 2, y0 = -layer.h / 2, w = layer.w, h = layer.h;
    if (!inkRenderer && style.surface && style.surface !== 'transparent') {
      ctx.fillStyle = style.surface === 'dark' ? '#1a1d1d' : '#f8f5ed';
      ctx.fillRect(x0, y0, w, h);
    }
    const bars = layer.bars || [];
    if (!bars.length) return;
    const trade = layer.trade;
    const events = trade ? (trade.events || [{ type: 'BUY', date: trade.buy.date, price: trade.buy.price }, { type: 'SELL', date: trade.sell.date, price: trade.sell.price }]) : [];
    let sample;
    if (style.renderer === 'ink2' && bars.length > 240) {
      const keep = new Set([0, bars.length - 1]);
      events.forEach(function (event) { const index = bars.findIndex(function (bar) { return bar.date === event.date; }); if (index >= 0) keep.add(index); });
      const bucket = Math.ceil(bars.length / 120);
      for (let start = 0; start < bars.length; start += bucket) {
        let minimum = start, maximum = start;
        for (let index = start + 1; index < Math.min(bars.length, start + bucket); index++) {
          if (bars[index].close < bars[minimum].close) minimum = index;
          if (bars[index].close > bars[maximum].close) maximum = index;
        }
        keep.add(minimum); keep.add(maximum);
      }
      sample = Array.from(keep).sort(function (a, b) { return a - b; }).map(function (index) { return { bar: bars[index], index: index }; });
    } else {
      const stride = Math.max(1, Math.ceil(bars.length / 160));
      sample = bars.map(function (bar, index) { return { bar: bar, index: index }; }).filter(function (item) { return item.index % stride === 0 || item.index === bars.length - 1; });
    }
    const prices = events.map(function (event) { return event.price; });
    const low = Math.min.apply(null, bars.map(function (bar) { return bar.low; }).concat(prices));
    const high = Math.max.apply(null, bars.map(function (bar) { return bar.high; }).concat(prices));
    const pad = Math.max((high - low) * 0.15, high * 0.004, 0.01);
    const min = low - pad, max = high + pad;
    const left = x0 + w * 0.08, right = x0 + w * 0.92;
    const top = y0 + h * 0.15, bottom = y0 + h * 0.83;
    const x = function (i) { return left + i * (right - left) / Math.max(1, bars.length - 1); };
    const y = function (price) { return bottom - (price - min) / (max - min) * (bottom - top); };
    const up = style.up || '#b25937', down = style.down || '#42685c';
    const trend = trade ? (Number.isFinite(trade.returnPct) ? (trade.returnPct >= 0 ? up : down) : (trade.sell.price >= trade.buy.price ? up : down)) : (bars.at(-1).close >= bars[0].close ? up : down);
    const mode = style.mode || 'candles';
    const strokeWidth = Number(style.strokeWidth) || 1.2;
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    if (style.renderer === 'ink') {
      drawInkCandles(ctx, sample, x, y, right - left, strokeWidth, style.inkLine !== false, Number(style.inkBleed) || 1.5);
    } else if (style.renderer === 'ink2') {
      ns.EditorInk2.draw(ctx, sample, x, y, layer, style);
    } else {
      if (mode === 'area') {
        ctx.save(); ctx.fillStyle = trend; ctx.globalAlpha *= 0.18;
        ctx.beginPath(); ctx.moveTo(x(0), bottom);
        sample.forEach(function (item) { ctx.lineTo(x(item.index), y(item.bar.close)); });
        ctx.lineTo(x(bars.length - 1), bottom); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      if (mode === 'candles') {
        sample.forEach(function (item) {
          const bar = item.bar, xx = x(item.index);
          ctx.strokeStyle = bar.close >= bar.open ? up : down;
          ctx.fillStyle = ctx.strokeStyle;
          ctx.lineWidth = Math.max(0.8, w / 600) * strokeWidth;
          ctx.beginPath(); ctx.moveTo(xx, y(bar.high)); ctx.lineTo(xx, y(bar.low)); ctx.stroke();
          const body = Math.max(2, Math.min(16, (right - left) / sample.length * (Number(style.candleWidth) || 0.55)));
          ctx.fillRect(xx - body / 2, Math.min(y(bar.open), y(bar.close)), body, Math.max(1, Math.abs(y(bar.open) - y(bar.close))));
        });
      } else {
        ctx.strokeStyle = trend; ctx.lineWidth = Math.max(2, w / 360) * strokeWidth;
        ctx.beginPath(); sample.forEach(function (item, index) { if (index === 0) ctx.moveTo(x(item.index), y(item.bar.close)); else ctx.lineTo(x(item.index), y(item.bar.close)); }); ctx.stroke();
      }
    }
    if (trade && !inkRenderer && (style.profitMode === 'dashed' || style.profitMode === 'red')) {
      const profitable = profitablePoints(bars, events);
      ctx.save(); ctx.strokeStyle = style.profitColor || '#c3483b'; ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = Math.max(2, w / 350) * strokeWidth;
      if (style.profitMode === 'dashed') ctx.setLineDash([8, 6]);
      let run = [];
      function flush() {
        if (!run.length) return;
        if (run.length === 1) { ctx.beginPath(); ctx.arc(x(run[0]), y(bars[run[0]].close), ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.beginPath(); run.forEach(function (index, position) { if (position) ctx.lineTo(x(index), y(bars[index].close)); else ctx.moveTo(x(index), y(bars[index].close)); }); ctx.stroke(); }
        run = [];
      }
      profitable.forEach(function (index) { if (index == null) flush(); else run.push(index); });
      flush(); ctx.restore();
    }
    const counts = { BUY: 0, SELL: 0 };
    const occupied = new Map();
    const markerGap = Math.max(24, (Number(style.markerSize) || 8) * 3);
    const markerMargin = Math.min(markerGap, (bottom - top) / 4);
    const markerY = function (value) { return Math.max(top + markerMargin, Math.min(bottom - markerMargin, value)); };
    if (!inkRenderer || style.inkMarkers !== false) events.forEach(function (event) {
      const index = bars.findIndex(function (bar) { return bar.date === event.date; });
      if (index < 0) return;
      const xx = x(index), yy = y(event.price);
      const shape = event.type === 'BUY' ? style.buyMarker || 'dot' : style.sellMarker || 'dot';
      if (shape === 'none') return;
      const used = occupied.get(event.date) || [];
      let displayY = markerY(yy);
      for (let attempt = 0; attempt < 30 && used.some(function (value) { return Math.abs(value - displayY) < markerGap; }); attempt++) {
        const distance = markerGap * (Math.floor(attempt / 2) + 1) * (attempt % 2 ? 1 : -1);
        displayY = markerY(yy + distance);
      }
      used.push(displayY);
      occupied.set(event.date, used);
      if (Math.abs(displayY - yy) > 1) {
        ctx.save();
        ctx.globalAlpha *= 0.6;
        ctx.strokeStyle = event.type === 'BUY' ? style.buyMarkerColor || up : style.sellMarkerColor || down;
        ctx.lineWidth = Math.max(1, strokeWidth);
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, displayY); ctx.stroke();
        ctx.restore();
      }
      drawMarker(ctx, event, xx, displayY, style);
      if (style.labels === false) return;
      ctx.fillStyle = event.type === 'BUY' ? style.buyMarkerColor || up : style.sellMarkerColor || down;
      ctx.font = (inkRenderer ? '' : 'bold ') + Math.max(11, w / 42) + (inkRenderer ? 'px Georgia, serif' : 'px Arial, sans-serif');
      ctx.textAlign = event.type === 'BUY' ? 'left' : 'right';
      counts[event.type]++;
      ctx.fillText(events.length > 2 ? event.type + ' ' + counts[event.type] : event.type, xx, displayY - Math.max(9, w / 60));
    });
    ctx.restore();
  }

  function renderPrepared(canvas, design, pixelWidth, pixelHeight, selectedId, guides) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    const ctx = canvas.getContext('2d');
    const scale = pixelWidth / design.width;
    ctx.setTransform(scale, 0, 0, pixelHeight / design.height, 0, 0);
    ctx.fillStyle = design.background.color || '#ffffff';
    ctx.fillRect(0, 0, design.width, design.height);
    if (design.background.image) {
      const image = cache.get(design.background.image);
      if (!image || !image.width) throw new Error('背景图片尚未准备好。');
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, design.width, design.height); ctx.clip();
      (design.background.fit === 'contain' ? contain : cover)(ctx, image, 0, 0, design.width, design.height, design.background.focusX, design.background.focusY); ctx.restore();
    }
    design.layers.forEach(function (layer) {
      if (layer.visible === false) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
      ctx.translate(layer.x + layer.w / 2, layer.y + layer.h / 2);
      ctx.rotate((layer.rotation || 0) * Math.PI / 180);
      if (layer.type === 'text') drawText(ctx, layer);
      if (layer.type === 'rect') { ctx.fillStyle = layer.color; ctx.fillRect(-layer.w / 2, -layer.h / 2, layer.w, layer.h); }
      if (layer.type === 'circle') { ctx.fillStyle = layer.color; ctx.beginPath(); ctx.ellipse(0, 0, layer.w / 2, layer.h / 2, 0, 0, Math.PI * 2); ctx.fill(); }
      if (layer.type === 'image') {
        const image = cache.get(layer.src);
        if (image && image.width) { ctx.beginPath(); ctx.rect(-layer.w / 2, -layer.h / 2, layer.w, layer.h); ctx.clip(); (layer.fit === 'contain' ? contain : cover)(ctx, image, -layer.w / 2, -layer.h / 2, layer.w, layer.h, layer.focusX, layer.focusY); }
      }
      if (layer.type === 'kline') drawKline(ctx, layer);
      ctx.restore();
    });
    if (guides && selectedId) {
      ctx.save(); ctx.strokeStyle = 'rgba(22,116,223,.25)'; ctx.lineWidth = 1; ctx.setLineDash([5, 7]);
      ctx.beginPath(); ctx.moveTo(design.width / 2, 0); ctx.lineTo(design.width / 2, design.height); ctx.moveTo(0, design.height / 2); ctx.lineTo(design.width, design.height / 2); ctx.stroke(); ctx.restore();
    }
    if (selectedId) {
      const layer = design.layers.find(function (item) { return item.id === selectedId && item.visible !== false; });
      if (layer) {
        ctx.save(); ctx.translate(layer.x + layer.w / 2, layer.y + layer.h / 2); ctx.rotate((layer.rotation || 0) * Math.PI / 180);
        ctx.strokeStyle = '#1674df'; ctx.lineWidth = 2;
        ctx.setLineDash([7, 5]); ctx.strokeRect(-layer.w / 2, -layer.h / 2, layer.w, layer.h); ctx.setLineDash([]);
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1674df';
        [[-layer.w / 2, -layer.h / 2], [layer.w / 2, -layer.h / 2], [-layer.w / 2, layer.h / 2], [layer.w / 2, layer.h / 2]].forEach(function (point) {
          ctx.fillRect(point[0] - 6, point[1] - 6, 12, 12); ctx.strokeRect(point[0] - 6, point[1] - 6, 12, 12);
        });
        ctx.restore();
      }
    }
    return canvas;
  }

  async function render(canvas, design, pixelWidth, pixelHeight, selectedId, guides) {
    await prepare(design);
    return renderPrepared(canvas, design, pixelWidth, pixelHeight, selectedId, guides);
  }

  function hitTest(design, x, y, selectedId, handleRadius = 17) {
    function localPoint(layer) {
      const cx = layer.x + layer.w / 2, cy = layer.y + layer.h / 2;
      const a = -(layer.rotation || 0) * Math.PI / 180;
      const dx = x - cx, dy = y - cy;
      return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
    }
    const selected = design.layers.find(function (layer) { return layer.id === selectedId && layer.visible !== false && !layer.locked; });
    if (selected) {
      const point = localPoint(selected);
      const corners = [
        ['tl', -selected.w / 2, -selected.h / 2], ['tr', selected.w / 2, -selected.h / 2],
        ['bl', -selected.w / 2, selected.h / 2], ['br', selected.w / 2, selected.h / 2]
      ];
      for (const corner of corners) {
        const radius = Math.min(handleRadius, selected.w / 3, selected.h / 3);
        if (Math.abs(point.x - corner[1]) < radius && Math.abs(point.y - corner[2]) < radius) return { id: selected.id, action: 'resize', corner: corner[0] };
      }
    }
    for (let i = design.layers.length - 1; i >= 0; i--) {
      const layer = design.layers[i];
      if (layer.visible === false || layer.locked) continue;
      const point = localPoint(layer);
      if (Math.abs(point.x) <= layer.w / 2 && Math.abs(point.y) <= layer.h / 2) return { id: layer.id, action: 'move' };
    }
    return null;
  }

  ns.EditorRender = { render: render, renderPrepared: renderPrepared, prepare: prepare, hitTest: hitTest, drawKline: drawKline };
})(window);
