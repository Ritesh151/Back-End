import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { Lead } from '../models/Lead';
import { EmailScanCache } from '../models/EmailScanCache';
import { browserPool } from './browser-pool.service';
import { emailDiscoveryQueue } from './email-discovery-queue.service';
import { logger } from '../utils/logger';
import { emitEmailDiscoveryUpdate } from '../modules/automation-monitor/socket-manager';
import { classifyWebsiteUrl } from '../modules/leads/services/urlClassifier.service';

const PRIORITY_PAGES = ['/contact', '/contact-us', '/contactus', '/about', '/about-us'];

const FAKE_EMAIL_PATTERNS = [
  /^test@/i, /^your@/i, /^dummy@/i, /^placeholder@/i, /^example@/i,
  /@example\./i, /@test\./i, /@domain\./i, /@yourcompany\./i,
  /^admin@example\./i, /^info@example\./i, /^contact@example\./i,
  /^support@example\./i, /^sales@example\./i, /noreply@/i, /no-reply@/i,
];

const FAKE_DOMAINS = [
  'example.com', 'test.com', 'domain.com', 'yourcompany.com',
  'yourdomain.com', 'sample.com', 'demo.com', 'test.org', 'example.org',
];

const PRIORITY_PREFIXES = ['info', 'contact', 'hello', 'sales', 'office', 'support', 'admin', 'marketing', 'hr'];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const REQUEST_TIMEOUT = 5000;

interface DiscoveredEmail {
  email: string;
  type: string;
  sourcePage: string;
  confidence: number;
  verified: boolean;
}

interface DiscoveryResult {
  discoveredEmails: DiscoveredEmail[];
  primaryEmail: string;
  emailCount: number;
  success: boolean;
  error?: string;
  fromCache?: boolean;
  method?: string;
  durationMs?: number;
}

