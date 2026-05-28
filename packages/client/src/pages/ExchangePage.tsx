import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../services/api.js';
import { RESOURCE_NAMES } from '@artemis/shared';

export default function ExchangePage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');
  const [fillQty, setFillQty] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.orders('CENTRAL'),
    refetchInterval: 5000,
  });

  const fill = useMutation({
    mutationFn: ({ orderId, qty }: { orderId: string; qty: number }) => api.fillOrder(orderId, qty),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });

  const orders = (data?.orders ?? []).filter((o) => {
    if (filter) return o.resourceType.toLowerCase().includes(filter.toLowerCase());
    return true;
  });

  const sellOrders = orders.filter((o) => o.orderType === 'SELL' && o.status !== 'CANCELLED');

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gold-400 mb-2">Central Exchange</h1>
      <p className="text-stone-400 text-sm mb-6">NPC sell orders — unlimited supply at 1 gold each</p>

      <input
        className="bg-stone-800 border border-stone-600 rounded px-3 py-2 text-parchment-100 text-sm mb-4 w-64"
        placeholder="Filter by resource..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {isLoading ? (
        <div className="text-stone-400">Loading orders...</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500 border-b border-stone-700">
              <th className="pb-2 font-medium">Resource</th>
              <th className="pb-2 font-medium">Available</th>
              <th className="pb-2 font-medium">Price</th>
              <th className="pb-2 font-medium">Buy</th>
            </tr>
          </thead>
          <tbody>
            {sellOrders.map((order) => (
              <tr key={order.id} className="border-b border-stone-800 hover:bg-stone-800/50">
                <td className="py-2 text-parchment-200">
                  {RESOURCE_NAMES[order.resourceType as keyof typeof RESOURCE_NAMES] ?? order.resourceType}
                </td>
                <td className="py-2 text-stone-400 font-mono">
                  {order.quantity - order.fulfilledQty >= 999000 ? '∞' : (order.quantity - order.fulfilledQty).toLocaleString()}
                </td>
                <td className="py-2 text-gold-400">{order.pricePerUnit}g</td>
                <td className="py-2">
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      className="w-20 bg-stone-900 border border-stone-700 rounded px-2 py-1 text-parchment-100 text-xs"
                      placeholder="qty"
                      value={fillQty[order.id] ?? ''}
                      onChange={(e) => setFillQty((p) => ({ ...p, [order.id]: e.target.value }))}
                    />
                    <button
                      className="bg-gold-700 hover:bg-gold-600 text-stone-900 font-medium px-3 py-1 rounded text-xs"
                      onClick={() => fill.mutate({ orderId: order.id, qty: Number(fillQty[order.id] ?? 10) })}
                    >
                      Buy
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
