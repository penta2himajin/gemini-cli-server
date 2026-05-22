// 1. Wrap streams IMMEDIATELY (before any imports)
const suppressPatterns = [
  'Current logger will',
  'Registration of version',
  'at DiagAPI.setLogger',
  'at registerGlobal'
];

function shouldSuppress(chunk: any) {
  const str = typeof chunk === 'string' ? chunk : chunk.toString();
  return suppressPatterns.some(p => str.includes(p));
}

const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
process.stdout.write = function (chunk: any, encoding?: any, callback?: any) {
  if (shouldSuppress(chunk)) return true;
  return originalStdoutWrite.apply(process.stdout, [chunk, encoding, callback]);
} as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
process.stderr.write = function (chunk: any, encoding?: any, callback?: any) {
  if (shouldSuppress(chunk)) return true;
  return originalStderrWrite.apply(process.stderr, [chunk, encoding, callback]);
} as any;

// 2. Now import modules dynamically to ensure stream wrapping happens first
import http from 'http';

async function start() {
  const { AppWebSocketServer } = await import('./WebSocketServer.js');
  const { SessionManager } = await import('./SessionManager.js');
  const { MetadataManager } = await import('./MetadataManager.js');

  const port = process.env.PORT || 8080;

  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Gemini CLI API Server is running\n');
  });

  const sessionManager = new SessionManager();
  const metadataManager = new MetadataManager(process.cwd());
  await metadataManager.load();

  new AppWebSocketServer(server, sessionManager, metadataManager);

  server.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
    console.log(`WebSocket Server listening on ws://localhost:${port}`);
  });
}

start().catch(console.error);
