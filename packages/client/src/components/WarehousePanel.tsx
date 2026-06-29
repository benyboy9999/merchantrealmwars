import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';
import type { CaravanWithCargo, Warehouse, WarehouseItem, Keep, EmpireBootstrap } from '../services/api.js';
import { RESOURCE_NAMES, RESOURCE_WEIGHT, REGION_IDS } from '@merchant-realms/shared';
import { useLivePercent } from '../hooks/useLivePercent.js';
import ProgressBar from './ProgressBar.js';

const rName  = (rt: string) => RESOURCE_NAMES[rt as keyof typeof RESOURCE_NAMES] ?? rt;
const rKgPer = (rt: string) => RESOURCE_WEIGHT[rt as keyof typeof RESOURCE_WEIGHT] ?? 0.5;
const MULE_KG = 100;

const EXCHANGE_REGIONS = [
  { id: REGION_IDS.CENTRAL, name: 'Central'   },
  { id: REGION_IDS.NE,      name: 'Northeast' },
  { id: REGION_IDS.NW,      name: 'Northwest' },
  { id: REGION_IDS.SW,      name: 'Southwest' },
  { id: REGION_IDS.SE,      name: 'Southeast' },
] as const;

interface InventoryItem { resourceType: string; quantity: number }

interface WarehousePanelProps {
  locationType:  'KEEP' | 'EXCHANGE';
  locationId:    number;
  warehouseId:   number;
  locationLabel: string;
  inventory:     InventoryItem[];
  goldBalance?:  number;
  showSell?:     boolean;
  onSell?:       (rt: string, qty: number) => void;
  onInventoryChange?: () => void;
  className?:    string;
}

// ── Destination picker ────────────────────────────────────────────────────────

type DestOption = { type: 'EXCHANGE' | 'KEEP' | 'PLOT'; id: number; label: string; group: string };

