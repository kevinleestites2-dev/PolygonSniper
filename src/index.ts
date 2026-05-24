import * as dotenv from 'dotenv';
dotenv.config();

import { logger } from './logger';
import { startSniper } from './sniper';

// Validate required env vars
const required = ['PRIVATE_KEY', 'RPC_WEBSOCKET_ENDPOINT'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  logger.error(`Missing required env vars: ${missing.join(', ')}`);
  logger.error('Copy .env.copy → .env and fill in your values.');
  process.exit(1);
}

startSniper().catch((err) => {
  logger.error(`Fatal error: ${err}`);
  process.exit(1);
});
