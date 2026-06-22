import { Router, Request, Response, NextFunction } from 'express';
import { whatsAppAIService } from '../services/whatsapp-ai.service';

const router = Router();

router.post('/start-campaign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadIds } = req.body;
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      res.status(400).json({ success: false, message: 'leadIds must be a non-empty array' });
      return;
    }
    const result = await whatsAppAIService.startCampaign(leadIds);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    next(error);
  }
});

router.get('/campaign-status/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const result = await whatsAppAIService.getSessionStatus(sessionId);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    next(error);
  }
});

router.post('/stop-campaign/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const result = await whatsAppAIService.stopCampaign(sessionId);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    next(error);
  }
});

export default router;
