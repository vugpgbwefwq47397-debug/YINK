(function (root) {
  'use strict';
  const ns = root.YINK = root.YINK || {};
  const SIZES = { share: [1920, 2400], print: [2480, 3508] };

  async function exportPoster(state, kind) {
    const size = SIZES[kind];
    if (!size) throw new Error('未知的导出尺寸。');
    const canvas = document.createElement('canvas');
    ns.renderPoster(canvas, state, size[0], size[1]);
    const symbol = String(state.security.symbol || 'TRADE').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) || 'TRADE';
    const filename = 'YINK-' + symbol + '-' + kind + '.png';
    let url;
    if (canvas.toBlob) {
      const blob = await new Promise(function (resolve, reject) {
        canvas.toBlob(function (result) { if (result) resolve(result); else reject(new Error('PNG 渲染失败。')); }, 'image/png');
      });
      url = URL.createObjectURL(blob);
    } else {
      url = canvas.toDataURL('image/png');
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    if (ns.recordGeneration) ns.recordGeneration(canvas, state, kind);
    if (url.startsWith('blob:')) setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    return { filename: filename, width: size[0], height: size[1] };
  }

  ns.exportPoster = exportPoster;
})(window);
