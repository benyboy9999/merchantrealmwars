import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../services/api.js';
import { RESOURCE_NAMES, RESOURCE_WEIGHT } from '@merchant-realms/shared';
import WarehousePanel from '../components/WarehousePanel.js';

const REGION_ID = 'CENTRAL';
const NPC_PRICE = 1;

const rName = (rt: string) => RESOURCE_NAMES[rt as keyof typeof RESOURCE_NAMES] ?? rt;
const rWeight = (rt: string) => RESOURCE_WEIGHT[rt as keyof typeof RESOURCE_WEIGHT] ?? 0.5;

const ALL_RESOURCES = Object.keys(RESOURCE_NAMES) as Array<keyof typeof RESOURCE_NAMES>;

export default function ExchangePage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [sellQty, setSellQty] = useState('');
  const [buyQty, setBuyQty] = useState('');

  const { data: storageData } = useQuery({
    queryKey: ['exchange-storage', REGION_ID],
    queryFn:  () => api.exchangeStorage(REGION_ID),
    refetchInterval: 3000,
  });

  const invalidateStorage = () => qc.invalidateQueries({ queryKey: ['exchange-storage', REGION_ID] });

  const sell = useMutation({
    mutationFn: ({ rt, qty }: { rt: string; qty: number }) => api.exchangeSell(REGION_ID, rt, qty),
    onSuccess: () => { invalidateStorage(); setSellQty(''); },
  });
  const buy = useMutation({
    mutationFn: ({ rt, qty }: { rt: string; qty: number }) => api.exchangeBuy(REGION_ID, rt, qty),
    onSuccess: () => { invalidateStorage(); setBuyQty(''); },
  });

  const storageMap  = new Map((storageData?.storage ?? []).map((e) => [e.resourceType, e.quantity]));
  const goldBalance = storageData?.goldBalance ?? 0;
  const inventory   = storageData?.storage.filter((e) => e.quantity > 0) ?? [];

  const selectedWarehouseQty = selected ? (storageMap.get(selected) ?? 0) : 0;

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col overflow-hidden">

      {/* ── Top half: warehouse + caravans ──────────────────────────────── */}
      <WarehousePanel
        locationType="EXCHANGE"
        locationId={REGION_ID}
        locationLabel="Exchange Warehouse"
        inventory={inventory}
        goldBalance={goldBalance}
        showSell
        onSell={(rt, qty) => sell.mutate({ rt, qty })}
        onInventoryChange={invalidateStorage}
        className="h-1/2 border-b border-stone-700/60"
      />

      {/* ── Bottom half: item list + item detail ────────────────────────── */}
      <div className="h-1/2 grid grid-cols-2 divide-x divide-stone-700/60 overflow-hidden">

        {/* BL: Material list */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-stone-700/60 flex-shrink-0">
            <span className="text-xs uppercase tracking-wider text-stone-500">Materials</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-stone-900/95">
                <tr className="text-xs text-stone-600 border-b border-stone-800">
                  <th className="text-left px-4 py-1.5 font-normal">Material</th>
                  <th className="text-right px-4 py-1.5 font-normal">In Warehouse</th>
                  <th className="text-right px-4 py-1.5 font-normal">NPC Price</th>
                </tr>
              </thead>
              <tbody>
                {ALL_RESOURCES.map((rt) => {
                  const inWarehouse = storageMap.get(rt) ?? 0;
                  return (
                    <tr
                      key={rt}
                      className={`border-b border-stone-800/40 cursor-pointer transition-colors ${selected === rt ? 'bg-stone-700/40' : 'hover:bg-stone-800/40'}`}
                      onClick={() => setSelected(rt)}
                    >
                      <td className="px-4 py-1.5 text-stone-300">{rName(rt)}</td>
                      <td className={`px-4 py-1.5 text-right font-mono tabular-nums ${inWarehouse > 0 ? 'text-parchment-200' : 'text-stone-700'}`}>
                        {inWarehouse > 0 ? inWarehouse.toFixed(0) : '—'}
                      </td>
                      <td className="px-4 py-1.5 text-right text-stone-500">{NPC_PRICE}g</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* BR: Item detail */}
        <div className="flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex items-center justify-center h-full text-stone-600 text-sm">Select a material</div>
          ) : (
            <>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-700/60 flex-shrink-0">
                <span className="text-parchment-100 font-medium">{rName(selected)}</span>
                <span className="text-xs text-stone-500">
                  {selectedWarehouseQty > 0
                    ? <span>Warehouse: <span className="text-parchment-200">{selectedWarehouseQty.toFixed(0)}</span></span>
                    : <span className="text-stone-600">Not in warehouse</span>}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Sell */}
                <div>
                  <div className="text-xs uppercase tracking-wider text-stone-500 mb-2">Sell to NPC</div>
                  <div className="text-xs text-stone-600 mb-2">Price: <span className="text-parchment-200">{NPC_PRICE}g / unit</span></div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number" min={1} max={selectedWarehouseQty}
                      className="w-28 bg-stone-900 border border-stone-700 rounded px-3 py-1.5 text-parchment-100 text-sm focus:outline-none focus:border-stone-500"
                      placeholder="Quantity"
                      value={sellQty}
                      onChange={(e) => setSellQty(e.target.value)}
                    />
                    {sellQty && <span className="text-stone-500 text-xs">= {(Number(sellQty) * NPC_PRICE).toFixed(0)}g</span>}
                    <button
                      className="bg-stone-700 hover:bg-stone-600 disabled:opacity-40 text-parchment-100 px-4 py-1.5 rounded text-sm"
                      disabled={!sellQty || Number(sellQty) <= 0 || Number(sellQty) > selectedWarehouseQty || sell.isPending}
                      onClick={() => sell.mutate({ rt: selected, qty: Number(sellQty) })}
                    >
                      Sell
                    </button>
                  </div>
                  {sell.isError && <p className="text-red-400 text-xs mt-1">{(sell.error as Error).message}</p>}
                </div>

                <div className="border-t border-stone-800" />

                {/* Buy */}
                <div>
                  <div className="text-xs uppercase tracking-wider text-stone-500 mb-2">Buy from NPC</div>
                  <div className="text-xs text-stone-600 mb-2">Price: <span className="text-parchment-200">{NPC_PRICE}g / unit</span> — deposited to warehouse</div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number" min={1}
                      className="w-28 bg-stone-900 border border-stone-700 rounded px-3 py-1.5 text-parchment-100 text-sm focus:outline-none focus:border-stone-500"
                      placeholder="Quantity"
                      value={buyQty}
                      onChange={(e) => setBuyQty(e.target.value)}
                    />
                    {buyQty && <span className="text-stone-500 text-xs">= {(Number(buyQty) * NPC_PRICE).toFixed(0)}g</span>}
                    <button
                      className="bg-gold-600 hover:bg-gold-500 disabled:opacity-40 text-stone-900 font-semibold px-4 py-1.5 rounded text-sm"
                      disabled={!buyQty || Number(buyQty) <= 0 || buy.isPending}
                      onClick={() => buy.mutate({ rt: selected, qty: Number(buyQty) })}
                    >
                      Buy
                    </button>
                  </div>
                  {buy.isError && <p className="text-red-400 text-xs mt-1">{(buy.error as Error).message}</p>}
                </div>

                <div className="border-t border-stone-800" />

                <div>
                  <div className="text-xs uppercase tracking-wider text-stone-500 mb-2">Market</div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between text-stone-500">
                      <span>NPC Buy</span><span className="font-mono">{NPC_PRICE}g · unlimited</span>
                    </div>
                    <div className="flex justify-between text-stone-500">
                      <span>NPC Sell</span><span className="font-mono">{NPC_PRICE}g · unlimited</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
