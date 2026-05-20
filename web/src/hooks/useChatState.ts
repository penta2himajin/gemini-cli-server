import { useState, useCallback } from 'react';

export type ToolExecution = {
  id: string;
  name: string;
  args: any;
  status: 'running' | 'completed' | 'error';
  result?: string;
};

export type ChatTurn = {
  id: string;
  userText: string;
  agentText: string;
  tools: ToolExecution[];
  status: 'queued' | 'processing' | 'done' | 'error';
};

export interface SessionMetadata {
  sessionId: string;
  status: 'active' | 'archived';
  isPinned: boolean;
  title?: string;
  lastUpdated: string;
}

export function useChatState() {
  const [turnsBySession, setTurnsBySession] = useState<Record<string, ChatTurn[]>>({});
  const [metadataBySession, setMetadataBySession] = useState<Record<string, SessionMetadata>>({});
  const [activeSessionId, setActiveSessionId] = useState<string>('');

  const enqueueMessage = useCallback((sessionId: string, text: string) => {
    const turnId = `turn_${Date.now()}_${Math.random()}`;
    setTurnsBySession(prev => {
      const sessionTurns = prev[sessionId] || [];
      return {
        ...prev,
        [sessionId]: [
          ...sessionTurns,
          { id: turnId, userText: text, agentText: '', tools: [], status: 'queued' }
        ]
      };
    });
    
    // タイトルが未設定なら最初のメッセージをタイトルにする（簡易版）
    setMetadataBySession(prev => {
      const meta = prev[sessionId];
      if (meta && !meta.title) {
        return {
          ...prev,
          [sessionId]: { ...meta, title: text.slice(0, 30) + (text.length > 30 ? '...' : '') }
        };
      }
      return prev;
    });

    return turnId;
  }, []);

  const handleServerEvent = useCallback((event: any) => {
    if (event.type === 'session_list') {
      const metas: Record<string, SessionMetadata> = {};
      event.payload.sessions.forEach((m: SessionMetadata) => {
        metas[m.sessionId] = m;
      });
      setMetadataBySession(metas);
      return;
    }

    if (event.type === 'metadata_updated') {
      const updated = event.payload;
      setMetadataBySession(prev => ({
        ...prev,
        [updated.sessionId]: updated
      }));
      return;
    }

    const sessionId = event.sessionId;
    if (!sessionId) return;

    setTurnsBySession(prev => {
      const sessionTurns = [...(prev[sessionId] || [])];
      if (sessionTurns.length === 0) return prev;

      let activeIndex = sessionTurns.findIndex(t => t.status === 'processing');
      if (activeIndex === -1 && event.type !== 'turn_complete') {
        activeIndex = sessionTurns.findIndex(t => t.status === 'queued');
      }

      if (activeIndex === -1) return prev;

      const activeTurn = { ...sessionTurns[activeIndex] };
      activeTurn.status = 'processing';

      if (event.type === 'text_delta') {
        activeTurn.agentText += event.payload.text;
      } 
      else if (event.type === 'tool_start') {
        activeTurn.tools = [...activeTurn.tools, {
          id: `tool_${Date.now()}`,
          name: event.payload.toolName,
          args: event.payload.args,
          status: 'running'
        }];
      } 
      else if (event.type === 'tool_output') {
        const tools = [...activeTurn.tools];
        const lastRunningIdx = tools.findLastIndex(t => t.status === 'running');
        if (lastRunningIdx !== -1) {
          tools[lastRunningIdx] = {
            ...tools[lastRunningIdx],
            status: 'completed',
            result: event.payload.result
          };
        }
        activeTurn.tools = tools;
      } 
      else if (event.type === 'turn_complete') {
        activeTurn.status = 'done';
      } 
      else if (event.type === 'error') {
        activeTurn.status = 'error';
        activeTurn.agentText += `\n\n**Error:** ${event.payload.message}`;
      }

      sessionTurns[activeIndex] = activeTurn;
      return { ...prev, [sessionId]: sessionTurns };
    });

    // メタデータの最終更新時刻も更新
    setMetadataBySession(prev => {
      const meta = prev[sessionId];
      if (meta) {
        return {
          ...prev,
          [sessionId]: { ...meta, lastUpdated: new Date().toISOString() }
        };
      }
      return prev;
    });
  }, []);

  return {
    turnsBySession,
    metadataBySession,
    activeSessionId,
    setActiveSessionId,
    enqueueMessage,
    handleServerEvent,
    setMetadataBySession
  };
}
