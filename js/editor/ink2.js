(function (root) {
  'use strict';
  const ns = root.YINK = root.YINK || {};
  const canvases = new Map();

  function samplePoints(sample, x, y) {
    return sample.map(function (item) { return [x(item.index), y(item.bar.close)]; });
  }

  function offscreen(width, height, type) {
    const key = type + ':' + width + 'x' + height;
    if (canvases.has(key)) return canvases.get(key);
    if (canvases.size >= 4) canvases.delete(canvases.keys().next().value);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvases.set(key, canvas);
    return canvas;
  }

  function drawGuide(ctx, points, width) {
    ctx.save();
    ctx.strokeStyle = 'rgba(65,59,53,0.37)';
    ctx.lineWidth = Math.max(0.7, width * 0.72);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    points.forEach(function (point, index) {
      if (index) ctx.lineTo(point[0], point[1] - 3.2);
      else ctx.moveTo(point[0], point[1] - 3.2);
    });
    ctx.stroke(); ctx.restore();
  }

  function fillTube(ctx, points, radius, alpha, phase) {
    const squiggy = root.squiggy || globalThis.squiggy;
    if (!squiggy || points.length < 2) return;
    const tube = squiggy.tube_brush(function (point) {
      const variation = 0.83 + 0.16 * Math.sin(point.d * 0.073 + phase) + 0.12 * Math.sin(point.d * 0.21 + phase * 1.7);
      return { w: Math.max(0.28, radius * variation) };
    }, { join: 'round', cap: 'round' });
    ctx.save(); ctx.fillStyle = '#181614'; ctx.globalAlpha *= alpha;
    tube(points, { clean: false }).forEach(function (polygon) {
      if (polygon.length < 3) return;
      ctx.beginPath();
      polygon.forEach(function (point, index) { if (index) ctx.lineTo(point[0], point[1]); else ctx.moveTo(point[0], point[1]); });
      ctx.closePath(); ctx.fill();
    });
    ctx.restore();
  }

  function drawFallback(ctx, points, layer, style, scale) {
    const squiggy = root.squiggy || globalThis.squiggy;
    if (!squiggy) throw new Error('本地水墨笔刷未加载。');
    const width = Math.max(1, Math.round(layer.w * scale));
    const height = Math.max(1, Math.round(layer.h * scale));
    const canvas = offscreen(width, height, '2d');
    const brushCtx = canvas.getContext('2d');
    if (!brushCtx) throw new Error('浏览器无法创建水墨画布。');
    brushCtx.globalCompositeOperation = 'source-over';
    brushCtx.globalAlpha = 1;
    brushCtx.setTransform(scale, 0, 0, scale, width / 2, height / 2);
    brushCtx.clearRect(-layer.w / 2, -layer.h / 2, layer.w, layer.h);
    const path = squiggy.preprocess(points, [{ type: 'resample', step: 2.4 }]);
    const weight = Number(style.strokeWidth) || 1;
    const dryness = Number(style.inkDryness) || 1;
    const base = Math.max(2.5, weight * 3.3);
    fillTube(brushCtx, path, base * 1.2, 0.045, 0.3);
    fillTube(brushCtx, path, base * 0.76, 0.28, 1.7);
    // Several overlapping shorter loaded strokes create pooling and lifted dry sections.
    for (let start = 0; start < path.length - 1;) {
      const length = 25 + Math.round(12 * (1 + Math.sin(start * 0.13)));
      const end = Math.min(path.length, start + length);
      const fragment = path.slice(start, end);
      const pressureValue = 0.72 + 0.18 * Math.sin(start * 0.19 + 0.6);
      fillTube(brushCtx, fragment, base * pressureValue, 0.54, start * 0.02);
      start = end - 1;
    }
    brushCtx.save();
    brushCtx.lineCap = 'round'; brushCtx.lineJoin = 'round';
    for (let fiber = 0; fiber < 7; fiber++) {
      brushCtx.strokeStyle = 'rgba(36,33,30,' + (0.19 + fiber * 0.04) + ')';
      brushCtx.lineWidth = Math.max(0.45, base * (0.055 + fiber * 0.009));
      brushCtx.beginPath();
      let open = false;
      path.forEach(function (point, index) {
        const previous = path[Math.max(0, index - 1)], next = path[Math.min(path.length - 1, index + 1)];
        const dx = next[0] - previous[0], dy = next[1] - previous[1];
        const distance = Math.max(0.01, Math.hypot(dx, dy));
        const run = (index + fiber * 23) % (47 + fiber * 4) < (33 - dryness * 4 + fiber);
        if (!run) { open = false; return; }
        const offset = (fiber - 3.5) * base * 0.2 + Math.sin(index * 0.17 + fiber) * base * 0.1;
        const px = point[0] - dy / distance * offset;
        const py = point[1] + dx / distance * offset;
        if (open) brushCtx.lineTo(px, py); else brushCtx.moveTo(px, py);
        open = true;
      });
      brushCtx.stroke();
    }
    brushCtx.restore();
    // Remove intermittent narrow channels from the isolated layer, preserving transparency.
    brushCtx.save();
    brushCtx.globalCompositeOperation = 'destination-out';
    brushCtx.lineCap = 'round';
    for (let gap = 12; gap < path.length - 12; gap += Math.max(22, Math.round(47 / dryness))) {
      const length = Math.min(path.length - gap - 1, 8 + Math.round(dryness * 6));
      brushCtx.strokeStyle = 'rgba(0,0,0,0.72)';
      brushCtx.lineWidth = Math.max(0.6, base * 0.1);
      brushCtx.beginPath();
      for (let i = 0; i < length; i++) {
        const point = path[gap + i];
        if (i) brushCtx.lineTo(point[0], point[1] + base * 0.16);
        else brushCtx.moveTo(point[0], point[1] + base * 0.16);
      }
      brushCtx.stroke();
    }
    brushCtx.restore();
    ctx.drawImage(canvas, -layer.w / 2, -layer.h / 2, layer.w, layer.h);
  }

  function draw(ctx, sample, x, y, layer, style) {
    if (sample.length < 2) return;
    const points = samplePoints(sample, x, y);
    if (style.inkGhost !== false) drawGuide(ctx, points, Number(style.strokeWidth) || 1.5);
    let scale = 2;
    if (typeof ctx.getTransform === 'function') {
      const transform = ctx.getTransform();
      scale = Math.max(1, Math.min(2.5, Math.max(Math.abs(transform.a), Math.abs(transform.d))));
    }
    scale = Math.min(scale, 2400 / layer.w, 1400 / layer.h);
    drawFallback(ctx, points, layer, style, scale);
    // A fine data spine keeps the exact closing-price path readable through dry sections.
    ctx.save();
    ctx.strokeStyle = 'rgba(24,22,20,0.58)';
    ctx.lineWidth = 0.85;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach(function (point, index) { if (index) ctx.lineTo(point[0], point[1]); else ctx.moveTo(point[0], point[1]); });
    ctx.stroke();
    ctx.restore();
  }

  ns.EditorInk2 = { draw: draw };
})(window);
