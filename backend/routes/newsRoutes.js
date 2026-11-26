/**
 * routes/newsRoutes.js
 * News, Announcements, Match Reports and Media Content APIs
 */

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken } = require('../middleware/authMiddleware');
const { cacheResponse, invalidateCache } = require('../middleware/cacheMiddleware');

function escapeRegex(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/news
 * List news articles with category, search filter, and pagination
 */
router.get('/', cacheResponse(30, 'news'), async (req, res) => {
  try {
    const { category, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = { status: 'PUBLISHED' };

    if (category && category !== 'ALL') {
      const safeCategory = escapeRegex(category.trim());
      query.category = new RegExp(`^${safeCategory}$`, 'i');
    }
    if (search && search.trim()) {
      const safeSearch = escapeRegex(search.trim());
      query.$or = [
        { title: new RegExp(safeSearch, 'i') },
        { summary: new RegExp(safeSearch, 'i') },
        { content: new RegExp(safeSearch, 'i') }
      ];
    }

    const [total, newsList] = await Promise.all([
      db.models.News.countDocuments(query),
      db.models.News.find(query)
        .select('id title summary category author image_url published_at created_at')
        .sort({ published_at: -1, created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    res.json({
      success: true,
      data: newsList,
      count: newsList.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/news/gallery
 * Media gallery items
 */
router.get('/gallery', async (req, res) => {
  res.json({
    success: true,
    gallery: [
      { id: 'GAL-01', title: 'VPL 2026 Opening Day Action', type: 'IMAGE', url: '/assets_web/champions.jpg', caption: 'Teams taking the field on opening day' },
      { id: 'GAL-02', title: 'Kamarajar Stadium Pavilion', type: 'IMAGE', url: '/assets_web/stadium.jpg', caption: 'District Cricket Association Pavilion' },
      { id: 'GAL-03', title: 'Dinesh Karthik 72 runs match winning knock', type: 'IMAGE', url: '/assets_web/batsman.jpg', caption: 'Sensational cover drive by Dinesh Karthik' }
    ]
  });
});

/**
 * GET /api/news/:id
 * Get single news article
 */
router.get('/:id', async (req, res) => {
  try {
    await db.initDb();
    const article = await db.models.News.findOne({ id: req.params.id }).lean();
    if (!article) return res.status(404).json({ success: false, error: 'Article not found' });
    res.json({ success: true, data: article });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/news
 * Create news or announcement (Protected: CONTENT or ADMIN)
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const userRole = (req.user && req.user.role || '').toUpperCase();
    if (userRole !== 'CONTENT' && userRole !== 'CONTENT_CREATOR' && userRole !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: Only Content Staff or Admin can publish news.' });
    }

    const { title, summary, content, category, imageUrl } = req.body;
    if (!title || !summary || !content) {
      return res.status(400).json({ success: false, error: 'Title, summary, and content are required.' });
    }

    const id = `NEWS-${Date.now()}`;
    const article = await db.models.News.create({
      id,
      title: title.trim(),
      summary: summary.trim(),
      content: content.trim(),
      category: category || 'ANNOUNCEMENT',
      author: req.user.name || 'Association Editorial Team',
      image_url: imageUrl || '/assets_web/champions.jpg',
      status: 'PUBLISHED',
      published_at: new Date()
    });

    invalidateCache('news');
    res.status(201).json({ success: true, message: 'News article published successfully', data: article });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/news/:id
 * Edit news (Protected: CONTENT or ADMIN)
 */
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const userRole = (req.user && req.user.role || '').toUpperCase();
    if (userRole !== 'CONTENT' && userRole !== 'CONTENT_CREATOR' && userRole !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const updated = await db.models.News.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { returnDocument: 'after' }
    ).lean();

    if (!updated) return res.status(404).json({ success: false, error: 'Article not found' });
    invalidateCache('news');
    res.json({ success: true, message: 'Article updated successfully', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/news/:id
 * Delete news article (Protected: CONTENT or ADMIN)
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const userRole = (req.user && req.user.role || '').toUpperCase();
    if (userRole !== 'ADMIN' && userRole !== 'CONTENT' && userRole !== 'CONTENT_CREATOR') {
      return res.status(403).json({ success: false, message: 'Forbidden: Only Admin can delete news articles.' });
    }

    const deleted = await db.models.News.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ success: false, error: 'Article not found' });
    invalidateCache('news');
    res.json({ success: true, message: 'Article deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
