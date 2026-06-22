import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';
import { ContactAudit } from './types';

export class ContactDetector {
  async detectContactInfo(html: string): Promise<ContactAudit> {
    try {
      const $ = cheerio.load(html);
      
      const phoneDetected = this.detectPhone($);
      const emailDetected = this.detectEmail($);
      const contactForm = this.detectContactForm($);
      const googleMapsEmbed = this.detectGoogleMaps($);
      const officeAddress = this.detectAddress($);
      const whatsappButton = this.detectWhatsAppButton($);
      
      const contactMethods = [
        phoneDetected,
        emailDetected,
        contactForm,
        googleMapsEmbed,
        officeAddress,
        whatsappButton,
      ].filter(Boolean).length;

      const audit: ContactAudit = {
        phoneDetected,
        emailDetected,
        contactForm,
        googleMapsEmbed,
        officeAddress,
        whatsappButton,
        contactMethods,
      };

      logger.info(`Contact detected: methods=${contactMethods}, form=${contactForm}`);
      return audit;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to detect contact info:');
      return this.getDefaultContactAudit();
    }
  }

  private detectPhone($: cheerio.CheerioAPI): boolean {
    const bodyText = $('body').text();
    const phonePatterns = [
      /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
      /\b\d{10}\b/,
      /\+\d{1,3}\s?\d{6,}/,
    ];
    
    for (const pattern of phonePatterns) {
      if (pattern.test(bodyText)) {
        return true;
      }
    }
    
    const telLinks = $('a[href^="tel:"]');
    return telLinks.length > 0;
  }

  private detectEmail($: cheerio.CheerioAPI): boolean {
    const bodyText = $('body').text();
    const emailPattern = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
    
    if (emailPattern.test(bodyText)) {
      return true;
    }
    
    const mailtoLinks = $('a[href^="mailto:"]');
    return mailtoLinks.length > 0;
  }

  private detectContactForm($: cheerio.CheerioAPI): boolean {
    const forms = $('form');
    
    if (forms.length === 0) {
      return false;
    }
    
    let hasContactForm = false;
    
    forms.each((_, form) => {
      const formHtml = $(form).html() || '';
      const formText = $(form).text().toLowerCase();
      
      const hasNameField = formHtml.includes('name') || $(form).find('input[name*="name"]').length > 0;
      const hasEmailField = formHtml.includes('email') || $(form).find('input[type="email"]').length > 0;
      const hasMessageField = formHtml.includes('message') || $(form).find('textarea').length > 0;
      
      const isContactForm = formText.includes('contact') || 
                           formText.includes('get in touch') ||
                           formText.includes('send message');
      
      if ((hasNameField && hasEmailField && hasMessageField) || isContactForm) {
        hasContactForm = true;
      }
    });
    
    return hasContactForm;
  }

  private detectGoogleMaps($: cheerio.CheerioAPI): boolean {
    const iframes = $('iframe');
    
    for (let i = 0; i < iframes.length; i++) {
      const src = $(iframes[i]).attr('src') || '';
      if (src.includes('google.com/maps') || src.includes('maps.google.com')) {
        return true;
      }
    }
    
    const links = $('a[href*="google.com/maps"], a[href*="maps.google.com"]');
    return links.length > 0;
  }

  private detectAddress($: cheerio.CheerioAPI): boolean {
    const addressSelectors = [
      '[itemprop="address"]',
      '.address',
      '#address',
      '.location',
      '.office-address',
    ];
    
    for (const selector of addressSelectors) {
      if ($(selector).length > 0) {
        return true;
      }
    }
    
    const bodyText = $('body').text();
    const addressPatterns = [
      /\d+\s+[A-Z][a-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)/i,
      /\b(Street|Avenue|Road|Boulevard)\b.*\b(City|Town|Village)\b/i,
    ];
    
    for (const pattern of addressPatterns) {
      if (pattern.test(bodyText)) {
        return true;
      }
    }
    
    return false;
  }

  private detectWhatsAppButton($: cheerio.CheerioAPI): boolean {
    const whatsappLinks = $('a[href*="wa.me"], a[href*="whatsapp.com"], a[href*="api.whatsapp.com"]');
    
    if (whatsappLinks.length > 0) {
      return true;
    }
    
    const whatsappClasses = $('.whatsapp, .whatsapp-button, .wa-button, [class*="whatsapp"]');
    return whatsappClasses.length > 0;
  }

  private getDefaultContactAudit(): ContactAudit {
    return {
      phoneDetected: false,
      emailDetected: false,
      contactForm: false,
      googleMapsEmbed: false,
      officeAddress: false,
      whatsappButton: false,
      contactMethods: 0,
    };
  }
}

export const contactDetector = new ContactDetector();
