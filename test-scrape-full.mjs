import { firefox } from 'playwright';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function extractJustDial() {
  console.log('\n=== JustDial - Full Extraction ===\n');
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
  await sleep(3000);

  const leads = [];
  const seenNames = new Set();
  let stall = 0;

  while (stall < 20) {
    const businesses = await page.evaluate(() => {
      const results = [];

      // Find all result boxes - these are the business cards
      const resultBoxes = document.querySelectorAll('.resultbox_textbox, div[class*="resultbox"]');
      
      for (const box of resultBoxes) {
        // The parent with resultbox class contains all info
        const parent = box.closest('div[class*="resultbox_"]') || box.parentElement;
        const grandparent = parent?.closest('div[class*="resultbox"]') || parent;
        
        // Extract name from the resultbox_textbox or similar
        const nameEl = parent?.querySelector('.font22, [class*="font22"], span[class*="store_name"], h2, h3');
        const name = nameEl?.textContent?.trim() || '';
        if (!name || name.length < 2) continue;

        // Extract rating
        const ratingEl = box.querySelector('[class*="green"], [class*="rating"], .star');
        let rating = 0;
        if (ratingEl) {
          const rm = (ratingEl.textContent || '').match(/(\d+\.?\d*)/);
          if (rm) rating = parseFloat(rm[1]);
        }

        // Extract phone
        let phone = '';
        const telLink = parent?.querySelector('a[href^="tel:"]');
        if (telLink) {
          phone = telLink.getAttribute('href')?.replace('tel:', '') || '';
        }
        if (!phone) {
          const phoneEl = parent?.querySelector('.callNowAnchor, a[class*="call"], [class*="callNow"]');
          if (phoneEl) {
            phone = phoneEl.textContent?.trim() || '';
            phone = phone.replace(/^Call\s+/i, '').replace(/[\s-]/g, '');
          }
        }
        if (!phone) {
          const pm = (parent?.textContent || '').match(/(\+?91[\s-]?)?[6-9]\d{9}/);
          if (pm) phone = pm[0];
        }

        // Extract address
        const addrEl = parent?.querySelector('[class*="address"], .cont_fload, [class*="add"], .mre-dir');
        const address = addrEl?.textContent?.trim() || '';

        // Extract category/type
        const typeEl = parent?.querySelector('.resCat, [class*="cat"], .business-type');
        const businessType = typeEl?.textContent?.trim() || 'Restaurant';

        results.push({ name, rating, phone, address, businessType });
      }

      // Try alternative selectors if resultbox approach didn't work
      if (results.length === 0) {
        // Try finding any card-like structure
        document.querySelectorAll('div[class*="result"]').forEach(el => {
          const text = el.textContent?.trim() || '';
          if (text.length > 30 && text.length < 3000) {
            const nameEl = el.querySelector('span[class*="store"], [class*="name"], h2, h3, .font22');
            const name = nameEl?.textContent?.trim() || '';
            if (name && name.length > 2) {
              const pm = text.match(/(\+?91[\s-]?)?[6-9]\d{9}/);
              const phone = pm ? pm[0].replace(/[\s-]/g, '') : '';
              const rm = text.match(/(\d+\.?\d*)\s*Ratings?/);
              const rating = rm ? parseFloat(rm[1]) : 0;
              const addr = el.querySelector('[class*="address"]')?.textContent?.trim() || '';
              results.push({ name, rating, phone, address, businessType: 'Restaurant' });
            }
          }
        });
      }

      return results;
    });

    const newBiz = businesses.filter(b => {
      const key = `${b.name}|${b.phone || b.address}`;
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    });

    if (newBiz.length > 0) {
      stall = 0;
      leads.push(...newBiz);
      console.log(`  ${newBiz.length} new (total: ${leads.length})`);
    } else {
      stall++;
    }

    // Scroll the results area
    await page.evaluate(() => {
      const scrollable = document.querySelector('.result-list, [class*="result_list"], .list_part, main, body');
      if (scrollable) scrollable.scrollTop = scrollable.scrollHeight;
      else window.scrollBy(0, 600);
    });
    await sleep(rnd(1500, 2500));
  }

  console.log(`\n  TOTAL: ${leads.length} businesses`);
  const withPhone = leads.filter(l => l.phone).length;
  const withRating = leads.filter(l => l.rating > 0).length;
  console.log(`  With phone: ${withPhone}, With rating: ${withRating}`);

  leads.slice(0, 8).forEach((l, i) => {
    console.log(`  ${i+1}. ${l.name} | phone=${l.phone || '-'} | rating=${l.rating || '?'} | ${l.address?.substring(0, 40) || '-'}`);
  });

  await browser.close();
  return leads;
}

async function extractIndiaMartFull() {
  console.log('\n=== IndiaMart - Full Extraction ===\n');
  const browser = await firefox.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    locale: 'en-IN', timezoneId: 'Asia/Kolkata',
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  // Try with a city-specific search and longer wait
  const url = 'https://dir.indiamart.com/search.mp?ss=hotel+supplier+surat';
  console.log(`URL: ${url}`);
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    console.log(`  HTTP ${resp?.status()}`);
    await sleep(5000); // Wait for JS to load
    console.log(`  Title: ${await page.title()}`);

    // Wait for the actual listing to appear (not "Related Searches")
    const content = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      // Check if we got real results or just popular searches
      const hasRelatedSearches = text.includes('Related Searches');
      const hasVerified = text.includes('Verified');
      const html = document.body?.innerHTML || '';
      const phones = html.match(/(\+?91[\s-]?)?[6-9]\d{9}/g) || [];
      return { textPreview: text.substring(0, 1500), phones: phones.slice(0, 20), hasRelatedSearches, hasVerified };
    });

    console.log(`  Has Related Searches: ${content.hasRelatedSearches}`);
    console.log(`  Has Verified: ${content.hasVerified}`);
    console.log(`  Phones: ${content.phones.length > 0 ? content.phones.join(', ') : 'none'}`);
    console.log(`  Text:\n${content.textPreview}`);

  } catch (err) {
    console.log(`  Error: ${err.message}`);
  }

  await browser.close();
}

async function main() {
  const jdLeads = await extractJustDial();
  await extractIndiaMartFull();

  console.log('\n========================================');
  console.log('JustDial total:', jdLeads.length);
  console.log('========================================');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
