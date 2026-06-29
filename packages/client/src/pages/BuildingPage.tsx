import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { BUILDING_NAMES, BUILDING_TYPE_BY_ID, WORKERS_PER_LEVEL } from '@merchant-realms/shared';
import type { BuildingType } from '@merchant-realms/shared';

export default function BuildingPage() {
  const { keepId: keepIdStr, buildingId: buildingIdStr } = useParams<{ keepId: string; buildingId: string }>();
  const keepId     = parseInt(keepIdStr!);
  const buildingId = parseInt(buildingIdStr!);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: keepData } = useQuery({
    queryKey: ['keep', keepId],
    queryFn: () => api.keep(keepId),
  });

  const demolish = useMutation({
    mutationFn: () => api.demolish(keepId, buildingId),
    onSuccess: () => navigate(`/kingdom/${keepId}/buildings`),
  });

  const building = keepData?.keep.buildings.find((b) => b.id === buildingId);

  if (!building) return <div className="p-8 text-slate-400 text-sm">Loading...</div>;

  const buildingTypeCode = BUILDING_TYPE_BY_ID[building.buildingTypeId] as BuildingType | undefined;
  const workerCost = building.level * WORKERS_PER_LEVEL;

  return (
    <div className="p-8 max-w-lg">
      <button onClick={() => navigate(`/kingdom/${keepId}/buildings`)} className="text-slate-500 hover:text-slate-300 text-xs mb-5">← Buildings</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">
            {buildingTypeCode ? (BUILDING_NAMES[buildingTypeCode as keyof typeof BUILDING_NAMES] ?? buildingTypeCode) : String(building.buildingTypeId)}
          </h1>
          <div className="text-slate-500 text-sm mt-1">
            Level {building.level}
            <span className="mx-1.5 text-slate-700">·</span>
            {building.health.toFixed(0)}% health
            {building.isDormant && <span className="text-red-400 ml-2">Dormant</span>}
          </div>
        </div>
        <button
          onClick={() => { if (window.confirm('Demolish this building?')) demolish.mutate(); }}
          className="text-slate-500 hover:text-red-400 text-xs border border-slate-700 hover:border-red-800 px-3 py-1.5 rounded transition-colors"
        >
          Demolish
        </button>
      </div>

      <div className="border border-slate-700 rounded p-4 bg-slate-800 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Workers required</span>
          <span className="text-slate-200">{workerCost} ({WORKERS_PER_LEVEL} × Lv.{building.level})</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Status</span>
          <span className={building.isDormant ? 'text-red-400' : building.isActive ? 'text-slate-300' : 'text-slate-500'}>
            {building.isDormant ? 'Dormant' : building.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <p className="text-slate-600 text-xs mt-4">Manage production orders from the Keep overview.</p>
    </div>
  );
}
