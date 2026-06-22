import { PlaywrightBrowser } from './browser-manager';
import { BusinessData, ScrapeOptions, ScrapeResult } from '../types/scraper.types';
import { logger } from '../utils/logger';
import { Lead } from '../models/Lead';

export class GoogleMapsScraper {
  private browserManager: PlaywrightBrowser;
  private baseUrl = 'https://www.google.com/maps';
  private results: BusinessData[] = [];
  private totalExtracted = 0;
  private totalDuplicates = 0;
  private totalFound = 0;
  private scrapedCount = 0;
  constructor() {
    this.browserManager = new PlaywrightBrowser();
  }

  async scrape(options: ScrapeOptions): Promise<ScrapeResult> {
    const { keyword, location: _location, state, city, area, businessType: _businessType, limit = 1000, sessionId: _sessionId } = options;
    
    const searchQuery = this.buildSearchQuery(keyword, area, city, state);
    
    logger.info(`Starting Google Maps scrape: "${searchQuery}" (limit: ${limit})`);

    try {
      const { page } = await this.browserManager.initialize();

      // Set timeout
      page.setDefaultTimeout(30000);

      // Navigate to Google Maps
      await this.navigateToMaps(page);

      // Search for businesses with hyperlocal query
      await this.searchBusinesses(page, keyword, searchQuery);

      // Scroll and extract businesses
      await this.scrollAndExtract(page, limit, options);

      // Store leads in database
      const storedLeads = await this.storeLeads(this.results);

      logger.info(`Scrape completed: ${storedLeads.totalStored} leads stored, ${this.totalDuplicates} duplicates skipped`);

      await this.browserManager.close();

      return {
        success: true,
        message: 'Leads fetched successfully',
        totalExtracted: this.totalExtracted,
        totalStored: storedLeads.totalStored,
        totalDuplicates: this.totalDuplicates,
        leads: storedLeads.leads,
        totalFound: this.totalFound,
        scrapedCount: this.scrapedCount,
      };
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Scrape failed:');
      await this.browserManager.close().catch(() => {});
      throw error;
    }
  }

  private buildSearchQuery(keyword: string, area?: string, city?: string, state?: string): string {
    if (area && city && state) {
      return `${keyword} in ${area} ${city} ${state}`;
    }
    if (city && state) {
      return `${keyword} in ${city} ${state}`;
    }
    if (state) {
      return `${keyword} in ${state}`;
    }
    return keyword;
  }

  private async navigateToMaps(page: any): Promise<void> {
    logger.info('Navigating to Google Maps...');
    await page.goto(this.baseUrl, { waitUntil: 'networkidle' });
    
    // Wait for maps to load
    await page.waitForSelector('[aria-label="Google Maps"]', { timeout: 10000 });
    logger.info('Google Maps loaded');
  }

  private async searchBusinesses(page: any, _keyword: string, searchQuery: string): Promise<void> {
    logger.info(`Searching for: ${searchQuery}`);

    try {
      const searchBox = await page.waitForSelector(
        'input#searchboxinput',
        { timeout: 10000 }
      );

      if (searchBox) {
        await searchBox.fill(searchQuery);
        await page.keyboard.press('Enter');
        await page.waitForSelector('[role="main"]', { timeout: 15000 });
      }
    } catch (error) {
      logger.warn('Search box not found, trying alternative selector');
      const searchBoxAlt = await page.waitForSelector(
        'input[data-query="search"]',
        { timeout: 10000 }
      );
      if (searchBoxAlt) {
        await searchBoxAlt.fill(searchQuery);
        await page.keyboard.press('Enter');
        await page.waitForSelector('[role="main"]', { timeout: 15000 });
      }
    }

    logger.info('Search completed');
  }

  private async scrollAndExtract(page: any, limit: number, options: ScrapeOptions): Promise<void> {
    
    logger.info(`Starting to scroll and extract (limit: ${limit})`);

    let maxScrollAttempts = 5;
    let scrollAttempts = 0;
    let lastCount = 0;
    let consistentCount = 0;

    while (scrollAttempts < maxScrollAttempts) {
      // Extract visible businesses
      const businesses = await this.extractBusinessesFromPage(page, limit, options);
      
      const newCount = businesses.length;
      
      if (newCount > 0) {
        scrollAttempts = 0;
      } else {
        scrollAttempts++;
      }

      // Check if we've stopped getting new results
      if (this.results.length === lastCount) {
        consistentCount++;
        if (consistentCount >= 3) {
          logger.info('No new results found, stopping extraction');
          break;
        }
      } else {
        consistentCount = 0;
        lastCount = this.results.length;
      }

      // Update total found count
      this.totalFound = this.results.length;

      // Check if we've reached the limit
      if (this.results.length >= limit) {
        logger.info(`Reached limit of ${limit} businesses`);
        break;
      }

      // Scroll to load more
      await this.scrollToBottom(page);

      // Wait for new content to load
      await page.waitForTimeout(1500);
    }

    logger.info(`Extracted ${this.results.length} businesses`);
  }

