import { Page } from 'playwright';
import { logger } from '../../../utils/logger';
import type { IndiaMartEnrichedLead } from './indiamart.types';
import { parseProfilePage } from './indiamart.parser';

const PROFILE_TIMEOUT = 25000;
const MAX_RETRIES = 2;

export async function crawlProfile(
  page: Page,
  profileUrl: string,
  companyName: string
): Promise<IndiaMartEnrichedLead | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info({
        url: profileUrl,
        company: companyName,
        attempt: attempt + 1,
      }, 'IndiaMartProfile: Crawling');

      await page.goto(profileUrl, {
        waitUntil: 'domcontentloaded',
        timeout: PROFILE_TIMEOUT,
      });

      await page.waitForTimeout(2000);

      await page.evaluate(() => {
        const scrollable = document.querySelector(
          '.profile-content, .seller-detail, .company-profile, main, [role="main"], body'
        );
        if (scrollable) {
          scrollable.scrollTop = scrollable.scrollHeight;
        }
        window.scrollBy(0, 500);
      });

      await page.waitForTimeout(1500);

      const html = await page.content();
      const rawLead = parseProfilePage(html, profileUrl);

      if (!rawLead.companyName) {
        rawLead.companyName = companyName;
      }

      const enriched: IndiaMartEnrichedLead = {
        companyName: rawLead.companyName || companyName,
        phone: rawLead.phone,
        secondaryPhone: rawLead.secondaryPhone,
        email: rawLead.email,
        website: rawLead.website,
        address: rawLead.address,
        city: rawLead.city,
        state: rawLead.state,
        pincode: rawLead.pincode,
        gst: rawLead.gst,
        ownerName: rawLead.ownerName,
        category: rawLead.category,
        products: rawLead.products || [],
        services: rawLead.services || [],
        rating: rawLead.rating,
        reviewsCount: rawLead.reviewsCount,
        yearOfEstablishment: rawLead.yearOfEstablishment,
        employeeCount: rawLead.employeeCount,
        profileUrl,
        sourceUrl: profileUrl,
        socialLinks: rawLead.socialLinks || {},
        images: rawLead.images,
        latitude: rawLead.latitude,
        longitude: rawLead.longitude,
      };

      logger.info({
        company: enriched.companyName,
        hasPhone: !!enriched.phone,
        hasWebsite: !!enriched.website,
        hasEmail: !!enriched.email,
        hasGst: !!enriched.gst,
        hasAddress: !!enriched.address,
      }, 'IndiaMartProfile: Extracted');

      return enriched;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({
        err: msg,
        url: profileUrl,
        company: companyName,
        attempt: attempt + 1,
      }, 'IndiaMartProfile: Crawl failed');

      if (attempt < MAX_RETRIES) {
        await page.waitForTimeout(2000 * (attempt + 1));
      }
    }
  }

  logger.warn({
    url: profileUrl,
    company: companyName,
  }, 'IndiaMartProfile: All retries exhausted');

  return null;
}
