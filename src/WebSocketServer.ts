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
    
    this.wss.on('connection', async (ws: WebSocket, req: http.IncomingMessage) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const clientType = url.searchParams.get('clientType'); // 'cli' or 'web'
      const connectionSessionId = url.searchParams.get('sessionId');

      // CLIクライアントの場合は接続時にActiveにする
      if (clientType === 'cli' && connectionSessionId) {
        await this.metadataManager.updateMetadata(connectionSessionId, { status: 'active' });
      }

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'list_sessions') {
            const sessions = await this.metadataManager.syncWithFileSystem();
            ws.send(JSON.stringify({ type: 'session_list', payload: { sessions } }));
          }

          if (message.type === 'update_metadata') {
            const { sessionId, updates } = message.payload;
            const updated = await this.metadataManager.updateMetadata(sessionId, updates);
            ws.send(JSON.stringify({ type: 'metadata_updated', payload: updated }));
          }

          if (message.type === 'chat_message') {
            const { sessionId, text } = message.payload;
            const actualSessionId = await this.sessionManager.getOrCreateSession(sessionId);
            
            // メッセージ送信時は常にActiveにする
            await this.metadataManager.updateMetadata(actualSessionId, { status: 'active' });

            const stream = this.sessionManager.sendMessage(actualSessionId, text);
            for await (const event of stream) {
              ws.send(JSON.stringify({ ...event, sessionId: actualSessionId }));
            }
          }
        } catch (e: any) {
          ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid message or internal error' } }));
        }
      });

      ws.on('close', async () => {
        // CLIクライアントが終了した場合は自動的にArchiveにする
        if (clientType === 'cli' && connectionSessionId) {
          await this.metadataManager.updateMetadata(connectionSessionId, { status: 'archived' });
        }
      });
    });
  }

  close() {
    this.wss.close();
  }
}

