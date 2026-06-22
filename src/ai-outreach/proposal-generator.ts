import { LeadInput, GeneratedProposal } from './ai-outreach.types';
import { PersonalizationEngine, personalizationEngine } from './personalization-engine';

export class ProposalGenerator {
  protected personalization: PersonalizationEngine;

  constructor(personalization?: PersonalizationEngine) {
    this.personalization = personalization || personalizationEngine;
  }

  generateSEOProposal(lead: LeadInput): GeneratedProposal {
    const painPoints = this.personalization.getPrimaryPainPoints(lead);
    const services = this.personalization.getRecommendedServices(lead).filter(s =>
      s.toLowerCase().includes('seo') || s.toLowerCase().includes('optimization') || s.toLowerCase().includes('content')
    );
    if (services.length === 0) services.push('SEO Optimization', 'Local SEO', 'Technical SEO');

    const html = this.buildProposalHTML({
      lead,
      title: 'SEO Optimization Proposal',
      painPoints,
      services: services.length > 0 ? services : ['SEO Optimization', 'Local SEO', 'Technical SEO', 'Content Strategy'],
      improvements: [
        '50-200% increase in organic traffic',
        'Higher search engine rankings for relevant keywords',
        'Improved local search visibility',
        'Better user engagement metrics',
        'Increased lead generation from search',
      ],
      timeline: '4-8 weeks for initial results',
      investment: 'Starts at ₹15,000/month',
    });

    const summary = `Comprehensive SEO proposal for ${lead.companyName} addressing ${painPoints.length > 0 ? painPoints[0] : 'digital visibility'}.`;

    return {
      type: 'seo',
      title: `SEO Optimization Proposal - ${lead.companyName}`,
      html,
      summary,
      services: services.length > 0 ? services : ['SEO Optimization', 'Local SEO', 'Technical SEO', 'Content Strategy'],
      estimatedTimeline: '4-8 weeks',
      estimatedInvestment: '₹15,000 - ₹35,000/month',
    };
  }

  generateWebsiteRedesignProposal(lead: LeadInput): GeneratedProposal {
    const painPoints = this.personalization.getPrimaryPainPoints(lead);
    const services = ['Website Redesign', 'Responsive Development', 'UI/UX Improvement', 'Performance Optimization'];

    const html = this.buildProposalHTML({
      lead,
      title: 'Website Redesign Proposal',
      painPoints,
      services,
      improvements: [
        'Modern, mobile-responsive design',
        '50%+ improvement in page load speed',
        'Better user experience and engagement',
        'Higher conversion rates',
        'SEO-optimized architecture',
      ],
      timeline: '4-6 weeks for completion',
      investment: 'Starts at ₹25,000',
    });

    const summary = `Website redesign proposal for ${lead.companyName} focusing on modern responsive design and improved user experience.`;

    return {
      type: 'website-redesign',
      title: `Website Redesign Proposal - ${lead.companyName}`,
      html,
      summary,
      services,
      estimatedTimeline: '4-6 weeks',
      estimatedInvestment: '₹25,000 - ₹60,000',
    };
  }

  generateDigitalMarketingProposal(lead: LeadInput): GeneratedProposal {
    const painPoints = this.personalization.getPrimaryPainPoints(lead);
    const services = ['Social Media Management', 'Content Marketing', 'Google My Business Optimization', 'Paid Advertising'];

    const html = this.buildProposalHTML({
      lead,
      title: 'Digital Marketing Proposal',
      painPoints,
      services,
      improvements: [
        'Increased brand awareness and reach',
        'Higher engagement on social platforms',
        'More qualified leads from digital channels',
        'Better ROI on marketing spend',
        'Stronger online community presence',
      ],
      timeline: 'Ongoing monthly engagement',
      investment: 'Starts at ₹10,000/month',
    });

    const summary = `Digital marketing proposal for ${lead.companyName} to expand online reach and generate more leads.`;

    return {
      type: 'digital-marketing',
      title: `Digital Marketing Proposal - ${lead.companyName}`,
      html,
      summary,
      services,
      estimatedTimeline: 'Monthly engagement',
      estimatedInvestment: '₹10,000 - ₹25,000/month',
    };
  }

  generatePerformanceProposal(lead: LeadInput): GeneratedProposal {
    const painPoints = this.personalization.getPrimaryPainPoints(lead);
    const services = ['Performance Optimization', 'Speed Optimization', 'Mobile Optimization', 'Core Web Vitals'];

    const html = this.buildProposalHTML({
      lead,
      title: 'Performance Optimization Proposal',
      painPoints,
      services,
      improvements: [
        '30-60% improvement in page load speed',
        'Better Core Web Vitals scores',
        'Improved mobile experience',
        'Higher search engine rankings',
        'Better user retention and conversions',
      ],
      timeline: '2-3 weeks for implementation',
      investment: 'Starts at ₹12,000',
    });

    const summary = `Performance optimization proposal for ${lead.companyName} to improve website speed and user experience.`;

    return {
      type: 'performance',
      title: `Performance Optimization Proposal - ${lead.companyName}`,
      html,
      summary,
      services,
      estimatedTimeline: '2-3 weeks',
      estimatedInvestment: '₹12,000 - ₹25,000',
    };
  }

  generateAll(lead: LeadInput, types: string[]): GeneratedProposal[] {
    const proposals: GeneratedProposal[] = [];
    const typeSet = new Set(types);
    if (typeSet.size === 0 || typeSet.has('seo')) proposals.push(this.generateSEOProposal(lead));
    if (typeSet.size === 0 || typeSet.has('website-redesign')) proposals.push(this.generateWebsiteRedesignProposal(lead));
    if (typeSet.size === 0 || typeSet.has('digital-marketing')) proposals.push(this.generateDigitalMarketingProposal(lead));
    if (typeSet.size === 0 || typeSet.has('performance')) proposals.push(this.generatePerformanceProposal(lead));
    return proposals;
  }

