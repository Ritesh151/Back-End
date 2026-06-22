# UI/UX Intelligence Engine

Enterprise-grade responsive design and UI/UX auditing system for Lead Finder Agent.

## Quick Start

```typescript
import { responsiveEngine } from './responsive-engine';

const result = await responsiveEngine.analyzeWebsite('https://example.com', {
  timeout: 30000,
  skipScreenshots: false,
  screenshotQuality: 80,
});

console.log(result.scores.responsiveScore); // 86
console.log(result.scores.uiuxScore); // 79
console.log(result.scores.mobileExperienceScore); // 91
```

## Architecture

```
responsive-engine.ts          → Main orchestrator
  ├── screenshot-engine.ts    → Screenshot capture (desktop + mobile)
  ├── layout-break-detector.ts → Layout analysis & horizontal scroll detection
  ├── viewport-checker.ts     → Viewport meta tag & mobile readiness
  ├── uiux-analyzer.ts        → UI/UX issue detection
  └── responsive-score-engine.ts → Score calculation (0-100)
```

## Modules

### ResponsiveEngine

Main entry point for website auditing.

```typescript
class ResponsiveEngine {
  async initialize(): Promise<void>
  async cleanup(): Promise<void>
  async analyzeWebsite(url: string, options?: ResponsiveAnalysisOptions): Promise<FullResponsiveAuditResult>
}
```

**Features:**
- Puppeteer browser management
- Desktop (1920x1080) & Mobile (iPhone 14 Pro) viewports
- Concurrency control (max 3 parallel)
- SSRF protection
- Automatic retry & error handling

### ScreenshotEngine

Captures visual screenshots of websites.

```typescript
class ScreenshotEngine {
  async captureScreenshot(page: Page, viewport: ViewportConfig, url: string, quality?: number): Promise<string | null>
  async captureBase64Screenshot(page: Page, viewport: ViewportConfig, quality?: number): Promise<string | null>
  async cleanupOldScreenshots(daysOld?: number): Promise<void>
}
```

**Features:**
- JPEG format with configurable quality
- File & base64 encoding support
- Automatic cleanup of old screenshots
- Error-resilient capture

### LayoutBreakDetector

Analyzes page layout for responsive issues.

```typescript
class LayoutBreakDetector {
  async analyzeLayout(page: Page): Promise<LayoutMetrics>
  async detectHorizontalScroll(page: Page): Promise<boolean>
  async detectOverflow(page: Page): Promise<boolean>
  async detectOffscreenElements(page: Page): Promise<number>
}
```

**Detects:**
- Horizontal scrolling
- Body overflow-x
- Elements positioned offscreen
- Fixed-width elements breaking layout
- Overlapping elements

### ViewportChecker

Checks mobile responsiveness configuration.

```typescript
class ViewportChecker {
  async checkViewport(page: Page): Promise<Partial<ResponsiveAudit>>
  async checkResponsiveFrameworks(page: Page): Promise<boolean>
  async checkMediaQueries(page: Page): Promise<boolean>
}
```

**Checks:**
- Viewport meta tag presence
- Touch target sizes (44x44px minimum)
- Font sizes (minimum 12px)
- Responsive frameworks (Bootstrap, Tailwind, etc.)
- CSS media queries

### UIUXAnalyzer

Detects UI/UX quality issues.

```typescript
class UIUXAnalyzer {
  async analyzeUIUX(page: Page, isMobile: boolean): Promise<UIUXAuditResult>
}
```

**Detects:**
- Alignment inconsistencies
- Broken/collapsed buttons
- Overlapping content
- Hidden off-screen elements
- Navigation problems
- Spacing issues
- Touch target problems (mobile)

**Issue Types:**
- `alignment` - Inconsistent element alignment
- `overlap` - Overlapping content
- `broken-button` - Collapsed or invisible buttons
- `spacing` - Insufficient spacing
- `cropped-section` - Content cut off
- `hidden-content` - Elements positioned off-screen
- `broken-navigation` - Navigation issues
- `unclickable-button` - Buttons with pointer-events: none
- `font-size` - Text too small
- `layout-break` - Mobile layout broken
- `horizontal-scroll` - Horizontal scrolling detected
- `overflow` - Overflow issues
- `viewport` - Viewport configuration problems
- `touch-target` - Touch targets too small

