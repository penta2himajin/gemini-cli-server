import { useState } from 'react';
import { ChevronDown, Plus, MessageSquare, Activity, Pin } from 'lucide-react';
import type { SessionMetadata } from '../hooks/useChatState';

interface SessionSelectorProps {
  sessions: SessionMetadata[];
  activeSessionId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function SessionSelector({ sessions, activeSessionId, onSelect, onNew }: SessionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const activeSession = sessions.find(s => s.sessionId === activeSessionId);

  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
  });

  return (
    <div className="relative md:hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm font-medium"
      >
        <span className="truncate max-w-[150px]">
          {activeSession?.title || 'Select Session'}
        </span>
        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute top-full left-0 mt-2 w-72 max-h-[80vh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 p-2 space-y-1">
            <button 
              onClick={() => { onNew(); setIsOpen(false); }}
              className="w-full flex items-center gap-3 p-3 rounded-lg text-primary bg-primary/10 hover:bg-primary/20 transition-colors text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </button>

            <div className="h-px bg-zinc-800 my-1" />

            {sortedSessions.map(session => (
              <button
                key={session.sessionId}
                onClick={() => { onSelect(session.sessionId); setIsOpen(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                  activeSessionId === session.sessionId 
                    ? 'bg-zinc-800 text-zinc-100' 
                    : 'text-zinc-400 hover:bg-zinc-800/50'
                }`}
              >
                {session.status === 'active' ? (
                  <Activity className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <MessageSquare className="w-4 h-4 shrink-0" />
                )}
                <span className="flex-1 truncate text-sm">
                  {session.title || 'Untitled Session'}
                </span>
                {session.isPinned && <Pin className="w-3 h-3 text-primary fill-primary" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
