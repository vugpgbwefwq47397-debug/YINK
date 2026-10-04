(function (root) {
  'use strict';
  const ns = root.YINK = root.YINK || {};
  const presets = [
    { id: 'ink-cloud', name: '墨韵 · 云染', width: 760, height: 760, layerW: 420, layerH: 420 },
    { id: 'ink-spray', name: '墨韵 · 飞溅', width: 760, height: 760, layerW: 400, layerH: 400 },
    { id: 'ink-flow', name: '墨韵 · 流痕', width: 900, height: 520, layerW: 520, layerH: 300 },
    { id: 'ink-splash-background', name: '墨韵 · 泼墨背景', width: 1536, height: 1024, layerW: 900, layerH: 600, behindKline: true },
    { id: 'yink-logo', name: '盈刻 Logo', width: 368, height: 368, layerW: 160, layerH: 160 }
  ];

  function wrap(width, height, body) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">' + body + '</svg>';
  }

  function inkDefs(seed, frequency, scale) {
    return '<defs><filter id="b" x="-35%" y="-35%" width="170%" height="170%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="' + frequency + '" numOctaves="3" seed="' + seed + '" result="grain"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="grain" scale="' + scale + '" xChannelSelector="R" yChannelSelector="G"/>' +
      '<feGaussianBlur stdDeviation="1.8"/></filter>' +
      '<radialGradient id="ink"><stop offset="0" stop-color="#171512" stop-opacity=".87"/>' +
      '<stop offset=".58" stop-color="#24211e" stop-opacity=".55"/>' +
      '<stop offset="1" stop-color="#494641" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="wash"><stop offset="0" stop-color="#282522" stop-opacity=".58"/>' +
      '<stop offset=".68" stop-color="#44403a" stop-opacity=".24"/>' +
      '<stop offset="1" stop-color="#55504a" stop-opacity="0"/></radialGradient></defs>';
  }

  function cloudSvg() {
    const flecks = [[124, 286, 8], [186, 164, 5], [574, 180, 7], [638, 332, 4], [548, 562, 9], [211, 596, 5], [91, 433, 3], [619, 493, 3]];
    return wrap(760, 760, inkDefs(8, '.017', 29) +
      '<g filter="url(#b)"><path d="M115 346c-29-68 7-129 79-152 32-81 128-91 193-47 72-45 171-1 180 85 78 27 110 117 58 180 35 78-20 154-108 160-45 73-143 79-207 38-89 29-178-26-176-112-68-36-73-108-19-152Z" fill="url(#wash)"/>' +
      '<path d="M190 343c-7-73 54-130 123-127 38-47 107-48 155-13 62-19 123 30 120 91 48 42 49 105 10 152 8 70-55 122-124 106-49 43-121 32-151-18-69 10-130-44-116-111-36-29-42-61-17-80Z" fill="url(#ink)"/>' +
      '<ellipse cx="379" cy="366" rx="162" ry="131" fill="#201d1a" opacity=".32"/></g>' +
      flecks.map(function (spot, i) { return '<ellipse cx="' + spot[0] + '" cy="' + spot[1] + '" rx="' + spot[2] + '" ry="' + (spot[2] * (i % 2 ? 1.35 : 0.82)) + '" fill="#292622" opacity="' + (0.26 + i % 3 * 0.12) + '"/>'; }).join(''));
  }

  function spraySvg() {
    const drops = [
      [135, 148, 12], [183, 119, 7], [239, 184, 10], [111, 255, 6], [207, 280, 17], [298, 107, 5],
      [522, 129, 12], [602, 188, 8], [653, 254, 4], [556, 301, 11], [691, 370, 6], [606, 454, 18],
      [522, 542, 7], [427, 645, 10], [301, 580, 6], [164, 501, 14], [84, 417, 5], [270, 658, 4],
      [587, 588, 4], [468, 84, 3], [103, 603, 4], [669, 547, 3], [376, 130, 5], [146, 352, 3]
    ];
    return wrap(760, 760, inkDefs(17, '.028', 20) +
      '<g filter="url(#b)"><path d="M270 256c-11-58 30-103 77-112 32-34 87-28 111 8 55-3 91 42 78 90 42 35 38 88-5 115 14 55-20 106-75 109-31 48-92 59-134 27-50 12-101-18-111-65-48-19-67-78-34-117 12-28 43-44 93-55Z" fill="url(#wash)"/>' +
      '<path d="M293 285c-19-38 17-81 58-76 20-32 62-35 90-14 43-5 75 29 69 66 35 21 33 65 7 89 13 39-16 72-55 76-24 35-68 34-99 13-36 13-70-10-81-45-41-8-58-45-39-77 7-16 25-27 50-32Z" fill="url(#ink)"/></g>' +
      drops.map(function (drop, i) { return '<ellipse cx="' + drop[0] + '" cy="' + drop[1] + '" rx="' + drop[2] + '" ry="' + (drop[2] * (0.7 + i % 4 * 0.19)).toFixed(2) + '" fill="#24211d" opacity="' + (0.25 + i % 5 * 0.12).toFixed(2) + '"/>'; }).join('') +
      '<path d="m158 205-34-28m450 316 43 26M247 94l-20-34m357 86 29-31m-466 432-34 14" fill="none" stroke="#27231f" stroke-width="3" stroke-linecap="round" opacity=".42"/>');
  }

  function flowSvg() {
    const flecks = [[110, 210, 8], [175, 135, 5], [314, 93, 4], [588, 423, 9], [720, 331, 6], [796, 252, 4], [254, 443, 3], [464, 467, 5]];
    return wrap(900, 520, inkDefs(25, '.021', 25) +
      '<g filter="url(#b)"><path d="M85 304c113-119 214-157 315-111 91-40 175-13 263 53 59-11 113 4 159 36-98-3-179 33-253 74-92-5-144 6-226 51-103-12-174-52-258-103Z" fill="url(#wash)"/>' +
      '<path d="M115 309c106-62 210-130 313-93 88-18 180 26 263 79-98-13-178 26-266 66-88 1-187-34-310-52Z" fill="url(#ink)"/></g>' +
      '<g stroke="#25211d" fill="none" stroke-linecap="round"><path d="M85 324c169-95 290-110 430-53 98 40 175 43 307 17" stroke-width="8" opacity=".38"/>' +
      '<path d="M128 352c149-54 251-60 358-14 81 30 167 37 266 9" stroke-width="3" opacity=".27"/>' +
      '<path d="M169 239c142-76 264-82 399-2" stroke-width="2" opacity=".2"/></g>' +
      flecks.map(function (spot, i) { return '<ellipse cx="' + spot[0] + '" cy="' + spot[1] + '" rx="' + spot[2] + '" ry="' + (spot[2] * 0.7) + '" fill="#28241f" opacity="' + (0.25 + i % 4 * 0.12) + '"/>'; }).join(''));
  }

  // Matches the vector mark currently used in assets/yink-logo.svg.
  function logoSvg() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="368" height="368" viewBox="38 35 174 184">' +
      '<path d="M53 56 125 128 197 56" fill="none" stroke="#272522" stroke-width="24" stroke-linecap="square" stroke-linejoin="miter"/>' +
      '<path d="M125 128v73" stroke="#272522" stroke-width="24" stroke-linecap="square"/>' +
      '<path d="m77 153 32-33 19 17 42-48 21-16" fill="none" stroke="#b25937" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="191" cy="73" r="8" fill="#b25937"/><path d="M61 183h31" stroke="#272522" stroke-width="4" stroke-linecap="square"/></svg>';
  }

  const art = { 'ink-cloud': cloudSvg, 'ink-spray': spraySvg, 'ink-flow': flowSvg, 'yink-logo': logoSvg };
  function get(id) { return presets.find(function (preset) { return preset.id === id; }) || null; }
  function preview(id) {
    if (id === 'ink-splash-background') return ns.InkSplashData || null;
    return art[id] ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(art[id]()) : null;
  }
  function create(id) {
    const preset = get(id);
    if (!preset) return Promise.reject(new Error('预设贴图不存在。'));
    if (id === 'ink-splash-background') {
      const src = preview(id);
      return src ? Promise.resolve({ name: preset.name, src: src, w: preset.layerW, h: preset.layerH }) : Promise.reject(new Error('预设贴图无法加载。'));
    }
    return new Promise(function (resolve, reject) {
      const image = new root.Image();
      image.onload = function () {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = preset.width; canvas.height = preset.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('当前浏览器无法绘制预设贴图。');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve({ name: preset.name, src: canvas.toDataURL('image/png'), w: preset.layerW, h: preset.layerH });
        } catch (error) { reject(error); }
      };
      image.onerror = function () { reject(new Error('预设贴图无法加载。')); };
      image.src = preview(id);
    });
  }

  ns.EditorStickers = { presets: presets, preview: preview, create: create };
})(window);
