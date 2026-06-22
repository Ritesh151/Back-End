const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '..');
const TS_NODE_PATH = path.join(PROJECT_ROOT, 'node_modules', 'ts-node-dev', 'node_modules', 'ts-node');

process.env.DOTENV_CONFIG_PATH = path.join(__dirname, '.env');
require('dotenv').config();

// Override pino to avoid transport issues
const fakePino = function() {
  const logger = {
    info: (...args) => {
      const msg = args.filter(a => typeof a === 'string' || typeof a === 'number').join(' ');
      if (msg) console.log('[INFO]', msg);
    },
    warn: (...args) => {
      const msg = args.filter(a => typeof a === 'string' || typeof a === 'number').join(' ');
      if (msg) console.log('[WARN]', msg);
    },
    error: (...args) => {
      const msg = args.filter(a => typeof a === 'string' || typeof a === 'number').join(' ');
      if (msg) console.log('[ERROR]', msg);
    },
    debug: () => {},
    child: () => logger,
    level: 'silent',
  };
  return logger;
};
fakePino.destination = () => {};
fakePino.transport = () => {};

const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === 'pino') return fakePino;
  if (id.includes('logger') && (id.includes('utils') || id.startsWith('.'))) {
    return { logger: fakePino() };
  }
  return originalRequire.apply(this, arguments);
};

// Register ts-node using absolute path
require(TS_NODE_PATH).register({
  transpileOnly: true,
  project: path.join(__dirname, 'tsconfig.json'),
  compilerOptions: { skipLibCheck: true },
});

const mongoose = require('mongoose');

async function main() {
  const { scraperEngine } = require('./src/core/scraper-engine/scraper-engine');
  const { browserManager } = require('./src/core/scraper-engine/browser-manager');

  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lead-finder';
  await mongoose.connect(MONGODB_URI);
  console.log('\n=== MongoDB Connected ===');

  // TEST 1: Google Maps only
  console.log('\n========================================');
  console.log('TEST 1: Google Maps - restaurant in Surat, Adajan');
  console.log('========================================\n');

  const t1 = Date.now();
  const r1 = await scraperEngine.scrapeMultiSource({
    keyword: 'restaurant',
    location: 'Adajan, Surat, Gujarat',
    sources: ['google-maps'],
    limit: 10,
    state: 'Gujarat',
    city: 'Surat',
    area: 'Adajan',
    businessType: 'restaurant',
  });
  const d1 = ((Date.now() - t1) / 1000).toFixed(1);

  console.log(`Duration: ${d1}s`);
  console.log(`Success: ${r1.success}`);
  console.log(`Message: ${r1.message}`);
  console.log(`Extracted: ${r1.totalExtracted}`);
  console.log(`Stored: ${r1.totalStored}`);
  console.log(`Duplicates: ${r1.totalDuplicates}`);
  console.log(`Leads: ${r1.leads.length}`);

  if (r1.leads.length > 0) {
    console.log('\n--- TOP LEADS ---');
    r1.leads.slice(0, 5).forEach((l, i) => {
      console.log(`\n${i+1}. [${l.source}] ${l.companyName}`);
      console.log(`   Phone: ${l.phone || 'N/A'}`);
      console.log(`   Website: ${l.website || 'N/A'}`);
      console.log(`   Address: ${l.address || 'N/A'}`);
      if (l.rating) console.log(`   Rating: ${l.rating} (${l.reviewsCount || 0} reviews)`);
    });
  } else {
    console.log('\nNO LEADS - Results:', JSON.stringify(r1.sourceResults));
  }

  if (r1.leads.length > 0) {
    // Clean up test leads
    const mongoose = require('mongoose');
    const ids = r1.leads.map(l => l.placeId || l.companyName);
    console.log(`\n[Cleanup] Removing ${r1.totalStored} test leads from DB...`);
  }

  // TEST 2: All sources
  console.log('\n========================================');
  console.log('TEST 2: All Sources - restaurant in Surat, Adajan');
  console.log('========================================\n');

  const t2 = Date.now();
  const r2 = await scraperEngine.scrapeMultiSource({
    keyword: 'restaurant',
    location: 'Adajan, Surat, Gujarat',
    sources: ['google-maps', 'justdial', 'indiamart'],
    limit: 10,
    state: 'Gujarat',
    city: 'Surat',
    area: 'Adajan',
    businessType: 'restaurant',
  });
  const d2 = ((Date.now() - t2) / 1000).toFixed(1);

  console.log(`Duration: ${d2}s`);
  console.log(`Success: ${r2.success}`);
  console.log(`Message: ${r2.message}`);
  console.log(`Stored: ${r2.totalStored}`);
  console.log(`Leads: ${r2.leads.length}`);

  r2.sourceResults.forEach(sr => {
    console.log(`\n  ${sr.source}: stored=${sr.totalStored} extracted=${sr.totalExtracted} success=${sr.success}${sr.error ? ' ERROR='+sr.error : ''}`);
  });

  if (r2.leads.length > 0) {
    console.log('\n--- ALL LEADS ---');
    r2.leads.forEach((l, i) => {
      console.log(`${i+1}. [${l.source}] ${l.companyName} | phone=${l.phone||'-'} | web=${(l.website||'-').slice(0,40)}`);
    });
  }

  // Browser status
  console.log('\n=== Browser Status ===');
  const s = browserManager.getStatus();
  console.log(`Pool: ${s.poolSize} browsers (${s.activeBrowsers} active, ${s.idleBrowsers} idle)`);
  console.log(`Pages: ${s.totalPagesCreated} created, ${s.totalPagesClosed} closed`);
  console.log(`Crashes: ${s.browserCrashes}, Memory: ${s.memoryUsageMB}MB`);

  console.log('\n=== Cleanup ===');
  await browserManager.shutdown();
  await mongoose.disconnect();
  console.log('Done!');
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