function DestinationPicker({
  value, onChange, allKeeps, plotsByRegion, excludeKeepId, excludeExchangeId,
}: {
  value: { type: string; id: number } | null;
  onChange: (dest: { type: string; id: number } | null) => void;
  allKeeps: Array<{ id: number; name: string }>;
  plotsByRegion: Map<number, Array<{ id: number; name: string; hasKeep: boolean }>>;
  excludeKeepId?: number | undefined;
  excludeExchangeId?: number | undefined;
}) {
  const [search, setSearch] = useState('');
  const [open,   setOpen]   = useState(false);

  const q = search.toLowerCase();

  const exchanges: DestOption[] = EXCHANGE_REGIONS
    .filter((r) => r.id !== excludeExchangeId)
    .filter((r) => !q || r.name.toLowerCase().includes(q) || 'exchange'.includes(q))
    .map((r) => ({ type: 'EXCHANGE', id: r.id, label: `${r.name} Exchange`, group: 'Exchanges' }));

  const keeps: DestOption[] = allKeeps
    .filter((k) => k.id !== excludeKeepId)
    .filter((k) => !q || k.name.toLowerCase().includes(q))
    .map((k) => ({ type: 'KEEP', id: k.id, label: k.name, group: 'Keeps' }));

  const plots: DestOption[] = q
    ? Array.from(plotsByRegion.entries())
        .flatMap(([, ps]) =>
          ps.filter((p) => p.name.toLowerCase().includes(q))
            .map((p) => ({ type: 'PLOT' as const, id: p.id, label: p.name, group: 'Plots' }))
        )
        .slice(0, 20)
    : [];

  const allOptions = [...exchanges, ...keeps, ...plots];

  const selectedLabel = value
    ? (allOptions.find((o) => o.type === value.type && o.id === value.id)?.label
        ?? EXCHANGE_REGIONS.find((r) => r.id === value.id)?.name)
    : null;

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          className="w-full bg-slate-900 border border-slate-700 rounded px-2 pr-6 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-slate-500 placeholder-slate-600"
          placeholder={!selectedLabel || open ? 'Search exchanges, keeps, plots…' : ''}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); if (!e.target.value) onChange(null); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {selectedLabel && !open && !search && (
          <div className="absolute inset-0 pointer-events-none flex items-center px-2 pr-6">
            <span className="text-xs text-slate-200 truncate">{selectedLabel}</span>
          </div>
        )}
        {selectedLabel && (
          <button
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 text-xs"
            onMouseDown={(e) => { e.preventDefault(); onChange(null); setSearch(''); }}
          >✕</button>
        )}
      </div>

      {open && allOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-0.5 bg-slate-900 border border-slate-700 rounded shadow-xl max-h-52 overflow-y-auto">
          {(['Exchanges', 'Keeps', 'Plots'] as const).map((group) => {
            const opts = allOptions.filter((o) => o.group === group);
            if (opts.length === 0) return null;
            return (
              <div key={group}>
                <div className="px-2 py-0.5 text-xs text-slate-600 uppercase tracking-wider bg-slate-900 sticky top-0">
                  {group}
                </div>
                {opts.map((opt) => (
                  <button
                    key={`${opt.type}-${opt.id}`}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                    onMouseDown={() => { onChange({ type: opt.type, id: opt.id }); setSearch(''); setOpen(false); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Transfer amount popup ─────────────────────────────────────────────────────

function TransferPopup({ label, maxQty, onConfirm, onClose, isPending = false }: {
  label: string; maxQty: number;
  onConfirm: (qty: number) => void; onClose: () => void;
  isPending?: boolean;
}) {
  const [qty, setQty] = useState(String(Math.floor(maxQty)));
  const n = Number(qty);
  const valid = n > 0 && n <= maxQty;
  return (
    <div className="mx-3 mb-2 mt-0.5 border border-slate-600 rounded bg-slate-900 px-3 py-2.5 text-xs">
      <div className="text-slate-500 mb-2">{label}</div>
      <div className="flex items-center gap-2">
        <input
          autoFocus type="number" min={1} max={Math.floor(maxQty)}
          className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 text-right focus:outline-none focus:border-slate-500"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && valid && !isPending) onConfirm(n); if (e.key === 'Escape') onClose(); }}
        />
        <span className="text-slate-600">/ {Math.floor(maxQty)}</span>
        <button
          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-100 px-3 py-1 rounded"
          disabled={!valid || isPending} onClick={() => onConfirm(n)}
        >{isPending ? '…' : 'Transfer'}</button>
        <button className="text-slate-600 hover:text-slate-400 px-1" disabled={isPending} onClick={onClose}>✕</button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WarehousePanel({
  locationType, locationId, warehouseId, locationLabel,
  inventory, goldBalance, showSell, onSell,
  onInventoryChange, className = '',
}: WarehousePanelProps) {
  const qc = useQueryClient();

  const [loadPopup,         setLoadPopup]         = useState<{ rt: string; caravanId: number } | null>(null);
  const [unloadPopup,       setUnloadPopup]        = useState<{ caravanId: number; rt: string } | null>(null);
  const [sellPopup,         setSellPopup]          = useState<string | null>(null);
  const [selectedCaravanId, setSelectedCaravanId]  = useState<number | null>(null);
  const [expandedCaravanId, setExpandedCaravanId]  = useState<number | null>(null);

  // Single destination per caravan (replaces the old 3-field destType/destId/plotRegion)
  const [dest, setDest] = useState<Record<number, { type: string; id: number } | null>>({});

  const { data: empireData, isError: caravansError, error: caravansErr } = useQuery({ queryKey: ['empire'], queryFn: api.empireBootstrap });
  const { data: allDistrictsData } = useQuery({ queryKey: ['all-districts'], queryFn: api.allDistricts, staleTime: 60_000 });

  const plotsByRegion = useMemo(() => {
    const map = new Map<number, Array<{ id: number; name: string; hasKeep: boolean }>>();
    for (const d of allDistrictsData?.districts ?? []) {
      if (!map.has(d.regionId)) map.set(d.regionId, []);
      for (const p of d.plots) {
        map.get(d.regionId)!.push({ id: p.id, name: p.name, hasKeep: (p.keeps?.length ?? 0) > 0 });
      }
    }
    return map;
  }, [allDistrictsData]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['empire'] });
    qc.invalidateQueries({ queryKey: ['keep', locationId] });
    qc.invalidateQueries({ queryKey: ['exchange-storage', locationId] });
    onInventoryChange?.();
  };

  // Stable reference so AwayCaravan's arrival timer isn't reset on every render
  const useCaravanArrived = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['empire'] });
  }, [qc]);

  // Immediately reflect a resource transfer in/out of the current location's inventory cache.
  function patchInventory(rt: string, delta: number) {
    const patchItems = (items: WarehouseItem[], wid: number): WarehouseItem[] => {
      const exists = items.some((e) => e.resourceType === rt);
      if (exists) return items.map((e) => e.resourceType === rt ? { ...e, quantity: Math.max(0, e.quantity + delta) } : e);
      return [...items, { id: 0, warehouseId: wid, resourceType: rt, quantity: Math.max(0, delta), updatedAt: new Date().toISOString() }];
    };

    if (locationType === 'KEEP') {
      qc.setQueryData(
        ['keep', locationId],
        (old: { keep: Keep } | undefined) => {
          if (!old || !old.keep.warehouse) return old;
          return { ...old, keep: { ...old.keep, warehouse: { ...old.keep.warehouse, items: patchItems(old.keep.warehouse.items, old.keep.warehouse.id) } } };
        },
      );
    } else {
      qc.setQueryData(
        ['exchange-storage', locationId],
        (old: { warehouse: Warehouse | null } | undefined) => {
          if (!old || !old.warehouse) return old;
          return { ...old, warehouse: { ...old.warehouse, items: patchItems(old.warehouse.items, old.warehouse.id) } };
        },
      );
    }
  }

  type TransferParams = {
    fromWarehouseId: number;
    toWarehouseId:   number;
    resourceType:    string;
    quantity:        number;
  };

  const transfer = useMutation({
    mutationFn: (p: TransferParams) => api.transfer(p),
    onMutate: ({ fromWarehouseId, toWarehouseId, resourceType, quantity }) => {
      if (fromWarehouseId === warehouseId) patchInventory(resourceType, -quantity);
      if (toWarehouseId   === warehouseId) patchInventory(resourceType, +quantity);
      setLoadPopup(null);
      setUnloadPopup(null);

      const empireCache  = qc.getQueryData<{ empire: EmpireBootstrap }>(['empire']);
      const fromCaravan  = empireCache?.empire.caravans.find((c) => c.warehouseId === fromWarehouseId);
      const toCaravan    = empireCache?.empire.caravans.find((c) => c.warehouseId === toWarehouseId);
      const caravan      = fromCaravan ?? toCaravan;
      if (caravan) {
        const delta = fromCaravan ? -quantity : +quantity;
        qc.setQueryData(['empire'], (old: { empire: EmpireBootstrap } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            empire: {
              ...old.empire,
              caravans: old.empire.caravans.map((c) => {
                if (c.id !== caravan.id) return c;
                const items = c.warehouse?.items ?? [];
                const existing = items.find((x) => x.resourceType === resourceType);
                const newQty   = (existing?.quantity ?? 0) + delta;
                const newItems = newQty <= 0
                  ? items.filter((x) => x.resourceType !== resourceType)
                  : existing
                    ? items.map((x) => x.resourceType === resourceType ? { ...x, quantity: newQty } : x)
                    : [...items, { id: 0, warehouseId: c.warehouseId ?? 0, resourceType, quantity: newQty, updatedAt: new Date().toISOString() }];
                return { ...c, warehouse: c.warehouse ? { ...c.warehouse, items: newItems } : null };
              }),
            },
          };
        });
      }
    },
    onSuccess: () => invalidate(),
    onError:   () => invalidate(),
  });
  const caravanDispatch = useMutation({
    mutationFn: ({ id, dt, di }: { id: number; dt: string; di: number }) => api.caravanDispatch(id, dt, di),
    onSuccess: (data, vars) => {
      qc.setQueryData(['empire'], (old: { empire: EmpireBootstrap } | undefined) => {
        if (!old) return old;
        return { ...old, empire: { ...old.empire, caravans: old.empire.caravans.map((c) => c.id === data.caravan.id ? data.caravan : c) } };
      });
      setExpandedCaravanId(null);
      setDest((p) => { const n = { ...p }; delete n[vars.id]; return n; });
      invalidate();
    },
  });

  const allCaravans          = empireData?.empire.caravans ?? [];
  const hereCaravans         = allCaravans.filter(
    (c) => c.status === 'IDLE' && c.locationType === locationType && c.locationId === locationId,
  );
  const idleElsewhereCaravans = allCaravans.filter(
    (c) => c.status === 'IDLE' && !(c.locationType === locationType && c.locationId === locationId),
  );
  const inTransitCaravans    = allCaravans.filter((c) => c.status === 'IN_TRANSIT');

  function caravanLocationName(c: { locationType: string; locationId: number }): string {
    if (c.locationType === 'EXCHANGE') {
      const r = EXCHANGE_REGIONS.find((r) => r.id === c.locationId);
      return r ? `${r.name} Exchange` : `Region ${c.locationId}`;
    }
    if (c.locationType === 'KEEP') {
      return allKeeps.find((k) => k.id === c.locationId)?.name ?? 'Keep';
    }
    return 'Plot';
  }

  const allKeeps    = empireData?.empire.keeps ?? [];
  const totalWeight = inventory.reduce((s, e) => s + e.quantity * rKgPer(e.resourceType), 0);

  function maxLoadable(rt: string, caravanId: number): number {
    const caravan = hereCaravans.find((c) => c.id === caravanId);
    if (!caravan) return 0;
    const items      = caravan.warehouse?.items ?? [];
    const maxKg      = caravan.warehouse?.cap ?? caravan.animalCount * MULE_KG;
    const usedKg     = items.reduce((s, x) => s + x.quantity * rKgPer(x.resourceType), 0);
    const freeKg     = maxKg - usedKg;
    const byCapacity = Math.floor(freeKg / rKgPer(rt));
    const inWarehouse = inventory.find((e) => e.resourceType === rt)?.quantity ?? 0;
    return Math.min(inWarehouse, byCapacity);
  }

  function openLoadPopup(rt: string) {
    const targetId = selectedCaravanId ?? hereCaravans[0]?.id;
    if (!targetId) return;
    setUnloadPopup(null); setSellPopup(null);
    setLoadPopup({ rt, caravanId: targetId });
  }

  function openUnloadPopup(caravanId: number, rt: string) {
    setLoadPopup(null); setSellPopup(null);
    setUnloadPopup({ caravanId, rt });
  }

  function toggleExpand(caravanId: number) {
    setExpandedCaravanId((prev) => prev === caravanId ? null : caravanId);
    setLoadPopup(null); setUnloadPopup(null);
  }

  return (
    <div className={`grid grid-cols-2 divide-x divide-slate-700/60 overflow-hidden ${className}`}>

      {/* ── Left: inventory ──────────────────────────────────────────────── */}
      <div className="flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/60 flex-shrink-0">
          <span className="text-xs uppercase tracking-wider text-slate-500">{locationLabel}</span>
          <span className="text-xs text-slate-600">{totalWeight.toFixed(1)} kg</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {inventory.length === 0 ? (
            <div className="p-4 text-slate-600 text-sm">Nothing here yet.</div>
          ) : (
            <div>
              {inventory.filter((e) => e.quantity > 0).sort((a, b) => b.quantity - a.quantity).map((e) => {
                const isLoadOpen = loadPopup?.rt === e.resourceType;
                const isSellOpen = sellPopup === e.resourceType;
                const activeCaravanId = loadPopup?.caravanId ?? selectedCaravanId ?? hereCaravans[0]?.id ?? 0;
                const canLoad = hereCaravans.length > 0 && maxLoadable(e.resourceType, activeCaravanId) > 0;

                return (
                  <div key={e.resourceType} className="border-b border-slate-800/40">
                    <div className="flex items-center px-4 py-2 hover:bg-slate-800/30 gap-2">
                      <span className="flex-1 text-sm text-slate-300">{rName(e.resourceType)}</span>
                      <span className="text-slate-200 font-mono tabular-nums text-sm w-12 text-right">{e.quantity.toFixed(0)}</span>
                      {showSell && (
                        <button
                          className={`text-xs px-1.5 py-0.5 border rounded transition-colors ${isSellOpen ? 'border-gold-600 text-gold-400' : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'}`}
                          onClick={() => { setLoadPopup(null); setSellPopup(sellPopup === e.resourceType ? null : e.resourceType); }}
                        >Sell</button>
                      )}
                      {hereCaravans.length > 0 && (
                        <button
                          className={`w-6 h-6 flex items-center justify-center border rounded text-sm transition-colors ${isLoadOpen ? 'border-slate-200 text-slate-200' : 'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200'}`}
                          title="Load into caravan"
                          onClick={() => isLoadOpen ? setLoadPopup(null) : openLoadPopup(e.resourceType)}
                          disabled={!canLoad}
                        >›</button>
                      )}
                    </div>

                    {isLoadOpen && (
                      <div className="mx-3 mb-2 mt-0.5 border border-slate-600 rounded bg-slate-900 px-3 py-2.5 text-xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-slate-500">Load into</span>
                          {hereCaravans.length > 1 ? (
                            <select
                              className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-slate-100 text-xs focus:outline-none"
                              value={loadPopup.caravanId}
                              onChange={(ev) => {
                                const cId = parseInt(ev.target.value);
                                setLoadPopup({ rt: e.resourceType, caravanId: cId });
                                setSelectedCaravanId(cId);
                              }}
                            >
                              {hereCaravans.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          ) : (
                            <span className="text-slate-200">{hereCaravans[0]?.name}</span>
                          )}
                        </div>
                        <TransferPopup
                          label={`Transfer to caravan (max ${Math.floor(maxLoadable(e.resourceType, loadPopup.caravanId))})`}
                          maxQty={maxLoadable(e.resourceType, loadPopup.caravanId)}
                          onConfirm={(qty) => {
                            const targetCaravan = hereCaravans.find((c) => c.id === loadPopup.caravanId);
                            if (!targetCaravan?.warehouseId) return;
                            transfer.mutate({ fromWarehouseId: warehouseId, toWarehouseId: targetCaravan.warehouseId, resourceType: e.resourceType, quantity: qty });
                          }}
                          onClose={() => setLoadPopup(null)}
                          isPending={transfer.isPending}
                        />
                        {transfer.isError && loadPopup?.rt === e.resourceType && (
                          <p className="text-red-400 text-xs mt-1">{(transfer.error as Error).message}</p>
                        )}
                      </div>
                    )}

                    {isSellOpen && onSell && (
                      <div className="mx-3 mb-2 mt-0.5 border border-slate-600 rounded bg-slate-900 px-3 py-2.5 text-xs">
                        <TransferPopup
                          label={`Sell ${rName(e.resourceType)} to NPC (1g/unit)`}
                          maxQty={e.quantity}
                          onConfirm={(qty) => { onSell(e.resourceType, qty); setSellPopup(null); }}
                          onClose={() => setSellPopup(null)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {goldBalance !== undefined && (
          <div className="flex justify-between items-center px-4 py-2 border-t border-slate-700/60 flex-shrink-0">
            <span className="text-xs text-slate-600">Gold</span>
            <span className="text-gold-400 font-mono text-sm">{goldBalance.toFixed(0)}g</span>
          </div>
        )}
      </div>

      {/* ── Right: caravans ──────────────────────────────────────────────── */}
      <div className="flex flex-col overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-700/60 flex-shrink-0">
          <span className="text-xs uppercase tracking-wider text-slate-500">Caravans</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {caravansError && (
            <div className="p-4 text-red-400 text-xs">
              Failed to load caravans: {caravansErr instanceof Error ? caravansErr.message : 'Unknown error'}
            </div>
          )}
          {!caravansError && allCaravans.length === 0 && (
            <div className="p-4 text-slate-600 text-sm">No caravans.</div>
          )}

          {/* Here caravans — idle at this location */}
          {hereCaravans.map((c) => {
            const items      = c.warehouse?.items ?? [];
            const cargoKg    = items.reduce((s, x) => s + x.quantity * rKgPer(x.resourceType), 0);
            const maxKg      = c.warehouse?.cap ?? c.animalCount * MULE_KG;
            const isExpanded = expandedCaravanId === c.id;
            const d          = dest[c.id] ?? null;

            return (
              <div key={c.id} className="border-b border-slate-800/60">
                {/* Clickable caravan header */}
                <button
                  className="w-full px-4 pt-3 pb-2 text-left hover:bg-slate-800/30 transition-colors"
                  onClick={() => toggleExpand(c.id)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-200">{c.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">{c.animalCount} mule{c.animalCount !== 1 ? 's' : ''}</span>
                      <span className={`text-slate-600 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>{items.length === 0 ? 'Empty' : `${items.length} item${items.length !== 1 ? 's' : ''}`}</span>
                    <span>{cargoKg.toFixed(0)} / {maxKg} kg</span>
                  </div>
                  <div className="h-0.5 bg-slate-700 rounded">
                    <div className="h-0.5 rounded bg-slate-500" style={{ width: `${Math.min(100, cargoKg / maxKg * 100)}%` }} />
                  </div>
                </button>

                {/* Expanded panel: cargo detail + dispatch */}
                {isExpanded && (
                  <div className="border-t border-slate-800/40">
                    {/* Cargo items */}
                    {items.length > 0 && (
                      <div className="px-4 py-2 space-y-0.5">
                        {items.map((cargo) => {
                          const isUnloadOpen = unloadPopup?.caravanId === c.id && unloadPopup.rt === cargo.resourceType;
                          return (
                            <div key={cargo.resourceType}>
                              <div className="flex items-center gap-2 py-1">
                                <button
                                  className={`w-5 h-5 flex items-center justify-center border rounded text-xs transition-colors flex-shrink-0 ${isUnloadOpen ? 'border-slate-200 text-slate-200' : 'border-slate-600 text-slate-500 hover:border-slate-400 hover:text-slate-200'}`}
                                  title="Unload to warehouse"
                                  onClick={() => isUnloadOpen ? setUnloadPopup(null) : openUnloadPopup(c.id, cargo.resourceType)}
                                >‹</button>
                                <span className="flex-1 text-xs text-slate-400">{rName(cargo.resourceType)}</span>
                                <span className="text-slate-200 font-mono text-xs w-10 text-right">{cargo.quantity.toFixed(0)}</span>
                              </div>
                              {isUnloadOpen && (
                                <div className="mb-1 border border-slate-600 rounded bg-slate-900 px-3 py-2">
                                  <TransferPopup
                                    label={`Unload to ${locationLabel}`}
                                    maxQty={cargo.quantity}
                                    onConfirm={(qty) => {
                                      if (!c.warehouseId) return;
                                      transfer.mutate({ fromWarehouseId: c.warehouseId, toWarehouseId: warehouseId, resourceType: cargo.resourceType, quantity: qty });
                                    }}
                                    onClose={() => setUnloadPopup(null)}
                                    isPending={transfer.isPending}
                                  />
                                  {transfer.isError && unloadPopup?.caravanId === c.id && unloadPopup.rt === cargo.resourceType && (
                                    <p className="text-red-400 text-xs mt-1">{(transfer.error as Error).message}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Dispatch section */}
                    <div className="px-4 pb-3 pt-2 border-t border-slate-800/40 space-y-2">
                      <div className="text-xs text-slate-600 uppercase tracking-wider">Send to</div>

                      <DestinationPicker
                        value={d}
                        onChange={(v) => setDest((p) => ({ ...p, [c.id]: v }))}
                        allKeeps={allKeeps}
                        plotsByRegion={plotsByRegion}
                        excludeKeepId={locationType === 'KEEP' ? locationId : undefined}
                        excludeExchangeId={locationType === 'EXCHANGE' ? locationId : undefined}
                      />

                      <button
                        className="w-full text-xs py-1.5 border border-slate-600 rounded text-slate-400 hover:text-slate-100 hover:border-slate-500 hover:bg-slate-800/40 disabled:opacity-40 transition-colors"
                        disabled={!d || caravanDispatch.isPending}
                        onClick={() => d && caravanDispatch.mutate({ id: c.id, dt: d.type, di: d.id })}
                      >
                        Dispatch →
                      </button>
                      {caravanDispatch.isError && (
                        <p className="text-red-400 text-xs">{(caravanDispatch.error as Error).message}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Idle elsewhere — can dispatch, cannot load/unload */}
          {idleElsewhereCaravans.length > 0 && (
            <div className={hereCaravans.length > 0 ? 'border-t border-slate-800' : ''}>
              <div className="px-4 py-1.5">
                <span className="text-xs text-slate-700 uppercase tracking-wider">Idle</span>
              </div>
              {idleElsewhereCaravans.map((c) => {
                const elseItems  = c.warehouse?.items ?? [];
                const cargoKg    = elseItems.reduce((s, x) => s + x.quantity * rKgPer(x.resourceType), 0);
                const maxKg      = c.warehouse?.cap ?? c.animalCount * MULE_KG;
                const isExpanded = expandedCaravanId === c.id;
                const d          = dest[c.id] ?? null;
                const atLabel    = caravanLocationName(c);

                return (
                  <div key={c.id} className="border-b border-slate-800/60">
                    <button
                      className="w-full px-4 pt-3 pb-2 text-left hover:bg-slate-800/30 transition-colors"
                      onClick={() => toggleExpand(c.id)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-400">{c.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600">at {atLabel}</span>
                          <span className={`text-slate-600 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600 mb-1">
                        <span>{elseItems.length === 0 ? 'Empty' : `${elseItems.length} item${elseItems.length !== 1 ? 's' : ''}`}</span>
                        <span>{cargoKg.toFixed(0)} / {maxKg} kg</span>
                      </div>
                      <div className="h-0.5 bg-slate-700 rounded">
                        <div className="h-0.5 rounded bg-slate-800" style={{ width: `${Math.min(100, cargoKg / maxKg * 100)}%` }} />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-800/40">
                        {elseItems.length > 0 && (
                          <div className="px-4 py-2 space-y-0.5">
                            {elseItems.map((cargo) => (
                              <div key={cargo.resourceType} className="flex items-center gap-2 py-1">
                                <span className="flex-1 text-xs text-slate-400">{rName(cargo.resourceType)}</span>
                                <span className="text-slate-200 font-mono text-xs w-10 text-right">{cargo.quantity.toFixed(0)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="px-4 pb-3 pt-2 border-t border-slate-800/40 space-y-2">
                          <div className="text-xs text-slate-600 uppercase tracking-wider">Send to</div>
                          <DestinationPicker
                            value={d}
                            onChange={(v) => setDest((p) => ({ ...p, [c.id]: v }))}
                            allKeeps={allKeeps}
                            plotsByRegion={plotsByRegion}
                            excludeKeepId={c.locationType === 'KEEP' ? c.locationId : undefined}
                            excludeExchangeId={c.locationType === 'EXCHANGE' ? c.locationId : undefined}
                          />
                          <button
                            className="w-full text-xs py-1.5 border border-slate-600 rounded text-slate-400 hover:text-slate-100 hover:border-slate-500 hover:bg-slate-800/40 disabled:opacity-40 transition-colors"
                            disabled={!d || caravanDispatch.isPending}
                            onClick={() => d && caravanDispatch.mutate({ id: c.id, dt: d.type, di: d.id })}
                          >
                            Dispatch →
                          </button>
                          {caravanDispatch.isError && (
                            <p className="text-red-400 text-xs">{(caravanDispatch.error as Error).message}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* In transit — read-only progress */}
          {inTransitCaravans.length > 0 && (
            <div className={(hereCaravans.length > 0 || idleElsewhereCaravans.length > 0) ? 'border-t border-slate-800' : ''}>
              <div className="px-4 py-1.5">
                <span className="text-xs text-slate-700 uppercase tracking-wider">In Transit</span>
              </div>
              {inTransitCaravans.map((c) => (
                <AwayCaravan
                  key={c.id}
                  caravan={c}
                  onArrived={useCaravanArrived}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AwayCaravan({ caravan: c, onArrived }: {
  caravan: {
    id: number; name: string; status: string;
    locationType: string; locationId: number;
    destType: string | null; destId: number | null;
    arrivesAt: string | null; departedAt: string | null;
  };
  onArrived: () => void;
}) {
  const pct = useLivePercent(c.departedAt, c.arrivesAt);
  const inTransit = c.status === 'IN_TRANSIT';

  // Trigger a refetch at the exact arrival time so the caravan appears without waiting for the poll interval
  useEffect(() => {
    if (!c.arrivesAt) return;
    const delay = new Date(c.arrivesAt).getTime() - Date.now();
    if (delay <= 0) { onArrived(); return; }
    const id = setTimeout(onArrived, delay);
    return () => clearTimeout(id);
  }, [c.arrivesAt, onArrived]);

  const remaining = c.arrivesAt
    ? Math.max(0, Math.ceil((new Date(c.arrivesAt).getTime() - Date.now()) / 1000))
    : null;

  const remainingLabel = remaining != null
    ? remaining >= 60 ? `${Math.floor(remaining / 60)}m ${remaining % 60}s` : `${remaining}s`
    : null;

  const locationLabel = inTransit
    ? `→ ${destTypeLabel(c.destType)} ${remainingLabel ? `· ${remainingLabel}` : ''}`
    : `at ${destTypeLabel(c.locationType)}`;

  return (
    <div className="px-4 py-2.5 border-b border-slate-800/40">
      <div className="flex items-center justify-between mb-1.5 text-xs">
        <span className="text-slate-500">{c.name}</span>
        <span className="text-slate-600">{locationLabel}</span>
      </div>
      {inTransit && <ProgressBar pct={pct} color="bg-slate-600" height="h-0.5" />}
    </div>
  );
}

function destTypeLabel(type: string | null): string {
  switch (type) {
    case 'KEEP':     return 'keep';
    case 'EXCHANGE': return 'exchange';
    case 'PLOT':     return 'plot';
    default:         return type?.toLowerCase() ?? '?';
  }
}
