/**
 * models/contentModel.js
 * Pure MongoDB News, Announcements, Match Reports & Media Content Model
 */

const db = require('../config/db');

function escapeRegex(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class ContentModel {
  get Model() {
    return db.models.News;
  }

  /**
   * List all content articles with optional filters
   * @param {Object} filters
   * @param {string} [filters.category]
   * @param {string} [filters.status]
   * @param {string} [filters.search]
   * @param {number} [filters.limit=100]
   */
  async getAll({ category, status, search, limit = 100 } = {}) {
    await db.initDb();
    const query = {};

    if (category && category !== 'ALL') {
      const safeCat = escapeRegex(category.trim());
      query.category = new RegExp(`^${safeCat}$`, 'i');
    }

    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }

    if (search && search.trim()) {
      const q = escapeRegex(search.trim());
      query.$or = [
        { title: new RegExp(q, 'i') },
        { summary: new RegExp(q, 'i') },
        { content: new RegExp(q, 'i') },
        { author: new RegExp(q, 'i') }
      ];
    }

    return this.Model.find(query)
      .sort({ published_at: -1, _id: -1 })
      .limit(parseInt(limit, 10))
      .lean();
  }

  /**
   * Find a single article by ID
   * @param {string} id 
   */
  async getById(id) {
    if (!id) return null;
    await db.initDb();
    return this.Model.findOne({
      $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }]
    }).lean();
  }

  /**
   * Create and publish a new content article
   */
  async create({ title, summary, content, category, author, image_url, imageUrl, status, created_by }) {
    if (!title || !summary || !content) {
      throw new Error('Title, summary, and content are required.');
    }
    await db.initDb();

    const id = `NEWS-${Date.now()}`;
    const article = await this.Model.create({
      id,
      title: title.trim(),
      summary: summary.trim(),
      content: content.trim(),
      category: (category || 'ANNOUNCEMENT').toUpperCase(),
      author: author ? author.trim() : 'CFVD Secretariat',
      image_url: image_url || imageUrl || 'assets/champions.jpg',
      status: (status || 'PUBLISHED').toUpperCase(),
      published_at: new Date()
    });

    return article.toObject ? article.toObject() : article;
  }

  /**
   * Update an existing article
   */
  async update(id, updateData) {
    if (!id) throw new Error('Article ID is required for update.');
    await db.initDb();

    const allowed = ['title', 'summary', 'content', 'category', 'author', 'image_url', 'status'];
    const update = {};
    for (const key of allowed) {
      if (updateData[key] !== undefined) {
        update[key] = typeof updateData[key] === 'string' ? updateData[key].trim() : updateData[key];
      }
    }
    if (updateData.imageUrl && !update.image_url) {
      update.image_url = updateData.imageUrl;
    }
    if (update.category) {
      update.category = update.category.toUpperCase();
    }
    if (update.status) {
      update.status = update.status.toUpperCase();
    }

    const updated = await this.Model.findOneAndUpdate(
      { $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
      { $set: update },
      { returnDocument: 'after' }
    ).lean();

    return updated;
  }

  /**
   * Delete an article
   */
  async delete(id) {
    if (!id) throw new Error('Article ID is required.');
    await db.initDb();
    const deleted = await this.Model.findOneAndDelete({
      $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }]
    });
    return !!deleted;
  }

  /**
   * Get statistics summary for content
   */
  async getStats() {
    await db.initDb();
    const [total, announcements, tournaments, reports, trials, pressReleases] = await Promise.all([
      this.Model.countDocuments(),
      this.Model.countDocuments({ category: 'ANNOUNCEMENT' }),
      this.Model.countDocuments({ category: 'TOURNAMENT' }),
      this.Model.countDocuments({ category: 'MATCH_REPORT' }),
      this.Model.countDocuments({ category: 'SELECTION_TRIALS' }),
      this.Model.countDocuments({ category: 'PRESS_RELEASE' })
    ]);

    return {
      total,
      announcements,
      tournaments,
      reports,
      trials,
      pressReleases
    };
  }
}

module.exports = new ContentModel();