### ResponsiveScoreEngine

Calculates quality scores (0-100).

```typescript
class ResponsiveScoreEngine {
  calculateScores(
    responsiveAudit: ResponsiveAudit,
    uiuxAudit: UIUXAuditResult,
    desktopMetrics: LayoutMetrics,
    mobileMetrics: LayoutMetrics
  ): ResponsiveScore
  
  getScoreLevel(score: number): 'good' | 'medium' | 'poor'
  getScoreColor(score: number): string
  getScoreRecommendation(score: number, type: string): string
}
```

**Scoring Logic:**

**Responsive Score:**
- Viewport meta: 20 points
- Responsive layout: 15 points
- No horizontal scroll: 15 points
- No overflow: 10 points
- Mobile friendly: 15 points
- Good font sizing: 10 points
- Layout metrics: variable deductions

**UI/UX Score:**
- Base: 100 points
- Critical issues: -15 each
- Warning issues: -8 each
- Info issues: -3 each
- Category penalties for specific types

**Mobile Experience Score:**
- Viewport meta: 25 points
- Touch friendly: 20 points
- Font sizing: 15 points
- No horizontal scroll: 15 points
- Mobile layout: 10 points
- Mobile-specific deductions

**Score Levels:**
- 80-100: Good (green)
- 50-79: Medium (yellow)
- 0-49: Poor (red)

## Types

### Core Interfaces

```typescript
interface ResponsiveAudit {
  mobileFriendly: boolean;
  responsiveLayout: boolean;
  horizontalScroll: boolean;
  overflowIssues: boolean;
  viewportMeta: boolean;
  viewportContent: string | null;
  touchFriendly: boolean;
  fontSizeIssues: boolean;
}

interface UIUXAuditResult {
  alignmentIssues: boolean;
  brokenButtons: boolean;
  croppedSections: boolean;
  mobileLayoutBroken: boolean;
  overlappingContent: boolean;
  hiddenContent: boolean;
  navigationIssues: boolean;
  spacingIssues: boolean;
  issues: UIUXIssue[];
}

interface UIUXIssue {
  type: UIUXIssueType;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  element?: string;
  location?: string;
}

interface ResponsiveScore {
  responsiveScore: number;
  uiuxScore: number;
  mobileExperienceScore: number;
}

interface LayoutMetrics {
  hasHorizontalScroll: boolean;
  bodyOverflowX: boolean;
  elementsOffscreen: number;
  fixedWidthElements: number;
  overlappingElements: number;
}

interface FullResponsiveAuditResult {
  responsiveAudit: ResponsiveAudit;
  uiuxAudit: UIUXAuditResult;
  screenshots: ScreenshotData;
  scores: ResponsiveScore;
  desktopMetrics: LayoutMetrics;
  mobileMetrics: LayoutMetrics;
  responsiveAuditCompleted: boolean;
  auditedAt: Date;
}
```

### Viewport Configuration

```typescript
const VIEWPORTS = {
  DESKTOP: {
    name: 'Desktop 1920x1080',
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  MOBILE: {
    name: 'iPhone 14 Pro',
    width: 393,
    height: 852,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
};
```

## Configuration

### Concurrency Limit

```typescript
// responsive-engine.ts
private readonly maxConcurrent = 3; // Adjust based on server capacity
```

### Timeout

```typescript
const timeout = options.timeout || 30000; // 30 seconds default
```

### Screenshot Quality

```typescript
const screenshotQuality = options.screenshotQuality || 80; // 1-100
```

### SSRF Protection

```typescript
const blockedHosts = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254', // AWS metadata
];

const blockedRanges = [
  '192.168.',  // Private network
  '10.',       // Private network
  '172.',      // Private network (172.16-31)
];
```

## Usage Examples

### Basic Audit

```typescript
import { responsiveEngine } from './responsive-engine';

const result = await responsiveEngine.analyzeWebsite('https://example.com');

console.log(`Responsive Score: ${result.scores.responsiveScore}`);
console.log(`UI/UX Score: ${result.scores.uiuxScore}`);
console.log(`Mobile Score: ${result.scores.mobileExperienceScore}`);
console.log(`Issues Found: ${result.uiuxAudit.issues.length}`);
```

