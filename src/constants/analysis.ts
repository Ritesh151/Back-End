// Analysis constants

export const WEBSITE_STATUSES = ['unknown', 'no-website', 'broken-website', 'outdated-website', 'average-website', 'modern-website'] as const;
export type WebsiteStatus = typeof WEBSITE_STATUSES[number];

export const QUALIFICATION_LEVELS = ['high-potential', 'medium-potential', 'low-potential'] as const;
export type QualificationLevel = typeof QUALIFICATION_LEVELS[number];

export const SSL_THRESHOLD_DAYS = 90; // SSL certificate validity threshold

export const RESPONSE_TIME_THRESHOLDS = {
  excellent: 1000, // ms
  good: 2000, // ms
  acceptable: 3000, // ms
  slow: 5000, // ms
};

export const SEO_SCORE_WEIGHTS = {
  metaTitle: 20,
  metaDescription: 15,
  mobileFriendly: 20,
  hasContactPage: 25,
  hasSocialLinks: 20,
};

export const QUALIFICATION_RULES = {
  highPotential: {
    minScore: 80,
    requires: ['sslEnabled', 'hasContactPage'],
  },
  mediumPotential: {
    minScore: 50,
    requires: [],
  },
  lowPotential: {
    minScore: 0,
    requires: [],
  },
};
