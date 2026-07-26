/**
 * EchoChamber Load Test
 *
 * Simulates concurrent WebSocket clients connecting through nginx,
 * logging in, and exchanging private messages.
 *
 * Metrics captured:
 *   - Max concurrent connections without errors
 *   - p50 / p95 / p99 / max message round-trip latency
 *   - Connection errors, message failures, unexpected disconnects
 *
 * Usage:
 *   node run.js [--clients 200] [--ramp 10] [--duration 30] [--rate 2] [--url http://localhost]
 */

import { io as ioClient } from 'socket.io-client';

// ---------------------------------------------------------------------------
// CLI args (simple key=value parsing)
// ---------------------------------------------------------------------------
function arg(name, fallback) {
  const flag = `--${name}`;
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

const TARGET_URL       = arg('url',      'http://localhost');
const TOTAL_CLIENTS    = Number(arg('clients',  '200'));
const RAMP_SECONDS     = Number(arg('ramp',     '10'));
const TEST_SECONDS     = Number(arg('duration', '30'));
const MSGS_PER_SEC     = Number(arg('rate',     '2'));   // per client

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const sockets       = [];          // all active sockets
const latencies     = [];          // round-trip times (ms)
let connectedCount  = 0;
let connectErrors   = 0;
let disconnects     = 0;
let messagesSent    = 0;
let messagesRecvd   = 0;
let messageFails    = 0;
let peakConcurrent  = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function userId(i)  { return `loadtest-user-${i}`; }
function sleep(ms)  { return new Promise(r => setTimeout(r, ms)); }
function now()      { return performance.now(); }

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const i = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, i)];
}

// ---------------------------------------------------------------------------
// Connect a single client
// ---------------------------------------------------------------------------
function connectClient(index) {
  return new Promise((resolve) => {
    const uid = userId(index);
    const socket = ioClient(TARGET_URL, {
      transports: ['websocket'],   // skip polling, go straight to WS
      forceNew: true,
      reconnection: false,         // don't reconnect during the test
    });

    const connectStart = now();

    socket.on('connect', () => {
      connectedCount++;
      if (connectedCount > peakConcurrent) peakConcurrent = connectedCount;
      socket._uid = uid;
      socket._index = index;
      socket._connectLatency = now() - connectStart;
      socket.emit('login', uid);
      sockets.push(socket);
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      connectErrors++;
      resolve(null);
    });

    socket.on('disconnect', (reason) => {
      connectedCount--;
      if (reason !== 'io client disconnect') {
        disconnects++;
      }
    });

    // Listen for incoming messages and record latency
    socket.on('new_message', (data) => {
      messagesRecvd++;
      if (data.message && data.message.startsWith('t:')) {
        const sentAt = Number(data.message.split(':')[1]);
        if (!isNaN(sentAt)) {
          latencies.push(now() - sentAt);
        }
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Ramp-up phase
// ---------------------------------------------------------------------------
async function rampUp() {
  console.log(`\n⏫  Ramping up ${TOTAL_CLIENTS} clients over ${RAMP_SECONDS}s to ${TARGET_URL} ...`);
  const delayMs = (RAMP_SECONDS * 1000) / TOTAL_CLIENTS;
  const rampStart = now();

  for (let i = 0; i < TOTAL_CLIENTS; i++) {
    connectClient(i);               // fire and forget — don't block on each
    if (delayMs > 1) await sleep(delayMs);

    // Progress every 10%
    if ((i + 1) % Math.max(1, Math.floor(TOTAL_CLIENTS / 10)) === 0) {
      console.log(`   ${i + 1}/${TOTAL_CLIENTS} initiated  (${connectedCount} connected, ${connectErrors} errors)`);
    }
  }

  // Wait a bit for trailing connections
  await sleep(2000);
  const elapsed = ((now() - rampStart) / 1000).toFixed(1);
  console.log(`✅  Ramp-up done in ${elapsed}s — ${connectedCount} connected, ${connectErrors} failed\n`);
}

// ---------------------------------------------------------------------------
// Messaging phase
// ---------------------------------------------------------------------------
async function messagingPhase() {
  if (sockets.length < 2) {
    console.log('❌  Not enough connected clients to run messaging phase.');
    return;
  }

  console.log(`💬  Sending messages for ${TEST_SECONDS}s  (${MSGS_PER_SEC} msg/s per client) ...`);
  const intervalMs = 1000 / MSGS_PER_SEC;
  const endTime = now() + TEST_SECONDS * 1000;
  let tick = 0;

  while (now() < endTime) {
    const batchStart = now();

    for (const socket of sockets) {
      if (!socket.connected) continue;

      // Pick a random other client as recipient
      let target;
      do {
        target = sockets[Math.floor(Math.random() * sockets.length)];
      } while (target._index === socket._index || !target.connected);

      socket.emit('private_message', {
        fromUserId: socket._uid,
        toUserId:   target._uid,
        message:    `t:${now()}`,     // embed send timestamp for latency calc
      });
      messagesSent++;
    }

    tick++;
    // Progress every 5 seconds
    if (tick % (MSGS_PER_SEC * 5) === 0) {
      const secsLeft = Math.round((endTime - now()) / 1000);
      console.log(`   ${secsLeft}s left — sent: ${messagesSent}  recv: ${messagesRecvd}  disconnects: ${disconnects}`);
    }

    const batchElapsed = now() - batchStart;
    const waitTime = intervalMs - batchElapsed;
    if (waitTime > 0) await sleep(waitTime);
  }

  // Allow in-flight messages to arrive
  await sleep(2000);
  console.log(`✅  Messaging phase done\n`);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
function report() {
  const sorted = [...latencies].sort((a, b) => a - b);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    LOAD TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Target URL              : ${TARGET_URL}`);
  console.log(`  Requested clients       : ${TOTAL_CLIENTS}`);
  console.log(`  Peak concurrent conns   : ${peakConcurrent}`);
  console.log(`  Connection errors       : ${connectErrors}`);
  console.log(`  Unexpected disconnects  : ${disconnects}`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`  Messages sent           : ${messagesSent}`);
  console.log(`  Messages received       : ${messagesRecvd}`);
  console.log(`  Message delivery rate   : ${messagesSent > 0 ? ((messagesRecvd / messagesSent) * 100).toFixed(1) : 0}%`);
  console.log('───────────────────────────────────────────────────────────────');

  if (sorted.length > 0) {
    console.log(`  Latency samples         : ${sorted.length}`);
    console.log(`  p50  latency            : ${percentile(sorted, 50).toFixed(2)} ms`);
    console.log(`  p95  latency            : ${percentile(sorted, 95).toFixed(2)} ms`);
    console.log(`  p99  latency            : ${percentile(sorted, 99).toFixed(2)} ms`);
    console.log(`  Max  latency            : ${sorted[sorted.length - 1].toFixed(2)} ms`);
    console.log(`  Min  latency            : ${sorted[0].toFixed(2)} ms`);
  } else {
    console.log(`  (no latency data — no messages received)`);
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------
function teardown() {
  for (const s of sockets) {
    if (s && s.connected) s.disconnect();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n🚀  EchoChamber Load Test');
  console.log(`   Clients: ${TOTAL_CLIENTS}  |  Ramp: ${RAMP_SECONDS}s  |  Duration: ${TEST_SECONDS}s  |  Rate: ${MSGS_PER_SEC} msg/s/client\n`);

  try {
    await rampUp();
    await messagingPhase();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    report();
    teardown();
    // Force exit — some sockets may linger
    setTimeout(() => process.exit(0), 1000);
  }
}

main();
