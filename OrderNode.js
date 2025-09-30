'use strict';

const { PeerRPCServer, PeerRPCClient } = require('grenache-nodejs-http');
const Link = require('grenache-nodejs-link');
const OrderBook = require('./orderbook');

// ----------------------------
// Config
// ----------------------------
const NODE_ID = 'node_' + Math.floor(Math.random() * 1000 + 1024);
const SERVICE_NAME = 'distributed_exchange';
const orderbook = new OrderBook();
const GRAPE_APIPORT = process.env.GRAPE_APIPORT || 30002;

// ----------------------------
// Initialize Link
// ----------------------------
const link = new Link({
  grape: `http://127.0.0.1:${GRAPE_APIPORT}`
});
link.start();

// ----------------------------
// RPC Server Setup
// ----------------------------
const peerServer = new PeerRPCServer(link, { timeout: 300000 });
peerServer.init();

const port = 1024 + Math.floor(Math.random() * 1000);
const service = peerServer.transport('server');
service.listen(port);

// Announce service to DHT
setInterval(() => {
  link.announce(SERVICE_NAME, service.port, {});
}, 1000);

console.log(`\n[${NODE_ID}] Node started on port ${port}, connecting to Grape ${GRAPE_APIPORT}`);

// ----------------------------
// RPC Client Setup
// ----------------------------
const peerClient = new PeerRPCClient(link, {});
peerClient.init();

// ----------------------------
// Handle incoming orders from other nodes
// ----------------------------
service.on('request', (rid, key, payload, handler) => {
  try {
    const order = payload;
    
    // Ignore orders from self
    if (order.nodeId === NODE_ID) {
      handler.reply(null, { status: 'ignored', reason: 'self' });
      return;
    }

    console.log(`\n[${NODE_ID}] Received ${order.type} order from ${order.nodeId}: ${order.qty}@${order.price}`);

    // Process order
    const { matches, remainderQty } = orderbook.addOrder(order);

    if (matches.length > 0) {
      console.log(`  -> ${matches.length} trade(s) executed`);
      matches.forEach(m => {
        console.log(`     Trade: ${m.qty}@${m.price}`);
      });
    }

    if (remainderQty > 0) {
      console.log(`  -> Remainder ${remainderQty} added to book`);
    }

    console.log(`  -> Book state: ${orderbook.buys.length} bids, ${orderbook.sells.length} asks`);

    handler.reply(null, { 
      status: 'processed',
      matches: matches.length,
      remainder: remainderQty
    });

  } catch (err) {
    console.error(`[${NODE_ID}] Error processing order:`, err.message);
    handler.reply(err);
  }
});

// ----------------------------
// Broadcast order to all peers
// ----------------------------
function broadcastOrder(order) {
  link.lookup(SERVICE_NAME, (err, peers) => {
    if (err) {
      console.error(`[${NODE_ID}] Lookup error:`, err);
      return;
    }

    if (!peers || peers.length === 0) {
      console.log(`[${NODE_ID}] No peers found yet`);
      return;
    }

    console.log(`[${NODE_ID}] Broadcasting to ${peers.length} peer(s)`);

    peers.forEach(peer => {
      peerClient.request(SERVICE_NAME, order, { timeout: 10000 }, (err, result) => {
        if (err) {
          console.error(`[${NODE_ID}] Broadcast error:`, err.message);
        }
      });
    });
  });
}

// ----------------------------
// Submit order
// ----------------------------
function submitOrder(type, price, qty) {
  const order = {
    id: `${type}_${NODE_ID}_${Date.now()}`,
    nodeId: NODE_ID,
    timestamp: Date.now(),
    type,
    price,
    qty
  };

  console.log(`\n[${NODE_ID}] Submitting ${type} ${qty}@${price}`);

  // 1. Process locally first
  const { matches, remainderQty } = orderbook.addOrder(order);

  if (matches.length > 0) {
    console.log(`  -> ${matches.length} local trade(s)`);
    matches.forEach(m => console.log(`     ${m.qty}@${m.price}`));
  }

  if (remainderQty > 0) {
    console.log(`  -> ${remainderQty} added to local book`);
  }

  console.log(`  -> Local book: ${orderbook.buys.length} bids, ${orderbook.sells.length} asks`);

  // 2. Broadcast to other nodes
  broadcastOrder(order);
}

// ----------------------------
// Demo orders
// ----------------------------
setTimeout(() => {
  console.log(`\n[${NODE_ID}] Starting order sequence...`);
  
  submitOrder('sell', 100.5, 150);
  setTimeout(() => submitOrder('buy', 101, 50), 2000);
  setTimeout(() => submitOrder('buy', 99.5, 100), 4000);
  setTimeout(() => submitOrder('sell', 99, 50), 6000);
}, 3000);