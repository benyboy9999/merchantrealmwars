import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../services/api.js';
import { RESOURCE_NAMES } from '@artemis/shared';

export default function CaravanPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ fromKeepId: '', toKeepId: '', resourceType: '', quantity: '10', animalType: 'MULE', animalCount: '1', feedLoaded: '0' });

  const { data: caravanData } = useQuery({ queryKey: ['caravans'], queryFn: () => api.caravans(), refetchInterval: 3000 });
  const { data: keepData }    = useQuery({ queryKey: ['keeps'],    queryFn: () => api.keeps() });

  const dispatch = useMutation({
    mutationFn: () => api.dispatch({
      fromKeepId:   form.fromKeepId,
      toKeepId:     form.toKeepId,
      resourceType: form.resourceType,
      quantity:     Number(form.quantity),
      animalType:   form.animalType as 'MULE' | 'HORSE',
      animalCount:  Number(form.animalCount),
      feedLoaded:   Number(form.feedLoaded),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['caravans'] }),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.cancelCaravan(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['caravans'] }),
  });

  const caravans = caravanData?.caravans ?? [];
  const keeps    = keepData?.keeps ?? [];
  const inTransit = caravans.filter((c) => c.status === 'IN_TRANSIT');
  const history   = caravans.filter((c) => c.status !== 'IN_TRANSIT').slice(0, 10);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gold-400 mb-6">Caravans</h1>

      {/* Dispatch form */}
      <div className="border border-stone-700 rounded-lg p-4 bg-stone-800 mb-8">
        <h2 className="text-parchment-200 font-semibold mb-4">Dispatch Caravan</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-stone-500 block mb-1">From Keep</label>
            <select className="w-full bg-stone-900 border border-stone-600 rounded px-3 py-2 text-parchment-100 text-sm"
              value={form.fromKeepId} onChange={(e) => set('fromKeepId', e.target.value)}>
              <option value="">Select...</option>
              {keeps.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">To Keep</label>
            <select className="w-full bg-stone-900 border border-stone-600 rounded px-3 py-2 text-parchment-100 text-sm"
              value={form.toKeepId} onChange={(e) => set('toKeepId', e.target.value)}>
              <option value="">Select...</option>
              {keeps.filter((k) => k.id !== form.fromKeepId).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Resource</label>
            <select className="w-full bg-stone-900 border border-stone-600 rounded px-3 py-2 text-parchment-100 text-sm"
              value={form.resourceType} onChange={(e) => set('resourceType', e.target.value)}>
              <option value="">Select...</option>
              {Object.entries(RESOURCE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Quantity</label>
            <input type="number" className="w-full bg-stone-900 border border-stone-600 rounded px-3 py-2 text-parchment-100 text-sm"
              value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Animal</label>
            <select className="w-full bg-stone-900 border border-stone-600 rounded px-3 py-2 text-parchment-100 text-sm"
              value={form.animalType} onChange={(e) => set('animalType', e.target.value)}>
              <option value="MULE">Mule</option>
              <option value="HORSE">Horse</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Animal Count</label>
            <input type="number" min={1} className="w-full bg-stone-900 border border-stone-600 rounded px-3 py-2 text-parchment-100 text-sm"
              value={form.animalCount} onChange={(e) => set('animalCount', e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-stone-500 mb-3">Feed requirement: auto-calculated. In admin bypass mode, departure always succeeds.</p>
        <button
          className="bg-gold-600 hover:bg-gold-500 text-stone-900 font-bold px-6 py-2 rounded text-sm"
          onClick={() => dispatch.mutate()}
          disabled={!form.fromKeepId || !form.toKeepId || !form.resourceType}
        >
          Dispatch
        </button>
      </div>

      {/* In transit */}
      {inTransit.length > 0 && (
        <div className="mb-6">
          <h2 className="text-parchment-100 font-semibold mb-3">In Transit ({inTransit.length})</h2>
          <div className="space-y-2">
            {inTransit.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-stone-800 border border-stone-700 rounded px-4 py-3 text-sm">
                <div>
                  <span className="text-parchment-200">{c.quantity} × {RESOURCE_NAMES[c.resourceType as keyof typeof RESOURCE_NAMES] ?? c.resourceType}</span>
                  <span className="text-stone-500 ml-2">{c.animalCount} {c.animalType.toLowerCase()}{c.animalCount > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-stone-500">arrives {new Date(c.arrivesAt).toLocaleTimeString()}</span>
                  <button onClick={() => cancel.mutate(c.id)} className="text-red-500 hover:text-red-400 text-xs">Cancel</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <h2 className="text-parchment-100 font-semibold mb-3">Recent History</h2>
          <div className="space-y-1">
            {history.map((c) => (
              <div key={c.id} className="flex justify-between text-sm text-stone-500 py-1 border-b border-stone-800">
                <span>{c.quantity} × {RESOURCE_NAMES[c.resourceType as keyof typeof RESOURCE_NAMES] ?? c.resourceType}</span>
                <span className={c.status === 'ARRIVED' ? 'text-green-500' : 'text-red-500'}>{c.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
