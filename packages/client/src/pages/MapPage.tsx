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
    queryKey: ['plots'],
    queryFn: () => api.plots('CENTRAL'),
    refetchInterval: 10000,
  });

  const createKeep = useMutation({
    mutationFn: ({ plotId, name }: { plotId: string; name: string }) => api.createKeep(plotId, name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plots'] }); setSelectedPlot(null); setNewKeepName(''); },
  });

  if (isLoading) return <div className="p-8 text-parchment-200">Loading region...</div>;

  const plots = data?.plots ?? [];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gold-400 mb-2">Central Region</h1>
      <p className="text-parchment-200 text-sm mb-6">5 plots available — concept testbed</p>

      <div className="grid grid-cols-3 gap-4 max-w-2xl">
        {plots.map((plot) => {
          const keep = plot.keeps?.[0];
          return (
            <div
              key={plot.id}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                keep
                  ? 'border-gold-500 bg-stone-800 hover:bg-stone-700'
                  : 'border-stone-600 bg-stone-900 hover:border-stone-500'
              }`}
              onClick={() => keep ? navigate(`/keeps/${keep.id}`) : setSelectedPlot(plot.id)}
            >
              <div className="font-semibold text-parchment-100">{plot.name}</div>
              <div className="text-xs text-stone-400 mt-1">({plot.x}, {plot.y})</div>
              {keep ? (
                <div className="mt-2 text-sm text-gold-400">{keep.name}</div>
              ) : (
                <div className="mt-2 text-xs text-stone-500">Empty plot</div>
              )}
            </div>
          );
        })}
      </div>

      {selectedPlot && (
        <div className="mt-6 max-w-sm">
          <div className="text-parchment-200 mb-2 font-medium">Name your Keep:</div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-stone-800 border border-stone-600 rounded px-3 py-2 text-parchment-100 text-sm"
              placeholder="Keep name..."
              value={newKeepName}
              onChange={(e) => setNewKeepName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && newKeepName && createKeep.mutate({ plotId: selectedPlot, name: newKeepName })}
            />
            <button
              className="bg-gold-600 hover:bg-gold-500 text-stone-900 font-semibold px-4 py-2 rounded text-sm"
              onClick={() => newKeepName && createKeep.mutate({ plotId: selectedPlot, name: newKeepName })}
            >
              Build
            </button>
            <button
              className="text-stone-400 hover:text-stone-200 px-3 py-2 text-sm"
              onClick={() => setSelectedPlot(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
