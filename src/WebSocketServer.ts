import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { SessionManager } from './SessionManager.js';

export class AppWebSocketServer {
  private wss: WebSocketServer;

  constructor(server: http.Server, private sessionManager: SessionManager) {
    this.wss = new WebSocketServer({ server });
    
    this.wss.on('connection', (ws: WebSocket) => {
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'chat_message') {
            const { sessionId, text } = message.payload;
            const actualSessionId = await this.sessionManager.getOrCreateSession(sessionId);
            
            const stream = this.sessionManager.sendMessage(actualSessionId, text);
            for await (const event of stream) {
              ws.send(JSON.stringify(event));
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
