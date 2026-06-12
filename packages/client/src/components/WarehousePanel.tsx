import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../services/api.js';
import { RESOURCE_NAMES, RESOURCE_WEIGHT } from '@merchant-realms/shared';
import { useLivePercent } from '../hooks/useLivePercent.js';
import ProgressBar from './ProgressBar.js';

const rName  = (rt: string) => RESOURCE_NAMES[rt as keyof typeof RESOURCE_NAMES] ?? rt;
const rKgPer = (rt: string) => RESOURCE_WEIGHT[rt as keyof typeof RESOURCE_WEIGHT] ?? 0.5;
const MULE_KG = 100;

interface InventoryItem { resourceType: string; quantity: number }

interface WarehousePanelProps {
  locationType: 'KEEP' | 'EXCHANGE';
  locationId:   string;
  locationLabel: string;
  inventory:    InventoryItem[];
  goldBalance?:  number;
  showSell?:     boolean;
  onSell?:       (rt: string, qty: number) => void;
  onInventoryChange?: () => void;
  className?:    string;
}

// Shared inline transfer popup — used for both load and unload
function TransferPopup({ label, maxQty, onConfirm, onClose }: {
  label: string;
  maxQty: number;
  onConfirm: (qty: number) => void;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(String(Math.floor(maxQty)));
  const n = Number(qty);
  const valid = n > 0 && n <= maxQty;
  return (
    <div className="mx-3 mb-2 mt-0.5 border border-stone-600 rounded bg-stone-900 px-3 py-2.5 text-xs">
      <div className="text-stone-500 mb-2">{label}</div>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="number"
          min={1}
          max={Math.floor(maxQty)}
          className="w-20 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-parchment-100 text-right focus:outline-none focus:border-stone-500"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && valid) onConfirm(n); if (e.key === 'Escape') onClose(); }}
        />
        <span className="text-stone-600">/ {Math.floor(maxQty)}</span>
        <button
          className="bg-stone-700 hover:bg-stone-600 disabled:opacity-40 text-parchment-100 px-3 py-1 rounded"
          disabled={!valid}
          onClick={() => onConfirm(n)}
        >
          Transfer
        </button>
        <button className="text-stone-600 hover:text-stone-400 px-1" onClick={onClose}>✕</button>
      </div>
    </div>
  );
}

