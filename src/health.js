const http = require('http');
const mongoose = require('mongoose');

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

// Minimal health check server for uptime monitors, load balancers and pm2.
//   GET /health -> 200 when MongoDB is connected, 503 otherwise
// `getDetails` lets each process add its own status (e.g. the last job run).
function startHealthServer({ name, port, getDetails = () => ({}) }) {
  const startedAt = new Date();

  const server = http.createServer((req, res) => {
    const path = req.url.split('?')[0];
    if (req.method !== 'GET' || path !== '/health') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    const db = DB_STATES[mongoose.connection.readyState] || 'unknown';
    const healthy = db === 'connected';
    const body = {
      status: healthy ? 'ok' : 'error',
      service: name,
      uptimeSeconds: Math.round(process.uptime()),
      startedAt,
      timestamp: new Date(),
      checks: { database: db },
      ...getDetails(),
    };
    res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  });

  server.listen(port, () => console.log(`[health] ${name} health check on http://localhost:${port}/health`));
  server.on('error', (err) => console.error(`[health] server error on port ${port}:`, err.message));
  return server;
}

module.exports = { startHealthServer };
