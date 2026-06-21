import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../services/api.js';
import {
  BUILDING_NAMES, RESOURCE_NAMES, RESOURCE_WEIGHT,
  RECIPES_BY_BUILDING, BUILDING_CONSTRUCTION_COSTS,
  HOUSING_BASE_CAPACITY, WORKERS_PER_LEVEL,
} from '@merchant-realms/shared';
import type { Recipe, RecipeInput } from '@merchant-realms/shared';

export default function KeepPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Build dialog state
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [buildingType, setBuildingType] = useState('');
  const [buildError, setBuildError] = useState('');

  // Production panel state
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [recipeKey, setRecipeKey] = useState('');
  const [orderType, setOrderType] = useState<'INFINITE' | 'NUMERICAL'>('INFINITE');
  const [targetQty, setTargetQty] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['keep', id],
    queryFn: () => api.keep(id!),
    refetchInterval: 5000,
  });

  const construct = useMutation({
    mutationFn: ({ bType, slot }: { bType: string; slot: number }) =>
      api.buildBuilding(id!, bType, slot),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['keep', id] });
      setSelectedSlot(null);
      setBuildingType('');
      setBuildError('');
    },
    onError: (err: Error) => setBuildError(err.message),
  });

  const addOrder = useMutation({
    mutationFn: (bType: string) => api.addOrder(id!, bType, {
      recipeKey,
      orderType,
      ...(orderType === 'NUMERICAL' ? { targetQuantity: Number(targetQty) } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['keep', id] });
      setRecipeKey('');
      setTargetQty('');
    },
  });

  const removeOrder = useMutation({
    mutationFn: (orderId: string) => api.removeOrder(id!, orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['keep', id] }),
  });

  if (isLoading || !data) return <div className="p-8 text-stone-400 text-sm">Loading...</div>;
  if (isError) return <div className="p-8 text-red-400 text-sm">Failed to load keep: {error instanceof Error ? error.message : 'Unknown error'}</div>;

  const { keep, storage, goldBalance } = data;
  const slotCount = keep.buildingSlotCount;
  const buildingsBySlot = new Map(keep.buildings.map((b) => [b.slotIndex, b]));
  const ledgerMap = new Map(keep.resourceLedger.map((e) => [e.resourceType, e.quantity]));

  // Storage
  const weightPct = Math.min(100, (storage.usedWeight / storage.maxWeight) * 100);

  // Worker pool
  const totalWorkers = keep.buildings
    .filter((b) => b.buildingType === 'HOUSING' && b.isActive)
    .reduce((sum, b) => sum + b.level * HOUSING_BASE_CAPACITY, 0);
  const usedWorkers = keep.buildings
    .filter((b) => b.buildingType !== 'HOUSING' && b.buildingType !== 'WAREHOUSE' && b.isActive)
    .reduce((sum, b) => sum + b.level * WORKERS_PER_LEVEL, 0);
  const freeWorkers = Math.max(0, totalWorkers - usedWorkers);
  const workerShortfall = Math.max(0, usedWorkers - totalWorkers);

  // Construction cost display helper
  const costs = buildingType
    ? (BUILDING_CONSTRUCTION_COSTS[buildingType as keyof typeof BUILDING_CONSTRUCTION_COSTS] ?? [])
    : [];
  const canAfford = costs.every((c) => (ledgerMap.get(c.resource) ?? 0) >= c.quantity);

  // Production panel: unique production building types built
  const prodBuildings = keep.buildings.filter((b) => b.buildingType !== 'HOUSING' && b.buildingType !== 'WAREHOUSE');
  const prodTypes = [...new Set(prodBuildings.map((b) => b.buildingType))];
  const ordersByType = new Map<string, typeof keep.productionOrders>();
  for (const order of keep.productionOrders) {
    if (!ordersByType.has(order.buildingType)) ordersByType.set(order.buildingType, []);
    ordersByType.get(order.buildingType)!.push(order);
  }

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={() => navigate('/')} className="text-stone-500 hover:text-stone-300 text-xs mb-5 flex items-center gap-1">← Map</button>

      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-xl font-semibold text-parchment-100">{keep.name}</h1>
        <span className="text-stone-500 text-sm">{keep.plot?.name ?? 'Central Region'}</span>
      </div>

      {/* Stats row */}
      <div className="flex gap-6 text-sm mt-3 mb-6 flex-wrap">
        <div>
          <span className="text-stone-500 text-xs uppercase tracking-wider mr-2">Gold</span>
          <span className="text-gold-400 font-mono">{goldBalance.toFixed(0)}g</span>
        </div>
        <div>
          <span className="text-stone-500 text-xs uppercase tracking-wider mr-2">Workers</span>
          <span className="text-parchment-200">{totalWorkers} total</span>
          <span className="text-stone-600 mx-1.5">·</span>
          <span className={usedWorkers > totalWorkers ? 'text-red-400' : 'text-stone-400'}>{usedWorkers} used</span>
          <span className="text-stone-600 mx-1.5">·</span>
          <span className={freeWorkers === 0 && totalWorkers > 0 ? 'text-stone-500' : 'text-stone-400'}>{freeWorkers} free</span>
          {workerShortfall > 0 && <span className="ml-2 text-xs text-red-400">({workerShortfall} short — production reduced)</span>}
        </div>
        </div>

      {/* Storage bar */}
      <div className="mb-7">
        <div className="flex justify-between text-xs text-stone-500 mb-1">
          <span>Storage</span>
          <span>{storage.usedWeight} / {storage.maxWeight} kg</span>
        </div>
        <div className="h-1 bg-stone-700 rounded">
          <div className="h-1 rounded bg-stone-500" style={{ width: `${weightPct}%` }} />
        </div>
      </div>

      {/* Building slots */}
      <div className="mb-2">
        <h2 className="text-xs uppercase tracking-wider text-stone-500 mb-3">Building Slots</h2>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {Array.from({ length: slotCount }, (_, i) => {
            const building = buildingsBySlot.get(i);
            return (
              <div
                key={i}
                className={`border rounded p-3 min-h-[80px] cursor-pointer transition-colors ${
                  building
                    ? 'border-stone-600 bg-stone-800 hover:bg-stone-700'
                    : selectedSlot === i
                      ? 'border-stone-500 bg-stone-800'
                      : 'border-stone-700 border-dashed bg-stone-800/30 hover:border-stone-600'
                }`}
                onClick={() => building ? navigate(`/keeps/${id}/buildings/${building.id}`) : setSelectedSlot(i === selectedSlot ? null : i)}
              >
                {building ? (
                  <>
                    <div className="text-sm text-parchment-200">
                      {BUILDING_NAMES[building.buildingType as keyof typeof BUILDING_NAMES] ?? building.buildingType}
                    </div>
                    <div className="text-xs text-stone-500 mt-1">Lv.{building.level}</div>
                    {building.isDormant && <div className="text-xs text-red-500 mt-0.5">Dormant</div>}
                  </>
                ) : (
                  <div className="text-stone-700 text-xs text-center pt-4">Slot {i + 1}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Build dialog */}
        {selectedSlot !== null && (
          <div className="mb-6 border border-stone-700 rounded p-4 bg-stone-800 max-w-sm">
            <div className="text-xs uppercase tracking-wider text-stone-500 mb-3">Construct in Slot {selectedSlot + 1}</div>
            <select
              className="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-parchment-100 text-sm mb-3 focus:outline-none focus:border-stone-500"
              value={buildingType}
              onChange={(e) => { setBuildingType(e.target.value); setBuildError(''); }}
            >
              <option value="">Select building...</option>
              {Object.keys(BUILDING_NAMES).map((bt) => (
                <option key={bt} value={bt}>{BUILDING_NAMES[bt as keyof typeof BUILDING_NAMES]}</option>
              ))}
            </select>

            {buildingType && costs.length > 0 && (
              <div className="mb-3 text-xs text-stone-400">
                Cost:{' '}
                {costs.map((c, idx) => {
                  const have = ledgerMap.get(c.resource) ?? 0;
                  const ok = have >= c.quantity;
                  return (
                    <span key={c.resource}>
                      {idx > 0 && <span className="text-stone-600"> + </span>}
                      <span className={ok ? 'text-parchment-200' : 'text-red-400'}>
                        {c.quantity} {RESOURCE_NAMES[c.resource as keyof typeof RESOURCE_NAMES] ?? c.resource}
                      </span>
                      <span className="text-stone-600"> ({Math.floor(have)} held)</span>
                    </span>
                  );
                })}
              </div>
            )}

            {buildError && <div className="text-red-400 text-xs mb-3">{buildError}</div>}

            <div className="flex gap-2">
              <button
                className="bg-gold-600 hover:bg-gold-500 disabled:opacity-40 text-stone-900 font-semibold px-4 py-1.5 rounded text-sm"
                disabled={!buildingType || !canAfford || construct.isPending}
                onClick={() => buildingType && construct.mutate({ bType: buildingType, slot: selectedSlot })}
              >
                Build
              </button>
              <button className="text-stone-500 hover:text-stone-300 text-sm" onClick={() => { setSelectedSlot(null); setBuildError(''); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Resources */}
      <div className="mb-8">
        <h2 className="text-xs uppercase tracking-wider text-stone-500 mb-3">Resources</h2>
        {keep.resourceLedger.filter((e) => e.quantity > 0).length === 0 ? (
          <p className="text-stone-600 text-sm">No resources yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-0.5 max-w-md">
            {keep.resourceLedger
              .filter((e) => e.quantity > 0)
              .sort((a, b) => b.quantity - a.quantity)
              .map((entry) => (
                <div key={entry.id} className="flex justify-between text-sm py-1 border-b border-stone-800/80">
                  <span className="text-stone-400">{RESOURCE_NAMES[entry.resourceType as keyof typeof RESOURCE_NAMES] ?? entry.resourceType}</span>
                  <span className="text-parchment-200 font-mono tabular-nums">{entry.quantity.toFixed(0)}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Production */}
      {prodTypes.length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-wider text-stone-500 mb-3">Production</h2>
          <div className="space-y-1">
            {prodTypes.map((bType) => {
              const recipes = RECIPES_BY_BUILDING[bType] ?? [];
              if (recipes.length === 0) return null;
              const orders = ordersByType.get(bType) ?? [];
              const isOpen = expandedType === bType;

              return (
                <div key={bType} className="border border-stone-700 rounded bg-stone-800">
                  {/* Header row */}
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-700/30 transition-colors"
                    onClick={() => {
                      setExpandedType(isOpen ? null : bType);
                      setRecipeKey('');
                      setTargetQty('');
                      setOrderType('INFINITE');
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-parchment-200">
                        {BUILDING_NAMES[bType as keyof typeof BUILDING_NAMES] ?? bType}
                      </span>
                      {orders.length > 0 && (
                        <span className="text-xs text-stone-500">{orders.length} order{orders.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <span className="text-stone-600 text-xs">{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {/* Expanded panel */}
                  {isOpen && (
                    <div className="border-t border-stone-700 px-4 py-3">
                      {/* Active orders */}
                      {orders.length === 0 ? (
                        <p className="text-stone-600 text-xs mb-3">No orders — add one below.</p>
                      ) : (
                        <div className="space-y-1.5 mb-3">
                          {orders.map((order) => (
                            <div key={order.id} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-stone-400">{order.recipeKey}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${order.orderType === 'INFINITE' ? 'bg-stone-700 text-stone-400' : 'bg-stone-700 text-amber-400'}`}>
                                  {order.orderType === 'INFINITE' ? '∞' : `${order.producedQuantity.toFixed(0)}/${order.targetQuantity}`}
                                </span>
                              </div>
                              <button
                                onClick={() => removeOrder.mutate(order.id)}
                                className="text-stone-600 hover:text-red-400 text-xs ml-3"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add order form */}
                      <div className="border-t border-stone-700/60 pt-3">
                        <select
                          className="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-parchment-100 text-sm mb-2 focus:outline-none focus:border-stone-600"
                          value={recipeKey}
                          onChange={(e) => setRecipeKey(e.target.value)}
                        >
                          <option value="">Select recipe...</option>
                          {recipes.map((r: Recipe) => (
                            <option key={r.key} value={r.key}>
                              {RESOURCE_NAMES[r.output as keyof typeof RESOURCE_NAMES] ?? r.output} ×{r.outputQty}
                              {r.inputs.length > 0
                                ? ` — needs ${r.inputs.map((i: RecipeInput) => `${i.quantity} ${RESOURCE_NAMES[i.resource as keyof typeof RESOURCE_NAMES] ?? i.resource}`).join(', ')}`
                                : ''}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2 mb-2">
                          <button
                            onClick={() => setOrderType('INFINITE')}
                            className={`flex-1 py-1.5 rounded text-xs border transition-colors ${orderType === 'INFINITE' ? 'border-stone-500 text-parchment-200' : 'border-stone-700 text-stone-500 hover:border-stone-600'}`}
                          >
                            ∞ Infinite
                          </button>
                          <button
                            onClick={() => setOrderType('NUMERICAL')}
                            className={`flex-1 py-1.5 rounded text-xs border transition-colors ${orderType === 'NUMERICAL' ? 'border-stone-500 text-parchment-200' : 'border-stone-700 text-stone-500 hover:border-stone-600'}`}
                          >
                            # Quantity
                          </button>
                        </div>
                        {orderType === 'NUMERICAL' && (
                          <input
                            type="number"
                            className="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-parchment-100 text-sm mb-2 focus:outline-none focus:border-stone-600"
                            placeholder="Target quantity..."
                            value={targetQty}
                            onChange={(e) => setTargetQty(e.target.value)}
                          />
                        )}
                        <button
                          className="bg-gold-600 hover:bg-gold-500 disabled:opacity-40 text-stone-900 font-semibold px-4 py-1.5 rounded text-sm"
                          disabled={!recipeKey || (orderType === 'NUMERICAL' && !targetQty) || addOrder.isPending}
                          onClick={() => recipeKey && addOrder.mutate(bType)}
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
      )}
    </div>
  );
}
