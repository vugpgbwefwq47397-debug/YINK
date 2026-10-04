(function (root) {
  'use strict';
  const STORAGE_KEY = 'yink.ui.settings.v1';
  const translations = new Map([
    ['画布', 'Canvas'],
    ['添加', 'Add'],
    ['编辑器面板', 'Editor panels'],
    ['拖动模块', 'Move modules'],
    ['轻点选择模块，上下滑动浏览；开启“拖动模块”后可移动和缩放。', 'Tap to select a module, swipe to scroll. Enable “Move modules” to move and resize.'],
    ['盈刻 YINK · 揽盘间跌宕，镌一迹风华', 'YINK · Etch the Market in Art'],
    ['盈刻', 'YINK'],
    ['揽盘间跌宕，', "Amid the market's rise and fall,"],
    ['镌一迹风华', 'etch a trace of brilliance'],
    ['继续编辑已有作品', 'Continue an existing project'],
    ['选择项目 JSON', 'Choose project JSON'],
    ['行情数据准备', 'Market data setup'],
    ['数据来源', 'Data source'],
    ['在线行情', 'Online market data'],
    ['导入 CSV', 'Import CSV'],
    ['股票名称或代码', 'Stock name or ticker'],
    ['NVDA / 00700 / 贵州茅台', 'NVDA / 00700 / Kweichow Moutai'],
    ['搜索', 'Search'],
    ['支持 A 股、港股、美股。选择搜索结果后加载历史 K 线。', 'Supports China A shares, Hong Kong stocks, and US stocks. Choose a result to load historical candles.'],
    ['验证三地行情接口', 'Check market data sources'],
    ['从当前浏览器依次搜索并加载 600519、00700、AAPL 的 2025 年 9 月日 K。每只股票会分别显示识别结果和数据条数。', 'Search and load September 2025 daily candles for 600519, 00700, and AAPL. Results and bar counts appear for each market.'],
    ['运行三市场自检', 'Run three market check'],
    ['本地 CSV 文件', 'Local CSV file'],
    ['选择 CSV 文件', 'Choose CSV file'],
    ['一键试用示例数据', 'Try sample data'],
    ['股票代码', 'Ticker'],
    ['可选', 'Optional'],
    ['例如 NVDA', 'e.g. NVDA'],
    ['股票名称', 'Stock name'],
    ['例如 NVIDIA', 'e.g. NVIDIA'],
    ['金额单位', 'Currency'],
    ['表头：', 'Columns:'],
    ['。导入的文件只在浏览器中读取，不会上传。', '. Imported files are read only in this browser and are never uploaded.'],
    ['开始日期', 'Start date'],
    ['结束日期', 'End date'],
    ['开始时刻 · 精确到分钟', 'Start time · to the minute'],
    ['结束时刻 · 精确到分钟', 'End time · to the minute'],
    ['分时与小时 K 按 K 线时间戳筛选；5 分钟 K 不会插值生成单分钟价格。', 'Intraday and hourly candles are filtered by their timestamps. Five minute candles are not interpolated into one minute prices.'],
    ['K 线选取高级设置', 'Advanced candle selection'],
    ['时间级别', 'Time frame'],
    ['自动选择', 'Auto'],
    ['分时 K · 5 分钟', 'Intraday · 5 minutes'],
    ['小时 K', 'Hourly candles'],
    ['日 K', 'Daily candles'],
    ['周 K', 'Weekly candles'],
    ['价格复权', 'Price adjustment'],
    ['不复权', 'Unadjusted'],
    ['前复权', 'Forward adjusted'],
    ['后复权', 'Backward adjusted'],
    ['自动：2 天内优先 5 分钟 K，14 天内小时 K，180 天内日 K，更长区间周 K；数据不可用时回退。CSV 不计算复权；分时 K 需要源文件包含连续的 5 分钟数据。', 'Auto prefers 5 minute candles for up to 2 days, hourly for 14 days, daily for 180 days, and weekly for longer ranges. It falls back when data is unavailable. CSV is not price adjusted; intraday CSV needs consecutive 5 minute records.'],
    ['加载 K 线数据', 'Load candle data'],
    ['请选择股票，或导入 CSV 文件。', 'Choose a stock or import a CSV file.'],
    ['交易编辑', 'Trade editor'],
    ['价格轨迹', 'Price history'],
    ['滚轮缩放 · 左右拖动 · 悬浮查看行情 · 点击选择交易时间', 'Scroll to zoom · Drag horizontally · Hover for prices · Click to choose trade time'],
    ['缩小图表', 'Zoom out'],
    ['放大图表', 'Zoom in'],
    ['重置', 'Reset'],
    ['可交互的 K 线图', 'Interactive candlestick chart'],
    ['将鼠标移到 K 线上查看 OHLC。', 'Hover over a candle to view OHLC.'],
    ['点击一根 K 线以选择日期', 'Click a candle to choose a date'],
    ['添加 BUY', 'Add BUY'],
    ['添加 SELL', 'Add SELL'],
    ['首笔 BUY · 实际成交价', 'First BUY · execution price'],
    ['先选买入日期', 'Choose a buy date first'],
    ['首笔 SELL · 实际成交价', 'First SELL · execution price'],
    ['先选卖出日期', 'Choose a sell date first'],
    ['投入金额 / 参考资金', 'Investment / reference capital'],
    ['例如 10000', 'e.g. 10000'],
    ['货币单位根据市场确定', 'Currency follows the selected market'],
    ['交易节点', 'Trade events'],
    ['0 笔', '0 trades'],
    ['可在图上连续添加买卖点，并逐笔修改成交价与数量。多笔交易需为每笔填写数量，卖出按移动平均成本结算；单组买卖留空数量时沿用原来的投入金额计算。', 'Add multiple buy and sell points on the chart, then edit each price and quantity. For multiple trades, enter every quantity; sells use moving average cost. For one buy and sell, you may leave quantities blank and use investment amount instead.'],
    ['选择 BUY 和 SELL，留下这笔交易的轨迹。', 'Choose BUY and SELL to capture this trade.'],
    ['固定交易轨迹 · 选择 K 线风格', 'Freeze trade history · Choose a chart style'],
    ['选择 K 线风格 · 制作原始贴图', 'Choose a chart style · Create a raw sticker'],
    ['尚未标记买卖点，可直接制作原始 K 线贴图。', 'No trade points marked. You can create a raw chart sticker.'],
    ['K线贴图风格', 'Chart sticker style'],
    ['K 线轨迹样式', 'Chart style mode'],
    ['标准样式', 'Standard style'],
    ['传统 K 线风格编辑', 'Traditional chart styling'],
    ['风格化 K 线', 'Stylized chart'],
    ['水墨风 1', 'Ink wash 1'],
    ['水墨风 1 · 蜡烛图', 'Ink wash 1 · Candlesticks'],
    ['水墨风 2', 'Ink wash 2'],
    ['水墨风 2 · 苍劲折线', 'Ink wash 2 · Bold brush line'],
    ['水墨风格', 'Ink styles'],
    ['涨白跌黑 · 蜡烛', 'White up, black down · Candles'],
    ['苍劲笔法 · 折线', 'Bold brushwork · Line'],
    ['真实收盘价连成清晰墨线：轻微压感、沿线飞白，可叠加浅墨副线。贴图透明，不绘制蜡烛柱。', 'Real closing prices form a legible ink line with subtle pressure and dry bristles. An optional pale companion line can be added. The sticker is transparent and has no candles.'],
    ['收盘轨迹线采用细线飞白笔触，并沿线轻微晕染；涨白跌黑的蜡烛也有墨色渗开效果。贴图保持透明，背景墨点可作为独立图层添加。', 'The closing price path uses a fine dry brush with a soft ink bleed. White rising and black falling candles bleed into the paper too. The sticker stays transparent; background splashes can be separate layers.'],
    ['水墨风 1 预览', 'Ink wash 1 preview'],
    ['水墨风 2 预览', 'Ink wash 2 preview'],
    ['笔触粗细', 'Brush weight'],
    ['极细', 'Extra fine'],
    ['清晰', 'Clear'],
    ['飞白程度', 'Dry brush texture'],
    ['显示浅墨副线', 'Show pale companion line'],
    ['晕染强度', 'Ink bleed'],
    ['轻', 'Light'],
    ['明显', 'Visible'],
    ['适中', 'Medium'],
    ['浓重', 'Heavy'],
    ['显示收盘轨迹线', 'Show closing price path'],
    ['显示买卖标点', 'Show trade markers'],
    ['BUY 水墨标点', 'BUY ink marker'],
    ['SELL 水墨标点', 'SELL ink marker'],
    ['朱印框', 'Vermilion seal frame'],
    ['墨点', 'Ink blot'],
    ['普通圆点', 'Plain dot'],
    ['断墨圈', 'Broken ink ring'],
    ['笔锋箭头', 'Brush arrow'],
    ['显示 BUY / SELL 文字', 'Show BUY / SELL text'],
    ['细线飞白与浅墨沿真实收盘轨迹渲染；涨白跌黑，背景墨点仍可单独添加。', 'Fine dry-brush strands and a soft wash follow the real closing price path. White up, black down; background splashes can still be separate.'],
    ['水墨主体保持透明：涨白、跌黑；背景墨点可单独添加。', 'The ink chart stays transparent: white up, black down. Add background splashes separately.'],
    ['水墨风 2 以真实收盘价绘制折线；笔触保持透明，背景贴图可单独添加。', 'Ink wash 2 traces real closing prices. The stroke stays transparent; add background stickers separately.'],
    ['为价格轨迹定调', 'Style the price history'],
    ['当前 BUY、SELL 与成交价会在生成贴图时固定。进入编辑器后可自由移动和缩放贴图。', 'BUY, SELL, and execution prices are fixed when the sticker is created. You can move and resize it in the editor.'],
    ['生成贴图后可在编辑器里自由移动和缩放；未标记买卖点时会保留原始 K 线。', 'Move and resize the sticker in the editor. With no trade points, it shows the raw chart.'],
    ['K线贴图预览', 'Chart sticker preview'],
    ['轨迹形式', 'Chart type'],
    ['极简蜡烛', 'Candlesticks'],
    ['价格线', 'Price line'],
    ['面积轨迹', 'Area chart'],
    ['上行色', 'Up color'],
    ['下行色', 'Down color'],
    ['背景', 'Background'],
    ['透明', 'Transparent'],
    ['暖纸', 'Warm paper'],
    ['墨黑', 'Ink black'],
    ['BUY / SELL 标签', 'BUY / SELL labels'],
    ['K 线高级设置 · 粗细、标点与盈利轨迹', 'Advanced chart settings · Strokes, markers, and profit path'],
    ['线条粗细', 'Stroke width'],
    ['细', 'Thin'],
    ['标准', 'Standard'],
    ['加粗', 'Bold'],
    ['特粗', 'Extra bold'],
    ['蜡烛实体', 'Candle body'],
    ['窄', 'Narrow'],
    ['宽', 'Wide'],
    ['盈利轨迹', 'Profit path'],
    ['不强调', 'No highlight'],
    ['虚线', 'Dashed'],
    ['沿 K 线标红', 'Highlight profitable candles'],
    ['盈利强调色', 'Profit highlight color'],
    ['BUY 标点', 'BUY marker'],
    ['圆点', 'Dot'],
    ['三角', 'Triangle'],
    ['菱形', 'Diamond'],
    ['方形', 'Square'],
    ['自定义图片', 'Custom image'],
    ['隐藏', 'Hide'],
    ['SELL 标点', 'SELL marker'],
    ['标点尺寸', 'Marker size'],
    ['小', 'Small'],
    ['中', 'Medium'],
    ['大', 'Large'],
    ['特大', 'Extra large'],
    ['BUY 颜色', 'BUY color'],
    ['SELL 颜色', 'SELL color'],
    ['上传 BUY 图片', 'Upload BUY image'],
    ['上传 SELL 图片', 'Upload SELL image'],
    ['自定义标点图片仅保存在本地作品项目中。', 'Custom marker images are saved only in the local project.'],
    ['K 线贴图截取范围', 'Chart sticker range'],
    ['截取方式', 'Crop mode'],
    ['仅交易轨迹', 'Trade segment only'],
    ['完整已加载区间', 'Entire loaded range'],
    ['自定义日期', 'Custom dates'],
    ['起始日期', 'Start date'],
    ['自定义范围须包含所有买卖节点；未平仓持仓按截取末尾的 K 线收盘价估值。', 'The custom range must include all trade events. Open positions use the final candle close for valuation.'],
    ['未标记买卖点时默认使用完整已加载区间；也可自定义截取范围。', 'With no trade points, the entire loaded range is used by default. You can also choose custom dates.'],
    ['生成 K 线贴图 · 进入艺术编辑器', 'Create chart sticker · Open art editor'],
    ['快速成图 · Gallery / Obsidian（可选）', 'Quick poster · Gallery / Obsidian (optional)'],
    ['艺术图片编辑器', 'Art image editor'],
    ['画布编辑', 'Canvas editor'],
    ['视图缩放', 'View zoom'],
    ['撤销 Ctrl+Z', 'Undo Ctrl+Z'],
    ['↶ 撤销', '↶ Undo'],
    ['重做 Ctrl+Y', 'Redo Ctrl+Y'],
    ['↷ 重做', '↷ Redo'],
    ['保存项目', 'Save project'],
    ['保存 PNG', 'Save PNG'],
    ['添加与画布设置', 'Add and canvas settings'],
    ['画布比例', 'Canvas ratio'],
    ['预设画布方向', 'Preset orientation'],
    ['纵向', 'Portrait'],
    ['横向', 'Landscape'],
    ['分享', 'Share'],
    ['故事', 'Story'],
    ['A4 纵', 'A4 portrait'],
    ['A4 横', 'A4 landscape'],
    ['打印', 'Print'],
    ['自定义宽', 'Custom width'],
    ['高', 'Height'],
    ['应用比例', 'Apply ratio'],
    ['预设可切换横纵；自定义比例由宽高决定，范围 1:4 到 4:1。', 'Presets can switch orientation. Enter custom width and height for ratios from 1:4 to 4:1.'],
    ['暖纸背景', 'Warm paper background'],
    ['白色背景', 'White background'],
    ['墨黑背景', 'Ink black background'],
    ['砂岩背景', 'Sandstone background'],
    ['自定义底色', 'Custom background color'],
    ['上传背景', 'Upload background'],
    ['背景图片填充', 'Background image fit'],
    ['铺满并裁切', 'Fill and crop'],
    ['完整显示', 'Show entire image'],
    ['背景裁切横向', 'Horizontal background crop'],
    ['背景裁切纵向', 'Vertical background crop'],
    ['铺满裁切时生效：横向 0 左、100 右；纵向 0 上、100 下。', 'Applies to fill and crop: horizontal 0 left / 100 right; vertical 0 top / 100 bottom.'],
    ['移除背景图片', 'Remove background image'],
    ['添加模块', 'Add modules'],
    ['文字', 'Text'],
    ['色块', 'Rectangle'],
    ['圆形', 'Circle'],
    ['图片贴图', 'Image sticker'],
    ['＋ 再添加一张 K 线贴图', '＋ Add another chart sticker'],
    ['交易数据模块', 'Trade data modules'],
    ['买卖价格', 'Buy and sell prices'],
    ['持仓天数', 'Holding days'],
    ['投入金额', 'Investment amount'],
    ['盈亏金额', 'Profit / loss'],
    ['从固定交易填入，可像文字图层一样排版。', 'Filled from the frozen trade and editable like any text layer.'],
    ['系统设置', 'System settings'],
    ['编辑偏好与导出', 'Editor preferences and export'],
    ['⚙ 系统设置', '⚙ Settings'],
    ['页面文字大小', 'Page text size'],
    ['界面语言', 'Interface language'],
    ['界面主题', 'Interface theme'],
    ['浅色', 'Light'],
    ['黑夜', 'Dark'],
    ['自动保存草稿', 'Auto save draft'],
    ['拖动吸附网格', 'Snap to grid'],
    ['显示对齐辅助线', 'Show alignment guides'],
    ['导出宽度', 'Export width'],
    ['1920 px · 分享', '1920 px · Share'],
    ['2480 px · 高清', '2480 px · High quality'],
    ['3200 px · 超清', '3200 px · Ultra quality'],
    ['可编辑海报画布', 'Editable poster canvas'],
    ['选中模块后拖动；拖动任一角可缩放。方向键微调，Delete 删除，Ctrl+Z 撤销。', 'Select and drag a module; drag a corner to resize. Use arrow keys to nudge, Delete to remove, and Ctrl+Z to undo.'],
    ['图层与属性', 'Layers and properties'],
    ['图层', 'Layers'],
    ['上移', 'Move up'],
    ['下移', 'Move down'],
    ['复制', 'Duplicate'],
    ['删除', 'Delete'],
    ['对齐到画布', 'Align to canvas'],
    ['左', 'Left'],
    ['水平居中', 'Center horizontally'],
    ['右', 'Right'],
    ['上', 'Top'],
    ['垂直居中', 'Center vertically'],
    ['下', 'Bottom'],
    ['模块属性', 'Module properties'],
    ['预设贴图', 'Preset stickers'],
    ['预设贴图不存在。', 'Preset sticker not found.'],
    ['预设贴图无法加载。', 'Preset sticker could not load.'],
    ['当前浏览器无法绘制预设贴图。', 'This browser cannot draw the preset sticker.'],
    ['图层已达到 100 个上限。', 'The project has reached the 100-layer limit.'],
    ['墨韵 · 云染', 'Ink wash · Cloud bloom'],
    ['墨韵 · 飞溅', 'Ink wash · Splash'],
    ['墨韵 · 流痕', 'Ink wash · Flow'],
    ['墨韵 · 泼墨背景', 'Ink wash · Splash backdrop'],
    ['盈刻 Logo', 'YINK logo'],
    ['添加墨韵 · 云染', 'Add cloud bloom sticker'],
    ['添加墨韵 · 飞溅', 'Add ink splash sticker'],
    ['添加墨韵 · 流痕', 'Add flowing ink sticker'],
    ['添加墨韵 · 泼墨背景', 'Add ink splash backdrop'],
    ['添加盈刻 Logo', 'Add YINK logo sticker'],
    ['选择画布上的模块或图层以编辑。', 'Select a module on the canvas or in the layer list to edit it.'],
    ['名称', 'Name'],
    ['旋转', 'Rotation'],
    ['不透明度', 'Opacity'],
    ['交易数据绑定', 'Trade data binding'],
    ['自由文字', 'Free text'],
    ['收益率', 'Return'],
    ['交易日期', 'Trade dates'],
    ['绑定的文字会在重新固定交易时更新。', 'Bound text updates when the trade is frozen again.'],
    ['字号', 'Font size'],
    ['调整字号', 'Adjust font size'],
    ['精确字号', 'Exact font size'],
    ['字体', 'Font'],
    ['系统衬线', 'System serif'],
    ['系统无衬线', 'System sans serif'],
    ['思源黑体 · 中文', 'Noto Sans SC · Chinese'],
    ['站酷小薇体 · 中文', 'ZCOOL XiaoWei · Chinese'],
    ['Inter · 现代', 'Inter · Modern'],
    ['DM Serif Display · 标题', 'DM Serif Display · Display'],
    ['Space Mono · 等宽', 'Space Mono · Monospace'],
    ['思源宋体 · 中文宋体', 'Noto Serif SC · Chinese serif'],
    ['马善政 · 书法', 'Ma Shan Zheng · Calligraphy'],
    ['Zhi Mang Xing · 奔放行书', 'Zhi Mang Xing · Expressive script'],
    ['Liu Jian Mao Cao · 毛笔草书', 'Liu Jian Mao Cao · Cursive brush'],
    ['Long Cang · 清雅书写', 'Long Cang · Elegant handwriting'],
    ['站酷庆科黄油体 · 标题', 'ZCOOL QingKe · Bold display'],
    ['Bebas Neue · 窄体', 'Bebas Neue · Condensed'],
    ['Playfair Display · 优雅衬线', 'Playfair Display · Elegant serif'],
    ['Caveat · 手写', 'Caveat · Handwriting'],
    ['Bungee · 复古标题', 'Bungee · Retro display'],
    ['自定义字体', 'Custom font'],
    ['上传自定义字体', 'Upload custom font'],
    ['支持 TTF、OTF、WOFF、WOFF2，最大 20 MB。字体随项目保存。', 'Supports TTF, OTF, WOFF, and WOFF2, up to 20 MB. The font is saved with the project.'],
    ['对齐', 'Alignment'],
    ['左对齐', 'Align left'],
    ['居中', 'Center'],
    ['右对齐', 'Align right'],
    ['文字排版', 'Text layout'],
    ['自动适配文字框', 'Fit to text box'],
    ['固定字号并裁切', 'Fixed size and crop'],
    ['图片填充', 'Image fit'],
    ['图片裁切横向', 'Horizontal image crop'],
    ['图片裁切纵向', 'Vertical image crop'],
    ['替换此图片', 'Replace this image'],
    ['贴图背景', 'Sticker background'],
    ['显示 BUY / SELL 标签', 'Show BUY / SELL labels'],
    ['颜色', 'Color'],
    ['K 线高级属性', 'Advanced chart properties'],
    ['替换 BUY 图片', 'Replace BUY image'],
    ['替换 SELL 图片', 'Replace SELL image'],
    ['项目', 'Project'],
    ['打开本地项目', 'Open local project'],
    ['作品保存在当前浏览器。可另存项目 JSON 以便以后继续编辑。', 'Your work is stored in this browser. Save a project JSON to keep editing later.'],
    ['海报预览与导出', 'Poster preview and export'],
    ['你的交易作品', 'Your trade artwork'],
    ['选择一种构图，留下只属于这笔交易的文字。', 'Choose a composition and add words that belong to this trade.'],
    ['模板默认', 'Template default'],
    ['暖白', 'Warm white'],
    ['深黑', 'Deep black'],
    ['持仓时间', 'Holding time'],
    ['自定义一句话', 'Your own line'],
    ['导出分享版 PNG', 'Export share PNG'],
    ['导出 A4 PNG', 'Export A4 PNG'],
    ['交易艺术海报预览', 'Trade artwork preview'],
    ['已加载的行情数据', 'Loaded market data'],
    ['日期', 'Date'],
    ['开盘', 'Open'],
    ['最高', 'High'],
    ['最低', 'Low'],
    ['收盘', 'Close'],
    ['成交量', 'Volume'],
    ['这里保留当前 K 线数据，便于核对交易区间和价格。', 'The current candle data is shown here so you can check the date range and prices.']
  ]);

  const messages = new Map([
    ['最近使用', 'Recently used'],
    ['5 分钟 K', '5 minute candles'],
    ['5 分钟', '5 minute'],
    ['小时', 'hourly'],
    ['日', 'daily'],
    ['周', 'weekly'],
    ['成交价', 'Execution price'],
    ['数量', 'Quantity'],
    ['累计买入成本', 'total buy cost'],
    ['A 股', 'China A shares'],
    ['港股', 'Hong Kong stocks'],
    ['美股', 'US stocks'],
    ['A 股 · 深圳', 'China A shares · Shenzhen'],
    ['A 股 · 上海', 'China A shares · Shanghai'],
    ['美股 · NASDAQ', 'US stocks · NASDAQ'],
    ['美股 · NYSE', 'US stocks · NYSE'],
    ['美股 · AMEX', 'US stocks · AMEX'],
    ['可改用 CSV 导入。', 'You can import CSV instead.'],
    ['三地搜索和日 K 均已返回有效数据。', 'Search and daily candles succeeded in all three markets.'],
    ['输入股票名称或代码，选择搜索结果。', 'Enter a stock name or ticker, then choose a search result.'],
    ['选择 CSV 文件，数据会在本地解析。', 'Choose a CSV file. It will be parsed locally.'],
    ['没有找到支持的 A 股、港股或美股。请尝试代码或 CSV 导入。', 'No supported China A share, Hong Kong stock, or US stock was found. Try a ticker or import CSV.'],
    ['请输入股票名称或代码。', 'Enter a stock name or ticker.'],
    ['正在搜索证券…', 'Searching for stocks…'],
    ['请选择一条搜索结果。', 'Choose a search result.'],
    ['未找到证券；也可以导入 CSV。', 'No stock found. You can also import CSV.'],
    ['请选择 CSV 文件。', 'Choose a CSV file.'],
    ['CSV 文件请小于 8 MB。', 'CSV files must be under 8 MB.'],
    ['示例交易', 'Sample trade'],
    ['品牌', 'Brand'],
    ['交易标语', 'Trade slogan'],
    ['交易 K 线', 'Trade chart'],
    ['原始 K 线', 'Raw chart'],
    ['行情区间', 'Price history range'],
    ['K 线贴图', 'Chart sticker'],
    ['示例数据已加载。可直接在 K 线上标记 BUY 和 SELL。', 'Sample data loaded. Mark BUY and SELL directly on the chart.'],
    ['未命名股票', 'Unnamed stock'],
    ['为保持页面流畅，表格只显示最近 500 条；图表和海报仍使用完整 K 线数据。', 'For performance, the table shows the latest 500 bars. The chart and poster still use the full data.'],
    ['这里保留当前时间级别的 K 线数据，便于核对交易区间和价格。', 'The current time frame data is shown here so you can check dates and prices.'],
    ['请先从搜索结果中选择一只股票。', 'Choose a stock from the search results first.'],
    ['请先导入有效的 CSV 文件。', 'Import a valid CSV file first.'],
    ['我的交易', 'My trade'],
    ['自定义数据', 'Custom data'],
    ['正在加载并校验 K 线数据…', 'Loading and checking candle data…'],
    ['制作贴图至少需要两根 K 线；请扩大日期或时刻范围后重新加载。', 'At least two candles are needed for a sticker. Widen the date or time range and reload.'],
    ['设置已更新，请重新加载 K 线。', 'Settings updated. Reload candle data.'],
    ['上次保存的行情数据无效。', 'Previously saved market data is invalid.'],
    ['上次保存的证券代码无效。', 'Previously saved ticker is invalid.'],
    ['上次保存的 K 线数据无效。', 'Previously saved candle data is invalid.'],
    ['上次保存的日期区间与 K 线不一致。', 'The saved date range does not match the candles.'],
    ['上次保存的分时 K 日期格式无效。', 'The saved intraday candle dates are invalid.'],
    ['上次保存的时刻区间与 K 线不一致。', 'The saved time range does not match the candles.'],
    ['已恢复周 K 作品；切换时间级别请重新导入原始 CSV。', 'Weekly candle project restored. Reimport the original CSV to change time frame.'],
    ['已恢复上次编辑的数据。', 'Previous editing data restored.'],
    ['请先加载 K 线数据。', 'Load candle data first.'],
    ['原始 CSV 超出浏览器存储空间；本次编辑仍可继续，刷新后切换时间级别需重新导入 CSV。', 'The original CSV exceeds browser storage. You can keep editing, but must reimport CSV to change time frame after refreshing.'],
    ['当前数据无法自动保存；请下载艺术项目 JSON 保留作品。', 'This data cannot be saved automatically. Download the project JSON to keep your work.'],
    ['正在绘制高清 PNG…', 'Rendering high resolution PNG…'],
    ['自定义截取日期须位于已加载的 K 线区间内。', 'Custom crop dates must be within the loaded candle range.'],
    ['截取范围须包含所有买卖节点。', 'The crop range must include every buy and sell event.'],
    ['K 线截取方式无效。', 'Invalid chart crop mode.'],
    ['截取范围至少需要两根 K 线。', 'The crop range needs at least two candles.'],
    ['请先加载至少两根有效 K 线，或固定一笔有效交易。', 'Load at least two valid candles or define a valid trade first.'],
    ['草稿已自动保存在当前浏览器。', 'Draft automatically saved in this browser.'],
    ['本地存储空间不足；请使用“保存项目”下载 JSON。', 'Browser storage is full. Use Save project to download JSON.'],
    ['K 线贴图预览已更新。', 'Chart sticker preview updated.'],
    ['水墨风 2 · 透明 2D 笔刷 v3 已启用。', 'Ink wash 2 · transparent 2D brush v3 is active.'],
    ['请先上传所选的自定义 BUY / SELL 标点图片。', 'Upload the selected custom BUY / SELL marker image first.'],
    ['已切换画布比例。', 'Canvas ratio changed.'],
    ['已切换为横向画布。', 'Switched to landscape canvas.'],
    ['已切换为纵向画布。', 'Switched to portrait canvas.'],
    ['请先在交易步骤填写投入金额。', 'Enter investment amount in the trade step first.'],
    ['请选择 PNG、JPEG 或 WebP 图片。', 'Choose a PNG, JPEG, or WebP image.'],
    ['图片请小于 5 MB。', 'Images must be under 5 MB.'],
    ['图片文件格式不受支持。', 'Unsupported image format.'],
    ['图片文件无法解码。', 'Image could not be decoded.'],
    ['无法读取本地图片。', 'Could not read the local image.'],
    ['请选择 TTF、OTF、WOFF 或 WOFF2 字体。', 'Choose a TTF, OTF, WOFF, or WOFF2 font.'],
    ['字体文件请小于 20 MB。', 'Fonts must be under 20 MB.'],
    ['字体文件为空。', 'The font file is empty.'],
    ['字体文件格式不受支持。', 'Unsupported font format.'],
    ['无法读取本地字体。', 'Could not read the local font.'],
    ['当前浏览器不支持加载字体文件。', 'This browser cannot load font files.'],
    ['字体文件无法加载，请检查字体文件或离线包。', 'Font could not be loaded. Check the font file or offline package.'],
    ['自定义字体数据无效。', 'Invalid custom font data.'],
    ['字体选项无效。', 'Invalid font option.'],
    ['正在绘制高清作品…', 'Rendering high resolution artwork…'],
    ['PNG 生成失败。', 'PNG export failed.'],
    ['项目超过 100 MB，请减少图片贴图后重试。', 'Project exceeds 100 MB. Remove some image stickers and try again.'],
    ['项目 JSON 已保存到本地。', 'Project JSON saved locally.'],
    ['项目文件请小于 100 MB。', 'Project files must be under 100 MB.'],
    ['项目已从本地文件打开。', 'Project opened from a local file.'],
    ['项目已打开，但草稿无法自动保存；请使用“保存项目”。', 'Project opened, but the draft could not be saved automatically. Use Save project.'],
    ['项目已打开。', 'Project opened.'],
    ['已恢复上次编辑的作品；它与当前行情不同。生成新 K 线贴图会新建画布。', 'Previous artwork restored. It differs from current market data; creating a new chart sticker will start a new canvas.'],
    ['已恢复上次编辑的作品。', 'Previous artwork restored.'],
    ['已加载新数据。当前画布仍是上一作品；生成新 K 线贴图后会新建画布，可用撤销返回。', 'New data loaded. The canvas still shows the previous project; creating a new chart sticker will start a new canvas. Undo can restore the old one.'],
    ['图片贴图已替换。', 'Image sticker replaced.'],
    ['字体已应用；浏览器草稿空间不足，请点击“保存项目”下载 JSON。', 'Font applied, but browser draft storage is full. Click Save project to download JSON.'],
    ['自定义字体已应用，并会保存在项目文件中。', 'Custom font applied and will be saved with the project.'],
    ['自动保存已关闭；请用“保存项目”保留修改。', 'Auto save is off. Use Save project to keep your changes.'],
    ['请先上传自定义字体文件。', 'Upload a custom font file first.'],
    ['请先上传该标点的自定义图片。', 'Upload a custom image for this marker first.'],
    ['交易节点类型无效。', 'Invalid trade event type.'],
    ['请选择有效的 K 线。', 'Choose a valid candle.'],
    ['交易节点不存在。', 'Trade event does not exist.'],
    ['实际成交价必须大于零。', 'Execution price must be greater than zero.'],
    ['成交数量必须大于零，或留空。', 'Quantity must be greater than zero or left blank.'],
    ['请先在图上选择交易日期。', 'Choose a trade date on the chart first.'],
    ['请先标记 BUY 和 SELL。', 'Mark BUY and SELL first.'],
    ['交易节点日期无效。', 'Invalid trade event date.'],
    ['成交价必须大于零。', 'Execution price must be greater than zero.'],
    ['投入金额必须大于零，或留空。', 'Investment amount must be greater than zero or left blank.'],
    ['SELL 日期必须晚于 BUY 日期。', 'SELL date must be after BUY date.'],
    ['价格数值过大，无法计算收益率。', 'Price is too large to calculate return.'],
    ['投入金额过大，无法计算盈亏。', 'Investment amount is too large to calculate profit.'],
    ['多笔交易请为每个 BUY / SELL 填写大于零的数量。', 'For multiple trades, enter a quantity greater than zero for every BUY and SELL.'],
    ['第一笔交易必须是 BUY。', 'The first trade event must be BUY.'],
    ['成交金额过大，无法计算。', 'Trade value is too large to calculate.'],
    ['卖出数量不能超过此前累计持仓。', 'Sell quantity cannot exceed the current position.'],
    ['投入金额不足以覆盖买入所需资金；请增加金额或留空。', 'Investment amount does not cover the buys. Increase it or leave it blank.'],
    ['持仓估值价格必须大于零。', 'Position valuation price must be greater than zero.'],
    ['交易数值过大，无法计算盈亏。', 'Trade values are too large to calculate profit.'],
    ['缺少海报所需的交易数据。', 'Trade data needed for the poster is missing.'],
    ['CSV 引号格式不正确。', 'Invalid CSV quotation format.'],
    ['CSV 存在未闭合的引号。', 'CSV contains an unclosed quote.'],
    ['CSV 必须包含表头和至少一条数据。', 'CSV needs a header and at least one data row.'],
    ['CSV 请统一使用日期或日期时间，不能混用。', 'Use either dates or date times throughout the CSV; do not mix them.'],
    ['CSV 聚合后的成交量过大。', 'Aggregated CSV volume is too large.'],
    ['不支持的 K 线时间级别。', 'Unsupported candle time frame.'],
    ['CSV 价格由文件提供，不能在浏览器中计算前复权或后复权。', 'CSV prices come from the file; this browser cannot calculate forward or backward adjustments.'],
    ['该 CSV 没有可识别的 5 分钟 K 数据；请导入连续的 5 分钟记录。', 'This CSV has no recognizable 5 minute candles. Import consecutive 5 minute records.'],
    ['该 CSV 没有小时 K 数据；请选择日 K 或周 K。', 'This CSV has no hourly candles. Choose daily or weekly candles.'],
    ['CSV 在选定日期范围内没有数据。', 'The CSV has no data in the selected date range.'],
    ['搜索结果中未找到预期市场的股票。', 'The expected market stock was not found in search results.'],
    ['未取得历史日 K。', 'Historical daily candles were not returned.'],
    ['请选择有效的开始和结束日期。', 'Choose valid start and end dates.'],
    ['请选择有效的开始和结束时刻，且开始时间不能晚于结束时间。', 'Choose valid start and end times; start must not be after end.'],
    ['证券搜索返回了无法识别的数据。', 'Stock search returned unrecognized data.'],
    ['K 线数据中存在无效日期或字段。', 'Candle data contains an invalid date or field.'],
    ['日 K 数据中存在无效价格或成交量。', 'Daily candle data contains an invalid price or volume.'],
    ['日 K 数据中存在不合理的 OHLC 价格。', 'Daily candle data contains inconsistent OHLC prices.'],
    ['行情接口未返回日 K 数据。请稍后重试或导入 CSV。', 'The market data source returned no daily candles. Try again later or import CSV.'],
    ['日 K 数据包含重复日期。', 'Daily candle data contains duplicate dates.'],
    ['这个日期范围内没有日 K 数据。请调整日期。', 'There are no daily candles in this date range. Adjust the dates.'],
    ['证券搜索接口暂不可用。请稍后重试，或导入 CSV。', 'Stock search is temporarily unavailable. Try again later or import CSV.'],
    ['请先选择有效的股票。', 'Choose a valid stock first.'],
    ['K 线高级设置无效。', 'Invalid advanced candle settings.'],
    ['行情接口无法连接。请检查网络，或切换到 CSV 导入。', 'Could not connect to market data. Check your network or import CSV.'],
    ['行情接口没有返回 JSONP 回调。请使用 CSV 导入。', 'Market data did not return a JSONP callback. Import CSV instead.'],
    ['行情接口响应超时。请重试或使用 CSV 导入。', 'Market data timed out. Try again or import CSV.']
  ]);

  const patterns = [
    [/^(\d+) 笔$/, m => m[1] + ' trades'],
    [/^第 (\d+) 个标点$/, m => 'Marker ' + m[1]],
    [/^单位：(.*)$/, m => 'Currency: ' + m[1]],
    [/^已选择 (.*) · 收盘 (.*)$/, m => 'Selected ' + m[1] + ' · Close ' + m[2]],
    [/^已选择 (.*)（(.*)）。请选择日期并加载 K 线。$/, m => 'Selected ' + m[1] + ' (' + m[2].replace('，', ' · ') + '). Choose dates and load candles.'],
    [/^CSV 已读取：(\d+) 条(.*) K。可调整日期后加载。$/, m => 'CSV read: ' + m[1] + ' ' + translate(m[2]) + ' candles. Adjust dates and load.'],
    [/^已加载 (\d+) 条\s*(.*?) K 数据。(?:自动模式已回退到(.*?) K。)?(.*)$/, m => 'Loaded ' + m[1] + ' ' + translate(m[2]) + ' candles.' + (m[3] ? ' Auto mode fell back to ' + translate(m[3]) + ' candles.' : '') + (m[4] ? ' ' + translate(m[4]) : '')],
    [/^自动模式已回退到(.*)$/, m => 'Auto mode fell back to ' + translate(m[1])],
    [/^当前字体：(.*)。字体随项目保存。$/, m => 'Current font: ' + m[1] + '. Saved with the project.'],
    [/^已应用自定义比例 (.*)$/, m => 'Custom ratio applied: ' + m[1]],
    [/^(.*) 副本$/, m => m[1] + ' copy'],
    [/^(BUY|SELL) 标点图片已读取。$/, m => m[1] + ' marker image loaded.'],
    [/^(BUY|SELL) 标点图片已替换。$/, m => m[1] + ' marker image replaced.'],
    [/^项目保存失败：(.*)$/, m => 'Could not save project: ' + translate(m[1])],
    [/^上次草稿无法恢复：(.*)$/, m => 'Could not restore previous draft: ' + translate(m[1])],
    [/^上次会话无法恢复：(.*)$/, m => 'Could not restore previous session: ' + translate(m[1])],
    [/^已生成 (.*)（(\d+) × (\d+)）。$/, m => 'Created ' + m[1] + ' (' + m[2] + ' × ' + m[3] + ').'],
    [/^已生成 (\d+) × (\d+) PNG。$/, m => 'Created ' + m[1] + ' × ' + m[2] + ' PNG.'],
    [/^结果：(\d+) \/ 3 通过。(.*)$/, m => 'Result: ' + m[1] + ' / 3 passed. ' + translate(m[2])],
    [/^正在检查 (.*)$/, m => 'Checking ' + m[1]],
    [/^(.*) · 失败：(.*)$/, m => m[1] + ' · Failed: ' + translate(m[2])],
    [/^(.*) · 区间末收盘 (.*)$/, m => m[1] + ' · Final close ' + m[2]],
    [/^(.*) · (\d+) 条 · (.*)$/, m => m[1] + ' · ' + m[2] + ' bars · ' + m[3]],
    [/^([\d.]+) 天$/, m => m[1] + ' days'],
    [/^([\d.]+) 小时$/, m => m[1] + ' hours'],
    [/^([\d.]+) 分钟$/, m => m[1] + ' minutes'],
    [/^([T⌁▧▢])  (.*)$/, m => m[1] + '  ' + translate(m[2])],
    [/^(.*)  \/  (.*) · (5 分钟 K|小时 K|日 K|周 K)$/, m => translate(m[1]) + ' / ' + m[2] + ' · ' + translate(m[3])],
    [/^(.*) · 自定义数据 · (.*)$/, m => m[1] + ' · Custom data · ' + m[2]],
    [/^(\d+) 笔 · 累计买入 (.*) · 累计卖出 (.*) · 收益率基于(.*)$/, m => m[1] + ' trades · Total bought ' + m[2] + ' · Total sold ' + m[3] + ' · Return based on ' + translate(m[4])],
    [/^([\d.]+) (天|小时|分钟)(?: ([\d.]+) 分钟)? · (.*)$/, m => m[1] + ' ' + ({ '天': 'days', '小时': 'hours', '分钟': 'minutes' }[m[2]]) + (m[3] ? ' ' + m[3] + ' minutes' : '') + ' · ' + m[4]],
    [/^已实现 (.*) · 未实现 (.*) · 剩余 (.*) · 合计 (.*)$/, m => 'Realized ' + m[1] + ' · Unrealized ' + m[2] + ' · Remaining ' + m[3] + ' · Total ' + m[4].replace(' · 参考最终金额 ', ' · Reference final amount ')],
    [/^盈亏 (.*) · 最终金额 (.*)$/, m => 'Profit / loss ' + m[1] + ' · Final amount ' + m[2]],
    [/^CSV 表头需包含：(.*)$/, m => 'CSV headers must include: ' + m[1]],
    [/^CSV 第 (\d+) 行列数不正确。$/, m => 'CSV row ' + m[1] + ' has the wrong number of columns.'],
    [/^CSV 第 (\d+) 行日期无效。$/, m => 'CSV row ' + m[1] + ' has an invalid date.'],
    [/^CSV 第 (\d+) 行包含无效数值。$/, m => 'CSV row ' + m[1] + ' contains an invalid number.'],
    [/^CSV 第 (\d+) 行 OHLC 价格不合理。$/, m => 'CSV row ' + m[1] + ' has inconsistent OHLC prices.'],
    [/^CSV 包含重复日期：(.*)$/, m => 'CSV contains a duplicate date: ' + m[1]],
    [/^证券代码映射不一致：(.*)$/, m => 'Ticker mapping mismatch: ' + m[1]]
  ];

  function translate(value) {
    if (translations.has(value)) return translations.get(value);
    if (messages.has(value)) return messages.get(value);
    for (const pair of patterns) {
      const match = pair[0].exec(value);
      if (match) return pair[1](match);
    }
    return value;
  }

  const textRecords = new WeakMap();
  const attributeRecords = new WeakMap();
  let language = 'zh-CN';
  let size = 'medium';
  let theme = 'light';

  function translatedText(original) {
    const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(original);
    return match[1] + translate(match[2]) + match[3];
  }

  function ignored(node) {
    const parent = node.parentElement || node.parentNode;
    return !parent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/i.test(parent.tagName || '') || !!(parent.closest && parent.closest('[contenteditable="true"]'));
  }

  function updateText(node) {
    if (ignored(node)) return;
    const current = node.nodeValue;
    let record = textRecords.get(node);
    if (!record || (current !== record.original && current !== record.english)) {
      record = { original: current, english: translatedText(current) };
      textRecords.set(node, record);
    }
    const wanted = language === 'en' ? record.english : record.original;
    if (current !== wanted) node.nodeValue = wanted;
  }

  function updateAttribute(element, name) {
    if (!element.hasAttribute(name)) return;
    const current = element.getAttribute(name);
    let records = attributeRecords.get(element);
    if (!records) { records = new Map(); attributeRecords.set(element, records); }
    let record = records.get(name);
    if (!record || (current !== record.original && current !== record.english)) {
      record = { original: current, english: translatedText(current) };
      records.set(name, record);
    }
    const wanted = language === 'en' ? record.english : record.original;
    if (current !== wanted) element.setAttribute(name, wanted);
  }

  function updateTree(node) {
    if (!document.createTreeWalker) return;
    if (node.nodeType === 3) { updateText(node); return; }
    if (node.nodeType !== 1 && node.nodeType !== 9) return;
    if (node.nodeType === 1) ['placeholder', 'title', 'aria-label'].forEach(function (name) { updateAttribute(node, name); });
    const textWalker = document.createTreeWalker(node, 4);
    while (textWalker.nextNode()) updateText(textWalker.currentNode);
    if (node.querySelectorAll) node.querySelectorAll('[placeholder],[title],[aria-label]').forEach(function (element) {
      ['placeholder', 'title', 'aria-label'].forEach(function (name) { updateAttribute(element, name); });
    });
  }

  function saveSettings() {
    try { root.localStorage.setItem(STORAGE_KEY, JSON.stringify({ language: language, size: size, theme: theme })); } catch (_) { /* preferences remain active for this visit */ }
  }

  function updateControls() {
    document.querySelectorAll('[data-ui-size]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.uiSize === size)); });
    document.querySelectorAll('[data-ui-language]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.uiLanguage === language)); });
    document.querySelectorAll('[data-ui-theme]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.uiTheme === theme)); });
  }

  function setSize(next) {
    if (!['small', 'medium', 'large'].includes(next)) return;
    size = next;
    document.documentElement.setAttribute('data-ui-size', size);
    updateControls();
    saveSettings();
  }

  function setLanguage(next) {
    if (!['zh-CN', 'en'].includes(next)) return;
    language = next;
    document.documentElement.lang = language;
    updateTree(document.documentElement);
    updateControls();
    saveSettings();
  }

  function setTheme(next) {
    if (!['light', 'dark'].includes(next)) return;
    theme = next;
    document.documentElement.setAttribute('data-ui-theme', theme);
    const logo = document.querySelector && document.querySelector('.brand-logo');
    if (logo) logo.setAttribute('src', theme === 'dark' ? 'assets/yink-logo-dark.svg' : 'assets/yink-logo.svg');
    if (root.dispatchEvent && root.Event) root.dispatchEvent(new root.Event('yink:themechange'));
    updateControls();
    saveSettings();
  }

  try {
    const stored = JSON.parse(root.localStorage.getItem(STORAGE_KEY) || 'null');
    if (stored && ['small', 'medium', 'large'].includes(stored.size)) size = stored.size;
    if (stored && ['zh-CN', 'en'].includes(stored.language)) language = stored.language;
    if (stored && ['light', 'dark'].includes(stored.theme)) theme = stored.theme;
  } catch (_) { /* use Chinese, medium size, and light theme */ }

  if (document.documentElement) {
    document.documentElement.setAttribute('data-ui-size', size);
    document.documentElement.setAttribute('data-ui-theme', theme);
    document.documentElement.lang = language;
    const logo = document.querySelector && document.querySelector('.brand-logo');
    if (logo && theme === 'dark') logo.setAttribute('src', 'assets/yink-logo-dark.svg');
    updateTree(document.documentElement);
    updateControls();
    if (root.MutationObserver) {
      const observer = new root.MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          if (mutation.type === 'characterData') updateText(mutation.target);
          else if (mutation.type === 'attributes' && ['placeholder', 'title', 'aria-label'].includes(mutation.attributeName)) updateAttribute(mutation.target, mutation.attributeName);
          else if (mutation.type === 'childList') mutation.addedNodes.forEach(updateTree);
        });
      });
      observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
    }
    document.querySelectorAll('[data-ui-size]').forEach(function (button) { button.addEventListener('click', function () { setSize(this.dataset.uiSize); }); });
    document.querySelectorAll('[data-ui-language]').forEach(function (button) { button.addEventListener('click', function () { setLanguage(this.dataset.uiLanguage); }); });
    document.querySelectorAll('[data-ui-theme]').forEach(function (button) { button.addEventListener('click', function () { setTheme(this.dataset.uiTheme); }); });
  }

  const ns = root.YINK = root.YINK || {};
  ns.i18n = { translate: translate, setLanguage: setLanguage, setSize: setSize, setTheme: setTheme, getLanguage: function () { return language; }, getSize: function () { return size; }, getTheme: function () { return theme; } };
})(window);
