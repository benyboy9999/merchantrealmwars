import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { api } from '../services/api.js';
import type { CaravanWithCargo, Warehouse, WarehouseItem, Keep, EmpireBootstrap } from '../services/api.js';
import { RESOURCE_NAMES, RESOURCE_WEIGHT, REGION_IDS } from '@merchant-realms/shared';
import { IconSlot, Modal, ModalSection, Button, TransferPopover } from './ui/index.js';

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

  // anchor includes cursor position so the popover appears near the button
  const [loadPopup,    setLoadPopup]    = useState<{ rt: string; caravanId: number; anchor: { x: number; y: number } } | null>(null);
  const [unloadPopup,  setUnloadPopup]  = useState<{ caravanId: number; rt: string; anchor: { x: number; y: number } } | null>(null);
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

  const bulkTransfer = useMutation({
    mutationFn: async (items: TransferParams[]) => {
      await Promise.all(items.map((p) => api.transfer(p)));
    },
    onSuccess: () => invalidate(),
    onError:   () => invalidate(),
  });

  const allCaravans           = empireData?.empire.caravans ?? [];
  const hereCaravans          = allCaravans.filter((c) => c.status === 'IDLE' && c.locationType === locationType && c.locationId === locationId);
  const allKeeps              = empireData?.empire.keeps ?? [];
  const totalWeight           = inventory.reduce((s, e) => s + e.quantity * rKgPer(e.resourceType), 0);

  // Always keep a caravan selected — default to first here, then first overall
  const effectiveActiveCaId: number | null =
    (activeCaId != null && allCaravans.some((c) => c.id === activeCaId))
      ? activeCaId
      : hereCaravans[0]?.id ?? allCaravans[0]?.id ?? null;

  const activeCaravan   = effectiveActiveCaId != null ? allCaravans.find((c) => c.id === effectiveActiveCaId) ?? null : null;
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
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/60 flex-shrink-0">
          <span className="text-xs uppercase tracking-wider text-slate-500 flex-1">{locationLabel}</span>
          <span className="text-xs text-slate-600">{totalWeight.toFixed(1)} kg</span>
          {hereCaravans.length > 0 && (() => {
            const targetId = (effectiveActiveCaId && activeIsHere ? effectiveActiveCaId : null) ?? hereCaravans[0]?.id;
            const targetCaravan = hereCaravans.find((c) => c.id === targetId);
            const transfers = inventory
              .filter((e) => e.quantity > 0)
              .flatMap((e) => {
                const qty = Math.floor(maxLoadable(e.resourceType, targetId ?? 0));
                if (!targetCaravan?.warehouseId || qty <= 0) return [];
                return [{ fromWarehouseId: warehouseId, toWarehouseId: targetCaravan.warehouseId, resourceType: e.resourceType, quantity: qty }];
              });
            return (
              <button
                title={`Load all into ${targetCaravan?.name ?? 'caravan'}`}
                disabled={transfers.length === 0 || bulkTransfer.isPending}
                onClick={() => bulkTransfer.mutate(transfers)}
                className="w-6 h-6 flex items-center justify-center border border-slate-600 rounded text-slate-400 hover:text-slate-100 hover:border-slate-400 hover:bg-slate-700/40 disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs"
              >››</button>
            );
          })()}
        </div>

        <div className="flex-1 overflow-y-auto">
          {inventory.length === 0 ? (
            <div className="p-4 text-slate-600 text-sm">Nothing here yet.</div>
          ) : (
            <div>
              {inventory.filter((e) => e.quantity > 0).sort((a, b) => b.quantity - a.quantity).map((e) => {
                const isLoadOpen = loadPopup?.rt === e.resourceType;
                const isSellOpen = sellPopup === e.resourceType;
                const loadCaId   = loadPopup?.caravanId ?? (effectiveActiveCaId && activeIsHere ? effectiveActiveCaId : null) ?? hereCaravans[0]?.id ?? 0;
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
                          title={`Left-click: choose amount · Right-click: transfer all`}
                          onClick={(ev) => {
                            if (isLoadOpen) { setLoadPopup(null); return; }
                            setLoadPopup({ rt: e.resourceType, caravanId: loadCaId, anchor: { x: ev.clientX, y: ev.clientY } });
                          }}
                          onContextMenu={(ev) => {
                            ev.preventDefault();
                            const q = Math.floor(maxLoadable(e.resourceType, loadCaId));
                            const targetCaravan = hereCaravans.find((c) => c.id === loadCaId);
                            if (!targetCaravan?.warehouseId || q <= 0) return;
                            transfer.mutate({ fromWarehouseId: warehouseId, toWarehouseId: targetCaravan.warehouseId, resourceType: e.resourceType, quantity: q });
                          }}
                          disabled={!canLoad}
                        >›</button>
                      )}
                    </div>

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

        {/* ── Compact tab strip (replaces header) ──────────────────────── */}
        <div className="flex overflow-x-auto flex-shrink-0 border-b border-slate-700/60 scrollbar-none">
          {caravansError && (
            <span className="px-3 py-2 text-xs text-red-400">Failed to load</span>
          )}
          {!caravansError && allCaravans.length === 0 && (
            <span className="px-3 py-2 text-xs text-slate-600">No caravans</span>
          )}
          {allCaravans.map((c) => {
            const isHere     = hereCaravans.some((hc) => hc.id === c.id);
            const isSelected = effectiveActiveCaId === c.id;
            const isTransit  = c.status === 'IN_TRANSIT';
            return (
              <button
                key={c.id}
                onClick={() => setActiveCaId(c.id)}
                className={[
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs border-b-2 transition-colors whitespace-nowrap',
                  isSelected
                    ? `border-azure-400 bg-slate-800/40 ${isHere ? 'text-slate-100 font-medium' : 'text-slate-400 font-medium'}`
                    : 'border-transparent',
                  !isSelected && isHere  ? 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/30' : '',
                  !isSelected && !isHere ? 'text-slate-600 hover:text-slate-400 hover:bg-slate-800/20' : '',
                ].filter(Boolean).join(' ')}
              >
                {isHere && !isTransit && (
                  <span className="w-1 h-1 rounded-full bg-emerald-400 flex-shrink-0" />
                )}
                {isTransit && (
                  <span className="w-1 h-1 rounded-full bg-azure-400 flex-shrink-0 animate-pulse" />
                )}
                {c.name}
              </button>
            );
          })}
        </div>

        {activeCaravan ? (
          <>
            {/* ── Status bar ─────────────────────────────────────────────── */}
            {(() => {
              const items   = activeCaravan.warehouse?.items ?? [];
              const cargoKg = items.reduce((s, x) => s + x.quantity * rKgPer(x.resourceType), 0);
              const maxKg   = activeCaravan.warehouse?.cap ?? activeCaravan.animalCount * MULE_KG;
              const pct     = maxKg > 0 ? Math.min(100, cargoKg / maxKg * 100) : 0;
              return (
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-800/60 flex-shrink-0">
                  {/* Capacity bar + location label */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {activeIsHere   && <span className="w-1 h-1 rounded-full bg-emerald-400 flex-shrink-0" />}
                      {!activeIsHere && activeCaravan.status === 'IN_TRANSIT'
                        && <span className="w-1 h-1 rounded-full bg-azure-400 animate-pulse flex-shrink-0" />}
                      {!activeIsHere && activeCaravan.status !== 'IN_TRANSIT'
                        && <span className="w-1 h-1 rounded-full bg-slate-600 flex-shrink-0" />}
                      <span className="text-xs text-slate-500 truncate">
                        {activeIsHere
                          ? `${cargoKg.toFixed(0)} / ${maxKg} kg`
                          : activeCaravan.status === 'IN_TRANSIT'
                            ? `In transit · ${cargoKg.toFixed(0)} kg`
                            : `${caravanLocationName(activeCaravan)} · ${cargoKg.toFixed(0)} kg`
                        }
                      </span>
                    </div>
                    <div className="h-0.5 bg-slate-800 rounded overflow-hidden">
                      <div
                        className={`h-full rounded transition-all ${activeIsHere ? 'bg-emerald-700' : activeCaravan.status === 'IN_TRANSIT' ? 'bg-azure-700' : 'bg-slate-700'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Unload all — only when here and has cargo */}
                  {activeIsHere && items.length > 0 && (
                    <button
                      title="Unload all to warehouse"
                      disabled={bulkTransfer.isPending}
                      onClick={() => {
                        if (!activeCaravan.warehouseId) return;
                        bulkTransfer.mutate(items.map((it) => ({
                          fromWarehouseId: activeCaravan.warehouseId!,
                          toWarehouseId: warehouseId,
                          resourceType: it.resourceType,
                          quantity: it.quantity,
                        })));
                      }}
                      className="w-5 h-5 flex items-center justify-center border border-slate-700 rounded text-slate-500 hover:text-slate-200 hover:border-slate-500 disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs flex-shrink-0"
                    >‹‹</button>
                  )}

                  {/* Send caravan — primary action trigger */}
                  <button
                    onClick={() => setActionCaId(activeCaravan.id)}
                    className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border border-slate-600 bg-slate-800 text-slate-200 hover:border-azure-500 hover:text-azure-300 hover:bg-slate-700 transition-colors"
                  >
                    Send <span className="text-[10px] opacity-60">›</span>
                  </button>
                </div>
              );
            })()}

            {/* ── Cargo items ──────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
              {(activeCaravan.warehouse?.items ?? []).length === 0 ? (
                <div className="px-4 py-3 text-slate-600 text-sm">Empty</div>
              ) : (
                <div>
                  {(activeCaravan.warehouse?.items ?? []).map((cargo) => {
                    const isUnloadOpen = unloadPopup?.caravanId === activeCaravan.id && unloadPopup.rt === cargo.resourceType;
                    return (
                      <div key={cargo.resourceType} className="flex items-center px-4 py-2 hover:bg-slate-800/30 gap-2 border-b border-slate-800/40">
                        {activeIsHere && (
                          <button
                            className={`w-5 h-5 flex items-center justify-center border rounded text-xs transition-colors flex-shrink-0 ${isUnloadOpen ? 'border-slate-200 text-slate-200' : 'border-slate-600 text-slate-500 hover:border-slate-400 hover:text-slate-200'}`}
                            title="Left-click: choose amount · Right-click: unload all"
                            onClick={(ev) => {
                              if (isUnloadOpen) { setUnloadPopup(null); return; }
                              setUnloadPopup({ caravanId: activeCaravan.id, rt: cargo.resourceType, anchor: { x: ev.clientX, y: ev.clientY } });
                            }}
                            onContextMenu={(ev) => {
                              ev.preventDefault();
                              if (!activeCaravan.warehouseId) return;
                              transfer.mutate({ fromWarehouseId: activeCaravan.warehouseId, toWarehouseId: warehouseId, resourceType: cargo.resourceType, quantity: cargo.quantity });
                            }}
                          >‹</button>
                        )}
                        <IconSlot size="xs" label={rName(cargo.resourceType)} />
                        <span className="flex-1 text-sm text-slate-300">{rName(cargo.resourceType)}</span>
                        <span className="text-slate-200 font-mono text-sm tabular-nums w-12 text-right">{cargo.quantity.toFixed(0)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">No caravans</div>
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

      {/* ── Load popover (portal-rendered at cursor) ──────────────────────── */}
      {loadPopup && (
        <TransferPopover
          label={`Load ${rName(loadPopup.rt)} → ${hereCaravans.find((c) => c.id === loadPopup.caravanId)?.name ?? 'caravan'}`}
          maxQty={maxLoadable(loadPopup.rt, loadPopup.caravanId)}
          anchor={loadPopup.anchor}
          onConfirm={(qty) => {
            const targetCaravan = hereCaravans.find((c) => c.id === loadPopup.caravanId);
            if (!targetCaravan?.warehouseId) return;
            transfer.mutate({ fromWarehouseId: warehouseId, toWarehouseId: targetCaravan.warehouseId, resourceType: loadPopup.rt, quantity: qty });
            setLoadPopup(null);
          }}
          onClose={() => setLoadPopup(null)}
          isPending={transfer.isPending}
        >
          {hereCaravans.length > 1 && (
            <select
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-slate-100 text-xs focus:outline-none focus:border-azure-500 mb-0.5"
              value={loadPopup.caravanId}
              onChange={(ev) => setLoadPopup({ ...loadPopup, caravanId: parseInt(ev.target.value) })}
            >
              {hereCaravans.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </TransferPopover>
      )}

      {/* ── Unload popover (portal-rendered at cursor) ────────────────────── */}
      {unloadPopup && activeCaravan && (
        <TransferPopover
          label={`Unload ${rName(unloadPopup.rt)} → ${locationLabel}`}
          maxQty={(activeCaravan.warehouse?.items ?? []).find((i) => i.resourceType === unloadPopup.rt)?.quantity ?? 0}
          anchor={unloadPopup.anchor}
          onConfirm={(qty) => {
            if (!activeCaravan.warehouseId) return;
            transfer.mutate({ fromWarehouseId: activeCaravan.warehouseId, toWarehouseId: warehouseId, resourceType: unloadPopup.rt, quantity: qty });
            setUnloadPopup(null);
          }}
          onClose={() => setUnloadPopup(null)}
          isPending={transfer.isPending}
        />
      )}
    </div>
  );
}

