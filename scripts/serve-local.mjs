import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const port = Number(process.argv[2] || process.env.PORT || 8765);
createServer(async (req, res) => {
  if (req.url !== '/' && req.url !== '/index.html') {
    res.writeHead(404).end();
    return;
  }
  const html = await readFile(resolve(import.meta.dirname, '..', 'index.html'));
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(html);
}).listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}/`));
