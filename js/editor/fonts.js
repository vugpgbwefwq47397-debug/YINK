(function (root) {
  'use strict';
  const ns = root.YINK = root.YINK || {};
  const presets = {
    'noto-sans-sc': { family: 'YINK Noto Sans SC', file: 'assets/fonts/NotoSansSC.ttf', fallback: 'sans-serif' },
    'zcool-xiaowei': { family: 'YINK ZCOOL XiaoWei', file: 'assets/fonts/ZCOOLXiaoWei-Regular.ttf', fallback: 'serif' },
    inter: { family: 'YINK Inter', file: 'assets/fonts/Inter.ttf', fallback: 'sans-serif' },
    'dm-serif-display': { family: 'YINK DM Serif Display', file: 'assets/fonts/DMSerifDisplay-Regular.ttf', fallback: 'serif' },
    'space-mono': { family: 'YINK Space Mono', file: 'assets/fonts/SpaceMono-Regular.ttf', fallback: 'monospace' },
    'noto-serif-sc': { family: 'YINK Noto Serif SC', file: 'assets/fonts/NotoSerifSC.ttf', fallback: 'serif' },
    'ma-shan-zheng': { family: 'YINK Ma Shan Zheng', file: 'assets/fonts/MaShanZheng-Regular.ttf', fallback: 'serif' },
    'zhi-mang-xing': { family: 'YINK Zhi Mang Xing', file: 'assets/fonts/ZhiMangXing-Regular.ttf', fallback: 'serif' },
    'liu-jian-mao-cao': { family: 'YINK Liu Jian Mao Cao', file: 'assets/fonts/LiuJianMaoCao-Regular.ttf', fallback: 'serif' },
    'long-cang': { family: 'YINK Long Cang', file: 'assets/fonts/LongCang-Regular.ttf', fallback: 'serif' },
    'zcool-qingke': { family: 'YINK ZCOOL QingKe', file: 'assets/fonts/ZCOOLQingKeHuangYou-Regular.ttf', fallback: 'sans-serif' },
    'bebas-neue': { family: 'YINK Bebas Neue', file: 'assets/fonts/BebasNeue-Regular.ttf', fallback: 'sans-serif' },
    'playfair-display': { family: 'YINK Playfair Display', file: 'assets/fonts/PlayfairDisplay.ttf', fallback: 'serif' },
    caveat: { family: 'YINK Caveat', file: 'assets/fonts/Caveat.ttf', fallback: 'cursive' },
    bungee: { family: 'YINK Bungee', file: 'assets/fonts/Bungee-Regular.ttf', fallback: 'sans-serif' }
  };
  const loaded = new Map();
  const customFamilies = new Map();
  let nextCustom = 0;
  const CUSTOM_DATA = /^data:font\/(?:ttf|otf|woff|woff2);base64,[A-Za-z0-9+/]+={0,2}$/;
  const MAX_FONT_DATA = Math.ceil(20 * 1024 * 1024 * 4 / 3) + 64;

  function validLayer(layer) {
    const choice = layer.font || 'serif';
    if (choice !== 'serif' && choice !== 'sans' && choice !== 'custom' && !presets[choice]) return false;
    if (choice === 'custom' && (typeof layer.fontData !== 'string' || layer.fontData.length > MAX_FONT_DATA || !CUSTOM_DATA.test(layer.fontData))) return false;
    if (choice !== 'custom' && layer.fontData != null) return false;
    if (layer.fontName != null && (typeof layer.fontName !== 'string' || layer.fontName.length > 100)) return false;
    return true;
  }

  function load(key, family, source) {
    if (!loaded.has(key)) {
      const pending = (async function () {
        if (!root.FontFace || !document.fonts) throw new Error('当前浏览器不支持加载字体文件。');
        const face = new root.FontFace(family, 'url("' + source + '")');
        await face.load();
        document.fonts.add(face);
        return family;
      })().catch(function () { loaded.delete(key); throw new Error('字体文件无法加载，请检查字体文件或离线包。'); });
      loaded.set(key, pending);
    }
    return loaded.get(key);
  }

  function prepareLayer(layer) {
    const choice = layer.font || 'serif';
    if (choice === 'serif' || choice === 'sans') return Promise.resolve();
    if (choice === 'custom') {
      if (!validLayer(layer)) return Promise.reject(new Error('自定义字体数据无效。'));
      if (!customFamilies.has(layer.fontData)) customFamilies.set(layer.fontData, 'YINK Custom ' + (++nextCustom));
      return load(layer.fontData, customFamilies.get(layer.fontData), layer.fontData);
    }
    const preset = presets[choice];
    if (!preset) return Promise.reject(new Error('字体选项无效。'));
    return load(choice, preset.family, preset.file);
  }

  function familyFor(layer) {
    const choice = layer.font || 'serif';
    if (choice === 'sans') return 'Arial, "Microsoft YaHei", sans-serif';
    if (choice === 'custom' && customFamilies.has(layer.fontData)) return '"' + customFamilies.get(layer.fontData) + '", sans-serif';
    if (presets[choice]) return '"' + presets[choice].family + '", ' + presets[choice].fallback;
    return 'Georgia, "Songti SC", serif';
  }

  ns.EditorFonts = { presets: presets, validLayer: validLayer, prepareLayer: prepareLayer, familyFor: familyFor, maxFileBytes: 20 * 1024 * 1024 };
})(window);
