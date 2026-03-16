import app from './app.js';
import validateEnv from './utils/validateEnv.js';
// Middlewares

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(` Cognify Backend running on port ${PORT}`);
});
