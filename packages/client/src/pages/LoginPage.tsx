import { useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { api, type AuthResponse } from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';
import { Button, Input, Card } from '../components/ui/index.js';

const GOOGLE_CLIENT_ID = import.meta.env['VITE_GOOGLE_CLIENT_ID'] as string;

export default function LoginPage() {
  const navigate  = useNavigate();
  const setAuth   = useAuthStore((s) => s.setAuth);

  const [mode, setMode]           = useState<'login' | 'register'>('login');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-full max-w-sm space-y-6 px-4">

          {/* Brand header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-100">Merchant Realms</h1>
            <p className="text-slate-500 text-sm">Sign in to enter the world</p>
          </div>

          <Card variant="elevated" className="p-6 space-y-5">

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
              <div className="flex-1 h-px bg-slate-700" />
              <span className="text-slate-600 text-xs uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-slate-700" />
            </div>

            {/* Email / password */}
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
              />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
              />
              {mode === 'register' && (
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm password"
                  required
                />
              )}

              {error && (
                <p className="text-red-400 text-sm bg-red-950/30 border border-red-900/40 rounded-lg px-4 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
              </Button>
            </form>

            <p className="text-center text-xs text-slate-500">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                className="text-azure-400 hover:text-azure-300 transition-colors"
              >
                {mode === 'login' ? 'Register' : 'Sign in'}
              </button>
            </p>

          </Card>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}
