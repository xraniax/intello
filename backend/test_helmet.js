import helmet from 'helmet';

try {
  helmet({
    contentSecurityPolicy: {
      directives: {
        upgradeInsecureRequests: undefined
      }
    }
  });
  console.log("undefined works.");
} catch(e) {
  console.error("undefined failed:", e.message);
}
