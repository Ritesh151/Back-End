import { logger } from '../../../../utils/logger';
import type { ScraperResult, ScraperOptions } from '../../types';
import { IndiaMartScraper as NewIndiaMartScraper } from '../../../../modules/scrapers/indiamart/indiamart.scraper';

const scraper = new NewIndiaMartScraper();

export class IndiaMartScraper {
  async scrape(options: ScraperOptions): Promise<ScraperResult> {
    logger.info({ keyword: options.keyword, state: options.state, city: options.city, area: options.area }, 'IndiaMartScraper (ScraperEngine): Delegating to new module');
    return scraper.scrape(options);
  }
}
