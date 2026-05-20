import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Loader2, CheckCircle2, TerminalSquare, ChevronDown, ChevronRight, User } from 'lucide-react';
import type { ChatTurn, ToolExecution } from '../hooks/useChatState';

interface ChatTurnViewProps {
  turn: ChatTurn;
}

function ToolBlock({ tool }: { tool: ToolExecution }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-2 border border-zinc-800 rounded-lg bg-zinc-900/50 overflow-hidden text-sm">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-2 hover:bg-zinc-800 transition-colors"
      >
        {tool.status === 'running' ? (
          <Loader2 className="w-4 h-4 text-yellow-500 animate-spin shrink-0" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
        )}
        <span className="font-mono text-zinc-300 flex-1 text-left truncate">
          {tool.name}
        </span>
        {expanded ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
      </button>

      {expanded && (
        <div className="p-3 border-t border-zinc-800 bg-zinc-950 font-mono text-xs overflow-x-auto">
          <div className="text-zinc-500 mb-2">Args: {JSON.stringify(tool.args)}</div>
          {tool.result && (
            <div className="text-zinc-300 whitespace-pre-wrap">{tool.result}</div>
          )}
        </div>
      )}
    </div>
  );
}

export function ChatTurnView({ turn }: ChatTurnViewProps) {
  const isQueued = turn.status === 'queued';
  
  return (
    <div className={`py-6 flex gap-4 transition-opacity duration-300 ${isQueued ? 'opacity-50' : 'opacity-100'}`}>
      <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
        <User className="w-5 h-5 text-zinc-400" />
      </div>
      
      <div className="flex-1 space-y-4 min-w-0">
        {/* User Message */}
        <div className="text-zinc-100 font-medium whitespace-pre-wrap">
          {turn.userText}
        </div>

        {/* Agent Area */}
        {turn.status !== 'queued' && (
          <div className="space-y-4 pl-4 border-l-2 border-zinc-800">
            {/* Tools Execution */}
            {turn.tools.length > 0 && (
              <div className="space-y-2">
                {turn.tools.map(tool => (
                  <ToolBlock key={tool.id} tool={tool} />
                ))}
              </div>
            )}

            {/* Markdown Response */}
            {turn.agentText && (
              <div className="prose prose-invert prose-p:leading-relaxed prose-pre:p-0 max-w-none">
                <ReactMarkdown
                  components={{
                    code({node, inline, className, children, ...props}: any) {
                      const match = /language-(\w+)/.exec(className || '')
                      return !inline && match ? (
                        <SyntaxHighlighter
                          {...props}
                          children={String(children).replace(/\n$/, '')}
                          style={vscDarkPlus as any}
                          language={match[1]}
                          PreTag="div"
                          className="rounded-md border border-zinc-800 !bg-zinc-950/50"
                        />
                      ) : (
                        <code {...props} className="bg-zinc-800 px-1.5 py-0.5 rounded text-primary">
                          {children}
                        </code>
                      )
                    }
                  }}
                >
                  {turn.agentText}
                </ReactMarkdown>
              </div>
            )}
            
            {turn.status === 'processing' && !turn.agentText && turn.tools.length === 0 && (
              <div className="flex items-center gap-2 text-zinc-500 text-sm animate-pulse">
                <TerminalSquare className="w-4 h-4" />
                <span>Agent is thinking...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
