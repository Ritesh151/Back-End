import { chromium } from 'playwright';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function testGoogleMaps() {
  console.log('\n========================================');
  console.log('TEST: Google Maps - restaurant in Surat');
  console.log('========================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--disable-extensions', '--window-size=1920,1080',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: USER_AGENTS[0],
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata',
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    (window).chrome = { runtime: {} };
  });

  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  // Block images, fonts, etc.
  await page.route('**/*', async (route) => {
    const type = route.request().resourceType();
    if (['image', 'media', 'font', 'stylesheet', 'imageset'].includes(type)) {
      await route.abort();
    } else {
      await route.continue();
    }
  });

  const searchUrl = 'https://www.google.com/maps/search/restaurant+in+Surat,+Adajan';
  console.log(`Navigating to: ${searchUrl}`);
  
  try {
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    console.log('Page loaded');
    await sleep(randomDelay(3000, 5000));

    // Wait for feed
    let feedFound = false;
    for (let i = 0; i < 15; i++) {
      const hasFeed = await page.$('[role="feed"]').catch(() => null);
      if (hasFeed) {
        feedFound = true;
        console.log(`Feed found after ${i + 1}s`);
        break;
      }
      const cards = await page.$$('div.Nv2PK').catch(() => []);
      if (cards.length > 0) {
        feedFound = true;
        console.log(`Cards found: ${cards.length}`);
        break;
      }
      await sleep(1000);
    }

    if (!feedFound) {
      console.log('No feed found, trying search input...');
      const input = await page.$('input#searchboxinput');
      if (input) {
        await input.click();
        await input.fill('');
        await sleep(300);
        await page.keyboard.type('restaurant in Surat, Adajan', { delay: 50 });
        await page.keyboard.press('Enter');
        await sleep(5000);
      }
    }

    // Scroll and collect cards
    const allNames = new Set();
    const leads = [];
    let stalledCount = 0;
    const MAX_STALLED = 20;

    while (stalledCount < MAX_STALLED) {
      // Extract visible cards
      const cards = await page.evaluate(() => {
        const results = [];
        const cardSelectors = ['div.Nv2PK', 'div[role="article"]', 'a[href*="maps/place/"]'];
        let elements = [];
        for (const sel of cardSelectors) {
          const found = document.querySelectorAll(sel);
          if (found.length > 0) { elements = Array.from(found); break; }
        }

        for (const card of elements) {
          const nameEl = card.querySelector('div.qBF1Pd.fontHeadlineSmall, .fontHeadlineSmall');
          const name = nameEl?.textContent?.trim() || '';
          if (!name) continue;

          const ratingEl = card.querySelector('span[role="img"][aria-label*="stars"]');
          let rating = 0, reviews = 0;
          if (ratingEl) {
            const label = ratingEl.getAttribute('aria-label') || '';
            const m = label.match(/(\d+\.?\d*)/);
            if (m) rating = parseFloat(m[1]);
            const rm = label.match(/([\d,]+)\s*reviews?/i);
            if (rm) reviews = parseInt(rm[1].replace(/,/g, ''), 10);
          }

          const link = card.querySelector('a.hfpxzc');
          const href = link?.getAttribute('href') || '';
          const placeIdMatch = href.match(/maps\/place\/([^/]+)/);

          results.push({
            name, rating, reviews, href,
            placeId: placeIdMatch ? decodeURIComponent(placeIdMatch[1]) : '',
          });
        }
        return results;
      });

      const newCards = cards.filter(c => {
        const key = `${c.name}|${c.rating}`;
        if (allNames.has(key)) return false;
        allNames.add(key);
        return true;
      });

      if (newCards.length === 0) {
        stalledCount++;
        // Scroll
        await page.evaluate(() => {
          const feed = document.querySelector('[role="feed"]');
          if (feed) feed.scrollTop = feed.scrollHeight;
          else window.scrollBy(0, 600);
        });
        await sleep(1500);
        continue;
      }

      stalledCount = 0;
      console.log(`Found ${newCards.length} new cards (total unique: ${allNames.size})`);

      for (const card of newCards) {
        leads.push(card);
      }

      // Scroll for more
      await page.evaluate(() => {
        const feed = document.querySelector('[role="feed"]');
        if (feed) feed.scrollTop = feed.scrollHeight;
        else window.scrollBy(0, 600);
      });
      await sleep(1500);
    }

    console.log(`\nTotal unique businesses found: ${allNames.size}`);
    console.log(`\n--- Sample Leads (${Math.min(5, leads.length)} of ${leads.length}) ---`);
    leads.slice(0, 5).forEach((l, i) => {
      console.log(`\n${i + 1}. ${l.name}`);
      console.log(`   Rating: ${l.rating || 'N/A'} (${l.reviews || 0} reviews)`);
      console.log(`   Place ID: ${l.placeId || 'N/A'}`);
    });

    return leads;

  } catch (err) {
    console.error('Error:', err.message);
    return [];
  } finally {
    await browser.close();
    console.log('\nBrowser closed');
  }
}

