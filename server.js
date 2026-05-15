import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from './api/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

async function localHandler(req, res) {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

  // Serve API requests via the shared handler
  if (pathname.startsWith('/api/')) {
    return handler(req, res);
  }

  // Serve static files
  let filePath = path.join(__dirname, pathname === '/' ? '/index.html' : pathname);
  const ext = path.extname(filePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const mime = MIME[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': mime });
    return fs.createReadStream(filePath).pipe(res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found: ' + pathname);
}

const server = http.createServer(localHandler);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Local Server live at http://localhost:${PORT}`);
  console.log(`📡 Connected to Neon HTTP via shared API handler`);
});
