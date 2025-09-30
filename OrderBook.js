'use strict';

class OrderBook {
  constructor() {
    this.buys = [];  // array of buy orders, sorted descending by price
    this.sells = []; // array of sell orders, sorted ascending by price
  }

  addOrder(order) {
    const matches = [];
    let remainderQty = order.qty;

    if (order.type === 'buy') {
      // Match against lowest sell orders first
      this.sells.sort((a, b) => a.price - b.price);
      while (this.sells.length > 0 && remainderQty > 0 && this.sells[0].price <= order.price) {
        const sellOrder = this.sells[0];
        const tradeQty = Math.min(remainderQty, sellOrder.qty);
        matches.push({ qty: tradeQty, price: sellOrder.price });

        sellOrder.qty -= tradeQty;
        remainderQty -= tradeQty;

        if (sellOrder.qty === 0) {
          this.sells.shift(); // remove fully matched sell order
        }
      }

      if (remainderQty > 0) {
        this.buys.push({ ...order, qty: remainderQty });
        // Sort buys descending
        this.buys.sort((a, b) => b.price - a.price);
      }

    } else if (order.type === 'sell') {
      // Match against highest buy orders first
      this.buys.sort((a, b) => b.price - a.price);
      while (this.buys.length > 0 && remainderQty > 0 && this.buys[0].price >= order.price) {
        const buyOrder = this.buys[0];
        const tradeQty = Math.min(remainderQty, buyOrder.qty);
        matches.push({ qty: tradeQty, price: buyOrder.price });

        buyOrder.qty -= tradeQty;
        remainderQty -= tradeQty;

        if (buyOrder.qty === 0) {
          this.buys.shift(); // remove fully matched buy order
        }
      }

      if (remainderQty > 0) {
        this.sells.push({ ...order, qty: remainderQty });
        // Sort sells ascending
        this.sells.sort((a, b) => a.price - b.price);
      }
    }

    return { matches, remainderQty };
  }
}

module.exports = OrderBook;
