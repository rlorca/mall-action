import {execFileSync} from 'node:child_process';
execFileSync(process.env.CARGO || 'cargo',['test'],{stdio:'inherit'});
execFileSync(process.execPath,['--test','tests/browser.test.mjs'],{stdio:'inherit'});
