// Hot refresh utility for development
let hotRefreshServer: any = null;

export function startHotRefreshServer() {
  // Only start in development mode
  if (import.meta.env.DEV) {
    try {
      // Create a simple HTTP server to receive hot refresh signals
      const http = require('http');
      
      hotRefreshServer = http.createServer((req: any, res: any) => {
        if (req.method === 'POST' && req.url === '/api/hot-refresh') {
          let body = '';
          req.on('data', (chunk: any) => {
            body += chunk.toString();
          });
          
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              console.log('🔄 [HOT REFRESH] Received refresh signal:', data.message);
              
              // Send CORS headers
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
              res.setHeader('Content-Type', 'application/json');
              
              res.writeHead(200);
              res.end(JSON.stringify({ success: true, message: 'Refresh signal received' }));
              
              // Trigger page refresh
              setTimeout(() => {
                window.location.reload();
              }, 500);
              
            } catch (error) {
              console.error('Error parsing hot refresh data:', error);
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
        } else if (req.method === 'OPTIONS') {
          // Handle CORS preflight
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.writeHead(200);
          res.end();
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });
      
      // Start server on port 5174 (different from Vite's 5173)
      hotRefreshServer.listen(5174, () => {
        console.log('🔄 [HOT REFRESH] Server listening on port 5174');
      });
      
    } catch (error) {
      console.log('⚠️ [HOT REFRESH] Could not start hot refresh server:', error);
    }
  }
}

export function stopHotRefreshServer() {
  if (hotRefreshServer) {
    hotRefreshServer.close();
    hotRefreshServer = null;
    console.log('🔄 [HOT REFRESH] Server stopped');
  }
}
