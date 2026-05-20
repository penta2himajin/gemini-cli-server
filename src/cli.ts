import { WebSocket } from 'ws';
import readline from 'readline';
import prompts from 'prompts';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_PATH = path.join(os.homedir(), '.gemini-cli-client.json');
const DEFAULT_PORT = 8080;

interface ClientConfig {
  mode: 'local' | 'remote';
  remoteIp?: string;
  sessionId: string;
}

// ==========================================
// Config Management
// ==========================================
function loadConfig(): ClientConfig | null {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    } catch (e) {
      return null;
    }
  }
  return null;
}

function saveConfig(config: ClientConfig) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

async function runSetup(existingConfig?: ClientConfig | null): Promise<ClientConfig> {
  console.log('\n\x1b[36m◆ Gemini CLI Server Configuration\x1b[0m');
  
  const modeRes = await prompts({
    type: 'select',
    name: 'mode',
    message: 'Where is the API server running?',
    choices: [
      { title: 'Localhost (This PC)', value: 'local' },
      { title: 'Remote (Tailscale / Network)', value: 'remote' }
    ],
    initial: existingConfig?.mode === 'remote' ? 1 : 0
  });

  if (!modeRes.mode) process.exit(0);

  let remoteIp = existingConfig?.remoteIp;
  if (modeRes.mode === 'remote') {
    const ipRes = await prompts({
      type: 'text',
      name: 'ip',
      message: 'Enter the Tailscale IP of the server (e.g., 100.x.y.z):',
      initial: existingConfig?.remoteIp || ''
    });
    if (!ipRes.ip) process.exit(0);
    remoteIp = ipRes.ip;
  }

  const newConfig: ClientConfig = {
    mode: modeRes.mode,
    remoteIp,
    sessionId: existingConfig?.sessionId || `cli-session-${Date.now()}`
  };

  saveConfig(newConfig);
  console.log('\x1b[32m✔ Settings saved!\x1b[0m\n');
  return newConfig;
}

// ==========================================
// App State
// ==========================================
let ws: WebSocket | null = null;
let rl: readline.Interface | null = null;
let currentConfig: ClientConfig;

function getWebSocketUrl(config: ClientConfig): string {
  if (config.mode === 'local') {
    return `ws://localhost:${DEFAULT_PORT}`;
  } else {
    // Basic formatting, assumes port 8080 if not specified
    const ip = config.remoteIp || 'localhost';
    return ip.includes(':') ? `ws://${ip}` : `ws://${ip}:${DEFAULT_PORT}`;
  }
}

// ==========================================
// CLI Core Logic
// ==========================================
async function start() {
  let config = loadConfig();
  if (!config) {
    config = await runSetup();
  }
  currentConfig = config;
  connect(currentConfig);
}

function connect(config: ClientConfig) {
  if (ws) {
    ws.removeAllListeners();
    ws.close();
  }
  if (rl) {
    rl.close();
  }

  const url = getWebSocketUrl(config);
  console.log(`Connecting to ${url}...`);
  ws = new WebSocket(url);

  ws.on('open', () => {
    console.log(`\x1b[32m✔ Connected to Gemini CLI Server\x1b[0m`);
    console.log(`\x1b[90mSession ID: ${config.sessionId}\x1b[0m`);
    console.log(`\x1b[90mType /setting to change connection, /exit to quit.\x1b[0m\n`);
    
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    promptUser();
  });

  ws.on('message', (data) => {
    const event = JSON.parse(data.toString());
    
    if (event.type === 'text_delta') {
      process.stdout.write(event.payload.text);
    } else if (event.type === 'tool_start') {
      console.log(`\n\x1b[33m[実行中: ${event.payload.toolName}]\x1b[0m`);
    } else if (event.type === 'turn_complete') {
      console.log();
      promptUser();
    } else if (event.type === 'error') {
      console.error(`\n\x1b[31m[Error] ${event.payload.message}\x1b[0m`);
      promptUser();
    }
  });

  ws.on('close', () => {
    console.log('\n\x1b[31mConnection closed by server.\x1b[0m');
    process.exit(0);
  });

  ws.on('error', (err) => {
    console.error('\n\x1b[31mWebSocket error:\x1b[0m', err.message);
    console.log('\x1b[90mIf the server is remote, check your Tailscale connection.\x1b[0m');
    console.log('\x1b[90mType /setting to reconfigure, or restart the CLI.\x1b[0m');
    
    // Fallback simple readline just to allow /setting command after a failure
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    promptUser();
  });
}

function promptUser() {
  if (!rl) return;
  
  rl.question('\x1b[32mYou>\x1b[0m ', async (input) => {
    const command = input.trim();
    
    if (command === '/exit') {
      ws?.close();
      rl?.close();
      process.exit(0);
      return;
    }
    
    if (command === '/setting') {
      if (rl) rl.close();
      const newConfig = await runSetup(currentConfig);
      currentConfig = newConfig;
      connect(currentConfig);
      return;
    }

    if (!command) {
      promptUser();
      return;
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'chat_message',
        payload: { sessionId: currentConfig.sessionId, text: input }
      }));
    } else {
      console.log('\x1b[31mNot connected. Use /setting to fix connection.\x1b[0m');
      promptUser();
    }
  });
}

// Start the CLI
start().catch(console.error);
