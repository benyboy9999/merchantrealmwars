import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../services/api.js';
import { BUILDING_NAMES, RESOURCE_NAMES } from '@artemis/shared';
import { RECIPES_BY_BUILDING } from '@artemis/engine';

export default function BuildingPage() {
  const { keepId, buildingId } = useParams<{ keepId: string; buildingId: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [recipeKey, setRecipeKey] = useState('');
  const [orderType, setOrderType] = useState<'INFINITE' | 'NUMERICAL'>('INFINITE');
  const [targetQty, setTargetQty] = useState('');

  const { data: keepData } = useQuery({
    queryKey: ['keep', keepId],
    queryFn: () => api.keep(keepId!),
    refetchInterval: 5000,
  });

  const building = keepData?.keep.buildings.find((b) => b.id === buildingId);
  const buildingType = building?.buildingType ?? '';

  const { data: queueData } = useQuery({
    queryKey: ['queue', keepId, buildingType],
    queryFn: () => api.queue(keepId!, buildingType),
    enabled: !!buildingType,
    refetchInterval: 5000,
  });

  const addOrder = useMutation({
    mutationFn: () => api.addOrder(keepId!, buildingType, {
      recipeKey,
      orderType,
      targetQuantity: orderType === 'NUMERICAL' ? Number(targetQty) : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['queue', keepId, buildingType] }); setRecipeKey(''); setTargetQty(''); },
  });

  const removeOrder = useMutation({
    mutationFn: (orderId: string) => api.removeOrder(keepId!, orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queue', keepId, buildingType] }),
  });

  const setWorkers = useMutation({
    mutationFn: (count: number) => api.setWorkers(keepId!, buildingId!, count),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['keep', keepId] }),
  });

  const demolish = useMutation({
    mutationFn: () => api.demolish(keepId!, buildingId!),
    onSuccess: () => navigate(`/keeps/${keepId}`),
  });

  if (!building) return <div className="p-8 text-parchment-200">Loading building...</div>;

  const recipes = RECIPES_BY_BUILDING[buildingType] ?? [];
  const orders = queueData?.orders ?? [];

  return (
    <div className="p-8 max-w-2xl">
      <button onClick={() => navigate(`/keeps/${keepId}`)} className="text-stone-400 hover:text-parchment-200 text-sm mb-4">← Keep</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gold-400">
            {BUILDING_NAMES[buildingType as keyof typeof BUILDING_NAMES] ?? buildingType}
          </h1>
          <div className="text-stone-400 text-sm mt-1">
            Level {building.level} · {building.health.toFixed(0)}% health
            {building.isDormant && <span className="text-red-400 ml-2">DORMANT</span>}
          </div>
        </div>
        <button
          onClick={() => demolish.mutate()}
          className="text-red-500 hover:text-red-400 text-sm border border-red-800 hover:border-red-600 px-3 py-1 rounded"
        >
          Demolish
        </button>
      </div>

      {/* Workers */}
      <div className="mb-6 border border-stone-700 rounded-lg p-4 bg-stone-800">
        <div className="text-parchment-200 font-medium mb-2">Workers: {building.workersAssigned}</div>
        <div className="flex gap-2">
          {[0, 1, 2, 5, 10].map((n) => (
            <button
              key={n}
              onClick={() => setWorkers.mutate(n)}
              className={`px-3 py-1 rounded text-sm border ${building.workersAssigned === n ? 'border-gold-500 text-gold-400' : 'border-stone-600 text-stone-400 hover:border-stone-400'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Production queue */}
      <div className="mb-6">
        <h2 className="text-parchment-100 font-semibold mb-3">Production Queue</h2>

        {orders.length === 0 ? (
          <p className="text-stone-500 text-sm mb-4">No orders queued. Add one below.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {orders.map((order) => (
              <div key={order.id} className="flex items-center justify-between bg-stone-800 border border-stone-700 rounded px-3 py-2">
                <div>
                  <span className="text-parchment-200 text-sm">{order.recipeKey}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded ${order.orderType === 'INFINITE' ? 'bg-blue-900 text-blue-300' : 'bg-amber-900 text-amber-300'}`}>
                    {order.orderType === 'INFINITE' ? '∞' : `${order.producedQuantity.toFixed(0)} / ${order.targetQuantity}`}
                  </span>
                </div>
                <button
                  onClick={() => removeOrder.mutate(order.id)}
                  className="text-stone-500 hover:text-red-400 text-xs ml-4"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add order form */}
        {recipes.length > 0 && (
          <div className="border border-stone-700 rounded-lg p-4 bg-stone-900">
            <div className="text-stone-400 text-sm font-medium mb-3">Add order</div>
            <select
              className="w-full bg-stone-800 border border-stone-600 rounded px-3 py-2 text-parchment-100 text-sm mb-3"
              value={recipeKey}
              onChange={(e) => setRecipeKey(e.target.value)}
            >
              <option value="">Select recipe...</option>
              {recipes.map((r) => (
                <option key={r.key} value={r.key}>
                  {RESOURCE_NAMES[r.output as keyof typeof RESOURCE_NAMES] ?? r.output} ×{r.outputQty}
                  {r.inputs.length > 0 && ` (needs ${r.inputs.map((i) => `${i.quantity} ${RESOURCE_NAMES[i.resource as keyof typeof RESOURCE_NAMES] ?? i.resource}`).join(', ')})`}
                </option>
              ))}
            </select>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setOrderType('INFINITE')}
                className={`flex-1 py-1.5 rounded text-sm border ${orderType === 'INFINITE' ? 'border-blue-500 text-blue-400' : 'border-stone-600 text-stone-400'}`}
              >
                ∞ Infinite
              </button>
              <button
                onClick={() => setOrderType('NUMERICAL')}
                className={`flex-1 py-1.5 rounded text-sm border ${orderType === 'NUMERICAL' ? 'border-amber-500 text-amber-400' : 'border-stone-600 text-stone-400'}`}
              >
                # Quantity
              </button>
            </div>
            {orderType === 'NUMERICAL' && (
              <input
                type="number"
                className="w-full bg-stone-800 border border-stone-600 rounded px-3 py-2 text-parchment-100 text-sm mb-3"
                placeholder="Target quantity..."
                value={targetQty}
                onChange={(e) => setTargetQty(e.target.value)}
              />
            )}
            <button
              className="bg-gold-600 hover:bg-gold-500 text-stone-900 font-semibold px-4 py-2 rounded text-sm w-full"
              onClick={() => recipeKey && addOrder.mutate()}
              disabled={!recipeKey || (orderType === 'NUMERICAL' && !targetQty)}
            >
              Add to Queue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
