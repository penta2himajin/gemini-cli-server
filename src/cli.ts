import prompts from 'prompts';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.join(os.homedir(), '.gemini-cli-client.json');
const DEFAULT_PORT = 8080;

interface ClientConfig {
  mode: 'local' | 'remote';
  remoteIp?: string;
  sessionId: string;
}

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

function getWebSocketUrl(config: ClientConfig): string {
  if (config.mode === 'local') {
    return `ws://localhost:${DEFAULT_PORT}`;
  } else {
    const ip = config.remoteIp || 'localhost';
    return ip.includes(':') ? `ws://${ip}` : `ws://${ip}:${DEFAULT_PORT}`;
  }
}

async function start() {
  const args = process.argv.slice(2);
  let config = loadConfig();

  // Force re-setup if /setting flag is passed
  if (!config || args.includes('--setting')) {
    config = await runSetup(config);
  }

  const wsUrl = getWebSocketUrl(config);
  
  // Point to the official CLI binary inside the adjacent gemini-cli monorepo
  const officialCliPath = path.resolve(__dirname, '../../gemini-cli/packages/cli/dist/index.js');
  
  if (!fs.existsSync(officialCliPath)) {
    console.error(`\x1b[31mError: Official CLI binary not found at ${officialCliPath}\x1b[0m`);
    console.error('Please build the gemini-cli monorepo first.');
    process.exit(1);
  }

  console.log(`\x1b[90mLaunching Official Gemini CLI connected to ${wsUrl}...\x1b[0m`);

  // Spawn the official CLI with the remote URL injected into the environment
  const child = spawn('node', [officialCliPath], {
    stdio: 'inherit',
    env: {
      ...process.env,
      GEMINI_REMOTE_WS_URL: wsUrl,
      GEMINI_SESSION_ID: config.sessionId, // Ensure session ID syncs
      GEMINI_DISABLE_UPDATE_CHECK: 'true'  // Disable auto-update since we are running local source
    }
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

start().catch(console.error);
