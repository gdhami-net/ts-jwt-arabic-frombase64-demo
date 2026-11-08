import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');

export function compile(config: string): { status: number; output: string } {
  const r = spawnSync(process.execPath, [tsc, '-p', `tsc-step/${config}`], { cwd: root, encoding: 'utf8' });
  return { status: r.status ?? -1, output: (r.stdout + r.stderr).trim() };
}

if (import.meta.main) {
  for (const config of [
    'tsconfig.angular-default.json',
    'tsconfig.with-lib.json',
    'tsconfig.lib-alone.json',
    'tsconfig.lib-esnext.json',
    'tsconfig.in-operator.json',
  ]) {
    const r = compile(config);
    const lines = r.output.split('\n');
    console.log(`--- ${config}: exit ${r.status}, ${r.output ? lines.length : 0} lines`);
    console.log(lines.slice(0, 6).join('\n'));
  }
}
