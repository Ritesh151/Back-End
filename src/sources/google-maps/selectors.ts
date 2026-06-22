export const googleMapsSelectors = {
  searchInput: 'input#searchboxinput',
  searchInputAlt: 'input#searchbox-input',

  feedContainer: '[role="feed"]',

  businessCardLink: 'a[href*="maps/place/"]',

  businessNameInCard: [
    '.fontHeadlineSmall',
    'div.fontHeadlineSmall',
    'span.fontHeadlineSmall',
    'div.qBF1Pd',
    'h3',
  ],

  ratingInCard: [
    'span[role="img"]',
    'span[aria-label*="stars"]',
    'span[aria-label*="rating"]',
  ],

  categoryInCard: [
    '.W4Efsd',
    'div.W4Efsd',
    'button.DKv0N',
  ],

  detailCompanyName: [
    'h1',
    'h1.DUwDvf',
    'h1[itemprop="name"]',
  ],

  detailCategory: [
    'button.DKv0N',
    'button[jsaction*="category"]',
    'div[role="button"]',
    'span[jsaction*="category"]',
    'button[aria-label*="Category"]',
  ],

  detailPhone: [
    'button[data-item-id*="phone"]',
    'a[data-item-id*="phone"]',
    'button[aria-label*="phone"]',
    'button[aria-label*="Phone"]',
    'button[aria-label*="Call"]',
    'button:has(svg[aria-label*="phone"])',
    'button[data-item-id$="phone"]',
    'a[href^="tel:"]',
  ],

  detailAddress: [
    'button[data-item-id*="address"]',
    'button[aria-label*="Address"]',
    'button[aria-label*="address"]',
    'button:has(svg[aria-label*="address"])',
    'button[data-item-id$="address"]',
    'div[data-item-id*="address"]',
  ],

  detailWebsite: [
    'a[data-item-id*="website"]',
    'a[data-item-id*="authority"]',
    'a[aria-label*="website"]',
    'a[aria-label*="Website"]',
    'a[aria-label*="Web page"]',
    'a[aria-label*="Site"]',
    'a[aria-label*="site"]',
    'a:has(svg[aria-label*="website"])',
    'a:has(svg[aria-label*="Web"])',
    'a[href^="https://www.google.com/url"][href*="q="]',
    'a[href^="http"][href*="//"][href*="."]:not([href*="google.com/maps"]):not([href*="support.google"])',
    'a[data-item-id$="website"]',
    'a[data-item-id$="authority"]',
  ],

  detailPanelScroll:
    '[role="dialog"], div[role="main"], div.m6QErb, div[jsinstance]',

  detailRating: [
    'span[role="img"][aria-label*="stars"]',
    'span[aria-label*="star"]',
    'span[role="img"]',
  ],
};

export async function getFirstMatchText(
  page: any,
  selectors: string[]
): Promise<string | null> {
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const text = await element.innerText().catch(() => null);
        if (text && text.trim()) return text.trim();
      }
    } catch {}
  }
  return null;
}

export async function getFirstMatchAttribute(
  page: any,
  selectors: string[],
  attr: string
): Promise<string | null> {
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const value = await element.getAttribute(attr).catch(() => null);
        if (value) return value;
      }
    } catch {}
  }
  return null;
}

export async function extractWebsiteFromDetailPanel(
  page: any
): Promise<string | null> {
  try {
    return await page.evaluate(() => {
      const panel = document.querySelector('[role="dialog"], div[role="main"]');
      if (!panel) return null;
      const allLinks = panel.querySelectorAll('a[href]');
      const seen = new Set<string>();
      const websiteCandidates: string[] = [];

      for (const link of Array.from(allLinks)) {
        const href = link.getAttribute('href') || '';
        if (!href || seen.has(href)) continue;
        seen.add(href);
        const lower = href.toLowerCase();

        if (
          lower.startsWith('http') &&
          !lower.includes('google.com/maps') &&
          !lower.includes('support.google') &&
          !lower.includes('maps.google') &&
          !lower.startsWith('javascript:') &&
          !lower.startsWith('#') &&
          !lower.includes('googleads.g.doubleclick') &&
          !lower.includes('googleadservices')
        ) {
          let candidate = href;
          try {
            const parsed = new URL(href);
            if (
              parsed.hostname.includes('google.') &&
              parsed.searchParams.get('q')
            ) {
              candidate = parsed.searchParams.get('q') || href;
            }
          } catch {}

          const text = (link.textContent || '').trim().toLowerCase();
          const isExplicitWebsiteLink =
            text.includes('website') ||
            text.includes('web') ||
            text.includes('visit') ||
            text.includes('site') ||
            link.getAttribute('data-item-id')?.includes('website') ||
            link.getAttribute('data-item-id')?.includes('authority') ||
            link.getAttribute('aria-label')?.toLowerCase().includes('website');

          if (isExplicitWebsiteLink) {
            return candidate.trim();
          }
          websiteCandidates.push(candidate);
        }
      }

      if (websiteCandidates.length === 1) {
        return websiteCandidates[0].trim();
      }

      for (const candidate of websiteCandidates) {
        const lower = candidate.toLowerCase();
        if (
          !lower.includes('facebook.com') &&
          !lower.includes('instagram.com') &&
          !lower.includes('twitter.com') &&
          !lower.includes('linkedin.com') &&
          !lower.includes('youtube.com') &&
          !lower.includes('whatsapp.com')
        ) {
          return candidate.trim();
        }
      }

      return websiteCandidates.length > 0 ? websiteCandidates[0].trim() : null;
    });
  } catch {
    return null;
  }
}

export async function extractPhoneFromDetailPanel(
  page: any
): Promise<string | null> {
  try {
    return await page.evaluate(() => {
      const panel = document.querySelector('[role="dialog"], div[role="main"]');
      if (!panel) return null;

      const phoneButton = panel.querySelector(
        'button[data-item-id*="phone"], a[data-item-id*="phone"], a[href^="tel:"]'
      );
      if (phoneButton) {
        const ariaLabel = phoneButton.getAttribute('aria-label') || '';
        const text = phoneButton.textContent || '';
        const combined = ariaLabel + ' ' + text;
        const cleaned = combined.replace(/[^\d]/g, '');
        if (cleaned.length >= 10) {
          const match = cleaned.match(/(\d{10,})/);
          if (match) return match[1];
        }
      }

      const allButtons = panel.querySelectorAll('button, a');
      for (const el of Array.from(allButtons)) {
        const ariaLabel = el.getAttribute('aria-label') || '';
        const text = el.textContent || '';
        const combined = ariaLabel + ' ' + text;

        const indianMatch = combined.match(/(\+?91[\s-]?)?[6-9]\d{9}/);
        if (indianMatch) {
          return indianMatch[0].replace(/[\s-]/g, '');
        }

        const generalMatch = combined.match(/[\d+][\d\s\-().]{7,}\d/);
        if (generalMatch) {
          return generalMatch[0].replace(/[^\d]/g, '');
        }
      }

      const allText = panel.textContent || '';
      const textMatch = allText.match(/(\+?91[\s-]?)?[6-9]\d{9}/);
      if (textMatch) {
        return textMatch[0].replace(/[\s-]/g, '');
      }

      return null;
    });
  } catch {
    return null;
  }
}

export async function getAllTextContent(
  page: any,
  selector: string
): Promise<string[]> {
  try {
    return await page.$$eval(selector, (els: Element[]) =>
      els.map((el) => el.textContent || '').filter(Boolean)
    );
  } catch {
    return [];
  }
}
