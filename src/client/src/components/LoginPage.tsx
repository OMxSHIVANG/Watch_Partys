import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Tv, Loader2, AlertCircle } from 'lucide-react';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, authError, clearAuthError, isLoading } = useAuth();

  
  useEffect(() => {
    const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    if (!GOOGLE_CLIENT_ID) return;

    const setupGoogleButton = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: any) => {
          clearAuthError();
          await loginWithGoogle(response.credential);
        },
      });

      const btnContainer = document.getElementById('google-btn');
      if (btnContainer) {
        btnContainer.innerHTML = '';
        window.google.accounts.id.renderButton(
          btnContainer,
          { theme: 'filled_black', size: 'large', width: 340, shape: 'rectangular', text: 'continue_with', logo_alignment: 'left' }
        );
      }
    };

    if (window.google?.accounts?.id) {
      setupGoogleButton();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = setupGoogleButton;
    document.head.appendChild(script);

    return () => {
      // Do not remove script to keep it available on re-mounts
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md relative z-10">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          
          <div className="p-8 sm:p-10 space-y-8 text-center">
            {/* Logo */}
            <div className="w-16 h-16 rounded-xl bg-rose-600 flex items-center justify-center shadow-lg mx-auto">
              <Tv className="w-8 h-8 text-white" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">Welcome to WatchParty</h1>
              <p className="text-sm text-slate-400 font-medium">Sync YouTube videos with friends in real-time</p>
            </div>

            {authError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium text-left">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {authError}
              </div>
            )}

            <div className="space-y-4 pt-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 p-4">
                  <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
                  <p className="text-xs text-slate-400 font-medium">Signing in with Google...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center w-full">
                  {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
                    <div className="w-full flex justify-center">
                      <div id="google-btn" className="w-full max-w-[340px] flex justify-center min-h-[44px]"></div>
                    </div>
                  ) : (
                    <button
                      onClick={() => alert('Please configure VITE_GOOGLE_CLIENT_ID in your .env file to enable Google Sign-In.')}
                      className="w-full max-w-[340px] flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-800 font-semibold py-3 px-4 rounded-xl transition-all border border-slate-200 shadow-md hover:shadow-lg active:scale-[0.99]"
                    >
                      <GoogleIcon />
                      <span>Continue with Google</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <p className="text-xs text-slate-500">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

declare global { interface Window { google: any; } }
