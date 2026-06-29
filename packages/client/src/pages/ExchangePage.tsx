import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import type { ExchangeListing, WishlistWithItems } from '../services/api.js';
import { RESOURCE_NAMES, REGION_IDS } from '@merchant-realms/shared';
import WarehousePanel from '../components/WarehousePanel.js';
import { IconSlot } from '../components/ui/index.js';

const REGIONS = [
  { id: REGION_IDS.CENTRAL, name: 'Central'   },
  { id: REGION_IDS.NE,      name: 'Northeast' },
  { id: REGION_IDS.NW,      name: 'Northwest' },
  { id: REGION_IDS.SW,      name: 'Southwest' },
  { id: REGION_IDS.SE,      name: 'Southeast' },
] as const;

const rName = (rt: string) => RESOURCE_NAMES[rt as keyof typeof RESOURCE_NAMES] ?? rt;

export default function ExchangePage() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialRegion = REGIONS.find((r) => r.id === parseInt(searchParams.get('region') ?? ''))?.id ?? REGION_IDS.CENTRAL;
  const [regionId, setRegionId]   = useState<number>(initialRegion);
  const [selected, setSelected]   = useState<string | null>(null); // resourceType
  const [buyListingId, setBuyListingId] = useState<number | null>(null);
  const [buyQty, setBuyQty]       = useState('');
  const [listQty, setListQty]     = useState('');
  const [listPrice, setListPrice] = useState('');

  // Wishlist panel state
  const [bottomTab, setBottomTab]         = useState<'listings' | 'wishlists'>('listings');
  const [activeWishlistId, setActiveWishlistId] = useState<number | null>(null);
  const [renamingId, setRenamingId]        = useState<number | null>(null);
  const [renameValue, setRenameValue]      = useState('');
  const [newWishlistName, setNewWishlistName] = useState('');
  const [addItemRt, setAddItemRt]          = useState('');
  const [addItemQty, setAddItemQty]        = useState('');
  const renameInputRef                     = useRef<HTMLInputElement>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['exchange-storage', regionId] });
    void qc.invalidateQueries({ queryKey: ['exchange-listings', regionId] });
  };

  const { data: storageData, isError: storageError, error: storageErr } = useQuery({
    queryKey: ['exchange-storage', regionId],
    queryFn:  () => api.exchangeWarehouse(regionId),
  });

  const { data: listingsData, isError: listingsError, error: listingsErr } = useQuery({
    queryKey: ['exchange-listings', regionId],
    queryFn:  () => api.listings(regionId),
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
    mutationFn: (id: number) => api.cancelListing(id),
    onSuccess: invalidate,
  });

  const invalidateWishlists = () => void qc.invalidateQueries({ queryKey: ['wishlists'] });

  const { data: wishlistData } = useQuery({
    queryKey: ['wishlists'],
    queryFn:  () => api.wishlists(),
  });

  const createWishlist = useMutation({
    mutationFn: (name: string) => api.createWishlist(name),
    onSuccess: (data) => {
      invalidateWishlists();
      setActiveWishlistId(data.wishlist.id);
      setNewWishlistName('');
    },
  });

  const renameWishlist = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api.renameWishlist(id, name),
    onSuccess: () => { invalidateWishlists(); setRenamingId(null); },
  });

  const deleteWishlist = useMutation({
    mutationFn: (id: number) => api.deleteWishlist(id),
    onSuccess: () => { invalidateWishlists(); setActiveWishlistId(null); },
  });

  const upsertItem = useMutation({
    mutationFn: ({ wishlistId, rt, qty }: { wishlistId: number; rt: string; qty: number }) =>
      api.upsertWishlistItem(wishlistId, rt, qty),
    onSuccess: invalidateWishlists,
  });

  const deleteItem = useMutation({
    mutationFn: ({ wishlistId, rt }: { wishlistId: number; rt: string }) =>
      api.deleteWishlistItem(wishlistId, rt),
    onSuccess: invalidateWishlists,
  });

  const storageMap  = new Map((storageData?.warehouse?.items ?? []).map((e) => [e.resourceType, e.quantity]));
  const goldBalance = storageData?.goldBalance ?? 0;
  const inventory   = (storageData?.warehouse?.items ?? []).filter((e) => e.quantity > 0);
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

  const allWishlists: WishlistWithItems[] = wishlistData?.wishlists ?? [];
  const activeWishlist = allWishlists.find((w) => w.id === activeWishlistId)
    ?? allWishlists[0]
    ?? null;

  const switchRegion = (id: number) => {
    setRegionId(id);
    setSelected(null);
    setBuyListingId(null);
    setBuyQty('');
    setListQty('');
    setListPrice('');
  };

  return (
    <div className="space-y-4">

      {(storageError || listingsError) && (
        <div className="px-4 py-2 text-xs text-red-400 bg-red-950/20 border border-red-900/30 rounded-lg">
          {storageError && <span>Warehouse: {(storageErr as Error)?.message ?? 'Failed to load'}</span>}
          {storageError && listingsError && <span className="mx-2">·</span>}
          {listingsError && <span>Listings: {(listingsErr as Error)?.message ?? 'Failed to load'}</span>}
        </div>
      )}

      {/* ── Card: region selector + warehouse + caravans ─────────────────── */}
      <div className="bg-slate-900 border border-slate-700/60 rounded-lg overflow-hidden">
        <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-700/60 bg-slate-950/40">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              onClick={() => switchRegion(r.id)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                regionId === r.id
                  ? 'bg-slate-700 text-slate-100 font-medium'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              {r.name}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-600">
            {REGIONS.find((r) => r.id === regionId)?.name} Exchange
          </span>
        </div>
        <WarehousePanel
          locationType="EXCHANGE"
          locationId={regionId}
          warehouseId={storageData?.warehouse?.id ?? 0}
          locationLabel={`${REGIONS.find((r) => r.id === regionId)?.name ?? regionId} Warehouse`}
          inventory={inventory}
          goldBalance={goldBalance}
          showSell
          onSell={(rt, qty) => sellNpc.mutate({ rt, qty })}
          onInventoryChange={invalidate}
          className="h-[300px]"
        />
      </div>

      {/* ── Cards: listings browser ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Left card: listings or wishlists */}
        <div className="bg-slate-900 border border-slate-700/60 rounded-lg overflow-hidden flex flex-col">

          {/* Tab strip */}
          <div className="flex border-b border-slate-700/60">
            <button
              onClick={() => setBottomTab('listings')}
              className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                bottomTab === 'listings'
                  ? 'border-azure-500 text-azure-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              Listings <span className="ml-1 text-slate-600">{allListings.length}</span>
            </button>
            <button
              onClick={() => setBottomTab('wishlists')}
              className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                bottomTab === 'wishlists'
                  ? 'border-azure-500 text-azure-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              Wishlists {allWishlists.length > 0 && <span className="ml-1 text-slate-600">{allWishlists.length}</span>}
            </button>
          </div>

          {bottomTab === 'listings' ? (
            <div>
              {visibleResources.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-600 text-sm">
                  No listings or warehouse items
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-900/95">
                    <tr className="text-xs text-slate-600 border-b border-slate-800">
                      <th className="text-left px-4 py-1.5 font-normal">Material</th>
                      <th className="text-right px-4 py-1.5 font-normal">Warehouse</th>
                      <th className="text-right px-4 py-1.5 font-normal">Listings</th>
                      <th className="text-right px-4 py-1.5 font-normal">Best price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleResources.map((rt) => {
                      const inWh       = storageMap.get(rt) ?? 0;
                      const rtListings = allListings.filter((l) => l.resourceType === rt);
                      const bestPrice  = rtListings.length > 0
                        ? Math.min(...rtListings.map((l) => l.pricePerUnit))
                        : null;
                      return (
                        <tr
                          key={rt}
                          className={`border-b border-slate-800/40 cursor-pointer transition-colors ${
                            selected === rt ? 'bg-slate-700/40' : 'hover:bg-slate-800/40'
                          }`}
                          onClick={() => { setSelected(rt); setBuyListingId(null); setBuyQty(''); }}
                        >
                          <td className="px-4 py-1.5">
                            <div className="flex items-center gap-2">
                              <IconSlot size="xs" label={rName(rt)} />
                              <span className="text-slate-300">{rName(rt)}</span>
                            </div>
                          </td>
                          <td className={`px-4 py-1.5 text-right font-mono tabular-nums ${inWh > 0 ? 'text-slate-200' : 'text-slate-700'}`}>
                            {inWh > 0 ? inWh.toFixed(0) : '—'}
                          </td>
                          <td className="px-4 py-1.5 text-right text-slate-500">
                            {rtListings.length > 0 ? rtListings.length : <span className="text-slate-700">—</span>}
                          </td>
                          <td className="px-4 py-1.5 text-right font-mono tabular-nums text-gold-400">
                            {bestPrice !== null ? `${bestPrice}g` : <span className="text-slate-700">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            /* ── Wishlists panel ─────────────────────────────────────── */
            <div className="flex flex-col">

              {/* Wishlist selector + actions */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/60 flex-shrink-0">
                {allWishlists.length > 0 ? (
                  <>
                    <select
                      value={activeWishlist?.id ?? ''}
                      onChange={(e) => setActiveWishlistId(Number(e.target.value))}
                      className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
                    >
                      {allWishlists.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                    {renamingId === activeWishlist?.id ? (
                      <form
                        className="flex gap-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (renameValue.trim() && activeWishlist) {
                            renameWishlist.mutate({ id: activeWishlist.id, name: renameValue.trim() });
                          }
                        }}
                      >
                        <input
                          ref={renameInputRef}
                          className="w-28 bg-slate-900 border border-slate-600 rounded px-2 py-0.5 text-xs text-slate-100 focus:outline-none focus:border-azure-500"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Escape') setRenamingId(null); }}
                          autoFocus
                        />
                        <button type="submit" className="text-azure-400 hover:text-azure-300 text-xs px-1">✓</button>
                        <button type="button" onClick={() => setRenamingId(null)} className="text-slate-600 hover:text-slate-400 text-xs px-1">✕</button>
                      </form>
                    ) : (
                      <button
                        onClick={() => {
                          if (!activeWishlist) return;
                          setRenamingId(activeWishlist.id);
                          setRenameValue(activeWishlist.name);
                        }}
                        title="Rename"
                        className="text-slate-600 hover:text-slate-300 text-xs px-1 transition-colors"
                      >✎</button>
                    )}
                    <button
                      onClick={() => {
                        if (!activeWishlist) return;
                        if (confirm(`Delete "${activeWishlist.name}"?`)) {
                          deleteWishlist.mutate(activeWishlist.id);
                        }
                      }}
                      title="Delete wishlist"
                      className="text-slate-700 hover:text-red-400 text-xs px-1 transition-colors"
                    >✕</button>
                  </>
                ) : (
                  <span className="text-xs text-slate-600 flex-1">No wishlists yet</span>
                )}
              </div>

              {/* Wishlist items */}
              <div>
                {activeWishlist && activeWishlist.items.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-900/95">
                      <tr className="text-xs text-slate-600 border-b border-slate-800">
                        <th className="text-left px-3 py-1.5 font-normal">Resource</th>
                        <th className="text-right px-3 py-1.5 font-normal">Need</th>
                        <th className="text-right px-3 py-1.5 font-normal">Have</th>
                        <th className="py-1.5 w-6" />
                      </tr>
                    </thead>
                    <tbody>
                      {activeWishlist.items.map((item) => {
                        const have = storageMap.get(item.resourceType) ?? 0;
                        const met  = have >= item.quantity;
                        return (
                          <tr
                            key={item.resourceType}
                            className="border-b border-slate-800/40 hover:bg-slate-800/40 cursor-pointer transition-colors group"
                            onClick={() => {
                              setSelected(item.resourceType);
                              setBuyListingId(null);
                              setBuyQty(String(item.quantity));
                              setBottomTab('listings');
                            }}
                            title="Click to open in buy menu"
                          >
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-2">
                                <IconSlot size="xs" label={rName(item.resourceType)} />
                                <span className="text-slate-300 text-xs">{rName(item.resourceType)}</span>
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono tabular-nums text-xs text-slate-200">
                              {item.quantity}
                            </td>
                            <td className={`px-3 py-1.5 text-right font-mono tabular-nums text-xs ${met ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {Math.floor(have)}
                            </td>
                            <td className="px-1 py-1.5 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteItem.mutate({ wishlistId: activeWishlist.id, rt: item.resourceType });
                                }}
                                className="text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs leading-none"
                              >✕</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : activeWishlist ? (
                  <div className="flex items-center justify-center h-16 text-slate-600 text-xs">
                    No items — add below
                  </div>
                ) : null}

                {/* Add item row */}
                {activeWishlist && (
                  <form
                    className="flex gap-1.5 items-center px-3 py-2 border-t border-slate-800"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const qty = parseInt(addItemQty, 10);
                      if (!addItemRt || !qty || qty < 1) return;
                      upsertItem.mutate({ wishlistId: activeWishlist.id, rt: addItemRt, qty });
                      setAddItemRt('');
                      setAddItemQty('');
                    }}
                  >
                    <select
                      value={addItemRt}
                      onChange={(e) => setAddItemRt(e.target.value)}
                      className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-slate-500"
                    >
                      <option value="">Add resource…</option>
                      {Object.entries(RESOURCE_NAMES).map(([rt, name]) => (
                        <option key={rt} value={rt}>{name as string}</option>
                      ))}
                    </select>
                    <input
                      type="number" min={1}
                      placeholder="Qty"
                      value={addItemQty}
                      onChange={(e) => setAddItemQty(e.target.value)}
                      className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
                    />
                    <button
                      type="submit"
                      disabled={!addItemRt || !addItemQty}
                      className="px-2 py-1 rounded text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-30 transition-colors"
                    >+</button>
                  </form>
                )}
              </div>

              {/* New wishlist form */}
              <form
                className="flex gap-1.5 items-center px-3 py-2 border-t border-slate-700/60 flex-shrink-0"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newWishlistName.trim()) createWishlist.mutate(newWishlistName.trim());
                }}
              >
                <input
                  placeholder="New wishlist name…"
                  value={newWishlistName}
                  onChange={(e) => setNewWishlistName(e.target.value)}
                  className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-slate-500 placeholder:text-slate-600"
                />
                <button
                  type="submit"
                  disabled={!newWishlistName.trim() || createWishlist.isPending}
                  className="px-2.5 py-1 rounded text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-30 transition-colors flex-shrink-0"
                >
                  Create
                </button>
              </form>

            </div>
          )}
        </div>

        {/* Right card: listing detail + actions */}
        <div className="bg-slate-900 border border-slate-700/60 rounded-lg overflow-hidden">
          {!selected ? (
            <div className="flex items-center justify-center py-16 text-slate-600 text-sm">
              Select a material to view listings
            </div>
          ) : (
            <>
              {/* Resource header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/60">
                <div className="flex items-center gap-2.5">
                  <IconSlot size="sm" label={rName(selected)} />
                  <span className="text-slate-100 font-medium">{rName(selected)}</span>
                </div>
                <span className="text-xs text-slate-500">
                  {warehouseQty > 0
                    ? <span>Warehouse: <span className="text-slate-200">{warehouseQty.toFixed(0)}</span></span>
                    : <span className="text-slate-600">Not in warehouse</span>}
                </span>
              </div>

              <div className="p-4 space-y-5">

                {/* Active listings for this resource */}
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                    Active Listings {resourceListings.length > 0 && <span className="text-slate-600">({resourceListings.length})</span>}
                  </div>
                  {resourceListings.length === 0 ? (
                    <p className="text-slate-600 text-xs">No listings for this material in this exchange.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-600 border-b border-slate-800">
                          <th className="text-left py-1 font-normal">Available</th>
                          <th className="text-right py-1 font-normal">Price</th>
                          <th className="text-right py-1 font-normal">Total</th>
                          <th className="py-1" />
                        </tr>
                      </thead>
                      <tbody>
                        {resourceListings
                          .sort((a, b) => a.pricePerUnit - b.pricePerUnit)
                          .map((listing: ExchangeListing) => {
                            const remaining = listing.quantity - listing.fulfilledQty;
                            const isSelected = buyListingId === listing.id;
                            const isNpc = listing.empireId === null;
                            return (
                              <tr
                                key={listing.id}
                                className={`border-b border-slate-800/30 text-xs ${isSelected ? 'bg-slate-700/40' : ''}`}
                              >
                                <td className="py-1.5 text-slate-300 font-mono tabular-nums">
                                  {remaining.toFixed(0)}
                                  {isNpc && <span className="ml-1.5 text-slate-600">[NPC]</span>}
                                </td>
                                <td className="py-1.5 text-right font-mono tabular-nums text-gold-400">
                                  {listing.pricePerUnit}g
                                </td>
                                <td className="py-1.5 text-right text-slate-500">
                                  {(remaining * listing.pricePerUnit).toFixed(0)}g
                                </td>
                                <td className="py-1.5 pl-2 flex gap-1 justify-end">
                                  <button
                                    className={`px-2 py-0.5 rounded text-xs transition-colors ${
                                      isSelected
                                        ? 'bg-azure-500 text-white font-semibold'
                                        : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
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
                                      className="px-2 py-0.5 rounded text-xs bg-slate-800 hover:bg-red-900/40 text-slate-500 hover:text-red-400 transition-colors"
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
                  <div className="bg-slate-800/40 rounded p-3 space-y-2">
                    <div className="text-xs uppercase tracking-wider text-slate-500">Confirm Purchase</div>
                    <div className="text-xs text-slate-500">
                      Price: <span className="text-gold-400">{activeBuyListing.pricePerUnit}g/unit</span>
                      {' · '}Available: <span className="text-slate-200">{(activeBuyListing.quantity - activeBuyListing.fulfilledQty).toFixed(0)}</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number" min={1} max={activeBuyListing.quantity - activeBuyListing.fulfilledQty}
                        className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-sm focus:outline-none focus:border-slate-500"
                        placeholder="Qty"
                        value={buyQty}
                        onChange={(e) => setBuyQty(e.target.value)}
                      />
                      {buyQty && (
                        <span className="text-slate-500 text-xs">
                          = <span className="text-gold-400">{(Number(buyQty) * activeBuyListing.pricePerUnit).toFixed(0)}g</span>
                          <span className="text-slate-600 ml-1">(have {goldBalance.toFixed(0)}g)</span>
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="bg-azure-500 hover:bg-azure-400 disabled:opacity-40 text-white font-semibold px-4 py-1.5 rounded text-sm"
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
                        className="text-slate-500 hover:text-slate-300 px-3 py-1.5 rounded text-sm"
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

                <div className="border-t border-slate-800" />

                {/* Create listing form */}
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">List for Sale</div>
                  {warehouseQty <= 0 ? (
                    <p className="text-slate-600 text-xs">You need {rName(selected)} in this exchange's warehouse to create a listing.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-600">
                        In warehouse: <span className="text-slate-200">{warehouseQty.toFixed(0)}</span>
                      </div>
                      <div className="flex gap-2 items-center flex-wrap">
                        <input
                          type="number" min={1} max={warehouseQty}
                          className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-sm focus:outline-none focus:border-slate-500"
                          placeholder="Qty"
                          value={listQty}
                          onChange={(e) => setListQty(e.target.value)}
                        />
                        <input
                          type="number" min={0.01} step={0.01}
                          className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-sm focus:outline-none focus:border-slate-500"
                          placeholder="Price/unit"
                          value={listPrice}
                          onChange={(e) => setListPrice(e.target.value)}
                        />
                        {listQty && listPrice && (
                          <span className="text-slate-500 text-xs">
                            = <span className="text-gold-400">{(Number(listQty) * Number(listPrice)).toFixed(0)}g</span> total
                          </span>
                        )}
                      </div>
                      <button
                        className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-100 px-4 py-1.5 rounded text-sm"
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
