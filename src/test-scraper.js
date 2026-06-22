require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

// Register ts-node for the actual imports
require('ts-node').register({
  project: path.join(__dirname, '../tsconfig.json'),
  transpileOnly: true,
});

async function main() {
  const { scraperEngine } = require('./core/scraper-engine/scraper-engine');
  const { browserManager } = require('./core/scraper-engine/browser-manager');

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('MongoDB connected');

  console.log('\n=== TEST 1: Google Maps Only ===');
  console.log('Searching: restaurant in Surat, Adajan');

  try {
    const startTime = Date.now();
    const result = await scraperEngine.scrapeMultiSource({
      keyword: 'restaurant',
      location: 'Adajan, Surat, Gujarat',
      sources: ['google-maps'],
      limit: 10,
      state: 'Gujarat',
      city: 'Surat',
      area: 'Adajan',
      businessType: 'restaurant',
    });
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\nResult (${duration}s):`);
    console.log(`  Success: ${result.success}`);
    console.log(`  Message: ${result.message}`);
    console.log(`  Total Extracted: ${result.totalExtracted}`);
    console.log(`  Total Stored: ${result.totalStored}`);
    console.log(`  Total Duplicates: ${result.totalDuplicates}`);
    console.log(`  Leads count: ${result.leads.length}`);
    
    if (result.leads.length > 0) {
      console.log('\n--- Leads ---');
      result.leads.slice(0, 5).forEach((lead, i) => {
        console.log(`\nLead ${i + 1} [${lead.source}]:`);
        console.log(`  Name: ${lead.companyName}`);
        console.log(`  Phone: ${lead.phone || 'N/A'}`);
        console.log(`  Website: ${lead.website || 'N/A'}`);
        console.log(`  Address: ${lead.address || 'N/A'}`);
        console.log(`  Category: ${lead.category || 'N/A'}`);
        console.log(`  Rating: ${lead.rating || 'N/A'}`);
      });
    } else {
      console.log('  NO LEADS FOUND');
      console.log(`  Source Results: ${JSON.stringify(result.sourceResults)}`);
    }
  } catch (error) {
    console.error('Test 1 ERROR:', error.message);
    console.error(error.stack);
  }

  console.log('\n=== TEST 2: All Sources ===');
  console.log('Searching: restaurant in Surat, Adajan');

  try {
    const startTime = Date.now();
    const result2 = await scraperEngine.scrapeMultiSource({
      keyword: 'restaurant',
      location: 'Adajan, Surat, Gujarat',
      sources: ['google-maps', 'justdial', 'indiamart'],
      limit: 10,
      state: 'Gujarat',
      city: 'Surat',
      area: 'Adajan',
      businessType: 'restaurant',
    });
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\nMulti-source Result (${duration}s):`);
    console.log(`  Success: ${result2.success}`);
    console.log(`  Message: ${result2.message}`);
    console.log(`  Total Stored: ${result2.totalStored}`);
    console.log(`  Leads count: ${result2.leads.length}`);
    
    result2.sourceResults.forEach(sr => {
      console.log(`  ${sr.source}: stored=${sr.totalStored} extracted=${sr.totalExtracted} success=${sr.success}${sr.error ? ' error='+sr.error : ''}`);
    });

    if (result2.leads.length > 0) {
      console.log('\n--- Leads ---');
      result2.leads.forEach((lead, i) => {
        console.log(`\nLead ${i + 1} [${lead.source}]:`);
        console.log(`  Name: ${lead.companyName}`);
        console.log(`  Phone: ${lead.phone || 'N/A'}`);
        console.log(`  Website: ${lead.website || 'N/A'}`);
        console.log(`  Address: ${lead.address || 'N/A'}`);
      });
    }
  } catch (error) {
    console.error('Test 2 ERROR:', error.message);
    console.error(error.stack);
  }

  console.log('\n=== Browser Status ===');
  const status = browserManager.getStatus();
  console.log(`  Pool: ${status.poolSize}, Active: ${status.activeBrowsers}, Idle: ${status.idleBrowsers}`);
  console.log(`  Pages: ${status.totalPagesCreated} created, ${status.totalPagesClosed} closed`);
  console.log(`  Crashes: ${status.browserCrashes}, Memory: ${status.memoryUsageMB}MB`);

  console.log('\nDone. Cleaning up...');
  await browserManager.shutdown();
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
