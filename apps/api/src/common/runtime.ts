/**
 * True when the API runs as a serverless function (Vercel). There, WebSockets, background timers and
 * writing to disk do not work, so the app switches to polling-friendly behaviour and database photo storage.
 */
export const SERVERLESS = process.env.VERCEL === '1' || process.env.SERVERLESS === 'true';
