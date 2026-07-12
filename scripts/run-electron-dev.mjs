#!/usr/bin/env node
/**
 * Launch Electron against the Vite dev server.
 * Expects `npm run dev` (or another host on GOMI_VITE_DEV_URL / GOMI_VITE_PORT)
 * to already be running unless you only want the shell to open.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronBin = path.join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron'
);

const env = {
  ...process.env,
  GOMI_ELECTRON_DEV: process.env.GOMI_ELECTRON_DEV || '1'
};

const child = spawn(electronBin, ['.'], {
  cwd: root,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
