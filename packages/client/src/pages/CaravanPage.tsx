import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import type { CaravanWithCargo } from '../services/api.js';
import { RESOURCE_NAMES, RESOURCE_WEIGHT, KEEP_FOUNDING_COST } from '@merchant-realms/shared';

const REGION_ID = 'CENTRAL';

function locationLabel(c: CaravanWithCargo, keeps: Array<{ id: string; name: string }>, plots: Array<{ id: string; name: string }>) {
  if (c.locationType === 'KEEP') return keeps.find((k) => k.id === c.locationId)?.name ?? 'Keep';
  if (c.locationType === 'EXCHANGE') return 'Central Exchange';
  if (c.locationType === 'PLOT') return plots.find((p) => p.id === c.locationId)?.name ?? 'Plot';
  return c.locationId;
}

function destLabel(c: CaravanWithCargo, keeps: Array<{ id: string; name: string }>, plots: Array<{ id: string; name: string }>) {
  if (!c.destType) return '';
  if (c.destType === 'KEEP') return keeps.find((k) => k.id === c.destId)?.name ?? 'Keep';
  if (c.destType === 'EXCHANGE') return 'Central Exchange';
  if (c.destType === 'PLOT') return plots.find((p) => p.id === c.destId)?.name ?? 'Plot';
  return c.destId ?? '';
}

