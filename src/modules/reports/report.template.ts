import type { AuditSummary } from './report.types';

function scoreColor(score: number | null): string {
  if (score === null || score === undefined) return '#9CA3AF';
  if (score >= 80) return '#059669';
  if (score >= 50) return '#D97706';
  return '#DC2626';
}

function scoreLabel(score: number | null): string {
  if (score === null || score === undefined) return 'N/A';
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Average';
  if (score >= 30) return 'Poor';
  return 'Critical';
}

function statusIcon(passed: boolean | null | undefined): string {
  if (passed === null || passed === undefined) return '–';
  return passed ? '✓' : '✗';
}

function statusClass(passed: boolean | null | undefined): string {
  if (passed === null || passed === undefined) return 'st-neutral';
  return passed ? 'st-pass' : 'st-fail';
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildReportHtml(summary: AuditSummary): string {
  const mainScore = summary.responsiveAudit.score ?? summary.leadScore;
  const oppScore = summary.businessIntelligence.opportunityScore ?? summary.leadScore;
  const isStandalone = summary.websiteType === 'standalone';
  const generatedDate = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const reportId = `OMS-${Date.now().toString(36).toUpperCase()}`;

  const socialPlatformBadges = summary.socialPlatforms.map(p =>
    `<span class="badge">${escapeHtml(p)}</span>`
  ).join('');

  const websiteTypeMeta = (() => {
    if (isStandalone) return { label: 'Standalone Website', cls: 'tag-green' };
    if (summary.websiteType === 'social_only') return { label: 'Social Media Only', cls: 'tag-amber' };
    if (summary.websiteType === 'directory_profile') return { label: 'Directory Profile', cls: 'tag-amber' };
    return { label: 'No Website Found', cls: 'tag-red' };
  })();

  const scoreBar = (label: string, score: number | null, icon: string = '') => {
    const s = score ?? 0;
    const color = scoreColor(score);
    return `
      <div class="sb-row">
        <div class="sb-label">
          ${icon ? `<span class="sb-icon">${icon}</span>` : ''}
          <span>${escapeHtml(label)}</span>
        </div>
        <div class="sb-right">
          <div class="sb-track">
            <div class="sb-fill" style="width:${Math.min(s, 100)}%;background:${color};"></div>
          </div>
          <span class="sb-val" style="color:${color};">${s}</span>
        </div>
      </div>
    `;
  };

  const statusRow = (label: string, passed: boolean | null | undefined, note?: string) => `
    <div class="ch-row">
      <span class="ch-icon ${statusClass(passed)}">${statusIcon(passed)}</span>
      <span class="ch-label">${escapeHtml(label)}</span>
      ${note ? `<span class="ch-note">${escapeHtml(note)}</span>` : ''}
    </div>
  `;

  const socialSection = summary.socialOnlyAnalysis ? `
    <div class="sec">
      <div class="sec-h">Social Media Analysis</div>
      <div class="alert-amber">
        <div class="alert-title">Social Media / Directory Profile Detected</div>
        <div class="alert-body">${escapeHtml(summary.socialOnlyAnalysis.missingWebsiteOpportunity)}</div>
      </div>
      <div class="grid-2">
        <div class="crd">
          <div class="crd-lbl">Active Platforms</div>
          <div class="badge-row">${socialPlatformBadges || '<span class="dim">No social profiles detected</span>'}</div>
          <div class="grid-2" style="margin-top:14px;gap:20px;">
            <div>
              <div class="crd-lbl">Branding Potential</div>
              <p class="body">${escapeHtml(summary.socialOnlyAnalysis.brandingPotential)}</p>
            </div>
            <div>
              <div class="crd-lbl">Credibility Impact</div>
              <p class="body">${escapeHtml(summary.socialOnlyAnalysis.credibilityImpact)}</p>
            </div>
          </div>
        </div>
      </div>
      <div class="grid-2">
        <div class="crd">
          <div class="crd-lbl" style="color:#991B1B;">Conversion Limitations</div>
          <ul class="lst lst-red">
            ${summary.socialOnlyAnalysis.conversionLimitations.map(l => `<li>${escapeHtml(l)}</li>`).join('')}
          </ul>
        </div>
        <div class="crd">
          <div class="crd-lbl" style="color:#065F46;">Recommendation</div>
          <p class="body">${escapeHtml(summary.socialOnlyAnalysis.recommendation)}</p>
        </div>
      </div>
    </div>
  ` : '';

  const responsiveSection = isStandalone ? `
    <div class="sec">
      <div class="sec-h">Responsive & UI/UX Audit</div>
      <div class="grid-4">
        <div class="sc-crd">
          <div class="sc-val" style="color:${scoreColor(summary.responsiveAudit.score)};">${summary.responsiveAudit.score ?? 'N/A'}</div>
          <div class="sc-lbl">Responsive</div>
          <div class="sc-sub" style="color:${scoreColor(summary.responsiveAudit.score)};">${scoreLabel(summary.responsiveAudit.score)}</div>
        </div>
        <div class="sc-crd">
          <div class="sc-val" style="color:${scoreColor(summary.responsiveAudit.uiuxScore)};">${summary.responsiveAudit.uiuxScore ?? 'N/A'}</div>
          <div class="sc-lbl">UI / UX</div>
          <div class="sc-sub" style="color:${scoreColor(summary.responsiveAudit.uiuxScore)};">${scoreLabel(summary.responsiveAudit.uiuxScore)}</div>
        </div>
        <div class="sc-crd">
          <div class="sc-val" style="color:${scoreColor(summary.responsiveAudit.mobileScore)};">${summary.responsiveAudit.mobileScore ?? 'N/A'}</div>
          <div class="sc-lbl">Mobile</div>
          <div class="sc-sub" style="color:${scoreColor(summary.responsiveAudit.mobileScore)};">${scoreLabel(summary.responsiveAudit.mobileScore)}</div>
        </div>
        <div class="sc-crd">
          <div class="sc-val" style="color:${scoreColor(mainScore)};">${mainScore ?? 'N/A'}</div>
          <div class="sc-lbl">Overall</div>
          <div class="sc-sub" style="color:${scoreColor(mainScore)};">${scoreLabel(mainScore)}</div>
        </div>
      </div>
      <div class="grid-2">
        <div class="crd">
          <div class="crd-lbl">Responsive Checks</div>
          <div class="ch-grid-2">
            ${statusRow('Mobile Friendly', summary.responsiveAudit.mobileFriendly)}
            ${statusRow('Responsive Layout', summary.responsiveAudit.responsiveLayout)}
            ${statusRow('Viewport Meta', summary.responsiveAudit.viewportMeta)}
            ${statusRow('Touch Friendly', summary.responsiveAudit.touchFriendly)}
            ${statusRow('Font Readability', summary.responsiveAudit.fontSizeIssues !== null ? !summary.responsiveAudit.fontSizeIssues : null)}
            ${statusRow('No Horizontal Scroll', summary.responsiveAudit.horizontalScroll !== null ? !summary.responsiveAudit.horizontalScroll : null)}
            ${statusRow('No Overflow', summary.responsiveAudit.overflowIssues !== null ? !summary.responsiveAudit.overflowIssues : null)}
          </div>
        </div>
        ${summary.responsiveAudit.issues.length > 0 ? `
        <div class="crd">
          <div class="crd-lbl">UI/UX Issues <span class="count">${summary.responsiveAudit.issues.length}</span></div>
          ${summary.responsiveAudit.issues.slice(0, 15).map(issue => `
            <div class="iss sev-${issue.severity}">
              <div class="iss-d">${escapeHtml(issue.description)}</div>
              ${issue.type ? `<div class="iss-t">${escapeHtml(issue.type)}</div>` : ''}
            </div>
          `).join('')}
        </div>` : ''}
      </div>
    </div>

    <div class="sec">
      <div class="sec-h">SEO Intelligence</div>
      <div class="grid-2">
        <div class="crd">
          <div class="crd-lbl">Meta Title</div>
          <div class="seo-val">${escapeHtml(summary.seoAudit.metaTitle) || '<span class="dim">Not detected</span>'}</div>
        </div>
        <div class="crd">
          <div class="crd-lbl">Meta Description</div>
          <div class="seo-val">${escapeHtml(summary.seoAudit.metaDescription) || '<span class="dim">Not detected</span>'}</div>
        </div>
        <div class="crd">
          <div class="crd-lbl">SSL / HTTPS</div>
          <div class="seo-val">
            <span class="${summary.seoAudit.sslEnabled ? 'st-pass' : 'st-fail'}">${statusIcon(summary.seoAudit.sslEnabled)}</span>
            ${summary.seoAudit.sslEnabled ? 'Secure' : 'Not Secure'}
          </div>
        </div>
        <div class="crd">
          <div class="crd-lbl">Response Time</div>
          <div class="seo-val">${summary.seoAudit.responseTime !== null ? `<strong>${summary.seoAudit.responseTime}ms</strong>` : '<span class="dim">Not measured</span>'}</div>
        </div>
        <div class="crd">
          <div class="crd-lbl">Contact Page</div>
          <div class="seo-val">
            <span class="${summary.seoAudit.hasContactPage ? 'st-pass' : 'st-fail'}">${statusIcon(summary.seoAudit.hasContactPage)}</span>
            ${summary.seoAudit.hasContactPage ? 'Found' : 'Not found'}
          </div>
        </div>
      </div>
    </div>

    <div class="sec">
      <div class="sec-h">Performance Overview</div>
      <div class="crd">
        ${scoreBar('Responsive Score', summary.responsiveAudit.score, '📱')}
        ${scoreBar('UI / UX Quality', summary.responsiveAudit.uiuxScore, '🎨')}
        ${scoreBar('Mobile Experience', summary.responsiveAudit.mobileScore, '📲')}
        ${scoreBar('Lead Score', summary.leadScore, '🎯')}
      </div>
    </div>
  ` : '';

  const biSection = `
    <div class="sec">
      <div class="sec-h">Business Intelligence</div>
      <div class="grid-4">
        <div class="sc-crd">
          <div class="sc-val" style="color:${scoreColor(summary.businessIntelligence.trustScore)};">${summary.businessIntelligence.trustScore ?? 'N/A'}</div>
          <div class="sc-lbl">Trust</div>
          <div class="sc-sub" style="color:${scoreColor(summary.businessIntelligence.trustScore)};">${scoreLabel(summary.businessIntelligence.trustScore)}</div>
        </div>
        <div class="sc-crd">
          <div class="sc-val" style="color:${scoreColor(summary.businessIntelligence.websiteQualityScore)};">${summary.businessIntelligence.websiteQualityScore ?? 'N/A'}</div>
          <div class="sc-lbl">Quality</div>
          <div class="sc-sub" style="color:${scoreColor(summary.businessIntelligence.websiteQualityScore)};">${scoreLabel(summary.businessIntelligence.websiteQualityScore)}</div>
        </div>
        <div class="sc-crd">
          <div class="sc-val" style="color:${scoreColor(oppScore)};">${oppScore ?? 'N/A'}</div>
          <div class="sc-lbl">Opportunity</div>
          <div class="sc-sub" style="color:${scoreColor(oppScore)};">${scoreLabel(oppScore)}</div>
        </div>
        <div class="sc-crd">
          <div class="sc-val" style="color:${scoreColor(summary.businessIntelligence.socialPresenceScore)};">${summary.businessIntelligence.socialPresenceScore ?? 'N/A'}</div>
          <div class="sc-lbl">Social</div>
          <div class="sc-sub" style="color:${scoreColor(summary.businessIntelligence.socialPresenceScore)};">${scoreLabel(summary.businessIntelligence.socialPresenceScore)}</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="crd">
          <div class="crd-lbl">Opportunity Assessment</div>
          ${summary.businessIntelligence.opportunityLevel ? `<div class="tag tag-${summary.businessIntelligence.opportunityLevel}" style="margin-bottom:10px;">${escapeHtml(summary.businessIntelligence.opportunityLevel).toUpperCase()}</div>` : ''}
          ${summary.businessIntelligence.opportunityRecommendation ? `<p class="body">${escapeHtml(summary.businessIntelligence.opportunityRecommendation)}</p>` : ''}
          ${summary.businessIntelligence.opportunityReasons.length > 0 ? `
            <div class="crd-lbl" style="margin-top:12px;">Key Reasons</div>
            <ul class="lst lst-blue">
              ${summary.businessIntelligence.opportunityReasons.slice(0, 6).map(r => `<li>${escapeHtml(r)}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
        <div class="crd">
          <div class="crd-lbl">Digital Potential</div>
          <div class="pot-list">
            <div class="pot-row"><span class="pot-lbl">Redesign</span><span class="pot-val">${escapeHtml(summary.businessIntelligence.redesignPotential) || '—'}</span></div>
            <div class="pot-row"><span class="pot-lbl">SEO</span><span class="pot-val">${escapeHtml(summary.businessIntelligence.seoOpportunity) || '—'}</span></div>
            <div class="pot-row"><span class="pot-lbl">Digital Marketing</span><span class="pot-val">${escapeHtml(summary.businessIntelligence.digitalMarketingOpportunity) || '—'}</span></div>
            ${summary.businessIntelligence.conversionProbability ? `<div class="pot-row"><span class="pot-lbl">Conversion</span><span class="pot-val">${escapeHtml(summary.businessIntelligence.conversionProbability)}</span></div>` : ''}
            ${summary.businessIntelligence.revenuePotential ? `<div class="pot-row"><span class="pot-lbl">Revenue Potential</span><span class="pot-val">${escapeHtml(summary.businessIntelligence.revenuePotential)}</span></div>` : ''}
          </div>
        </div>
      </div>

      ${summary.businessIntelligence.aiSummary ? `
      <div class="crd ai-crd">
        <div class="crd-lbl">AI Analysis</div>
        <p class="body">${escapeHtml(summary.businessIntelligence.aiSummary)}</p>
        <div class="grid-2" style="margin-top:12px;">
          ${summary.businessIntelligence.aiWeaknesses.length > 0 ? `
          <div>
            <div class="crd-lbl" style="color:#DC2626;">Key Weaknesses</div>
            <ul class="lst lst-red">
              ${summary.businessIntelligence.aiWeaknesses.slice(0, 5).map(w => `<li>${escapeHtml(w)}</li>`).join('')}
            </ul>
          </div>` : ''}
          ${summary.businessIntelligence.aiOpportunities.length > 0 ? `
          <div>
            <div class="crd-lbl" style="color:#059669;">Growth Opportunities</div>
            <ul class="lst lst-green">
              ${summary.businessIntelligence.aiOpportunities.slice(0, 5).map(o => `<li>${escapeHtml(o)}</li>`).join('')}
            </ul>
          </div>` : ''}
        </div>
      </div>` : ''}

      ${isStandalone ? `
      <div class="grid-2">
        <div class="crd">
          <div class="crd-lbl">Social Presence</div>
          <div class="ch-grid-2">
            ${statusRow('Instagram', summary.businessIntelligence.socialAudit.instagram)}
            ${statusRow('Facebook', summary.businessIntelligence.socialAudit.facebook)}
            ${statusRow('LinkedIn', summary.businessIntelligence.socialAudit.linkedin)}
            ${statusRow('YouTube', summary.businessIntelligence.socialAudit.youtube)}
            ${statusRow('WhatsApp', summary.businessIntelligence.socialAudit.whatsapp)}
          </div>
          ${summary.businessIntelligence.socialPresenceScore !== null ? `<div class="hr"></div><div class="pot-row"><span class="pot-lbl">Social Score</span><span class="pot-val" style="color:${scoreColor(summary.businessIntelligence.socialPresenceScore)};font-weight:700;">${summary.businessIntelligence.socialPresenceScore}/100</span></div>` : ''}
        </div>
        <div class="crd">
          <div class="crd-lbl">Contact Audit</div>
          <div class="ch-grid-2">
            ${statusRow('Phone Detected', summary.businessIntelligence.contactAudit.phoneDetected)}
            ${statusRow('Email Detected', summary.businessIntelligence.contactAudit.emailDetected)}
            ${statusRow('Contact Form', summary.businessIntelligence.contactAudit.contactForm)}
          </div>
          <div class="hr"></div>
          <div class="pot-row"><span class="pot-lbl">Contact Methods</span><span class="pot-val">${summary.businessIntelligence.contactAudit.contactMethods}</span></div>
          ${summary.businessIntelligence.freshness.status ? `
            <div class="hr"></div>
            <div class="crd-lbl" style="margin-bottom:4px;">Website Freshness</div>
            <div class="pot-row"><span class="pot-lbl">Status</span><span class="pot-val"><strong>${escapeHtml(summary.businessIntelligence.freshness.status)}</strong></span></div>
            ${summary.businessIntelligence.freshness.copyrightYear ? `<div class="pot-row"><span class="pot-lbl">Copyright Year</span><span class="pot-val">${summary.businessIntelligence.freshness.copyrightYear}</span></div>` : ''}
          ` : ''}
        </div>
      </div>` : ''}

      <div class="crd reco-crd">
        <div class="grid-2" style="align-items:start;">
          <div>
            <div class="crd-lbl">AI Recommendation</div>
            <p class="body" style="color:#1E3A5F;">${escapeHtml(summary.businessIntelligence.aiRecommendation)}</p>
          </div>
        </div>
      </div>
    </div>
  `;

  const outreachSection = `
    <div class="sec">
      <div class="sec-h">Outreach Suggestions</div>
      <div class="grid-2">
        <div class="crd">
          <div class="crd-lbl">Cold Email Draft</div>
          ${summary.outreach.sampleEmail ? `
            <div class="out-box">
              ${escapeHtml(summary.outreach.sampleEmail).substring(0, 600)}${(summary.outreach.sampleEmail || '').length > 600 ? '...' : ''}
            </div>
          ` : `<p class="dim">Generate outreach content to view email suggestions.</p>`}
          ${summary.outreach.probability ? `<div class="hr"></div><div class="pot-row"><span class="pot-lbl">Outreach Probability</span><span class="pot-val"><strong>${escapeHtml(summary.outreach.probability)}</strong></span></div>` : ''}
        </div>
        <div class="crd">
          <div class="crd-lbl">WhatsApp Message</div>
          ${summary.outreach.sampleWhatsApp ? `
            <div class="out-box wa-box">
              ${escapeHtml(summary.outreach.sampleWhatsApp).substring(0, 600)}${(summary.outreach.sampleWhatsApp || '').length > 600 ? '...' : ''}
            </div>
          ` : `<p class="dim">Generate outreach content to view WhatsApp message suggestions.</p>`}
        </div>
      </div>
      <div class="crd">
        <div class="crd-lbl">Suggested Pitch Angles</div>
        <div class="pch-list">
          ${!isStandalone ? `
            <div class="pch-item"><div class="pch-tag">Website Dev</div><div class="pch-txt">Pitch building a professional website to establish credibility and capture leads directly without platform dependency.</div></div>
            <div class="pch-item"><div class="pch-tag">Digital Presence</div><div class="pch-txt">Offer comprehensive digital presence solutions including local SEO and brand identity.</div></div>
          ` : ''}
          ${summary.businessIntelligence.redesignPotential?.includes('High') ? `<div class="pch-item"><div class="pch-tag">Redesign</div><div class="pch-txt">Their website needs a modern redesign — pitch a conversion-focused redesign that reflects their brand.</div></div>` : ''}
          ${summary.businessIntelligence.seoOpportunity?.includes('High') || summary.businessIntelligence.seoOpportunity?.includes('Medium') ? `<div class="pch-item"><div class="pch-tag">SEO Services</div><div class="pch-txt">Strong opportunity for organic growth through SEO optimization and keyword strategy.</div></div>` : ''}
          ${summary.businessIntelligence.digitalMarketingOpportunity?.includes('High') ? `<div class="pch-item"><div class="pch-tag">Digital Marketing</div><div class="pch-txt">This business is primed for a comprehensive digital marketing strategy — paid + organic.</div></div>` : ''}
          <div class="pch-item"><div class="pch-tag">Local SEO</div><div class="pch-txt">Help them dominate local search results with hyper-targeted local SEO campaigns.</div></div>
          <div class="pch-item"><div class="pch-tag">Lead Generation</div><div class="pch-txt">Offer industry-specific lead generation services to bring qualified prospects to their doorstep.</div></div>
        </div>
      </div>
    </div>
  `;

  const aiRecoSection = `
    <div class="sec">
      <div class="sec-h">AI Recommendations</div>
      <div class="grid-2">
        <div class="reco reco-red">
          <div class="reco-title">What's Missing</div>
          <p class="body">
            ${!isStandalone
              ? 'This business is missing a standalone website — the single most critical digital asset for establishing credibility, capturing organic traffic, and controlling brand perception.'
              : summary.businessIntelligence.aiWeaknesses.length > 0
                ? summary.businessIntelligence.aiWeaknesses.slice(0, 2).join('. ') + '.'
                : 'The website has reasonable digital presence but there are clear opportunities for improvement across multiple dimensions.'
            }
          </p>
        </div>
        <div class="reco reco-amber">
          <div class="reco-title">Why Improvement is Urgent</div>
          <p class="body">
            ${!isStandalone
              ? 'Businesses without a standalone website miss up to 70% of potential customers searching online. A professional website builds trust, showcases services, and provides a hub for all digital marketing.'
              : summary.responsiveAudit.mobileFriendly === false
                ? 'With over 60% of web traffic coming from mobile devices, a non-mobile-friendly website is actively driving away potential customers every day.'
                : 'Regular improvements to design, performance, and SEO are necessary to stay competitive in today\'s digital-first landscape.'
            }
          </p>
        </div>
        <div class="reco reco-green">
          <div class="reco-title">How Conversions Will Improve</div>
          <ul class="lst lst-green" style="margin-top:6px;">
            ${!isStandalone ? `
              <li>A dedicated website with clear CTAs can increase conversion rates by 3–5× vs social media alone</li>
              <li>Capture leads directly without relying on platform algorithms</li>
              <li>Build email lists and retargeting audiences for sustained growth</li>
            ` : `
              <li>Improve page load speed to reduce bounce rates significantly</li>
              <li>Add clear calls-to-action above the fold on every page</li>
              <li>Optimise mobile experience for on-the-go conversions</li>
            `}
            <li>Implement live chat or chatbot for instant customer engagement</li>
            <li>Add social proof elements like testimonials and case studies</li>
          </ul>
        </div>
        ${isStandalone ? `
        <div class="reco reco-blue">
          <div class="reco-title">Why a Redesign is Needed</div>
          <p class="body">
            ${summary.businessIntelligence.websiteQualityScore !== null && summary.businessIntelligence.websiteQualityScore < 60
              ? 'The website quality score indicates significant room for improvement in design, usability, and UX. A modern redesign would enhance aesthetics, load times, and conversion rates simultaneously.'
              : summary.businessIntelligence.redesignPotential?.includes('High')
                ? 'The website has high redesign potential. A modern, professional redesign would significantly improve brand perception and user engagement metrics.'
                : 'While functional, refining the user experience and aligning with modern design standards will improve competitive positioning.'
            }
          </p>
        </div>
        <div class="reco reco-purple">
          <div class="reco-title">Why SEO is Essential</div>
          <p class="body">
            ${summary.businessIntelligence.seoOpportunity?.includes('High') || summary.businessIntelligence.seoOpportunity?.includes('Medium')
              ? 'Strong SEO opportunity identified. Proper optimisation can drive consistent organic traffic, reduce acquisition costs, and build long-term digital assets with compounding returns.'
              : 'SEO is essential for any business wanting to be found online. Even foundational SEO improvements lead to measurable increases in organic visibility and qualified leads.'
            }
          </p>
        </div>` : ''}
      </div>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Website Audit Report - ${escapeHtml(summary.companyName)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{
      font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      background:#F9FAFB;
      color:#111827;
      font-size:12px;
      line-height:1.6;
      -webkit-print-color-adjust:exact;
      print-color-adjust:exact;
    }
    .page{max-width:1280px;margin:0 auto;padding:32px 40px}

    .ah{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;margin-bottom:24px}
    .ah-l{display:flex;align-items:center;gap:10px}
    .ah-m{width:28px;height:28px;background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff}
    .ah-n{font-size:13px;font-weight:700;color:#0F172A}
    .ah-s{font-size:9px;color:#64748B}
    .ah-r{text-align:right}
    .ah-id{font-size:9px;font-weight:600;color:#4F46E5;letter-spacing:.06em;text-transform:uppercase}
    .ah-d{font-size:9px;color:#64748B;margin-top:1px}

    .hero{padding:32px 0 24px;border-bottom:1px solid #E5E7EB;margin-bottom:28px}
    .hero-t{font-size:9px;font-weight:600;color:#9CA3AF;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px}
    .hero-n{font-size:28px;font-weight:700;color:#0F172A;letter-spacing:-.03em;line-height:1.15;margin-bottom:6px}
    .hero-s{font-size:12px;color:#6B7280;margin-bottom:14px}
    .hero-m{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
    .hero-r{display:flex;gap:20px;margin-top:16px}
    .hero-sc{text-align:center}
    .hero-sc-v{font-size:22px;font-weight:700;line-height:1;letter-spacing:-.04em}
    .hero-sc-l{font-size:9px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:.08em;margin-top:4px}

    .tag{display:inline-block;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:600}
    .tag-green{background:#ECFDF5;color:#059669}
    .tag-amber{background:#FFFBEB;color:#D97706}
    .tag-red{background:#FEF2F2;color:#DC2626}
    .tag-high{background:#ECFDF5;color:#059669}
    .tag-medium{background:#FFFBEB;color:#D97706}
    .tag-low{background:#FEF2F2;color:#DC2626}

    .badge{display:inline-block;padding:2px 10px;border-radius:12px;background:#EFF6FF;color:#1D4ED8;font-size:10px;font-weight:500}
    .badge-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px}

    .sec{margin-bottom:28px}
    .sec-h{font-size:15px;font-weight:700;color:#0F172A;letter-spacing:-.01em;padding-bottom:10px;border-bottom:1px solid #E5E7EB;margin-bottom:18px}

    .crd{padding:16px 18px;margin-bottom:12px}
    .crd-lbl{font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
    .crd-hr{font-size:12px;font-weight:700;color:#0F172A;margin-bottom:12px}

    .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
    .grid-2>.crd,.grid-2>.reco{margin-bottom:0}
    .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}

    .sc-crd{text-align:center;padding:18px 10px 14px}
    .sc-val{font-size:26px;font-weight:700;letter-spacing:-.03em;line-height:1;margin-bottom:4px}
    .sc-lbl{font-size:10px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.07em}
    .sc-sub{font-size:10px;font-weight:600;margin-top:2px}

    .ch-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px}
    .ch-row{display:flex;align-items:center;gap:8px;padding:5px 0}
    .ch-icon{width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0}
    .st-pass{background:#ECFDF5;color:#059669}
    .st-fail{background:#FEF2F2;color:#DC2626}
    .st-neutral{background:#F3F4F6;color:#9CA3AF}
    .ch-label{font-size:11px;color:#374151}
    .ch-note{font-size:9px;color:#9CA3AF;display:block;margin-left:26px;margin-top:-2px}

    .sb-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
    .sb-label{font-size:11px;font-weight:500;color:#374151;display:flex;align-items:center;gap:6px;min-width:120px}
    .sb-icon{font-size:12px}
    .sb-right{flex:1;display:flex;align-items:center;gap:8px}
    .sb-track{flex:1;height:6px;background:#F3F4F6;border-radius:99px;overflow:hidden}
    .sb-fill{height:100%;border-radius:99px}
    .sb-val{font-size:11px;font-weight:700;min-width:24px;text-align:right}

    .count{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;border-radius:10px;background:#EEF2FF;color:#4F46E5;font-size:9px;font-weight:700;padding:0 6px;margin-left:6px;vertical-align:middle}
    .iss{padding:6px 0;border-bottom:1px solid #F3F4F6}
    .iss:last-child{border-bottom:none}
    .iss-d{font-size:11px;color:#111827;font-weight:500}
    .iss-t{font-size:9px;color:#9CA3AF;margin-top:1px}
    .sev-high .iss-d{color:#DC2626}
    .sev-medium .iss-d{color:#D97706}
    .sev-low .iss-d{color:#6B7280}

    .seo-val{font-size:11px;color:#374151;margin-top:2px;word-break:break-word}

    .lst{padding-left:18px}
    .lst li{font-size:11px;line-height:1.6;margin-bottom:3px}
    .lst-red li{color:#7F1D1D}
    .lst-green li{color:#065F46}
    .lst-blue li{color:#1E3A8A}

    .pot-list{display:flex;flex-direction:column}
    .pot-row{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid #F3F4F6}
    .pot-row:last-child{border-bottom:none}
    .pot-lbl{font-size:10px;font-weight:600;color:#6B7280;flex-shrink:0}
    .pot-val{font-size:11px;color:#374151;text-align:right}

    .hr{border:none;border-top:1px solid #F3F4F6;margin:8px 0}

    .ai-crd{background:#F8FAFC}

    .reco-crd{background:#F8FAFC;border-left:3px solid #4F46E5}
    .alert-amber{border-radius:8px;padding:12px 14px;margin-bottom:12px;background:#FFFBEB;border:1px solid #FDE68A}
    .alert-title{font-size:11px;font-weight:700;color:#92400E;margin-bottom:3px}
    .alert-body{font-size:10px;color:#78350F;line-height:1.5}

    .reco{padding:14px 14px 12px;border-left:3px solid}
    .reco-red{border-left-color:#DC2626}
    .reco-amber{border-left-color:#D97706}
    .reco-green{border-left-color:#059669}
    .reco-blue{border-left-color:#2563EB}
    .reco-purple{border-left-color:#7C3AED}
    .reco-title{font-size:11px;font-weight:700;color:#0F172A;margin-bottom:6px}

    .body{font-size:11px;color:#4B5563;line-height:1.6}
    .dim{font-size:11px;color:#9CA3AF;font-style:italic}

    .out-box{background:#F8FAFC;border:1px solid #E5E7EB;border-radius:8px;padding:12px 14px;font-size:10px;line-height:1.5;color:#4B5563;white-space:pre-wrap;max-height:160px;overflow:hidden}
    .wa-box{background:#F0FDF4;border-color:#BBF7D0}

    .pch-list{display:flex;flex-direction:column;gap:6px}
    .pch-item{display:flex;align-items:flex-start;gap:10px;padding:7px 0;border-bottom:1px solid #F3F4F6}
    .pch-item:last-child{border-bottom:none}
    .pch-tag{flex-shrink:0;font-size:9px;font-weight:700;background:#EEF2FF;color:#4F46E5;border-radius:6px;padding:3px 8px;text-transform:uppercase;letter-spacing:.04em;min-width:80px;text-align:center}
    .pch-txt{font-size:10px;color:#374151;line-height:1.5}

    .ft{margin-top:36px;padding-top:16px;border-top:1px solid #E5E7EB}
    .ft-in{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
    .ft-br{display:flex;align-items:center;gap:8px}
    .ft-lm{width:22px;height:22px;background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff}
    .ft-bn{font-size:11px;font-weight:700;color:#0F172A}
    .ft-bs{font-size:8px;color:#6B7280}
    .ft-ct{text-align:right;font-size:8px;color:#6B7280;line-height:1.6}
    .ft-d{font-size:8px;color:#9CA3AF;text-align:center;padding-top:8px;margin-top:8px;border-top:1px solid #F3F4F6}

    @media print{body{background:#fff}}
  </style>
</head>
<body>
<div class="page">

  <div class="ah">
    <div class="ah-l">
      <div class="ah-m">OM</div>
      <div>
        <div class="ah-n">Opti Matrix Solutions</div>
        <div class="ah-s">Digital Growth & Web Intelligence Agency</div>
      </div>
    </div>
    <div class="ah-r">
      <div class="ah-id">Report #${reportId}</div>
      <div class="ah-d">${generatedDate}</div>
    </div>
  </div>

  <div class="hero">
    <div class="hero-t">Website Audit Report</div>
    <div class="hero-n">${escapeHtml(summary.companyName)}</div>
    <div class="hero-s">Professional Digital Presence Analysis by Opti Matrix Solutions</div>
    <div class="hero-m">
      <span class="tag ${websiteTypeMeta.cls}">${websiteTypeMeta.label}</span>
      ${summary.category ? `<span class="tag tag-green">${escapeHtml(summary.category)}</span>` : ''}
      ${summary.rating ? `<span class="tag tag-green">★ ${summary.rating} (${summary.reviewsCount || 0} reviews)</span>` : ''}
    </div>
    <div class="hero-r">
      <div class="hero-sc">
        <div class="hero-sc-v" style="color:${scoreColor(mainScore)};">${mainScore ?? 'N/A'}</div>
        <div class="hero-sc-l">Audit Score</div>
      </div>
      <div class="hero-sc">
        <div class="hero-sc-v" style="color:${scoreColor(oppScore)};">${oppScore ?? 'N/A'}</div>
        <div class="hero-sc-l">Opportunity</div>
      </div>
    </div>
  </div>

  <div style="margin-bottom:28px;">
    <div style="font-size:16px;font-weight:700;color:#0F172A;letter-spacing:-.02em;margin-bottom:8px;">${escapeHtml(summary.companyName)}</div>
    <span class="tag ${websiteTypeMeta.cls}">${websiteTypeMeta.label}</span>
    <div class="grid-2" style="margin-top:12px;gap:16px 28px;">
      ${summary.address ? `<div><div class="crd-lbl">Address</div><div class="body">${escapeHtml(summary.address)}</div></div>` : ''}
      ${summary.phone ? `<div><div class="crd-lbl">Phone</div><div class="body">${escapeHtml(summary.phone)}</div></div>` : ''}
      ${summary.email ? `<div><div class="crd-lbl">Email</div><div class="body">${escapeHtml(summary.email)}</div></div>` : ''}
      ${summary.rating ? `<div><div class="crd-lbl">Rating</div><div class="body">${'★'.repeat(Math.round(summary.rating))}${'☆'.repeat(5-Math.round(summary.rating))} ${summary.rating}</div></div>` : ''}
      ${summary.reviewsCount ? `<div><div class="crd-lbl">Reviews</div><div class="body">${summary.reviewsCount} reviews</div></div>` : ''}
      ${summary.website ? `<div style="grid-column:1/-1;"><div class="crd-lbl">Website</div><div class="body" style="word-break:break-all;">${escapeHtml(summary.website)}</div></div>` : ''}
    </div>
  </div>

  ${socialSection}
  ${responsiveSection}
  ${biSection}
  ${outreachSection}
  ${aiRecoSection}

  <div class="ft">
    <div class="ft-in">
      <div class="ft-br">
        <div class="ft-lm">OM</div>
        <div>
          <div class="ft-bn">Opti Matrix Solutions</div>
          <div class="ft-bs">Digital Growth & Web Intelligence Agency</div>
        </div>
      </div>
      <div class="ft-ct">
        <div>Prepared exclusively by Opti Matrix Solutions</div>
        <div>All analysis, scores, and recommendations are proprietary</div>
        <div>© ${new Date().getFullYear()} Opti Matrix Solutions. All rights reserved.</div>
      </div>
    </div>
    <div class="ft-d">
      Report ID: ${reportId} | Generated for: ${escapeHtml(summary.companyName)} | ${generatedDate}
    </div>
  </div>

</div>
</body>
</html>`;
}
