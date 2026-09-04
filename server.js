const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
};

http.createServer((req, res) => {

  // ── SAVE ENDPOINT ──────────────────────────────────────
  if (req.method === 'POST' && req.url === '/__save') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { file, changes } = JSON.parse(body);
        const safe = path.resolve(ROOT, file.replace(/^\/+/, ''));
        if (!safe.startsWith(ROOT) || !safe.endsWith('.html')) {
          res.writeHead(403);
          return res.end(JSON.stringify({ error: 'Nicht erlaubt' }));
        }

        let html = fs.readFileSync(safe, 'utf-8');
        const results = [];

        function normalize(s) {
          return s
            .replace(/\s+/g, ' ')
            .replace(/<br\s*\/?>/gi, '<br />')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&nbsp;/g, ' ')
            .trim();
        }

        for (const { old: oldText, new: newText } of changes) {
          if (html.includes(oldText)) {
            html = html.replace(oldText, newText);
            results.push({ old: oldText.slice(0, 40), ok: true });
          } else {
            const normOld = normalize(oldText);
            const lines = html.split('\n');
            let found = false;
            for (let i = 0; i < lines.length; i++) {
              const normLine = normalize(lines[i]);
              if (normLine.includes(normOld)) {
                const tagMatch = lines[i].match(/^(\s*<[^>]+>)/);
                const tagEnd = lines[i].match(/(<\/[^>]+>\s*)$/);
                const prefix = tagMatch ? tagMatch[1] : '';
                const suffix = tagEnd ? tagEnd[1] : '';
                lines[i] = prefix + newText + suffix;
                found = true;
                break;
              }
            }
            if (found) {
              html = lines.join('\n');
              results.push({ old: oldText.slice(0, 40), ok: true, fuzzy: true });
            } else {
              results.push({ old: oldText.slice(0, 40), ok: false });
            }
          }
        }

        fs.writeFileSync(safe, html, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, results }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── STATIC FILES ───────────────────────────────────────
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  if (!path.extname(urlPath) && fs.existsSync(path.join(ROOT, urlPath + '.html'))) {
    urlPath += '.html';
  }

  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end(); }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }

    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';

    if (ext === '.html') {
      const html = data.toString().replace('</body>', '<script src="/editor.js"></script>\n</body>');
      res.writeHead(200, { 'Content-Type': mime });
      res.end(html);
    } else {
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    }
  });

}).listen(PORT, () => {
  console.log(`\n  SITEFORUM Editor → http://localhost:${PORT}\n`);
  console.log('  Klicke auf Text zum Bearbeiten.');
  console.log('  Ctrl+S speichert alle Änderungen in die HTML-Dateien.\n');
});
