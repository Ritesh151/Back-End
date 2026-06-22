import { chromium } from 'playwright';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function testJustDialDebug() {
  console.log('\n=== JustDial Debug ===\n');

  // Launch visible to see what happens
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--window-size=1366,768',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    },
  });

  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-IN', 'en', 'en-US'] });
    const newProto = navigator.__proto__;
    delete newProto.webdriver;
  });

  const page = await ctx.newPage();
  page.setDefaultTimeout(90000);

  // Listen for console messages and responses
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`  [CONSOLE ERROR] ${msg.text()}`);
  });

  page.on('response', resp => {
    if (resp.status() >= 400) {
      console.log(`  [HTTP ${resp.status()}] ${resp.url().substring(0, 150)}`);
    }
  });

  const url = 'https://www.justdial.com/Surat/Restaurants';
  console.log(`Navigating to: ${url}`);
  
  try {
    const resp = await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
    console.log(`  Navigation committed, HTTP ${resp?.status()}`);
    
    // Wait a bit and check what page we're on
    await sleep(5000);
    console.log(`  Current URL: ${page.url()}`);
    console.log(`  Title: ${await page.title()}`);
    
    const html = await page.content();
    console.log(`  HTML length: ${html.length} bytes`);
    console.log(`  HTML preview: ${html.substring(0, 1500)}`);
    
    // Check for specific blocking indicators
    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    console.log(`  Body text preview: ${bodyText.substring(0, 500)}`);
    
    if (bodyText.includes('captcha')) console.log('  ✓ Contains captcha');
    if (bodyText.includes('verify')) console.log('  ✓ Contains verify');
    if (bodyText.includes('robot')) console.log('  ✓ Contains robot');
    if (bodyText.includes('cloudflare')) console.log('  ✓ Contains cloudflare');
    if (bodyText.includes('Justdial') || bodyText.includes('JustDial')) console.log('  ✓ Contains JustDial');

    // Try to evaluate some selectors
    const selectors = {
      'li[data-result-index]': await page.evaluate(() => document.querySelectorAll('li[data-result-index]').length),
      'a[href*="justdial.com"]': await page.evaluate(() => document.querySelectorAll('a[href*="justdial.com"]').length),
      'div[class*="result"]': await page.evaluate(() => document.querySelectorAll('[class*="result"]').length),
      'img[alt*="restaurant"]': await page.evaluate(() => document.querySelectorAll('img[alt*="restaurant"]').length),
    };
    console.log('  Selector counts:', selectors);

  } catch (err) {
    console.log(`  Error: ${err.message}`);
    const curUrl = page.url();
    console.log(`  Current URL after error: ${curUrl}`);
    const html = await page.content();
    console.log(`  HTML length: ${html.length}`);
    console.log(`  HTML preview: ${html.substring(0, 1500)}`);
  }

  await browser.close();
}

async function testIndiaMartDetailed() {
  console.log('\n=== IndiaMart Detailed ===\n');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--window-size=1920,1080',
    ],
  });

  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  });

  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  // Try IndiaMart specifically for hotel/restaurant supplies
  const query = 'hotel+supplies';
  const url = `https://dir.indiamart.com/search.mp?ss=${query}`;
  console.log(`URL: ${url}`);

  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`  HTTP ${resp?.status()}`);
    await sleep(rnd(2000, 4000));

    console.log(`  Title: ${await page.title()}`);

    // Get the full HTML structure to understand IndiaMart's layout
    const structure = await page.evaluate(() => {
      const classes = new Set();
      document.querySelectorAll('[class]').forEach(el => {
        (el.className || '').split(/\s+/).forEach(c => c && classes.add(c));
      });
      return {
        classes: Array.from(classes).slice(0, 100),
        bodyText: (document.body?.innerText || '').substring(0, 1000),
        links: Array.from(document.querySelectorAll('a[href]')).map(a => a.href).filter(h => h.includes('indiamart')).slice(0, 10),
      };
    });

    console.log(`  Classes found: ${structure.classes.length}`);
    console.log(`  Body: ${structure.bodyText.substring(0, 300)}`);

    // Look for "View Number" or "Show Number" buttons and try to click them
    const viewNumberBtns = await page.evaluate(() => {
      const btns = [];
      // Look for various number reveal patterns
      const buttons = document.querySelectorAll('a, button, span, div');
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || '';
        const cls = btn.className || '';
        if (
          text.includes('Show Number') || text.includes('View Number') ||
          text.includes('Call Now') || text.includes('Get Phone') ||
          text.includes('Phone') || text.includes('Mobile') ||
          cls.includes('call') || cls.includes('phone') || cls.includes('mob')
        ) {
          btns.push({ text: text.substring(0, 50), cls: cls.substring(0, 50), tag: btn.tagName });
        }
      }
      return btns.slice(0, 20);
    });

    console.log(`  Number reveal buttons: ${viewNumberBtns.length}`);
    viewNumberBtns.slice(0, 5).forEach((b, i) => console.log(`    ${i+1}. <${b.tag}> "${b.text}" (${b.cls})`));

    // Check all anchor hrefs for tel:
    const telLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href^="tel:"]')).map(a => ({
        href: a.href,
        text: a.textContent?.trim()?.substring(0, 50),
      }));
    });
    console.log(`  Direct tel: links: ${telLinks.length}`);
    telLinks.slice(0, 3).forEach(l => console.log(`    ${l.href} - "${l.text}"`));

    // Look for phone numbers in raw HTML
    const phonePatterns = await page.evaluate(() => {
      const body = document.body?.innerHTML || '';
      const matches = body.match(/(\+?91[\s-]?)?[6-9]\d{9}/g) || [];
      return matches.slice(0, 10);
    });
    console.log(`  Phone regex matches: ${phonePatterns.length}`);
    if (phonePatterns.length > 0) console.log(`    ${phonePatterns.slice(0, 5).join(', ')}`);

  } catch (err) {
    console.error(`  Error: ${err.message}`);
  }

  await browser.close();
}

async function main() {
  await testJustDialDebug();
  await testIndiaMartDetailed();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
