import { createApp } from './app';
import { config } from './config';
import { openDb } from './db';
import { demoCatalog } from './services/catalog';

const db = openDb(config.databasePath);
const app = createApp(db, demoCatalog());

app.listen(config.port, () => {
  console.log(`Perkly API on http://localhost:${config.port} (recommender: ${config.recommenderUrl})`);
});
