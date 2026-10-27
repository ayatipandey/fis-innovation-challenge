// Vercel Function: the whole Express API. Static files come from web/dist.
import { createApp } from '../server/src/app.js';
import { config } from '../server/src/config.js';
import { sharedDb } from '../server/src/db.js';

const app = createApp(() => sharedDb(config.databaseUrl, config.databaseToken));

export default app;
