import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useProductionProgress } from '../hooks/useLivePercent.js';
import ProgressBar from '../components/ProgressBar.js';
import { api } from '../services/api.js';
import {
  BUILDING_NAMES, RESOURCE_NAMES, RECIPES_BY_BUILDING, RECIPE_BY_KEY, RECIPE_BY_ID,
  BUILDING_CONSTRUCTION_COSTS, BUILDING_TYPE_IDS, BUILDING_TYPE_BY_ID,
  HOUSING_BASE_CAPACITY, WORKERS_PER_LEVEL,
  T1_WORKER_NEEDS, BASE_CYCLE_SECONDS,
  KEEP_MAX_BUILDING_SLOTS, KEEP_DEFAULT_BUILDING_SLOTS, KEEP_SLOT_UNLOCK_RESOURCE,
} from '@merchant-realms/shared';
import type { BuildingType, Recipe, RecipeInput } from '@merchant-realms/shared';
import type { ProductionTask } from '../services/api.js';
import WarehousePanel from '../components/WarehousePanel.js';

type Tab = 'keep' | 'buildings' | 'warehouse' | 'production' | 'workers';

export default function KingdomPage() {
  const { keepId: keepIdStr, tab } = useParams<{ keepId?: string; tab?: string }>();
  const keepId = keepIdStr ? parseInt(keepIdStr) : undefined;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const currentTab = (tab as Tab) ?? 'buildings';

  const { data: empireData, isLoading: keepsLoading, isError: keepsError } = useQuery({
    queryKey: ['empire'],
    queryFn: api.empireBootstrap,
  });
  const keeps = empireData?.empire.keeps ?? [];

  // Redirect to first keep as soon as we have one (works on cache hit too)
  if (!keepId && keeps.length > 0) {
    return <Navigate to={`/kingdom/${keeps[0]!.id}`} replace />;
  }

  if (!keepId && keepsError) {
    return (
      <div className="h-[calc(100vh-48px)] flex items-center justify-center">
        <span className="text-red-400 text-sm">Failed to load keeps — check the server is running.</span>
      </div>
    );
  }

  // Don't flash "No keeps" while the initial fetch is still running
  if (!keepId && keepsLoading) {
    return (
      <div className="h-[calc(100vh-48px)] flex items-center justify-center">
        <span className="text-stone-500 text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-48px)] flex overflow-hidden">
      {/* ── Left sidebar: keep list ──────────────────────────────────────── */}
      <aside className="w-52 flex-shrink-0 border-r border-stone-700/60 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-700/60">
          <span className="text-xs uppercase tracking-wider text-stone-500">My Keeps</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {keepsError && (
            <div className="p-4 text-red-400 text-xs">Error loading keeps</div>
          )}
          {!keepsError && keeps.length === 0 && !keepsLoading && (
            <div className="p-4 text-stone-600 text-sm">No keeps yet.</div>
          )}
          {keeps.map((k) => (
            <button
              key={k.id}
              className={`w-full text-left px-4 py-3 border-b border-stone-800/60 transition-colors ${
                k.id === keepId ? 'bg-stone-800 text-parchment-100' : 'text-stone-400 hover:bg-stone-800/50'
              }`}
              onClick={() => navigate(`/kingdom/${k.id}/${currentTab}`)}
            >
              <div className="text-sm">{k.name}</div>
              <div className="text-xs text-stone-600 mt-0.5">{k.plot?.name ?? ''}</div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Right panel ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!keepId ? (
          <div className="flex items-center justify-center h-full text-stone-600 text-sm">
            No keeps — found one to get started.
          </div>
        ) : (
          <KeepDetail keepId={keepId} currentTab={currentTab} onTabChange={(t) => navigate(`/kingdom/${keepId}/${t}`)} qc={qc} />
        )}
      </div>
    </div>
  );
}

// ── Keep detail ───────────────────────────────────────────────────────────────

function KeepDetail({ keepId, currentTab, onTabChange, qc }: {
  keepId: number;
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['keep', keepId],
    queryFn: () => api.keep(keepId),
  });

  if (isError) return <div className="p-6 text-red-400 text-sm">Failed to load keep — check server connection.</div>;
  if (isLoading || !data) return <div className="p-6 text-stone-500 text-sm">Loading…</div>;

  const { keep, storage } = data;
  const ledgerMap = new Map((keep.warehouse?.items ?? []).map((e) => [e.resourceType, e.quantity]));

  const totalWorkers = keep.buildings
    .filter((b) => b.buildingTypeId === BUILDING_TYPE_IDS.HOUSING && b.isActive)
    .reduce((sum, b) => sum + b.level * HOUSING_BASE_CAPACITY, 0);
  const usedWorkers = keep.buildings
    .filter((b) => b.buildingTypeId !== BUILDING_TYPE_IDS.HOUSING && b.buildingTypeId !== BUILDING_TYPE_IDS.WAREHOUSE && b.isActive)
    .reduce((sum, b) => sum + b.level * WORKERS_PER_LEVEL, 0);
  const freeWorkers = Math.max(0, totalWorkers - usedWorkers);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'keep',       label: 'Keep'       },
    { key: 'buildings',  label: 'Buildings'  },
    { key: 'warehouse',  label: 'Warehouse'  },
    { key: 'production', label: 'Production' },
    { key: 'workers',    label: 'Workers'    },
  ];

  return (
    <>
      {/* Keep header + stats */}
      <div className="border-b border-stone-700/60 px-6 py-3 flex-shrink-0">
        <div className="flex items-baseline gap-3 mb-2">
          <h1 className="text-lg font-semibold text-parchment-100">{keep.name}</h1>
          <span className="text-stone-500 text-sm">{keep.plot?.name ?? ''}</span>
        </div>
        <div className="flex gap-5 text-xs text-stone-500 flex-wrap">
          <span>Workers <span className="text-stone-300 ml-1">{totalWorkers} total · {usedWorkers} used · {freeWorkers} free</span>
            {usedWorkers > totalWorkers && <span className="text-red-400 ml-1">({usedWorkers - totalWorkers} short)</span>}
          </span>
          <span>Storage <span className="text-stone-300 ml-1">{storage.usedWeight} / {storage.maxWeight} kg</span></span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-700/60 flex-shrink-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`px-5 py-2.5 text-sm transition-colors border-b-2 ${
              currentTab === t.key
                ? 'border-parchment-200 text-parchment-100'
                : 'border-transparent text-stone-500 hover:text-stone-300'
            }`}
            onClick={() => onTabChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={`flex-1 ${currentTab === 'warehouse' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {currentTab === 'keep'       && <KeepTab keep={keep} qc={qc} />}
        {currentTab === 'buildings'  && <BuildingsTab keep={keep} keepId={keepId} ledgerMap={ledgerMap} qc={qc} navigate={navigate} />}
        {currentTab === 'warehouse'  && (
          <WarehousePanel
            locationType="KEEP"
            locationId={keepId}
            warehouseId={keep.warehouseId ?? 0}
            locationLabel={`${keep.name} — Resources`}
            inventory={(keep.warehouse?.items ?? []).filter((e) => e.quantity > 0)}
            onInventoryChange={() => qc.invalidateQueries({ queryKey: ['keep', keepId] })}
            className="h-full"
          />
        )}
        {currentTab === 'production' && <ProductionTab keep={keep} keepId={keepId} ledgerMap={ledgerMap} qc={qc} />}
        {currentTab === 'workers'    && <WorkersTab keep={keep} ledgerMap={ledgerMap} />}
      </div>
    </>
  );
}

// ── Keep tab ──────────────────────────────────────────────────────────────────

interface KeepTabKeep { id: number; name: string; plot?: { name: string; x: number; y: number } | null }
function KeepTab({ keep, qc }: { keep: KeepTabKeep; qc: ReturnType<typeof useQueryClient> }) {
  const [name, setName] = useState(keep.name);
  const rename = useMutation({
    mutationFn: () => api.renameKeep(keep.id, name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['empire'] }); qc.invalidateQueries({ queryKey: ['keep', keep.id] }); },
  });
  useEffect(() => { setName(keep.name); }, [keep.name]);

  return (
    <div className="p-6 max-w-lg">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wider text-stone-500 mb-3">Location</div>
        <div className="border border-stone-700 rounded p-4 bg-stone-800 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-500">Plot</span>
            <span className="text-parchment-200">{keep.plot?.name ?? '—'}</span>
          </div>
          {keep.plot && (
            <div className="flex justify-between">
              <span className="text-stone-500">Coordinates</span>
              <span className="text-parchment-200">({keep.plot.x}, {keep.plot.y})</span>
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-stone-500 mb-3">Rename Keep</div>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-stone-900 border border-stone-700 rounded px-3 py-2 text-parchment-100 text-sm focus:outline-none focus:border-stone-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name && rename.mutate()}
          />
          <button
            className="bg-stone-700 hover:bg-stone-600 disabled:opacity-40 text-parchment-100 px-4 py-2 rounded text-sm"
            disabled={!name || name === keep.name || rename.isPending}
            onClick={() => rename.mutate()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Buildings tab ─────────────────────────────────────────────────────────────

function BuildingsTab({ keep, keepId, ledgerMap, qc, navigate }: {
  keep: { id: number; buildingSlotCount: number; buildings: Array<{ id: number; buildingTypeId: number; level: number; slotIndex: number; isActive: boolean; isDormant: boolean; health: number }> };
  keepId: number;
  ledgerMap: Map<string, number>;
  qc: ReturnType<typeof useQueryClient>;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [buildingType, setBuildingType] = useState('');
  const [buildError, setBuildError] = useState('');

  const buildingsBySlot = new Map(keep.buildings.map((b) => [b.slotIndex, b]));
  const costs = buildingType
    ? (BUILDING_CONSTRUCTION_COSTS[buildingType as keyof typeof BUILDING_CONSTRUCTION_COSTS] ?? [])
    : [];
  const canAfford = costs.every((c) => (ledgerMap.get(c.resource) ?? 0) >= c.quantity);

  // Next locked slot: the first slot index >= buildingSlotCount
  const nextLockedSlot  = keep.buildingSlotCount;
  const unlockNumber    = nextLockedSlot - KEEP_DEFAULT_BUILDING_SLOTS + 1; // 1-indexed
  const unlockCost      = unlockNumber; // n-th unlock costs n Scaffolding
  const scaffoldingHeld = ledgerMap.get(KEEP_SLOT_UNLOCK_RESOURCE) ?? 0;
  const canAffordUnlock = scaffoldingHeld >= unlockCost && keep.buildingSlotCount < KEEP_MAX_BUILDING_SLOTS;

  const construct = useMutation({
    mutationFn: ({ bType, slot }: { bType: string; slot: number }) => api.buildBuilding(keepId, bType, slot),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['keep', keepId] }); setSelectedSlot(null); setBuildingType(''); setBuildError(''); },
    onError: (err: Error) => setBuildError(err.message),
  });

  const unlockSlot = useMutation({
    mutationFn: () => api.unlockSlot(keepId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['keep', keepId] }),
  });

  return (
    <div className="p-6">
      {/* Slot counter */}
      <div className="text-xs text-stone-600 mb-3">
        {keep.buildingSlotCount} / {KEEP_MAX_BUILDING_SLOTS} slots unlocked
      </div>

      <div className="grid grid-cols-4 gap-2 mb-5 max-w-xl">
        {Array.from({ length: KEEP_MAX_BUILDING_SLOTS }, (_, i) => {
          const building   = buildingsBySlot.get(i);
          const isUnlocked = i < keep.buildingSlotCount;
          const isNextLock = i === nextLockedSlot;

          if (!isUnlocked) {
            return (
              <div
                key={i}
                className={`border rounded p-2.5 min-h-[72px] flex flex-col justify-between transition-colors ${
                  isNextLock
                    ? 'border-stone-600 bg-stone-900/60 cursor-pointer hover:border-stone-500'
                    : 'border-stone-800 bg-stone-900/20 cursor-default opacity-40'
                }`}
                onClick={() => isNextLock && setSelectedSlot(selectedSlot === -1 ? null : -1)}
              >
                <div className="text-stone-600 text-xs">Slot {i + 1}</div>
                {isNextLock && (
                  <div className="text-xs text-stone-500 mt-1">
                    🔒 {unlockCost} {RESOURCE_NAMES[KEEP_SLOT_UNLOCK_RESOURCE as keyof typeof RESOURCE_NAMES]}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={i}
              className={`border rounded p-2.5 min-h-[72px] cursor-pointer transition-colors ${
                building
                  ? 'border-stone-600 bg-stone-800 hover:bg-stone-700'
                  : selectedSlot === i
                    ? 'border-stone-500 bg-stone-800'
                    : 'border-stone-700 border-dashed bg-stone-800/30 hover:border-stone-600'
              }`}
              onClick={() => building ? navigate(`/kingdom/${keepId}/buildings/${building.id}`) : setSelectedSlot(i === selectedSlot ? null : i)}
            >
              {building ? (
                <>
                  <div className="text-sm text-parchment-200 leading-tight">{BUILDING_NAMES[BUILDING_TYPE_BY_ID[building.buildingTypeId] as keyof typeof BUILDING_NAMES] ?? String(building.buildingTypeId)}</div>
                  <div className="text-xs text-stone-500 mt-1">Lv.{building.level}</div>
                  {building.isDormant && <div className="text-xs text-red-500 mt-0.5">Dormant</div>}
                </>
              ) : (
                <div className="text-stone-700 text-xs text-center pt-3">Slot {i + 1}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Build dialog (for unlocked empty slots) */}
      {selectedSlot !== null && selectedSlot >= 0 && (
        <div className="border border-stone-700 rounded p-4 bg-stone-800 max-w-sm mb-3">
          <div className="text-xs uppercase tracking-wider text-stone-500 mb-3">Construct in Slot {selectedSlot + 1}</div>
          <select
            className="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-parchment-100 text-sm mb-3 focus:outline-none"
            value={buildingType}
            onChange={(e) => { setBuildingType(e.target.value); setBuildError(''); }}
          >
            <option value="">Select building...</option>
            {Object.keys(BUILDING_NAMES).map((bt) => (
              <option key={bt} value={bt}>{BUILDING_NAMES[bt as keyof typeof BUILDING_NAMES]}</option>
            ))}
          </select>
          {buildingType && costs.length > 0 && (
            <div className="text-xs text-stone-500 mb-3">
              Cost:{' '}
              {costs.map((c, idx) => {
                const have = ledgerMap.get(c.resource) ?? 0;
                return (
                  <span key={c.resource}>
                    {idx > 0 && <span className="text-stone-700"> + </span>}
                    <span className={have >= c.quantity ? 'text-parchment-200' : 'text-red-400'}>
                      {c.quantity} {RESOURCE_NAMES[c.resource as keyof typeof RESOURCE_NAMES] ?? c.resource}
                    </span>
                    <span className="text-stone-700"> ({Math.floor(have)})</span>
                  </span>
                );
              })}
            </div>
          )}
          {buildError && <div className="text-red-400 text-xs mb-2">{buildError}</div>}
          <div className="flex gap-2">
            <button
              className="bg-gold-600 hover:bg-gold-500 disabled:opacity-40 text-stone-900 font-semibold px-4 py-1.5 rounded text-sm"
              disabled={!buildingType || !canAfford || construct.isPending}
              onClick={() => buildingType && construct.mutate({ bType: buildingType, slot: selectedSlot })}
            >
              Build
            </button>
            <button className="text-stone-500 hover:text-stone-300 text-sm" onClick={() => { setSelectedSlot(null); setBuildError(''); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Unlock dialog (for the next locked slot) */}
      {selectedSlot === -1 && keep.buildingSlotCount < KEEP_MAX_BUILDING_SLOTS && (
        <div className="border border-stone-700 rounded p-4 bg-stone-800 max-w-sm">
          <div className="text-xs uppercase tracking-wider text-stone-500 mb-2">Unlock Slot {nextLockedSlot + 1}</div>
          <div className="text-sm text-stone-400 mb-3">
            Cost:{' '}
            <span className={scaffoldingHeld >= unlockCost ? 'text-parchment-200' : 'text-red-400'}>
              {unlockCost} {RESOURCE_NAMES[KEEP_SLOT_UNLOCK_RESOURCE as keyof typeof RESOURCE_NAMES]}
            </span>
            <span className="text-stone-600 ml-1">({Math.floor(scaffoldingHeld)} held)</span>
          </div>
          <div className="flex gap-2">
            <button
              className="bg-gold-600 hover:bg-gold-500 disabled:opacity-40 text-stone-900 font-semibold px-4 py-1.5 rounded text-sm"
              disabled={!canAffordUnlock || unlockSlot.isPending}
              onClick={() => unlockSlot.mutate()}
            >
              Unlock
            </button>
            <button className="text-stone-500 hover:text-stone-300 text-sm" onClick={() => setSelectedSlot(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Production tab ────────────────────────────────────────────────────────────

// Per-building-type progress bar driven by ProductionTask timestamps
function BuildingProgressBar({ task }: { task: ProductionTask | null | undefined }) {
  const pct = useProductionProgress(task);
  const secsRemaining = task
    ? Math.max(0, Math.round((new Date(task.completesAt).getTime() - Date.now()) / 1000))
    : 0;
  const label = secsRemaining >= 60
    ? `${Math.floor(secsRemaining / 60)}m ${secsRemaining % 60}s`
    : `${secsRemaining}s`;
  return (
    <div className="w-full">
      <ProgressBar pct={pct} color="bg-gold-600/50" height="h-1" />
      <div className="flex justify-between text-xs text-stone-600 mt-0.5">
        <span>{(pct * 100).toFixed(0)}%</span>
        {task && <span>{label}</span>}
      </div>
    </div>
  );
}


function EfficiencyBar({ keep, ledgerMap }: {
  keep: { buildings: Array<{ buildingTypeId: number; level: number; isActive: boolean }> };
  ledgerMap: Map<string, number>;
}) {
  const totalWorkers = keep.buildings
    .filter((b) => b.buildingTypeId === BUILDING_TYPE_IDS.HOUSING && b.isActive)
    .reduce((sum, b) => sum + b.level * HOUSING_BASE_CAPACITY, 0);
  const usedWorkers = keep.buildings
    .filter((b) => b.buildingTypeId !== BUILDING_TYPE_IDS.HOUSING && b.buildingTypeId !== BUILDING_TYPE_IDS.WAREHOUSE && b.isActive)
    .reduce((sum, b) => sum + b.level * WORKERS_PER_LEVEL, 0);

  const workerFactor = usedWorkers === 0 ? 1 : Math.min(1, totalWorkers / usedWorkers);

  const needs = T1_WORKER_NEEDS.map((n) => ({
    ...n,
    needed: n.quantityPerCycle * totalWorkers,
    held:   ledgerMap.get(n.resourceType) ?? 0,
  }));
  const unmetRequired = needs.filter((n) => n.isNecessary  && n.held < n.needed);
  const metOptional   = needs.filter((n) => !n.isNecessary && n.held >= n.needed);
  const penaltyFactor = Math.max(0, 1 - unmetRequired.length * 0.15);
  const bonusFactor   = Math.min(1.5, 1 + metOptional.length * 0.05);
  const efficiency    = Math.round(workerFactor * penaltyFactor * bonusFactor * 100);

  const hints: string[] = [];
  if (workerFactor < 1) hints.push(`${Math.round(workerFactor * 100)}% staffed`);
  if (unmetRequired.length > 0) hints.push(`${unmetRequired.length} supply missing`);
  if (metOptional.length > 0)   hints.push(`+${metOptional.length} optional bonus`);

  const color = efficiency < 70 ? 'text-red-400' : efficiency < 100 ? 'text-amber-400' : efficiency > 100 ? 'text-green-400' : 'text-stone-400';

  return (
    <div className="flex items-center justify-between mb-4 px-3 py-2 border border-stone-800 rounded bg-stone-900/50 text-sm">
      <span className="text-stone-500">Production rate</span>
      <div className="flex items-center gap-3">
        {hints.length > 0 && (
          <span className="text-xs text-stone-600">{hints.join(' · ')}</span>
        )}
        <span className={`font-mono font-semibold ${color}`}>{efficiency}%</span>
      </div>
    </div>
  );
}

function ProductionTab({ keep, keepId, ledgerMap, qc }: {
  keep: {
    buildings: Array<{ buildingTypeId: number; level: number; isActive: boolean; productionProgress: number; productionTask: ProductionTask | null }>;
    productionOrders: Array<{ id: number; buildingTypeId: number; recipeId: number; orderType: string; targetQuantity: number | null; producedQuantity: number }>;
  };
  keepId: number;
  ledgerMap: Map<string, number>;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [expandedType, setExpandedType] = useState<number | null>(null);
  const [recipeKey, setRecipeKey] = useState('');
  const [orderType, setOrderType] = useState<'INFINITE' | 'NUMERICAL'>('INFINITE');
  const [targetQty, setTargetQty] = useState('');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['keep', keepId] });

  const addOrder = useMutation({
    mutationFn: (bTypeId: number) => {
      const bTypeCode = BUILDING_TYPE_BY_ID[bTypeId] as BuildingType;
      return api.addOrder(keepId, bTypeCode, {
        recipeKey,
        orderType,
        ...(orderType === 'NUMERICAL' ? { targetQuantity: Number(targetQty) } : {}),
      });
    },
    onSuccess: () => { invalidate(); setRecipeKey(''); setTargetQty(''); },
  });
  const removeOrder = useMutation({
    mutationFn: (orderId: number) => api.removeOrder(keepId, orderId),
    onSuccess: invalidate,
  });

  const prodBuildings = keep.buildings.filter((b) => b.buildingTypeId !== BUILDING_TYPE_IDS.HOUSING && b.buildingTypeId !== BUILDING_TYPE_IDS.WAREHOUSE);
  const prodTypes = [...new Set(prodBuildings.map((b) => b.buildingTypeId))];
  const ordersByType = new Map<number, typeof keep.productionOrders>();
  for (const order of keep.productionOrders) {
    if (!ordersByType.has(order.buildingTypeId)) ordersByType.set(order.buildingTypeId, []);
    ordersByType.get(order.buildingTypeId)!.push(order);
  }

  if (prodTypes.length === 0) {
    return <div className="p-6 text-stone-600 text-sm">No production buildings — construct one in the Buildings tab.</div>;
  }

  return (
    <div className="p-6 max-w-xl">
      <EfficiencyBar keep={keep} ledgerMap={ledgerMap} />
      <div className="space-y-1">
        {prodTypes.map((bTypeId) => {
          const bTypeCode = BUILDING_TYPE_BY_ID[bTypeId] as BuildingType | undefined;
          const recipes = bTypeCode ? (RECIPES_BY_BUILDING[bTypeCode] ?? []) : [];
          if (recipes.length === 0) return null;
          const orders = ordersByType.get(bTypeId) ?? [];
          const isOpen = expandedType === bTypeId;

          // Active recipe for progress display (first numerical, then first infinite)
          const activeOrder = orders.find((o) => o.orderType === 'NUMERICAL' && (o.targetQuantity ?? 0) > o.producedQuantity)
            ?? orders.find((o) => o.orderType === 'INFINITE');
          const activeRecipeKey = activeOrder ? RECIPE_BY_ID[activeOrder.recipeId] : undefined;
          const activeRecipe = activeRecipeKey ? RECIPE_BY_KEY[activeRecipeKey] : null;

          // Use the first active building's task for progress display
          const buildingsOfType = prodBuildings.filter((b) => b.buildingTypeId === bTypeId);
          const activeTask      = buildingsOfType.find((b) => b.productionTask != null)?.productionTask ?? null;

          return (
            <div key={bTypeId} className="border border-stone-700 rounded bg-stone-800">
              <button
                className="w-full flex flex-col px-4 py-3 hover:bg-stone-700/30 transition-colors text-left"
                onClick={() => { setExpandedType(isOpen ? null : bTypeId); setRecipeKey(''); setTargetQty(''); setOrderType('INFINITE'); }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-parchment-200">{bTypeCode ? (BUILDING_NAMES[bTypeCode as keyof typeof BUILDING_NAMES] ?? bTypeCode) : String(bTypeId)}</span>
                    {activeRecipe && <span className="text-xs text-stone-500">→ {RESOURCE_NAMES[activeRecipe.output as keyof typeof RESOURCE_NAMES] ?? activeRecipe.output}</span>}
                  </div>
                  <span className="text-stone-600 text-xs">{isOpen ? '▲' : '▼'}</span>
                </div>
                {activeRecipe && (
                  <BuildingProgressBar task={activeTask} />
                )}
              </button>

              {isOpen && (
                <div className="border-t border-stone-700 px-4 py-3">
                  {orders.length === 0 ? (
                    <p className="text-stone-600 text-xs mb-3">No orders.</p>
                  ) : (
                    <div className="space-y-1.5 mb-3">
                      {orders.map((order) => (
                        <div key={order.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-stone-400">{RECIPE_BY_ID[order.recipeId] ?? String(order.recipeId)}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded bg-stone-700 ${order.orderType === 'INFINITE' ? 'text-stone-400' : 'text-amber-400'}`}>
                              {order.orderType === 'INFINITE' ? '∞' : `${order.producedQuantity.toFixed(0)}/${order.targetQuantity}`}
                            </span>
                          </div>
                          <button onClick={() => removeOrder.mutate(order.id)} className="text-stone-600 hover:text-red-400 text-xs ml-3">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-stone-700/60 pt-3">
                    <select
                      className="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-parchment-100 text-sm mb-2 focus:outline-none"
                      value={recipeKey}
                      onChange={(e) => setRecipeKey(e.target.value)}
                    >
                      <option value="">Select recipe...</option>
                      {recipes.map((r: Recipe) => (
                        <option key={r.key} value={r.key}>
                          {RESOURCE_NAMES[r.output as keyof typeof RESOURCE_NAMES] ?? r.output} ×{r.outputQty}
                          {r.inputs.length > 0 ? ` — needs ${r.inputs.map((i: RecipeInput) => `${i.quantity} ${RESOURCE_NAMES[i.resource as keyof typeof RESOURCE_NAMES] ?? i.resource}`).join(', ')}` : ''}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2 mb-2">
                      {(['INFINITE', 'NUMERICAL'] as const).map((t) => (
                        <button key={t}
                          className={`flex-1 py-1.5 rounded text-xs border transition-colors ${orderType === t ? 'border-stone-500 text-parchment-200' : 'border-stone-700 text-stone-500 hover:border-stone-600'}`}
                          onClick={() => setOrderType(t)}
                        >
                          {t === 'INFINITE' ? '∞ Infinite' : '# Quantity'}
                        </button>
                      ))}
                    </div>
                    {orderType === 'NUMERICAL' && (
                      <input
                        type="number"
                        className="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-parchment-100 text-sm mb-2 focus:outline-none"
                        placeholder="Target quantity..."
                        value={targetQty}
                        onChange={(e) => setTargetQty(e.target.value)}
                      />
                    )}
                    <button
                      className="bg-gold-600 hover:bg-gold-500 disabled:opacity-40 text-stone-900 font-semibold px-4 py-1.5 rounded text-sm"
                      disabled={!recipeKey || (orderType === 'NUMERICAL' && !targetQty) || addOrder.isPending}
                      onClick={() => recipeKey && addOrder.mutate(bTypeId)}
                    >
                      Add Order
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Workers tab ───────────────────────────────────────────────────────────────

const CYCLE_LABEL = (() => {
  const mins = BASE_CYCLE_SECONDS / 60;
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
})();

function WorkersTab({ keep, ledgerMap }: {
  keep: { buildings: Array<{ buildingTypeId: number; level: number; isActive: boolean }> };
  ledgerMap: Map<string, number>;
}) {
  const totalWorkers = keep.buildings
    .filter((b) => b.buildingTypeId === BUILDING_TYPE_IDS.HOUSING && b.isActive)
    .reduce((sum, b) => sum + b.level * HOUSING_BASE_CAPACITY, 0);
  const usedWorkers = keep.buildings
    .filter((b) => b.buildingTypeId !== BUILDING_TYPE_IDS.HOUSING && b.buildingTypeId !== BUILDING_TYPE_IDS.WAREHOUSE && b.isActive)
    .reduce((sum, b) => sum + b.level * WORKERS_PER_LEVEL, 0);
  const freeWorkers = Math.max(0, totalWorkers - usedWorkers);
  const workerShortfall = Math.max(0, usedWorkers - totalWorkers);

  const needs = T1_WORKER_NEEDS.map((n) => {
    const needed = n.quantityPerCycle * totalWorkers;
    const held   = ledgerMap.get(n.resourceType) ?? 0;
    return { ...n, needed, held, isMet: held >= needed };
  });

  const unmetRequired = needs.filter((n) => n.isNecessary && !n.isMet);
  const metOptional   = needs.filter((n) => !n.isNecessary && n.isMet);
  const penaltyFactor = Math.max(0, 1 - unmetRequired.length * 0.15);
  const bonusFactor   = Math.min(1.5, 1 + metOptional.length * 0.05);
  const speedPct      = Math.round(penaltyFactor * bonusFactor * 100);

  return (
    <div className="p-6 max-w-lg space-y-6">

      {/* Worker pool */}
      <div>
        <div className="text-xs uppercase tracking-wider text-stone-500 mb-3">Worker Pool</div>
        <div className="border border-stone-700 rounded bg-stone-800 divide-y divide-stone-700/60 text-sm">
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-stone-400">Total (from Housing)</span>
            <span className="text-parchment-200 font-mono">{totalWorkers}</span>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-stone-400">Employed</span>
            <span className={`font-mono ${usedWorkers > totalWorkers ? 'text-red-400' : 'text-parchment-200'}`}>{usedWorkers}</span>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-stone-400">Idle</span>
            <span className="text-stone-400 font-mono">{freeWorkers}</span>
          </div>
          {workerShortfall > 0 && (
            <div className="px-4 py-2 text-xs text-red-400">
              {workerShortfall} workers short — production speed reduced proportionally
            </div>
          )}
        </div>
      </div>

      {/* Consumption */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-xs uppercase tracking-wider text-stone-500">T1 Labourer Consumption</div>
          <div className="text-xs text-stone-600">per {CYCLE_LABEL} cycle · {totalWorkers} workers</div>
        </div>

        {totalWorkers === 0 ? (
          <p className="text-stone-600 text-sm">No workers — build Housing to house labourers.</p>
        ) : (
          <>
            <div className="text-xs text-stone-600 uppercase tracking-wider mb-1.5">Required</div>
            <div className="border border-stone-700 rounded bg-stone-800 divide-y divide-stone-700/60 mb-4">
              {needs.filter((n) => n.isNecessary).map((n) => (
                <NeedRow key={n.resourceType} resourceType={n.resourceType} needed={n.needed} held={n.held} isMet={n.isMet} tag={n.isMet ? null : { label: '−15% speed', color: 'red' }} />
              ))}
            </div>

            <div className="text-xs text-stone-600 uppercase tracking-wider mb-1.5">Optional</div>
            <div className="border border-stone-700 rounded bg-stone-800 divide-y divide-stone-700/60 mb-4">
              {needs.filter((n) => !n.isNecessary).map((n) => (
                <NeedRow key={n.resourceType} resourceType={n.resourceType} needed={n.needed} held={n.held} isMet={n.isMet} tag={n.isMet ? { label: '+5% speed', color: 'green' } : null} />
              ))}
            </div>

            {/* Speed modifier summary */}
            <div className="border border-stone-700 rounded p-3 bg-stone-800/50 flex items-center justify-between text-sm">
              <span className="text-stone-500">Production speed modifier</span>
              <div className="flex items-center gap-3">
                {unmetRequired.length > 0 && (
                  <span className="text-xs text-stone-600">{unmetRequired.length} missing × −15%</span>
                )}
                {metOptional.length > 0 && (
                  <span className="text-xs text-stone-600">{metOptional.length} bonus × +5%</span>
                )}
                <span className={`font-mono font-semibold ${speedPct < 100 ? 'text-red-400' : speedPct > 100 ? 'text-green-400' : 'text-stone-400'}`}>
                  {speedPct}%
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NeedRow({ resourceType, needed, held, isMet, tag }: {
  resourceType: string;
  needed: number;
  held: number;
  isMet: boolean;
  tag: { label: string; color: 'red' | 'green' } | null;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
      <div className="flex items-center gap-2">
        <span className={isMet ? 'text-stone-300' : 'text-red-400'}>
          {RESOURCE_NAMES[resourceType as keyof typeof RESOURCE_NAMES] ?? resourceType}
        </span>
        {tag && (
          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
            tag.color === 'red'   ? 'bg-red-950/40 text-red-400' :
                                    'bg-green-950/40 text-green-400'
          }`}>
            {tag.label}
          </span>
        )}
      </div>
      <div className="text-xs font-mono text-right">
        <span className={held < needed ? 'text-red-400' : 'text-stone-400'}>{Math.floor(held)}</span>
        <span className="text-stone-600"> / {needed % 1 === 0 ? needed : needed.toFixed(1)} needed</span>
      </div>
    </div>
  );
}
