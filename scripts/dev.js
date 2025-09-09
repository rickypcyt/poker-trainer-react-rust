#!/usr/bin/env bun

/**
 * Dev orchestrator: runs Vite (frontend) and FastAPI (Python bot) together.
 *
 * Prereqs (one-time):
 *  - cd services/bot-python && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
 *
 * Env options:
 *  - BOT_API_PORT (default 8001)
 *  - FRONTEND_PORT (default 5173)
 *  - PYTHON_BIN (default "python3")
 */

const BOT_API_PORT = Number(process.env.BOT_API_PORT ?? 8001);
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT ?? 5173);
function resolvePythonBin() {
  const venvPy = new URL('../services/bot-python/.venv/bin/python', import.meta.url).pathname;
  try {
    const stat = Bun.file(venvPy);
    // Quick existence check by attempting size
    return stat ? venvPy : (process.env.PYTHON_BIN ?? 'python3');
  } catch {
    return process.env.PYTHON_BIN ?? 'python3';
  }
}
const PYTHON_BIN = resolvePythonBin();

const botCwd = new URL('../services/bot-python', import.meta.url).pathname;
const rootCwd = new URL('..', import.meta.url).pathname;

async function killPort(port) {
  // Linux (Arch): use lsof to find PIDs and kill -9
  try {
    const sh = Bun.spawn(['bash', '-lc', `lsof -ti :${port} | xargs -r kill -9`], { stdout: 'inherit', stderr: 'inherit' });
    await sh.exited;
  } catch {}
}

async function verifyUvicorn(pythonBin) {
  const check = Bun.spawn([pythonBin, '-c', 'import uvicorn; print(uvicorn.__version__)'], { cwd: botCwd });
  const code = await check.exited;
  if (code !== 0) {
    console.error(`\n[dev] uvicorn not found in ${pythonBin}.`);
    console.error('[dev] Please install Python deps:');
    console.error(`    cd services/bot-python && ${pythonBin} -m pip install -r requirements.txt`);
    process.exit(1);
  }
}

function waitOn(proc, name) {
  proc.exited.then((code) => {
    console.error(`[${name}] exited with code ${code}`);
    process.exit(code ?? 1);
  });
}

function runFastAPI() {
  const args = [
    '-m', 'uvicorn',
    'main:app',
    '--host', '0.0.0.0',
    '--port', String(BOT_API_PORT),
    '--reload'
  ];
  const p = Bun.spawn([PYTHON_BIN, ...args], {
    cwd: botCwd,
    stdout: 'inherit',
    stderr: 'inherit',
    env: { ...process.env }
  });
  waitOn(p, 'fastapi');
  return p;
}

function runVite() {
  const p = Bun.spawn(['bun', 'vite', '--port', String(FRONTEND_PORT)], {
    cwd: rootCwd,
    stdout: 'inherit',
    stderr: 'inherit',
    env: { ...process.env }
  });
  waitOn(p, 'vite');
  return p;
}

async function main() {
  console.log(`[dev] Ensuring ports are free (:${BOT_API_PORT}, :${FRONTEND_PORT}) ...`);
  await killPort(BOT_API_PORT);
  await killPort(FRONTEND_PORT);
  console.log(`[dev] Using Python: ${PYTHON_BIN}`);
  await verifyUvicorn(PYTHON_BIN);
  console.log(`[dev] Starting FastAPI on :${BOT_API_PORT} and Vite on :${FRONTEND_PORT} ...`);
  const api = runFastAPI();
  const vite = runVite();

  async function shutdown() {
    try { api.kill(); } catch {}
    try { vite.kill(); } catch {}
    // Also re-kill ports to avoid zombies
    await killPort(BOT_API_PORT);
    await killPort(FRONTEND_PORT);
    process.exit(0);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => { console.error(e); process.exit(1); });