async function testJustDial() {
  console.log('\n========================================');
  console.log('TEST: JustDial - restaurant in Surat');
  console.log('========================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--window-size=1920,1080',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: USER_AGENTS[0],
    locale: 'en-US',
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  const searchUrl = 'https://www.justdial.com/surat/restaurants-in-adajan';
  console.log(`Navigating to: ${searchUrl}`);

  try {
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);
    console.log('Page loaded');

    const leads = [];
    const seenNames = new Set();
    let stalled = 0;
    const scrollSelectors = ['.result-list', '.search-result', '.card-list', 'main', '.list_part', '.jbd'];

    while (stalled < 10) {
      const businesses = await page.evaluate(() => {
        const results = [];
        const selectors = [
          'li[data-result-index]', '.jca-widget', '.cntanr', '.bshapp',
          '.store-block', '.card-list li', '.list_part', '.jbho', '.jglink',
        ];
        let cards = [];
        for (const sel of selectors) {
          const found = document.querySelectorAll(sel);
          if (found.length > 0) { cards = Array.from(found); break; }
        }
        if (cards.length === 0) {
          const links = document.querySelectorAll('a[href*="justdial.com"][class*="name"], h2, h3, .lng_cont_name, .jcn');
          const parents = new Set();
          links.forEach(el => { const p = el.closest('div,li,section'); if (p) parents.add(p); });
          cards = Array.from(parents);
        }

        for (const card of cards) {
          const nameEl = card.querySelector('h2, h3, .lng_cont_name, .jcn, [class*="name"], .store-name, a[href*="justdial.com"]');
          const name = nameEl?.textContent?.trim() || '';
          if (!name || name.length < 2) continue;

          const phoneEl = card.querySelector('a[href^="tel:"]');
          let phone = phoneEl?.getAttribute('href')?.replace('tel:', '') || '';
          if (!phone) {
            const text = card.textContent || '';
            const pm = text.match(/(\+?91[\s-]?)?[6-9]\d{9}/);
            if (pm) phone = pm[0].replace(/[\s-]/g, '');
          }

          const addressEl = card.querySelector('.cont_sw_addr, .address, [class*="address"]');
          const address = addressEl?.textContent?.trim() || '';

          const ratingEl = card.querySelector('.green-box, [class*="rating"]');
          let rating = 0;
          if (ratingEl) {
            const rm = (ratingEl.textContent || '').match(/(\d+\.?\d*)/);
            if (rm) rating = parseFloat(rm[1]);
          }

          results.push({ name, phone, address, rating });
        }
        return results;
      });

      const newBiz = businesses.filter(b => {
        const key = `${b.name}|${b.phone || b.address}`;
        if (seenNames.has(key)) return false;
        seenNames.add(key);
        return true;
      });

      if (newBiz.length === 0) {
        stalled++;
      } else {
        stalled = 0;
        leads.push(...newBiz);
        console.log(`Found ${newBiz.length} new businesses (total: ${leads.length})`);
      }

      // Scroll
      await page.evaluate((sels) => {
        for (const sel of sels) {
          const el = document.querySelector(sel);
          if (el) { el.scrollTop = el.scrollHeight; return; }
        }
        window.scrollBy(0, 800);
      }, scrollSelectors);
      await sleep(2000);
    }

    console.log(`\nTotal JustDial businesses: ${leads.length}`);
    if (leads.length > 0) {
      console.log('\n--- Sample Leads ---');
      leads.slice(0, 5).forEach((l, i) => {
        console.log(`\n${i + 1}. ${l.name}`);
        console.log(`   Phone: ${l.phone || 'N/A'}`);
        console.log(`   Address: ${l.address || 'N/A'}`);
        console.log(`   Rating: ${l.rating || 'N/A'}`);
      });
    }
    return leads;
  } catch (err) {
    console.error('Error:', err.message);
    return [];
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
}

async function testIndiaMart() {
  console.log('\n========================================');
  console.log('TEST: IndiaMart - restaurants in Surat');
  console.log('========================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--window-size=1920,1080',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: USER_AGENTS[0],
    locale: 'en-US',
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  const searchUrl = 'https://dir.indiamart.com/search.mp?ss=restaurant+surat';
  console.log(`Navigating to: ${searchUrl}`);

  try {
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);
    console.log('Page loaded');

    const leads = [];
    const seenNames = new Set();
    let stalled = 0;

    while (stalled < 10) {
      const suppliers = await page.evaluate(() => {
        const results = [];
        const selectors = [
          '.srch_product_box', '.product-box', '.seller-card', '.seller_listing',
          '.card', '.search-result-item', 'li[class*="product"]', 'div[class*="seller"]',
          '.rht', '.list-item',
        ];
        let cards = [];
        for (const sel of selectors) {
          const found = document.querySelectorAll(sel);
          if (found.length > 0) { cards = Array.from(found); break; }
        }
        if (cards.length === 0) {
          const links = document.querySelectorAll('.seller_name, h2, h3, [class*="name"]');
          const parents = new Set();
          links.forEach(el => { const p = el.closest('div,li,section'); if (p) parents.add(p); });
          cards = Array.from(parents);
        }

        for (const card of cards) {
          const nameEl = card.querySelector('.seller_name, .name, [class*="name"], .product_name, h2, h3');
          const name = nameEl?.textContent?.trim() || '';
          if (!name || name.length < 2) continue;

          const phoneEl = card.querySelector('a[href^="tel:"], .contact_num, .phone, .call-now');
          let phone = phoneEl?.getAttribute('href')?.replace('tel:', '') || phoneEl?.textContent?.trim() || '';
          if (!phone) {
            const text = card.textContent || '';
            const pm = text.match(/(\+?91[\s-]?)?[6-9]\d{9}/);
            if (pm) phone = pm[0].replace(/[\s-]/g, '');
          }

          const addressEl = card.querySelector('.addr_text, .address, [class*="address"], .location');
          const address = addressEl?.textContent?.trim() || '';

          results.push({ name, phone, address });
        }
        return results;
      });

      const newSuppliers = suppliers.filter(s => {
        const key = `${s.name}|${s.phone || s.address}`;
        if (seenNames.has(key)) return false;
        seenNames.add(key);
        return true;
      });

      if (newSuppliers.length === 0) {
        stalled++;
      } else {
        stalled = 0;
        leads.push(...newSuppliers);
        console.log(`Found ${newSuppliers.length} new suppliers (total: ${leads.length})`);
      }

      await page.evaluate(() => {
        const sels = ['.product-listing', '.search-result', '.listing', 'main', '.list-view'];
        for (const sel of sels) {
          const el = document.querySelector(sel);
          if (el) { el.scrollTop = el.scrollHeight; return; }
        }
        window.scrollBy(0, 800);
      });
      await sleep(2000);
    }

    console.log(`\nTotal IndiaMart suppliers: ${leads.length}`);
    if (leads.length > 0) {
      console.log('\n--- Sample Leads ---');
      leads.slice(0, 5).forEach((l, i) => {
        console.log(`\n${i + 1}. ${l.name}`);
        console.log(`   Phone: ${l.phone || 'N/A'}`);
        console.log(`   Address: ${l.address || 'N/A'}`);
      });
    }
    return leads;
  } catch (err) {
    console.error('Error:', err.message);
    return [];
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
}

async function main() {
  console.log('=== LEAD FINDER SCRAPER TEST ===\n');
  console.log('Testing Google Maps, JustDial, and IndiaMart scrapers');
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Test 1: Google Maps
  const gmLeads = await testGoogleMaps();
  
  // Test 2: JustDial  
  const jdLeads = await testJustDial();

  // Test 3: IndiaMart
  const imLeads = await testIndiaMart();

  console.log('\n\n========================================');
  console.log('FINAL RESULTS');
  console.log('========================================');
  console.log(`Google Maps:  ${gmLeads.length} businesses found`);
  console.log(`JustDial:     ${jdLeads.length} businesses found`);
  console.log(`IndiaMart:    ${imLeads.length} suppliers found`);
  console.log(`TOTAL:        ${gmLeads.length + jdLeads.length + imLeads.length} leads`);
  console.log('========================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