  private async scrollToBottom(page: any): Promise<void> {
    try {
      // Find the results panel
      const resultsPanel = await page.$('[role="main"]');
      
      if (resultsPanel) {
        await resultsPanel.evaluate((el: HTMLElement) => {
          el.scrollTo(0, el.scrollHeight);
        });
      } else {
        // Fallback: scroll the page
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
      }
    } catch (error) {
      logger.warn(error instanceof Error ? error : new Error(String(error)), 'Scroll failed:');
    }
  }

  private async extractBusinessesFromPage(page: any, limit: number, options: ScrapeOptions): Promise<BusinessData[]> {
    const newBusinesses: BusinessData[] = [];
    const businessesSelector = 'div[role="article"]';

    // Wait for business cards
    await page.waitForSelector(businessesSelector, { timeout: 5000 });

    const businessCount = await page.count(businessesSelector);
    logger.info(`Found ${businessCount} business cards`);

    for (let i = 0; i < businessCount && this.results.length < limit; i++) {
      try {
        const business = await this.extractSingleBusiness(page, i, options);
        
        if (business && !this.isDuplicate(business)) {
          // Check area relevance before adding
          if (options.area && !business.isLocationValidated) {
            logger.debug(`Skipping ${business.companyName} - not in ${options.area}`);
            this.totalDuplicates++;
            continue;
          }
          
          this.results.push(business);
          this.totalExtracted++;
          this.scrapedCount++;
          
          logger.info(`Extracted: ${business.companyName} (${business.area || 'unknown area'})`);
        } else if (business) {
          this.totalDuplicates++;
          logger.debug(`Duplicate skipped: ${business.companyName}`);
        }
      } catch (error) {
        logger.warn(error instanceof Error ? error : new Error(String(error)), `Failed to extract business at index ${i}:`);
        continue;
      }
    }

    return newBusinesses;
  }

