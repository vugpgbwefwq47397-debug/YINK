(function (root) {
  'use strict';
  const ns = root.YINK = root.YINK || {};

  function validPoint(type, bar) {
    if (type !== 'BUY' && type !== 'SELL') throw new Error('交易节点类型无效。');
    if (!bar || !ns.isValidDate(bar.date) || !Number.isFinite(bar.close) || bar.close <= 0) throw new Error('请选择有效的 K 线。');
  }

  // Kept for projects created with the original single BUY / SELL workflow.
  function setTradeEvent(events, type, bar) {
    validPoint(type, bar);
    return events.filter(function (event) { return event.type !== type; }).concat({ type: type, date: bar.date, price: bar.close });
  }

  function addTradeEvent(events, type, bar) {
    validPoint(type, bar);
    return events.concat({ type: type, date: bar.date, price: bar.close, quantity: null });
  }

  function updateTradeEvent(events, index, changes) {
    if (!Number.isInteger(index) || index < 0 || index >= events.length) throw new Error('交易节点不存在。');
    const next = Object.assign({}, events[index]);
    if (Object.prototype.hasOwnProperty.call(changes, 'price')) {
      next.price = Number(changes.price);
      if (!Number.isFinite(next.price) || next.price <= 0) throw new Error('实际成交价必须大于零。');
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'quantity')) {
      next.quantity = changes.quantity === '' || changes.quantity == null ? null : Number(changes.quantity);
      if (next.quantity != null && (!Number.isFinite(next.quantity) || next.quantity <= 0)) throw new Error('成交数量必须大于零，或留空。');
    }
    return events.map(function (event, position) { return position === index ? next : event; });
  }

  function changeTradePrice(events, type, price) {
    const value = Number(price);
    if (!Number.isFinite(value) || value <= 0) throw new Error('实际成交价必须大于零。');
    if (!events.some(function (event) { return event.type === type; })) throw new Error('请先在图上选择交易日期。');
    return events.map(function (event) { return event.type === type ? Object.assign({}, event, { price: value }) : event; });
  }

  function hoursBetween(start, end) {
    const time = function (value) { return Date.parse(value.length === 16 ? value.replace(' ', 'T') + ':00Z' : value + 'T00:00:00Z'); };
    return (time(end) - time(start)) / 3600000;
  }

  function daysBetween(start, end) {
    return Math.floor(hoursBetween(start, end) / 24);
  }

  function formatHoldingDuration(trade, locale) {
    const minutes = Number.isFinite(trade.holdingMinutes) ? trade.holdingMinutes
      : Number.isFinite(trade.holdingHours) ? Math.round(trade.holdingHours * 60) : 0;
    const days = Number.isFinite(trade.holdingDays) ? trade.holdingDays : Math.floor(minutes / 1440);
    if (days > 0) return locale === 'zh' ? days + ' 天' : days + ' DAYS HELD';
    if (minutes < 60) return locale === 'zh' ? minutes + ' 分钟' : minutes + ' MINUTES HELD';
    const hours = Math.floor(minutes / 60), remainder = minutes % 60;
    if (locale === 'zh') return hours + ' 小时' + (remainder ? ' ' + remainder + ' 分钟' : '');
    return hours + 'H' + (remainder ? ' ' + remainder + 'M' : '') + ' HELD';
  }

  function calculateTrade(events, capital, markPrice, markDate) {
    const indexed = events.map(function (event, index) { return { event: event, index: index }; });
    if (indexed.length < 2 || !indexed.some(function (item) { return item.event && item.event.type === 'BUY'; }) || !indexed.some(function (item) { return item.event && item.event.type === 'SELL'; })) throw new Error('请先标记 BUY 和 SELL。');
    for (const item of indexed) {
      const event = item.event;
      if (!event || !['BUY', 'SELL'].includes(event.type) || !ns.isValidDate(event.date)) throw new Error('交易节点日期无效。');
      if (!Number.isFinite(event.price) || event.price <= 0) throw new Error('成交价必须大于零。');
    }
    indexed.sort(function (a, b) { return a.event.date.localeCompare(b.event.date) || a.index - b.index; });
    const ordered = indexed.map(function (item) { return Object.assign({}, item.event); });
    const buy = ordered.find(function (event) { return event.type === 'BUY'; });
    const sell = ordered.filter(function (event) { return event.type === 'SELL'; }).at(-1);
    const invested = capital === '' || capital == null ? null : Number(capital);
    if (invested !== null && (!Number.isFinite(invested) || invested <= 0)) throw new Error('投入金额必须大于零，或留空。');
    const quantityMode = ordered.some(function (event) { return event.quantity != null && event.quantity !== ''; }) || ordered.length > 2;
    if (buy.date >= sell.date && !quantityMode) throw new Error('SELL 日期必须晚于 BUY 日期。');
    if (!quantityMode) {
      const returnPct = (sell.price - buy.price) / buy.price * 100;
      if (!Number.isFinite(returnPct)) throw new Error('价格数值过大，无法计算收益率。');
      const profit = invested === null ? null : invested * returnPct / 100;
      const finalAmount = invested === null ? null : invested + profit;
      if (invested !== null && (!Number.isFinite(profit) || !Number.isFinite(finalAmount))) throw new Error('投入金额过大，无法计算盈亏。');
      return { mode: 'single', events: ordered, buy: { date: buy.date, price: buy.price }, sell: { date: sell.date, price: sell.price }, endDate: sell.date,
        holdingDays: daysBetween(buy.date, sell.date), holdingHours: hoursBetween(buy.date, sell.date), holdingMinutes: Math.round(hoursBetween(buy.date, sell.date) * 60), returnPct: returnPct, capital: invested, profit: profit, finalAmount: finalAmount };
    }
    if (ordered.some(function (event) { return !Number.isFinite(event.quantity) || event.quantity <= 0; })) throw new Error('多笔交易请为每个 BUY / SELL 填写大于零的数量。');
    if (ordered[0].type !== 'BUY') throw new Error('第一笔交易必须是 BUY。');
    let held = 0, cost = 0, realized = 0, buyQty = 0, buyNotional = 0, sellQty = 0, sellNotional = 0, cashUsed = 0, peakCashUsed = 0;
    for (const event of ordered) {
      const amount = event.quantity * event.price;
      if (!Number.isFinite(amount)) throw new Error('成交金额过大，无法计算。');
      if (event.type === 'BUY') {
        held += event.quantity; cost += amount; buyQty += event.quantity; buyNotional += amount;
        cashUsed += amount; peakCashUsed = Math.max(peakCashUsed, cashUsed);
      } else {
        if (event.quantity > held + 1e-10) throw new Error('卖出数量不能超过此前累计持仓。');
        const basis = cost / held * event.quantity;
        realized += amount - basis; cost -= basis; held -= event.quantity;
        sellQty += event.quantity; sellNotional += amount;
        cashUsed -= amount;
        if (held < 1e-10) { held = 0; cost = 0; }
      }
    }
    if (invested !== null && invested + 1e-8 < peakCashUsed) throw new Error('投入金额不足以覆盖买入所需资金；请增加金额或留空。');
    const mark = markPrice == null ? ordered.at(-1).price : Number(markPrice);
    if (!Number.isFinite(mark) || mark <= 0) throw new Error('持仓估值价格必须大于零。');
    const unrealized = held * mark - cost;
    const profit = realized + unrealized;
    const finalAmount = invested === null ? null : invested + profit;
    const returnPct = profit / (invested === null ? buyNotional : invested) * 100;
    const endDate = held > 0 && ns.isValidDate(markDate) && markDate >= ordered.at(-1).date ? markDate : ordered.at(-1).date;
    if (![held, cost, realized, unrealized, profit, finalAmount == null ? 0 : finalAmount, returnPct].every(Number.isFinite)) throw new Error('交易数值过大，无法计算盈亏。');
    return {
      mode: 'quantity', events: ordered,
      buy: { date: buy.date, price: buyNotional / buyQty }, sell: { date: sell.date, price: sellNotional / sellQty }, endDate: endDate,
      holdingDays: daysBetween(buy.date, endDate), holdingHours: hoursBetween(buy.date, endDate), holdingMinutes: Math.round(hoursBetween(buy.date, endDate) * 60), returnPct: returnPct, capital: invested, profit: profit, finalAmount: finalAmount,
      realizedProfit: realized, unrealizedProfit: unrealized, remainingQuantity: held, remainingCost: cost,
      buyQuantity: buyQty, sellQuantity: sellQty, buyNotional: buyNotional, sellNotional: sellNotional, markPrice: mark,
      returnBasis: invested === null ? '累计买入成本' : '投入金额'
    };
  }

  ns.setTradeEvent = setTradeEvent;
  ns.addTradeEvent = addTradeEvent;
  ns.updateTradeEvent = updateTradeEvent;
  ns.changeTradePrice = changeTradePrice;
  ns.calculateTrade = calculateTrade;
  ns.formatHoldingDuration = formatHoldingDuration;
})(window);
