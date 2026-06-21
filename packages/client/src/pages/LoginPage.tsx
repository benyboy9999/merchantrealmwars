import { useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { api, type AuthResponse } from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';

const GOOGLE_CLIENT_ID = import.meta.env['VITE_GOOGLE_CLIENT_ID'] as string;

export default function LoginPage() {
  const navigate  = useNavigate();
  const setAuth   = useAuthStore((s) => s.setAuth);

  const [mode, setMode]       = useState<'login' | 'register'>('login');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  function handleAuthSuccess(data: AuthResponse) {
    setAuth(data.accessToken, data.refreshToken, data.empireId, data.empireName);
    navigate(data.empireId ? '/' : '/create-empire', { replace: true });
  }

  async function handleGoogleSuccess(credentialResponse: { credential?: string }) {
    if (!credentialResponse.credential) { setError('No credential returned from Google'); return; }
    setLoading(true); setError('');
    try {
      handleAuthSuccess(await api.loginGoogle(credentialResponse.credential));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally { setLoading(false); }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (mode === 'register') {
      if (password !== confirm) { setError('Passwords do not match'); return; }
      if (password.length < 8)  { setError('Password must be at least 8 characters'); return; }
    }

    setLoading(true);
    try {
      const data = mode === 'register'
        ? await api.register(email, password)
        : await api.loginEmail(email, password);
      handleAuthSuccess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally { setLoading(false); }
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-full max-w-sm space-y-6 px-4">

          <div className="text-center space-y-1">
            <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Merchant Realms</h1>
            <p className="text-zinc-500 text-sm">Sign in to enter the world</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">

            {/* Google */}
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google sign-in failed — check popup blocker')}
                theme="filled_black"
                shape="rectangular"
                size="large"
                text="signin_with"
                width="280"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-zinc-600 text-xs uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            {/* Email / password */}
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors text-sm"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors text-sm"
              />
              {mode === 'register' && (
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm password"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors text-sm"
                />
              )}

              {error && (
                <p className="text-red-400 text-sm bg-red-950/30 border border-red-900/40 rounded-lg px-4 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
              >
                {loading ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
              </button>
            </form>

            <p className="text-center text-xs text-zinc-500">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                className="text-amber-500 hover:text-amber-400 transition-colors"
              >
                {mode === 'login' ? 'Register' : 'Sign in'}
              </button>
            </p>

          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}
