import { chromium } from 'playwright';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function testGoogleMaps() {
  console.log('\n========================================');
  console.log('TEST 1: Google Maps');
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
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  await page.route('**/*', async (route) => {
    const type = route.request().resourceType();
    if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
      await route.abort();
    } else {
      await route.continue();
    }
  });

  const searchUrl = 'https://www.google.com/maps/search/restaurant+in+Surat,+Adajan';
  console.log(`Navigating: ${searchUrl}`);

  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(randomDelay(3000, 4000));

  // Scroll and collect
  const allNames = new Set();
  const leads = [];
  let stalled = 0;

  while (stalled < 25) {
    const cards = await page.evaluate(() => {
      const results = [];
      const elements = document.querySelectorAll('div.Nv2PK');
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
      stalled++;
    } else {
      stalled = 0;
      leads.push(...newCards);
      console.log(`  ${newCards.length} new (total: ${leads.length})`);
    }

    await page.evaluate(() => {
      const feed = document.querySelector('[role="feed"]');
      if (feed) feed.scrollTop = feed.scrollHeight;
      else window.scrollBy(0, 600);
    });
    await sleep(randomDelay(1200, 1800));
  }

  console.log(`\n  TOTAL: ${leads.length} businesses`);
  leads.slice(0, 5).forEach((l, i) => {
    console.log(`  ${i+1}. ${l.name} (${l.rating || '?'}★, ${l.reviews || 0} reviews)`);
  });

  await browser.close();
  return leads;
}

