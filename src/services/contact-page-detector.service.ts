import { logger } from '../utils/logger';
import { PlaywrightBrowser } from '../scrapers/browser-manager';

export interface ContactPageInfo {
  url: string;
  hasContactForm: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  hasAddress: boolean;
  formFields: string[];
  extractionTime: number;
}

export class ContactPageDetectorService {
  private browserManager: PlaywrightBrowser | null = null;

  /**
   * Detect and analyze contact pages for a website
   */
  async detectContactPages(website: string): Promise<ContactPageInfo[]> {
    const contactPages: ContactPageInfo[] = [];
    const timeout = 15000;

    try {
      if (!this.browserManager) {
        this.browserManager = new (await import('../scrapers/browser-manager')).PlaywrightBrowser();
      }

      // Normalize URL
      let url = website;
      if (!url.match(/^https?:\/\//i)) {
        url = 'https://' + url;
      }

      // Check common contact page paths
      const contactPaths = [
        '/contact',
        '/contact-us',
        '/contact-us/',
        '/contacto',
        '/contactar',
        '/get-in-touch',
        '/reach-us',
        '/contact-form',
        '/contact-me',
        '/customer-service',
        '/support',
        '/help',
        '/inquiry',
        '/feedback',
        '/enquire',
        '/message-us',
      ];

      for (const path of contactPaths) {
        try {
          const contactUrl = url.replace(/\/+$/, '') + path;
          
          const { page } = await this.browserManager.initialize();
          page.setDefaultTimeout(timeout);

          const response = await page.goto(contactUrl, { 
            waitUntil: 'domcontentloaded', 
            timeout 
          });

          if (response && response.status() === 200) {
            // Analyze the contact page
            const pageInfo = await this.analyzeContactPage(page);
            contactPages.push({
              url: contactUrl,
              ...pageInfo,
              extractionTime: 0,
            });

            await this.browserManager.close();
            logger.info(`Found contact page: ${contactUrl}`);
          } else {
            await this.browserManager.close();
          }

        } catch (error) {
          // Try next path
          try {
            await this.browserManager?.close();
          } catch {
            // Ignore close errors
          }
        }
      }

    } catch (error: any) {
      logger.error(`Contact page detection failed for ${website}:`, error);
    }

    return contactPages;
  }

  /**
   * Analyze a contact page for contact information
   */
  private async analyzeContactPage(page: any): Promise<{
    hasContactForm: boolean;
    hasEmail: boolean;
    hasPhone: boolean;
    hasAddress: boolean;
    formFields: string[];
  }> {
    const result = {
      hasContactForm: false,
      hasEmail: false,
      hasPhone: false,
      hasAddress: false,
      formFields: [] as string[],
    };

    try {
      const pageInfo = await page.evaluate(() => {
        const text = document.body.innerText || '';

        // Check for contact form
        const hasForm = document.querySelector('form') !== null;
        const formFields: string[] = [];

        document.querySelectorAll('input, textarea, select').forEach(el => {
          const name = el.getAttribute('name') || '';
          const placeholder = el.getAttribute('placeholder') || '';
          const type = el.getAttribute('type') || '';

          if (name) formFields.push(name);
          if (placeholder) formFields.push(placeholder);
          if (type === 'email') result.hasEmail = true;
          if (type === 'tel' || type === 'phone') result.hasPhone = true;
        });

        // Check for email in text
        if (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i)) {
          result.hasEmail = true;
        }

        // Check for phone in text
        if (text.match(/[\d\s\-\(\)]{10,}/)) {
          result.hasPhone = true;
        }

        // Check for address
        if (text.match(/address|locat(?:ion|ed|ion)/i)) {
          result.hasAddress = true;
        }

        return {
          hasForm,
          formFields: [...new Set(formFields)],
        };
      });

      result.hasContactForm = pageInfo.hasForm;
      result.formFields = pageInfo.formFields;

    } catch (error) {
      logger.warn(error instanceof Error ? error : new Error(String(error)), 'Failed to analyze contact page:');
    }

    return result;
  }

  /**
   * Check if a URL is likely a contact page
   */
  async isContactPage(url: string): Promise<boolean> {
    try {
      if (!this.browserManager) {
        this.browserManager = new (await import('../scrapers/browser-manager')).PlaywrightBrowser();
      }

      const { page } = await this.browserManager.initialize();
      page.setDefaultTimeout(5000);

      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 5000 });

      if (!response || response.status() !== 200) {
        await this.browserManager.close();
        return false;
      }

      const isContact = await page.evaluate(() => {
        const text = document.body.innerText || '';
        const title = document.title || '';
        const h1 = document.querySelector('h1')?.innerText || '';

        // Check for contact keywords
        const contactKeywords = [
          'contact',
          'contact us',
          'get in touch',
          'reach us',
          'inquiry',
          'feedback',
          'message',
          'customer service',
          'support',
          'enquire',
        ];

        const allText = (text + ' ' + title + ' ' + h1).toLowerCase();

        return contactKeywords.some(keyword => allText.includes(keyword));
      });

      await this.browserManager.close();
      return isContact;

    } catch {
      return false;
    }
  }
}

export const contactPageDetectorService = new ContactPageDetectorService();
