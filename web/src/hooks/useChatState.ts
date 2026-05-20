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

export function useChatState() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isAgentBusy, setIsAgentBusy] = useState(false);

  // When user hits Enter
  const enqueueMessage = useCallback((text: string) => {
    const id = `turn_${Date.now()}_${Math.random()}`;
    setTurns(prev => [
      ...prev,
      { id, userText: text, agentText: '', tools: [], status: 'queued' }
    ]);
    return id;
  }, []);

  // Process incoming WebSocket events
  const handleServerEvent = useCallback((event: any) => {
    setTurns(prevTurns => {
      if (prevTurns.length === 0) return prevTurns;

      // Find the currently active turn, or the oldest queued turn
      let activeIndex = prevTurns.findIndex(t => t.status === 'processing');
      
      // If we got an event but nothing is processing, promote the oldest queued item
      if (activeIndex === -1 && event.type !== 'turn_complete') {
        activeIndex = prevTurns.findIndex(t => t.status === 'queued');
      }

      if (activeIndex === -1) return prevTurns; // Nothing to update

      const activeTurn = { ...prevTurns[activeIndex] };
      activeTurn.status = 'processing';
      setIsAgentBusy(true);

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
        // Mark the last running tool as complete
        const tools = [...activeTurn.tools];
        const lastRunningToolIdx = tools.findLastIndex(t => t.status === 'running');
        if (lastRunningToolIdx !== -1) {
          tools[lastRunningToolIdx] = {
            ...tools[lastRunningToolIdx],
            status: 'completed',
            result: event.payload.result
          };
        }
        activeTurn.tools = tools;
      } 
      else if (event.type === 'turn_complete') {
        activeTurn.status = 'done';
        setIsAgentBusy(false);
      } 
      else if (event.type === 'error') {
        activeTurn.status = 'error';
        activeTurn.agentText += `\n\n**Error:** ${event.payload.message}`;
        setIsAgentBusy(false);
      }

      const newTurns = [...prevTurns];
      newTurns[activeIndex] = activeTurn;
      return newTurns;
    });
  }, []);

  return {
    turns,
    isAgentBusy,
    enqueueMessage,
    handleServerEvent
  };
}
