Absolutely! I’ve updated the Markdown to include a **“How to Run the Project”** section. You can save this as `README.md`.

````markdown
# ⭐ P2P Distributed Exchange Readme: BFX Challenge ⭐

This document details the architecture, implementation, outputs, and future considerations for the simplified P2P distributed exchange created to fulfill the BFX challenge requirements.

---

## 1. Project Overview and Achievement of Task Requirements

The project successfully implements a P2P distributed exchange using **Grenache RPC** for order distribution. Each node operates independently, managing its own instance of the Order Book and broadcasting its actions to the network.

| Requirement | Status | Implementation Details |
| :--- | :--- | :--- |
| **Code in Javascript** | ✅ Achieved | All files (`OrderNode.js`, `OrderBook.js`) are written in Node.js. |
| **Use Grenache for communication** | ✅ Achieved | Uses `grenache-nodejs-http` (`PeerRPCServer`, `PeerRPCClient`) and `grenache-nodejs-link` to connect to a dual-Grape DHT network. |
| **Simple order matching engine** | ✅ Achieved | `OrderBook.js` implements a basic **Price/Time Priority** matching engine. |
| **Clients submit orders to local instance** | ✅ Achieved | The `submitOrder` function processes the order locally first via `orderbook.addOrder(order)`. |
| **Order is distributed to other instances** | ✅ Achieved | Orders are distributed via the `broadcastOrder` function using `link.lookup` and `peerClient.request`. |
| **Orders match, remainder added** | ✅ Achieved | The `OrderBook.js` correctly executes trades, updates quantities, and adds any remainder to the book. |

---

## 2. Architecture and Code Structure

### A. `OrderBook.js` (The Matching Engine)

This class manages the core logic for trade execution.

- **Logic:** Implements **Price-Time Priority**. Bids (`buys`) are sorted descending by price; Asks (`sells`) are sorted ascending by price.
- **Matching:** Incoming orders are matched against the most aggressive price level (highest bid for a sell order; lowest ask for a buy order).
- **Minor Improvement:** The returned `matches` object was refined to include the `buyId` and `sellId` (though not shown in the final console logs), making trade traceability easier for a backend system.

### B. `OrderNode.js` (The Distributed Layer)

This file handles P2P connectivity, order flow, and state logging.

- **P2P Setup:** Uses `PeerRPCServer` to announce the `distributed_exchange` service to the Grape DHT and `PeerRPCClient` to request other peers.
- **Order Flow:** An order is processed **locally** first (providing immediate feedback) and then **broadcast** to all other peers found in the DHT lookup.
- **Remote Handling:** The `service.on('request')` listener handles incoming orders from remote nodes, processes them via the local `OrderBook`, and logs the resulting state.

---

## 3. How to Run the Project

Follow these steps to start the P2P exchange locally:

### 3.1 Install Dependencies

```bash
npm install grenache-nodejs-http grenache-nodejs-link
````

### 3.2 Start Grenache Grape Servers

Run two separate grape servers in different terminals:

```bash
# Terminal 1
 grape --dp 20001 --apw 30001 --aph 30002 --bn 127.0.0.1:20002 --host 0.0.0.0

# Terminal 2
 grape --dp 20002 --apw 40001 --aph 40002 --bn 127.0.0.1:20001 --host 0.0.0.0
```

### 3.3 Start Nodes

In two additional terminals, run the nodes simultaneously or almost at thesame time:

```bash
# Node 1 (connects to grape on 20001/30002)
node OrderNode.js

# Node 2 (connects to grape on 20002/40002. use the command line arg)
GRAPE_APIPORT=40002 node OrderNode.js
```

Each node will:

1. Start its own instance of `OrderBook`.
2. Submit demo orders locally.
3. Broadcast orders to the peer node.
4. Process incoming orders from the peer.

### 3.4 Expected Output

* Local orders are executed immediately.
* Orders received from the peer are either matched or added to the book.
* Logs will display:

```
[node_XXXX] Submitting sell 150@100.5
 -> 150 added to local book
 -> Local book: 0 bids, 1 asks
[node_XXXX] Broadcasting to 1 peer(s)
[node_XXXX] Submitting buy 50@101
 -> 1 local trade(s)
     50@100.5
 -> Local book: 0 bids, 1 asks
...
[node_XXXX] Received sell order from node_YYYY: 150@100.5
 -> Remainder 150 added to book
 -> Book state: 0 bids, 2 asks
```

---

## 4. Limitations, Issues, and Future Solutions

The implementation demonstrates the trade-off in distributed systems: achieving consistency while maintaining decentralization.

### A. Major Limitations (Distributed Consensus Issues)

| Limitation              | Root Cause                                                                                                                | Future Solution                                                                                                   |
| :---------------------- | :------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------- |
| **Order Duplication**   | Grenache's RPC client retries requests that do not receive timely responses. Network latency causes duplicate processing. | Use a **global `processedOrderIds` Set** and/or switch from RPC to **Pub/Sub** to avoid retries.                  |
| **Order Inconsistency** | Orders are processed immediately locally; final book state may differ between nodes due to race conditions.               | Introduce a **Consensus Mechanism** (Raft, Paxos, or Sequencer node) to guarantee deterministic order processing. |

### B. Minor Issues and Improvements

| Issue                         | Improvement                                               |                                                                                         |
| :---------------------------- | :-------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Self-Broadcast**            | Node may broadcast to itself redundantly.                 | Filter out the local node from the peer list in `broadcastOrder`.                       |
| **Network Protocol**          | RPC retries cause duplicate messages.                     | Switch to **Grenache Pub/Sub** for fire-and-forget broadcasting.                        |
| **Order Matching Efficiency** | Repeated array sorting slows performance for large books. | Use **Priority Queues** or **Red-Black Trees** for $O(\log N)$ insertion and retrieval. |
