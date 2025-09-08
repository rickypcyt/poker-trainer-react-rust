#!/usr/bin/env node

import { exec, spawn } from 'child_process';

import { createServer } from 'http';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BACKEND_URL = 'http://127.0.0.1:3000';
const BACKEND_HEALTH_ENDPOINT = `${BACKEND_URL}/api/health`;

// Check if backend is running
async function isBackendRunning() {
  try {
    const response = await fetch(BACKEND_HEALTH_ENDPOINT, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Kill any existing processes on our ports
async function killExistingProcesses() {
  const ports = [3000, 5173]; // Backend and Frontend ports
  let totalKilled = 0;
  
  for (const port of ports) {
    try {
      console.log(`🔍 [SCRIPT] Looking for processes using port ${port}...`);
      
      // Find processes using the port
      const { stdout } = await execAsync(`lsof -ti:${port}`);
      const pids = stdout.trim().split('\n').filter(pid => pid);
      
      if (pids.length > 0) {
        console.log(`🛑 [SCRIPT] Found ${pids.length} process(es) using port ${port}, killing them...`);
        for (const pid of pids) {
          try {
            await execAsync(`kill -9 ${pid}`);
            console.log(`✅ [SCRIPT] Killed process ${pid} on port ${port}`);
            totalKilled++;
          } catch (error) {
            console.log(`⚠️  [SCRIPT] Could not kill process ${pid} on port ${port}: ${error.message}`);
          }
        }
      } else {
        console.log(`✅ [SCRIPT] No processes found on port ${port}`);
      }
    } catch (error) {
      // If lsof fails, try alternative approach with netstat
      try {
        console.log(`🔍 [SCRIPT] Trying netstat for port ${port}...`);
        const { stdout } = await execAsync(`netstat -tulpn | grep :${port}`);
        if (stdout.trim()) {
          console.log(`⚠️  [SCRIPT] Port ${port} appears to be in use, but couldn't get PID details`);
        }
      } catch (netstatError) {
        console.log(`⚠️  [SCRIPT] Could not check port ${port}, continuing...`);
      }
    }
  }
  
  // Also try to kill by process name as backup
  try {
    console.log('🔍 [SCRIPT] Checking for poker-trainer related processes...');
    const { stdout } = await execAsync('pgrep -f "poker-trainer|poker-backend|vite"');
    const pids = stdout.trim().split('\n').filter(pid => pid);
    
    if (pids.length > 0) {
      console.log(`🛑 [SCRIPT] Found ${pids.length} poker-trainer related process(es), killing them...`);
      for (const pid of pids) {
        try {
          await execAsync(`kill -9 ${pid}`);
          console.log(`✅ [SCRIPT] Killed poker-trainer process ${pid}`);
          totalKilled++;
        } catch (error) {
          console.log(`⚠️  [SCRIPT] Could not kill process ${pid}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    // pgrep might not be available on all systems
    console.log('⚠️  [SCRIPT] Could not check for poker-trainer processes, continuing...');
  }
  
  if (totalKilled > 0) {
    // Wait a moment for processes to fully terminate
    console.log('⏳ [SCRIPT] Waiting for processes to fully terminate...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`✅ [SCRIPT] Terminated ${totalKilled} process(es) total`);
  } else {
    console.log('✅ [SCRIPT] No existing processes found on our ports');
  }
}

// Start backend process
function startBackend() {
  console.log('🚀 [SCRIPT] Starting Rust backend...');
  const backend = spawn('cargo', ['run'], {
    cwd: './backend',
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true
  });

  backend.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[BACKEND] ${output.trim()}`);
    if (output.includes('Server listening and ready!')) {
      console.log('✅ [SCRIPT] Backend is ready and listening!');
    }
  });

  backend.stderr.on('data', (data) => {
    const error = data.toString();
    if (error.includes('Address already in use')) {
      console.log('⚠️  [SCRIPT] Backend port already in use, assuming it\'s running...');
    } else if (error.trim()) {
      console.error('[BACKEND ERROR]', error.trim());
    }
  });

  backend.on('close', (code) => {
    if (code !== 0) {
      console.log(`[SCRIPT] Backend process exited with code ${code}`);
    }
  });

  return backend;
}

// Start frontend process
function startFrontend() {
  console.log('🎨 [SCRIPT] Starting Vite frontend...');
  const frontend = spawn('bun', ['run', 'dev:frontend'], {
    stdio: 'inherit',
    shell: true
  });

  return frontend;
}

// Send hot refresh signal to frontend
async function sendHotRefresh() {
  try {
    console.log('🔄 [SCRIPT] Sending hot refresh signal to frontend...');
    
    // Try to send a refresh signal to the frontend
    const response = await fetch('http://localhost:5174/api/hot-refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        timestamp: Date.now(),
        message: 'Backend restarted, please refresh' 
      }),
      signal: AbortSignal.timeout(3000)
    });
    
    if (response.ok) {
      console.log('✅ [SCRIPT] Hot refresh signal sent successfully');
    } else {
      console.log('⚠️  [SCRIPT] Hot refresh signal failed, but frontend should auto-refresh');
    }
  } catch (error) {
    console.log('⚠️  [SCRIPT] Could not send hot refresh signal (this is normal if frontend is not ready yet)');
  }
}

// Main function
async function main() {
  console.log('🔄 [SCRIPT] Ensuring fresh start...');
  
  // Always kill any existing processes on our ports first
  await killExistingProcesses();
  
  // Start fresh backend
  console.log('🚀 [SCRIPT] Starting fresh Rust backend...');
  const backendProcess = startBackend();
  
  // Wait a bit for backend to start
  console.log('⏳ [SCRIPT] Waiting for backend to start...');
  await new Promise(resolve => setTimeout(resolve, 4000));
  
  // Verify backend is now running
  const nowRunning = await isBackendRunning();
  if (!nowRunning) {
    console.log('❌ [SCRIPT] Backend failed to start properly');
    process.exit(1);
  }
  console.log('✅ [SCRIPT] Fresh backend is now running and ready!');
  
  // Start frontend
  console.log('🎨 [SCRIPT] Starting frontend...');
  const frontendProcess = startFrontend();
  
  // Wait a bit for frontend to start, then send hot refresh signal
  console.log('⏳ [SCRIPT] Waiting for frontend to start...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Send hot refresh signal to existing browser tab
  await sendHotRefresh();
  
  // Handle cleanup on exit
  process.on('SIGINT', async () => {
    console.log('\n🛑 [SCRIPT] Shutting down...');
    if (backendProcess) {
      backendProcess.kill('SIGTERM');
    }
    frontendProcess.kill('SIGTERM');
    
    // Also kill any remaining processes on our ports
    await killExistingProcesses();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    if (backendProcess) {
      backendProcess.kill('SIGTERM');
    }
    frontendProcess.kill('SIGTERM');
    
    // Also kill any remaining processes on our ports
    await killExistingProcesses();
    process.exit(0);
  });
}

main().catch(console.error);
