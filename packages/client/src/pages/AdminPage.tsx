import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type AdminPlayer, type AdminPlayerDetail } from '../services/api.js';

type Tab = 'controls' | 'players';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('controls');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-gold-400 mb-5">Admin</h1>

      <div className="flex gap-1 mb-6 border-b border-stone-700">
        {(['controls', 'players'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-gold-400 text-gold-400'
                : 'border-transparent text-stone-400 hover:text-parchment-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'controls' && <ControlsTab />}
      {tab === 'players' && (
        <PlayersTab selectedId={selectedId} onSelect={setSelectedId} />
      )}
    </div>
  );
}

// ── Controls tab (existing functionality) ────────────────────────────────────

function ControlsTab() {
  const qc = useQueryClient();

  const { data: status } = useQuery({
    queryKey: ['admin-status'],
    queryFn:  () => api.adminStatus(),
  });

  const tick             = useMutation({ mutationFn: () => api.adminTick(),             onSuccess: () => qc.invalidateQueries() });
  const bypass           = useMutation({ mutationFn: (e: boolean) => api.adminBypass(e), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-status'] }) });
  const completeCaravans = useMutation({ mutationFn: () => api.adminCompleteCaravans(), onSuccess: () => qc.invalidateQueries() });
  const completeProduction = useMutation({ mutationFn: () => api.adminCompleteProduction(), onSuccess: () => qc.invalidateQueries() });

  const last = status?.lastTick;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-stone-800 border border-stone-700 rounded-lg p-4">
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

      <button
        className="w-full bg-gold-600 hover:bg-gold-500 text-stone-900 font-bold py-3 rounded-lg text-sm"
        onClick={() => tick.mutate()} disabled={tick.isPending}
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
        onClick={() => completeProduction.mutate()} disabled={completeProduction.isPending}
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
        onClick={() => completeCaravans.mutate()} disabled={completeCaravans.isPending}
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
        >Bypass ON</button>
        <button
          className={`flex-1 py-2 rounded-lg text-sm font-medium border ${!status?.bypassEnabled ? 'border-red-600 text-red-400' : 'border-stone-600 text-stone-400'}`}
          onClick={() => bypass.mutate(false)}
        >Bypass OFF</button>
      </div>
      <p className="text-xs text-stone-600 text-center">Bypass ON = no resource constraints, workers, or feed requirements</p>
    </div>
  );
}

// ── Players tab ──────────────────────────────────────────────────────────────

function PlayersTab({ selectedId, onSelect }: { selectedId: number | null; onSelect: (id: number | null) => void }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-players'],
    queryFn:  () => api.adminPlayers(),
  });

  if (isLoading) return <div className="text-stone-500 text-sm">Loading players…</div>;
  if (isError) return <QueryError error={error} label="players" />;

  return (
    <div className="flex gap-4">
      {/* Player list */}
      <div className="w-72 shrink-0 space-y-1">
        {(data?.players ?? []).map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(selectedId === p.id ? null : p.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
              selectedId === p.id
                ? 'bg-stone-700 border-gold-600'
                : 'bg-stone-800 border-stone-700 hover:border-stone-500'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-parchment-100 text-sm font-medium truncate">
                {p.empire?.name ?? <span className="text-stone-500 italic">No empire</span>}
              </span>
              {p.isAdmin && <span className="text-xs text-gold-400 shrink-0">ADMIN</span>}
            </div>
            <div className="text-xs text-stone-500 truncate mt-0.5">{p.email}</div>
            <div className="flex gap-3 mt-1 text-xs text-stone-400">
              <span>{(p.empire?.goldBalance ?? 0).toLocaleString()}g</span>
              <span>{p.empire?._count.keeps ?? 0} keeps</span>
              <span>{p.empire?._count.caravans ?? 0} caravans</span>
            </div>
          </button>
        ))}
        {data?.players.length === 0 && (
          <div className="text-stone-500 text-sm">No players yet</div>
        )}
      </div>

      {/* Player detail */}
      {selectedId && (
        <div className="flex-1 min-w-0">
          <PlayerDetail playerId={selectedId} summary={(data?.players ?? []).find((p) => p.id === selectedId) ?? null} onDelete={() => onSelect(null)} />
        </div>
      )}
    </div>
  );
}

// ── Player detail panel ──────────────────────────────────────────────────────

