import csvWriter from 'csv-write-stream';
import { createWriteStream } from 'fs';
import { Lead, ILead } from '../models/Lead';
import { logger } from '../utils/logger';
import { QualificationLevel, WebsiteStatus } from '../types/analysis.types';

export interface ExportFilters {
  qualificationLevel?: QualificationLevel;
  websiteStatus?: WebsiteStatus;
  category?: string;
  minLeadScore?: number;
  maxLeadScore?: number;
  search?: string;
  keyword?: string;
  location?: string;
  source?: string;
  sources?: string;
  hasWebsite?: string;
  hasPhone?: string;
}

export interface ExportOptions {
  filename?: string;
  filePath?: string;
}

export class CSVExporter {
  private readonly defaultFilename = 'leads_export';

  /**
   * Export leads to CSV file
   */
  async exportToCSV(
    options: ExportFilters & ExportOptions = {}
  ): Promise<{ filepath: string; rowCount: number }> {
    const { 
      qualificationLevel, 
      websiteStatus, 
      category, 
      minLeadScore,
      maxLeadScore,
      search,
      filename = this.defaultFilename,
      filePath = './exports'
    } = options;

    logger.info(`CSVExporter: Starting export with filters: ${JSON.stringify(options)}`);

    // Build query based on filters
    const query = this.buildQuery({
      qualificationLevel,
      websiteStatus,
      category,
      minLeadScore,
      maxLeadScore,
      search
    });

    // Get leads with lean query for performance
    const leads = await Lead.find(query)
      .lean()
      .select({
        companyName: 1,
        website: 1,
        phone: 1,
        email: 1,
        address: 1,
        category: 1,
        websiteStatus: 1,
        leadScore: 1,
        qualificationLevel: 1,
        sslEnabled: 1,
        source: 1,
        rating: 1,
        createdAt: 1,
        searchedKeyword: 1,
        searchedLocation: 1,
      });

    if (!leads || leads.length === 0) {
      logger.warn('CSVExporter: No leads found for export');
      throw new Error('No leads found to export');
    }

    const fs = await import('fs');
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(filePath, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filepath = `${filePath}/${filename}_${timestamp}.csv`;

    // Define CSV columns
    const columns = [
      { label: 'Company Name', value: 'companyName' },
      { label: 'Website', value: 'website' },
      { label: 'Phone', value: 'phone' },
      { label: 'Email', value: 'email' },
      { label: 'Address', value: 'address' },
      { label: 'Category', value: 'category' },
      { label: 'Website Status', value: 'websiteStatus' },
      { label: 'Lead Score', value: 'leadScore' },
      { label: 'Qualification Level', value: 'qualificationLevel' },
      { label: 'SSL Status', value: 'sslEnabled' },
      { label: 'Source', value: 'source' },
      { label: 'Rating', value: 'rating' },
      { label: 'Created At', value: 'createdAt' },
      { label: 'Searched Keyword', value: 'searchedKeyword' },
      { label: 'Searched Location', value: 'searchedLocation' },
    ];

    // Create write stream
    const writeStream = createWriteStream(filepath);
    
    // Create CSV stream with columns
    const csvStream = csvWriter({
      headers: columns.map(col => col.label),
      sendHeaders: true,
    });
    // Pipe CSV stream to file write stream
    csvStream.pipe(writeStream);

    // Convert lead objects to CSV format
    const csvData = leads.map(lead => {
      const row: Record<string, any> = {};
      columns.forEach(col => {
        const value = lead[col.value as keyof ILead];
        // Format boolean for CSV
        if (typeof value === 'boolean') {
          row[col.label] = value ? 'Yes' : 'No';
        } else if (value instanceof Date) {
          row[col.label] = value.toISOString();
        } else {
          row[col.label] = value || '';
        }
      });
      return row;
    });

    // Pipeline the streams
    // Write CSV data after setting up pipe
    csvData.forEach(row => csvStream.write(row));
    csvStream.end();

    // Wait for stream to finish
    // Wait for the file stream to finish
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    logger.info(`CSVExporter: Exported ${csvData.length} leads to ${filepath}`);

    return {
      filepath,
      rowCount: csvData.length,
    };
  }

  /**
   * Export leads directly to response stream
   */
  async exportToStream(
    res: any,
    options: ExportFilters
  ): Promise<void> {
    logger.info('CSVExporter: Starting stream export');

    const query = this.buildQuery(options);

    const leads = await Lead.find(query)
      .lean()
      .select({
        companyName: 1,
        website: 1,
        phone: 1,
        email: 1,
        address: 1,
        category: 1,
        websiteStatus: 1,
        leadScore: 1,
        qualificationLevel: 1,
        sslEnabled: 1,
        source: 1,
        rating: 1,
        createdAt: 1,
        searchedKeyword: 1,
        searchedLocation: 1,
      });

    if (!leads || leads.length === 0) {
      res.status(404).json({
        success: false,
        message: 'No leads found to export',
      });
      return;
    }

    const columns = [
      { label: 'Company Name', value: 'companyName' },
      { label: 'Website', value: 'website' },
      { label: 'Phone', value: 'phone' },
      { label: 'Email', value: 'email' },
      { label: 'Address', value: 'address' },
      { label: 'Category', value: 'category' },
      { label: 'Website Status', value: 'websiteStatus' },
      { label: 'Lead Score', value: 'leadScore' },
      { label: 'Qualification Level', value: 'qualificationLevel' },
      { label: 'SSL Status', value: 'sslEnabled' },
      { label: 'Source', value: 'source' },
      { label: 'Rating', value: 'rating' },
      { label: 'Created At', value: 'createdAt' },
      { label: 'Searched Keyword', value: 'searchedKeyword' },
      { label: 'Searched Location', value: 'searchedLocation' },
    ];

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=leads_export_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);

    // Write CSV header
    res.write(columns.map(col => `"${col.label}"`).join(',') + '\n');

    // Write data rows
    leads.forEach(lead => {
      const row = columns.map(col => {
        const value = lead[col.value as keyof ILead];
        if (typeof value === 'boolean') {
          return value ? 'Yes' : 'No';
        } else if (value instanceof Date) {
          return `"${value.toISOString()}"`;
        } else {
          return `"${(value || '').toString().replace(/"/g, '""')}"`;
        }
      }).join(',');
      res.write(row + '\n');
    });

    res.end();
    logger.info(`CSVExporter: Stream export completed for ${leads.length} leads`);
  }

