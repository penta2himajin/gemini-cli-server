import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager } from '../src/SessionManager.js';

// モック: 実際のGemini APIを叩かず、SDKの挙動をシミュレートする
vi.mock('@google/gemini-cli-sdk', () => {
  return {
    GeminiCliAgent: vi.fn().mockImplementation(() => ({
      session: vi.fn().mockImplementation((opts) => ({
        id: opts?.sessionId || 'mock-generated-id',
        initialize: vi.fn().mockResolvedValue(undefined),
        sendStream: vi.fn().mockImplementation(async function* (input: string) {
          yield { type: 'content', value: `Reply to: ${input}` };
        }),
      })),
      resumeSession: vi.fn().mockImplementation((sessionId) => ({
        id: sessionId,
        initialize: vi.fn().mockResolvedValue(undefined),
        sendStream: vi.fn().mockImplementation(async function* (input: string) {
          yield { type: 'content', value: `Reply to: ${input}` };
        }),
      })),
    })),
  };
});

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  it('sessionIdが指定されない場合、新しいセッションを作成してIDを返すこと', async () => {
    const sessionId = await manager.getOrCreateSession();
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');
  });

  it('既存のsessionIdが指定された場合、そのセッションを使い回すこと', async () => {
    const id1 = await manager.getOrCreateSession('session-123');
    const id2 = await manager.getOrCreateSession('session-123');
    expect(id1).toBe('session-123');
    expect(id2).toBe('session-123');
    // セッションインスタンスは1つだけ保持されているべき
    expect(manager.getActiveSessionCount()).toBe(1);
  });

  it('メッセージを送信すると、フロントエンド用のフォーマットに変換されたストリームが返ること', async () => {
    const sessionId = await manager.getOrCreateSession('session-123');
    const stream = await manager.sendMessage(sessionId, 'Hello');
    
    const events = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThan(0);
    // モックが 'content' を返すので、API用の 'text_delta' に変換されているかテスト
    expect(events[0]).toEqual({ type: 'text_delta', payload: { text: 'Reply to: Hello' } });
  });
});
