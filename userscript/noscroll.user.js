// ==UserScript==
// @name        NoScroll
// @description Instagram in the browser without the Reels feed. A reel that was sent to you still plays.
// @version     1.0.0
// @match       *://instagram.com/*
// @match       *://*.instagram.com/*
// @run-at      document-start
// @inject-into auto
// @noframes
// ==/UserScript==

(function () {
  'use strict';
  if (window.__noscrollLoaded) { return; }
  window.__noscrollLoaded = true;

  if (!/(^|\.)instagram\.com$/.test(location.hostname)) { return; }

  var TAB_SELECTOR = 'a[href="/reels/"], a[href="/reels"]';

  // ---------- 1. hide the Reels tab ----------
  function addStyle() {
    try {
      if (document.getElementById('noscroll-style')) { return; }
      var root = document.head || document.documentElement;
      if (!root) { return; }
      var style = document.createElement('style');
      style.id = 'noscroll-style';
      style.textContent = TAB_SELECTOR + ' { display: none !important; }';
      root.appendChild(style);
    } catch (e) {}
  }

  var hideQueued = false;
  function hideTab() {
    hideQueued = false;
    try {
      var list = document.querySelectorAll(TAB_SELECTOR);
      for (var i = 0; i < list.length; i++) {
        list[i].style.setProperty('display', 'none', 'important');
      }
    } catch (e) {}
  }
  function queueHide() {
    if (hideQueued) { return; }
    hideQueued = true;
    setTimeout(hideTab, 50);
  }

  // ---------- 2 + 3. guard the address ----------
  var lastPath = null;
  var lastSafe = '/';
  var allowedReel = null;

  function reelId(path) {
    var m = /^\/reels?\/([^\/]+)\/?$/.exec(path);
    return m ? m[1] : null;
  }
  function isReelsFeed(path) {
    return /^\/reels\/?$/.test(path);
  }
  function leave() {
    var target = lastSafe || '/';
    allowedReel = null;
    try { location.replace(target); } catch (e) { location.href = '/'; }
  }
  function check() {
    var path = location.pathname;
    if (path === lastPath) { return; }
    var previous = lastPath;
    lastPath = path;

    if (isReelsFeed(path)) { leave(); return; }

    var id = reelId(path);
    if (id) {
      var cameFromReel = previous !== null && reelId(previous) !== null;
      if (!cameFromReel) { allowedReel = id; return; }
      if (id !== allowedReel) { leave(); }
      return;
    }

    allowedReel = null;
    lastSafe = path + (location.search || '');
  }
  function safeCheck() {
    try { check(); } catch (e) {}
  }

  function wrap(name) {
    var original = history[name];
    if (typeof original !== 'function') { return; }
    history[name] = function () {
      var result = original.apply(this, arguments);
      safeCheck();
      return result;
    };
  }
  wrap('pushState');
  wrap('replaceState');
  window.addEventListener('popstate', safeCheck, true);
  window.addEventListener('hashchange', safeCheck, true);
  setInterval(safeCheck, 500);

  addStyle();
  safeCheck();

  function onReady() {
    addStyle();
    hideTab();
    try {
      new MutationObserver(queueHide).observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    } catch (e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
