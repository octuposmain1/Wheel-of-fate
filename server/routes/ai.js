import { Router } from 'express';

export const aiRouter = Router();

aiRouter.get('/config', (req, res) => {
  const hasOpenAiKey = !!process.env.OPENAI_API_KEY;
  const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;
  res.json({
    hasServerKey: hasOpenAiKey || hasOpenRouterKey,
    hasOpenAiKey,
    hasOpenRouterKey
  });
});

aiRouter.post('/chat', async (req, res) => {
  try {
    const { url, apiKey, requestBody } = req.body ?? {};
    if (!url || !requestBody) {
      return res.status(400).json({ error: { message: 'url and requestBody are required' } });
    }

    let finalApiKey = (apiKey || '').trim();
    if (!finalApiKey) {
      if (url.includes('openrouter.ai')) {
        finalApiKey = (process.env.OPENROUTER_API_KEY || '').trim();
      } else {
        finalApiKey = (process.env.OPENAI_API_KEY || '').trim();
      }
    }

    if (!finalApiKey) {
      return res.status(400).json({ error: { message: 'API key is required (not found in request or server environment).' } });
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${finalApiKey}`,
      'HTTP-Referer': 'http://localhost:4000',
      'X-Title': 'Wheel of Fate'
    };

    const upstreamResponse = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    const data = await upstreamResponse.json();
    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json({
        error: data.error || { message: `Upstream API returned status ${upstreamResponse.status}` }
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Error in AI completions proxy:', error);
    res.status(500).json({ error: { message: error.message } });
  }
});
