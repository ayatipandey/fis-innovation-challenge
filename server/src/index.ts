import { createApp } from './app.js';
import { config } from './config.js';
import { sharedDb } from './db.js';

const app = createApp(() => sharedDb(config.databaseUrl, config.databaseToken));

app.listen(config.port, () => {
  console.log(`Perkly API on http://localhost:${config.port} (AI service: ${config.recommenderUrl})`);
});
