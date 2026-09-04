(function () {
  'use strict';

  var SEL = 'h1, h2, h3, h4, h5, h6, p, li, blockquote, figcaption, td, th, dt, dd, a.btn-primary, a.btn-secondary, .hero-tag, .section-label, .solution-badge';
  var FILE = location.pathname === '/' ? '/index.html' : location.pathname;
  if (!FILE.endsWith('.html')) FILE += '.html';

  var originals = new Map();
  var changed   = new Map();

  // ── TOOLBAR ────────────────────────────────────────────
  function createBar() {
    var bar = document.createElement('div');
    bar.id = 'sf-ebar';
    bar.innerHTML =
      '<span id="sf-elabel">✏️ Edit-Modus</span>' +
      '<span id="sf-ebadge"></span>' +
      '<button id="sf-esave">Speichern <kbd>Ctrl+S</kbd></button>' +
      '<span id="sf-efeedback"></span>';
    bar.style.cssText =
      'position:fixed;bottom:0;left:0;right:0;z-index:99999;' +
      'display:flex;align-items:center;gap:12px;' +
      'padding:10px 24px;' +
      'background:rgba(0,51,102,0.95);backdrop-filter:blur(12px);' +
      'color:#fff;font:500 14px/1 Inter,system-ui,sans-serif;' +
      'box-shadow:0 -2px 12px rgba(0,0,0,0.15);';
    document.body.appendChild(bar);

    var badge = document.getElementById('sf-ebadge');
    badge.style.cssText =
      'background:#e74c3c;color:#fff;border-radius:999px;' +
      'padding:2px 10px;font-size:12px;font-weight:700;display:none;';

    var btn = document.getElementById('sf-esave');
    btn.style.cssText =
      'margin-left:auto;background:#fff;color:#003366;border:none;' +
      'padding:8px 18px;border-radius:8px;font:600 13px/1 Inter,system-ui,sans-serif;' +
      'cursor:pointer;display:flex;align-items:center;gap:6px;';
    btn.querySelector('kbd').style.cssText =
      'background:#e6f0f7;padding:2px 6px;border-radius:4px;font-size:11px;';
    btn.addEventListener('click', save);

    var fb = document.getElementById('sf-efeedback');
    fb.style.cssText = 'font-size:13px;transition:opacity 0.3s;';

    document.body.style.paddingBottom = '56px';
  }

  function updateBadge() {
    var n = changed.size;
    var badge = document.getElementById('sf-ebadge');
    if (n > 0) {
      badge.textContent = n + (n === 1 ? ' Änderung' : ' Änderungen');
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }
  }

  function showFeedback(msg, ok) {
    var fb = document.getElementById('sf-efeedback');
    fb.textContent = msg;
    fb.style.color = ok ? '#4ade80' : '#f87171';
    fb.style.opacity = '1';
    setTimeout(function () { fb.style.opacity = '0'; }, 3000);
  }

  // ── MAKE EDITABLE ──────────────────────────────────────
  function initElements() {
    document.querySelectorAll(SEL).forEach(function (el) {
      if (el.closest('#sf-ebar, script, style, nav')) return;
      if (el.children.length > 0 && el.textContent.trim().length === 0) return;

      el.setAttribute('contenteditable', 'true');
      el.style.outline = 'none';
      el.style.transition = 'outline 0.15s, background 0.15s';
      el.setAttribute('spellcheck', 'false');

      originals.set(el, el.innerHTML);

      el.addEventListener('mouseenter', function () {
        if (document.activeElement !== el) {
          el.style.outline = '2px dashed rgba(0,102,153,0.35)';
          el.style.outlineOffset = '3px';
        }
      });
      el.addEventListener('mouseleave', function () {
        if (document.activeElement !== el) {
          el.style.outline = 'none';
        }
      });
      el.addEventListener('focus', function () {
        el.style.outline = '2px solid #006699';
        el.style.outlineOffset = '3px';
        el.style.background = 'rgba(0,102,153,0.04)';
      });
      el.addEventListener('blur', function () {
        el.style.outline = 'none';
        el.style.background = '';
        trackChange(el);
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey && el.matches('h1,h2,h3,h4,h5,h6')) {
          e.preventDefault();
          el.blur();
        }
      });
    });

    document.querySelectorAll('a[href]').forEach(function (a) {
      if (a.closest('#sf-ebar, nav')) return;
      if (a.getAttribute('contenteditable') === 'true' || a.closest('[contenteditable="true"]')) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
        });
      }
    });
  }

  function trackChange(el) {
    var orig = originals.get(el);
    if (orig === undefined) return;
    if (el.innerHTML !== orig) {
      changed.set(el, { old: orig, new: el.innerHTML });
    } else {
      changed.delete(el);
    }
    updateBadge();
  }

  // ── SAVE ───────────────────────────────────────────────
  function save() {
    if (changed.size === 0) {
      showFeedback('Keine Änderungen.', true);
      return;
    }

    if (document.activeElement && document.activeElement.getAttribute('contenteditable') === 'true') {
      document.activeElement.blur();
    }

    var payload = [];
    changed.forEach(function (val) {
      payload.push({ old: val.old, new: val.new });
    });

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/__save');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function () {
      if (xhr.status === 200) {
        var resp = JSON.parse(xhr.responseText);
        var ok = resp.results.filter(function (r) { return r.ok; }).length;
        var fail = resp.results.filter(function (r) { return !r.ok; }).length;

        changed.forEach(function (val, el) {
          originals.set(el, el.innerHTML);
        });
        changed.clear();
        updateBadge();

        if (fail === 0) {
          showFeedback('✓ ' + ok + ' gespeichert!', true);
        } else {
          showFeedback('✓ ' + ok + ' gespeichert, ' + fail + ' fehlgeschlagen.', false);
        }
      } else {
        showFeedback('Fehler beim Speichern.', false);
      }
    };
    xhr.onerror = function () {
      showFeedback('Server nicht erreichbar.', false);
    };
    xhr.send(JSON.stringify({ file: FILE, changes: payload }));
  }

  // ── CTRL+S ─────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      save();
    }
  });

  // ── INIT ───────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { createBar(); initElements(); });
  } else {
    createBar();
    initElements();
  }
})();
