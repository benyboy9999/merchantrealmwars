import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { BUILDING_NAMES, BUILDING_TYPE_BY_ID, WORKERS_PER_LEVEL, BUILDING_CONSTRUCTION_COSTS, BUILDING_MAX_LEVEL, RESOURCE_NAMES } from '@merchant-realms/shared';
import type { BuildingType } from '@merchant-realms/shared';
import type { WarehouseItem } from '../services/api.js';
import { Button } from '../components/ui/index.js';

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

  const upgrade = useMutation({
    mutationFn: () => api.upgradeBuilding(keepId, buildingId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['keep', keepId] }),
  });

  const building = keepData?.keep.buildings.find((b) => b.id === buildingId);

  if (!building) return <div className="p-8 text-slate-400 text-sm">Loading...</div>;

  const buildingTypeCode = BUILDING_TYPE_BY_ID[building.buildingTypeId] as BuildingType | undefined;
  const workerCost       = building.level * WORKERS_PER_LEVEL;
  const atMaxLevel       = building.level >= BUILDING_MAX_LEVEL;

  // TODO: replace with server-derived cost once non-linear scaling is implemented
  const upgradeCost: Array<{ resource: string; quantity: number }> =
    (buildingTypeCode ? BUILDING_CONSTRUCTION_COSTS[buildingTypeCode] : undefined) ?? [];

  const warehouseItems: WarehouseItem[] = keepData?.keep.warehouse?.items ?? [];
  const warehouseMap = new Map(warehouseItems.map((i) => [i.resourceType, i.quantity]));

  const canAffordUpgrade = !atMaxLevel && upgradeCost.every(
    ({ resource, quantity }) => (warehouseMap.get(resource) ?? 0) >= quantity,
  );

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
            {atMaxLevel && <span className="text-gold-400 ml-2 text-xs">Max level</span>}
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

      {/* Stats */}
      <div className="border border-slate-700 rounded p-4 bg-slate-800/60 space-y-2 text-sm mb-4">
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

      {/* Upgrade section */}
      <div className="border border-slate-700 rounded p-4 bg-slate-800/60 text-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-300 font-medium">
            {atMaxLevel ? 'Max Level Reached' : `Upgrade to Level ${building.level + 1}`}
          </span>
          {!atMaxLevel && (
            <span className="text-slate-600 text-xs">Max: {BUILDING_MAX_LEVEL}</span>
          )}
        </div>

        {atMaxLevel ? (
          <p className="text-slate-600 text-xs">This building cannot be upgraded further.</p>
        ) : (
          <>
            {upgradeCost.length === 0 ? (
              <p className="text-slate-600 text-xs mb-3">No materials required.</p>
            ) : (
              <div className="space-y-1.5 mb-3">
                {upgradeCost.map(({ resource, quantity }) => {
                  const have   = warehouseMap.get(resource) ?? 0;
                  const enough = have >= quantity;
                  return (
                    <div key={resource} className="flex justify-between items-center">
                      <span className="text-slate-400">
                        {RESOURCE_NAMES[resource as keyof typeof RESOURCE_NAMES] ?? resource}
                      </span>
                      <span className={enough ? 'text-slate-300' : 'text-red-400'}>
                        {quantity}
                        <span className="text-slate-600 ml-1.5">/ {Math.floor(have)} in warehouse</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {upgrade.isError && (
              <p className="text-red-400 text-xs mb-2">
                {(upgrade.error as Error).message}
              </p>
            )}

            <Button
              variant="primary"
              size="sm"
              disabled={!canAffordUpgrade || upgrade.isPending}
              onClick={() => upgrade.mutate()}
              className="w-full"
            >
              {upgrade.isPending ? 'Upgrading…' : `Upgrade to Level ${building.level + 1}`}
            </Button>
          </>
        )}
      </div>

      <p className="text-slate-600 text-xs mt-4">Manage production orders from the Keep overview.</p>
    </div>
  );
}
