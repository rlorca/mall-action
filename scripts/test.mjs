import { execFileSync } from 'node:child_process';
execFileSync(process.env.CARGO || 'cargo', ['test', '--release'], { stdio: 'inherit' });
execFileSync(process.execPath, ['--test', 'tests/'], { stdio: 'inherit' });
