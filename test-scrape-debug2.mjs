import { chromium, firefox } from 'playwright';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function testJustDialFirefox() {
  console.log('\n=== JustDial via Firefox ===\n');
  try {
    const browser = await firefox.launch({
      headless: true,
      args: ['--no-sandbox'],
    });

    const ctx = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
    });

    const page = await ctx.newPage();
    page.setDefaultTimeout(30000);

    const url = 'https://www.justdial.com/Surat/Restaurants';
    console.log(`Navigating: ${url}`);
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    console.log(`  HTTP ${resp?.status()}`);
    await sleep(3000);
    const title = await page.title();
    console.log(`  Title: ${title}`);
    const text = await page.evaluate(() => document.body?.innerText?.substring(0, 300) || '');
    console.log(`  Text: ${text}`);

    if (text.toLowerCase().includes('captcha') || resp?.status() === 403 || resp?.status() === 503) {
      console.log('  BLOCKED');
    } else {
      const bizCount = await page.evaluate(() => document.querySelectorAll('li[data-result-index]').length);
      console.log(`  Businesses: ${bizCount}`);
    }

    await browser.close();
  } catch (err) {
    console.log(`  Error: ${err.message}`);
  }
}

async function testJustDialChromiumChannel() {
  console.log('\n=== JustDial via Chromium (channel:chrome) ===\n');
  try {
    const browser = await chromium.launch({
      channel: 'chrome',
      headless: false, // Must use headed for channel
      args: ['--no-sandbox'],
    });

    const ctx = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
    });

    const page = await ctx.newPage();
    page.setDefaultTimeout(30000);

    const url = 'https://www.justdial.com/Surat/Restaurants';
    console.log(`Navigating: ${url}`);
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    console.log(`  HTTP ${resp?.status()}`);
    await sleep(3000);
    const title = await page.title();
    console.log(`  Title: ${title}`);
    const text = await page.evaluate(() => document.body?.innerText?.substring(0, 300) || '');
    console.log(`  Text: ${text}`);

    if (text.toLowerCase().includes('captcha') || resp?.status() === 403) {
      console.log('  BLOCKED');
    } else {
      const bizCount = await page.evaluate(() => document.querySelectorAll('li[data-result-index]').length);
      console.log(`  Businesses: ${bizCount}`);
    }

    await browser.close();
  } catch (err) {
    console.log(`  Error: ${err.message}`);
    if (err.message.includes('channel')) {
      console.log('  (Chrome channel not available - need to install Google Chrome)');
    }
  }
}

async function testJustDialWithProxy() {
  console.log('\n=== JustDial via Chromium (headed, no-sandbox tricks) ===\n');
  try {
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', '--disable-gpu',
        '--window-size=1366,768',
        '--disable-blink-features=AutomationControlled',
        '--no-zygote',
        '--single-process',
      ],
    });

    const ctx = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
      bypassCSP: true,
      ignoreHTTPSErrors: true,
    });

    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-IN', 'en', 'en-US'] });
      window.chrome = { runtime: {} };
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' || parameters.name === 'clipboard-read'
          ? Promise.resolve({ state: 'denied', onchange: null })
          : originalQuery(parameters)
      );
    });

    const page = await ctx.newPage();
    page.setDefaultTimeout(45000);

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    });

    const url = 'https://www.justdial.com/Surat/Restaurants';
    console.log(`Navigating: ${url}`);

    // Try with load event first, with retry
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        console.log(`  HTTP ${resp?.status()}`);
        await sleep(3000);
        const title = await page.title();
        console.log(`  Title: ${title}`);
        const text = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
        console.log(`  Text: ${text.substring(0, 300)}`);

        if (resp?.status() === 200 && !text.toLowerCase().includes('captcha')) {
          console.log('  ✅ SUCCESS!');
          const bizCount = await page.evaluate(() => document.querySelectorAll('li[data-result-index], .jca-widget, .cntanr, .bshapp').length);
          console.log(`  Business cards: ${bizCount}`);
          break;
        } else {
          console.log(`  Attempt ${attempt + 1} blocked (status=${resp?.status()})`);
        }
      } catch (err) {
        console.log(`  Attempt ${attempt + 1} error: ${err.message.substring(0, 100)}`);
      }
      await sleep(2000);
    }

    await browser.close();
  } catch (err) {
    console.log(`  Fatal: ${err.message}`);
  }
}

async function testIndiaMartDebug() {
  console.log('\n=== IndiaMart Debug ===\n');
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  const url = 'https://dir.indiamart.com/search.mp?ss=hotel+supplies';
  console.log(`URL: ${url}`);
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log(`  HTTP ${resp?.status()}`);
  await sleep(3000);
  console.log(`  Title: ${await page.title()}`);

  // Detailed page structure analysis
  const info = await page.evaluate(() => {
    const body = document.body;
    if (!body) return { error: 'no body' };

    const text = body.innerText || '';

    // Find all links with phone numbers
    const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]')).map(a => ({
      href: a.href,
      text: a.textContent?.trim()?.substring(0, 60),
      parentClass: a.parentElement?.className?.substring(0, 60),
    }));

    // Find sellers/cards
    const seen = new Set();
    const sellers = [];
    const selectors = ['.srch_product_box', '.seller_listing', '.product-list', '.rht', '.card', '.list-item', '[class*="seller"]', '[class*="product"]'];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const text = el.textContent?.trim() || '';
        const cls = el.className?.substring(0, 80);
        const key = text.substring(0, 50);
        if (!seen.has(key) && text.length > 20) {
          seen.add(key);
          sellers.push({ cls, text: text.substring(0, 150) });
        }
      }
    }

    // Check for phone numbers anywhere
    const phoneRegex = body.innerHTML.match(/(\+?91[\s-]?)?[6-9]\d{9}/g) || [];

    return {
      textLength: text.length,
      textPreview: text.substring(0, 1000),
      telLinks,
      sellers: sellers.slice(0, 20),
      phoneMatches: phoneRegex.slice(0, 10),
      totalLinks: document.querySelectorAll('a').length,
    };
  });

  console.log(`  Text length: ${info.textLength}`);
  console.log(`  Tel links: ${info.telLinks.length}`);
  if (info.telLinks.length > 0) {
    info.telLinks.slice(0, 3).forEach(l => console.log(`    ${l.href}`));
  }
  console.log(`  Phone regex matches: ${info.phoneMatches.length}`);
  if (info.phoneMatches.length > 0) {
    console.log(`    ${info.phoneMatches.join(', ')}`);
  }
  console.log(`  Seller-like elements: ${info.sellers.length}`);
  info.sellers.slice(0, 5).forEach((s, i) => console.log(`    ${i+1}. [${s.cls}] ${s.text}`));
  console.log(`\n  FULL TEXT:\n${info.textPreview}`);

  await browser.close();
}

async function main() {
  await testJustDialFirefox();
  await testJustDialChromiumChannel();
  await testJustDialWithProxy();
  await testIndiaMartDebug();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
