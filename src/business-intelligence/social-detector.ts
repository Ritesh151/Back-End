import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';
import { SocialAudit } from './types';

export class SocialDetector {
  async detectSocialPresence(html: string): Promise<SocialAudit> {
    try {
      const $ = cheerio.load(html);
      
      const instagram = this.detectInstagram($);
      const facebook = this.detectFacebook($);
      const linkedin = this.detectLinkedIn($);
      const twitter = this.detectTwitter($);
      const youtube = this.detectYouTube($);
      const whatsapp = this.detectWhatsApp($);
      
      const detectedLinks = this.extractSocialLinks($);
      const socialPresenceScore = this.calculateSocialScore({
        instagram,
        facebook,
        linkedin,
        twitter,
        youtube,
        whatsapp,
      });

      const audit: SocialAudit = {
        instagram,
        facebook,
        linkedin,
        twitter,
        youtube,
        whatsapp,
        socialPresenceScore,
        detectedLinks,
      };

      logger.info(`Social presence: score=${socialPresenceScore}, platforms=${this.countPlatforms(audit)}`);
      return audit;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to detect social presence:');
      return this.getDefaultSocialAudit();
    }
  }

  private detectInstagram($: cheerio.CheerioAPI): boolean {
    return this.detectPlatform($, [
      'instagram.com',
      'instagr.am',
      'fa-instagram',
      'icon-instagram',
      'instagram-icon',
    ]);
  }

  private detectFacebook($: cheerio.CheerioAPI): boolean {
    return this.detectPlatform($, [
      'facebook.com',
      'fb.com',
      'fa-facebook',
      'icon-facebook',
      'facebook-icon',
    ]);
  }

  private detectLinkedIn($: cheerio.CheerioAPI): boolean {
    return this.detectPlatform($, [
      'linkedin.com',
      'fa-linkedin',
      'icon-linkedin',
      'linkedin-icon',
    ]);
  }

  private detectTwitter($: cheerio.CheerioAPI): boolean {
    return this.detectPlatform($, [
      'twitter.com',
      'x.com',
      'fa-twitter',
      'fa-x-twitter',
      'icon-twitter',
      'twitter-icon',
    ]);
  }

  private detectYouTube($: cheerio.CheerioAPI): boolean {
    return this.detectPlatform($, [
      'youtube.com',
      'youtu.be',
      'fa-youtube',
      'icon-youtube',
      'youtube-icon',
    ]);
  }

  private detectWhatsApp($: cheerio.CheerioAPI): boolean {
    return this.detectPlatform($, [
      'wa.me',
      'whatsapp.com',
      'api.whatsapp.com',
      'fa-whatsapp',
      'icon-whatsapp',
      'whatsapp-icon',
    ]);
  }

  private detectPlatform($: cheerio.CheerioAPI, patterns: string[]): boolean {
    const allLinks = $('a').map((_, el) => $(el).attr('href') || '').get();
    const allClasses = $('[class]').map((_, el) => $(el).attr('class') || '').get();
    const allText = $('body').text().toLowerCase();
    
    for (const pattern of patterns) {
      const lowerPattern = pattern.toLowerCase();
      
      if (allLinks.some(link => link.toLowerCase().includes(lowerPattern))) {
        return true;
      }
      
      if (allClasses.some(cls => cls.toLowerCase().includes(lowerPattern))) {
        return true;
      }
      
      if (allText.includes(lowerPattern)) {
        return true;
      }
    }
    
    return false;
  }

  private extractSocialLinks($: cheerio.CheerioAPI): string[] {
    const socialDomains = [
      'instagram.com',
      'facebook.com',
      'linkedin.com',
      'twitter.com',
      'x.com',
      'youtube.com',
      'wa.me',
      'whatsapp.com',
    ];
    
    const links: string[] = [];
    
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      for (const domain of socialDomains) {
        if (href.includes(domain)) {
          links.push(href);
          break;
        }
      }
    });
    
    return [...new Set(links)];
  }

  private calculateSocialScore(platforms: {
    instagram: boolean;
    facebook: boolean;
    linkedin: boolean;
    twitter: boolean;
    youtube: boolean;
    whatsapp: boolean;
  }): number {
    let score = 0;
    
    if (platforms.instagram) score += 20;
    if (platforms.facebook) score += 20;
    if (platforms.linkedin) score += 15;
    if (platforms.twitter) score += 15;
    if (platforms.youtube) score += 15;
    if (platforms.whatsapp) score += 15;
    
    return Math.min(score, 100);
  }

  private countPlatforms(audit: SocialAudit): number {
    let count = 0;
    if (audit.instagram) count++;
    if (audit.facebook) count++;
    if (audit.linkedin) count++;
    if (audit.twitter) count++;
    if (audit.youtube) count++;
    if (audit.whatsapp) count++;
    return count;
  }

  private getDefaultSocialAudit(): SocialAudit {
    return {
      instagram: false,
      facebook: false,
      linkedin: false,
      twitter: false,
      youtube: false,
      whatsapp: false,
      socialPresenceScore: 0,
      detectedLinks: [],
    };
  }
}

export const socialDetector = new SocialDetector();
