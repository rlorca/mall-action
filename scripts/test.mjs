import { execFileSync } from 'node:child_process';
const cargo = process.env.CARGO || 'cargo';
execFileSync(cargo, ['test', '--release'], { stdio: 'inherit' });
// The wasm replay test runs the built module, so build it first (a clean checkout has no target/ yet).
execFileSync(cargo, ['build', '--release', '--target', 'wasm32-unknown-unknown'], { stdio: 'inherit' });
execFileSync(process.execPath, ['--test', 'tests/audio.test.mjs', 'tests/wasm.test.mjs'], { stdio: 'inherit' });
