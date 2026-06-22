import type { Server } from 'socket.io';
import { WsEvent } from '@merchant-realms/shared';
import { db } from '../db/client.js';

let io: Server | null = null;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function initCaravanTimers(socketServer: Server): void {
  io = socketServer;
}

export function scheduleArrival(caravanId: string, arrivesAt: Date): void {
  // Clear any existing timer (e.g. if a caravan is re-dispatched after cancellation)
  const existing = timers.get(caravanId);
  if (existing) clearTimeout(existing);

  const delayMs = Math.max(0, arrivesAt.getTime() - Date.now());
  timers.set(caravanId, setTimeout(() => void arrive(caravanId), delayMs));
}

export function cancelArrival(caravanId: string): void {
  const t = timers.get(caravanId);
  if (t) { clearTimeout(t); timers.delete(caravanId); }
}

async function arrive(caravanId: string): Promise<void> {
  timers.delete(caravanId);

  // Fetch caravan + empire.playerId in one query
  const caravan = await db.caravan.findUnique({
    where:   { id: caravanId },
    include: { empire: { select: { playerId: true } } },
  });
  if (!caravan || caravan.status !== 'IN_TRANSIT' || !caravan.destType || !caravan.destId) return;

  const arrived = await db.caravan.update({
    where:   { id: caravanId },
    data: {
      status:       'IDLE',
      locationType: caravan.destType,
      locationId:   caravan.destId,
      destType:     null,
      destId:       null,
      departedAt:   null,
      arrivesAt:    null,
    },
    include: { warehouse: { include: { items: true } } },
  });

  io?.to(`player:${caravan.empire.playerId}`).emit(WsEvent.CARAVAN_ARRIVED, { caravan: arrived });
}

// Called once at server startup — reschedules timers for any caravans that were
// in transit when the server last shut down.
export async function rescheduleInTransitCaravans(): Promise<void> {
  const caravans = await db.caravan.findMany({
    where: { status: 'IN_TRANSIT', arrivesAt: { not: null } },
  });
  for (const c of caravans) {
    if (c.arrivesAt) scheduleArrival(c.id, c.arrivesAt);
  }
  if (caravans.length > 0) {
    console.log(`[caravans] rescheduled ${caravans.length} in-transit caravan(s)`);
  }
}