export default function CaravanPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [destType, setDestType] = useState<'KEEP' | 'EXCHANGE' | 'PLOT'>('KEEP');
  const [destId, setDestId] = useState('');
  const [loadQty, setLoadQty] = useState<Record<string, string>>({});
  const [unloadQty, setUnloadQty] = useState<Record<string, string>>({});
  const [foundName, setFoundName] = useState('');

  const { data: caravanData } = useQuery({ queryKey: ['caravans'], queryFn: api.caravans, refetchInterval: 15_000 });
  const { data: keepData }    = useQuery({ queryKey: ['keeps'],    queryFn: api.keeps });
  const { data: districtData } = useQuery({ queryKey: ['districts'], queryFn: () => api.districts(REGION_ID) });

  const caravans = caravanData?.caravans ?? [];
  const keeps    = keepData?.keeps ?? [];
  const plots    = (districtData?.districts ?? []).flatMap((d) => d.plots).filter((p) => !p.keeps?.length);

  const caravan = caravans.find((c) => c.id === selectedId) ?? caravans[0] ?? null;

  // Location inventory queries
  const keepInventory = useQuery({
    queryKey: ['keep', caravan?.locationId],
    queryFn:  () => api.keep(caravan!.locationId),
    enabled:  !!caravan && caravan.locationType === 'KEEP' && caravan.status === 'IDLE',
  });
  const exchangeInventory = useQuery({
    queryKey: ['exchange-storage', caravan?.locationId],
    queryFn:  () => api.exchangeStorage(caravan!.locationId),
    enabled:  !!caravan && caravan.locationType === 'EXCHANGE' && caravan.status === 'IDLE',
  });

  const load = useMutation({
    mutationFn: ({ rt, qty }: { rt: string; qty: number }) => api.caravanLoad(caravan!.id, rt, qty),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['caravans'] }); qc.invalidateQueries({ queryKey: ['keep', caravan?.locationId] }); },
  });
  const unload = useMutation({
    mutationFn: ({ rt, qty }: { rt: string; qty: number }) => api.caravanUnload(caravan!.id, rt, qty),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['caravans'] }); qc.invalidateQueries({ queryKey: ['keep', caravan?.locationId] }); qc.invalidateQueries({ queryKey: ['exchange-storage', caravan?.locationId] }); },
  });
  const dispatch = useMutation({
    mutationFn: () => api.caravanDispatch(caravan!.id, destType, destType === 'EXCHANGE' ? 'CENTRAL' : destId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['caravans'] }); setDestId(''); },
  });
  const foundKeep = useMutation({
    mutationFn: () => api.foundKeep(caravan!.locationId, foundName),
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ['caravans'] }); qc.invalidateQueries({ queryKey: ['districts'] }); navigate(`/keeps/${data.keep.id}`); },
  });
  const sell = useMutation({
    mutationFn: ({ rt, qty }: { rt: string; qty: number }) => api.exchangeSell(REGION_ID, rt, qty),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exchange-storage', REGION_ID] }),
  });

  if (!caravan) return <div className="p-8 text-stone-400 text-sm">No caravans — run seed first.</div>;

  const isIdle = caravan.status === 'IDLE';
  const atKeep = isIdle && caravan.locationType === 'KEEP';
  const atExchange = isIdle && caravan.locationType === 'EXCHANGE';
  const atPlot = isIdle && caravan.locationType === 'PLOT';

  const locationInventory: Array<{ resourceType: string; quantity: number }> =
    atKeep     ? (keepInventory.data?.keep.resourceLedger.filter((e) => e.quantity > 0) ?? [])
    : atExchange ? (exchangeInventory.data?.storage.filter((e) => e.quantity > 0) ?? [])
    : [];

  // Founding eligibility
  const cargoMap = new Map(caravan.cargo.map((c) => [c.resourceType, c.quantity]));
  const canFound = atPlot && KEEP_FOUNDING_COST.every((c) => (cargoMap.get(c.resource) ?? 0) >= c.quantity);

  const rName = (rt: string) => RESOURCE_NAMES[rt as keyof typeof RESOURCE_NAMES] ?? rt;
  const rWeight = (rt: string) => RESOURCE_WEIGHT[rt as keyof typeof RESOURCE_WEIGHT] ?? 0.5;
  const cargoWeight = caravan.cargo.reduce((s, c) => s + c.quantity * rWeight(c.resourceType), 0);
  const maxWeight   = caravan.animalCount * 100;

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-xl font-semibold text-parchment-100 mb-1">Caravans</h1>

      {/* Caravan selector */}
      {caravans.length > 1 && (
        <div className="flex gap-2 mb-4">
          {caravans.map((c) => (
            <button key={c.id}
              className={`text-sm px-3 py-1 rounded border transition-colors ${c.id === caravan.id ? 'border-stone-500 text-parchment-200' : 'border-stone-700 text-stone-500 hover:border-stone-600'}`}
              onClick={() => setSelectedId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Caravan header */}
      <div className="border border-stone-700 rounded p-4 bg-stone-800 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-parchment-200 font-medium">{caravan.name}</span>
            <span className="text-stone-500 text-xs ml-2">{caravan.animalCount} mule{caravan.animalCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="text-xs text-right">
            {isIdle ? (
              <span className="text-stone-400">At <span className="text-parchment-200">{locationLabel(caravan, keeps, (districtData?.districts ?? []).flatMap((d) => d.plots))}</span></span>
            ) : (
              <span className="text-stone-400">
                En route to <span className="text-parchment-200">{destLabel(caravan, keeps, (districtData?.districts ?? []).flatMap((d) => d.plots))}</span>
                {caravan.arrivesAt && <span className="ml-1 text-stone-600">— arrives {new Date(caravan.arrivesAt).toLocaleTimeString()}</span>}
              </span>
            )}
          </div>
        </div>
        {/* Cargo weight bar */}
        <div className="flex justify-between text-xs text-stone-500 mb-1">
          <span>Cargo</span>
          <span>{cargoWeight.toFixed(1)} / {maxWeight} kg</span>
        </div>
        <div className="h-1 bg-stone-700 rounded">
          <div className="h-1 rounded bg-stone-500" style={{ width: `${Math.min(100, cargoWeight / maxWeight * 100)}%` }} />
        </div>
      </div>

      {isIdle && (
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Location inventory */}
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500 mb-3">
              {atKeep ? locationLabel(caravan, keeps, []) : atExchange ? 'Exchange Storage' : atPlot ? 'Plot (no storage)' : 'Location'}
            </div>

            {atExchange && locationInventory.length > 0 && (
              <div className="space-y-1 mb-3">
                {locationInventory.map((entry) => (
                  <div key={entry.resourceType} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 text-stone-400">{rName(entry.resourceType)}</span>
                    <span className="text-parchment-200 font-mono w-12 text-right">{entry.quantity.toFixed(0)}</span>
                    <button
                      className="text-gold-500 hover:text-gold-400 text-xs px-2 py-0.5 border border-gold-700/50 rounded"
                      onClick={() => sell.mutate({ rt: entry.resourceType, qty: entry.quantity })}
                    >
                      Sell all
                    </button>
                  </div>
                ))}
              </div>
            )}

            {atKeep && locationInventory.length > 0 && (
              <div className="space-y-1">
                {locationInventory.map((entry) => {
                  const maxLoad = Math.floor((maxWeight - cargoWeight) / rWeight(entry.resourceType));
                  return (
                    <div key={entry.resourceType} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 text-stone-400">{rName(entry.resourceType)}</span>
                      <span className="text-parchment-200 font-mono w-12 text-right">{entry.quantity.toFixed(0)}</span>
                      <input
                        type="number"
                        className="w-14 bg-stone-900 border border-stone-700 rounded px-2 py-0.5 text-parchment-100 text-xs text-right focus:outline-none"
                        placeholder="qty"
                        min={1}
                        max={Math.min(entry.quantity, maxLoad)}
                        value={loadQty[entry.resourceType] ?? ''}
                        onChange={(e) => setLoadQty((p) => ({ ...p, [entry.resourceType]: e.target.value }))}
                      />
                      <button
                        className="text-stone-300 hover:text-parchment-100 text-xs px-2 py-0.5 border border-stone-600 rounded"
                        onClick={() => {
                          const qty = Number(loadQty[entry.resourceType]);
                          if (qty > 0) load.mutate({ rt: entry.resourceType, qty });
                        }}
                      >
                        Load →
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {locationInventory.length === 0 && (atKeep || atExchange) && (
              <p className="text-stone-600 text-sm">Empty</p>
            )}

            {atPlot && (
              <p className="text-stone-600 text-sm">No storage at an empty plot.</p>
            )}
          </div>

          {/* Caravan cargo */}
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500 mb-3">Caravan Cargo</div>
            {caravan.cargo.length === 0 ? (
              <p className="text-stone-600 text-sm">Empty</p>
            ) : (
              <div className="space-y-1">
                {caravan.cargo.map((entry) => (
                  <div key={entry.resourceType} className="flex items-center gap-2 text-sm">
                    <button
                      className="text-stone-400 hover:text-parchment-100 text-xs px-2 py-0.5 border border-stone-600 rounded"
                      onClick={() => {
                        const qty = Number(unloadQty[entry.resourceType]) || entry.quantity;
                        unload.mutate({ rt: entry.resourceType, qty });
                      }}
                    >
                      {atPlot ? '×' : '← Unload'}
                    </button>
                    <input
                      type="number"
                      className="w-14 bg-stone-900 border border-stone-700 rounded px-2 py-0.5 text-parchment-100 text-xs text-right focus:outline-none"
                      placeholder="qty"
                      min={1}
                      max={entry.quantity}
                      value={unloadQty[entry.resourceType] ?? ''}
                      onChange={(e) => setUnloadQty((p) => ({ ...p, [entry.resourceType]: e.target.value }))}
                    />
                    <span className="text-parchment-200 font-mono w-12 text-right">{entry.quantity.toFixed(0)}</span>
                    <span className="flex-1 text-stone-400">{rName(entry.resourceType)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Found keep (at plot) */}
      {atPlot && (
        <div className="border border-stone-700 rounded p-4 bg-stone-800 mb-6">
          <div className="text-xs uppercase tracking-wider text-stone-500 mb-2">Found Keep</div>
          <div className="text-sm text-stone-400 mb-3">
            Requires:{' '}
            {KEEP_FOUNDING_COST.map((c, i) => (
              <span key={c.resource}>
                {i > 0 && <span className="text-stone-600"> + </span>}
                <span className={(cargoMap.get(c.resource) ?? 0) >= c.quantity ? 'text-parchment-200' : 'text-red-400'}>
                  {c.quantity} {rName(c.resource)}
                </span>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-stone-900 border border-stone-700 rounded px-3 py-1.5 text-parchment-100 text-sm placeholder-stone-600 focus:outline-none focus:border-stone-500"
              placeholder="Name your keep..."
              value={foundName}
              onChange={(e) => setFoundName(e.target.value)}
            />
            <button
              className="bg-gold-600 hover:bg-gold-500 disabled:opacity-40 text-stone-900 font-semibold px-4 py-1.5 rounded text-sm"
              disabled={!canFound || !foundName || foundKeep.isPending}
              onClick={() => foundKeep.mutate()}
            >
              Found Keep
            </button>
          </div>
          {foundKeep.isError && <p className="text-red-400 text-xs mt-2">{(foundKeep.error as Error).message}</p>}
        </div>
      )}

      {/* Travel */}
      {isIdle && !atPlot && (
        <div className="border border-stone-700 rounded p-4 bg-stone-800">
          <div className="text-xs uppercase tracking-wider text-stone-500 mb-3">Travel</div>
          <div className="flex gap-2 mb-3">
            {(['KEEP', 'EXCHANGE', 'PLOT'] as const).map((t) => (
              <button key={t}
                className={`px-3 py-1.5 rounded text-xs border transition-colors ${destType === t ? 'border-stone-500 text-parchment-200' : 'border-stone-700 text-stone-500 hover:border-stone-600'}`}
                onClick={() => { setDestType(t); setDestId(''); }}
              >
                {t === 'KEEP' ? 'Keep' : t === 'EXCHANGE' ? 'Exchange' : 'Plot (found)'}
              </button>
            ))}
          </div>

          {destType === 'KEEP' && (
            <select
              className="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-parchment-100 text-sm mb-3 focus:outline-none"
              value={destId}
              onChange={(e) => setDestId(e.target.value)}
            >
              <option value="">Select keep...</option>
              {keeps.filter((k) => k.id !== caravan.locationId).map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          )}

          {destType === 'EXCHANGE' && (
            <div className="text-sm text-stone-400 mb-3">Destination: Central Exchange</div>
          )}

          {destType === 'PLOT' && (
            <select
              className="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-parchment-100 text-sm mb-3 focus:outline-none"
              value={destId}
              onChange={(e) => setDestId(e.target.value)}
            >
              <option value="">Select empty plot...</option>
              {plots.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}

          <button
            className="bg-gold-600 hover:bg-gold-500 disabled:opacity-40 text-stone-900 font-semibold px-5 py-2 rounded text-sm"
            disabled={(destType !== 'EXCHANGE' && !destId) || dispatch.isPending}
            onClick={() => dispatch.mutate()}
          >
            Dispatch
          </button>
        </div>
      )}

      {!isIdle && (
        <div className="border border-stone-700 rounded p-4 bg-stone-800 text-sm text-stone-400">
          Caravan is in transit — arrives{' '}
          {caravan.arrivesAt ? new Date(caravan.arrivesAt).toLocaleTimeString() : '...'}
        </div>
      )}
    </div>
  );
}
