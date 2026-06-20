import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { BUILDING_NAMES, WORKERS_PER_LEVEL } from '@merchant-realms/shared';

export default function BuildingPage() {
  const { keepId, buildingId } = useParams<{ keepId: string; buildingId: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: keepData } = useQuery({
    queryKey: ['keep', keepId],
    queryFn: () => api.keep(keepId!),
  });

  const demolish = useMutation({
    mutationFn: () => api.demolish(keepId!, buildingId!),
    onSuccess: () => navigate(`/kingdom/${keepId}/buildings`),
  });

  const building = keepData?.keep.buildings.find((b) => b.id === buildingId);

  if (!building) return <div className="p-8 text-stone-400 text-sm">Loading...</div>;

  const buildingType = building.buildingType;
  const workerCost = building.level * WORKERS_PER_LEVEL;

  return (
    <div className="p-8 max-w-lg">
      <button onClick={() => navigate(`/kingdom/${keepId}/buildings`)} className="text-stone-500 hover:text-stone-300 text-xs mb-5">← Buildings</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-parchment-100">
            {BUILDING_NAMES[buildingType as keyof typeof BUILDING_NAMES] ?? buildingType}
          </h1>
          <div className="text-stone-500 text-sm mt-1">
            Level {building.level}
            <span className="mx-1.5 text-stone-700">·</span>
            {building.health.toFixed(0)}% health
            {building.isDormant && <span className="text-red-400 ml-2">Dormant</span>}
          </div>
        </div>
        <button
          onClick={() => { if (window.confirm('Demolish this building?')) demolish.mutate(); }}
          className="text-stone-500 hover:text-red-400 text-xs border border-stone-700 hover:border-red-800 px-3 py-1.5 rounded transition-colors"
        >
          Demolish
        </button>
      </div>

      <div className="border border-stone-700 rounded p-4 bg-stone-800 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-stone-500">Workers required</span>
          <span className="text-parchment-200">{workerCost} ({WORKERS_PER_LEVEL} × Lv.{building.level})</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-500">Status</span>
          <span className={building.isDormant ? 'text-red-400' : building.isActive ? 'text-stone-300' : 'text-stone-500'}>
            {building.isDormant ? 'Dormant' : building.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <p className="text-stone-600 text-xs mt-4">Manage production orders from the Keep overview.</p>
    </div>
  );
}
