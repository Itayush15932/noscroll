// Tests the page script from NoScroll/Blocker.swift in a simulated page.
// Run: node tools/test-blocker.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const swift = readFileSync(join(here, '..', 'NoScroll', 'Blocker.swift'), 'utf8');

const match = /static let script = #"""\r?\n([\s\S]*?)\r?\n\s*"""#/.exec(swift);
if (!match) { throw new Error('page script not found in Blocker.swift'); }
const script = match[1];

const rules = /static let contentRules = #"""\r?\n([\s\S]*?)\r?\n\s*"""#/.exec(swift);
if (!rules) { throw new Error('content rules not found in Blocker.swift'); }

function makePage(hostname, startPath) {
  const page = { replaced: [], timers: [], listeners: {} };
  const location = {
    hostname,
    pathname: startPath,
    search: '',
    replace(target) { page.replaced.push(target); },
    set href(v) { page.replaced.push(v); },
  };
  const setPath = (url) => {
    const [path, search] = String(url).split('?');
    location.pathname = path;
    location.search = search ? '?' + search : '';
  };
  const history = {
    pushState(_s, _t, url) { setPath(url); },
    replaceState(_s, _t, url) { setPath(url); },
  };
  const document = {
    readyState: 'complete',
    head: { appendChild() {} },
    documentElement: {},
    getElementById() { return null; },
    createElement() { return { style: {} }; },
    querySelectorAll() { return []; },
    addEventListener() {},
  };
  const window = {
    addEventListener(name, fn) { page.listeners[name] = fn; },
  };
  const context = {
    window, location, history, document,
    setInterval(fn) { page.timers.push(fn); return 1; },
    setTimeout() { return 1; },
    MutationObserver: class { observe() {} },
  };
  vm.createContext(context);
  vm.runInContext(script, context);
  page.history = history;
  page.window = window;
  page.location = location;
  return page;
}

let failed = 0;
function expect(name, actual, wanted) {
  const ok = JSON.stringify(actual) === JSON.stringify(wanted);
  if (!ok) { failed++; }
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : `  got ${JSON.stringify(actual)}, wanted ${JSON.stringify(wanted)}`));
}

// 1. Tapping the Reels tab from the home feed leaves at once.
let p = makePage('www.instagram.com', '/');
p.history.pushState(null, '', '/reels/');
expect('reels feed from home is left', p.replaced, ['/']);

// 2. Opening the app directly on the Reels feed leaves at once.
p = makePage('www.instagram.com', '/reels/');
expect('reels feed on first load is left', p.replaced, ['/']);

// 3. One reel sent in a chat plays; moving to the next reel goes back to the chat.
p = makePage('www.instagram.com', '/direct/t/123/');
p.history.pushState(null, '', '/reels/AAA/');
expect('a single sent reel is allowed', p.replaced, []);
p.history.replaceState(null, '', '/reels/BBB/');
expect('the next reel sends back to the chat', p.replaced, ['/direct/t/123/']);

// 4. The site renaming /reel/AAA/ to /reels/AAA/ is the same reel, still allowed.
p = makePage('www.instagram.com', '/direct/t/123/');
p.history.pushState(null, '', '/reel/AAA/');
p.history.replaceState(null, '', '/reels/AAA/');
expect('same reel under both addresses is allowed', p.replaced, []);

// 5. Ordinary pages are untouched.
p = makePage('www.instagram.com', '/');
p.history.pushState(null, '', '/p/xyz/');
p.history.pushState(null, '', '/someuser/');
p.history.pushState(null, '', '/someuser/reels/');
p.history.pushState(null, '', '/explore/');
p.history.pushState(null, '', '/direct/inbox/');
expect('posts, profiles, search and inbox are untouched', p.replaced, []);

// 6. After watching a sent reel and returning, a second sent reel is allowed too.
p = makePage('www.instagram.com', '/direct/t/123/');
p.history.pushState(null, '', '/reels/AAA/');
p.history.pushState(null, '', '/direct/t/123/');
p.history.pushState(null, '', '/reels/CCC/');
expect('a second sent reel after returning is allowed', p.replaced, []);

// 7. The script does nothing on other sites.
p = makePage('www.example.com', '/reels/');
expect('other sites are untouched', p.replaced, []);
expect('no timers on other sites', p.timers.length, 0);

// 8. A site with a similar name is not treated as Instagram.
p = makePage('notinstagram.com', '/reels/');
expect('look-alike host is untouched', p.replaced, []);

// 9. The timer fallback catches a change made without the history calls.
p = makePage('www.instagram.com', '/direct/t/9/');
p.location.pathname = '/reels/';
expect('nothing happens before the timer fires', p.replaced, []);
p.timers[0]();
expect('timer fallback leaves the reels feed', p.replaced, ['/direct/t/9/']);

// 9b. Going back in history into the reels feed is caught too.
p = makePage('www.instagram.com', '/');
p.location.pathname = '/reels/';
p.listeners.popstate();
expect('back button into the reels feed is left', p.replaced, ['/']);

// 10. The native content rules are valid JSON with the expected shape.
let parsed = null;
try { parsed = JSON.parse(rules[1]); } catch (e) { parsed = null; }
expect('content rules parse as JSON', Array.isArray(parsed), true);
expect('content rules hide the reels tab', parsed && parsed[0].action.type, 'css-display-none');
expect('content rules selector', parsed && parsed[0].action.selector, 'a[href="/reels/"], a[href="/reels"]');

console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
