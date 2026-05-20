import { useState, useRef, useEffect, useCallback } from 'react';
import { SetupModal } from './components/SetupModal';
import type { ServerConfig } from './components/SetupModal';
import { useGeminiSocket } from './hooks/useGeminiSocket';
import { useChatState } from './hooks/useChatState';
import { ChatTurnView } from './components/ChatTurnView';
import { Sidebar } from './components/Sidebar';
import { SessionSelector } from './components/SessionSelector';
import { Send, TerminalSquare, Settings } from 'lucide-react';

const CONFIG_KEY = 'gemini-cli-web-config';
const DEFAULT_PORT = 8080;

function getWsUrl(config: ServerConfig) {
  if (config.mode === 'local') return `ws://localhost:${DEFAULT_PORT}`;
  const ip = config.remoteIp || 'localhost';
  return ip.includes(':') ? `ws://${ip}` : `ws://${ip}:${DEFAULT_PORT}`;
}

export default function App() {
  const [config, setConfig] = useState<ServerConfig | null>(() => {
    const saved = localStorage.getItem(CONFIG_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [showSetup, setShowSetup] = useState(!config);
  
  const { 
    turnsBySession, 
    metadataBySession, 
    activeSessionId, 
    setActiveSessionId,
    enqueueMessage, 
    handleServerEvent 
  } = useChatState();
  
  const { status, sendMessage, sendRaw } = useGeminiSocket({
    url: config ? getWsUrl(config) : '',
    sessionId: activeSessionId,
    onMessage: handleServerEvent
  });

  const handleSaveConfig = (newConfig: ServerConfig) => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(newConfig));
    setConfig(newConfig);
    setShowSetup(false);
  };

  // Request session list from server
  const refreshSessions = useCallback(() => {
    sendRaw({ type: 'list_sessions' });
  }, [sendRaw]);

  // Sync sessions on connect
  useEffect(() => {
    if (status === 'connected') {
      refreshSessions();
    }
  }, [status, refreshSessions]);

  const handleUpdateMetadata = useCallback((sessionId: string, updates: any) => {
    sendRaw({ type: 'update_metadata', payload: { sessionId, updates } });
  }, [sendRaw]);

  const handleNewChat = useCallback(() => {
    const newId = `web-session-${Date.now()}`;
    setActiveSessionId(newId);
  }, [setActiveSessionId]);

  // Chat Input State
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Current session turns
  const activeTurns = turnsBySession[activeSessionId] || [];

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTurns]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    
    if (trimmed === '/connection') {
      setShowSetup(true);
      setInput('');
      return;
    }

    if (status !== 'connected') {
      alert('Not connected to server.');
      return;
    }

    enqueueMessage(activeSessionId, trimmed);
    sendMessage(trimmed);
    setInput('');
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const userMessages = activeTurns.map(t => t.userText).reverse();
      if (userMessages.length > 0) {
        const nextIndex = Math.min(historyIndex + 1, userMessages.length - 1);
        setHistoryIndex(nextIndex);
        setInput(userMessages[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        const userMessages = activeTurns.map(t => t.userText).reverse();
        setInput(userMessages[nextIndex]);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  // If no active session but we have some metadata, pick the first one
  useEffect(() => {
    if (!activeSessionId) {
      const metas = Object.values(metadataBySession);
      if (metas.length > 0) {
        // Pick pinned or most recent
        const sorted = metas.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
        setActiveSessionId(sorted[0].sessionId);
      } else {
        // Completely new session
        handleNewChat();
      }
    }
  }, [activeSessionId, metadataBySession, handleNewChat, setActiveSessionId]);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar 
        sessions={Object.values(metadataBySession)}
        activeSessionId={activeSessionId}
        onSelect={setActiveSessionId}
        onNew={handleNewChat}
        onUpdateMetadata={handleUpdateMetadata}
        onShowSetup={() => setShowSetup(true)}
      />

      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="flex-none h-14 border-b border-border px-4 flex items-center justify-between bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 md:hidden">
              <TerminalSquare className="w-5 h-5 text-primary" />
            </div>
            
            <SessionSelector 
              sessions={Object.values(metadataBySession)}
              activeSessionId={activeSessionId}
              onSelect={setActiveSessionId}
              onNew={handleNewChat}
            />

            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 font-mono">
              {activeSessionId}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold">
              <span className={`h-1.5 w-1.5 rounded-full ${status === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'}`}></span>
              <span className={status === 'connected' ? 'text-emerald-500' : 'text-rose-500'}>{status}</span>
            </div>
            <button 
              onClick={() => setShowSetup(true)}
              className="p-2 hover:bg-zinc-800 rounded-md transition-colors text-zinc-400 hover:text-zinc-100 md:hidden"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Chat Area */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 w-full">
          <div className="max-w-4xl mx-auto pb-32 pt-4">
            {activeTurns.length === 0 ? (
              <div className="h-[60vh] flex flex-col items-center justify-center text-zinc-500 space-y-4 text-center">
                <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                  <TerminalSquare className="w-12 h-12 text-zinc-700 mb-2 mx-auto" />
                  <h2 className="text-zinc-300 font-medium">New Conversation</h2>
                  <p className="text-sm max-w-xs">Start a new task or pick a session from the sidebar to continue.</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {activeTurns.map(turn => (
                  <ChatTurnView key={turn.id} turn={turn} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </main>

        {/* Sticky Input Area */}
        <div className="fixed bottom-0 left-0 right-0 md:left-72 p-4 bg-gradient-to-t from-background via-background to-transparent pointer-events-none">
          <div className="max-w-4xl mx-auto pointer-events-auto">
            <div className="relative group">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything... (Use /connection to reconfigure, ↑/↓ for history)"
                className="w-full bg-zinc-900/90 backdrop-blur border border-zinc-700 rounded-xl px-4 py-4 pr-12 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-2xl resize-none overflow-hidden min-h-[60px]"
                rows={Math.min(input.split('\n').length, 5) || 1}
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || status !== 'connected'}
                className="absolute right-3 bottom-4 p-1.5 text-zinc-400 hover:text-primary transition-colors disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showSetup && (
        <SetupModal 
          initialConfig={config} 
          onSave={handleSaveConfig} 
        />
      )}
    </div>
  );
}