async function testJustDial() {
  console.log('\n========================================');
  console.log('TEST 2: JustDial');
  console.log('========================================\n');

  // Launch with HTTP1.1 to avoid HTTP2 errors
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--window-size=1920,1080',
      '--disable-http2',  // Force HTTP/1.1
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: USER_AGENTS[0],
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    extraHTTPHeaders: {
      'Accept-Language': 'en-GB,en;q=0.9,hi;q=0.8',
    },
  });

  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  // Try different URL formats
  const urls = [
    'https://www.justdial.com/Surat/Restaurants-in-Adajan',
    'https://www.justdial.com/Surat/Restaurants',
    'https://www.justdial.com/Surat/restaurants',
  ];

  let leads = [];
  
  for (const searchUrl of urls) {
    console.log(`Trying URL: ${searchUrl}`);
    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log('  Page loaded');
      await sleep(randomDelay(3000, 4000));

      // Wait for real content
      await page.waitForSelector('body', { timeout: 10000 });
      const bodyText = await page.evaluate(() => document.body?.textContent?.substring(0, 500) || '');
      console.log(`  Page title: ${await page.title()}`);
      
      if (bodyText.includes('captcha') || bodyText.includes('verify') || bodyText.includes('robot')) {
        console.log('  BLOCKED - captcha/verification page');
        continue;
      }

      // Check for actual business cards
      const hasContent = await page.evaluate(() => {
        const selectors = ['li[data-result-index]', '.jca-widget', '.cntanr', '.bshapp', '.store-block', '.card-list li'];
        for (const sel of selectors) {
          if (document.querySelectorAll(sel).length > 0) return true;
        }
        return document.querySelectorAll('a[href*="justdial.com"]').length > 3;
      });

      if (!hasContent) {
        console.log('  No business cards found on this URL');
        continue;
      }

      console.log('  Business cards found! Extracting...');
      
      const seenNames = new Set();
      let stalled = 0;

      while (stalled < 10) {
        const businesses = await page.evaluate(() => {
          const results = [];
          const selectors = ['li[data-result-index]', '.jca-widget', '.cntanr', '.bshapp', '.store-block', '.card-list li', '.list_part', '.jbho'];
          let cards = [];
          for (const sel of selectors) {
            const found = document.querySelectorAll(sel);
            if (found.length > 0) { cards = Array.from(found); break; }
          }
          if (cards.length === 0) {
            const links = document.querySelectorAll('a[href*="justdial.com"][class*="name"], h2, h3, .lng_cont_name');
            const parents = new Set();
            links.forEach(el => { const p = el.closest('div,li,section'); if (p) parents.add(p); });
            cards = Array.from(parents);
          }

          for (const card of cards) {
            const nameEl = card.querySelector('h2, h3, .lng_cont_name, .jcn, [class*="name"], .store-name');
            const name = nameEl?.textContent?.trim() || '';
            if (!name || name.length < 2) continue;

            const phoneEl = card.querySelector('a[href^="tel:"], .contact-info, [class*="phone"]');
            let phone = phoneEl?.getAttribute('href')?.replace('tel:', '') || phoneEl?.textContent?.trim() || '';
            if (!phone) {
              const pm = (card.textContent || '').match(/(\+?91[\s-]?)?[6-9]\d{9}/);
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
          const k = `${b.name}|${b.phone || b.address}`;
          if (seenNames.has(k)) return false;
          seenNames.add(k);
          return true;
        });

        if (newBiz.length > 0) {
          stalled = 0;
          leads.push(...newBiz);
          console.log(`  ${newBiz.length} new (total: ${leads.length})`);
        } else {
          stalled++;
        }

        await page.evaluate(() => {
          const sels = ['.result-list', '.search-result', '.card-list', 'main', '.list_part'];
          for (const sel of sels) {
            const el = document.querySelector(sel);
            if (el) { el.scrollTop = el.scrollHeight; return; }
          }
          window.scrollBy(0, 800);
        });
        await sleep(2000);
      }

      if (leads.length > 0) break;
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }

  console.log(`\n  TOTAL: ${leads.length} businesses`);
  leads.slice(0, 5).forEach((l, i) => {
    console.log(`  ${i+1}. ${l.name} | phone=${l.phone||'-'} | rating=${l.rating||'?'}`);
  });

  await browser.close();
  return leads;
}

async function testIndiaMart() {
  console.log('\n========================================');
  console.log('TEST 3: IndiaMart');
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
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  // Try a more IndiaMart-appropriate search
  const searchUrl = 'https://dir.indiamart.com/search.mp?ss=restaurant+furniture+surat';
  console.log(`Navigating: ${searchUrl}`);

  try {
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);
    console.log(`Page title: ${await page.title()}`);

    const leads = [];
    const seenNames = new Set();
    let stalled = 0;

    while (stalled < 10) {
      const suppliers = await page.evaluate(() => {
        const results = [];
        const selectors = ['.srch_product_box', '.product-box', '.seller-card', '.seller_listing', '.card', '.rht', '.list-item'];
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

          const phoneEl = card.querySelector('a[href^="tel:"], .contact_num, .phone, .call-now, [class*="mob"]');
          let phone = phoneEl?.getAttribute('href')?.replace('tel:', '') || phoneEl?.textContent?.trim() || '';
          if (!phone) {
            const pm = (card.textContent || '').match(/(\+?91[\s-]?)?[6-9]\d{9}/);
            if (pm) phone = pm[0].replace(/[\s-]/g, '');
          }

          const addressEl = card.querySelector('.addr_text, .address, [class*="address"], .location');
          const address = addressEl?.textContent?.trim() || '';

          const descEl = card.querySelector('.product_desc, .seller_desc, .description');
          const products = descEl?.textContent?.trim() || '';

          results.push({ name, phone, address, products });
        }
        return results;
      });

      const newSupp = suppliers.filter(s => {
        const k = `${s.name}|${s.phone || s.address}`;
        if (seenNames.has(k)) return false;
        seenNames.add(k);
        return true;
      });

      if (newSupp.length > 0) {
        stalled = 0;
        leads.push(...newSupp);
        console.log(`  ${newSupp.length} new (total: ${leads.length})`);
      } else {
        stalled++;
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

    console.log(`\n  TOTAL: ${leads.length} suppliers`);
    leads.slice(0, 5).forEach((l, i) => {
      console.log(`  ${i+1}. ${l.name} | phone=${l.phone||'-'} | addr=${l.address||'-'}`);
    });
  } catch (err) {
    console.error(`  Error: ${err.message}`);
  }

  await browser.close();
  return leads;
}

async function main() {
  console.log('=== LEAD FINDER SCRAPER TEST v2 ===\n');

  const t1 = Date.now();
  const gm = await testGoogleMaps();
  const jd = await testJustDial();
  const im = await testIndiaMart();
  const dur = ((Date.now() - t1) / 1000).toFixed(0);

  console.log('\n========================================');
  console.log('FINAL RESULTS');
  console.log(`Google Maps:  ${gm.length} businesses`);
  console.log(`JustDial:     ${jd.length} businesses`);
  console.log(`IndiaMart:    ${im.length} suppliers`);
  console.log(`TOTAL:        ${gm.length + jd.length + im.length} leads`);
  console.log(`Duration:     ${dur}s`);
  console.log('========================================');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
