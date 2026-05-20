import React, { useState, useRef, useEffect } from 'react';
import { SetupModal } from './components/SetupModal';
import type { ServerConfig } from './components/SetupModal';
import { useGeminiSocket } from './hooks/useGeminiSocket';
import { useChatState } from './hooks/useChatState';
import { ChatTurnView } from './components/ChatTurnView';
import { Settings, Send, TerminalSquare } from 'lucide-react';

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
  
  const { turns, enqueueMessage, handleServerEvent } = useChatState();
  
  const { status, sendMessage } = useGeminiSocket({
    url: config ? getWsUrl(config) : '',
    sessionId: config?.sessionId || '',
    onMessage: handleServerEvent
  });

  const handleSaveConfig = (newConfig: ServerConfig) => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(newConfig));
    setConfig(newConfig);
    setShowSetup(false);
  };

  // Chat Input State
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    
    if (trimmed === '/setting') {
      setShowSetup(true);
      setInput('');
      return;
    }

    if (status !== 'connected') {
      alert('Not connected to server.');
      return;
    }

    enqueueMessage(trimmed);
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
      const userMessages = turns.map(t => t.userText).reverse();
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
        const userMessages = turns.map(t => t.userText).reverse();
        setInput(userMessages[nextIndex]);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex-none h-14 border-b border-border px-4 flex items-center justify-between bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <TerminalSquare className="w-5 h-5 text-primary" />
          <h1 className="font-semibold text-zinc-100">Gemini CLI Web</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status === 'connected' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${status === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            </span>
            <span className="text-zinc-400">{status}</span>
          </div>
          <button 
            onClick={() => setShowSetup(true)}
            className="p-2 hover:bg-zinc-800 rounded-md transition-colors text-zinc-400 hover:text-zinc-100"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 max-w-4xl mx-auto w-full pb-32">
        {turns.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4">
            <TerminalSquare className="w-12 h-12 text-zinc-800" />
            <p>Send a message to start interacting with the local system.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {turns.map(turn => (
              <ChatTurnView key={turn.id} turn={turn} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Sticky Input Area */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
        <div className="max-w-4xl mx-auto">
          <div className="relative group">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything... (Use /setting to reconfigure, ↑/↓ for history)"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-4 pr-12 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none overflow-hidden min-h-[60px]"
              rows={Math.min(input.split('\n').length, 5) || 1}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || status !== 'connected'}
              className="absolute right-3 bottom-4 p-1.5 text-zinc-400 hover:text-primary transition-colors disabled:opacity-50 disabled:hover:text-zinc-400"
            >
              <Send className="w-5 h-5" />
            </button>
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
