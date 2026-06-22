export interface CrawlAnalytics {
  totalCrawled: number;
  validLeads: number;
  duplicates: number;
  failedParses: number;
  verifiedPhones: number;
  verifiedEmails: number;
  websiteLeads: number;
  socialOnlyLeads: number;
  mapsOnlyLeads: number;
  averageCrawlSpeed: number;
  successRatio: number;
}

const SOURCE_CONFIDENCE: Record<string, number> = {
  'google-maps': 85,
  'googlemaps': 85,
  'justdial': 70,
  'indiamart': 65,
  'clutch': 75,
  'manual': 95,
  'linkedin': 80,
  'directory': 60,
  'website': 90,
  'api': 85,
};

export function getSourceConfidence(source: string): number {
  const key = source.toLowerCase().trim();
  return SOURCE_CONFIDENCE[key] ?? 50;
}

export function getSourceReliability(source: string): 'high' | 'medium' | 'low' {
  const score = getSourceConfidence(source);
  if (score >= 80) return 'high';
  if (score >= 65) return 'medium';
  return 'low';
}

export function getSourceColor(source: string): string {
  const score = getSourceConfidence(source);
  if (score >= 80) return 'bg-green-100 text-green-800';
  if (score >= 65) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

export function getSourceLabel(source: string): string {
  switch (source.toLowerCase()) {
    case 'google-maps':
    case 'googlemaps': return 'Google Maps';
    case 'justdial': return 'JustDial';
    case 'indiamart': return 'IndiaMart';
    case 'clutch': return 'Clutch';
    case 'manual': return 'Manual Entry';
    case 'linkedin': return 'LinkedIn';
    case 'directory': return 'Directory';
    case 'website': return 'Website';
    default: return source;
  }
}

export class CrawlingAnalyticsTracker {
  private metrics: CrawlAnalytics;
  private startTime: number;
  private lastLogTime: number;

  constructor() {
    this.metrics = this.resetMetrics();
    this.startTime = Date.now();
    this.lastLogTime = Date.now();
  }

  private resetMetrics(): CrawlAnalytics {
    return {
      totalCrawled: 0,
      validLeads: 0,
      duplicates: 0,
      failedParses: 0,
      verifiedPhones: 0,
      verifiedEmails: 0,
      websiteLeads: 0,
      socialOnlyLeads: 0,
      mapsOnlyLeads: 0,
      averageCrawlSpeed: 0,
      successRatio: 0,
    };
  }

  increment(metric: keyof CrawlAnalytics, count: number = 1): void {
    if (metric in this.metrics) {
      (this.metrics[metric] as number) += count;
    }
  }

  getMetrics(): CrawlAnalytics {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const total = this.metrics.validLeads + this.metrics.duplicates + this.metrics.failedParses;
    this.metrics.successRatio = total > 0 ? Math.round((this.metrics.validLeads / total) * 100) : 0;
    this.metrics.averageCrawlSpeed = elapsed > 0 ? Math.round(this.metrics.totalCrawled / elapsed) : 0;
    return { ...this.metrics };
  }

  logProgress(): void {
    const elapsed = ((Date.now() - this.lastLogTime) / 1000).toFixed(1);
    const m = this.metrics;
    console.log('');
    console.log(`[Analytics] Progress (${elapsed}s):`);
    console.log(`  Crawled: ${m.totalCrawled} | Valid: ${m.validLeads} | Dupes: ${m.duplicates} | Failed: ${m.failedParses}`);
    console.log(`  Phones: ${m.verifiedPhones} | Emails: ${m.verifiedEmails} | Websites: ${m.websiteLeads}`);
    this.lastLogTime = Date.now();
  }

  logFinal(): void {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const m = this.getMetrics();
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('       CRAWLING ANALYTICS REPORT');
    console.log('═══════════════════════════════════════');
    console.log(`  Duration         : ${elapsed}s`);
    console.log(`  Total Crawled    : ${m.totalCrawled}`);
    console.log(`  Valid Leads      : ${m.validLeads}`);
    console.log(`  Duplicates       : ${m.duplicates}`);
    console.log(`  Failed Parses    : ${m.failedParses}`);
    console.log(`  Success Ratio    : ${m.successRatio}%`);
    console.log(`  Verified Phones  : ${m.verifiedPhones}`);
    console.log(`  Verified Emails  : ${m.verifiedEmails}`);
    console.log(`  Website Leads    : ${m.websiteLeads}`);
    console.log(`  Social Only      : ${m.socialOnlyLeads}`);
    console.log(`  Maps Only        : ${m.mapsOnlyLeads}`);
    console.log(`  Avg Speed        : ${m.averageCrawlSpeed}/s`);
    console.log('═══════════════════════════════════════');
    console.log('');
  }
}