  /**
   * Build query from export filters
   */
  private buildQuery(filters: ExportFilters): any {
    const query: any = {};

    if (filters.qualificationLevel) {
      query.qualificationLevel = filters.qualificationLevel;
    }

    if (filters.websiteStatus) {
      query.websiteStatus = filters.websiteStatus;
    }

    if (filters.category) {
      query.category = { $regex: filters.category, $options: 'i' };
    }

    if (filters.minLeadScore !== undefined) {
      query.leadScore = { ...(query.leadScore || {}), $gte: filters.minLeadScore };
    }

    if (filters.maxLeadScore !== undefined) {
      query.leadScore = { ...(query.leadScore || {}), $lte: filters.maxLeadScore };
    }

    if (filters.search) {
      query.$or = [
        { companyName: { $regex: filters.search, $options: 'i' } },
        { phone: { $regex: filters.search } },
        { email: { $regex: filters.search, $options: 'i' } },
        { website: { $regex: filters.search, $options: 'i' } },
      ];
    }

    if (filters.keyword) {
      query.$or = [
        { companyName: { $regex: filters.keyword, $options: 'i' } },
        { website: { $regex: filters.keyword, $options: 'i' } },
        { phone: { $regex: filters.keyword } },
        { address: { $regex: filters.keyword, $options: 'i' } },
        { category: { $regex: filters.keyword, $options: 'i' } },
      ];
    }

    if (filters.location) {
      const locationQuery = [
        { address: { $regex: filters.location, $options: 'i' } },
        { companyName: { $regex: filters.location, $options: 'i' } },
        { category: { $regex: filters.location, $options: 'i' } },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: locationQuery }];
        delete query.$or;
      } else {
        query.$or = locationQuery;
      }
    }

    if (filters.source) {
      query.source = filters.source;
    }

    if (filters.sources) {
      query.source = { $in: filters.sources.split(',') };
    }

    if (filters.hasWebsite === 'true') {
      query.website = { $exists: true, $nin: [null, ''] };
    } else if (filters.hasWebsite === 'false') {
      query.$and = [
        ...(query.$and || []),
        { $or: [{ website: { $exists: false } }, { website: null }, { website: '' }] },
      ];
    }

    if (filters.hasPhone === 'true') {
      query.phone = { $exists: true, $nin: [null, ''] };
    } else if (filters.hasPhone === 'false') {
      query.$and = [
        ...(query.$and || []),
        { $or: [{ phone: { $exists: false } }, { phone: null }, { phone: '' }] },
      ];
    }

    return query;
  }

  /**
   * Export leads from search results
   */
  async exportFromSearch(
    keyword: string,
    location: string,
    options: ExportFilters
  ): Promise<{ filepath: string; rowCount: number }> {
    logger.info(`CSVExporter: Exporting search results for "${keyword}" in "${location}"`);

    const exportOptions = {
      ...options,
      keyword,
      location,
    };

    return this.exportToCSV(exportOptions);
  }
}

export const csvExporter = new CSVExporter();
