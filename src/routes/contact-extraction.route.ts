import { Router } from 'express';
import { contactExtractorController } from '../controllers/contact-extractor.controller';
import { z } from 'zod';
import { validate } from '../utils/validations';

const router = Router();

// Schema for extraction requests
const extractionSchema = z.object({
  body: z.object({
    leadId: z.string().min(1, 'leadId is required'),
  }),
});

// Schema for bulk extraction
const bulkExtractionSchema = z.object({
  body: z.object({
    limit: z.number().min(1).max(100).optional().default(50),
  }),
});

// POST /api/v1/extract-contact - Extract contacts from a single lead
router.post('/', validate(extractionSchema), (req, res, next) => {
  contactExtractorController.extractContacts(req, res, next);
});

// POST /api/v1/extract-contact/bulk - Bulk extract contacts
router.post('/bulk', validate(bulkExtractionSchema), (req, res, next) => {
  contactExtractorController.bulkExtractContacts(req, res, next);
});

// POST /api/v1/extract-contact/crawl - Crawl website for contact info
router.post('/crawl', validate(extractionSchema), (req, res, next) => {
  contactExtractorController.crawlWebsite(req, res, next);
});

// POST /api/v1/extract-contact/social - Extract social media links
router.post('/social', validate(extractionSchema), (req, res, next) => {
  contactExtractorController.extractSocialLinks(req, res, next);
});

// POST /api/v1/extract-contact/owner - Detect owner/finder
router.post('/owner', validate(extractionSchema), (req, res, next) => {
  contactExtractorController.detectOwner(req, res, next);
});

// POST /api/v1/extract-contact/contact-pages - Detect contact pages
router.post('/contact-pages', validate(extractionSchema), (req, res, next) => {
  contactExtractorController.detectContactPages(req, res, next);
});

// POST /api/v1/extract-contact/full - Full extraction
router.post('/full', validate(extractionSchema), (req, res, next) => {
  contactExtractorController.fullExtraction(req, res, next);
});

export default router;
