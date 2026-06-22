import { Page } from 'playwright';
import { logger } from '../../utils/logger';

export const justdialMapper = {
  async extractBusinessData(page: Page, businessElement: any): Promise<any | null> {
    try {
      await businessElement.click();
      await page.waitForTimeout(1000);

      const data: any = {
        id: crypto.randomUUID(),
        companyName: '',
        phone: '',
        website: '',
        email: '',
        address: '',
        category: '',
        rating: 0,
        reviewsCount: 0,
        sourceUrl: '',
        createdAt: new Date().toISOString(),
      };

      const companyName = await page.$eval('h2.cns_business_name', (el) => (el as HTMLElement).innerText);
      if (companyName) data.companyName = companyName;

      const category = await page.$eval('.cns_jc_cat', (el) => (el as HTMLElement).innerText);
      if (category) data.category = category;

      const phone = await page.$eval('.contact-info', (el) => (el as HTMLElement).innerText);
      if (phone) data.phone = phone.replace(/[^\d+]/g, '');

      const address = await page.$eval('.cns_address', (el) => (el as HTMLElement).innerText);
      if (address) data.address = address;

      const website = await page.$eval('.web-domain', (el) => (el as HTMLElement).innerText);
      if (website) data.website = website;

      const ratingText = await page.$eval('.green-box', (el) => (el as HTMLElement).innerText);
      if (ratingText) {
        const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
        if (ratingMatch) data.rating = parseFloat(ratingMatch[1]);
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      return data;
    } catch (error: any) {
      logger.warn('JustdialMapper: Failed to extract business data:', error);
      return null;
    }
  },
};
