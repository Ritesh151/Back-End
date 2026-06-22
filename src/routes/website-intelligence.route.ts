import { Router } from 'express'
import { asyncHandler } from '../utils/error-handler'
import { websiteIntelligenceController } from '../controllers/website-intelligence.controller'

const router = Router()

router.post('/analyze/:leadId', asyncHandler(websiteIntelligenceController.analyzeSingleLead.bind(websiteIntelligenceController)))
router.post('/reanalyze/:leadId', asyncHandler(websiteIntelligenceController.reanalyzeLead.bind(websiteIntelligenceController)))
router.post('/analyze-bulk', asyncHandler(websiteIntelligenceController.analyzeMultipleLeads.bind(websiteIntelligenceController)))
router.get('/stats', asyncHandler(websiteIntelligenceController.getIntelligenceStats.bind(websiteIntelligenceController)))

export default router
