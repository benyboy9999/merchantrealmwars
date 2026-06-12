import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api.js';

export default function AdminPage() {
  const qc = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ['admin-status'],
    queryFn: () => api.adminStatus(),
    refetchInterval: 3000,
  });

  const tick = useMutation({
    mutationFn: () => api.adminTick(),
    onSuccess: () => qc.invalidateQueries(),
  });

  const bypass = useMutation({
    mutationFn: (enabled: boolean) => api.adminBypass(enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-status'] }),
  });

  const completeCaravans = useMutation({
    mutationFn: () => api.adminCompleteCaravans(),
    onSuccess: () => qc.invalidateQueries(),
  });

  const completeProduction = useMutation({
    mutationFn: () => api.adminCompleteProduction(),
    onSuccess: () => qc.invalidateQueries(),
  });

  const last = status?.lastTick;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gold-400 mb-6">Admin Controls</h1>

      {/* Status */}
      <div className="bg-stone-800 border border-stone-700 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-stone-500">Last tick</span>
            <div className="text-parchment-200 font-mono mt-0.5">
              {last ? `#${last.tickNumber} (${last.durationMs}ms)` : 'None yet'}
            </div>
          </div>
          <div>
            <span className="text-stone-500">Admin bypass</span>
            <div className={`font-semibold mt-0.5 ${status?.bypassEnabled ? 'text-green-400' : 'text-red-400'}`}>
              {status?.bypassEnabled ? 'ON — no resource constraints' : 'OFF — normal rules'}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-3">
        <button
          className="w-full bg-gold-600 hover:bg-gold-500 text-stone-900 font-bold py-3 rounded-lg text-sm"
          onClick={() => tick.mutate()}
          disabled={tick.isPending}
        >
          {tick.isPending ? 'Running tick...' : '⚡ Run Tick Now'}
        </button>

        {tick.data && (
          <div className="text-xs text-stone-400 text-center">
            Tick {tick.data.tickNumber} — {tick.data.durationMs}ms · produced: {tick.data.produced} · delivered: {tick.data.delivered}
          </div>
        )}

        <button
          className="w-full bg-stone-700 hover:bg-stone-600 text-parchment-200 font-medium py-3 rounded-lg text-sm"
          onClick={() => completeProduction.mutate()}
          disabled={completeProduction.isPending}
        >
          ⚒ Complete All Production Queues
        </button>

        {completeProduction.data && (
          <div className="text-xs text-stone-400 text-center">
            {completeProduction.data.completed} batch{completeProduction.data.completed !== 1 ? 'es' : ''} completed
          </div>
        )}

        <button
          className="w-full bg-stone-700 hover:bg-stone-600 text-parchment-200 font-medium py-3 rounded-lg text-sm"
          onClick={() => completeCaravans.mutate()}
          disabled={completeCaravans.isPending}
        >
          🚚 Instant Complete All Caravans
        </button>

        {completeCaravans.data && (
          <div className="text-xs text-stone-400 text-center">
            {completeCaravans.data.completed} caravan{completeCaravans.data.completed !== 1 ? 's' : ''} delivered
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            className={`flex-1 py-2 rounded-lg text-sm font-medium border ${status?.bypassEnabled ? 'border-green-600 text-green-400' : 'border-stone-600 text-stone-400'}`}
            onClick={() => bypass.mutate(true)}
          >
            Bypass ON
          </button>
          <button
            className={`flex-1 py-2 rounded-lg text-sm font-medium border ${!status?.bypassEnabled ? 'border-red-600 text-red-400' : 'border-stone-600 text-stone-400'}`}
            onClick={() => bypass.mutate(false)}
          >
            Bypass OFF
          </button>
        </div>
        <p className="text-xs text-stone-600 text-center">Bypass ON = no resource constraints, workers, or feed requirements</p>
      </div>
    </div>
  );
}
