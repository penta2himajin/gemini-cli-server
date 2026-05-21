import { GeminiCliAgent } from '@google/gemini-cli-sdk';

export interface ServerEvent {
  type: 'text_delta' | 'tool_start' | 'tool_output' | 'turn_complete' | 'error';
  payload: any;
}

export class SessionManager {
  private sessions = new Map<string, any>();
  private agent: GeminiCliAgent;

  constructor() {
    this.agent = new GeminiCliAgent({
      instructions: 'You are a helpful coding assistant running as an API server.',
    });
  }

  /**
   * 指定されたIDのセッションを取得、復元、または新規作成します
   */
  async getOrCreateSession(sessionId?: string): Promise<string> {
    if (sessionId && this.sessions.has(sessionId)) {
      return sessionId;
    }

    let session;
    if (sessionId) {
      try {
        // ローカルストレージからの履歴復元を試みる
        session = await this.agent.resumeSession(sessionId);
      } catch (e) {
        // 存在しない場合は、そのIDで新規作成
        session = this.agent.session({ sessionId });
      }
    } else {
      // ID指定なしの場合は完全新規作成
      session = this.agent.session();
    }

    await session.initialize();
    this.sessions.set(session.id, session);
    return session.id;
  }

  /**
   * 現在メモリに乗っているアクティブなセッションの数を返します
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * 指定されたセッションの設定を更新します
   */
  async updateSessionConfig(sessionId: string, updates: { model?: string, memory_reload?: boolean, skills_reload?: boolean }) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    await session.updateConfig(updates);
  }

  /**
   * スラッシュコマンドをサーバー側で実行します
   */
  async *runCommand(sessionId: string, raw: string): AsyncGenerator<ServerEvent, void, unknown> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      yield { type: 'error', payload: { message: `Session ${sessionId} not found` } };
      return;
    }

    try {
      const stream = session.runCommand(raw);
      for await (const chunk of stream) {
        if (chunk.type === 'content') {
          yield { type: 'text_delta', payload: { text: chunk.value || '' } };
        }
      }
      yield { type: 'turn_complete', payload: {} };
    } catch (e: any) {
      yield { type: 'error', payload: { message: e.message || 'Unknown error' } };
    }
  }

  /**
   * 指定されたセッションの履歴を取得します
   */
  async getSessionHistory(sessionId: string): Promise<any[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    const history = session.getHistory();
    const turns: any[] = [];
    
    // Contentの羅列を、Web UIが扱いやすい「ターン」形式に変換する
    // 簡易的な実装: user -> model のペアを探す
    let currentTurn: any = null;

    for (const content of history) {
      if (content.role === 'user') {
        // userメッセージの開始
        if (currentTurn && currentTurn.status === 'processing') {
          currentTurn.status = 'done';
          turns.push(currentTurn);
        }
        
        const text = content.parts.map((p: any) => p.text || '').join('');
        // ツール実行結果（functionResponse）が含まれる場合は、直前のターンのツール結果として追加すべきだが、
        // 簡易化のため一旦スキップするか、後続の改善課題とする。
        if (content.parts.some((p: any) => p.functionResponse)) {
          continue;
        }

        currentTurn = {
          id: `turn_${Date.now()}_${Math.random()}`,
          userText: text,
          agentText: '',
          tools: [],
          status: 'processing'
        };
      } else if (content.role === 'model' || content.role === 'agent') {
        if (!currentTurn) continue;

        for (const part of content.parts) {
          if (part.text) {
            currentTurn.agentText += part.text;
          } else if (part.functionCall) {
            currentTurn.tools.push({
              id: `tool_${Date.now()}_${Math.random()}`,
              name: part.functionCall.name,
              args: part.functionCall.args,
              status: 'completed' // 履歴なので完了済みとする
            });
          }
        }
      }
    }

    if (currentTurn) {
      currentTurn.status = 'done';
      turns.push(currentTurn);
    }

    return turns;
  }

  /**
   * メッセージをSDKに送信し、API用のフォーマットに変換したストリームを返します
   */
  async *sendMessage(sessionId: string, text: string): AsyncGenerator<ServerEvent, void, unknown> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      yield { type: 'error', payload: { message: `Session ${sessionId} not found` } };
      return;
    }

    try {
      // SDKから生のストリームを取得
      const stream = session.sendStream(text);
      
      for await (const chunk of stream) {
        // SDKのチャンク形式を、API設計で定義したフォーマットにマッピングする
        if (chunk.type === 'content') {
          yield { type: 'text_delta', payload: { text: chunk.value || '' } };
        } else if (chunk.type === 'tool_call_request') {
          yield { type: 'tool_start', payload: { toolName: chunk.value.name, args: chunk.value.args } };
        } else if (chunk.type === 'tool_call_response') {
          yield { type: 'tool_output', payload: { result: JSON.stringify(chunk.value.response) } };
        }
      }
      
      // すべて完了したことを通知
      yield { type: 'turn_complete', payload: {} };
    } catch (e: any) {
      yield { type: 'error', payload: { message: e.message || 'Unknown error' } };
    }
  }
}
