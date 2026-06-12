import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../services/api.js';

export default function MapPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [newKeepName, setNewKeepName] = useState('');
  const [selectedPlot, setSelectedPlot] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['districts'],
    queryFn: () => api.districts('CENTRAL'),
    refetchInterval: 10000,
  });

  const createKeep = useMutation({
    mutationFn: ({ plotId, name }: { plotId: string; name: string }) => api.createKeep(plotId, name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['districts'] }); setSelectedPlot(null); setNewKeepName(''); },
  });

  if (isLoading) return <div className="p-8 text-stone-400 text-sm">Loading...</div>;

  const plots = (data?.districts ?? []).flatMap((d) => d.plots);

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-parchment-100">Central Region</h1>
        <p className="text-stone-500 text-sm mt-1">{data?.districts?.length ?? 0} districts · {plots.length} plots · 1 exchange</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Plots */}
        {plots.map((plot) => {
          const keep = plot.keeps?.[0];
          const isSelected = selectedPlot === plot.id;
          return (
            <div key={plot.id} className="flex flex-col">
              <div
                className={`border rounded p-4 cursor-pointer transition-colors ${
                  keep
                    ? 'border-stone-600 bg-stone-800 hover:bg-stone-700'
                    : isSelected
                      ? 'border-stone-500 bg-stone-800'
                      : 'border-stone-700 bg-stone-800/50 hover:border-stone-600'
                }`}
                onClick={() => keep ? navigate(`/keeps/${keep.id}`) : setSelectedPlot(isSelected ? null : plot.id)}
              >
                <div className="text-sm font-medium text-parchment-200">{plot.name}</div>
                <div className="text-xs text-stone-500 mt-0.5">({plot.x}, {plot.y})</div>
                {keep ? (
                  <div className="mt-2 text-xs text-gold-400">{keep.name}</div>
                ) : (
                  <div className="mt-2 text-xs text-stone-600">Empty</div>
                )}
              </div>

              {isSelected && !keep && (
                <div className="mt-2 flex gap-2">
                  <input
                    autoFocus
                    className="flex-1 bg-stone-800 border border-stone-600 rounded px-3 py-1.5 text-parchment-100 text-sm placeholder-stone-600 focus:outline-none focus:border-stone-500"
                    placeholder="Keep name..."
                    value={newKeepName}
                    onChange={(e) => setNewKeepName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && newKeepName && createKeep.mutate({ plotId: plot.id, name: newKeepName })}
                  />
                  <button
                    className="bg-gold-600 hover:bg-gold-500 text-stone-900 font-semibold px-3 py-1.5 rounded text-sm disabled:opacity-40"
                    disabled={!newKeepName}
                    onClick={() => newKeepName && createKeep.mutate({ plotId: plot.id, name: newKeepName })}
                  >
                    Build
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Exchange tile */}
        <div
          className="border border-gold-600/30 bg-stone-800/50 hover:bg-stone-800 rounded p-4 cursor-pointer transition-colors"
          onClick={() => navigate('/exchange')}
        >
          <div className="text-sm font-medium text-gold-400">Exchange</div>
          <div className="text-xs text-stone-500 mt-0.5">Central Region</div>
          <div className="mt-2 text-xs text-stone-500">Market · Warehouse</div>
        </div>
      </div>
    </div>
  );
}
