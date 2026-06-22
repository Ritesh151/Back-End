import { Router } from 'express';
import { leadFiltersController } from '../controllers/lead-filters.controller';

const router = Router();

// Get all states
router.get('/states', leadFiltersController.getStates.bind(leadFiltersController));

// Get cities for a state
router.get('/cities', leadFiltersController.getCities.bind(leadFiltersController));

// Get areas for a city
router.get('/areas', leadFiltersController.getAreas.bind(leadFiltersController));

export const leadFiltersRoute = router;
