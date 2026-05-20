import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { SessionManager } from './SessionManager.js';
import { MetadataManager } from './MetadataManager.js';

export class AppWebSocketServer {
  private wss: WebSocketServer;

  constructor(
    server: http.Server, 
    private sessionManager: SessionManager,
    private metadataManager: MetadataManager
  ) {
    this.wss = new WebSocketServer({ server });
    
    this.wss.on('connection', (ws: WebSocket) => {
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'list_sessions') {
            const metadata = this.metadataManager.getAllMetadata();
            ws.send(JSON.stringify({ type: 'session_list', payload: { sessions: metadata } }));
          }

          if (message.type === 'update_metadata') {
            const { sessionId, updates } = message.payload;
            const updated = await this.metadataManager.updateMetadata(sessionId, updates);
            ws.send(JSON.stringify({ type: 'metadata_updated', payload: updated }));
          }

          if (message.type === 'chat_message') {
            const { sessionId, text } = message.payload;
            const actualSessionId = await this.sessionManager.getOrCreateSession(sessionId);
            
            // Webからのメッセージ送信時は自動的にActiveにする
            await this.metadataManager.updateMetadata(actualSessionId, { status: 'active' });

            const stream = this.sessionManager.sendMessage(actualSessionId, text);
            for await (const event of stream) {
              // 常にsessionIdを付与してクライアントがルーティングできるようにする
              ws.send(JSON.stringify({ ...event, sessionId: actualSessionId }));
            }
          }
        } catch (e: any) {
          ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid message or internal error' } }));
        }
      });
    });
  }

  close() {
    this.wss.close();
  }
}

