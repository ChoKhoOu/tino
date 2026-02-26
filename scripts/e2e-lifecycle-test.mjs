/**
 * E2E lifecycle test for the daemon manager.
 * Tests 8.2–8.5 without Ink TUI (which requires a TTY).
 */
import { DaemonManager, registerCli, unregisterCli, countActiveClis } from "../packages/cli/dist/daemon/index.js";
import { findMonorepoRoot, resolveEnginePaths } from "../packages/cli/dist/daemon/root-finder.js";
import { isEngineRunning } from "../packages/cli/dist/daemon/health-checker.js";
import { shutdownEngine } from "../packages/cli/dist/daemon/engine-spawner.js";
import { readFileSync, readdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { homedir } from "node:os";

const LOCK_DIR = join(homedir(), "Library/Application Support/tino/run/cli");
const PID_FILE = join(homedir(), "Library/Application Support/tino/run/engine.pid");

const root = findMonorepoRoot();
const paths = resolveEnginePaths(root);
const daemon = new DaemonManager(paths);

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}`);
    failed++;
  }
}

// === 8.2: CLI #1 registers + engine auto-starts ===
console.log("\n========== 8.2: CLI #1 registers + engine auto-starts ==========");
registerCli();
console.log(`CLI #1 registered (PID: ${process.pid})`);

await daemon.ensureEngine();
const healthy = await isEngineRunning();
assert(healthy, "Engine is healthy after auto-start");

const locks = readdirSync(LOCK_DIR);
assert(locks.length === 1, `1 lock file exists (got ${locks.length})`);

const pidData = JSON.parse(readFileSync(PID_FILE, "utf-8"));
assert(typeof pidData.pid === "number", `PID file has pid: ${pidData.pid}`);
assert(pidData.port === 8000, `PID file has port: ${pidData.port}`);
assert(typeof pidData.token === "string" && pidData.token.length > 0, "PID file has token");

// Dashboard check
try {
  const resp = await fetch("http://127.0.0.1:8000/");
  assert(resp.status === 200, `Dashboard returns HTTP ${resp.status}`);
} catch (e) {
  assert(false, `Dashboard reachable (${e.message})`);
}

// API priority check
try {
  const resp = await fetch("http://127.0.0.1:8000/api/health");
  const ct = resp.headers.get("content-type");
  assert(ct.includes("application/json"), `API returns JSON (${ct})`);
} catch (e) {
  assert(false, `API accessible (${e.message})`);
}

// === 8.3: Simulate CLI #2 reuses engine ===
console.log("\n========== 8.3: CLI #2 reuses engine (no new engine spawned) ==========");
const sleeper = spawn("sleep", ["60"], { detached: true, stdio: "ignore" });
sleeper.unref();
const cli2Pid = sleeper.pid;
const lockFile2 = join(LOCK_DIR, `cli-${cli2Pid}.lock`);
writeFileSync(lockFile2, JSON.stringify({ pid: cli2Pid, startedAt: new Date().toISOString(), tty: "test" }));

const activeCount = countActiveClis();
assert(activeCount === 2, `2 active CLIs (got ${activeCount})`);

const enginePidAfter = JSON.parse(readFileSync(PID_FILE, "utf-8")).pid;
assert(enginePidAfter === pidData.pid, `Same engine PID (${enginePidAfter} === ${pidData.pid})`);

// === 8.4: CLI #1 exits, engine stays ===
console.log("\n========== 8.4: CLI #1 exits, engine stays running ==========");
unregisterCli();
const countAfter1 = countActiveClis();
assert(countAfter1 === 1, `1 active CLI remaining (got ${countAfter1})`);

const stillHealthy = await isEngineRunning();
assert(stillHealthy, "Engine still healthy after CLI #1 exit");
assert(existsSync(PID_FILE), "PID file still exists");

// === 8.5: Last CLI exits, engine shuts down ===
console.log("\n========== 8.5: Last CLI exits, engine shuts down ==========");
try { process.kill(cli2Pid, "SIGTERM"); } catch {}
try { unlinkSync(lockFile2); } catch {}

const countFinal = countActiveClis();
assert(countFinal === 0, `0 active CLIs (got ${countFinal})`);

console.log("Calling shutdownEngine()...");
await shutdownEngine();
await new Promise(r => setTimeout(r, 2000));

const engineStopped = (await isEngineRunning()) === false;
assert(engineStopped, "Engine is no longer running");

const pidFileGone = !existsSync(PID_FILE);
assert(pidFileGone, "PID file cleaned up");

let portFree = false;
try {
  await fetch("http://127.0.0.1:8000/api/health");
} catch {
  portFree = true;
}
assert(portFree, "Port 8000 is free");

// === Summary ===
console.log(`\n========== RESULTS: ${passed} passed, ${failed} failed ==========`);
process.exit(failed > 0 ? 1 : 0);
