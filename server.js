import http from 'node:http';
import { planTrip } from './lib/normalize.js';

const PORT = process.env.PORT || 8787;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    if (url.pathname === '/health') {
      res.end(JSON.stringify({ ok: true, service: 'scout-backend' }));
      return;
    }

    if (url.pathname === '/plan') {
      const q = url.searchParams.get('q') || '';
      if (!q.trim()) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'missing query param ?q=' }));
        return;
      }
      const plan = await planTrip(q);
      res.end(JSON.stringify(plan));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found' }));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(err?.message || err) }));
  }
});

server.listen(PORT, () => {
  console.log(`Scout backend listening on http://localhost:${PORT}`);
  console.log(`Try: curl "http://localhost:${PORT}/plan?q=Tokyo%20in%20spring%20under%20%242k"`);
});
