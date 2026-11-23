// Builds userscript/noscroll.user.js from the page script inside
// NoScroll/Blocker.swift, so the app and the browser version share one source.
// Run: node tools/make-userscript.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const swift = readFileSync(join(here, '..', 'NoScroll', 'Blocker.swift'), 'utf8');

const match = /static let script = #"""\r?\n([\s\S]*?)\r?\n\s*"""#/.exec(swift);
if (!match) { throw new Error('page script not found in Blocker.swift'); }

// Remove the Swift indentation (4 spaces) from every line.
const body = match[1]
  .split(/\r?\n/)
  .map((line) => line.replace(/^ {4}/, ''))
  .join('\n');

const header = [
  '// ==UserScript==',
  '// @name        NoScroll',
  '// @description Instagram in the browser without the Reels feed. A reel that was sent to you still plays.',
  '// @version     1.0.0',
  '// @match       *://instagram.com/*',
  '// @match       *://*.instagram.com/*',
  '// @run-at      document-start',
  '// @inject-into auto',
  '// @noframes',
  '// ==/UserScript==',
  '',
].join('\n');

const out = join(here, '..', 'userscript', 'noscroll.user.js');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, header + '\n' + body + '\n');
console.log('userscript written:', out, Buffer.byteLength(header + body), 'bytes');
