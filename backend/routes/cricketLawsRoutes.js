/**
 * routes/cricketLawsRoutes.js
 * MCC Cricket Laws API Routes + Tournament Calculation Settings
 * Public read endpoints + Admin-protected write endpoints
 */

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/cricketLawsController');
const { requireAdminAuth } = require('../middleware/authMiddleware');
const { cacheResponse } = require('../middleware/cacheMiddleware');

// ── Public Read Endpoints ────────────────────────────────────────────────────

// GET /api/cricket-laws – list all 42 laws (with optional ?category=&search=&isAmended=)
router.get('/', cacheResponse(60, 'cricket-laws'), ctrl.getAllLaws);

// GET /api/cricket-laws/stats – dashboard statistics
router.get('/stats', cacheResponse(60, 'cricket-laws'), ctrl.getLawStats);

// GET /api/cricket-laws/search?q= – keyword search across laws and sections
router.get('/search', ctrl.searchLaws);

// GET /api/cricket-laws/categories – get category list with counts
router.get('/categories', cacheResponse(60, 'cricket-laws'), ctrl.getLawCategories);

// GET /api/cricket-laws/:id – single law with full nested section tree
router.get('/:id', cacheResponse(60, 'cricket-laws'), ctrl.getLawById);

module.exports = router;
