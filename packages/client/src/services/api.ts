import { useAuthStore } from '../stores/auth.js';

const BASE = '';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token;
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new ApiError(401, 'Session expired');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, (body as { error: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

const get  = <T>(path: string)                => req<T>(path);
const post = <T>(path: string, body?: unknown) => req<T>(path, { method: 'POST',  body: body ? JSON.stringify(body) : null });
const del  = <T>(path: string)                => req<T>(path, { method: 'DELETE' });
const patch = <T>(path: string, body: unknown) => req<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export const api = {
  // Auth
  loginGoogle:   (credential: string) =>
    post<{ accessToken: string; refreshToken: string; player: { id: string; username: string }; empireId: string | null }>(
      '/api/auth/google', { credential }),
  logout:        () => post('/api/auth/logout'),
  createEmpire:  (name: string) => post<{ empire: { id: string; name: string } }>('/api/empire', { name }),

  // Regions
  regions:      () => get<{ regions: Region[] }>('/api/regions'),
  allDistricts: () => get<{ districts: MapDistrict[] }>('/api/regions/districts'),
  districts:    (regionId: string) => get<{ districts: District[] }>(`/api/regions/${regionId}/districts`),

  // Keeps
  keeps:        () => get<{ keeps: Keep[] }>('/api/keeps'),
  keep:         (id: string) => get<{ keep: Keep; storage: Storage; goldBalance: number }>(`/api/keeps/${id}`),
  createKeep:   (plotId: string, name: string) => post<{ keep: Keep }>('/api/keeps', { plotId, name }),
  renameKeep:   (id: string, name: string) => patch<{ keep: Keep }>(`/api/keeps/${id}`, { name }),
  buildBuilding:(keepId: string, buildingType: string, slotIndex: number) =>
    post<{ building: Building }>(`/api/keeps/${keepId}/buildings`, { buildingType, slotIndex }),
  demolish:     (keepId: string, buildingId: string) => del(`/api/keeps/${keepId}/buildings/${buildingId}`),
  unlockSlot:   (keepId: string) => post<{ keep: Keep; cost: number; resource: string }>(`/api/keeps/${keepId}/unlock-slot`),
  setWorkers:   (keepId: string, buildingId: string, count: number) =>
    patch<{ building: Building }>(`/api/keeps/${keepId}/buildings/${buildingId}/workers`, { count }),

  // Queue
  queue:       (keepId: string, buildingType: string) =>
    get<{ orders: ProductionOrder[] }>(`/api/keeps/${keepId}/queue/${buildingType}`),
  addOrder:    (keepId: string, buildingType: string, body: AddOrderBody) =>
    post<{ order: ProductionOrder }>(`/api/keeps/${keepId}/queue/${buildingType}`, body),
  removeOrder: (keepId: string, orderId: string) => del(`/api/keeps/${keepId}/queue/${orderId}`),

  // Exchange
  exchangeStorage: (regionId: string) => get<{ storage: ExchangeStorageEntry[]; goldBalance: number }>(`/api/exchange/storage?regionId=${regionId}`),
  exchangeSell:    (regionId: string, resourceType: string, quantity: number) =>
    post<{ ok: boolean; sold: number; gold: number }>('/api/exchange/sell', { regionId, resourceType, quantity }),
  listings:        (regionId: string, resourceType?: string) =>
    get<{ listings: ExchangeListing[] }>(`/api/exchange/${regionId}/listings${resourceType ? `?resourceType=${resourceType}` : ''}`),
  createListing:   (regionId: string, resourceType: string, quantity: number, pricePerUnit: number) =>
    post<{ listing: ExchangeListing }>(`/api/exchange/${regionId}/listings`, { resourceType, quantity, pricePerUnit }),
  buyListing:      (id: string, quantity: number) =>
    post<{ ok: boolean; quantity: number; resourceType: string; totalGold: number }>(`/api/exchange/listings/${id}/buy`, { quantity }),
  cancelListing:   (id: string) =>
    del<{ ok: boolean; returned: number; resourceType: string }>(`/api/exchange/listings/${id}`),

  // Caravans
  caravans:        () => get<{ caravans: CaravanWithCargo[] }>('/api/caravans'),
  caravan:         (id: string) => get<{ caravan: CaravanWithCargo; capacity: CaravanCapacity }>(`/api/caravans/${id}`),
  caravanLoad:     (id: string, resourceType: string, quantity: number) =>
    post<{ caravan: CaravanWithCargo }>(`/api/caravans/${id}/load`, { resourceType, quantity }),
  caravanUnload:   (id: string, resourceType: string, quantity: number) =>
    post<{ caravan: CaravanWithCargo }>(`/api/caravans/${id}/unload`, { resourceType, quantity }),
  caravanDispatch: (id: string, destType: string, destId: string) =>
    post<{ caravan: CaravanWithCargo }>(`/api/caravans/${id}/dispatch`, { destType, destId }),
  foundKeep:       (plotId: string, keepName: string) =>
    post<{ keep: Keep }>('/api/caravans/found', { plotId, keepName }),

  // Admin
  adminStatus:          () => get<AdminStatus>('/admin/status'),
  adminTick:            () => post<TickResult>('/admin/tick'),
  adminBypass:          (enabled: boolean) => post('/admin/bypass', { enabled }),
  adminCompleteCaravans:   () => post<{ completed: number }>('/admin/complete-caravans'),
  adminCompleteProduction: () => post<{ completed: number }>('/admin/complete-production'),
};

// ── Types (lightweight — full types live in @merchant-realms/shared) ───────────────

export interface Region       { id: string; name: string; guildControllable: boolean; districts?: District[] }
export interface MapPlot      { id: string; name: string; tier: number; x: number; y: number; bonusDescription: string; keeps: { id: string; name: string }[] }
export interface MapDistrict  { id: string; regionId: string; name: string; q: number; r: number; x: number; y: number; tier: number; plots: MapPlot[] }
export interface District { id: string; regionId: string; name: string; bonusDescription: string; q: number; r: number; x: number; y: number; plots: Plot[] }
export interface Plot     { id: string; districtId: string; name: string; tier: number; x: number; y: number; bonusDescription: string; keeps: Keep[]; district?: District }
export interface Keep   {
  id: string; name: string; empireId: string; plotId: string; buildingSlotCount: number; createdAt: string;
  buildings: Building[]; resourceLedger: LedgerEntry[]; productionOrders: ProductionOrder[];
  plot?: Plot;
}
export interface CaravanCargo { id: string; caravanId: string; resourceType: string; quantity: number }
export interface CaravanWithCargo {
  id: string; empireId: string; name: string; animalType: string; animalCount: number;
  locationType: 'KEEP' | 'EXCHANGE' | 'PLOT'; locationId: string;
  status: 'IDLE' | 'IN_TRANSIT';
  destType: 'KEEP' | 'EXCHANGE' | 'PLOT' | null; destId: string | null;
  departedAt: string | null; arrivesAt: string | null;
  cargo: CaravanCargo[];
}
export interface CaravanCapacity { usedWeight: number; maxWeight: number }
export interface ExchangeStorageEntry { id: string; empireId: string; regionId: string; resourceType: string; quantity: number }
export interface Building { id: string; keepId: string; buildingType: string; level: number; slotIndex: number; isActive: boolean; isDormant: boolean; health: number; workersAssigned: number; productionProgress: number }
export interface LedgerEntry { id: string; keepId: string; resourceType: string; quantity: number }
export interface Storage { usedWeight: number; maxWeight: number }
export interface ProductionOrder { id: string; keepId: string; buildingType: string; recipeKey: string; orderType: 'INFINITE' | 'NUMERICAL'; targetQuantity: number | null; producedQuantity: number; position: number }
export interface ExchangeListing { id: string; empireId: string | null; regionId: string; resourceType: string; quantity: number; pricePerUnit: number; fulfilledQty: number; status: string; createdAt: string }
export interface AdminStatus { bypassEnabled: boolean; lastTick: { tickNumber: number; processedAt: string; durationMs: number } | null; goldBalance: number; tickIntervalSeconds: number }
export interface TickResult { tickNumber: number; durationMs: number; produced: number; delivered: number }
export interface AddOrderBody { recipeKey: string; orderType: 'INFINITE' | 'NUMERICAL'; targetQuantity?: number }
