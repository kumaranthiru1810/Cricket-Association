/**
 * backend/models/News.js
 * News Mongoose Model
 */

const mongoose = require('mongoose');

const NewsSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  summary: { type: String, required: true },
  content: { type: String, required: true },
  category: { type: String, default: 'ANNOUNCEMENT' },
  author: { type: String, default: 'District Secretary' },
  image_url: { type: String, default: '/assets_web/stadium.jpg' },
  status: { type: String, default: 'PUBLISHED' }
}, { timestamps: true });

NewsSchema.index({ status: 1, created_at: -1 });

const News = mongoose.models.News || mongoose.model('News', NewsSchema);

module.exports = { News, NewsSchema };
