import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../services/api.js';
import type { ExchangeListing } from '../services/api.js';
import { RESOURCE_NAMES } from '@merchant-realms/shared';
import WarehousePanel from '../components/WarehousePanel.js';

const REGIONS = [
  { id: 'CENTRAL', name: 'Central' },
  { id: 'NE',      name: 'Northeast' },
  { id: 'NW',      name: 'Northwest' },
  { id: 'SW',      name: 'Southwest' },
  { id: 'SE',      name: 'Southeast' },
] as const;

const rName = (rt: string) => RESOURCE_NAMES[rt as keyof typeof RESOURCE_NAMES] ?? rt;

export default function ExchangePage() {
  const qc = useQueryClient();
  const [regionId, setRegionId]   = useState<string>('CENTRAL');
  const [selected, setSelected]   = useState<string | null>(null); // resourceType
  const [buyListingId, setBuyListingId] = useState<string | null>(null);
  const [buyQty, setBuyQty]       = useState('');
  const [listQty, setListQty]     = useState('');
  const [listPrice, setListPrice] = useState('');

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['exchange-storage', regionId] });
    void qc.invalidateQueries({ queryKey: ['exchange-listings', regionId] });
  };

  const { data: storageData, isError: storageError } = useQuery({
    queryKey: ['exchange-storage', regionId],
    queryFn:  () => api.exchangeStorage(regionId),
    refetchInterval: 30_000,
  });

  const { data: listingsData, isError: listingsError } = useQuery({
    queryKey: ['exchange-listings', regionId],
    queryFn:  () => api.listings(regionId),
    refetchInterval: 30_000,
  });

  const sellNpc = useMutation({
    mutationFn: ({ rt, qty }: { rt: string; qty: number }) => api.exchangeSell(regionId, rt, qty),
    onSuccess: invalidate,
  });

  const createListing = useMutation({
    mutationFn: () => api.createListing(regionId, selected!, Number(listQty), Number(listPrice)),
    onSuccess: () => { invalidate(); setListQty(''); setListPrice(''); },
  });

  const buyListing = useMutation({
    mutationFn: () => api.buyListing(buyListingId!, Number(buyQty)),
    onSuccess: () => { invalidate(); setBuyQty(''); setBuyListingId(null); },
  });

  const cancelListing = useMutation({
    mutationFn: (id: string) => api.cancelListing(id),
    onSuccess: invalidate,
  });

  const storageMap  = new Map((storageData?.storage ?? []).map((e) => [e.resourceType, e.quantity]));
  const goldBalance = storageData?.goldBalance ?? 0;
  const inventory   = storageData?.storage.filter((e) => e.quantity > 0) ?? [];
  const allListings = listingsData?.listings ?? [];

  // Resources to show in left panel: anything in warehouse OR with active listings
  const listedResources = new Set(allListings.map((l) => l.resourceType));
  const warehouseResources = new Set(storageMap.keys());
  const visibleResources = [...new Set([...warehouseResources, ...listedResources])].sort();

  // Listings for the selected resource
  const resourceListings = selected
    ? allListings.filter((l) => l.resourceType === selected)
    : [];

  const warehouseQty     = selected ? (storageMap.get(selected) ?? 0) : 0;
  const activeBuyListing = buyListingId ? allListings.find((l) => l.id === buyListingId) ?? null : null;

  const switchRegion = (id: string) => {
    setRegionId(id);
    setSelected(null);
    setBuyListingId(null);
    setBuyQty('');
    setListQty('');
    setListPrice('');
  };

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col overflow-hidden">

      {(storageError || listingsError) && (
        <div className="px-4 py-2 text-xs text-red-400 bg-red-950/20 border-b border-red-900/30">
          Failed to load exchange data — check the server is running.
        </div>
      )}

      {/* ── Region tabs ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-stone-700/60 flex-shrink-0 bg-stone-950/40">
        {REGIONS.map((r) => (
          <button
            key={r.id}
            onClick={() => switchRegion(r.id)}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              regionId === r.id
                ? 'bg-stone-700 text-parchment-100 font-medium'
                : 'text-stone-500 hover:text-stone-300 hover:bg-stone-800/50'
            }`}
          >
            {r.name}
          </button>
        ))}
        <span className="ml-auto text-xs text-stone-600">
          {REGIONS.find((r) => r.id === regionId)?.name} Exchange
        </span>
      </div>

      {/* ── Top half: warehouse + caravans ──────────────────────────────── */}
      <WarehousePanel
        locationType="EXCHANGE"
        locationId={regionId}
        locationLabel={`${REGIONS.find((r) => r.id === regionId)?.name ?? regionId} Warehouse`}
        inventory={inventory}
        goldBalance={goldBalance}
        showSell
        onSell={(rt, qty) => sellNpc.mutate({ rt, qty })}
        onInventoryChange={invalidate}
        className="h-[40%] border-b border-stone-700/60"
      />

      {/* ── Bottom half: listings browser ───────────────────────────────── */}
      <div className="flex-1 grid grid-cols-2 divide-x divide-stone-700/60 overflow-hidden min-h-0">

        {/* Left: resource list with listing counts */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-stone-700/60 flex-shrink-0">
            <span className="text-xs uppercase tracking-wider text-stone-500">
              Listings · {allListings.length} active
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {visibleResources.length === 0 ? (
              <div className="flex items-center justify-center h-full text-stone-600 text-sm">
                No listings or warehouse items
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-stone-900/95">
                  <tr className="text-xs text-stone-600 border-b border-stone-800">
                    <th className="text-left px-4 py-1.5 font-normal">Material</th>
                    <th className="text-right px-4 py-1.5 font-normal">Warehouse</th>
                    <th className="text-right px-4 py-1.5 font-normal">Listings</th>
                    <th className="text-right px-4 py-1.5 font-normal">Best price</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleResources.map((rt) => {
                    const inWh    = storageMap.get(rt) ?? 0;
                    const rtListings = allListings.filter((l) => l.resourceType === rt);
                    const bestPrice  = rtListings.length > 0
                      ? Math.min(...rtListings.map((l) => l.pricePerUnit))
                      : null;
                    return (
                      <tr
                        key={rt}
                        className={`border-b border-stone-800/40 cursor-pointer transition-colors ${
                          selected === rt ? 'bg-stone-700/40' : 'hover:bg-stone-800/40'
                        }`}
                        onClick={() => { setSelected(rt); setBuyListingId(null); setBuyQty(''); }}
                      >
                        <td className="px-4 py-1.5 text-stone-300">{rName(rt)}</td>
                        <td className={`px-4 py-1.5 text-right font-mono tabular-nums ${inWh > 0 ? 'text-parchment-200' : 'text-stone-700'}`}>
                          {inWh > 0 ? inWh.toFixed(0) : '—'}
                        </td>
                        <td className="px-4 py-1.5 text-right text-stone-500">
                          {rtListings.length > 0 ? rtListings.length : <span className="text-stone-700">—</span>}
                        </td>
                        <td className="px-4 py-1.5 text-right font-mono tabular-nums text-gold-400">
                          {bestPrice !== null ? `${bestPrice}g` : <span className="text-stone-700">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: listing detail + actions */}
        <div className="flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex items-center justify-center h-full text-stone-600 text-sm">
              Select a material to view listings
            </div>
          ) : (
            <>
              {/* Resource header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-700/60 flex-shrink-0">
                <span className="text-parchment-100 font-medium">{rName(selected)}</span>
                <span className="text-xs text-stone-500">
                  {warehouseQty > 0
                    ? <span>Warehouse: <span className="text-parchment-200">{warehouseQty.toFixed(0)}</span></span>
                    : <span className="text-stone-600">Not in warehouse</span>}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-5">

                {/* Active listings for this resource */}
                <div>
                  <div className="text-xs uppercase tracking-wider text-stone-500 mb-2">
                    Active Listings {resourceListings.length > 0 && <span className="text-stone-600">({resourceListings.length})</span>}
                  </div>
                  {resourceListings.length === 0 ? (
                    <p className="text-stone-600 text-xs">No listings for this material in this exchange.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-stone-600 border-b border-stone-800">
                          <th className="text-left py-1 font-normal">Available</th>
                          <th className="text-right py-1 font-normal">Price</th>
                          <th className="text-right py-1 font-normal">Total</th>
                          <th className="py-1" />
                        </tr>
                      </thead>
                      <tbody>
                        {resourceListings
                          .sort((a, b) => a.pricePerUnit - b.pricePerUnit)
                          .map((listing) => {
                            const remaining = listing.quantity - listing.fulfilledQty;
                            const isSelected = buyListingId === listing.id;
                            const isNpc = listing.empireId === null;
                            return (
                              <tr
                                key={listing.id}
                                className={`border-b border-stone-800/30 text-xs ${isSelected ? 'bg-stone-700/40' : ''}`}
                              >
                                <td className="py-1.5 text-stone-300 font-mono tabular-nums">
                                  {remaining.toFixed(0)}
                                  {isNpc && <span className="ml-1.5 text-stone-600">[NPC]</span>}
                                </td>
                                <td className="py-1.5 text-right font-mono tabular-nums text-gold-400">
                                  {listing.pricePerUnit}g
                                </td>
                                <td className="py-1.5 text-right text-stone-500">
                                  {(remaining * listing.pricePerUnit).toFixed(0)}g
                                </td>
                                <td className="py-1.5 pl-2 flex gap-1 justify-end">
                                  <button
                                    className={`px-2 py-0.5 rounded text-xs transition-colors ${
                                      isSelected
                                        ? 'bg-gold-600 text-stone-900 font-semibold'
                                        : 'bg-stone-700 hover:bg-stone-600 text-parchment-200'
                                    }`}
                                    onClick={() => {
                                      setBuyListingId(isSelected ? null : listing.id);
                                      setBuyQty('');
                                    }}
                                  >
                                    Buy
                                  </button>
                                  {listing.empireId !== null && (
                                    <button
                                      className="px-2 py-0.5 rounded text-xs bg-stone-800 hover:bg-red-900/40 text-stone-500 hover:text-red-400 transition-colors"
                                      onClick={() => cancelListing.mutate(listing.id)}
                                    >
                                      Cancel
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Buy form — shown when a listing row is selected */}
                {activeBuyListing && (
                  <div className="bg-stone-800/40 rounded p-3 space-y-2">
                    <div className="text-xs uppercase tracking-wider text-stone-500">Confirm Purchase</div>
                    <div className="text-xs text-stone-500">
                      Price: <span className="text-gold-400">{activeBuyListing.pricePerUnit}g/unit</span>
                      {' · '}Available: <span className="text-parchment-200">{(activeBuyListing.quantity - activeBuyListing.fulfilledQty).toFixed(0)}</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number" min={1} max={activeBuyListing.quantity - activeBuyListing.fulfilledQty}
                        className="w-24 bg-stone-900 border border-stone-700 rounded px-2 py-1 text-parchment-100 text-sm focus:outline-none focus:border-stone-500"
                        placeholder="Qty"
                        value={buyQty}
                        onChange={(e) => setBuyQty(e.target.value)}
                      />
                      {buyQty && (
                        <span className="text-stone-500 text-xs">
                          = <span className="text-gold-400">{(Number(buyQty) * activeBuyListing.pricePerUnit).toFixed(0)}g</span>
                          <span className="text-stone-600 ml-1">(have {goldBalance.toFixed(0)}g)</span>
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="bg-gold-600 hover:bg-gold-500 disabled:opacity-40 text-stone-900 font-semibold px-4 py-1.5 rounded text-sm"
                        disabled={
                          !buyQty || Number(buyQty) <= 0 ||
                          Number(buyQty) > activeBuyListing.quantity - activeBuyListing.fulfilledQty ||
                          Number(buyQty) * activeBuyListing.pricePerUnit > goldBalance ||
                          buyListing.isPending
                        }
                        onClick={() => buyListing.mutate()}
                      >
                        Confirm
                      </button>
                      <button
                        className="text-stone-500 hover:text-stone-300 px-3 py-1.5 rounded text-sm"
                        onClick={() => { setBuyListingId(null); setBuyQty(''); }}
                      >
                        Cancel
                      </button>
                    </div>
                    {buyListing.isError && (
                      <p className="text-red-400 text-xs">
                        {(buyListing.error as Error).message === 'LISTING_EXPIRED'
                          ? 'Listing expired — someone else bought it first.'
                          : (buyListing.error as Error).message}
                      </p>
                    )}
                  </div>
                )}

                <div className="border-t border-stone-800" />

                {/* Create listing form */}
                <div>
                  <div className="text-xs uppercase tracking-wider text-stone-500 mb-2">List for Sale</div>
                  {warehouseQty <= 0 ? (
                    <p className="text-stone-600 text-xs">You need {rName(selected)} in this exchange's warehouse to create a listing.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs text-stone-600">
                        In warehouse: <span className="text-parchment-200">{warehouseQty.toFixed(0)}</span>
                      </div>
                      <div className="flex gap-2 items-center flex-wrap">
                        <input
                          type="number" min={1} max={warehouseQty}
                          className="w-24 bg-stone-900 border border-stone-700 rounded px-2 py-1 text-parchment-100 text-sm focus:outline-none focus:border-stone-500"
                          placeholder="Qty"
                          value={listQty}
                          onChange={(e) => setListQty(e.target.value)}
                        />
                        <input
                          type="number" min={0.01} step={0.01}
                          className="w-24 bg-stone-900 border border-stone-700 rounded px-2 py-1 text-parchment-100 text-sm focus:outline-none focus:border-stone-500"
                          placeholder="Price/unit"
                          value={listPrice}
                          onChange={(e) => setListPrice(e.target.value)}
                        />
                        {listQty && listPrice && (
                          <span className="text-stone-500 text-xs">
                            = <span className="text-gold-400">{(Number(listQty) * Number(listPrice)).toFixed(0)}g</span> total
                          </span>
                        )}
                      </div>
                      <button
                        className="bg-stone-700 hover:bg-stone-600 disabled:opacity-40 text-parchment-100 px-4 py-1.5 rounded text-sm"
                        disabled={
                          !listQty || !listPrice ||
                          Number(listQty) <= 0 || Number(listQty) > warehouseQty ||
                          Number(listPrice) <= 0 ||
                          createListing.isPending
                        }
                        onClick={() => createListing.mutate()}
                      >
                        Create Listing
                      </button>
                      {createListing.isError && (
                        <p className="text-red-400 text-xs">{(createListing.error as Error).message}</p>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
