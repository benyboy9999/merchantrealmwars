import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';

export default function CreateEmpirePage() {
  const navigate  = useNavigate();
  const setAuth   = useAuthStore((s) => s.setAuth);

  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 40) {
      setError('Empire name must be 2–40 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.createEmpire(trimmed);
      // Replace the stored token with the new one that carries empireId,
      // so all subsequent requests include the empire context.
      setAuth(data.accessToken, data.refreshToken, data.empire.id, data.empire.name);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create empire');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-full max-w-sm space-y-8 px-4">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Welcome</h1>
          <p className="text-slate-400 text-sm">Name your empire to begin</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-8 space-y-5">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
              Empire Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Iron Crown Trading Co."
              maxLength={40}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-azure-500 transition-colors"
              autoFocus
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || name.trim().length < 2}
            className="w-full bg-azure-500 hover:bg-azure-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? 'Creating…' : 'Found Empire'}
          </button>
        </form>
      </div>
    </div>
  );
}
