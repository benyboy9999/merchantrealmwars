import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useProductionProgress } from '../hooks/useLivePercent.js';
import ProgressBar from '../components/ProgressBar.js';
import { Badge, IconSlot, Modal, ModalSection, Button } from '../components/ui/index.js';
import { api } from '../services/api.js';
import {
  BUILDING_NAMES, RESOURCE_NAMES, RECIPES_BY_BUILDING, RECIPE_BY_KEY, RECIPE_BY_ID,
  BUILDING_CONSTRUCTION_COSTS, BUILDING_TYPE_IDS, BUILDING_TYPE_BY_ID,
  HOUSING_BASE_CAPACITY, WORKERS_PER_LEVEL,
  T1_WORKER_NEEDS, BASE_CYCLE_SECONDS, getStarterSpeedMultiplier,
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
      <div className="flex items-center justify-center py-24">
        <span className="text-red-400 text-sm">Failed to load keeps — check the server is running.</span>
      </div>
    );
  }

  // Don't flash "No keeps" while the initial fetch is still running
  if (!keepId && keepsLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-slate-500 text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex gap-4 items-start">
      {/* ── Card: keep list ──────────────────────────────────────────────── */}
      <aside className="w-48 flex-shrink-0 bg-slate-900 border border-slate-700/60 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/60">
          <span className="text-xs uppercase tracking-wider text-slate-500">My Keeps</span>
        </div>
        {keepsError && (
          <div className="p-4 text-red-400 text-xs">Error loading keeps</div>
        )}
        {!keepsError && keeps.length === 0 && !keepsLoading && (
          <div className="p-4 text-slate-600 text-sm">No keeps yet.</div>
        )}
        {keeps.map((k) => (
          <button
            key={k.id}
            className={`w-full text-left px-4 py-3 border-b border-slate-800/60 transition-colors ${
              k.id === keepId ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:bg-slate-800/50'
            }`}
            onClick={() => navigate(`/kingdom/${k.id}/${currentTab}`)}
          >
            <div className="text-sm">{k.name}</div>
            <div className="text-xs text-slate-600 mt-0.5">{k.plot?.name ?? ''}</div>
          </button>
        ))}
      </aside>

      {/* ── Card: keep detail ────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 bg-slate-900 border border-slate-700/60 rounded-lg overflow-hidden">
        {!keepId ? (
          <div className="flex items-center justify-center py-16 text-slate-600 text-sm">
            No keeps — found one to get started.
          </div>
        ) : (
          <KeepDetail keepId={keepId} currentTab={currentTab} onTabChange={(t) => navigate(`/kingdom/${keepId}/${t}`)} qc={qc} {...(empireData ? { empireCreatedAt: empireData.empire.createdAt } : {})} />
        )}
      </div>
    </div>
  );
}

// ── Keep detail ───────────────────────────────────────────────────────────────

function KeepDetail({ keepId, currentTab, onTabChange, qc, empireCreatedAt }: {
  keepId: number;
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
  qc: ReturnType<typeof useQueryClient>;
  empireCreatedAt?: string;
}) {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['keep', keepId],
    queryFn: () => api.keep(keepId),
  });

  if (isError) return <div className="p-6 text-red-400 text-sm">Failed to load keep — check server connection.</div>;
  if (isLoading || !data) return <div className="p-6 text-slate-500 text-sm">Loading…</div>;

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
      <div className="border-b border-slate-700/60 px-6 py-3">
        <div className="flex items-baseline gap-3 mb-2">
          <h1 className="text-lg font-semibold text-slate-100">{keep.name}</h1>
          <span className="text-slate-500 text-sm">{keep.plot?.name ?? ''}</span>
        </div>
        <div className="flex gap-5 text-xs text-slate-500 flex-wrap">
          <span>Workers <span className="text-slate-300 ml-1">{totalWorkers} total · {usedWorkers} used · {freeWorkers} free</span>
            {usedWorkers > totalWorkers && <span className="text-red-400 ml-1">({usedWorkers - totalWorkers} short)</span>}
          </span>
          <span>Storage <span className="text-slate-300 ml-1">{storage.usedWeight} / {storage.maxWeight} kg</span></span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700/60">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`px-5 py-2.5 text-sm transition-colors border-b-2 ${
              currentTab === t.key
                ? 'border-azure-400 text-slate-100'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
            onClick={() => onTabChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {currentTab === 'keep'       && <KeepTab keep={keep} qc={qc} />}
        {currentTab === 'buildings'  && <BuildingsTab keep={keep} keepId={keepId} ledgerMap={ledgerMap} qc={qc} />}
        {currentTab === 'warehouse'  && (
          <WarehousePanel
            locationType="KEEP"
            locationId={keepId}
            warehouseId={keep.warehouseId ?? 0}
            locationLabel={`${keep.name} — Resources`}
            inventory={(keep.warehouse?.items ?? []).filter((e) => e.quantity > 0)}
            onInventoryChange={() => qc.invalidateQueries({ queryKey: ['keep', keepId] })}
            className="h-[480px]"
          />
        )}
        {currentTab === 'production' && <ProductionTab keep={keep} keepId={keepId} ledgerMap={ledgerMap} qc={qc} />}
        {currentTab === 'workers'    && <WorkersTab keep={keep} ledgerMap={ledgerMap} {...(empireCreatedAt ? { empireCreatedAt } : {})} />}
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
    <div className="p-6 max-w-xl">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">Location</div>
        <div className="border border-slate-700 rounded p-4 bg-slate-800 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Plot</span>
            <span className="text-slate-200">{keep.plot?.name ?? '—'}</span>
          </div>
          {keep.plot && (
            <div className="flex justify-between">
              <span className="text-slate-500">Coordinates</span>
              <span className="text-slate-200">({keep.plot.x}, {keep.plot.y})</span>
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">Rename Keep</div>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-slate-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name && rename.mutate()}
          />
          <button
            className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-100 px-4 py-2 rounded text-sm"
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

function BuildingsTab({ keep, keepId, ledgerMap, qc }: {
  keep: { id: number; buildingSlotCount: number; buildings: Array<{ id: number; buildingTypeId: number; level: number; slotIndex: number; isActive: boolean; isDormant: boolean; health: number; workersAssigned: number }> };
  keepId: number;
  ledgerMap: Map<string, number>;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [selectedSlot,   setSelectedSlot]   = useState<number | null>(null);
  const [buildingType,   setBuildingType]   = useState('');
  const [buildError,     setBuildError]     = useState('');
  const [demolishConfirm, setDemolishConfirm] = useState(false);

  const buildingsBySlot = new Map(keep.buildings.map((b) => [b.slotIndex, b]));
  const nextLockedSlot  = keep.buildingSlotCount;
  const unlockNumber    = nextLockedSlot - KEEP_DEFAULT_BUILDING_SLOTS + 1;
  const unlockCost      = unlockNumber;
  const scaffoldingHeld = ledgerMap.get(KEEP_SLOT_UNLOCK_RESOURCE) ?? 0;
  const canAffordUnlock = scaffoldingHeld >= unlockCost && keep.buildingSlotCount < KEEP_MAX_BUILDING_SLOTS;

  const construct = useMutation({
    mutationFn: ({ bType, slot }: { bType: string; slot: number }) => api.buildBuilding(keepId, bType, slot),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['keep', keepId] }); closeModal(); },
    onError:   (err: Error) => setBuildError(err.message),
  });
  const unlockSlot = useMutation({
    mutationFn: () => api.unlockSlot(keepId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['keep', keepId] }); closeModal(); },
  });
  const demolish = useMutation({
    mutationFn: (buildingId: number) => api.demolish(keepId, buildingId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['keep', keepId] }); closeModal(); },
  });
  const repair = useMutation({
    mutationFn: (buildingId: number) => api.repairBuilding(keepId, buildingId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['keep', keepId] }),
  });
  const addToWishlist = useMutation({
    mutationFn: ({ name, items }: { name: string; items: { resourceType: string; quantity: number }[] }) =>
      api.createWishlist(name, items),
  });
  const [wishlistedBuilding, setWishlistedBuilding] = useState<string | null>(null);

  function closeModal() {
    setSelectedSlot(null);
    setBuildingType('');
    setBuildError('');
    setDemolishConfirm(false);
  }

  // Render the correct modal body for the selected slot
  function renderModal() {
    if (selectedSlot === null) return null;
    const building   = buildingsBySlot.get(selectedSlot) ?? null;
    const isUnlocked = selectedSlot < keep.buildingSlotCount;

    // ── Has a building ───────────────────────────────────────────────
    if (building) {
      const btCode = BUILDING_TYPE_BY_ID[building.buildingTypeId] as BuildingType;
      const bName  = BUILDING_NAMES[btCode as keyof typeof BUILDING_NAMES] ?? String(building.buildingTypeId);
      const constCost = BUILDING_CONSTRUCTION_COSTS[btCode as keyof typeof BUILDING_CONSTRUCTION_COSTS] ?? [];
      const missingFraction = Math.max(0, (100 - building.health) / 100);
      const repairCost = constCost
        .map((c) => ({ ...c, quantity: Math.ceil(c.quantity * building.level * missingFraction) }))
        .filter((c) => c.quantity > 0);
      const canAffordRepair = repairCost.every((c) => (ledgerMap.get(c.resource) ?? 0) >= c.quantity);
      const healthColor = building.health > 80 ? 'bg-emerald-600' : building.health > 50 ? 'bg-amber-600' : 'bg-red-500';
      const healthText  = building.health > 80 ? 'text-emerald-400' : building.health > 50 ? 'text-amber-400' : 'text-red-400';

      return (
        <Modal open onClose={closeModal} title={bName} subtitle={`Slot ${selectedSlot + 1} · Level ${building.level}`} size="sm">
          {/* Overview */}
          <ModalSection label="Overview">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>Durability</span>
                  <span className={healthText}>{building.health.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${healthColor}`} style={{ width: `${building.health}%` }} />
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Status</span>
                <span className={building.isDormant ? 'text-red-400' : building.isActive ? 'text-emerald-400' : 'text-slate-400'}>
                  {building.isDormant ? 'Dormant' : building.isActive ? 'Active' : 'Idle'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Workers</span>
                <span className="text-slate-300">{building.workersAssigned} / {building.level * WORKERS_PER_LEVEL}</span>
              </div>
            </div>
          </ModalSection>

          {/* Repair — only shown when health is degraded */}
          {building.health < 100 && (
            <ModalSection label="Repair">
              {repairCost.length === 0 ? (
                <p className="text-xs text-slate-500">No resources needed.</p>
              ) : (
                <div className="space-y-2">
                  {repairCost.map((c) => {
                    const rLabel = RESOURCE_NAMES[c.resource as keyof typeof RESOURCE_NAMES] ?? c.resource;
                    const have   = ledgerMap.get(c.resource) ?? 0;
                    const met    = have >= c.quantity;
                    return (
                      <div key={c.resource} className="flex items-center gap-2 text-xs">
                        <IconSlot size="xs" label={rLabel} />
                        <span className={met ? 'text-slate-200' : 'text-red-400'}>{c.quantity} {rLabel}</span>
                        <span className="text-slate-600 ml-auto">{Math.floor(have)} held</span>
                      </div>
                    );
                  })}
                  {repair.isError && <p className="text-red-400 text-xs">{(repair.error as Error).message}</p>}
                  <Button
                    variant="primary" size="sm" className="w-full mt-1"
                    disabled={!canAffordRepair || repair.isPending}
                    onClick={() => repair.mutate(building.id)}
                  >
                    {repair.isPending ? 'Repairing…' : 'Repair to 100%'}
                  </Button>
                </div>
              )}
            </ModalSection>
          )}

          {/* Upgrade placeholder */}
          <ModalSection label="Upgrade">
            <p className="text-xs text-slate-600 italic">Upgrade system coming soon.</p>
          </ModalSection>

          {/* Demolish */}
          <ModalSection label="Demolish">
            {demolishConfirm ? (
              <div className="space-y-2">
                <p className="text-xs text-red-400">This will permanently destroy the building. Resources are not returned.</p>
                <div className="flex gap-2 items-center">
                  <Button
                    variant="danger" size="sm"
                    disabled={demolish.isPending}
                    onClick={() => demolish.mutate(building.id)}
                  >
                    {demolish.isPending ? 'Demolishing…' : 'Confirm'}
                  </Button>
                  <button className="text-xs text-slate-500 hover:text-slate-300 transition-colors" onClick={() => setDemolishConfirm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <Button variant="danger" size="sm" onClick={() => setDemolishConfirm(true)}>
                Demolish Building
              </Button>
            )}
          </ModalSection>
        </Modal>
      );
    }

    // ── Locked slot ──────────────────────────────────────────────────
    if (!isUnlocked) {
      const isNext = selectedSlot === nextLockedSlot;
      return (
        <Modal open onClose={closeModal} title="Locked Slot" subtitle={`Slot ${selectedSlot + 1}`} size="sm">
          <ModalSection>
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                {isNext
                  ? 'Unlock this slot to construct a building here.'
                  : `Slot ${nextLockedSlot + 1} must be unlocked first.`}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <IconSlot size="xs" label={RESOURCE_NAMES[KEEP_SLOT_UNLOCK_RESOURCE as keyof typeof RESOURCE_NAMES] ?? KEEP_SLOT_UNLOCK_RESOURCE} />
                <span className={scaffoldingHeld >= unlockCost ? 'text-slate-200' : 'text-red-400'}>
                  {unlockCost} {RESOURCE_NAMES[KEEP_SLOT_UNLOCK_RESOURCE as keyof typeof RESOURCE_NAMES]}
                </span>
                <span className="text-slate-600 ml-auto">{Math.floor(scaffoldingHeld)} held</span>
              </div>
              {unlockSlot.isError && <p className="text-red-400 text-xs">{(unlockSlot.error as Error).message}</p>}
              <Button
                variant="primary" size="md" className="w-full"
                disabled={!canAffordUnlock || unlockSlot.isPending || !isNext}
                onClick={() => unlockSlot.mutate()}
              >
                {unlockSlot.isPending ? 'Unlocking…' : 'Unlock Slot'}
              </Button>
            </div>
          </ModalSection>
        </Modal>
      );
    }

    // ── Empty unlocked slot ──────────────────────────────────────────
    return (
      <Modal open onClose={closeModal} title={`Slot ${selectedSlot + 1}`} subtitle="Choose a building to construct" size="lg">
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.keys(BUILDING_NAMES).map((bt) => {
            const bName  = BUILDING_NAMES[bt as keyof typeof BUILDING_NAMES];
            const costs  = BUILDING_CONSTRUCTION_COSTS[bt as keyof typeof BUILDING_CONSTRUCTION_COSTS] ?? [];
            const allMet = costs.every((c) => (ledgerMap.get(c.resource) ?? 0) >= c.quantity);
            return (
              <div
                key={bt}
                className={`rounded-lg border p-3.5 flex flex-col gap-3 transition-colors ${
                  allMet
                    ? 'border-slate-600 bg-slate-800/60 hover:border-slate-500 hover:bg-slate-800'
                    : 'border-slate-700/60 bg-slate-800/30'
                }`}
              >
                {/* Header */}
                <div className="flex items-center gap-2.5">
                  <IconSlot size="sm" label={bName} />
                  <span className="text-sm text-slate-200 font-medium flex-1">{bName}</span>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${allMet ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                </div>

                {/* Cost breakdown — always visible */}
                <div className="space-y-1.5">
                  {costs.length === 0 && <span className="text-xs text-slate-600">No materials required</span>}
                  {costs.map((c) => {
                    const rLabel = RESOURCE_NAMES[c.resource as keyof typeof RESOURCE_NAMES] ?? c.resource;
                    const have   = ledgerMap.get(c.resource) ?? 0;
                    const met    = have >= c.quantity;
                    return (
                      <div key={c.resource} className="flex items-center gap-2 text-xs">
                        <IconSlot size="xs" label={rLabel} />
                        <span className={met ? 'text-slate-200' : 'text-red-400'}>{c.quantity} {rLabel}</span>
                        <span className="text-slate-600 ml-auto tabular-nums">{Math.floor(have)} held</span>
                      </div>
                    );
                  })}
                </div>

                {/* Build button — always visible */}
                {buildError && buildingType === bt && <p className="text-red-400 text-xs">{buildError}</p>}
                <div className="flex flex-col gap-1.5 mt-auto">
                  <Button
                    variant="primary" size="sm" className="w-full"
                    disabled={!allMet || construct.isPending}
                    onClick={() => { setBuildingType(bt); construct.mutate({ bType: bt, slot: selectedSlot! }); }}
                  >
                    {construct.isPending && buildingType === bt ? 'Building…' : `Build ${bName}`}
                  </Button>
                  {!allMet && (
                    <button
                      onClick={() => {
                        const shortfall = costs
                          .filter((c) => (ledgerMap.get(c.resource) ?? 0) < c.quantity)
                          .map((c) => ({
                            resourceType: c.resource,
                            quantity: c.quantity - Math.floor(ledgerMap.get(c.resource) ?? 0),
                          }));
                        addToWishlist.mutate({ name: `Build ${bName}`, items: shortfall });
                        setWishlistedBuilding(bt);
                        setTimeout(() => setWishlistedBuilding(null), 2000);
                      }}
                      disabled={addToWishlist.isPending && wishlistedBuilding === bt}
                      className="w-full text-xs text-slate-500 hover:text-azure-300 transition-colors py-0.5 text-center"
                    >
                      {wishlistedBuilding === bt ? '✓ Added to wishlists' : '☆ Add to Wishlist'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    );
  }

  return (
    <div className="p-4 h-full flex flex-col gap-3">
      {/* 24-slot grid — 4 cols mobile, 6 cols sm+ */}
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {Array.from({ length: KEEP_MAX_BUILDING_SLOTS }, (_, i) => {
          const building   = buildingsBySlot.get(i);
          const isUnlocked = i < keep.buildingSlotCount;

          // ── Locked slot (uniform appearance) ──
          if (!isUnlocked) {
            return (
              <button
                key={i}
                onClick={() => setSelectedSlot(i)}
                className="border border-slate-800 rounded-lg bg-slate-900/20 min-h-[72px] flex items-center justify-center hover:border-slate-700 hover:bg-slate-900/40 transition-colors opacity-40 hover:opacity-60"
                title="Locked"
              >
                <span className="text-slate-600 text-base">🔒</span>
              </button>
            );
          }

          // ── Empty unlocked slot ──
          if (!building) {
            return (
              <button
                key={i}
                onClick={() => setSelectedSlot(i)}
                className="border border-slate-700 border-dashed rounded-lg bg-slate-800/20 min-h-[72px] flex items-center justify-center hover:border-slate-600 hover:bg-slate-800/40 transition-colors"
                title={`Slot ${i + 1} — empty`}
              >
                <span className="text-slate-700 text-xl leading-none">+</span>
              </button>
            );
          }

          // ── Occupied slot ──
          const btCode = BUILDING_TYPE_BY_ID[building.buildingTypeId] as BuildingType;
          const bName  = BUILDING_NAMES[btCode as keyof typeof BUILDING_NAMES] ?? String(building.buildingTypeId);
          const healthColor = building.health > 80 ? 'bg-emerald-600' : building.health > 50 ? 'bg-amber-500' : 'bg-red-500';

          return (
            <button
              key={i}
              onClick={() => setSelectedSlot(i)}
              className="border border-slate-600 rounded-lg bg-slate-800 hover:bg-slate-700 hover:border-slate-500 min-h-[72px] p-2 flex flex-col gap-1 text-left transition-all"
            >
              <div className="flex items-start gap-1.5">
                <IconSlot size="xs" label={bName} className="flex-shrink-0 mt-px" />
                <span className="text-xs text-slate-200 font-medium leading-tight line-clamp-2 flex-1">{bName}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-auto">
                <span className="text-[10px] text-slate-600">Lv.{building.level}</span>
                {building.isDormant && <Badge variant="error" className="text-[10px] px-1 py-0 leading-tight">D</Badge>}
              </div>
              <div className="h-0.5 bg-slate-700 rounded-full overflow-hidden w-full">
                <div className={`h-full rounded-full transition-all ${healthColor}`} style={{ width: `${building.health}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Slot counter */}
      <div className="text-xs text-slate-700">
        {keep.buildingSlotCount} / {KEEP_MAX_BUILDING_SLOTS} slots unlocked
      </div>

      {renderModal()}
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
      <div className="flex justify-between text-xs text-slate-600 mt-0.5">
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

  const color = efficiency < 70 ? 'text-red-400' : efficiency < 100 ? 'text-azure-400' : efficiency > 100 ? 'text-green-400' : 'text-slate-400';

  return (
    <div className="flex items-center justify-between mb-4 px-3 py-2 border border-slate-800 rounded bg-slate-900/50 text-sm">
      <span className="text-slate-500">Production rate</span>
      <div className="flex items-center gap-3">
        {hints.length > 0 && (
          <span className="text-xs text-slate-600">{hints.join(' · ')}</span>
        )}
        <span className={`font-mono font-semibold ${color}`}>{efficiency}%</span>
      </div>
    </div>
  );
}

