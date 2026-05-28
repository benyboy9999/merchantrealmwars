import cron from 'node-cron';
import type { Server as SocketServer } from 'socket.io';
import { WsEvent } from '@artemis/shared';
import { config } from '../config/index.js';
import { db } from '../db/client.js';

let tickNumber = 0;

/**
 * Run one complete game tick.
 * Order: Upkeep → Production → Consumption → Caravans → Exchange → Tax → Broadcast
 */
async function runTick(io: SocketServer): Promise<void> {
  const start = Date.now();
  tickNumber++;

  // Phase 1: Upkeep — deduct building maintenance materials, mark dormant if unmet
  // TODO: implement when resource graph is finalised

  // Phase 2: Production — compute output for all non-dormant buildings
  // TODO: implement when resource graph is finalised

  // Phase 3: Consumption — apply worker consumption penalties/bonuses
  // TODO: implement when resource graph is finalised

  // Phase 4: Caravans — deliver arrived cargo
  const now = new Date();
  const arrivedCaravans = await db.caravan.findMany({
    where: { status: 'IN_TRANSIT', arrivesAt: { lte: now } },
  });
  for (const caravan of arrivedCaravans) {
    // TODO: deliver cargo to destination (keep ResourceLedger or exchange deposit)
    await db.caravan.update({ where: { id: caravan.id }, data: { status: 'ARRIVED' } });
  }

  // Phase 5: Exchange — match buy/sell orders per region
  // TODO: call matchOrders() from engine per region per resource

  // Phase 6: Tax — collect and distribute
  // TODO: implement when tax rates are finalised

  // Phase 7: Record tick + broadcast
  const durationMs = Date.now() - start;
  await db.gameTick.create({ data: { tickNumber, processedAt: new Date(), durationMs } });

  io.emit(WsEvent.TICK_COMPLETE, { tickNumber, processedAt: new Date(), durationMs });
}

export function startTickJob(io: SocketServer): void {
  const intervalSeconds = config.TICK_INTERVAL_SECONDS;
  // node-cron uses cron syntax — convert seconds to a cron expression
  // For intervals < 60s, we use setInterval instead
  if (intervalSeconds < 60) {
    setInterval(() => void runTick(io), intervalSeconds * 1000);
    console.warn(`⏱  Tick job running every ${intervalSeconds}s (dev mode)`);
  } else {
    const minutes = Math.floor(intervalSeconds / 60);
    cron.schedule(`*/${minutes} * * * *`, () => void runTick(io));
    console.warn(`⏱  Tick job running every ${minutes}min`);
  }
}
