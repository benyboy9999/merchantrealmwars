import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import type { ExchangeListing, WishlistWithItems } from '../services/api.js';
import { RESOURCE_NAMES, REGION_IDS } from '@merchant-realms/shared';
import WarehousePanel from '../components/WarehousePanel.js';
import { IconSlot } from '../components/ui/index.js';
import { useAuthStore } from '../stores/auth.js';

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
  const myEmpireId = useAuthStore((s) => s.empireId);
  const [regionId, setRegionId]   = useState<number>(initialRegion);
  const [selected, setSelected]   = useState<string | null>(null);
  const [search, setSearch]       = useState('');
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [buyQty, setBuyQty]       = useState('');
  const [listQty, setListQty]     = useState('');
  const [listPrice, setListPrice] = useState('');

  // Wishlist panel state
  const [bottomTab, setBottomTab]               = useState<'listings' | 'wishlists'>('listings');
  const [activeWishlistId, setActiveWishlistId] = useState<number | null>(null);
  const [renamingId, setRenamingId]             = useState<number | null>(null);
  const [renameValue, setRenameValue]           = useState('');
  const [confirmDeleteId, setConfirmDeleteId]   = useState<number | null>(null);
  const [newWishlistName, setNewWishlistName]   = useState('');
  const [addItemRt, setAddItemRt]               = useState('');
  const [addItemQty, setAddItemQty]             = useState('');
  const [editingItemRt, setEditingItemRt]       = useState<string | null>(null);
  const [editingItemQty, setEditingItemQty]     = useState('');
  const renameInputRef                          = useRef<HTMLInputElement>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['exchange-storage', regionId] });
    void qc.invalidateQueries({ queryKey: ['exchange-listings', regionId] });
    void qc.invalidateQueries({ queryKey: ['admin-status'] });
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

  const marketBuy = useMutation({
    mutationFn: () => api.marketBuy(regionId, selected!, Number(buyQty)),
    onSuccess: () => { invalidate(); setBuyQty(''); },
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

  // Per-resource quantity the player currently has listed for sale
  const myListedMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of allListings) {
      if (l.empireId === myEmpireId) {
        m.set(l.resourceType, (m.get(l.resourceType) ?? 0) + (l.quantity - l.fulfilledQty));
      }
    }
    return m;
  }, [allListings, myEmpireId]);

  // Resources to show in left panel: anything in warehouse OR with active listings
  const allVisibleResources = useMemo(() => {
    const listedResources    = new Set(allListings.map((l) => l.resourceType));
    const warehouseResources = new Set(storageMap.keys());
    return [...new Set([...warehouseResources, ...listedResources])].sort();
  }, [allListings, storageMap]);

  const visibleResources = useMemo(() => {
    if (!search.trim()) return allVisibleResources;
    const q = search.trim().toLowerCase();
    return allVisibleResources.filter((rt) => rName(rt).toLowerCase().includes(q));
  }, [allVisibleResources, search]);

  // Listings for the selected resource, sorted price asc
  const resourceListings = useMemo(() =>
    selected ? [...allListings.filter((l) => l.resourceType === selected)].sort((a, b) => a.pricePerUnit - b.pricePerUnit) : [],
  [allListings, selected]);

  const warehouseQty = selected ? (storageMap.get(selected) ?? 0) : 0;
  const myListed     = selected ? (myListedMap.get(selected) ?? 0) : 0;

  const avgPrice = useMemo(() => {
    const totalQty = resourceListings.reduce((s, l) => s + (l.quantity - l.fulfilledQty), 0);
    if (totalQty === 0) return null;
    const weightedSum = resourceListings.reduce((s, l) => s + l.pricePerUnit * (l.quantity - l.fulfilledQty), 0);
    return weightedSum / totalQty;
  }, [resourceListings]);

  // Cost preview: simulate filling buyQty from cheapest listings
  const buyQtyNum = Number(buyQty);
  const costPreview = useMemo(() => {
    if (!buyQtyNum || buyQtyNum <= 0) return null;
    let remaining = buyQtyNum;
    let cost = 0;
    for (const l of resourceListings) {
      if (remaining <= 0) break;
      const avail = l.quantity - l.fulfilledQty;
      const take  = Math.min(remaining, avail);
      cost      += take * l.pricePerUnit;
      remaining -= take;
    }
    return { cost, shortfall: Math.max(0, remaining) };
  }, [buyQtyNum, resourceListings]);

  const allWishlists: WishlistWithItems[] = wishlistData?.wishlists ?? [];
  const activeWishlist = allWishlists.find((w) => w.id === activeWishlistId)
    ?? allWishlists[0]
    ?? null;

  const switchRegion = (id: number) => {
    setRegionId(id);
    setSelected(null);
    setBuyQty('');
    setListQty('');
    setListPrice('');
    setSearch('');
    setTradeMode('buy');
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
              {/* Search / filter */}
              <div className="px-3 py-2 border-b border-slate-800">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search materials…"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
                />
              </div>

              {visibleResources.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-600 text-sm">
                  {search ? 'No materials match your search' : 'No listings or warehouse items'}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-900">
                    <tr className="text-xs text-slate-600 border-b border-slate-800">
                      <th className="text-left px-4 py-1.5 font-normal">Material</th>
                      <th className="text-right px-4 py-1.5 font-normal">Listed</th>
                      <th className="text-right px-4 py-1.5 font-normal">Best price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleResources.map((rt) => {
                      const myListed   = myListedMap.get(rt) ?? 0;
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
                          onClick={() => { setSelected(rt); setBuyQty(''); setListQty(''); setListPrice(''); }}
                        >
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <IconSlot size="xs" label={rName(rt)} />
                              <span className="text-slate-300">{rName(rt)}</span>
                            </div>
                          </td>
                          <td className={`px-4 py-2 text-right font-mono tabular-nums text-xs ${myListed > 0 ? 'text-azure-300' : 'text-slate-700'}`}>
                            {myListed > 0 ? myListed.toFixed(0) : '—'}
                          </td>
                          <td className="px-4 py-2 text-right font-mono tabular-nums text-xs text-gold-400">
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
                    {confirmDeleteId === activeWishlist?.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-red-400">Delete?</span>
                        <button
                          onClick={() => { deleteWishlist.mutate(activeWishlist!.id); setConfirmDeleteId(null); }}
                          className="text-xs text-red-400 hover:text-red-300 px-1 transition-colors"
                        >Yes</button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs text-slate-500 hover:text-slate-300 px-1 transition-colors"
                        >No</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => activeWishlist && setConfirmDeleteId(activeWishlist.id)}
                        title="Delete wishlist"
                        className="text-slate-700 hover:text-red-400 text-xs px-1 transition-colors"
                      >✕</button>
                    )}
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
                              setBuyQty(String(item.quantity));
                              setTradeMode('buy');
                            }}
                            title="Click to open in buy panel"
                          >
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-2">
                                <IconSlot size="xs" label={rName(item.resourceType)} />
                                <span className="text-slate-300 text-xs">{rName(item.resourceType)}</span>
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                              {editingItemRt === item.resourceType ? (
                                <form
                                  className="flex justify-end"
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    const qty = parseInt(editingItemQty, 10);
                                    if (qty > 0 && activeWishlist) {
                                      upsertItem.mutate({ wishlistId: activeWishlist.id, rt: item.resourceType, qty });
                                    }
                                    setEditingItemRt(null);
                                  }}
                                >
                                  <input
                                    autoFocus
                                    type="number"
                                    min="1"
                                    value={editingItemQty}
                                    onChange={(e) => setEditingItemQty(e.target.value)}
                                    onBlur={() => setEditingItemRt(null)}
                                    onKeyDown={(e) => { if (e.key === 'Escape') setEditingItemRt(null); }}
                                    className="w-16 bg-slate-900 border border-azure-500 rounded px-1.5 py-0.5 text-xs text-slate-100 font-mono text-right focus:outline-none"
                                  />
                                </form>
                              ) : (
                                <button
                                  onClick={() => { setEditingItemRt(item.resourceType); setEditingItemQty(String(item.quantity)); }}
                                  className="font-mono tabular-nums text-xs text-slate-200 hover:text-azure-300 transition-colors"
                                  title="Click to edit quantity"
                                >
                                  {item.quantity}
                                </button>
                              )}
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

        {/* Right card: trade panel */}
        <div className="bg-slate-900 border border-slate-700/60 rounded-lg overflow-hidden max-h-[700px] overflow-y-auto">
          {!selected ? (
            <div className="flex items-center justify-center py-16 text-slate-600 text-sm">
              Select a material to trade
            </div>
          ) : (
            <>
              {/* ── Header ───────────────────────────────────────────── */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60">
                <IconSlot size="md" label={rName(selected)} />
                <div className="flex-1 min-w-0">
                  <div className="text-slate-100 font-semibold">{rName(selected)}</div>
                  <div className="flex gap-4 text-xs mt-0.5">
                    <span className="text-slate-500">
                      In warehouse: <span className="text-slate-200 font-mono">{warehouseQty.toFixed(0)}</span>
                    </span>
                    {myListed > 0 && (
                      <span className="text-slate-500">
                        Listed: <span className="text-azure-300 font-mono">{myListed.toFixed(0)}</span>
                      </span>
                    )}
                    {avgPrice !== null && (
                      <span className="text-slate-500">
                        Avg price: <span className="text-gold-400 font-mono">{avgPrice.toFixed(2)}g</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Buy / Sell toggle ────────────────────────────────── */}
              <div className="flex border-b border-slate-700/60">
                <button
                  onClick={() => { setTradeMode('buy'); setBuyQty(''); }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    tradeMode === 'buy'
                      ? 'bg-azure-500/10 text-azure-300 border-b-2 border-azure-500'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >Buy</button>
                <button
                  onClick={() => { setTradeMode('sell'); setListQty(''); setListPrice(''); }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    tradeMode === 'sell'
                      ? 'bg-gold-500/10 text-gold-300 border-b-2 border-gold-500'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >Sell</button>
              </div>

              {/* ── Trade form ───────────────────────────────────────── */}
              <div className="p-4 border-b border-slate-700/60">
                {tradeMode === 'buy' ? (
                  /* Buy mode */
                  <div className="space-y-3">
                    {resourceListings.length === 0 ? (
                      <p className="text-slate-600 text-xs">No listings available — nothing to buy.</p>
                    ) : (
                      <>
                        <input
                          type="number" min={1}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-slate-500"
                          placeholder="Quantity"
                          value={buyQty}
                          onChange={(e) => setBuyQty(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            if (
                              !buyQty || buyQtyNum <= 0 ||
                              !costPreview || costPreview.shortfall > 0 ||
                              costPreview.cost > goldBalance ||
                              marketBuy.isPending
                            ) return;
                            marketBuy.mutate();
                          }}
                        />
                        {costPreview ? (
                          <div className="space-y-1.5 text-xs">
                            {costPreview.shortfall > 0 ? (
                              <div className="flex justify-between text-amber-400">
                                <span>Available supply</span>
                                <span className="font-mono">{(buyQtyNum - costPreview.shortfall).toFixed(0)} / {buyQtyNum}</span>
                              </div>
                            ) : (
                              <>
                                <div className="flex justify-between text-slate-500">
                                  <span>Estimated cost</span>
                                  <span className="text-gold-400 font-mono">{costPreview.cost.toFixed(0)}g</span>
                                </div>
                                <div className="flex justify-between text-slate-500">
                                  <span>Your balance</span>
                                  <span className={`font-mono ${costPreview.cost > goldBalance ? 'text-red-400' : 'text-slate-300'}`}>{goldBalance.toFixed(0)}g</span>
                                </div>
                                <div className="flex justify-between text-slate-500">
                                  <span>After purchase</span>
                                  <span className="text-slate-400 font-mono">{(goldBalance - costPreview.cost).toFixed(0)}g</span>
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between text-slate-600">
                              <span>Your balance</span>
                              <span className="font-mono">{goldBalance.toFixed(0)}g</span>
                            </div>
                          </div>
                        )}
                        <button
                          className="w-full bg-azure-500 hover:bg-azure-400 disabled:opacity-40 text-white font-semibold py-2 rounded text-sm transition-colors"
                          disabled={
                            !buyQty || buyQtyNum <= 0 ||
                            !costPreview || costPreview.shortfall > 0 ||
                            costPreview.cost > goldBalance ||
                            marketBuy.isPending
                          }
                          onClick={() => marketBuy.mutate()}
                        >{marketBuy.isPending ? 'Buying…' : 'Buy'}</button>
                        {marketBuy.isError && (
                          <p className="text-red-400 text-xs">{(marketBuy.error as Error).message}</p>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  /* Sell mode */
                  <div className="space-y-3">
                    <input
                      type="number" min={1} max={warehouseQty || undefined}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-slate-500"
                      placeholder="Quantity"
                      value={listQty}
                      onChange={(e) => setListQty(e.target.value)}
                    />
                    <input
                      type="number" min={0.01} step={0.01}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-slate-500"
                      placeholder="Price per unit (gold)"
                      value={listPrice}
                      onChange={(e) => setListPrice(e.target.value)}
                    />
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-500">
                        <span>In warehouse</span>
                        <span className={`font-mono ${warehouseQty <= 0 ? 'text-red-400' : 'text-slate-300'}`}>{warehouseQty.toFixed(0)}</span>
                      </div>
                      {listQty && listPrice && Number(listQty) > 0 && Number(listPrice) > 0 && (
                        <div className="flex justify-between text-slate-500">
                          <span>Listing value</span>
                          <span className="text-gold-400 font-mono">{(Number(listQty) * Number(listPrice)).toFixed(0)}g</span>
                        </div>
                      )}
                    </div>
                    <button
                      className="w-full bg-gold-500/80 hover:bg-gold-500 disabled:opacity-40 text-slate-900 font-semibold py-2 rounded text-sm transition-colors"
                      disabled={
                        warehouseQty <= 0 ||
                        !listQty || !listPrice ||
                        Number(listQty) <= 0 || Number(listQty) > warehouseQty ||
                        Number(listPrice) <= 0 ||
                        createListing.isPending
                      }
                      onClick={() => createListing.mutate()}
                    >{createListing.isPending ? 'Listing…' : 'List for Sale'}</button>
                    {createListing.isError && (
                      <p className="text-red-400 text-xs">{(createListing.error as Error).message}</p>
                    )}
                  </div>
                )}
              </div>

              {/* ── Listings (sorted price asc) ──────────────────────── */}
              <div>
                <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-slate-500">
                    Listings {resourceListings.length > 0 && <span className="text-slate-700 normal-case tracking-normal">({resourceListings.length})</span>}
                  </span>
                </div>
                {resourceListings.length === 0 ? (
                  <p className="px-4 py-4 text-slate-600 text-xs">No active listings for this material.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-600 border-b border-slate-800">
                        <th className="text-left px-4 py-1.5 font-normal">Seller</th>
                        <th className="text-right px-4 py-1.5 font-normal">Qty</th>
                        <th className="text-right px-4 py-1.5 font-normal">Price</th>
                        <th className="py-1.5 w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {resourceListings.map((listing: ExchangeListing) => {
                        const remaining = listing.quantity - listing.fulfilledQty;
                        const isMine    = listing.empireId === myEmpireId;
                        const isNpc     = listing.empireId === null;
                        return (
                          <tr
                            key={listing.id}
                            className="border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="px-4 py-2 text-slate-400">
                              {isNpc ? <span className="text-slate-600">NPC</span>
                                : isMine ? <span className="text-azure-400">You</span>
                                : (listing.empireName ?? '—')}
                            </td>
                            <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-200">
                              {remaining.toFixed(0)}
                            </td>
                            <td className="px-4 py-2 text-right font-mono tabular-nums text-gold-400">
                              {listing.pricePerUnit}g
                            </td>
                            <td className="px-2 py-2 text-right">
                              {isMine && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); cancelListing.mutate(listing.id); }}
                                  className="text-slate-700 hover:text-red-400 transition-colors leading-none"
                                  title="Cancel listing"
                                >✕</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
}