export class BusinessEmailDiscoveryService {
  private httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
      },
      maxRedirects: 3,
      validateStatus: (status) => status < 500,
    });
  }

  normalizeUrl(rawUrl: string): string {
    let url = rawUrl.trim().toLowerCase();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    try {
      const parsed = new URL(url);
      return parsed.origin;
    } catch {
      return url.replace(/\/+$/, '');
    }
  }

  private getNormalizedDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  isSocialOrDirectoryUrl(url: string): boolean {
    const classification = classifyWebsiteUrl(url);
    return !classification.hasRealWebsite;
  }

  private isFakeEmail(email: string): boolean {
    const lower = email.toLowerCase();
    if (FAKE_EMAIL_PATTERNS.some(pattern => pattern.test(lower))) return true;
    const domain = lower.split('@')[1];
    if (domain && FAKE_DOMAINS.includes(domain)) return true;
    return false;
  }

  private isValidEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) return false;
    if (this.isFakeEmail(email)) return false;
    const domain = email.split('@')[1];
    if (domain && domain.split('.').length < 2) return false;
    return true;
  }

  private extractEmailsFromHtml(html: string, sourcePage: string): DiscoveredEmail[] {
    const $ = cheerio.load(html);
    const emails: DiscoveredEmail[] = [];
    const seen = new Set<string>();

    const addEmail = (email: string, type: string, confidence: number) => {
      const clean = email.trim().toLowerCase();
      if (!this.isValidEmail(clean)) return;
      if (seen.has(clean)) return;
      seen.add(clean);
      emails.push({ email: clean, type, sourcePage, confidence, verified: false });
    };

    $('[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const email = href.replace('mailto:', '').split('?')[0].trim();
      if (email) addEmail(email, 'mailto', 95);
      const linkText = $(el).text().trim();
      if (linkText && linkText.includes('@') && linkText !== email) {
        addEmail(linkText, 'mailto_link_text', 90);
      }
    });

    $('meta[name="email"], meta[property="email"]').each((_, el) => {
      const content = $(el).attr('content') || '';
      if (content) addEmail(content, 'meta_tag', 85);
    });

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).text());
        const jsonStr = JSON.stringify(json);
        const jsonMatches = jsonStr.match(EMAIL_REGEX) || [];
        for (const m of jsonMatches) addEmail(m, 'json_ld', 80);
      } catch { }
    });

    $('[itemtype*="schema.org"]').each((_, el) => {
      const itemText = $(el).text();
      const itemMatches = itemText.match(EMAIL_REGEX) || [];
      for (const m of itemMatches) addEmail(m, 'schema_org', 75);
    });

    $('[class*="contact"], [id*="contact"]').each((_, el) => {
      const contactText = $(el).text();
      const contactMatches = contactText.match(EMAIL_REGEX) || [];
      for (const m of contactMatches) addEmail(m, 'contact_section', 80);
    });

    $('[class*="footer"], [id*="footer"]').each((_, el) => {
      const footerText = $(el).text();
      const footerMatches = footerText.match(EMAIL_REGEX) || [];
      for (const m of footerMatches) addEmail(m, 'footer', 70);
    });

    const text = $('body').text();
    const textMatches = text.match(EMAIL_REGEX) || [];
    for (const m of textMatches) addEmail(m, 'visible_text', 60);

    return emails;
  }

  private selectPrimaryEmail(emails: DiscoveredEmail[]): string {
    if (emails.length === 0) return '';
    const priorityMap: Record<string, number> = {};
    PRIORITY_PREFIXES.forEach((prefix, index) => { priorityMap[prefix] = index; });

    const scored = emails.map(e => {
      const localPart = e.email.split('@')[0].toLowerCase();
      const prefixScore = priorityMap[localPart] !== undefined ? priorityMap[localPart] : 999;
      return { ...e, prefixScore };
    });

    scored.sort((a, b) => {
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      return a.prefixScore - b.prefixScore;
    });

    return scored[0].email;
  }

  private async checkCache(leadId: string, website: string, baseUrl: string): Promise<DiscoveryResult | null> {
    const normalizedDomain = this.getNormalizedDomain(website);
    const cached = await EmailScanCache.findOne({ normalizedDomain });

    if (cached && cached.lastScanAt && (Date.now() - cached.lastScanAt.getTime()) < 7 * 24 * 60 * 60 * 1000) {
      const discoveredEmails: DiscoveredEmail[] = cached.emails.map(e => ({
        email: e,
        type: 'cached',
        sourcePage: '/',
        confidence: 100,
        verified: false,
      }));

      const updateData: Record<string, unknown> = {
        discoveredEmails,
        primaryEmail: cached.primaryEmail,
        emailCount: cached.emailCount,
        lastEmailScan: new Date(),
        emailDiscoveryStatus: 'completed',
        emailDiscoveryError: null,
        emailDiscoveryRetries: 0,
      };

      if (cached.primaryEmail) {
        const lead = await Lead.findById(leadId).select('email');
        if (lead && !lead.email) {
          updateData.email = cached.primaryEmail;
        }
      }

      await Lead.findByIdAndUpdate(leadId, { $set: updateData });

      logger.info({
        leadId,
        website: baseUrl,
        emailsFound: cached.emailCount,
        primaryEmail: cached.primaryEmail,
        cacheHit: true,
      }, 'EmailDiscovery: Cache hit');

      return {
        discoveredEmails,
        primaryEmail: cached.primaryEmail,
        emailCount: cached.emailCount,
        success: true,
        fromCache: true,
        method: 'cache',
        durationMs: 0,
      };
    }

    return null;
  }

  private async saveToCache(website: string, emails: DiscoveredEmail[], primaryEmail: string): Promise<void> {
    try {
      const normalizedDomain = this.getNormalizedDomain(website);
      await EmailScanCache.findOneAndUpdate(
        { normalizedDomain },
        {
          $set: {
            normalizedDomain,
            emails: emails.map(e => e.email),
            primaryEmail,
            emailCount: emails.length,
            lastScanAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
        { upsert: true }
      );
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'EmailDiscovery: Failed to save cache');
    }
  }

  private async fetchWithAxios(url: string): Promise<{ html: string | null; error: string | null }> {
    try {
      const response = await this.httpClient.get(url, {
        responseType: 'text',
        timeout: REQUEST_TIMEOUT,
      });
      return {
        html: typeof response.data === 'string' ? response.data : String(response.data),
        error: null,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { html: null, error: message };
    }
  }

  private async fetchWithPlaywright(url: string): Promise<{ html: string | null; error: string | null }> {
    try {
      const { page } = await browserPool.acquire('email-discovery');

      await page.setViewportSize({ width: 1280, height: 800 });

      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'font', 'stylesheet', 'media'].includes(resourceType)) {
          return route.abort();
        }
        return route.continue();
      });

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: REQUEST_TIMEOUT,
      });

      const html = await page.content();
      await browserPool.release(page, 'email-discovery');
      return { html, error: null };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { html: null, error: message };
    }
  }

  private async extractEmailsWithPlaywright(url: string): Promise<DiscoveredEmail[]> {
    const { html, error: pwError } = await this.fetchWithPlaywright(url);
    if (html) {
      return this.extractEmailsFromHtml(html, '/');
    }
    logger.warn({ url, err: pwError }, 'EmailDiscovery: Playwright fallback failed');
    return [];
  }

  private async extractEmailsFromHomepage(url: string): Promise<{ emails: DiscoveredEmail[]; method: string; axiosFailed: boolean }> {
    const { html } = await this.fetchWithAxios(url);
    if (html) {
      return { emails: this.extractEmailsFromHtml(html, '/'), method: 'homepage', axiosFailed: false };
    }
    return { emails: [], method: 'homepage_failed', axiosFailed: true };
  }

  private async extractEmailsFromPages(baseUrl: string, paths: string[]): Promise<DiscoveredEmail[]> {
    const results = await Promise.allSettled(
      paths.map(path => this.fetchWithAxios(`${baseUrl}${path}`))
    );

    const allEmails: DiscoveredEmail[] = [];
    const seen = new Set<string>();

    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value.html) {
        const pageEmails = this.extractEmailsFromHtml(result.value.html, paths[i]);
        for (const e of pageEmails) {
          if (!seen.has(e.email)) {
            seen.add(e.email);
            allEmails.push(e);
          }
        }
      }
    });

    return allEmails;
  }

  private async updateLeadWithEmails(
    leadId: string,
    allEmails: DiscoveredEmail[],
    primaryEmail: string,
    status: string,
    error?: string
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      discoveredEmails: allEmails,
      primaryEmail,
      emailCount: allEmails.length,
      lastEmailScan: new Date(),
      emailDiscoveryStatus: status,
    };

    if (error) {
      updateData.emailDiscoveryError = error;
    } else {
      updateData.emailDiscoveryError = null;
      updateData.emailDiscoveryRetries = 0;
    }

    if (primaryEmail) {
      const lead = await Lead.findById(leadId).select('email');
      if (lead && !lead.email) {
        updateData.email = primaryEmail;
      }
    }

    await Lead.findByIdAndUpdate(leadId, { $set: updateData });
  }

  async discoverEmailsForLead(leadId: string): Promise<DiscoveryResult> {
    const startTime = Date.now();

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return { discoveredEmails: [], primaryEmail: '', emailCount: 0, success: false, error: 'Lead not found', durationMs: Date.now() - startTime };
    }

    if (!lead.hasWebsite || !lead.website) {
      return { discoveredEmails: [], primaryEmail: '', emailCount: 0, success: false, error: 'Lead has no website', durationMs: Date.now() - startTime };
    }

    const website = lead.website;
    if (this.isSocialOrDirectoryUrl(website)) {
      await Lead.findByIdAndUpdate(leadId, {
        $set: { emailDiscoveryStatus: 'skipped', lastEmailScan: new Date() },
      });
      return { discoveredEmails: [], primaryEmail: '', emailCount: 0, success: true, error: 'Social/directory website skipped', durationMs: Date.now() - startTime };
    }

    const baseUrl = this.normalizeUrl(website);

    const cached = await this.checkCache(leadId, website, baseUrl);
    if (cached) return cached;

    await Lead.findByIdAndUpdate(leadId, {
      $set: { emailDiscoveryStatus: 'scanning' },
    });

    emitEmailDiscoveryUpdate(leadId, { status: 'scanning' });

    const allEmails: DiscoveredEmail[] = [];
    const seenEmails = new Set<string>();

    const addUniqueEmails = (newEmails: DiscoveredEmail[]) => {
      for (const e of newEmails) {
        if (!seenEmails.has(e.email)) {
          seenEmails.add(e.email);
          allEmails.push(e);
        }
      }
    };

    try {
      const { emails: homepageEmails, axiosFailed } = await this.extractEmailsFromHomepage(baseUrl);
      addUniqueEmails(homepageEmails);

      if (allEmails.length > 0) {
        const primaryEmail = this.selectPrimaryEmail(allEmails);
        await this.updateLeadWithEmails(leadId, allEmails, primaryEmail, 'completed');
        await this.saveToCache(website, allEmails, primaryEmail);

        const durationMs = Date.now() - startTime;
        logger.info({
          leadId, website: baseUrl, emailsFound: allEmails.length, primaryEmail,
          method: 'homepage', durationMs, cacheHit: false,
        }, 'EmailDiscovery: Completed (homepage)');

        emitEmailDiscoveryUpdate(leadId, { status: 'completed', primaryEmail, emailCount: allEmails.length });

        return { discoveredEmails: allEmails, primaryEmail, emailCount: allEmails.length, success: true, method: 'homepage', durationMs };
      }

      const secondaryEmails = await this.extractEmailsFromPages(baseUrl, PRIORITY_PAGES);
      addUniqueEmails(secondaryEmails);

      if (allEmails.length > 0) {
        const primaryEmail = this.selectPrimaryEmail(allEmails);
        await this.updateLeadWithEmails(leadId, allEmails, primaryEmail, 'completed');
        await this.saveToCache(website, allEmails, primaryEmail);

        const durationMs = Date.now() - startTime;
        logger.info({
          leadId, website: baseUrl, emailsFound: allEmails.length, primaryEmail,
          method: 'secondary_pages', durationMs, cacheHit: false,
        }, 'EmailDiscovery: Completed (secondary pages)');

        emitEmailDiscoveryUpdate(leadId, { status: 'completed', primaryEmail, emailCount: allEmails.length });

        return { discoveredEmails: allEmails, primaryEmail, emailCount: allEmails.length, success: true, method: 'secondary_pages', durationMs };
      }

      if (axiosFailed) {
        const pwEmails = await this.extractEmailsWithPlaywright(baseUrl);
        addUniqueEmails(pwEmails);

        if (allEmails.length > 0) {
          const primaryEmail = this.selectPrimaryEmail(allEmails);
          await this.updateLeadWithEmails(leadId, allEmails, primaryEmail, 'completed');
          await this.saveToCache(website, allEmails, primaryEmail);

          const durationMs = Date.now() - startTime;
          logger.info({
            leadId, website: baseUrl, emailsFound: allEmails.length, primaryEmail,
            method: 'playwright_fallback', durationMs, cacheHit: false,
          }, 'EmailDiscovery: Completed (Playwright fallback)');

          emitEmailDiscoveryUpdate(leadId, { status: 'completed', primaryEmail, emailCount: allEmails.length });

          return { discoveredEmails: allEmails, primaryEmail, emailCount: allEmails.length, success: true, method: 'playwright_fallback', durationMs };
        }
      }

      await this.updateLeadWithEmails(leadId, [], '', 'completed');

      const durationMs = Date.now() - startTime;
      logger.info({
        leadId, website: baseUrl, emailsFound: 0, method: 'all_failed', durationMs, cacheHit: false,
      }, 'EmailDiscovery: Completed (no emails found)');

      emitEmailDiscoveryUpdate(leadId, { status: 'completed', primaryEmail: '', emailCount: 0 });

      return { discoveredEmails: [], primaryEmail: '', emailCount: 0, success: true, method: 'all_failed', durationMs };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await Lead.findByIdAndUpdate(leadId, {
        $set: {
          emailDiscoveryStatus: 'failed',
          emailDiscoveryError: message,
          lastEmailScan: new Date(),
        },
        $inc: { emailDiscoveryRetries: 1 },
      });

      const durationMs = Date.now() - startTime;
      logger.error({ leadId, website: baseUrl, err: message, durationMs }, 'EmailDiscovery: Failed');

      emitEmailDiscoveryUpdate(leadId, { status: 'failed', error: message });

      return { discoveredEmails: [], primaryEmail: '', emailCount: 0, success: false, error: message, durationMs };
    }
  }

  async discoverEmailsForLeadAsync(leadId: string): Promise<void> {
    emailDiscoveryQueue.enqueue(leadId, async () => {
      await this.discoverEmailsForLead(leadId);
    });
  }

  async backfillAllLeads(concurrency = 5): Promise<{ processed: number; succeeded: number; failed: number; skipped: number }> {
    const cursor = Lead.find({
      hasWebsite: true,
      website: { $exists: true, $nin: ['', null] },
      $or: [
        { emailDiscoveryStatus: { $in: ['pending', 'failed', null] } },
        { emailDiscoveryStatus: { $exists: false } },
        { lastEmailScan: null },
      ],
    }).cursor();

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    const active: Promise<void>[] = [];

    for await (const lead of cursor) {
      if (active.length >= concurrency) {
        await Promise.race(active);
      }

      const promise = (async () => {
        try {
          const result = await this.discoverEmailsForLead(lead._id.toString());
          if (result.success) {
            succeeded++;
          } else {
            if (result.error?.includes('no website') || result.error?.includes('Social/directory')) {
              skipped++;
            } else {
              failed++;
            }
          }
        } catch {
          failed++;
        }
        processed++;
      })();

      active.push(promise);
      promise.finally(() => {
        const idx = active.indexOf(promise);
        if (idx > -1) active.splice(idx, 1);
      });
    }

    await Promise.all(active);

    logger.info({ processed, succeeded, failed, skipped }, 'EmailDiscovery: Backfill completed');
    return { processed, succeeded, failed, skipped };
  }
}

export const businessEmailDiscoveryService = new BusinessEmailDiscoveryService();
