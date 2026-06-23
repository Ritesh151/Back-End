import { Request, Response, NextFunction } from 'express';
import { csvExporter } from '../exporters/csv.exporter';
import { excelExporter } from '../exporters/excel.exporter';
import { APIResponse } from '../utils/api-response';
import { logger } from '../utils/logger';
import { ExportFilters } from '../exporters/csv.exporter';

export class ExporterController {
  /**
   * Export leads to CSV
   */
  async exportToCSV(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters: ExportFilters = {
        qualificationLevel: req.query.qualificationLevel as any,
        websiteStatus: req.query.websiteStatus as any,
        category: req.query.category?.toString(),
        minLeadScore: req.query.minLeadScore ? parseFloat(req.query.minLeadScore.toString()) : undefined,
        maxLeadScore: req.query.maxLeadScore ? parseFloat(req.query.maxLeadScore.toString()) : undefined,
        search: req.query.search?.toString(),
        keyword: req.query.keyword?.toString(),
        location: req.query.location?.toString(),
        source: req.query.source?.toString(),
        sources: req.query.sources?.toString(),
        hasWebsite: req.query.hasWebsite?.toString(),
        hasPhone: req.query.hasPhone?.toString(),
      };

      logger.info(`ExporterController: Starting CSV export with filters: ${JSON.stringify(filters)}`);

      await csvExporter.exportToStream(res, filters);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export leads to Excel
   */
  async exportToExcel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters: ExportFilters = {
        qualificationLevel: req.query.qualificationLevel as any,
        websiteStatus: req.query.websiteStatus as any,
        category: req.query.category?.toString(),
        minLeadScore: req.query.minLeadScore ? parseFloat(req.query.minLeadScore.toString()) : undefined,
        maxLeadScore: req.query.maxLeadScore ? parseFloat(req.query.maxLeadScore.toString()) : undefined,
        search: req.query.search?.toString(),
        keyword: req.query.keyword?.toString(),
        location: req.query.location?.toString(),
        source: req.query.source?.toString(),
        sources: req.query.sources?.toString(),
        hasWebsite: req.query.hasWebsite?.toString(),
        hasPhone: req.query.hasPhone?.toString(),
      };

      logger.info(`ExporterController: Starting Excel export with filters: ${JSON.stringify(filters)}`);

      await excelExporter.exportToStream(res, filters);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export with detailed formatting
   */
  async exportWithFormatting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters: ExportFilters = {
        qualificationLevel: req.query.qualificationLevel as any,
        websiteStatus: req.query.websiteStatus as any,
        category: req.query.category?.toString(),
        minLeadScore: req.query.minLeadScore ? parseFloat(req.query.minLeadScore.toString()) : undefined,
        maxLeadScore: req.query.maxLeadScore ? parseFloat(req.query.maxLeadScore.toString()) : undefined,
        search: req.query.search?.toString(),
      };

      const result = await excelExporter.exportWithFormatting({
        ...filters,
        filename: 'leads_detailed_export',
      });

      APIResponse.success(res, {
        filepath: result.filepath,
        rowCount: result.rowCount,
      }, 'Excel file exported successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export search results
   */
  async exportSearchResults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { keyword, location } = req.body;

      if (!keyword || !location) {
        APIResponse.error(res, 'Keyword and location are required', null, 400);
        return;
      }

      const filters: ExportFilters = {
        qualificationLevel: req.query.qualificationLevel as any,
        websiteStatus: req.query.websiteStatus as any,
        category: req.query.category?.toString(),
        minLeadScore: req.query.minLeadScore ? parseFloat(req.query.minLeadScore.toString()) : undefined,
        maxLeadScore: req.query.maxLeadScore ? parseFloat(req.query.maxLeadScore.toString()) : undefined,
      };

      const format = req.query.format?.toString() === 'csv' ? 'csv' : 'excel';
      
      if (format === 'csv') {
        // For CSV export from search, we need to call exportToCSV directly
        // First scrape the search results
        const { ScraperService } = await import('../services/scraper.service.js');
        const scraper = new ScraperService();
        
        await scraper.scrapeBusinesses({
          keyword,
          location,
          sources: ['google-maps'],
          limit: 100,
        });

        // Then filter and export
        const searchFilters = {
          ...filters,
          search: keyword,
        };

        await csvExporter.exportToStream(res, searchFilters);
      } else {
        // Excel export
        const result = await excelExporter.exportWithFormatting({
          ...filters,
          search: keyword,
          filename: `search_${keyword}_${location}`,
        });

        APIResponse.success(res, {
          filepath: result.filepath,
          rowCount: result.rowCount,
        }, 'Excel export completed successfully', 200);
      }
    } catch (error) {
      next(error);
    }
  }
}

export const exporterController = new ExporterController();
