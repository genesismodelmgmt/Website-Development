import { createApp } from './app.js';
import { getDb } from './db.js';
import { env } from './env.js';

getDb(); // open and migrate before accepting traffic

createApp().listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.info(`Genesis client portal API listening on http://localhost:${env.port}`);
});
