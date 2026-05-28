import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../services/api.js';
import { BUILDING_NAMES, RESOURCE_NAMES, RESOURCE_WEIGHT } from '@artemis/shared';
import { ALL_RECIPES, RECIPES_BY_BUILDING } from '@artemis/engine';

export default function KeepPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [buildingType, setBuildingType] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['keep', id],
    queryFn: () => api.keep(id!),
    refetchInterval: 5000,
  });

  const construct = useMutation({
    mutationFn: ({ bType, slot }: { bType: string; slot: number }) =>
      api.buildBuilding(id!, bType, slot),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['keep', id] }); setSelectedSlot(null); setBuildingType(''); },
  });

  if (isLoading || !data) return <div className="p-8 text-parchment-200">Loading keep...</div>;

  const { keep, storage } = data;
  const slotCount = keep.buildingSlotCount;
  const buildingsBySlot = new Map(keep.buildings.map((b) => [b.slotIndex, b]));

  const weightPct = Math.min(100, (storage.usedWeight / storage.maxWeight) * 100);

  return (
    <div className="p-8 max-w-4xl">
      <button onClick={() => navigate('/')} className="text-stone-400 hover:text-parchment-200 text-sm mb-4 flex items-center gap-1">← Map</button>
      <h1 className="text-2xl font-bold text-gold-400 mb-1">{keep.name}</h1>
      <p className="text-stone-400 text-sm mb-6">{keep.plot?.name ?? 'Central Region'}</p>

      {/* Storage bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-parchment-200 mb-1">
          <span>Storage</span>
          <span>{storage.usedWeight} / {storage.maxWeight} kg</span>
        </div>
        <div className="h-2 bg-stone-700 rounded">
          <div className="h-2 rounded bg-gold-500" style={{ width: `${weightPct}%` }} />
        </div>
      </div>

      {/* Building slots grid */}
      <h2 className="text-lg font-semibold text-parchment-100 mb-3">Building Slots ({slotCount})</h2>
      <div className="grid grid-cols-3 gap-3 mb-8">
        {Array.from({ length: slotCount }, (_, i) => {
          const building = buildingsBySlot.get(i);
          return (
            <div
              key={i}
              className={`border rounded-lg p-3 min-h-[90px] cursor-pointer transition-colors ${
                building ? 'border-stone-600 bg-stone-800 hover:bg-stone-700' : 'border-dashed border-stone-700 bg-stone-900 hover:border-stone-500'
              }`}
              onClick={() => building ? navigate(`/keeps/${id}/buildings/${building.id}`) : setSelectedSlot(i)}
            >
              {building ? (
                <>
                  <div className="text-sm font-medium text-parchment-100">
                    {BUILDING_NAMES[building.buildingType as keyof typeof BUILDING_NAMES] ?? building.buildingType}
                  </div>
                  <div className="text-xs text-stone-400 mt-1">Lv.{building.level} · {building.health.toFixed(0)}% health</div>
                  <div className="text-xs text-stone-500 mt-1">{building.workersAssigned} workers</div>
                </>
              ) : (
                <div className="text-stone-600 text-xs text-center pt-4">Slot {i + 1}<br/>Empty</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Build dialog */}
      {selectedSlot !== null && (
        <div className="mb-8 border border-stone-600 rounded-lg p-4 max-w-sm bg-stone-800">
          <div className="text-parchment-200 font-medium mb-3">Construct in Slot {selectedSlot + 1}</div>
          <select
            className="w-full bg-stone-900 border border-stone-600 rounded px-3 py-2 text-parchment-100 text-sm mb-3"
            value={buildingType}
            onChange={(e) => setBuildingType(e.target.value)}
          >
            <option value="">Select building...</option>
            {Object.keys(BUILDING_NAMES).map((bt) => (
              <option key={bt} value={bt}>{BUILDING_NAMES[bt as keyof typeof BUILDING_NAMES]}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              className="bg-gold-600 hover:bg-gold-500 text-stone-900 font-semibold px-4 py-2 rounded text-sm"
              onClick={() => buildingType && construct.mutate({ bType: buildingType, slot: selectedSlot })}
            >
              Build
            </button>
            <button className="text-stone-400 hover:text-stone-200 text-sm" onClick={() => setSelectedSlot(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Resource ledger */}
      <h2 className="text-lg font-semibold text-parchment-100 mb-3">Resources</h2>
      {keep.resourceLedger.length === 0 ? (
        <p className="text-stone-500 text-sm">No resources yet — start production to accumulate goods.</p>
      ) : (
        <div className="grid grid-cols-2 gap-1 max-w-md">
          {keep.resourceLedger
            .filter((e) => e.quantity > 0)
            .sort((a, b) => b.quantity - a.quantity)
            .map((entry) => (
              <div key={entry.id} className="flex justify-between text-sm py-1 border-b border-stone-800">
                <span className="text-parchment-200">{RESOURCE_NAMES[entry.resourceType as keyof typeof RESOURCE_NAMES] ?? entry.resourceType}</span>
                <span className="text-gold-400 font-mono">{entry.quantity.toFixed(1)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
