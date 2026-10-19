import { gameBackend } from '../lib/game-backend.js';
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const backend = gameBackend();
  if (!backend) return res.status(503).json({ error: 'preview_backend_not_configured' });
  return res.status(200).json({ supabaseUrl: backend.url, supabaseKey: backend.key, functionRegion: backend.region });
}