  private async extractSingleBusiness(page: any, index: number, options: ScrapeOptions): Promise<BusinessData | null> {
    const businessesSelector = 'div[role="article"]';
    
    // Get business card
    const businessCard = await page.$$(businessesSelector);
    
    if (!businessCard || index >= businessCard.length) {
      return null;
    }

    try {
      // Click on the business card to open details
      await businessCard[index].click();
      
      // Wait for details panel
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      
      // Extract business data
      const businessData = await this.extractBusinessDataFromDetails(page, options);
      
      // Close the details panel
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);

      return businessData;
    } catch (error) {
      logger.warn(error instanceof Error ? error : new Error(String(error)), 'Error extracting business details:');
      return null;
    }
  }

  private async extractBusinessDataFromDetails(page: any, options: ScrapeOptions): Promise<BusinessData> {
    const { area, city, state } = options;
    
    const data: BusinessData = {
      id: crypto.randomUUID(),
      companyName: '',
      website: '',
      phone: '',
      email: '',
      address: '',
      category: '',
      rating: 0,
      reviewsCount: 0,
      source: 'google-maps',
      leadScore: 50,
      createdAt: new Date().toISOString(),
      area: area || undefined,
      city: city || undefined,
      state: state || undefined,
      businessType: options.businessType || options.keyword,
      fullSearchQuery: this.buildSearchQuery(options.keyword, area, city, state),
      locationRelevanceScore: 0,
      isLocationValidated: false,
    };

    try {
      // Extract company name
      const companyNameSelector = 'h1.DUwDvf';
      const companyName = await this.getTextContent(page, companyNameSelector);
      if (companyName) data.companyName = companyName;

      // Extract category
      const categorySelector = 'button.DKv0N';
      const category = await this.getTextContent(page, categorySelector);
      if (category) data.category = category;

      // Extract phone
      const phoneSelector = 'button[aria-label*="Phone"]';
      const phone = await this.getTextContent(page, phoneSelector);
      if (phone) data.phone = phone.replace(/[^\d+]/g, '');

      // Extract address
      const addressSelector = 'button[aria-label*="Address"]';
      const address = await this.getTextContent(page, addressSelector);
      if (address) data.address = address;

      // Extract website with multiple fallback selectors
      const websiteSelectors = [
        'a[data-item-id*="website"]',
        'a[data-item-id*="authority"]',
        'a[aria-label*="website"]',
        'a[aria-label*="Website"]',
        'a[aria-label*="Web"]',
        'a[data-item-id*="info"]',
        'a:has(svg[aria-label*="website"])',
        'a:has(svg[aria-label*="Web"])',
        'a[href^="http"][href*="://"]',
      ];
      for (const sel of websiteSelectors) {
        const website = await this.getAttribute(page, sel, 'href');
        if (website && !website.includes('google.com/maps') && !website.includes('support.google') && !website.includes('maps.google')) {
          data.website = website.startsWith('http') ? website : `https://${website}`;
          break;
        }
      }

      if (!data.website) {
        try {
          data.website = await page.evaluate(() => {
            const panel = document.querySelector('[role="dialog"], div[role="main"]');
            if (!panel) return '';
            const allLinks = panel.querySelectorAll('a[href]');
            for (const link of Array.from(allLinks)) {
              const href = link.getAttribute('href') || '';
              const lower = href.toLowerCase();
              if (
                lower.startsWith('http') &&
                !lower.includes('google.com/maps') &&
                !lower.includes('support.google') &&
                !lower.includes('maps.google') &&
                !lower.startsWith('javascript:') &&
                !lower.startsWith('#')
              ) {
                return href.startsWith('http') ? href : `https://${href}`;
              }
            }
            return '';
          });
        } catch {}
      }

      // Extract rating
      const ratingSelector = 'span[aria-label*="stars"]';
      const ratingText = await this.getAttribute(page, ratingSelector, 'aria-label');
      if (ratingText) {
        const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
        if (ratingMatch) {
          data.rating = parseFloat(ratingMatch[1]);
        }
      }

      // Extract reviews count
      const reviewsSelector = 'span[aria-label*="reviews"]';
      const reviewsText = await this.getAttribute(page, reviewsSelector, 'aria-label');
      if (reviewsText) {
        const reviewsMatch = reviewsText.match(/(\d+)/);
        if (reviewsMatch) {
          data.reviewsCount = parseInt(reviewsMatch[1], 10);
        }
      }

      // Calculate lead score
      data.leadScore = this.calculateLeadScore(data);

      // Validate area relevance
      const relevanceScore = this.validateAreaRelevance(data, options.area, options.city, options.state);
      data.locationRelevanceScore = relevanceScore;
      data.isLocationValidated = relevanceScore > 50;

      logger.debug(`Business: ${data.companyName}, Area: ${data.area}, Relevance: ${relevanceScore}, Validated: ${data.isLocationValidated}`);

      return data;
    } catch (error) {
      logger.warn(error instanceof Error ? error : new Error(String(error)), 'Error extracting business data:');
      return data;
    }
  }

  private validateAreaRelevance(business: BusinessData, area?: string, city?: string, state?: string): number {
    if (!area && !city && !state) {
      return 100;
    }

    let score = 0;
    const checks: string[] = [];

    // Check if business address contains the area
    if (area && business.address) {
      if (business.address.toLowerCase().includes(area.toLowerCase())) {
        score += 40;
        checks.push(`Area match in address: ${area}`);
      }
    }

    // Check if business address contains the city
    if (city && business.address) {
      if (business.address.toLowerCase().includes(city.toLowerCase())) {
        score += 30;
        checks.push(`City match in address: ${city}`);
      }
    }

    // Check if business address contains the state
    if (state && business.address) {
      if (business.address.toLowerCase().includes(state.toLowerCase())) {
        score += 20;
        checks.push(`State match in address: ${state}`);
      }
    }

    // Check if business category contains business type
    if (business.category) {
      score += 10;
      checks.push('Category match');
    }

    return Math.min(score, 100);
  }

  private async getTextContent(page: any, selector: string): Promise<string | null> {
    try {
      const element = await page.$(selector);
      if (element) {
        return await element.innerText();
      }
    } catch (error) {
      // Silent fail
    }
    return null;
  }

  private async getAttribute(page: any, selector: string, attribute: string): Promise<string | null> {
    try {
      const element = await page.$(selector);
      if (element) {
        return await element.getAttribute(attribute);
      }
    } catch (error) {
      // Silent fail
    }
    return null;
  }

  private isDuplicate(business: BusinessData): boolean {
    // Check for duplicates by company name + phone
    const existing = this.results.find(
      (b) => b.companyName === business.companyName && b.phone === business.phone
    );
    return !!existing;
  }

  private calculateLeadScore(data: BusinessData): number {
    let score = 50;

    // Increase score based on available data
    if (data.website) score += 10;
    if (data.email) score += 10;
    if (data.address) score += 5;
    if (data.category) score += 5;

    // Increase score based on rating
    if (data.rating && data.rating >= 4.5) score += 20;
    else if (data.rating && data.rating >= 4.0) score += 15;
    else if (data.rating && data.rating >= 3.5) score += 10;

    // Cap at 100
    return Math.min(score, 100);
  }

  private async storeLeads(leads: BusinessData[]): Promise<{ totalStored: number; leads: BusinessData[] }> {
    const storedLeads: BusinessData[] = [];

    for (const lead of leads) {
      try {
        // Check for existing lead
        const existingLead = await Lead.findOne({
          $or: [
            { companyName: lead.companyName, phone: lead.phone },
            { website: lead.website },
          ],
        });

        if (existingLead) {
          this.totalDuplicates++;
          continue;
        }

        // Create new lead
        const newLead = new Lead({
          companyName: lead.companyName,
          website: lead.website || undefined,
          phone: lead.phone || undefined,
          email: lead.email || undefined,
          address: lead.address || undefined,
          category: lead.category || undefined,
          source: lead.source,
          rating: lead.rating || undefined,
          reviewsCount: lead.reviewsCount || undefined,
          leadScore: lead.leadScore,
        });

        await newLead.save();
        storedLeads.push(lead);

        logger.info(`Stored lead: ${lead.companyName}`);
      } catch (error) {
        logger.warn(error instanceof Error ? error : new Error(String(error)), `Failed to store lead ${lead.companyName}:`);
      }
    }

    return { totalStored: storedLeads.length, leads: storedLeads };
  }
}