function PlayerDetail({ playerId, summary, onDelete }: { playerId: number; summary: AdminPlayer | null; onDelete: () => void }) {
  const qc = useQueryClient();
  const [goldInput, setGoldInput]   = useState('');
  const [goldOp, setGoldOp]         = useState<'set' | 'add'>('add');
  const [resKeep, setResKeep]       = useState('');
  const [resType, setResType]       = useState('OAK');
  const [resQty, setResQty]         = useState('10');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg]               = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-player', playerId],
    queryFn:  () => api.adminPlayer(playerId),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin-players'] });
    void qc.invalidateQueries({ queryKey: ['admin-player', playerId] });
  };

  const setGold = useMutation({
    mutationFn: () => api.adminSetGold(playerId, Number(goldInput), goldOp),
    onSuccess: (d) => { setMsg(`Gold updated → ${d.goldBalance.toLocaleString()}g`); invalidate(); },
    onError: (e: Error) => setMsg(`Error: ${e.message}`),
  });

  const grantResources = useMutation({
    mutationFn: () => api.adminGrantResources(playerId, parseInt(resKeep), resType, Number(resQty)),
    onSuccess: () => { setMsg(`Granted ${resQty}× ${resType}`); invalidate(); },
    onError: (e: Error) => setMsg(`Error: ${e.message}`),
  });

  const starterCaravan = useMutation({
    mutationFn: () => api.adminStarterCaravan(playerId),
    onSuccess: () => { setMsg('Starter caravan created'); invalidate(); },
    onError: (e: Error) => setMsg(`Error: ${e.message}`),
  });

  const toggleAdmin = useMutation({
    mutationFn: () => api.adminSetAdmin(playerId, !summary?.isAdmin),
    onSuccess: () => { setMsg('Admin status updated'); invalidate(); },
    onError: (e: Error) => setMsg(`Error: ${e.message}`),
  });

  const deletePlayer = useMutation({
    mutationFn: () => api.adminDeletePlayer(playerId),
    onSuccess: () => { onDelete(); void qc.invalidateQueries({ queryKey: ['admin-players'] }); },
    onError: (e: Error) => setMsg(`Error: ${e.message}`),
  });

  if (isLoading) return <div className="text-stone-500 text-sm">Loading…</div>;
  if (isError) return <QueryError error={error} label="player detail" />;
  const p = data?.player;
  if (!p) return null;

  const empire = p.empire;
  const keeps  = empire?.keeps ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-stone-800 border border-stone-700 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-parchment-100 font-semibold text-base">
              {empire?.name ?? <span className="text-stone-500 italic">No empire</span>}
            </div>
            <div className="text-stone-400 text-sm mt-0.5">{p.email}</div>
            <div className="flex gap-4 mt-2 text-xs text-stone-500">
              <span>Joined {new Date(p.createdAt).toLocaleDateString()}</span>
              <span>Auth: {p.googleId ? 'Google' : 'Email'}</span>
              {p.isAdmin && <span className="text-gold-400">ADMIN</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-gold-400 font-mono text-lg">{(empire?.goldBalance ?? 0).toLocaleString()}g</div>
            <div className="text-xs text-stone-500 mt-1">
              {keeps.length} keep{keeps.length !== 1 ? 's' : ''} · {empire?.caravans.length ?? 0} caravans
            </div>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {msg && (
        <div className="text-sm text-green-400 bg-green-950/30 border border-green-900/40 rounded px-3 py-2">
          {msg}
          <button onClick={() => setMsg('')} className="ml-3 text-green-600 hover:text-green-400">×</button>
        </div>
      )}

      {/* Gold */}
      <Section title="Gold">
        <div className="flex gap-2">
          <select
            value={goldOp}
            onChange={(e) => setGoldOp(e.target.value as 'set' | 'add')}
            className="bg-stone-700 border border-stone-600 rounded px-2 py-1.5 text-sm text-parchment-200"
          >
            <option value="add">Add</option>
            <option value="set">Set to</option>
          </select>
          <input
            type="number"
            value={goldInput}
            onChange={(e) => setGoldInput(e.target.value)}
            placeholder="Amount"
            className="flex-1 bg-stone-700 border border-stone-600 rounded px-3 py-1.5 text-sm text-parchment-100 placeholder-stone-500 focus:outline-none focus:border-gold-500"
          />
          <button
            onClick={() => setGold.mutate()}
            disabled={!goldInput || setGold.isPending}
            className="bg-gold-700 hover:bg-gold-600 disabled:bg-stone-700 disabled:text-stone-500 text-stone-900 font-medium px-4 py-1.5 rounded text-sm"
          >
            Apply
          </button>
        </div>
      </Section>

      {/* Resources */}
      {keeps.length > 0 && (
        <Section title="Grant Resources to Keep">
          <div className="space-y-2">
            <select
              value={resKeep}
              onChange={(e) => setResKeep(e.target.value)}
              className="w-full bg-stone-700 border border-stone-600 rounded px-2 py-1.5 text-sm text-parchment-200"
            >
              <option value="">Select keep…</option>
              {keeps.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                value={resType}
                onChange={(e) => setResType(e.target.value.toUpperCase())}
                placeholder="Resource type (e.g. OAK)"
                className="flex-1 bg-stone-700 border border-stone-600 rounded px-3 py-1.5 text-sm text-parchment-100 placeholder-stone-500 focus:outline-none focus:border-gold-500 font-mono"
              />
              <input
                type="number"
                value={resQty}
                onChange={(e) => setResQty(e.target.value)}
                placeholder="Qty"
                className="w-20 bg-stone-700 border border-stone-600 rounded px-3 py-1.5 text-sm text-parchment-100 focus:outline-none focus:border-gold-500"
              />
              <button
                onClick={() => grantResources.mutate()}
                disabled={!resKeep || !resType || !resQty || grantResources.isPending}
                className="bg-stone-600 hover:bg-stone-500 disabled:bg-stone-700 disabled:text-stone-500 text-parchment-200 font-medium px-4 py-1.5 rounded text-sm"
              >
                Grant
              </button>
            </div>
          </div>
        </Section>
      )}

      {/* Keeps */}
      {keeps.length > 0 && (
        <Section title="Keeps & Storage">
          <div className="space-y-2">
            {keeps.map((k) => (
              <div key={k.id} className="bg-stone-700/50 border border-stone-700 rounded p-3">
                <div className="text-parchment-200 text-sm font-medium">{k.name}</div>
                {k.plot && (
                  <div className="text-xs text-stone-500 mt-0.5">{k.plot.district?.name}</div>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
                  {(k.warehouse?.items.length ?? 0) === 0 && (
                    <span className="text-xs text-stone-600">Empty storage</span>
                  )}
                  {(k.warehouse?.items ?? []).map((r) => (
                    <span key={r.id} className="text-xs text-stone-300 font-mono">
                      {r.resourceType}: {Number(r.quantity).toLocaleString()}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Caravans */}
      {(empire?.caravans.length ?? 0) > 0 && (
        <Section title="Caravans">
          <div className="space-y-1.5">
            {empire!.caravans.map((c) => (
              <div key={c.id} className="flex items-center gap-3 text-sm bg-stone-700/50 border border-stone-700 rounded px-3 py-2">
                <span className="text-parchment-200">{c.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${c.status === 'IN_TRANSIT' ? 'bg-amber-900/50 text-amber-400' : 'bg-stone-700 text-stone-400'}`}>
                  {c.status === 'IN_TRANSIT' ? 'In transit' : `${c.locationType.toLowerCase()} · idle`}
                </span>
                {(c.warehouse?.items.length ?? 0) > 0 && (
                  <span className="text-xs text-stone-500 ml-auto">
                    {(c.warehouse?.items ?? []).map((x) => `${x.resourceType}×${x.quantity}`).join(', ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Actions */}
      <Section title="Actions">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => starterCaravan.mutate()}
            disabled={starterCaravan.isPending}
            className="bg-stone-700 hover:bg-stone-600 text-parchment-200 text-sm font-medium px-3 py-1.5 rounded"
          >
            + Starter Caravan
          </button>
          <button
            onClick={() => toggleAdmin.mutate()}
            disabled={toggleAdmin.isPending}
            className={`text-sm font-medium px-3 py-1.5 rounded border ${
              summary?.isAdmin
                ? 'border-gold-700 text-gold-400 hover:bg-gold-950/30'
                : 'border-stone-600 text-stone-400 hover:bg-stone-700'
            }`}
          >
            {summary?.isAdmin ? 'Revoke Admin' : 'Grant Admin'}
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="ml-auto text-sm text-red-500 hover:text-red-400 px-3 py-1.5"
            >
              Delete Player
            </button>
          ) : (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-red-400">Delete all data?</span>
              <button onClick={() => deletePlayer.mutate()} className="text-sm text-red-400 hover:text-red-300 font-medium">Yes, delete</button>
              <button onClick={() => setConfirmDelete(false)} className="text-sm text-stone-400 hover:text-stone-300">Cancel</button>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-stone-800 border border-stone-700 rounded-lg p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function QueryError({ error, label }: { error: unknown; label: string }) {
  const msg = error instanceof Error ? error.message : 'Unknown error';
  return (
    <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-4 py-3">
      Failed to load {label}: {msg}
    </div>
  );
}
