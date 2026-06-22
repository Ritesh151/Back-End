import ExcelJS from 'exceljs';
import { Lead } from '../models/Lead';
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

export class ExcelExporter {
  private readonly defaultFilename = 'leads_export';

  /**
   * Export leads to Excel file
   */
  async exportToExcel(
    options: ExportFilters & ExportOptions = {}
  ): Promise<{ filepath: string; rowCount: number }> {
    const { 
      qualificationLevel, 
      websiteStatus, 
      category, 
      minLeadScore,
      maxLeadScore,
      search,
      keyword,
      location,
      source,
      sources,
      hasWebsite,
      hasPhone,
      filename = this.defaultFilename,
      filePath = './exports'
    } = options;

    logger.info(`ExcelExporter: Starting export with filters: ${JSON.stringify(options)}`);

    // Build query based on filters
    const query = this.buildQuery({
      qualificationLevel,
      websiteStatus,
      category,
      minLeadScore,
      maxLeadScore,
      search,
      keyword,
      location,
      source,
      sources,
      hasWebsite,
      hasPhone,
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
      logger.warn('ExcelExporter: No leads found for export');
      throw new Error('No leads found to export');
    }

    // Create exports directory if it doesn't exist
    const fs = await import('fs');
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(filePath, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filepath = `${filePath}/${filename}_${timestamp}.xlsx`;

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Lead Finder Agent';
    workbook.created = new Date();
    workbook.lastModifiedBy = 'Lead Finder Agent';
    workbook.modified = new Date();

    // Add worksheet
    const worksheet = workbook.addWorksheet('Leads');

    // Define columns with headers
    const columns = [
      { header: 'Company Name', key: 'companyName', width: 30 },
      { header: 'Website', key: 'website', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Website Status', key: 'websiteStatus', width: 18 },
      { header: 'Lead Score', key: 'leadScore', width: 12 },
      { header: 'Qualification Level', key: 'qualificationLevel', width: 20 },
      { header: 'SSL Status', key: 'sslEnabled', width: 12 },
      { header: 'Source', key: 'source', width: 15 },
      { header: 'Rating', key: 'rating', width: 10 },
      { header: 'Created At', key: 'createdAt', width: 20 },
      { header: 'Searched Keyword', key: 'searchedKeyword', width: 20 },
      { header: 'Searched Location', key: 'searchedLocation', width: 20 },
    ];

    // Set columns
    worksheet.columns = columns;

    // Style header row
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F4F4F' },
    };
    worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Add data rows
    const dataRows = leads.map(lead => {
      return {
        companyName: lead.companyName || '',
        website: lead.website || '',
        phone: lead.phone || '',
        email: lead.email || '',
        address: lead.address || '',
        category: lead.category || '',
        websiteStatus: lead.websiteStatus || '',
        leadScore: lead.leadScore || 0,
        qualificationLevel: lead.qualificationLevel || '',
        sslEnabled: lead.sslEnabled ? 'Yes' : 'No',
        source: lead.source || '',
        rating: lead.rating ? `${lead.rating}/5` : '',
        createdAt: lead.createdAt ? lead.createdAt.toISOString() : '',
        searchedKeyword: lead.searchedKeyword || '',
        searchedLocation: lead.searchedLocation || '',
      };
    });

    worksheet.addRows(dataRows);

    // Apply filters to all columns
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };

    // Freeze first row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Style data rows (alternating colors)
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        if (rowNumber % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' },
          };
        }
        row.alignment = { vertical: 'middle', wrapText: true };
      }
    });

    // Auto-size columns based on content
    worksheet.columns.forEach(column => {
      let maxWidth = (column.header || '').length;
      column.eachCell?.({ includeEmpty: true }, (cell: any) => {
        const cellLength = cell.value ? cell.value.toString().length : 0;
        if (cellLength > maxWidth) {
          maxWidth = cellLength;
        }
      });
      column.width = Math.min(maxWidth + 2, 40); // Cap at 40
    });

    // Save workbook
    await workbook.xlsx.writeFile(filepath);

    logger.info(`ExcelExporter: Exported ${leads.length} leads to ${filepath}`);

    return {
      filepath,
      rowCount: leads.length,
    };
  }

  /**
   * Export leads directly to response stream
   */
  async exportToStream(
    res: any,
    options: ExportFilters
  ): Promise<void> {
    logger.info('ExcelExporter: Starting stream export');

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

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Lead Finder Agent';
    workbook.created = new Date();

    // Add worksheet
    const worksheet = workbook.addWorksheet('Leads');

    // Define columns
    const columns = [
      { header: 'Company Name', key: 'companyName', width: 30 },
      { header: 'Website', key: 'website', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Website Status', key: 'websiteStatus', width: 18 },
      { header: 'Lead Score', key: 'leadScore', width: 12 },
      { header: 'Qualification Level', key: 'qualificationLevel', width: 20 },
      { header: 'SSL Status', key: 'sslEnabled', width: 12 },
      { header: 'Source', key: 'source', width: 15 },
      { header: 'Rating', key: 'rating', width: 10 },
      { header: 'Created At', key: 'createdAt', width: 20 },
      { header: 'Searched Keyword', key: 'searchedKeyword', width: 20 },
      { header: 'Searched Location', key: 'searchedLocation', width: 20 },
    ];

    worksheet.columns = columns;

    // Style header row
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F4F4F' },
    };
    worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Add data
    const dataRows = leads.map(lead => ({
      companyName: lead.companyName || '',
      website: lead.website || '',
      phone: lead.phone || '',
      email: lead.email || '',
      address: lead.address || '',
      category: lead.category || '',
      websiteStatus: lead.websiteStatus || '',
      leadScore: lead.leadScore || 0,
      qualificationLevel: lead.qualificationLevel || '',
      sslEnabled: lead.sslEnabled ? 'Yes' : 'No',
      source: lead.source || '',
      rating: lead.rating ? `${lead.rating}/5` : '',
      createdAt: lead.createdAt ? lead.createdAt.toISOString() : '',
      searchedKeyword: lead.searchedKeyword || '',
      searchedLocation: lead.searchedLocation || '',
    }));

    worksheet.addRows(dataRows);

    // Apply filters
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };

    // Freeze first row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Style data rows
    worksheet.columns.forEach(column => {
      let maxWidth = (column.header || '').length;
      column.eachCell?.({ includeEmpty: true }, (cell: any) => {
        const cellLength = cell.value ? cell.value.toString().length : 0;
        if (cellLength > maxWidth) {
          maxWidth = cellLength;
        }
      });
      column.width = Math.min(maxWidth + 2, 40);
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=leads_export_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

    logger.info(`ExcelExporter: Stream export completed for ${leads.length} leads`);
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
   * Export leads with advanced formatting
   */
  async exportWithFormatting(
    options: ExportFilters & ExportOptions
  ): Promise<{ filepath: string; rowCount: number }> {
    logger.info('ExcelExporter: Starting formatted export');

    // Get all lead data for formatting
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
        metaTitle: 1,
        metaDescription: 1,
        responseTime: 1,
        hasContactPage: 1,
        hasSocialLinks: 1,
        analyzedAt: 1,
        createdAt: 1,
      });

    if (!leads || leads.length === 0) {
      throw new Error('No leads found to export');
    }

    const filepath = await this.createFormattedWorkbook(leads, options);

    return {
      filepath,
      rowCount: leads.length,
    };
  }

  /**
   * Create workbook with multiple sheets
   */
  private async createFormattedWorkbook(
    leads: any[],
    _options: ExportOptions
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filepath = `./exports/leads_export_${timestamp}.xlsx`;

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Lead Finder Agent';
    workbook.created = new Date();

    // Sheet 1: Lead Summary
    const summarySheet = workbook.addWorksheet('Summary');

    // Add summary header
    summarySheet.mergeCells('A1:D1');
    summarySheet.getCell('A1').value = 'Lead Export Summary';
    summarySheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF4F4F4F' } };
    summarySheet.getCell('A1').alignment = { horizontal: 'center' };

    // Add summary stats
    const stats = this.calculateLeadStats(leads);

    summarySheet.getCell('A3').value = 'Total Leads';
    summarySheet.getCell('B3').value = stats.totalLeads;
    summarySheet.getCell('B3').font = { bold: true };

    summarySheet.getCell('A4').value = 'High Potential';
    summarySheet.getCell('B4').value = stats.highPotential;
    summarySheet.getCell('B4').font = { color: { argb: 'FF00B050' }, bold: true };

    summarySheet.getCell('A5').value = 'Medium Potential';
    summarySheet.getCell('B5').value = stats.mediumPotential;
    summarySheet.getCell('B5').font = { color: { argb: 'FFFFC000' }, bold: true };

    summarySheet.getCell('A6').value = 'Low Potential';
    summarySheet.getCell('B6').value = stats.lowPotential;
    summarySheet.getCell('B6').font = { color: { argb: 'FFFF0000' }, bold: true };

    summarySheet.getCell('A7').value = 'Average Score';
    summarySheet.getCell('B7').value = stats.avgScore;

    summarySheet.getCell('A8').value = 'Export Date';
    summarySheet.getCell('B8').value = new Date().toISOString();

    // Sheet 2: Detailed Leads
    const detailsSheet = workbook.addWorksheet('Leads');

    // Define columns
    const columns = [
      { header: 'Company Name', key: 'companyName', width: 25 },
      { header: 'Website', key: 'website', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Website Status', key: 'websiteStatus', width: 18 },
      { header: 'Lead Score', key: 'leadScore', width: 12 },
      { header: 'Qualification Level', key: 'qualificationLevel', width: 20 },
      { header: 'SSL Enabled', key: 'sslEnabled', width: 12 },
      { header: 'Has Contact Page', key: 'hasContactPage', width: 18 },
      { header: 'Has Social Links', key: 'hasSocialLinks', width: 18 },
      { header: 'Response Time (ms)', key: 'responseTime', width: 18 },
      { header: 'Analyzed At', key: 'analyzedAt', width: 20 },
    ];

    detailsSheet.columns = columns;

    // Style header
    detailsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    detailsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F4F4F' },
    };
    detailsSheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Add data
    const dataRows = leads.map(lead => ({
      companyName: lead.companyName || '',
      website: lead.website || '',
      phone: lead.phone || '',
      email: lead.email || '',
      websiteStatus: lead.websiteStatus || '',
      leadScore: lead.leadScore || 0,
      qualificationLevel: lead.qualificationLevel || '',
      sslEnabled: lead.sslEnabled ? 'Yes' : 'No',
      hasContactPage: lead.hasContactPage ? 'Yes' : 'No',
      hasSocialLinks: lead.hasSocialLinks && Object.values(lead.hasSocialLinks).some(Boolean) ? 'Yes' : 'No',
      responseTime: lead.responseTime ? `${lead.responseTime}ms` : 'N/A',
      analyzedAt: lead.analyzedAt ? lead.analyzedAt.toISOString() : 'N/A',
    }));

    detailsSheet.addRows(dataRows);

    // Apply filters
    detailsSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };

    // Freeze header
    detailsSheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Style data rows
    detailsSheet.columns.forEach(column => {
      let maxWidth = (column.header || '').length;
      column.eachCell?.({ includeEmpty: true }, (cell: any) => {
        const cellLength = cell.value ? cell.value.toString().length : 0;
        if (cellLength > maxWidth) {
          maxWidth = cellLength;
        }
      });
      column.width = Math.min(maxWidth + 2, 40);
    });

    // Save workbook
    await workbook.xlsx.writeFile(filepath);

    return filepath;
  }

  /**
   * Calculate lead statistics
   */
  private calculateLeadStats(leads: any[]): {
    totalLeads: number;
    highPotential: number;
    mediumPotential: number;
    lowPotential: number;
    avgScore: number;
  } {
    const totalLeads = leads.length;
    let highPotential = 0;
    let mediumPotential = 0;
    let lowPotential = 0;
    let totalScore = 0;

    leads.forEach(lead => {
      const score = lead.leadScore || 0;
      totalScore += score;

      if (score >= 85) highPotential++;
      else if (score >= 60) mediumPotential++;
      else lowPotential++;
    });

    return {
      totalLeads,
      highPotential,
      mediumPotential,
      lowPotential,
      avgScore: totalLeads > 0 ? Math.round(totalScore / totalLeads) : 0,
    };
  }
}

export const excelExporter = new ExcelExporter();
