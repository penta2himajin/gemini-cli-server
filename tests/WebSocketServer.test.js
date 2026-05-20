import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { AppWebSocketServer } from '../src/WebSocketServer.js';
import { SessionManager } from '../src/SessionManager.js';
import { WebSocket } from 'ws';
import http from 'http';
// モック: SessionManagerの挙動を固定化する
vi.mock('../src/SessionManager.js', () => {
    return {
        SessionManager: vi.fn().mockImplementation(() => ({
            getOrCreateSession: vi.fn().mockResolvedValue('mock-session-123'),
            sendMessage: vi.fn().mockImplementation(async function* (sessionId, text) {
                // ストリームのふりをしてイベントを2つ返す
                yield { type: 'text_delta', payload: { text: `Reply: ${text}` } };
                yield { type: 'turn_complete', payload: {} };
            })
        }))
    };
});
describe('AppWebSocketServer', () => {
    let server;
    let wsServer;
    let port;
    beforeAll(async () => {
        server = http.createServer();
        const sessionManager = new SessionManager();
        wsServer = new AppWebSocketServer(server, sessionManager);
        await new Promise((resolve) => {
            server.listen(0, () => {
                port = server.address().port;
                resolve();
            });
        });
    });
    afterAll(async () => {
        wsServer.close();
        await new Promise((resolve) => server.close(() => resolve()));
    });
    it('WebSocket経由でchat_messageを受け取り、イベントをストリームとして返すこと', () => {
        return new Promise((resolve, reject) => {
            const client = new WebSocket(`ws://localhost:${port}`);
            const receivedEvents = [];
            client.on('open', () => {
                // テスト用のJSONペイロードを送信
                client.send(JSON.stringify({
                    type: 'chat_message',
                    payload: { sessionId: '123', text: 'Hello WS' }
                }));
            });
            client.on('message', (data) => {
                try {
                    const event = JSON.parse(data.toString());
                    receivedEvents.push(event);
                    if (event.type === 'turn_complete') {
                        expect(receivedEvents[0]).toEqual({ type: 'text_delta', payload: { text: 'Reply: Hello WS' } });
                        expect(receivedEvents[1]).toEqual({ type: 'turn_complete', payload: {} });
                        client.close();
                        resolve();
                    }
                }
                catch (e) {
                    client.close();
                    reject(e);
                }
            });
            client.on('error', reject);
        });
    });
});
