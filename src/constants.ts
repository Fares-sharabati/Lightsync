// If VITE_PUBLIC_APP_URL isn't set at build time, fall back to whatever
// origin the app is actually being served from. This matters a lot here:
// this URL is what gets baked into the audience QR code and every join
// link. A hardcoded fallback domain that doesn't match the real deployment
// would mean every QR code at the show points to the wrong place.
const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://lightsync-two.vercel.app';
export const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL || runtimeOrigin).replace(/\/$/, '');