import { Page } from 'playwright';
import { logger } from '../utils/logger';
import { LayoutMetrics } from './types';

export class LayoutBreakDetector {
  async analyzeLayout(page: Page): Promise<LayoutMetrics> {
    try {
      const metrics: LayoutMetrics = await page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;

        const hasHorizontalScroll = body.scrollWidth > window.innerWidth ||
                                     html.scrollWidth > window.innerWidth;

        const bodyOverflowX = window.getComputedStyle(body).overflowX === 'scroll' ||
                             window.getComputedStyle(body).overflowX === 'auto';

        let elementsOffscreen = 0;
        let fixedWidthElements = 0;
        let overlappingElements = 0;

        const allElements = document.querySelectorAll('*');
        const elementRects: Array<{ rect: DOMRect; element: Element }> = [];

        allElements.forEach((element) => {
          const rect = element.getBoundingClientRect();
          const styles = window.getComputedStyle(element);

          if (rect.right > window.innerWidth && rect.width > 50) {
            elementsOffscreen++;
          }

          const widthValue = styles.width;
          if (widthValue && widthValue.includes('px') && !widthValue.includes('%')) {
            const width = parseFloat(widthValue);
            if (width > window.innerWidth) {
              fixedWidthElements++;
            }
          }

          if (rect.width > 0 && rect.height > 0) {
            elementRects.push({ rect, element });
          }
        });

        const limit = Math.min(elementRects.length, 100);
        for (let i = 0; i < limit; i++) {
          for (let j = i + 1; j < limit; j++) {
            const rect1 = elementRects[i].rect;
            const rect2 = elementRects[j].rect;

            const overlap = !(
              rect1.right < rect2.left ||
              rect1.left > rect2.right ||
              rect1.bottom < rect2.top ||
              rect1.top > rect2.bottom
            );

            if (overlap) {
              const overlapArea = 
                Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left);
              const minWidth = Math.min(rect1.width, rect2.width);
              
              if (overlapArea > minWidth * 0.5) {
                overlappingElements++;
                break;
              }
            }
          }
        }

        return {
          hasHorizontalScroll,
          bodyOverflowX,
          elementsOffscreen,
          fixedWidthElements,
          overlappingElements,
        };
      });

      logger.info(`Layout analyzed: horizontal scroll=${metrics.hasHorizontalScroll}, offscreen=${metrics.elementsOffscreen}`);
      return metrics;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to analyze layout:');
      return {
        hasHorizontalScroll: false,
        bodyOverflowX: false,
        elementsOffscreen: 0,
        fixedWidthElements: 0,
        overlappingElements: 0,
      };
    }
  }

  async detectHorizontalScroll(page: Page): Promise<boolean> {
    try {
      const hasScroll = await page.evaluate(() => {
        return document.body.scrollWidth > window.innerWidth ||
               document.documentElement.scrollWidth > window.innerWidth;
      });
      return hasScroll;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to detect horizontal scroll:');
      return false;
    }
  }

  async detectOverflow(page: Page): Promise<boolean> {
    try {
      const hasOverflow = await page.evaluate(() => {
        const body = document.body;
        const overflowX = window.getComputedStyle(body).overflowX;
        return overflowX === 'scroll' || overflowX === 'auto';
      });
      return hasOverflow;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to detect overflow:');
      return false;
    }
  }

  async detectOffscreenElements(page: Page): Promise<number> {
    try {
      const count = await page.evaluate(() => {
        let offscreenCount = 0;
        const allElements = document.querySelectorAll('*');
        
        allElements.forEach((element) => {
          const rect = element.getBoundingClientRect();
          if (rect.right > window.innerWidth && rect.width > 50) {
            offscreenCount++;
          }
        });
        
        return offscreenCount;
      });
      return count;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to detect offscreen elements:');
      return 0;
    }
  }
}

export const layoutBreakDetector = new LayoutBreakDetector();
