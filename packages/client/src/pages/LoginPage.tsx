import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  async function handleGoogleSuccess(credentialResponse: { credential?: string }) {
    if (!credentialResponse.credential) return;
    try {
      const data = await api.loginGoogle(credentialResponse.credential);
      setAuth(data.accessToken, data.player.id, data.player.username, data.empireId);
      navigate(data.empireId ? '/' : '/create-empire', { replace: true });
    } catch (err) {
      console.error('Google login failed:', err);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-full max-w-sm space-y-8 px-4">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Merchant Realms</h1>
          <p className="text-zinc-400 text-sm">Sign in to enter the world</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 space-y-6">
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => console.error('Google login error')}
              theme="filled_black"
              shape="rectangular"
              size="large"
              text="signin_with"
              width="280"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
