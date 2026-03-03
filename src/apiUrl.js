// In development, Vite runs on a different port from the Express server.
// In production (Railway/Docker), the frontend is served by the same Express server,
// so API calls use relative URLs (empty string prefix).
const API_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';
export default API_URL;
