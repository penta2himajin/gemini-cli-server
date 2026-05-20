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
          yield { type: 'tool_start', payload: { toolName: chunk.value.toolName, args: chunk.value.args } };
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
