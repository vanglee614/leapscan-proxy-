const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Allow requests from your GitHub Pages scanner
app.use(cors({
  origin: '*', // Lock this down to your GitHub Pages URL after testing
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key']
}));

app.use(express.json());

// ─── HEALTH CHECK ───
app.get('/', (req, res) => {
  res.json({
    status: 'LEAPSCAN PROXY ONLINE',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ─── PROXY ROUTE — ALL PUBLIC.COM API CALLS ───
app.all('/proxy/*', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    // Strip /proxy/ prefix to get the actual Public.com endpoint
    const path = req.params[0];
    const queryString = new URLSearchParams(req.query).toString();
    const targetUrl = `https://api.public.com/api/v1/${path}${queryString ? '?' + queryString : ''}`;

    console.log(`[PROXY] ${req.method} → ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });

    const data = await response.json();
    res.status(response.status).json(data);

  } catch (err) {
    console.error('[PROXY ERROR]', err.message);
    res.status(500).json({ error: 'Proxy error', message: err.message });
  }
});

// ─── QUOTE ENDPOINT — SINGLE TICKER ───
app.get('/quote/:symbol', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const { symbol } = req.params;

    const response = await fetch(
      `https://api.public.com/api/v1/market-data/quotes?symbol=${symbol}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── OPTIONS CHAIN ENDPOINT ───
app.get('/options/:symbol', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const { symbol } = req.params;
    const { expiration_type } = req.query;

    const response = await fetch(
      `https://api.public.com/api/v1/options/chain?symbol=${symbol}&expiration_type=${expiration_type || 'LEAPS'}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── HISTORICAL DATA ENDPOINT ───
app.get('/history/:symbol', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const { symbol } = req.params;
    const { period, interval } = req.query;

    const response = await fetch(
      `https://api.public.com/api/v1/market-data/history?symbol=${symbol}&period=${period || '1y'}&interval=${interval || '1d'}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── BATCH QUOTES — multiple tickers at once ───
app.post('/batch-quotes', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ error: 'symbols array required' });
    }

    const results = await Promise.allSettled(
      symbols.map(async (symbol) => {
        const response = await fetch(
          `https://api.public.com/api/v1/market-data/quotes?symbol=${symbol}`,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );
        const data = await response.json();
        return { symbol, data };
      })
    );

    const quotes = {};
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        quotes[result.value.symbol] = result.value.data;
      }
    });

    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ LEAPSCAN Proxy running on port ${PORT}`);
});