function ProductionTab({ keep, keepId, ledgerMap, qc }: {
  keep: {
    buildings: Array<{ buildingTypeId: number; level: number; isActive: boolean; productionTask: ProductionTask | null }>;
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
    return <div className="p-6 text-slate-600 text-sm">No production buildings — construct one in the Buildings tab.</div>;
  }

  return (
    <div className="p-4">
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
            <div key={bTypeId} className="border border-slate-700 rounded bg-slate-800">
              <button
                className="w-full flex flex-col px-4 py-3 hover:bg-slate-700/30 transition-colors text-left"
                onClick={() => { setExpandedType(isOpen ? null : bTypeId); setRecipeKey(''); setTargetQty(''); setOrderType('INFINITE'); }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <IconSlot size="xs" label={bTypeCode ? (BUILDING_NAMES[bTypeCode as keyof typeof BUILDING_NAMES] ?? bTypeCode) : String(bTypeId)} />
                    <span className="text-sm text-slate-200">{bTypeCode ? (BUILDING_NAMES[bTypeCode as keyof typeof BUILDING_NAMES] ?? bTypeCode) : String(bTypeId)}</span>
                    {activeRecipe && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span>→</span>
                        <IconSlot size="xs" label={RESOURCE_NAMES[activeRecipe.output as keyof typeof RESOURCE_NAMES] ?? activeRecipe.output} />
                        <span>{RESOURCE_NAMES[activeRecipe.output as keyof typeof RESOURCE_NAMES] ?? activeRecipe.output}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-slate-600 text-xs">{isOpen ? '▲' : '▼'}</span>
                </div>
                {activeRecipe && (
                  <BuildingProgressBar task={activeTask} />
                )}
              </button>

              {isOpen && (
                <div className="border-t border-slate-700 px-4 py-3">
                  {orders.length === 0 ? (
                    <p className="text-slate-600 text-xs mb-3">No orders.</p>
                  ) : (
                    <div className="space-y-1.5 mb-3">
                      {orders.map((order) => (
                        <div key={order.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">{RECIPE_BY_ID[order.recipeId] ?? String(order.recipeId)}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded bg-slate-700 ${order.orderType === 'INFINITE' ? 'text-slate-400' : 'text-azure-400'}`}>
                              {order.orderType === 'INFINITE' ? '∞' : `${order.producedQuantity.toFixed(0)}/${order.targetQuantity}`}
                            </span>
                          </div>
                          <button onClick={() => removeOrder.mutate(order.id)} className="text-slate-600 hover:text-red-400 text-xs ml-3">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-slate-700/60 pt-3">
                    <select
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm mb-2 focus:outline-none"
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
                          className={`flex-1 py-1.5 rounded text-xs border transition-colors ${orderType === t ? 'border-slate-500 text-slate-200' : 'border-slate-700 text-slate-500 hover:border-slate-600'}`}
                          onClick={() => setOrderType(t)}
                        >
                          {t === 'INFINITE' ? '∞ Infinite' : '# Quantity'}
                        </button>
                      ))}
                    </div>
                    {orderType === 'NUMERICAL' && (
                      <input
                        type="number"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm mb-2 focus:outline-none"
                        placeholder="Target quantity..."
                        value={targetQty}
                        onChange={(e) => setTargetQty(e.target.value)}
                      />
                    )}
                    <button
                      className="bg-azure-500 hover:bg-azure-400 disabled:opacity-40 text-white font-semibold px-4 py-1.5 rounded text-sm"
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

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return h > 0 ? `${h}h ${rem}m` : `${m}m`;
}

function WorkersTab({ keep, ledgerMap, empireCreatedAt }: {
  keep: { buildings: Array<{ buildingTypeId: number; level: number; isActive: boolean }> };
  ledgerMap: Map<string, number>;
  empireCreatedAt?: string;
}) {
  const ageDays = empireCreatedAt
    ? (Date.now() - new Date(empireCreatedAt).getTime()) / 86_400_000
    : 0;
  const speedMultiplier = getStarterSpeedMultiplier(ageDays);
  const effectiveCycleSeconds = BASE_CYCLE_SECONDS / speedMultiplier;
  const cycleLabel = formatDuration(effectiveCycleSeconds);
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
    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

      {/* Worker pool */}
      <div>
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">Worker Pool</div>
        <div className="border border-slate-700 rounded bg-slate-800 divide-y divide-slate-700/60 text-sm">
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-slate-400">Total (from Housing)</span>
            <span className="text-slate-200 font-mono">{totalWorkers}</span>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-slate-400">Employed</span>
            <span className={`font-mono ${usedWorkers > totalWorkers ? 'text-red-400' : 'text-slate-200'}`}>{usedWorkers}</span>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-slate-400">Idle</span>
            <span className="text-slate-400 font-mono">{freeWorkers}</span>
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
          <div className="text-xs uppercase tracking-wider text-slate-500">T1 Labourer Consumption</div>
          <div className="text-xs text-slate-600">per {cycleLabel} cycle · {totalWorkers} workers</div>
        </div>

        {totalWorkers === 0 ? (
          <p className="text-slate-600 text-sm">No workers — build Housing to house labourers.</p>
        ) : (
          <>
            <div className="text-xs text-slate-600 uppercase tracking-wider mb-1.5">Required</div>
            <div className="border border-slate-700 rounded bg-slate-800 divide-y divide-slate-700/60 mb-4">
              {needs.filter((n) => n.isNecessary).map((n) => (
                <NeedRow key={n.resourceType} resourceType={n.resourceType} needed={n.needed} held={n.held} isMet={n.isMet} tag={n.isMet ? null : { label: '−15% speed', color: 'red' }} />
              ))}
            </div>

            <div className="text-xs text-slate-600 uppercase tracking-wider mb-1.5">Optional</div>
            <div className="border border-slate-700 rounded bg-slate-800 divide-y divide-slate-700/60 mb-4">
              {needs.filter((n) => !n.isNecessary).map((n) => (
                <NeedRow key={n.resourceType} resourceType={n.resourceType} needed={n.needed} held={n.held} isMet={n.isMet} tag={n.isMet ? { label: '+5% speed', color: 'green' } : null} />
              ))}
            </div>

            {/* Speed modifier summary */}
            <div className="border border-slate-700 rounded p-3 bg-slate-800/50 flex items-center justify-between text-sm">
              <span className="text-slate-500">Production speed modifier</span>
              <div className="flex items-center gap-3">
                {unmetRequired.length > 0 && (
                  <span className="text-xs text-slate-600">{unmetRequired.length} missing × −15%</span>
                )}
                {metOptional.length > 0 && (
                  <span className="text-xs text-slate-600">{metOptional.length} bonus × +5%</span>
                )}
                <span className={`font-mono font-semibold ${speedPct < 100 ? 'text-red-400' : speedPct > 100 ? 'text-green-400' : 'text-slate-400'}`}>
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
        <IconSlot size="xs" label={RESOURCE_NAMES[resourceType as keyof typeof RESOURCE_NAMES] ?? resourceType} />
        <span className={isMet ? 'text-slate-300' : 'text-red-400'}>
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
        <span className={held < needed ? 'text-red-400' : 'text-slate-400'}>{Math.floor(held)}</span>
        <span className="text-slate-600"> / {needed % 1 === 0 ? needed : needed.toFixed(1)} needed</span>
      </div>
    </div>
  );
}
