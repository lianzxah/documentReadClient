// Pin puppeteer's browser cache inside the workspace so installs and
// runtime lookups work in sandboxed environments where /root/.cache is not
// writable. Keep this file in sync with the PUPPETEER_CACHE_DIR used at
// install time.
const { join } = require('node:path');

/** @type {import('puppeteer').Configuration} */
module.exports = {
  cacheDirectory: join(__dirname, '.puppeteer-cache'),
};
