import { firefox, chromium } from 'playwright';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function findJustDialSelectors() {
  console.log('\n=== JustDial - Find Selectors ===\n');
  const browser = await firefox.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    locale: 'en-IN', timezoneId: 'Asia/Kolkata',
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  const url = 'https://www.justdial.com/Surat/Restaurants';
  console.log(`Navigating: ${url}`);
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  console.log(`  HTTP ${resp?.status()}`);
  await sleep(2000);

  const title = await page.title();
  console.log(`  Title: ${title}`);

  // Get page structure - find all elements with classes and their counts
  const structure = await page.evaluate(() => {
    const counts = {};
    // Get all elements by tag name with significant classes
    document.querySelectorAll('[class]').forEach(el => {
      const cls = el.className.trim();
      if (!cls) return;
      const parts = cls.split(/\s+/);
      parts.forEach(c => {
        if (c && c.length > 2) {
          counts[c] = (counts[c] || 0) + 1;
        }
      });
    });

    // Most used classes
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 80);

    // Find all elements that look like business listings
    const bizCandidates = [];
    const seenTags = new Set();
    document.querySelectorAll('li, div, section, article').forEach(el => {
      const cls = el.className?.trim() || '';
      const tag = `${el.tagName}.${cls.split(/\s+/).join('.')}`;
      if (seenTags.has(tag)) return;
      seenTags.add(tag);

      const text = el.textContent?.trim() || '';
      // Must have enough content and a reasonable structure
      if (text.length > 50 && text.length < 2000) {
        const children = el.children.length;
        if (children >= 2) {
          bizCandidates.push({ tag: tag.substring(0, 100), text: text.substring(0, 120), children });
        }
      }
    });

    return {
      classCounts: sorted,
      bizCandidates: bizCandidates.slice(0, 30),
      pageHtml: document.body?.innerHTML?.substring(0, 3000) || '',
    };
  });

  console.log(`\n  Top CSS classes (by frequency):`);
  structure.classCounts.slice(0, 30).forEach(([cls, count]) => console.log(`    .${cls}: ${count}`));

  console.log(`\n  Business card candidates:`);
  structure.bizCandidates.forEach((c, i) => console.log(`    ${i+1}. <${c.tag}> (${c.children} children): ${c.text}`));

  // Try various known JD selectors
  const selectors = [
    'li[data-result-index]', '.jca-widget', '.cntanr', '.bshapp',
    '.store-block', '.list_part', '.jbho', '.result-list li',
    'div[class*="store"]', 'div[class*="result"]', 'div[class*="listing"]',
    'div[class*="card"]', 'div[class*="item"]', 'div.store',
    '.card-list li', '.listing-content', '.business-card',
    '[data-store]', 'div[data-storeid]', 'li[data-id]',
  ];

  console.log(`\n  Selector tests:`);
  for (const sel of selectors) {
    const count = await page.evaluate((s) => document.querySelectorAll(s).length, sel);
    if (count > 0) {
      console.log(`    "${sel}" → ${count} matches`);
    }
  }

  // Look for store names specifically
  const storeNames = await page.evaluate(() => {
    const results = [];
    const links = document.querySelectorAll('a[href*="justdial.com"][href*="Surat"]');
    links.forEach(a => {
      const text = a.textContent?.trim() || '';
      if (text.length > 2 && text.length < 100) {
        const href = a.href?.substring(0, 150) || '';
        const parent = a.parentElement?.className?.trim().substring(0, 80) || '';
        results.push({ text: text.substring(0, 80), href, parentClass: parent });
      }
    });
    return results.slice(0, 20);
  });

  console.log(`\n  Store links (${storeNames.length}):`);
  storeNames.slice(0, 10).forEach((s, i) => console.log(`    ${i+1}. "${s.text}" parent:${s.parentClass}`));

  await browser.close();
}

async function testIndiaMartMobile() {
  console.log('\n=== IndiaMart Mobile Viewport ===\n');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--window-size=412,915'] });
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36',
    locale: 'en-IN', timezoneId: 'Asia/Kolkata',
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  // Try IndiaMart mobile URL
  const url = 'https://m.indiamart.com/search/?ss=hotel+supplies+surat';
  console.log(`URL: ${url}`);
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    console.log(`  HTTP ${resp?.status()}`);
    await sleep(3000);
    console.log(`  Title: ${await page.title()}`);

    const content = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      const phones = (document.body?.innerHTML || '').match(/(\+?91[\s-]?)?[6-9]\d{9}/g) || [];
      return { textPreview: text.substring(0, 800), phones: phones.slice(0, 15) };
    });

    console.log(`  Text:\n${content.textPreview}`);
    console.log(`  Phones: ${content.phones.length > 0 ? content.phones.join(', ') : 'none'}`);

    // Try clicking "View Number" buttons
    const btns = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('a, button, span, div').forEach(el => {
        const txt = el.textContent?.trim()?.toLowerCase() || '';
        if (txt.includes('number') || txt.includes('show') || txt.includes('view') || txt.includes('phone') || txt.includes('call')) {
          results.push({ tag: el.tagName, text: txt.substring(0, 60), cls: (el.className || '').substring(0, 60) });
        }
      });
      return results.slice(0, 15);
    });
    console.log(`\n  Number/phone buttons: ${btns.length}`);
    btns.forEach((b, i) => console.log(`    ${i+1}. <${b.tag}> "${b.text}" (${b.cls})`));

  } catch (err) {
    console.log(`  Error: ${err.message}`);
  }

  await browser.close();
}

async function testIndiaMartCatSearch() {
  console.log('\n=== IndiaMart Category Search ===\n');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-IN', timezoneId: 'Asia/Kolkata',
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  // Try IndiaMart's actual category URL for hotel/restaurant supplies
  const urls = [
    'https://dir.indiamart.com/india/hotel-supplies.html',
    'https://dir.indiamart.com/india/restaurant-supplies.html',
    'https://dir.indiamart.com/search.mp?ss=restaurant+equipment+supplier',
    'https://dir.indiamart.com/search.mp?ss=hotel+kitchen+equipment',
  ];

  for (const url of urls) {
    console.log(`\n  URL: ${url}`);
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      console.log(`    HTTP ${resp?.status()}`);
      await sleep(2000);
      const title = await page.title();
      console.log(`    Title: ${title}`);

      const text = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
      const phones = await page.evaluate(() => (document.body?.innerHTML || '').match(/(\+?91[\s-]?)?[6-9]\d{9}/g) || []);
      console.log(`    Text: ${text.substring(0, 200)}`);
      if (phones.length > 0) console.log(`    Phones found: ${phones.slice(0, 5).join(', ')}`);

      // Check for seller elements
      const sellers = await page.evaluate(() => {
        const results = [];
        const cards = document.querySelectorAll('[class*="seller"], [class*="product"], [class*="listing"], .card, .rht');
        for (const c of cards) {
          const t = c.textContent?.trim() || '';
          if (t.length > 30 && t.length < 2000) {
            const cls = c.className?.substring(0, 80);
            results.push({ cls, text: t.substring(0, 150) });
          }
          if (results.length >= 10) break;
        }
        return results;
      });
      if (sellers.length > 0) {
        console.log(`    Sellers found: ${sellers.length}`);
        sellers.slice(0, 3).forEach((s, i) => console.log(`      ${i+1}. [${s.cls}] ${s.text}`));
      }
    } catch (err) {
      console.log(`    Error: ${err.message}`);
    }
  }

  await browser.close();
}

async function main() {
  await findJustDialSelectors();
  await testIndiaMartMobile();
  await testIndiaMartCatSearch();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
