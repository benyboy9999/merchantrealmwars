import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';
import type { CaravanWithCargo, Warehouse, WarehouseItem, Keep, EmpireBootstrap } from '../services/api.js';
import { RESOURCE_NAMES, RESOURCE_WEIGHT, REGION_IDS } from '@merchant-realms/shared';
import { useLivePercent } from '../hooks/useLivePercent.js';
import ProgressBar from './ProgressBar.js';
import { IconSlot, Modal, ModalSection, Button } from './ui/index.js';

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

// ── Caravan action modal ──────────────────────────────────────────────────────

function CaravanActionModal({
  caravan, isHere, allKeeps, plotsByRegion, excludeKeepId, excludeExchangeId,
  onDispatch, isDispatching, dispatchError, onClose,
}: {
  caravan: CaravanWithCargo;
  isHere: boolean;
  allKeeps: Array<{ id: number; name: string }>;
  plotsByRegion: Map<number, Array<{ id: number; name: string; hasKeep: boolean }>>;
  excludeKeepId?: number | undefined;
  excludeExchangeId?: number | undefined;
  onDispatch: (dest: { type: string; id: number }) => void;
  isDispatching: boolean;
  dispatchError: string | null;
  onClose: () => void;
}) {
  const [dest, setDest] = useState<{ type: string; id: number } | null>(null);
  const items   = caravan.warehouse?.items ?? [];
  const cargoKg = items.reduce((s, x) => s + x.quantity * rKgPer(x.resourceType), 0);
  const maxKg   = caravan.warehouse?.cap ?? caravan.animalCount * MULE_KG;

  return (
    <Modal
      open
      onClose={onClose}
      title={caravan.name}
      subtitle={`${caravan.animalCount} mule${caravan.animalCount !== 1 ? 's' : ''} · ${cargoKg.toFixed(0)} / ${maxKg} kg`}
      size="sm"
    >
      {/* Cargo summary */}
      {items.length > 0 && (
        <ModalSection label="Cargo">
          <div className="space-y-1.5">
            {items.map((it) => (
              <div key={it.resourceType} className="flex items-center gap-2">
                <IconSlot size="xs" label={rName(it.resourceType)} />
                <span className="flex-1 text-sm text-slate-300">{rName(it.resourceType)}</span>
                <span className="font-mono text-sm text-slate-200 tabular-nums">{it.quantity.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </ModalSection>
      )}

      {/* Dispatch */}
      <ModalSection label="Send to">
        <div className="space-y-2">
          <DestinationPicker
            value={dest}
            onChange={setDest}
            allKeeps={allKeeps}
            plotsByRegion={plotsByRegion}
            excludeKeepId={isHere ? excludeKeepId : undefined}
            excludeExchangeId={isHere ? excludeExchangeId : undefined}
          />
          {dispatchError && (
            <p className="text-red-400 text-xs">{dispatchError}</p>
          )}
          <Button
            variant="primary"
            size="md"
            className="w-full"
            disabled={!dest || isDispatching}
            onClick={() => dest && onDispatch(dest)}
          >
            {isDispatching ? 'Dispatching…' : 'Dispatch'}
          </Button>
        </div>
      </ModalSection>

      {/* Future: upgrades */}
      <ModalSection label="Caravan">
        <p className="text-slate-600 text-xs italic">Upgrade &amp; modification options coming soon.</p>
      </ModalSection>
    </Modal>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WarehousePanel({
  locationType, locationId, warehouseId, locationLabel,
  inventory, goldBalance, showSell, onSell,
  onInventoryChange, className = '',
}: WarehousePanelProps) {
  const qc = useQueryClient();

  const [loadPopup,    setLoadPopup]    = useState<{ rt: string; caravanId: number } | null>(null);
  const [unloadPopup,  setUnloadPopup]  = useState<{ caravanId: number; rt: string } | null>(null);
  const [sellPopup,    setSellPopup]    = useState<string | null>(null);
  // activeCaId: which caravan is showing in the cargo view (right panel)
  const [activeCaId,   setActiveCaId]   = useState<number | null>(null);
  // actionCaId: which caravan's action modal is open
  const [actionCaId,   setActionCaId]   = useState<number | null>(null);

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

  const useCaravanArrived = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['empire'] });
  }, [qc]);

  function patchInventory(rt: string, delta: number) {
    const patchItems = (items: WarehouseItem[], wid: number): WarehouseItem[] => {
      const exists = items.some((e) => e.resourceType === rt);
      if (exists) return items.map((e) => e.resourceType === rt ? { ...e, quantity: Math.max(0, e.quantity + delta) } : e);
      return [...items, { id: 0, warehouseId: wid, resourceType: rt, quantity: Math.max(0, delta), updatedAt: new Date().toISOString() }];
    };

    if (locationType === 'KEEP') {
      qc.setQueryData(['keep', locationId], (old: { keep: Keep } | undefined) => {
        if (!old || !old.keep.warehouse) return old;
        return { ...old, keep: { ...old.keep, warehouse: { ...old.keep.warehouse, items: patchItems(old.keep.warehouse.items, old.keep.warehouse.id) } } };
      });
    } else {
      qc.setQueryData(['exchange-storage', locationId], (old: { warehouse: Warehouse | null } | undefined) => {
        if (!old || !old.warehouse) return old;
        return { ...old, warehouse: { ...old.warehouse, items: patchItems(old.warehouse.items, old.warehouse.id) } };
      });
    }
  }

  type TransferParams = { fromWarehouseId: number; toWarehouseId: number; resourceType: string; quantity: number };

  const transfer = useMutation({
    mutationFn: (p: TransferParams) => api.transfer(p),
    onMutate: ({ fromWarehouseId, toWarehouseId, resourceType, quantity }) => {
      if (fromWarehouseId === warehouseId) patchInventory(resourceType, -quantity);
      if (toWarehouseId   === warehouseId) patchInventory(resourceType, +quantity);
      setLoadPopup(null);
      setUnloadPopup(null);

      const empireCache = qc.getQueryData<{ empire: EmpireBootstrap }>(['empire']);
      const fromCaravan = empireCache?.empire.caravans.find((c) => c.warehouseId === fromWarehouseId);
      const toCaravan   = empireCache?.empire.caravans.find((c) => c.warehouseId === toWarehouseId);
      const caravan     = fromCaravan ?? toCaravan;
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
      setActionCaId(null);
      if (activeCaId === vars.id) setActiveCaId(null);
      invalidate();
    },
  });

  const allCaravans           = empireData?.empire.caravans ?? [];
  const hereCaravans          = allCaravans.filter((c) => c.status === 'IDLE' && c.locationType === locationType && c.locationId === locationId);
  const idleElsewhereCaravans = allCaravans.filter((c) => c.status === 'IDLE' && !(c.locationType === locationType && c.locationId === locationId));
  const inTransitCaravans     = allCaravans.filter((c) => c.status === 'IN_TRANSIT');
  const allKeeps              = empireData?.empire.keeps ?? [];
  const totalWeight           = inventory.reduce((s, e) => s + e.quantity * rKgPer(e.resourceType), 0);

  const activeCaravan   = activeCaId != null ? allCaravans.find((c) => c.id === activeCaId) ?? null : null;
  const actionCaravan   = actionCaId != null ? allCaravans.find((c) => c.id === actionCaId) ?? null : null;
  const activeIsHere    = activeCaravan != null && hereCaravans.some((c) => c.id === activeCaravan.id);

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

  // Which caravan to target when loading from warehouse
  const loadTargetId = loadPopup?.caravanId ?? activeCaId ?? hereCaravans[0]?.id ?? null;

  return (
    <div className={`grid grid-cols-2 divide-x divide-slate-700/60 overflow-hidden ${className}`}>

      {/* ── Left: warehouse inventory ────────────────────────────────────── */}
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
                const loadCaId   = loadPopup?.caravanId ?? (activeCaId && activeIsHere ? activeCaId : null) ?? hereCaravans[0]?.id ?? 0;
                const canLoad    = hereCaravans.length > 0 && maxLoadable(e.resourceType, loadCaId) > 0;

                return (
                  <div key={e.resourceType} className="border-b border-slate-800/40">
                    <div className="flex items-center px-4 py-2 hover:bg-slate-800/30 gap-2">
                      <IconSlot size="xs" label={rName(e.resourceType)} />
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
                          className={`w-6 h-6 flex items-center justify-center border rounded text-sm transition-colors ${isLoadOpen ? 'border-slate-200 text-slate-200' : 'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200'} disabled:opacity-30`}
                          title={`Load into ${activeIsHere && activeCaravan ? activeCaravan.name : 'caravan'}`}
                          onClick={() => isLoadOpen ? setLoadPopup(null) : setLoadPopup({ rt: e.resourceType, caravanId: loadCaId })}
                          disabled={!canLoad}
                        >›</button>
                      )}
                    </div>

                    {isLoadOpen && loadPopup && (
                      <div className="mx-3 mb-2 mt-0.5">
                        {hereCaravans.length > 1 && (
                          <div className="flex items-center gap-2 mb-1.5 px-1">
                            <span className="text-xs text-slate-500">Load into</span>
                            <select
                              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-slate-100 text-xs focus:outline-none"
                              value={loadPopup.caravanId}
                              onChange={(ev) => setLoadPopup({ rt: e.resourceType, caravanId: parseInt(ev.target.value) })}
                            >
                              {hereCaravans.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>
                        )}
                        <TransferPopup
                          label={`Transfer to ${hereCaravans.find(c => c.id === loadPopup.caravanId)?.name ?? 'caravan'} (max ${Math.floor(maxLoadable(e.resourceType, loadPopup.caravanId))})`}
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
                          <p className="text-red-400 text-xs mt-1 px-3">{(transfer.error as Error).message}</p>
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

        {activeCaravan ? (
          /* ── Cargo view ─────────────────────────────────────────────────── */
          <>
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-700/60 flex-shrink-0">
              <button
                className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors flex-shrink-0"
                onClick={() => { setActiveCaId(null); setUnloadPopup(null); }}
                title="Back to caravan list"
              >←</button>
              <button
                className="flex-1 text-left text-sm font-medium text-slate-100 hover:text-azure-300 transition-colors truncate"
                onClick={() => setActionCaId(activeCaravan.id)}
                title="Open caravan actions"
              >
                {activeCaravan.name}
                <span className="ml-1.5 text-xs text-slate-500 font-normal">▸</span>
              </button>
              {activeIsHere && (
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500" title="Here" />
              )}
            </div>

            {/* Cargo fill bar */}
            {(() => {
              const items   = activeCaravan.warehouse?.items ?? [];
              const cargoKg = items.reduce((s, x) => s + x.quantity * rKgPer(x.resourceType), 0);
              const maxKg   = activeCaravan.warehouse?.cap ?? activeCaravan.animalCount * MULE_KG;
              return (
                <div className="px-4 py-2 border-b border-slate-800/60 flex-shrink-0">
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>{items.length === 0 ? 'Empty' : `${items.length} resource${items.length !== 1 ? 's' : ''}`}</span>
                    <span>{cargoKg.toFixed(0)} / {maxKg} kg</span>
                  </div>
                  <div className="h-1 bg-slate-800 rounded overflow-hidden">
                    <div
                      className="h-full rounded bg-slate-500 transition-all"
                      style={{ width: `${Math.min(100, maxKg > 0 ? cargoKg / maxKg * 100 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Cargo items */}
            <div className="flex-1 overflow-y-auto">
              {(activeCaravan.warehouse?.items ?? []).length === 0 ? (
                <div className="p-4 text-slate-600 text-sm">Caravan is empty.</div>
              ) : (
                <div>
                  {(activeCaravan.warehouse?.items ?? []).map((cargo) => {
                    const isUnloadOpen = unloadPopup?.caravanId === activeCaravan.id && unloadPopup.rt === cargo.resourceType;
                    return (
                      <div key={cargo.resourceType} className="border-b border-slate-800/40">
                        <div className="flex items-center px-4 py-2 hover:bg-slate-800/30 gap-2">
                          {activeIsHere && (
                            <button
                              className={`w-5 h-5 flex items-center justify-center border rounded text-xs transition-colors flex-shrink-0 ${isUnloadOpen ? 'border-slate-200 text-slate-200' : 'border-slate-600 text-slate-500 hover:border-slate-400 hover:text-slate-200'}`}
                              title="Unload to warehouse"
                              onClick={() => isUnloadOpen ? setUnloadPopup(null) : setUnloadPopup({ caravanId: activeCaravan.id, rt: cargo.resourceType })}
                            >‹</button>
                          )}
                          <IconSlot size="xs" label={rName(cargo.resourceType)} />
                          <span className="flex-1 text-sm text-slate-300">{rName(cargo.resourceType)}</span>
                          <span className="text-slate-200 font-mono text-sm tabular-nums w-12 text-right">{cargo.quantity.toFixed(0)}</span>
                        </div>
                        {isUnloadOpen && (
                          <div className="mx-3 mb-2 mt-0.5">
                            <TransferPopup
                              label={`Unload to ${locationLabel}`}
                              maxQty={cargo.quantity}
                              onConfirm={(qty) => {
                                if (!activeCaravan.warehouseId) return;
                                transfer.mutate({ fromWarehouseId: activeCaravan.warehouseId, toWarehouseId: warehouseId, resourceType: cargo.resourceType, quantity: qty });
                              }}
                              onClose={() => setUnloadPopup(null)}
                              isPending={transfer.isPending}
                            />
                            {transfer.isError && unloadPopup?.caravanId === activeCaravan.id && unloadPopup.rt === cargo.resourceType && (
                              <p className="text-red-400 text-xs mt-1 px-3">{(transfer.error as Error).message}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          /* ── Caravan list ────────────────────────────────────────────────── */
          <>
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

              {/* Here — idle at this location */}
              {hereCaravans.length > 0 && (
                <div>
                  <div className="px-4 py-1.5">
                    <span className="text-xs text-slate-600 uppercase tracking-wider">Here</span>
                  </div>
                  {hereCaravans.map((c) => {
                    const items   = c.warehouse?.items ?? [];
                    const cargoKg = items.reduce((s, x) => s + x.quantity * rKgPer(x.resourceType), 0);
                    const maxKg   = c.warehouse?.cap ?? c.animalCount * MULE_KG;
                    return (
                      <button
                        key={c.id}
                        className="w-full px-4 py-2.5 text-left hover:bg-slate-800/40 transition-colors border-b border-slate-800/60"
                        onClick={() => setActiveCaId(c.id)}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                          <span className="flex-1 text-sm text-slate-100">{c.name}</span>
                          <span className="text-xs text-slate-500">{cargoKg.toFixed(0)}/{maxKg} kg</span>
                        </div>
                        <div className="h-0.5 bg-slate-800 rounded overflow-hidden ml-3.5">
                          <div className="h-full rounded bg-emerald-800/60 transition-all" style={{ width: `${Math.min(100, maxKg > 0 ? cargoKg / maxKg * 100 : 0)}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Idle elsewhere */}
              {idleElsewhereCaravans.length > 0 && (
                <div className={hereCaravans.length > 0 ? 'border-t border-slate-800/60' : ''}>
                  <div className="px-4 py-1.5">
                    <span className="text-xs text-slate-600 uppercase tracking-wider">Idle</span>
                  </div>
                  {idleElsewhereCaravans.map((c) => {
                    const items   = c.warehouse?.items ?? [];
                    const cargoKg = items.reduce((s, x) => s + x.quantity * rKgPer(x.resourceType), 0);
                    const maxKg   = c.warehouse?.cap ?? c.animalCount * MULE_KG;
                    return (
                      <button
                        key={c.id}
                        className="w-full px-4 py-2.5 text-left hover:bg-slate-800/40 transition-colors border-b border-slate-800/60"
                        onClick={() => setActiveCaId(c.id)}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600 flex-shrink-0" />
                          <span className="flex-1 text-sm text-slate-400">{c.name}</span>
                          <span className="text-xs text-slate-600">{caravanLocationName(c)}</span>
                        </div>
                        <div className="h-0.5 bg-slate-800 rounded overflow-hidden ml-3.5">
                          <div className="h-full rounded bg-slate-700 transition-all" style={{ width: `${Math.min(100, maxKg > 0 ? cargoKg / maxKg * 100 : 0)}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* In transit */}
              {inTransitCaravans.length > 0 && (
                <div className={(hereCaravans.length > 0 || idleElsewhereCaravans.length > 0) ? 'border-t border-slate-800/60' : ''}>
                  <div className="px-4 py-1.5">
                    <span className="text-xs text-slate-600 uppercase tracking-wider">In Transit</span>
                  </div>
                  {inTransitCaravans.map((c) => (
                    <AwayCaravan key={c.id} caravan={c} onArrived={useCaravanArrived} onSelect={() => setActiveCaId(c.id)} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Caravan action modal ─────────────────────────────────────────── */}
      {actionCaravan && (
        <CaravanActionModal
          caravan={actionCaravan}
          isHere={hereCaravans.some((c) => c.id === actionCaravan.id)}
          allKeeps={allKeeps}
          plotsByRegion={plotsByRegion}
          excludeKeepId={locationType === 'KEEP' ? locationId : undefined}
          excludeExchangeId={locationType === 'EXCHANGE' ? locationId : undefined}
          onDispatch={(dest) => caravanDispatch.mutate({ id: actionCaravan.id, dt: dest.type, di: dest.id })}
          isDispatching={caravanDispatch.isPending}
          dispatchError={caravanDispatch.isError ? (caravanDispatch.error as Error).message : null}
          onClose={() => setActionCaId(null)}
        />
      )}
    </div>
  );
}

// ── Away caravan (in transit progress row) ────────────────────────────────────

function AwayCaravan({ caravan: c, onArrived, onSelect }: {
  caravan: {
    id: number; name: string; status: string;
    locationType: string; locationId: number;
    destType: string | null; destId: number | null;
    arrivesAt: string | null; departedAt: string | null;
  };
  onArrived: () => void;
  onSelect: () => void;
}) {
  const pct = useLivePercent(c.departedAt, c.arrivesAt);

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

  return (
    <button
      className="w-full px-4 py-2.5 text-left hover:bg-slate-800/40 transition-colors border-b border-slate-800/60"
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-azure-500 flex-shrink-0 animate-pulse" />
        <span className="flex-1 text-sm text-slate-400">{c.name}</span>
        {remainingLabel && <span className="text-xs text-slate-600">{remainingLabel}</span>}
      </div>
      <div className="ml-3.5">
        <ProgressBar pct={pct} color="bg-azure-700/50" height="h-0.5" />
      </div>
    </button>
  );
}
