(function (root) {
  'use strict';
  const ns = root.YINK = root.YINK || {};

  function renderPoster(canvas, state, width, height) {
    if (!state || !state.trade || !state.security || !Array.isArray(state.bars)) throw new Error('缺少海报所需的交易数据。');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const scale = width / 1000;
    const h = height / scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const opt = state.options || {};
    const obsidian = opt.template === 'obsidian';
    const dark = opt.background === 'dark' || (opt.background !== 'light' && obsidian);
    const palette = {
      bg: dark ? '#171a1a' : '#f5f2e9',
      ink: dark ? '#f2ecdf' : '#242724',
      muted: dark ? '#a9aa9e' : '#797c75',
      line: dark ? '#484a45' : '#c9c9be',
      accent: dark ? '#d0aa6b' : state.trade.returnPct < 0 ? '#477666' : '#a75037'
    };
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, 1000, h);

    function text(value, x, y, font, color, align) {
      ctx.font = font; ctx.fillStyle = color || palette.ink;
      ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(String(value), x, y);
    }
    function fit(value, x, y, maxWidth, size, family, color, align) {
      let current = size;
      do { ctx.font = current + 'px ' + family; current -= 2; } while (ctx.measureText(String(value)).width > maxWidth && current > 22);
      ctx.font = (current + 2) + 'px ' + family;
      ctx.fillStyle = color || palette.ink;
      ctx.textAlign = align || 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(String(value), x, y, maxWidth);
    }
    function line(x1, y1, x2, y2, color, thickness) {
      ctx.strokeStyle = color || palette.line; ctx.lineWidth = thickness || 1;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    function small(value, x, y, align) { text(value, x, y, '18px Arial, sans-serif', palette.muted, align); }
    function money(value) { return Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function percent(value) { return (value >= 0 ? '+' : '') + value.toFixed(2) + '%'; }
    const currency = state.currency || 'USD';
    const symbol = state.security.symbol || '';
    const name = state.security.name || symbol;
    const trade = state.trade;
    const show = function (key) { return opt[key] !== false; };

    line(75, 73, 925, 73);
    small('YINK  /  TRADE ARCHIVE', 75, 55);
    small('NO. 001', 925, 55, 'right');

    if (obsidian) {
      if (show('showSymbol')) fit(symbol, 76, 245, 850, 150, 'Georgia, serif', palette.ink);
      if (show('showName')) fit(name.toUpperCase(), 80, 300, 840, 27, 'Arial, sans-serif', palette.muted);
      if (show('showReturn')) fit(percent(trade.returnPct), 75, 450, 850, 148, 'Georgia, serif', palette.accent);
      else small('A MOMENT IN THE MARKET', 80, 430);
      small(trade.mode === 'quantity' ? 'THE PATH OF EVERY DECISION' : 'THE PATH BETWEEN TWO DECISIONS', 76, 500);
    } else {
      small(trade.mode === 'quantity' ? 'A TRADE JOURNEY, PRESERVED.' : 'A SINGLE TRADE, PRESERVED.', 76, 140);
      if (show('showReturn')) fit(percent(trade.returnPct), 72, 310, 850, 164, 'Georgia, serif', palette.accent);
      else fit(symbol || name, 75, 295, 850, 125, 'Georgia, serif', palette.ink);
      if (show('showSymbol') && show('showReturn')) fit(symbol, 76, 405, 850, 95, 'Georgia, serif', palette.ink);
      if (show('showName')) fit(name.toUpperCase(), 80, 455, 840, 25, 'Arial, sans-serif', palette.muted);
    }

    drawTrajectory(ctx, state.bars, trade, palette, obsidian ? 540 : 500, obsidian ? 790 : 770);

    const divider = obsidian ? 850 : 830;
    line(75, divider, 925, divider);
    if (show('showPrices')) {
      small(trade.mode === 'quantity' ? 'WEIGHTED ENTRY  /  EXIT' : 'ENTRY  /  EXIT', 75, divider + 33);
      fit(money(trade.buy.price) + '  →  ' + money(trade.sell.price), 75, divider + 94, 850, 52, 'Georgia, serif', palette.ink);
    }
    if (show('showDates')) small(trade.buy.date + '    —    ' + (trade.endDate || trade.sell.date), 75, divider + 139);
    if (show('showDays')) small(ns.formatHoldingDuration(trade, 'en'), 925, divider + 139, 'right');

    if ((trade.capital != null && show('showCapital')) || (trade.profit != null && show('showProfit'))) {
      line(75, divider + 174, 925, divider + 174);
      if (show('showCapital') && trade.capital != null) {
        small('CAPITAL', 75, divider + 211);
        text(currency + ' ' + money(trade.capital), 75, divider + 252, '31px Georgia, serif');
      }
      if (show('showProfit') && trade.profit != null) {
        small(trade.mode === 'quantity' ? 'TOTAL P / L' : 'P / L', 925, divider + 211, 'right');
        text((trade.profit >= 0 ? '+' : '') + currency + ' ' + money(trade.profit), 925, divider + 252, '31px Georgia, serif', palette.accent, 'right');
      }
    }

    const quote = String(opt.quote || '').trim();
    if (quote) {
      const clipped = quote.length > 90 ? quote.slice(0, 90) : quote;
      const quoteY = Math.max(divider + 290, h - 120);
      fit('“' + clipped + '”', 75, quoteY, 850, 27, 'Georgia, serif', palette.ink);
    }
    line(75, h - 67, 925, h - 67);
    small('TURN YOUR TRADES INTO ART.', 75, h - 34);
    small(state.security.market || '', 925, h - 34, 'right');
    return canvas;
  }

  function drawTrajectory(ctx, bars, trade, palette, top, bottom) {
    const segment = bars.filter(function (bar) { return bar.date >= trade.buy.date && bar.date <= (trade.endDate || trade.sell.date); });
    const source = segment.length >= 2 ? segment : bars;
    if (!source.length) return;
    const maxItems = 115;
    const stride = Math.max(1, Math.ceil(source.length / maxItems));
    const samples = source.map(function (bar, index) { return { bar: bar, index: index }; }).filter(function (item) { return item.index % stride === 0 || item.index === source.length - 1; });
    const events = trade.events || [{ type: 'BUY', date: trade.buy.date, price: trade.buy.price }, { type: 'SELL', date: trade.sell.date, price: trade.sell.price }];
    const prices = events.map(function (event) { return event.price; });
    const low = Math.min.apply(null, source.map(function (bar) { return bar.low; }).concat(prices));
    const high = Math.max.apply(null, source.map(function (bar) { return bar.high; }).concat(prices));
    const pad = Math.max((high - low) * 0.13, high * 0.003, 0.01);
    const min = low - pad, max = high + pad;
    const x = function (index) { return 95 + index * 810 / Math.max(1, source.length - 1); };
    const y = function (price) { return bottom - (price - min) / (max - min) * (bottom - top); };
    ctx.strokeStyle = palette.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(75, bottom + 24); ctx.lineTo(925, bottom + 24); ctx.stroke();
    samples.forEach(function (item) {
      const bar = item.bar, xx = x(item.index);
      ctx.strokeStyle = palette.muted; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.moveTo(xx, y(bar.high)); ctx.lineTo(xx, y(bar.low)); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = palette.ink;
      const width = Math.max(2, Math.min(6, 500 / samples.length));
      ctx.fillRect(xx - width / 2, Math.min(y(bar.open), y(bar.close)), width, Math.max(2, Math.abs(y(bar.open) - y(bar.close))));
    });
    ctx.strokeStyle = palette.accent; ctx.lineWidth = 3; ctx.globalAlpha = 0.85;
    ctx.beginPath(); samples.forEach(function (item, index) { if (index === 0) ctx.moveTo(x(item.index), y(item.bar.close)); else ctx.lineTo(x(item.index), y(item.bar.close)); }); ctx.stroke();
    ctx.globalAlpha = 1;
    const counts = { BUY: 0, SELL: 0 };
    const occupied = new Map();
    const markerY = function (value) { return Math.max(top + 22, Math.min(bottom - 8, value)); };
    events.forEach(function (event) {
      const index = source.findIndex(function (bar) { return bar.date === event.date; });
      if (index < 0) return;
      const xx = x(index), yy = y(event.price);
      const used = occupied.get(event.date) || [];
      let displayY = markerY(yy);
      for (let attempt = 0; attempt < 30 && used.some(function (value) { return Math.abs(value - displayY) < 28; }); attempt++) {
        const distance = 30 * (Math.floor(attempt / 2) + 1) * (attempt % 2 ? 1 : -1);
        displayY = markerY(yy + distance);
      }
      used.push(displayY);
      occupied.set(event.date, used);
      if (Math.abs(displayY - yy) > 1) {
        ctx.strokeStyle = palette.accent; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, displayY); ctx.stroke();
      }
      ctx.fillStyle = palette.accent; ctx.beginPath(); ctx.arc(xx, displayY, 7, 0, Math.PI * 2); ctx.fill();
      ctx.font = 'bold 18px Arial, sans-serif'; ctx.textAlign = event.type === 'BUY' ? 'left' : 'right';
      counts[event.type]++;
      ctx.fillText(events.length > 2 ? event.type + ' ' + counts[event.type] : event.type, xx, displayY - 17);
    });
  }

  ns.renderPoster = renderPoster;
})(window);