export default function WarehousePanel({
  locationType, locationId, locationLabel,
  inventory, goldBalance, showSell, onSell,
  onInventoryChange, className = '',
}: WarehousePanelProps) {
  const qc = useQueryClient();

  // Which item's popup is open
  const [loadPopup,   setLoadPopup]   = useState<{ rt: string; caravanId: string } | null>(null);
  const [unloadPopup, setUnloadPopup] = useState<{ caravanId: string; rt: string } | null>(null);
  const [sellPopup,   setSellPopup]   = useState<string | null>(null); // resourceType
  const [selectedCaravanId, setSelectedCaravanId] = useState<string | null>(null);

  // Travel state per caravan
  const [destType, setDestType] = useState<Record<string, 'KEEP' | 'EXCHANGE' | 'PLOT'>>({});
  const [destId,   setDestId]   = useState<Record<string, string>>({});

  const { data: caravanData } = useQuery({ queryKey: ['caravans'],        queryFn: api.caravans,              refetchInterval: 3000 });
  const { data: keepData }    = useQuery({ queryKey: ['keeps'],           queryFn: api.keeps });
  const { data: districtData } = useQuery({ queryKey: ['districts', 'CENTRAL'], queryFn: () => api.districts('CENTRAL') });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['caravans'] });
    qc.invalidateQueries({ queryKey: ['keep', locationId] });
    qc.invalidateQueries({ queryKey: ['exchange-storage'] });
    onInventoryChange?.();
  };

  const caravanLoad = useMutation({
    mutationFn: ({ id, rt, qty }: { id: string; rt: string; qty: number }) => api.caravanLoad(id, rt, qty),
    onSuccess: () => { setLoadPopup(null); invalidate(); },
  });
  const caravanUnload = useMutation({
    mutationFn: ({ id, rt, qty }: { id: string; rt: string; qty: number }) => api.caravanUnload(id, rt, qty),
    onSuccess: () => { setUnloadPopup(null); invalidate(); },
  });
  const caravanDispatch = useMutation({
    mutationFn: ({ id, dt, di }: { id: string; dt: string; di: string }) =>
      api.caravanDispatch(id, dt, dt === 'EXCHANGE' ? 'CENTRAL' : di),
    onSuccess: invalidate,
  });

  const allCaravans   = caravanData?.caravans ?? [];
  const hereCaravans  = allCaravans.filter(
    (c) => c.status === 'IDLE' && c.locationType === locationType && c.locationId === locationId,
  );
  const awayCaravans  = allCaravans.filter(
    (c) => !(c.status === 'IDLE' && c.locationType === locationType && c.locationId === locationId),
  );

  const allKeeps   = keepData?.keeps ?? [];
  const emptyPlots = (districtData?.districts ?? []).flatMap((d) => d.plots).filter((p) => !p.keeps?.length);
  const totalWeight = inventory.reduce((s, e) => s + e.quantity * rKgPer(e.resourceType), 0);

  // For load popup: max transferable given selected caravan capacity
  function maxLoadable(rt: string, caravanId: string): number {
    const caravan = hereCaravans.find((c) => c.id === caravanId);
    if (!caravan) return 0;
    const usedKg = caravan.cargo.reduce((s, x) => s + x.quantity * rKgPer(x.resourceType), 0);
    const freeKg = caravan.animalCount * MULE_KG - usedKg;
    const byCapacity = Math.floor(freeKg / rKgPer(rt));
    const inWarehouse = inventory.find((e) => e.resourceType === rt)?.quantity ?? 0;
    return Math.min(inWarehouse, byCapacity);
  }

  function openLoadPopup(rt: string) {
    const targetId = selectedCaravanId ?? hereCaravans[0]?.id ?? '';
    if (!targetId) return;
    setUnloadPopup(null);
    setSellPopup(null);
    setLoadPopup({ rt, caravanId: targetId });
  }

  function openUnloadPopup(caravanId: string, rt: string) {
    setLoadPopup(null);
    setSellPopup(null);
    setUnloadPopup({ caravanId, rt });
  }

  function openSellPopup(rt: string) {
    setLoadPopup(null);
    setUnloadPopup(null);
    setSellPopup(sellPopup === rt ? null : rt);
  }

  return (
    <div className={`grid grid-cols-2 divide-x divide-stone-700/60 overflow-hidden ${className}`}>

      {/* ── Left: inventory ─────────────────────────────────────────────── */}
      <div className="flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-700/60 flex-shrink-0">
          <span className="text-xs uppercase tracking-wider text-stone-500">{locationLabel}</span>
          <span className="text-xs text-stone-600">{totalWeight.toFixed(1)} kg</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {inventory.length === 0 ? (
            <div className="p-4 text-stone-600 text-sm">Nothing here yet.</div>
          ) : (
            <div>
              {inventory.filter((e) => e.quantity > 0).sort((a, b) => b.quantity - a.quantity).map((e) => {
                const isLoadOpen = loadPopup?.rt === e.resourceType;
                const isSellOpen = sellPopup === e.resourceType;
                const canLoad = hereCaravans.length > 0 && maxLoadable(e.resourceType, loadPopup?.caravanId ?? selectedCaravanId ?? hereCaravans[0]?.id ?? '') > 0;

                return (
                  <div key={e.resourceType} className="border-b border-stone-800/40">
                    <div className="flex items-center px-4 py-2 hover:bg-stone-800/30 gap-2">
                      <span className="flex-1 text-sm text-stone-300">{rName(e.resourceType)}</span>
                      <span className="text-parchment-200 font-mono tabular-nums text-sm w-12 text-right">{e.quantity.toFixed(0)}</span>
                      {showSell && (
                        <button
                          className={`text-xs px-1.5 py-0.5 border rounded transition-colors ${isSellOpen ? 'border-gold-600 text-gold-400' : 'border-stone-700 text-stone-500 hover:border-stone-500 hover:text-stone-300'}`}
                          onClick={() => openSellPopup(e.resourceType)}
                        >
                          Sell
                        </button>
                      )}
                      {hereCaravans.length > 0 && (
                        <button
                          className={`w-6 h-6 flex items-center justify-center border rounded text-sm transition-colors ${isLoadOpen ? 'border-parchment-200 text-parchment-200' : 'border-stone-600 text-stone-400 hover:border-stone-400 hover:text-parchment-200'}`}
                          title="Load into caravan"
                          onClick={() => isLoadOpen ? setLoadPopup(null) : openLoadPopup(e.resourceType)}
                          disabled={!canLoad}
                        >
                          ›
                        </button>
                      )}
                    </div>

                    {/* Load popup */}
                    {isLoadOpen && (
                      <div className="mx-3 mb-2 mt-0.5 border border-stone-600 rounded bg-stone-900 px-3 py-2.5 text-xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-stone-500">Load into</span>
                          {hereCaravans.length > 1 ? (
                            <select
                              className="bg-stone-800 border border-stone-700 rounded px-2 py-0.5 text-parchment-100 text-xs focus:outline-none"
                              value={loadPopup.caravanId}
                              onChange={(ev) => {
                                setLoadPopup({ rt: e.resourceType, caravanId: ev.target.value });
                                setSelectedCaravanId(ev.target.value);
                              }}
                            >
                              {hereCaravans.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          ) : (
                            <span className="text-parchment-200">{hereCaravans[0]?.name}</span>
                          )}
                        </div>
                        <TransferPopup
                          label={`Transfer to caravan (max ${Math.floor(maxLoadable(e.resourceType, loadPopup.caravanId))})`}
                          maxQty={maxLoadable(e.resourceType, loadPopup.caravanId)}
                          onConfirm={(qty) => caravanLoad.mutate({ id: loadPopup.caravanId, rt: e.resourceType, qty })}
                          onClose={() => setLoadPopup(null)}
                        />
                      </div>
                    )}

                    {/* Sell popup */}
                    {isSellOpen && onSell && (
                      <div className="mx-3 mb-2 mt-0.5 border border-stone-600 rounded bg-stone-900 px-3 py-2.5 text-xs">
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
          <div className="flex justify-between items-center px-4 py-2 border-t border-stone-700/60 flex-shrink-0">
            <span className="text-xs text-stone-600">Gold</span>
            <span className="text-gold-400 font-mono text-sm">{goldBalance.toFixed(0)}g</span>
          </div>
        )}
      </div>

      {/* ── Right: caravans ─────────────────────────────────────────────── */}
      <div className="flex flex-col overflow-hidden">
        <div className="px-4 py-2.5 border-b border-stone-700/60 flex-shrink-0">
          <span className="text-xs uppercase tracking-wider text-stone-500">Caravans</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {allCaravans.length === 0 && (
            <div className="p-4 text-stone-600 text-sm">No caravans.</div>
          )}

          {hereCaravans.map((c) => {
            const cargoKg  = c.cargo.reduce((s, x) => s + x.quantity * rKgPer(x.resourceType), 0);
            const maxKg    = c.animalCount * MULE_KG;
            const dt = destType[c.id] ?? 'KEEP';
            const di = destId[c.id]   ?? '';

            return (
              <div key={c.id} className="border-b border-stone-800/60">
                {/* Caravan header */}
                <div className="px-4 pt-3 pb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-parchment-200">{c.name}</span>
                    <span className="text-xs text-stone-500">{c.animalCount} mule{c.animalCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex justify-between text-xs text-stone-600 mb-1">
                    <span>Cargo</span>
                    <span>{cargoKg.toFixed(1)} / {maxKg} kg</span>
                  </div>
                  <div className="h-0.5 bg-stone-700 rounded mb-3">
                    <div className="h-0.5 rounded bg-stone-500" style={{ width: `${Math.min(100, cargoKg / maxKg * 100)}%` }} />
                  </div>

                  {/* Cargo items with ‹ unload buttons */}
                  {c.cargo.length === 0 ? (
                    <div className="text-xs text-stone-700 mb-2">Empty</div>
                  ) : (
                    <div className="mb-1">
                      {c.cargo.map((cargo) => {
                        const isUnloadOpen = unloadPopup?.caravanId === c.id && unloadPopup.rt === cargo.resourceType;
                        return (
                          <div key={cargo.resourceType} className="border-b border-stone-800/30 last:border-0">
                            <div className="flex items-center gap-2 py-1.5">
                              <button
                                className={`w-6 h-6 flex items-center justify-center border rounded text-sm transition-colors flex-shrink-0 ${isUnloadOpen ? 'border-parchment-200 text-parchment-200' : 'border-stone-600 text-stone-400 hover:border-stone-400 hover:text-parchment-200'}`}
                                title="Unload to warehouse"
                                onClick={() => isUnloadOpen ? setUnloadPopup(null) : openUnloadPopup(c.id, cargo.resourceType)}
                              >
                                ‹
                              </button>
                              <span className="flex-1 text-xs text-stone-400">{rName(cargo.resourceType)}</span>
                              <span className="text-parchment-200 font-mono text-xs w-10 text-right">{cargo.quantity.toFixed(0)}</span>
                            </div>

                            {/* Unload popup */}
                            {isUnloadOpen && (
                              <div className="mb-1.5 border border-stone-600 rounded bg-stone-900 px-3 py-2">
                                <TransferPopup
                                  label={`Unload to ${locationLabel}`}
                                  maxQty={cargo.quantity}
                                  onConfirm={(qty) => caravanUnload.mutate({ id: c.id, rt: cargo.resourceType, qty })}
                                  onClose={() => setUnloadPopup(null)}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Dispatch controls */}
                <div className="px-4 pb-3 border-t border-stone-800/60 pt-2">
                  <div className="flex gap-1 mb-1.5">
                    {(['KEEP', 'EXCHANGE', 'PLOT'] as const).map((t) => (
                      <button key={t}
                        className={`text-xs px-2 py-0.5 rounded border transition-colors ${dt === t ? 'border-stone-500 text-parchment-200' : 'border-stone-700 text-stone-600 hover:border-stone-600'}`}
                        onClick={() => setDestType((p) => ({ ...p, [c.id]: t }))}
                      >
                        {t === 'KEEP' ? 'Keep' : t === 'EXCHANGE' ? 'Exchange' : 'Plot'}
                      </button>
                    ))}
                  </div>
                  {dt === 'KEEP' && (
                    <select
                      className="w-full bg-stone-900 border border-stone-700 rounded px-2 py-1 text-parchment-100 text-xs mb-1.5 focus:outline-none"
                      value={di}
                      onChange={(e) => setDestId((p) => ({ ...p, [c.id]: e.target.value }))}
                    >
                      <option value="">Select keep...</option>
                      {allKeeps.filter((k) => !(locationType === 'KEEP' && k.id === locationId)).map((k) => (
                        <option key={k.id} value={k.id}>{k.name}</option>
                      ))}
                    </select>
                  )}
                  {dt === 'EXCHANGE' && <div className="text-xs text-stone-600 mb-1.5">→ Central Exchange</div>}
                  {dt === 'PLOT' && (
                    <select
                      className="w-full bg-stone-900 border border-stone-700 rounded px-2 py-1 text-parchment-100 text-xs mb-1.5 focus:outline-none"
                      value={di}
                      onChange={(e) => setDestId((p) => ({ ...p, [c.id]: e.target.value }))}
                    >
                      <option value="">Select plot...</option>
                      {emptyPlots.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                  <button
                    className="w-full text-xs py-1 border border-stone-600 rounded text-stone-400 hover:text-parchment-100 hover:border-stone-500 disabled:opacity-40 transition-colors"
                    disabled={(dt !== 'EXCHANGE' && !di) || caravanDispatch.isPending}
                    onClick={() => caravanDispatch.mutate({ id: c.id, dt, di })}
                  >
                    Dispatch
                  </button>
                </div>
              </div>
            );
          })}

          {/* Away caravans */}
          {awayCaravans.length > 0 && (
            <div className={hereCaravans.length > 0 ? 'border-t border-stone-800' : ''}>
              {awayCaravans.map((c) => (
                <AwayCaravan key={c.id} caravan={c} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Away caravan row with live travel progress bar
function AwayCaravan({ caravan: c }: { caravan: { id: string; name: string; status: string; locationType: string; destType: string | null; arrivesAt: string | null; departedAt: string | null } }) {
  const pct = useLivePercent(c.departedAt, c.arrivesAt);
  const inTransit = c.status === 'IN_TRANSIT';

  const remaining = c.arrivesAt
    ? Math.max(0, Math.ceil((new Date(c.arrivesAt).getTime() - Date.now()) / 1000))
    : null;

  const remainingLabel = remaining != null
    ? remaining >= 60 ? `${Math.floor(remaining / 60)}m ${remaining % 60}s` : `${remaining}s`
    : null;

  return (
    <div className="px-4 py-2.5 border-b border-stone-800/40">
      <div className="flex items-center justify-between mb-1.5 text-xs">
        <span className="text-stone-500">{c.name}</span>
        <span className="text-stone-600">
          {inTransit
            ? `→ ${c.destType?.toLowerCase()} ${remainingLabel ? `· ${remainingLabel}` : ''}`
            : `at ${c.locationType?.toLowerCase()}`}
        </span>
      </div>
      {inTransit && (
        <ProgressBar pct={pct} color="bg-stone-600" height="h-0.5" />
      )}
    </div>
  );
}