### With Options

```typescript
const result = await responsiveEngine.analyzeWebsite('https://example.com', {
  timeout: 60000,              // 60 seconds
  skipScreenshots: false,      // Capture screenshots
  screenshotQuality: 90,       // High quality
});
```

### Custom Viewport Analysis

```typescript
import { chromium } from 'playwright';
import { layoutBreakDetector } from './layout-break-detector';

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1366, height: 768 },
});

await page.goto('https://example.com');
const metrics = await layoutBreakDetector.analyzeLayout(page);

console.log(metrics);
await browser.close();
```

## Performance

### Timing
- Desktop render: ~5-10 seconds
- Mobile render: ~5-10 seconds
- Screenshot capture: ~1-2 seconds
- Analysis: ~2-3 seconds
- **Total**: ~30-60 seconds per website

### Resources
- Memory per browser: ~200-300MB
- CPU: 1-2 cores per concurrent audit
- Storage: ~50-200KB per screenshot (JPEG)

### Optimization Tips

1. **Skip screenshots for speed:**
```typescript
{ skipScreenshots: true }
```

2. **Reduce screenshot quality:**
```typescript
{ screenshotQuality: 60 }
```

3. **Lower concurrency on small servers:**
```typescript
private readonly maxConcurrent = 1;
```

4. **Increase timeout for complex sites:**
```typescript
{ timeout: 60000 }
```

## Error Handling

All modules include comprehensive error handling:

```typescript
try {
  const result = await responsiveEngine.analyzeWebsite(url);
} catch (error) {
  // Returns default safe values on error
  // responsiveAuditCompleted: false
  // All scores: 0
  // No screenshots
  logger.error(error, 'Audit failed');
}
```

Errors are logged but never crash the system.

## Logging

All operations are logged with Pino:

```typescript
logger.info('Starting responsive audit for https://example.com');
logger.info('Desktop render completed');
logger.info('Mobile render completed');
logger.info('Screenshots generated');
logger.info('Scores calculated: R=86, UX=79, Mobile=91');
logger.info('Responsive audit completed');
```

## Security

1. **SSRF Prevention**: Blocks localhost and private IPs
2. **Timeout Enforcement**: Prevents hanging on slow sites
3. **Browser Sandboxing**: Isolated Playwright execution
4. **URL Validation**: Strict URL format checking
5. **Error Isolation**: Failures don't crash the system

## Dependencies

- `playwright`: Browser automation
- `p-limit`: Concurrency control
- `pino`: Logging

## Integration

Used by:
- `backend/src/services/responsive-audit.service.ts`
- `backend/src/services/responsive-audit-queue.service.ts`

Called via:
- REST API endpoints (`/api/v1/responsive-audit/*`)
- Background queue processing
- Manual audit triggers

## Testing

```bash
# Type check
npm run typecheck

# Manual test
node -e "
const { responsiveEngine } = require('./dist/uiux-intelligence');
responsiveEngine.initialize().then(() => {
  return responsiveEngine.analyzeWebsite('https://example.com');
}).then(result => {
  console.log(result);
  process.exit(0);
});
"
```

## Maintenance

### Cleanup Old Screenshots

```typescript
import { screenshotEngine } from './screenshot-engine';

await screenshotEngine.cleanupOldScreenshots(7); // Delete screenshots older than 7 days
```

### Browser Lifecycle

```typescript
import { responsiveEngine } from './responsive-engine';

// Initialize (done automatically on first use)
await responsiveEngine.initialize();

// Cleanup when shutting down
await responsiveEngine.cleanup();
```

## Troubleshooting

### High Memory Usage
- Reduce `maxConcurrent` to 1-2
- Enable `skipScreenshots`
- Close browser between batches

### Timeouts
- Increase `timeout` option
- Check network connectivity
- Verify website is accessible

### SSRF Errors
- Review blocked hosts list
- Ensure public IP addresses
- Check DNS resolution

### Screenshot Failures
- Verify screenshots directory exists
- Check disk space
- Ensure write permissions

## Contributing

When extending this module:

1. Follow TypeScript strict mode
2. Add comprehensive error handling
3. Include Pino logging
4. Update type definitions
5. Test with various websites
6. Document new features
