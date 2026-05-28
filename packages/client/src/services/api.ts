const BASE = '';
const ADMIN_TOKEN = 'artemis-admin-dev';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': ADMIN_TOKEN,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, (body as { error: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

const get  = <T>(path: string)                => req<T>(path);
const post = <T>(path: string, body?: unknown) => req<T>(path, { method: 'POST',  body: body ? JSON.stringify(body) : undefined });
const del  = <T>(path: string)                => req<T>(path, { method: 'DELETE' });
const patch = <T>(path: string, body: unknown) => req<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export const api = {
  // Regions
  regions: () => get<{ regions: Region[] }>('/api/regions'),
  plots:   (regionId: string) => get<{ plots: Plot[] }>(`/api/regions/${regionId}/plots`),

  // Keeps
  keeps:        () => get<{ keeps: Keep[] }>('/api/keeps'),
  keep:         (id: string) => get<{ keep: Keep; storage: Storage }>(`/api/keeps/${id}`),
  createKeep:   (plotId: string, name: string) => post<{ keep: Keep }>('/api/keeps', { plotId, name }),
  buildBuilding:(keepId: string, buildingType: string, slotIndex: number) =>
    post<{ building: Building }>(`/api/keeps/${keepId}/buildings`, { buildingType, slotIndex }),
  demolish:     (keepId: string, buildingId: string) => del(`/api/keeps/${keepId}/buildings/${buildingId}`),
  setWorkers:   (keepId: string, buildingId: string, count: number) =>
    patch<{ building: Building }>(`/api/keeps/${keepId}/buildings/${buildingId}/workers`, { count }),

  // Queue
  queue:       (keepId: string, buildingType: string) =>
    get<{ orders: ProductionOrder[] }>(`/api/keeps/${keepId}/queue/${buildingType}`),
  addOrder:    (keepId: string, buildingType: string, body: AddOrderBody) =>
    post<{ order: ProductionOrder }>(`/api/keeps/${keepId}/queue/${buildingType}`, body),
  removeOrder: (keepId: string, orderId: string) => del(`/api/keeps/${keepId}/queue/${orderId}`),

  // Exchange
  orders:     (regionId = 'CENTRAL') => get<{ orders: MarketOrder[] }>(`/api/exchange/orders?regionId=${regionId}`),
  fillOrder:  (orderId: string, quantity: number) =>
    post<{ ok: boolean }>(`/api/exchange/orders/${orderId}/fill`, { quantity }),

  // Caravans
  caravans:      () => get<{ caravans: Caravan[] }>('/api/caravans'),
  dispatch:      (body: DispatchBody) => post<{ caravan: Caravan }>('/api/caravans/dispatch', body),
  cancelCaravan: (id: string) => post(`/api/caravans/${id}/cancel`),

  // Admin
  adminStatus:          () => get<AdminStatus>('/admin/status'),
  adminTick:            () => post<TickResult>('/admin/tick'),
  adminBypass:          (enabled: boolean) => post('/admin/bypass', { enabled }),
  adminCompleteCaravans:() => post<{ completed: number }>('/admin/complete-caravans'),
};

export { ApiError };

// ── Types (lightweight — full types live in @artemis/shared) ───────────────

export interface Region { id: string; name: string; bonusType: string; guildControllable: boolean; plots: Plot[] }
export interface Plot   { id: string; name: string; x: number; y: number; bonusDescription: string; keeps: Keep[] }
export interface Keep   {
  id: string; name: string; empireId: string; plotId: string; buildingSlotCount: number; createdAt: string;
  buildings: Building[]; resourceLedger: LedgerEntry[]; productionOrders: ProductionOrder[];
  plot?: Plot;
}
export interface Building { id: string; keepId: string; buildingType: string; level: number; slotIndex: number; isActive: boolean; isDormant: boolean; health: number; workersAssigned: number }
export interface LedgerEntry { id: string; keepId: string; resourceType: string; quantity: number }
export interface Storage { usedWeight: number; maxWeight: number }
export interface ProductionOrder { id: string; keepId: string; buildingType: string; recipeKey: string; orderType: 'INFINITE' | 'NUMERICAL'; targetQuantity: number | null; producedQuantity: number; position: number }
export interface MarketOrder { id: string; empireId: string | null; regionId: string; orderType: 'BUY' | 'SELL'; resourceType: string; quantity: number; pricePerUnit: number; fulfilledQty: number; status: string }
export interface Caravan { id: string; empireId: string; resourceType: string; quantity: number; animalType: string; animalCount: number; originId: string; destId: string; departedAt: string; arrivesAt: string; status: string }
export interface AdminStatus { bypassEnabled: boolean; lastTick: { tickNumber: number; processedAt: string; durationMs: number } | null }
export interface TickResult { tickNumber: number; durationMs: number; produced: number; delivered: number }
export interface AddOrderBody { recipeKey: string; orderType: 'INFINITE' | 'NUMERICAL'; targetQuantity?: number }
export interface DispatchBody { fromKeepId: string; toKeepId: string; resourceType: string; quantity: number; animalType: string; animalCount: number; feedLoaded: number }
