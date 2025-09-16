import crypto from 'crypto';

// API key validation middleware for inter-service communication
// This validates requests coming from the API gateway or other services
export const apiKeyMiddleware = (req, res, next) => {
  try {
    // Get global API key from environment
    const expectedAPIKey = process.env.GLOBAL_API_KEY;
    if (!expectedAPIKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Get API key from request header
    const providedAPIKey = req.headers['x-api-key'];
    if (!providedAPIKey) {
      return res.status(401).json({ error: 'Missing API key' });
    }

    // Validate API key using simple string comparison
    if (providedAPIKey !== expectedAPIKey) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    next();
  } catch (error) {
    return res.status(500).json({ error: 'API key validation failed' });
  }
};
