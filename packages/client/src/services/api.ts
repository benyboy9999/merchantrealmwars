import { useAuthStore } from '../stores/auth.js';
import { useServerStatus } from '../stores/server-status.js';

const BASE = '';

function flagNetworkError(): void {
  useServerStatus.getState().markDown();
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Singleton refresh promise — prevents multiple concurrent 401s from each
// triggering their own refresh call.
let inflightRefresh: Promise<string> | null = null;

async function tryRefresh(): Promise<string> {
  if (inflightRefresh) return inflightRefresh;

  inflightRefresh = (async () => {
    const { refreshToken, setTokens, logout } = useAuthStore.getState();
    if (!refreshToken) throw new Error('no refresh token');

    let res: Response;
    try {
      res = await fetch(`${BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      flagNetworkError();
      throw new ApiError(0, 'Could not reach server to refresh session');
    }

    if (!res.ok) {
      // Server explicitly rejected the token — session is genuinely invalid
      logout();
      window.location.href = '/login';
      throw new ApiError(401, 'Session expired — please sign in again');
    }

    const data = await res.json() as { accessToken: string; refreshToken: string };
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  })().finally(() => { inflightRefresh = null; });

  return inflightRefresh;
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      signal: AbortSignal.timeout(30_000),
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
  } catch (err) {
    flagNetworkError();
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new ApiError(0, 'Request timed out — server may be unreachable');
    }
    throw new ApiError(0, 'Network error — check your connection');
  }

  if (res.status === 401) {
    // Attempt a silent token refresh then retry the original request once.
    try {
      const newToken = await tryRefresh();
      const retryRes = await fetch(`${BASE}${path}`, {
        signal: AbortSignal.timeout(15_000),
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
          ...options?.headers,
        },
      });
      if (!retryRes.ok) {
        const body = await retryRes.json().catch(() => ({ error: retryRes.statusText }));
        throw new ApiError(retryRes.status, (body as { error: string }).error ?? retryRes.statusText);
      }
      return retryRes.json() as Promise<T>;
    } catch (refreshErr) {
      if (refreshErr instanceof ApiError) throw refreshErr;
      // tryRefresh already called logout + redirect
      throw new ApiError(401, 'Session expired');
    }
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
  // Auth — all methods return the same shape; the game doesn't know which provider was used
  loginGoogle:   (credential: string) =>
    post<AuthResponse>('/api/auth/google', { credential }),
  loginEmail:    (email: string, password: string) =>
    post<AuthResponse>('/api/auth/login', { email, password }),
  register:      (email: string, password: string) =>
    post<AuthResponse>('/api/auth/register', { email, password }),
  logout:        () => post('/api/auth/logout'),
  createEmpire:  (name: string) => post<{ empire: { id: string; name: string }; accessToken: string; refreshToken: string }>('/api/empire', { name }),
  empireBootstrap: () => get<{ empire: EmpireBootstrap }>('/api/empire/me'),

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
  exchangeWarehouse: (regionId: string) => get<{ warehouse: Warehouse | null; goldBalance: number }>(`/api/exchange/warehouse?regionId=${regionId}`),
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
  transfer: (params: {
    fromWarehouseId: string;
    toWarehouseId:   string;
    resourceType:    string;
    quantity:        number;
  }) => post<{ ok: boolean; fromWarehouse: Warehouse; toWarehouse: Warehouse }>('/api/inventory/transfer', params),
  caravanDispatch: (id: string, destType: string, destId: string) =>
    post<{ caravan: CaravanWithCargo }>(`/api/caravans/${id}/dispatch`, { destType, destId }),
  foundKeep:       (plotId: string, keepName: string) =>
    post<{ keep: Keep }>('/api/caravans/found', { plotId, keepName }),

  // Admin — server controls
  adminStatus:          () => get<AdminStatus>('/admin/status'),
  adminTick:            () => post<TickResult>('/admin/tick'),
  adminBypass:          (enabled: boolean) => post('/admin/bypass', { enabled }),
  adminCompleteCaravans:   () => post<{ completed: number }>('/admin/complete-caravans'),
  adminCompleteProduction: () => post<{ completed: number }>('/admin/complete-production'),

  // Admin — player management
  adminPlayers:        () => get<{ players: AdminPlayer[] }>('/admin/players'),
  adminPlayer:         (id: string) => get<{ player: AdminPlayerDetail }>(`/admin/players/${id}`),
  adminSetGold:        (id: string, amount: number, op: 'set' | 'add') =>
    patch<{ goldBalance: number }>(`/admin/players/${id}/gold`, { amount, op }),
  adminGrantResources: (id: string, keepId: string, resourceType: string, quantity: number) =>
    post(`/admin/players/${id}/resources`, { keepId, resourceType, quantity }),
  adminGrantExchangeResources: (id: string, regionId: string, resourceType: string, quantity: number) =>
    post(`/admin/players/${id}/exchange-resources`, { regionId, resourceType, quantity }),
  adminStarterCaravan: (id: string) => post(`/admin/players/${id}/starter-caravan`),
  adminSetAdmin:       (id: string, isAdmin: boolean) =>
    patch(`/admin/players/${id}/admin`, { isAdmin }),
  adminDeletePlayer:   (id: string) => del(`/admin/players/${id}`),
};

// ── Types (lightweight — full types live in @merchant-realms/shared) ───────────────

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  empireId: string | null;
  empireName: string | null;
}

export interface Region       { id: string; name: string; guildControllable: boolean; districts?: District[] }
export interface MapPlot      { id: string; name: string; tier: number; isCenter: boolean; x: number; y: number; bonusDescription: string; keeps: { id: string; name: string; empireId: string }[] }
export interface MapDistrict  { id: string; regionId: string; name: string; q: number; r: number; x: number; y: number; tier: number; plots: MapPlot[] }
export interface District { id: string; regionId: string; name: string; bonusDescription: string; q: number; r: number; x: number; y: number; plots: Plot[] }
export interface Plot     { id: string; districtId: string; name: string; tier: number; x: number; y: number; bonusDescription: string; keeps: Keep[]; district?: District }
export interface WarehouseItem {
  id: string; warehouseId: string; resourceType: string; quantity: number; updatedAt: string;
}
export interface Warehouse {
  id: string; type: 'KEEP' | 'CARAVAN' | 'EXCHANGE'; empireId: string; regionId: string | null;
  cap: number; items: WarehouseItem[];
}
export interface Keep {
  id: string; name: string; empireId: string; plotId: string; buildingSlotCount: number; createdAt: string;
  warehouseId: string | null;
  buildings: Building[]; warehouse: Warehouse | null; productionOrders: ProductionOrder[];
  plot?: Plot;
}
export interface CaravanWithCargo {
  id: string; empireId: string; name: string; animalType: string; animalCount: number;
  locationType: 'KEEP' | 'EXCHANGE' | 'PLOT'; locationId: string;
  status: 'IDLE' | 'IN_TRANSIT';
  destType: 'KEEP' | 'EXCHANGE' | 'PLOT' | null; destId: string | null;
  departedAt: string | null; arrivesAt: string | null;
  warehouseId: string | null;
  warehouse: Warehouse | null;
}
export interface CaravanCapacity { usedWeight: number; maxWeight: number }
export interface ProductionTask {
  id: string; buildingId: string; keepId: string; recipeKey: string;
  startedAt: string; completesAt: string;
  progressAtUpdate: number; updatedAt: string; speedSnapshot: number;
}
export interface Building {
  id: string; keepId: string; buildingType: string; level: number; slotIndex: number;
  isActive: boolean; isDormant: boolean; health: number; workersAssigned: number; productionProgress: number;
  productionTask: ProductionTask | null;
}
export interface Storage { usedWeight: number; maxWeight: number }
export interface ProductionOrder { id: string; keepId: string; buildingType: string; recipeKey: string; orderType: 'INFINITE' | 'NUMERICAL'; targetQuantity: number | null; producedQuantity: number; position: number }
export interface ExchangeListing { id: string; empireId: string | null; regionId: string; resourceType: string; quantity: number; pricePerUnit: number; fulfilledQty: number; status: string; createdAt: string }
export interface AdminStatus { bypassEnabled: boolean; lastTick: { tickNumber: number; processedAt: string; durationMs: number } | null; goldBalance: number; tickIntervalSeconds: number }
export interface TickResult { tickNumber: number; durationMs: number; produced: number; delivered: number }
export interface AddOrderBody { recipeKey: string; orderType: 'INFINITE' | 'NUMERICAL'; targetQuantity?: number }

export interface EmpireBootstrap {
  id: string;
  name: string;
  goldBalance: number;
  keeps: Array<{
    id: string; name: string; plotId: string; warehouseId: string | null;
    plot?: { id: string; name: string; districtId: string; district?: { id: string; name: string; regionId: string } | null } | null;
  }>;
  caravans: CaravanWithCargo[];
  warehouses: Array<{ id: string; regionId: string | null; cap: number }>;
}

export interface AdminPlayer {
  id: string; email: string; isAdmin: boolean; createdAt: string; lastActiveAt: string; googleId: string | null;
  empire: { id: string; name: string; goldBalance: number; _count: { keeps: number; caravans: number } } | null;
}
export interface AdminPlayerDetail {
  id: string; email: string; isAdmin: boolean; createdAt: string; lastActiveAt: string; googleId: string | null;
  empire: {
    id: string; name: string; goldBalance: number;
    keeps: (Keep & { plot: (Plot & { district: { name: string } | null }) | null })[];
    caravans: CaravanWithCargo[];
    warehouses: Warehouse[];
  } | null;
}
