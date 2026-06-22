import { chromium } from 'playwright';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const STEALTH_ARGS = [
  '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
  '--disable-gpu', '--disable-extensions',
  '--window-size=1920,1080',
  '--disable-blink-features=AutomationControlled',
];

const STEALTH_INIT = () => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  window.chrome = { runtime: {} };
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-IN', 'en-US', 'en'] });
  const orig = navigator.permissions.query;
  navigator.permissions.query = p => ['clipboard-read', 'clipboard-write'].includes(p.name)
    ? Promise.resolve({ state: 'denied', onchange: null })
    : orig.call(navigator.permissions, p);
};

async function testGoogleMaps() {
  console.log('\n=== Google Maps ===\n');
  const browser = await chromium.launch({ headless: true, args: STEALTH_ARGS });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US', timezoneId: 'Asia/Kolkata',
  });
  await ctx.addInitScript(STEALTH_INIT);
  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);

  await page.route('**/*', r => ['image','media','font','stylesheet'].includes(r.request().resourceType()) ? r.abort() : r.continue());

  const url = 'https://www.google.com/maps/search/restaurant+in+Surat,+Adajan';
  console.log(`Navigating: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(rnd(3000, 5000));

  const names = new Set();
  const leads = [];
  let stall = 0;

  while (stall < 25) {
    const cards = await page.evaluate(() => {
      const r = [];
      for (const card of document.querySelectorAll('div.Nv2PK')) {
        const name = card.querySelector('div.qBF1Pd.fontHeadlineSmall')?.textContent?.trim();
        if (!name) continue;
        const ratingEl = card.querySelector('span[role="img"][aria-label*="stars"]');
        let rating = 0, reviews = 0;
        if (ratingEl) {
          const l = ratingEl.getAttribute('aria-label') || '';
          const m = l.match(/(\d+\.?\d*)/); if (m) rating = parseFloat(m[1]);
          const rm = l.match(/([\d,]+)\s*reviews?/i); if (rm) reviews = parseInt(rm[1].replace(/,/g,''), 10);
        }
        const href = card.querySelector('a.hfpxzc')?.getAttribute('href') || '';
        const pid = href.match(/maps\/place\/([^/]+)/);
        r.push({ name, rating, reviews, placeId: pid ? decodeURIComponent(pid[1]) : '' });
      }
      return r;
    });

    const n = cards.filter(c => { const k = `${c.name}|${c.rating}`; if (names.has(k)) return false; names.add(k); return true; });
    if (n.length === 0) { stall++; } else { stall = 0; leads.push(...n); console.log(`  ${n.length} new (total: ${leads.length})`); }

    await page.evaluate(() => { const f = document.querySelector('[role="feed"]'); if (f) f.scrollTop = f.scrollHeight; else window.scrollBy(0, 600); });
    await sleep(rnd(1200, 2000));
  }

  console.log(`\n  TOTAL: ${leads.length}`);
  leads.slice(0, 5).forEach((l, i) => console.log(`  ${i+1}. ${l.name} (${l.rating}★, ${l.reviews} reviews)`));

  await browser.close();
  return leads;
}

async function testJustDial() {
  console.log('\n=== JustDial ===\n');
  const browser = await chromium.launch({
    headless: true,
    args: [...STEALTH_ARGS, '--disable-http2'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-IN', timezoneId: 'Asia/Kolkata',
    extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9,hi;q=0.8' },
  });
  await ctx.addInitScript(STEALTH_INIT);
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);

  const urls = [
    'https://www.justdial.com/Surat/Restaurants',
  ];

  let leads = [];
  for (const url of urls) {
    console.log(`URL: ${url}`);
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      console.log(`  HTTP ${resp?.status()}`);
      await sleep(rnd(4000, 6000));

      const text = await page.evaluate(() => document.body?.innerText?.substring(0, 1000) || '');
      console.log(`  Title: ${await page.title()}`);
      console.log(`  Text preview: ${text.substring(0, 200)}`);

      if (/captcha|verify|robot|enable javascript/i.test(text)) {
        console.log('  BLOCKED');
        continue;
      }

      const names = new Set();
      let stall = 0;
      while (stall < 15) {
        const biz = await page.evaluate(() => {
          const r = [];
          const raw = document.querySelectorAll('li[data-result-index], .jca-widget, .cntanr, .bshapp, .store-block, .list_part, .jbho');
          const cards = raw.length ? Array.from(raw) : Array.from(document.querySelectorAll('div,li,section')).filter(el => el.querySelector('a[href*="justdial"]'));
          for (const c of cards) {
            const name = c.querySelector('h2, h3, .lng_cont_name, .jcn, [class*="name"]')?.textContent?.trim() || c.getAttribute('data-store') || '';
            if (!name || name.length < 2) continue;
            let phone = c.querySelector('a[href^="tel:"]')?.getAttribute('href')?.replace('tel:','') || '';
            if (!phone) { const pm = (c.textContent||'').match(/(\+?91[\s-]?)?[6-9]\d{9}/); if (pm) phone = pm[0].replace(/[\s-]/g,''); }
            const addr = c.querySelector('.cont_sw_addr, .address, [class*="address"]')?.textContent?.trim() || '';
            const ratEl = c.querySelector('[class*="rating"], .green-box, .star');
            let rating = 0;
            if (ratEl) { const rm = (ratEl.textContent||'').match(/(\d+\.?\d*)/); if (rm) rating = parseFloat(rm[1]); }
            r.push({ name, phone, address: addr, rating });
          }
          return r;
        });
        const n = biz.filter(b => { const k = `${b.name}|${b.phone||b.address}`; if (names.has(k)) return false; names.add(k); return true; });
        if (n.length > 0) { stall = 0; leads.push(...n); console.log(`  ${n.length} new (total: ${leads.length})`); }
        else { stall++; }
        await page.evaluate(() => { const s = document.querySelector('.result-list,.search-result,.card-list,main'); if (s) s.scrollTop = s.scrollHeight; else window.scrollBy(0,800); });
        await sleep(2500);
      }
      if (leads.length > 0) break;
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }

  console.log(`\n  TOTAL: ${leads.length}`);
  leads.slice(0, 5).forEach((l, i) => console.log(`  ${i+1}. ${l.name} | phone=${l.phone||'-'}`));

  await browser.close();
  return leads;
}

async function testIndiaMart() {
  console.log('\n=== IndiaMart ===\n');
  const browser = await chromium.launch({ headless: true, args: STEALTH_ARGS });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-IN', timezoneId: 'Asia/Kolkata',
  });
  await ctx.addInitScript(STEALTH_INIT);
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  // Try IndiaMart search directly - use their actual search endpoint
  const url = 'https://dir.indiamart.com/search.mp?ss=restaurant';
  console.log(`URL: ${url}`);
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`  HTTP ${resp?.status()}`);
    await sleep(3000);

    const title = await page.title();
    console.log(`  Title: ${title}`);
    const text = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
    console.log(`  Text: ${text.substring(0, 200)}`);

    const leads = [];
    const names = new Set();
    let stall = 0;

    while (stall < 10) {
      const sellers = await page.evaluate(() => {
        const r = [];
        const cards = document.querySelectorAll('.srch_product_box, .seller-box, .seller-card, .lstng, .card-list li, [class*="seller"], .product-items');
        const items = cards.length ? Array.from(cards) : Array.from(document.querySelectorAll('div,li')).filter(el => {
          const t = el.textContent||'';
          return (t.includes('Call Now') || t.includes('Send Enquiry')) && el.querySelector('a[href*="indiamart"]');
        });
        for (const c of items) {
          const name = c.querySelector('h2, h3, [class*="name"], .seller_name, .product_name')?.textContent?.trim() || '';
          if (!name || name.length < 2) continue;
          let phone = c.querySelector('a[href^="tel:"]')?.getAttribute('href')?.replace('tel:','') || '';
          if (!phone) { const pm = (c.textContent||'').match(/(\+?91[\s-]?)?[6-9]\d{9}/); if (pm) phone = pm[0]; }
          const addr = c.querySelector('[class*="loc"], [class*="addr"], [class*="address"]')?.textContent?.trim() || '';
          const prod = c.querySelector('[class*="desc"], [class*="product"]')?.textContent?.trim() || '';
          r.push({ name, phone, address: addr, products: prod });
        }
        return r;
      });

      const n = sellers.filter(s => { const k = `${s.name}|${s.phone||s.address}`; if (names.has(k)) return false; names.add(k); return true; });
      if (n.length > 0) { stall = 0; leads.push(...n); console.log(`  ${n.length} new (total: ${leads.length})`); }
      else { stall++; }

      await page.evaluate(() => { const s = document.querySelector('.list, .result, .product, main'); if (s) s.scrollTop = s.scrollHeight; else window.scrollBy(0,800); });
      await sleep(2000);
    }

    console.log(`\n  TOTAL: ${leads.length}`);
    leads.slice(0, 5).forEach((l, i) => console.log(`  ${i+1}. ${l.name} | phone=${l.phone||'-'} | ${l.products||'-'}`));

    await browser.close();
    return leads;
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    await browser.close();
    return [];
  }
}

async function main() {
  console.log('=== SCRAPER TEST v3 ===\n');
  const t1 = Date.now();
  const gm = await testGoogleMaps();
  const jd = await testJustDial();
  const im = await testIndiaMart();
  const dur = Math.round((Date.now() - t1) / 1000);

  console.log('\n========================================');
  console.log('FINAL RESULTS');
  console.log(`Google Maps:  ${gm.length}`);
  console.log(`JustDial:     ${jd.length}`);
  console.log(`IndiaMart:    ${im.length}`);
  console.log(`TOTAL:        ${gm.length + jd.length + im.length}`);
  console.log(`Time:         ${dur}s`);
  console.log('========================================');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
