import { readFileSync } from 'node:fs';
import { passwordHash } from './app.mjs';
// Read stdin, so the password never appears in command arguments or history.
console.log(passwordHash(readFileSync(0,'utf8').trimEnd()));
