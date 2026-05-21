const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','X-Api-Key'] }));
app.use(express.json());

// ─── HEALTH CHECK ───
app.get('/', (req, res) => {
  res.json({ status: 'LEAPSCAN PROXY ONLINE', version: '1.1.0', timestamp: new Date().toISOString() });
});

// ─── CLAUDE API PROXY ───
app.post('/claude', async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch(err) {
    console.error('[CLAUDE ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUBLIC.COM QUOTE ───
app.get('/quote/:symbol', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const response = await fetch(
      `https://api.public.com/api/v1/market-data/quotes?symbol=${req.params.symbol}`,
      { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
    );
    const data = await response.json();
    res.json(data);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── PUBLIC.COM HISTORY ───
app.get('/history/:symbol', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const { period, interval } = req.query;
    const response = await fetch(
      `https://api.public.com/api/v1/market-data/history?symbol=${req.params.symbol}&period=${period||'1y'}&interval=${interval||'1d'}`,
      { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
    );
    const data = await response.json();
    res.json(data);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── PUBLIC.COM OPTIONS CHAIN ───
app.get('/options/:symbol', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const response = await fetch(
      `https://api.public.com/api/v1/options/chain?symbol=${req.params.symbol}&expiration_type=${req.query.expiration_type||'LEAPS'}`,
      { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
    );
    const data = await response.json();
    res.json(data);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── BATCH QUOTES ───
app.post('/batch-quotes', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const { symbols } = req.body;
    if(!symbols || !Array.isArray(symbols)) return res.status(400).json({ error: 'symbols array required' });
    const results = await Promise.allSettled(
      symbols.map(async (symbol) => {
        const r = await fetch(`https://api.public.com/api/v1/market-data/quotes?symbol=${symbol}`,
          { headers: { 'Authorization': `Bearer ${apiKey}` } });
        return { symbol, data: await r.json() };
      })
    );
    const quotes = {};
    results.forEach(r => { if(r.status==='fulfilled') quotes[r.value.symbol] = r.value.data; });
    res.json(quotes);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`✅ LEAPSCAN Proxy v1.1.0 running on port ${PORT}`));
