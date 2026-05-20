import http from 'http';
import { AppWebSocketServer } from './WebSocketServer.js';
import { SessionManager } from './SessionManager.js';
import { MetadataManager } from './MetadataManager.js';

const port = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Gemini CLI API Server is running\n');
});

const sessionManager = new SessionManager();
const metadataManager = new MetadataManager(process.cwd());
await metadataManager.load();

const wsServer = new AppWebSocketServer(server, sessionManager, metadataManager);

server.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
  console.log(`WebSocket Server listening on ws://localhost:${port}`);
});
