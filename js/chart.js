(function (root) {
  'use strict';
  const ns = root.YINK = root.YINK || {};

  class KlineChart {
    constructor(canvas, onSelect, onHover) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.onSelect = onSelect;
      this.onHover = onHover;
      this.bars = [];
      this.events = [];
      this.start = 0;
      this.count = 0;
      this.selected = -1;
      this.hovered = -1;
      this.drag = null;
      this.width = 0;
      this.height = 0;
      canvas.addEventListener('pointerdown', this.pointerDown.bind(this));
      canvas.addEventListener('pointermove', this.pointerMove.bind(this));
      canvas.addEventListener('pointerup', this.pointerUp.bind(this));
      canvas.addEventListener('pointercancel', this.pointerCancel.bind(this));
      canvas.addEventListener('pointerleave', this.pointerLeave.bind(this));
      canvas.addEventListener('wheel', this.wheel.bind(this), { passive: false });
      if (root.ResizeObserver) new root.ResizeObserver(this.resize.bind(this)).observe(canvas);
      else root.addEventListener('resize', this.resize.bind(this));
      root.addEventListener('yink:themechange', this.draw.bind(this));
    }

    setData(bars) {
      if (this.drag && this.canvas.hasPointerCapture(this.drag.pointerId)) this.canvas.releasePointerCapture(this.drag.pointerId);
      this.drag = null;
      this.bars = bars || [];
      this.count = Math.min(this.bars.length, 90);
      this.start = Math.max(0, this.bars.length - this.count);
      this.selected = -1;
      this.hovered = -1;
      this.resize();
    }

    setEvents(events) { this.events = events || []; this.draw(); }
    setSelected(index) { this.selected = index; this.draw(); }
    reset() { this.count = Math.min(this.bars.length, 90); this.start = Math.max(0, this.bars.length - this.count); this.draw(); }

    zoom(direction) {
      if (!this.bars.length) return;
      const minimum = Math.min(12, this.bars.length);
      const next = Math.max(minimum, Math.min(this.bars.length, Math.round(this.count * (direction > 0 ? 0.75 : 1.33))));
      const midpoint = this.start + this.count / 2;
      this.count = next;
      this.start = Math.max(0, Math.min(this.bars.length - next, Math.round(midpoint - next / 2)));
      this.draw();
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(root.devicePixelRatio || 1, 2);
      this.width = rect.width;
      this.height = rect.height;
      this.canvas.width = Math.round(rect.width * dpr);
      this.canvas.height = Math.round(rect.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.draw();
    }

    dimensions() { return { left: this.width < 450 ? 52 : 68, right: this.width - (this.width < 450 ? 12 : 23), top: 25, bottom: this.height - 43 }; }

    indexAt(x) {
      if (!this.bars.length || !this.count) return -1;
      const d = this.dimensions();
      if (x < d.left || x > d.right) return -1;
      const index = this.start + Math.floor((x - d.left) / ((d.right - d.left) / this.count));
      return Math.min(this.start + this.count - 1, index);
    }

    pointerDown(event) {
      if (!this.bars.length || this.drag) return;
      this.drag = { pointerId: event.pointerId, x: event.offsetX, origin: this.start, moved: false };
      this.canvas.setPointerCapture(event.pointerId);
    }

    pointerMove(event) {
      if (this.drag && this.drag.pointerId === event.pointerId) {
        const distance = event.offsetX - this.drag.x;
        if (Math.abs(distance) > 4) this.drag.moved = true;
        if (this.drag.moved) {
          const d = this.dimensions();
          const step = (d.right - d.left) / this.count;
          this.start = Math.max(0, Math.min(this.bars.length - this.count, this.drag.origin - Math.round(distance / step)));
          this.draw();
        }
      }
      const index = this.indexAt(event.offsetX);
      if (index !== this.hovered) {
        this.hovered = index;
        this.onHover(index < 0 ? null : this.bars[index]);
        this.draw();
      }
    }

    pointerUp(event) {
      if (!this.drag || this.drag.pointerId !== event.pointerId) return;
      const moved = this.drag.moved;
      this.drag = null;
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
      if (!moved) {
        const index = this.indexAt(event.offsetX);
        if (index >= 0) {
          this.selected = index;
          this.onSelect(index, this.bars[index]);
          this.draw();
        }
      }
    }

    pointerCancel(event) {
      if (!this.drag || this.drag.pointerId !== event.pointerId) return;
      this.drag = null;
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    }

    pointerLeave() { if (!this.drag) { this.hovered = -1; this.onHover(null); this.draw(); } }
    wheel(event) { event.preventDefault(); this.zoom(event.deltaY < 0 ? 1 : -1); }

    draw() {
      const ctx = this.ctx;
      const w = this.width, h = this.height;
      if (!w || !h) return;
      const dark = typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute && document.documentElement.getAttribute('data-ui-theme') === 'dark';
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = dark ? '#28231f' : '#fffdf7'; ctx.fillRect(0, 0, w, h);
      if (!this.bars.length || !this.count) return;
      const d = this.dimensions();
      const visible = this.bars.slice(this.start, this.start + this.count);
      const visibleDates = new Set(visible.map(function (bar) { return bar.date; }));
      const eventPrices = this.events.filter(function (event) { return visibleDates.has(event.date) && Number.isFinite(event.price); }).map(function (event) { return event.price; });
      const low = Math.min.apply(null, visible.map(function (bar) { return bar.low; }).concat(eventPrices));
      const high = Math.max.apply(null, visible.map(function (bar) { return bar.high; }).concat(eventPrices));
      const padding = Math.max((high - low) * 0.1, high * 0.003, 0.01);
      const min = low - padding, max = high + padding;
      const y = function (price) { return d.bottom - (price - min) / (max - min) * (d.bottom - d.top); };
      const step = (d.right - d.left) / this.count;
      const x = function (offset) { return d.left + (offset + 0.5) * step; };
      ctx.font = '11px Arial'; ctx.textBaseline = 'middle';
      for (let i = 0; i <= 4; i++) {
        const yy = d.top + (d.bottom - d.top) * i / 4;
        ctx.strokeStyle = dark ? '#4b4037' : '#e8e4da'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(d.left, yy); ctx.lineTo(d.right, yy); ctx.stroke();
        ctx.fillStyle = dark ? '#bcae9e' : '#8b867e'; ctx.textAlign = 'right';
        ctx.fillText((max - (max - min) * i / 4).toFixed(2), d.left - 9, yy, d.left - 12);
      }
      const compact = w < 450;
      const labelIndexes = new Set(compact ? [0, visible.length - 1] : [0, Math.round((visible.length - 1) / 2), visible.length - 1]);
      labelIndexes.forEach(function (index) {
        ctx.fillStyle = dark ? '#bcae9e' : '#8b867e'; ctx.textAlign = index === 0 ? 'left' : index === visible.length - 1 ? 'right' : 'center';
        const labelX = compact ? (index === 0 ? d.left + 2 : d.right - 2) : x(index);
        ctx.fillText(visible[index].date, labelX, h - 20, compact ? (d.right - d.left) / 2 - 6 : w);
      });
      visible.forEach(function (bar, i) {
        const xx = x(i);
        const up = bar.close >= bar.open;
        const color = up ? (dark ? '#ed9b61' : '#b25937') : (dark ? '#8db9a4' : '#42685c');
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(xx, y(bar.high)); ctx.lineTo(xx, y(bar.low)); ctx.stroke();
        const bodyWidth = Math.max(2, Math.min(10, step * 0.58));
        const bodyTop = Math.min(y(bar.open), y(bar.close));
        ctx.fillRect(xx - bodyWidth / 2, bodyTop, bodyWidth, Math.max(1.5, Math.abs(y(bar.open) - y(bar.close))));
      });
      const markers = this.events.map(function (event) {
        const index = visible.findIndex(function (bar) { return bar.date === event.date; });
        return index < 0 ? null : { event: event, x: x(index), y: y(event.price) };
      }).filter(Boolean).sort(function (a, b) { return a.event.date.localeCompare(b.event.date); });
      const occupied = new Map();
      markers.forEach(function (marker) {
        const used = occupied.get(marker.event.date) || [];
        const clamp = function (value) { return Math.max(d.top + 20, Math.min(d.bottom - 8, value)); };
        marker.drawY = clamp(marker.y);
        for (let attempt = 0; attempt < 30 && used.some(function (value) { return Math.abs(value - marker.drawY) < 22; }); attempt++) {
          const distance = 24 * (Math.floor(attempt / 2) + 1) * (attempt % 2 ? 1 : -1);
          marker.drawY = clamp(marker.y + distance);
        }
        used.push(marker.drawY);
        occupied.set(marker.event.date, used);
      });
      if (markers.length >= 2) {
        ctx.strokeStyle = dark ? '#b4a294' : '#6b6255'; ctx.lineWidth = 1.2; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(markers[0].x, markers[0].y);
        markers.slice(1).forEach(function (marker) { ctx.lineTo(marker.x, marker.y); });
        ctx.stroke(); ctx.setLineDash([]);
      }
      markers.forEach(function (marker) {
        const color = marker.event.type === 'BUY' ? (dark ? '#ed9b61' : '#b25937') : (dark ? '#8db9a4' : '#42685c');
        if (Math.abs(marker.drawY - marker.y) > 1) {
          ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
          ctx.beginPath(); ctx.moveTo(marker.x, marker.y); ctx.lineTo(marker.x, marker.drawY); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(marker.x, marker.drawY, 5, 0, Math.PI * 2); ctx.fill();
        ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(marker.event.type, marker.x, marker.drawY - 10);
      });
      [this.hovered, this.selected].forEach(function (index, order) {
        if (index < this.start || index >= this.start + visible.length) return;
        const xx = x(index - this.start);
        ctx.strokeStyle = order === 0 ? (dark ? '#877b70' : '#bcb7ac') : (dark ? '#f0e8dc' : '#292722'); ctx.lineWidth = order === 0 ? 1 : 1.5;
        ctx.beginPath(); ctx.moveTo(xx, d.top); ctx.lineTo(xx, d.bottom); ctx.stroke();
      }, this);
    }
  }

  ns.KlineChart = KlineChart;
})(window);
