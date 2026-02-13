import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { checkApiKeyExists } from '@/config/env.js';

export interface DoctorCheckResult {
  name: string;
  passed: boolean;
  message: string;
  suggestion?: string;
}

const API_KEY_NAMES = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY',
  'POLYGON_API_KEY',
  'FMP_API_KEY',
  'FRED_API_KEY',
  'FINNHUB_API_KEY',
];

function checkBunRuntime(): DoctorCheckResult {
  return {
    name: 'Bun Runtime',
    passed: true,
    message: `v${Bun.version}`,
  };
}

function checkApiKeys(): DoctorCheckResult {
  const found: string[] = [];
  const missing: string[] = [];
  for (const key of API_KEY_NAMES) {
    if (checkApiKeyExists(key)) {
      found.push(key);
    } else {
      missing.push(key);
    }
  }
  if (found.length === 0) {
    return {
      name: 'API Keys',
      passed: false,
      message: 'No API keys configured',
      suggestion: 'Set at least OPENAI_API_KEY in .env or environment',
    };
  }
  return {
    name: 'API Keys',
    passed: true,
    message: `${found.length}/${API_KEY_NAMES.length} configured`,
  };
}

function checkDaemon(): DoctorCheckResult {
  const pidPaths = [
    join(process.cwd(), '.tino', 'daemon.pid'),
    join(homedir(), '.tino', 'daemon.pid'),
  ];
  for (const pidPath of pidPaths) {
    if (existsSync(pidPath)) {
      try {
        const pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
        if (!isNaN(pid)) {
          process.kill(pid, 0);
          return { name: 'Python Daemon', passed: true, message: `Running (PID ${pid})` };
        }
      } catch {
      }
    }
  }
  return {
    name: 'Python Daemon',
    passed: false,
    message: 'Not running',
    suggestion: 'Start with: cd python && uv run --python 3.12 python -m tino_daemon',
  };
}

function checkGrpc(): DoctorCheckResult {
  try {
    const net = require('net');
    const socket = new net.Socket();
    let reachable = false;
    socket.setTimeout(500);
    try {
      socket.connect(50051, '127.0.0.1');
      reachable = true;
    } catch {
    }
    socket.destroy();
    if (reachable) {
      return { name: 'gRPC Connection', passed: true, message: 'Port 50051 reachable' };
    }
  } catch {
  }
  return {
    name: 'gRPC Connection',
    passed: false,
    message: 'Port 50051 not reachable',
    suggestion: 'Ensure the Python daemon is running on port 50051',
  };
}

async function checkDiskSpace(): Promise<DoctorCheckResult> {
  try {
    const proc = Bun.spawn(['df', '-k', '.'], { stdout: 'pipe', stderr: 'ignore' });
    const text = await new Response(proc.stdout).text();
    const lines = text.trim().split('\n');
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/);
      const availKB = parseInt(parts[3], 10);
      if (!isNaN(availKB)) {
        const availGB = (availKB / 1024 / 1024).toFixed(1);
        const passed = availKB > 1024 * 1024;
        return {
          name: 'Disk Space',
          passed,
          message: `${availGB} GB available`,
          suggestion: passed ? undefined : 'Less than 1 GB free — consider freeing space for checkpoints',
        };
      }
    }
  } catch {
  }
  return { name: 'Disk Space', passed: true, message: 'Unable to determine (assuming OK)' };
}

export async function runDoctorChecks(): Promise<DoctorCheckResult[]> {
  return [
    checkBunRuntime(),
    checkApiKeys(),
    checkDaemon(),
    checkGrpc(),
    await checkDiskSpace(),
  ];
}

export function formatDoctorOutput(results: DoctorCheckResult[]): string {
  const lines = ['Tino Health Check', ''];
  for (const r of results) {
    const icon = r.passed ? '\u2713' : '\u2717';
    lines.push(`  ${icon} ${r.name}: ${r.message}`);
    if (r.suggestion) {
      lines.push(`    \u2192 ${r.suggestion}`);
    }
  }
  return lines.join('\n');
}