  protected buildProposalHTML(data: {
    lead: LeadInput;
    title: string;
    painPoints: string[];
    services: string[];
    improvements: string[];
    timeline: string;
    investment: string;
  }): string {
    const { lead, title, painPoints, services, improvements, timeline, investment } = data;
    const maturity = this.personalization.getDigitalMaturity(lead);

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 0; }
  .container { max-width: 800px; margin: 0 auto; padding: 40px 30px; }
  .header { text-align: center; padding: 30px 0; border-bottom: 3px solid #1D4ED8; margin-bottom: 30px; }
  .header h1 { color: #1D4ED8; margin: 0 0 5px; font-size: 28px; }
  .header p { color: #666; margin: 0; font-size: 14px; }
  .header .logo { font-size: 24px; font-weight: bold; color: #1D4ED8; margin-bottom: 10px; }
  .section { margin-bottom: 25px; }
  .section h2 { color: #1D4ED8; font-size: 18px; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 15px; }
  .section h3 { color: #444; font-size: 15px; margin-bottom: 10px; }
  .pain-points { background: #FEF2F2; padding: 15px 20px; border-radius: 8px; margin-bottom: 20px; }
  .pain-points li { color: #DC2626; margin-bottom: 5px; }
  .services { display: flex; flex-wrap: wrap; gap: 10px; margin: 15px 0; }
  .service-tag { background: #EFF6FF; color: #1D4ED8; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 500; }
  .improvements { background: #F0FDF4; padding: 15px 20px; border-radius: 8px; margin-bottom: 20px; }
  .improvements li { color: #16A34A; margin-bottom: 5px; }
  .details { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
  .detail-card { background: #F8FAFC; padding: 15px; border-radius: 8px; border: 1px solid #E2E8F0; }
  .detail-card .label { font-size: 11px; text-transform: uppercase; color: #94A3B8; font-weight: 600; letter-spacing: 0.05em; }
  .detail-card .value { font-size: 16px; font-weight: 600; color: #1E293B; margin-top: 4px; }
  .cta { text-align: center; padding: 25px; background: #1D4ED8; color: white; border-radius: 8px; margin: 25px 0; }
  .cta h3 { color: white; margin: 0 0 8px; }
  .cta p { margin: 0; font-size: 14px; opacity: 0.9; }
  .footer { text-align: center; padding: 20px; color: #94A3B8; font-size: 12px; border-top: 1px solid #E2E8F0; margin-top: 30px; }
  .company-info { margin-bottom: 20px; }
  .company-info p { margin: 3px 0; font-size: 13px; color: #555; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">LeadFinder Pro</div>
    <h1>${title}</h1>
    <p>Prepared for ${lead.companyName}</p>
  </div>

  <div class="company-info">
    <p><strong>Company:</strong> ${lead.companyName}</p>
    ${lead.category ? `<p><strong>Category:</strong> ${lead.category}</p>` : ''}
    ${lead.address ? `<p><strong>Location:</strong> ${lead.address}</p>` : ''}
    <p><strong>Digital Maturity:</strong> ${maturity.charAt(0).toUpperCase() + maturity.slice(1)}</p>
    ${lead.rating ? `<p><strong>Rating:</strong> ${lead.rating}/5 (${lead.reviewsCount || 0} reviews)</p>` : ''}
  </div>

  <div class="section">
    <h2>Business Analysis</h2>
    ${lead.aiSummary ? `<p>${lead.aiSummary}</p>` : ''}
    ${lead.aiInsight?.summary ? `<p>${lead.aiInsight.summary}</p>` : ''}
    ${!lead.aiSummary && !lead.aiInsight?.summary ? `<p>${lead.companyName} is a ${lead.category || 'business'} located in ${lead.address || 'your service area'}. Based on our comprehensive digital analysis, we have identified several opportunities to enhance your online presence and business growth.</p>` : ''}
  </div>

  <div class="section">
    <h2>Detected Issues & Opportunities</h2>
    <div class="pain-points">
      <ul>
        ${painPoints.map(p => `<li>${p.charAt(0).toUpperCase() + p.slice(1)}</li>`).join('')}
      </ul>
    </div>
  </div>

  <div class="section">
    <h2>Recommended Services</h2>
    <div class="services">
      ${services.map(s => `<span class="service-tag">${s}</span>`).join('')}
    </div>
  </div>

  <div class="section">
    <h2>Expected Improvements</h2>
    <div class="improvements">
      <ul>
        ${improvements.map(i => `<li>${i}</li>`).join('')}
      </ul>
    </div>
  </div>

  <div class="details">
    <div class="detail-card">
      <div class="label">Timeline</div>
      <div class="value">${timeline}</div>
    </div>
    <div class="detail-card">
      <div class="label">Investment</div>
      <div class="value">${investment}</div>
    </div>
  </div>

  <div class="cta">
    <h3>Ready to Get Started?</h3>
    <p>Contact us today for a free consultation and detailed proposal.</p>
  </div>

  <div class="footer">
    <p><strong>LeadFinder Pro</strong> — AI-Powered Digital Growth Solutions</p>
    <p>This proposal is confidential and prepared specifically for ${lead.companyName}.</p>
  </div>
</div>
</body>
</html>`;
  }
}

export const proposalGenerator = new ProposalGenerator();
