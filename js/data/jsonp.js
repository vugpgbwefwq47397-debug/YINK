(function (root) {
  'use strict';
  const ns = root.YINK = root.YINK || {};
  let sequence = 0;

  // Script requests work from file:// without fetch/CORS when the endpoint supports JSONP.
  function requestJsonp(endpoint, params, timeoutMs) {
    return new Promise(function (resolve, reject) {
      const callback = '__yink_jsonp_' + Date.now() + '_' + (++sequence);
      const query = new URLSearchParams(Object.assign({}, params, { cb: callback, _: Date.now() }));
      const script = document.createElement('script');
      let finished = false;
      let timer;

      function finish(error, data) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        script.remove();
        try { delete root[callback]; } catch (_) { root[callback] = undefined; }
        if (error) reject(error); else resolve(data);
      }

      root[callback] = function (data) { finish(null, data); };
      script.onerror = function () { finish(new Error('行情接口无法连接。请检查网络，或切换到 CSV 导入。')); };
      script.onload = function () {
        if (!finished) finish(new Error('行情接口没有返回 JSONP 回调。请使用 CSV 导入。'));
      };
      script.src = endpoint + '?' + query.toString();
      timer = setTimeout(function () { finish(new Error('行情接口响应超时。请重试或使用 CSV 导入。')); }, timeoutMs || 12000);
      document.head.appendChild(script);
    });
  }

  ns.requestJsonp = requestJsonp;
})(window);
