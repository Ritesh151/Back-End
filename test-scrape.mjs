import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Register ts-node for TypeScript imports
require('ts-node').register({ transpileOnly: true });
require('dotenv').config();

const path = require('path');

async function main() {
  const mongoose = require('mongoose');
  const { scraperEngine } = require('./src/core/scraper-engine/scraper-engine');
  const { browserManager } = require('./src/core/scraper-engine/browser-manager');

  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lead-finder';
  
  await mongoose.connect(MONGODB_URI);
  console.log('MongoDB connected');

  // Test 1: Google Maps
  console.log('\n=== TEST 1: Google Maps ===');
  console.log('Search: restaurant in Surat, Adajan');
  
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
  console.log(`Duration: ${((Date.now()-t1)/1000).toFixed(1)}s`);
  console.log(`Success: ${r1.success}, Stored: ${r1.totalStored}, Leads: ${r1.leads.length}`);
  if (r1.leads.length > 0) {
    r1.leads.slice(0, 3).forEach((l, i) => {
      console.log(`  ${i+1}. ${l.companyName} | phone=${l.phone||'-'} | web=${l.website||'-'}`);
    });
  } else {
    console.log(`  SourceResults: ${JSON.stringify(r1.sourceResults)}`);
  }

  // Test 2: All sources
  console.log('\n=== TEST 2: All Sources ===');
  console.log('Search: restaurant in Surat, Adajan');
  
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
  console.log(`Duration: ${((Date.now()-t2)/1000).toFixed(1)}s`);
  console.log(`Success: ${r2.success}, Stored: ${r2.totalStored}, Leads: ${r2.leads.length}`);
  r2.sourceResults.forEach(sr => {
    console.log(`  ${sr.source}: stored=${sr.totalStored} extracted=${sr.totalExtracted} success=${sr.success}${sr.error ? ' err='+sr.error : ''}`);
  });
  if (r2.leads.length > 0) {
    r2.leads.slice(0, 5).forEach((l, i) => {
      console.log(`  ${i+1}. [${l.source}] ${l.companyName} | phone=${l.phone||'-'} | web=${l.website||'-'}`);
    });
  }

  // Browser stats
  console.log('\n=== Browser Status ===');
  const s = browserManager.getStatus();
  console.log(JSON.stringify(s));

  await browserManager.shutdown();
  await mongoose.disconnect();
  console.log('\nDone!');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
