import React, { useState } from 'react';

export interface ServerConfig {
  mode: 'local' | 'remote';
  remoteIp?: string;
  sessionId: string;
}

interface SetupModalProps {
  onSave: (config: ServerConfig) => void;
  initialConfig?: ServerConfig | null;
}

export function SetupModal({ onSave, initialConfig }: SetupModalProps) {
  const [mode, setMode] = useState<'local' | 'remote'>(initialConfig?.mode || 'local');
  const [remoteIp, setRemoteIp] = useState(initialConfig?.remoteIp || '');

  const handleSave = () => {
    onSave({
      mode,
      remoteIp: mode === 'remote' ? remoteIp : undefined,
      sessionId: initialConfig?.sessionId || `web-session-${Date.now()}`
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl shadow-black">
        <h2 className="text-xl font-semibold mb-4 text-white">Gemini CLI Server Setup</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Connection Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('local')}
                className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                  mode === 'local' 
                    ? 'bg-primary/20 border-primary text-primary' 
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                Localhost
              </button>
              <button
                onClick={() => setMode('remote')}
                className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                  mode === 'remote' 
                    ? 'bg-primary/20 border-primary text-primary' 
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                Remote (Tailscale)
              </button>
            </div>
          </div>

          {mode === 'remote' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="block text-sm text-zinc-400 mb-2">Tailscale IP Address</label>
              <input
                type="text"
                value={remoteIp}
                onChange={e => setRemoteIp(e.target.value)}
                placeholder="e.g., 100.x.y.z"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={mode === 'remote' && !remoteIp}
            className="w-full bg-primary hover:bg-blue-600 text-white font-medium p-3 rounded-lg mt-6 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Connect to Server
          </button>
        </div>
      </div>
    </div>
  );
}
