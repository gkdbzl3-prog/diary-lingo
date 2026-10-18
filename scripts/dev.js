// 서버와 vite를 한 번에 띄운다. 하나가 죽으면 같이 정리한다.
//   pnpm dev
import { spawn } from 'node:child_process';

const procs = [
  spawn(process.execPath, ['--env-file-if-exists=.env', 'src/server.js'], { stdio: 'inherit' }),
  spawn('pnpm', ['exec', 'vite'], { stdio: 'inherit' }),
];

let closing = false;
const stopAll = (code) => {
  if (closing) return;
  closing = true;
  for (const p of procs) p.kill('SIGTERM');
  process.exit(code ?? 0);
};

for (const p of procs) p.on('exit', (code) => stopAll(code ?? 0));
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
