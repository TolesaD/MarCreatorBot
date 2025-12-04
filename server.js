// server.js - Simple HTTP Server for Local Testing
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Configuration
const PORT = process.env.PORT || 3000;
const USE_HTTPS = process.env.USE_HTTPS === 'true';
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain'
};

// Request handler
function handleRequest(req, res) {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  const parsedUrl = url.parse(req.url);
  let pathname = parsedUrl.pathname;
  
  // Default to index.html for root
  if (pathname === '/') {
    pathname = '/index.html';
  }
  
  // Remove trailing slash
  if (pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  
  // Map /wallet to wallet directory
  if (pathname.startsWith('/wallet')) {
    const walletPath = pathname.replace('/wallet', '');
    if (walletPath === '' || walletPath === '/') {
      serveFile(res, './wallet/index.html');
    } else {
      serveFile(res, `./wallet${walletPath}`);
    }
    return;
  }
  
  // Serve other static files
  serveFile(res, `.${pathname}`);
}

// Serve file function
function serveFile(res, filePath) {
  const extname = path.extname(filePath);
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';
  
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found
        if (filePath.includes('.html')) {
          // Try to serve 404
          fs.readFile('./wallet/index.html', (err, content) => {
            if (err) {
              res.writeHead(404, { 'Content-Type': 'text/html' });
              res.end('<h1>404 Not Found</h1><p>Wallet not available</p>');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(content, 'utf-8');
            }
          });
        } else {
          res.writeHead(404);
          res.end(`File ${filePath} not found`);
        }
      } else {
        // Server error
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}

// Create server
let server;
if (USE_HTTPS && SSL_CERT_PATH && SSL_KEY_PATH) {
  try {
    const options = {
      key: fs.readFileSync(SSL_KEY_PATH),
      cert: fs.readFileSync(SSL_CERT_PATH)
    };
    server = https.createServer(options, handleRequest);
    console.log('🔒 HTTPS server configured');
  } catch (error) {
    console.error('❌ Failed to load SSL certificates:', error.message);
    console.log('⚠️  Falling back to HTTP');
    server = http.createServer(handleRequest);
  }
} else {
  server = http.createServer(handleRequest);
}

// Start server
server.listen(PORT, () => {
  console.log('🚀 Local Wallet Test Server Started');
  console.log('====================================');
  console.log(`Mode: ${USE_HTTPS ? 'HTTPS' : 'HTTP'}`);
  console.log(`Port: ${PORT}`);
  console.log(`\n🌐 Available URLs:`);
  console.log(`   Wallet: http${USE_HTTPS ? 's' : ''}://localhost:${PORT}/wallet`);
  console.log(`   Main: http${USE_HTTPS ? 's' : ''}://localhost:${PORT}/`);
  console.log(`\n📁 Serving from:`);
  console.log(`   Root: ${__dirname}`);
  console.log(`   Wallet: ${__dirname}/wallet`);
  console.log(`\n✅ Server is running. Press Ctrl+C to stop.`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Error handling
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    console.log('💡 Try a different port: PORT=3001 node server.js');
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});