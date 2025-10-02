import express from 'express';
import { getAllWebsites, getWebsite, createWebsite, updateWebsite, deleteWebsite, updateWebsiteSettings, validateWebsite } from '../controllers/websites/websiteManagementController.js';
import { validateWebsiteWithOrigin } from '../controllers/websites/websitesController.js';
import { authenticate, checkUsageLimit } from '../middleware/auth.js';
import { websiteValidation } from '../middleware/validation.js';

const router = express.Router();

// Website CRUD operations
router.get('/', authenticate, getAllWebsites);
router.get('/:id', authenticate, getWebsite);
router.post('/', authenticate, checkUsageLimit('websites'), websiteValidation, createWebsite);
router.put('/:id', authenticate, websiteValidation, updateWebsite);
router.delete('/:id', authenticate, deleteWebsite);

// Website settings management
router.put('/:id/settings', authenticate, updateWebsiteSettings);

// Website validation (public endpoint)
router.post('/validate', validateWebsite);

// Website validation with origin checking (for tracking endpoints)
router.post('/validate-origin', validateWebsiteWithOrigin);

export default router;