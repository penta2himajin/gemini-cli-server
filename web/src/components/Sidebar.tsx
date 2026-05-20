import { useState, useMemo } from 'react';
import { 
  Plus, 
  MessageSquare, 
  Pin, 
  Archive, 
  RefreshCcw, 
  Settings, 
  Activity
} from 'lucide-react';
import type { SessionMetadata } from '../hooks/useChatState';

type FilterType = 'active' | 'archived' | 'all';

interface SidebarProps {
  sessions: SessionMetadata[];
  activeSessionId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onUpdateMetadata: (id: string, updates: Partial<SessionMetadata>) => void;
  onShowSetup: () => void;
}

export function Sidebar({ 
  sessions, 
  activeSessionId, 
  onSelect, 
  onNew, 
  onUpdateMetadata,
  onShowSetup
}: SidebarProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredSessions = useMemo(() => {
    let list = [...sessions];
    
    // Sort by: Pinned first, then by lastUpdated
    list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
    });

    if (filter === 'active') return list.filter(s => s.status === 'active');
    if (filter === 'archived') return list.filter(s => s.status === 'archived');
    return list;
  }, [sessions, filter]);

  return (
    <div className="w-72 bg-muted border-r border-border h-full flex flex-col hidden md:flex">
      <div className="p-4">
        <button 
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-blue-600 text-white p-2.5 rounded-lg font-medium transition-colors mb-4"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>

        <div className="flex bg-zinc-900 p-1 rounded-lg mb-4 text-xs font-medium">
          {(['all', 'active', 'archived'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-1.5 rounded-md transition-all capitalize ${
                filter === f ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {filteredSessions.map(session => (
          <div 
            key={session.sessionId}
            onClick={() => onSelect(session.sessionId)}
            className={`group relative p-3 rounded-lg cursor-pointer transition-all flex items-center gap-3 ${
              activeSessionId === session.sessionId 
                ? 'bg-zinc-800 text-zinc-100' 
                : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
            }`}
          >
            <div className="shrink-0">
              {session.status === 'active' ? (
                <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
              ) : (
                <MessageSquare className="w-4 h-4" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-medium">
                {session.title || 'Untitled Session'}
              </div>
              <div className="text-[10px] text-zinc-600 truncate uppercase tracking-tight">
                {new Date(session.lastUpdated).toLocaleTimeString()}
              </div>
            </div>

            {session.isPinned && (
              <Pin className="w-3 h-3 text-primary fill-primary" />
            )}

            {/* Hover Actions */}
            <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center bg-zinc-800 shadow-lg rounded-md border border-zinc-700 p-0.5">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateMetadata(session.sessionId, { isPinned: !session.isPinned });
                }}
                className="p-1 hover:text-primary"
                title={session.isPinned ? 'Unpin' : 'Pin'}
              >
                <Pin className={`w-3.5 h-3.5 ${session.isPinned ? 'fill-primary' : ''}`} />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const newStatus = session.status === 'active' ? 'archived' : 'active';
                  onUpdateMetadata(session.sessionId, { status: newStatus });
                }}
                className="p-1 hover:text-emerald-500"
                title={session.status === 'active' ? 'Archive' : 'Unarchive'}
              >
                {session.status === 'active' ? (
                  <Archive className="w-3.5 h-3.5" />
                ) : (
                  <RefreshCcw className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        ))}

        {filteredSessions.length === 0 && (
          <div className="text-center p-8 text-zinc-600 text-xs italic">
            No {filter} sessions found.
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border mt-auto">
        <button 
          onClick={onShowSetup}
          className="w-full flex items-center gap-3 text-sm text-zinc-500 hover:text-zinc-200 transition-colors p-2 rounded-lg hover:bg-zinc-800"
        >
          <Settings className="w-4 h-4" />
          Connection Settings
        </button>
      </div>
    </div>
  );
}
