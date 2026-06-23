#!/usr/bin/env node
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');
const PORT = process.env.PORT || 3456;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let filePath = path.join(distDir, url.pathname === '/' ? 'index.html' : url.pathname);
  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/html' });
    res.end(content);
  } catch {
    // SPA fallback
    const fallback = fs.readFileSync(path.join(distDir, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fallback);
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  🥗  AI 健康饮食规划');
  console.log(`  ➜  http://localhost:${PORT}`);
  console.log('');
  console.log('  按 Ctrl+C 退出');
  console.log('');

  // 自动打开浏览器
  const cmd = process.platform === 'win32'
    ? `start msedge http://localhost:${PORT}`
    : process.platform === 'darwin'
      ? `open http://localhost:${PORT}`
      : `xdg-open http://localhost:${PORT}`;
  exec(cmd);
});
