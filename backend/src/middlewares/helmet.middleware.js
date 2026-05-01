import helmet from 'helmet';

const isProduction = process.env.NODE_ENV === 'production';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

// Parse frontend URL for explicit CSP host declarations
const frontendOrigin = (() => {
  try {
    const url = new URL(frontendUrl);
    return url.origin;
  } catch {
    return frontendUrl;
  }
})();

// CSP Directives Explanation:
// - default-src 'self': Only allow resources from same origin by default
// - style-src: 'unsafe-inline' required for React/Vite CSS-in-JS. Fonts from Google CDN.
// - script-src: 'self' only in production. 'unsafe-eval' needed for Vite HMR in dev.
// - img-src: Self, data URIs, blobs, and OAuth provider avatar domains
// - connect-src: API calls to backend, OAuth endpoints, and WebSocket for HMR
// - font-src: Self and Google Fonts CDN
// - frame-ancestors: Prevents clickjacking by controlling who can embed in iframe
// - base-uri: Prevents base tag injection attacks
// - form-action: Restricts where forms can submit
// - upgrade-insecure-requests: Forces HTTPS in production
const contentSecurityPolicy = {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: [
      "'self'",
      "'unsafe-inline'", // Required for React/Vite CSS-in-JS
      "https://fonts.googleapis.com"
    ],
    scriptSrc: isProduction
      ? ["'self'"] // Strict in production - no inline scripts
      : ["'self'", "'unsafe-eval'"], // Dev: Vite HMR needs unsafe-eval
    imgSrc: [
      "'self'",
      "data:",
      "blob:",
      "https://avatars.githubusercontent.com", // GitHub OAuth avatars
      "https://lh3.googleusercontent.com"       // Google OAuth avatars
    ],
    connectSrc: [
      "'self'",
      frontendOrigin,
      backendUrl,
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "ws://localhost:3000",      // WebSocket for Vite HMR
      "wss://localhost:3000",
      "https://api.github.com",     // GitHub OAuth API
      "https://www.googleapis.com", // Google OAuth API
      "https://accounts.google.com" // Google OAuth auth
    ],
    fontSrc: [
      "'self'",
      "https://fonts.gstatic.com",
      "data:"
    ],
    frameSrc: ["'self'", "blob:"],  // Allow same-origin and blob iframes (PDF previews)
    frameAncestors: [               // Allow frontend origins to embed backend content
      "'self'",
      frontendOrigin,
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:4200",
    ],
    objectSrc: ["'none'"],       // Block Flash/Java applets
    baseUri: ["'self'"],         // Prevent base tag injection
    formAction: ["'self'"],       // Forms only submit to self
    mediaSrc: ["'self'"],
    manifestSrc: ["'self'"],
    workerSrc: ["'self'", "blob:"], // blob: needed for some web workers
    upgradeInsecureRequests: isProduction ? [] : null // Force HTTPS in prod
  },
  reportOnly: false // Enforce CSP in all environments
};

// Additional development-only CSP adjustments already handled in directives above
// No additional modifications needed - connectSrc already includes ws://localhost:3000

const helmetConfig = helmet({
  // Content Security Policy - primary XSS/Injection defense
  contentSecurityPolicy: contentSecurityPolicy,

  // Frameguard - prevents clickjacking (redundant with CSP frame-ancestors but defense in depth)
  frameguard: { action: 'deny' },

  // HSTS - forces HTTPS connections in production
  // maxAge: 1 year in seconds, includeSubDomains for all subdomains, preload for HSTS preload list
  hsts: isProduction ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false,

  // noSniff - prevents MIME type sniffing attacks
  // Stops browser from interpreting files as different content-type than declared
  noSniff: true,

  // Referrer Policy - controls referrer header in cross-origin requests
  // strict-origin-when-cross-origin: full URL for same-origin, only origin for cross-origin
  referrerPolicy: {
    policy: ['strict-origin-when-cross-origin']
  },

  // Cross-origin embedding policy - disabled for OAuth compatibility
  // COEP requires CORP headers that break OAuth redirects
  crossOriginEmbedderPolicy: false,

  // Cross-origin resource policy - allows cross-origin loading (needed for OAuth)
  crossOriginResourcePolicy: {
    policy: "cross-origin"
  },

  // DNS prefetch control - prevents DNS prefetching (privacy/security)
  dnsPrefetchControl: { allow: false },

  // Hide X-Powered-By - removes Express server identification
  hidePoweredBy: true,

  // IE No Open - prevents IE from executing downloaded files
  ieNoOpen: true,

  // Origin Agent Cluster - enables origin-keyed agent clusters
  originAgentCluster: true,

  // XSS Filter - legacy IE XSS filter (defense in depth)
  xssFilter: true
});

export default helmetConfig;
