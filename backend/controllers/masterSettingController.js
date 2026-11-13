/**
 * controllers/masterSettingController.js
 * Controller for Master Settings and Dynamic Subcategories:
 * - Taluk Jurisdiction
 * - Playing Role
 * - Batting Style
 * - Age Category
 * - Certification Level
 * - Umpire Certification / Qualification
 * - State
 */

const masterSettingModel = require('../models/masterSettingModel');
const db = require('../config/db');

class MasterSettingController {
  /**
   * GET /api/admin/master-settings or /api/master-settings
   * Query params:
   *  - category (optional)
   *  - includeInactive (optional)
   */
  async getSettings(req, res) {
    try {
      const { category, includeInactive } = req.query;
      const items = await masterSettingModel.getAll({
        category: category || null,
        includeInactive: includeInactive === 'true'
      });
      const grouped = await masterSettingModel.getGrouped({
        items,
        includeInactive: includeInactive === 'true'
      });

      return res.status(200).json({
        success: true,
        count: items.length,
        category: category || null,
        data: items,
        grouped,
        categories: masterSettingModel.validCategories.map(cat => ({
          key: cat,
          label: masterSettingModel.categoryMeta[cat]?.label || cat,
          description: masterSettingModel.categoryMeta[cat]?.description || ''
        }))
      });
    } catch (err) {
      console.error('[MasterSettingController] getSettings error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch master settings'
      });
    }
  }

  /**
   * POST /api/admin/master-settings
   * Body: { category, name, code, description, sort_order }
   */
  async createSetting(req, res) {
    try {
      const { category, name, code, description, sort_order } = req.body;
      if (!category || !name) {
        return res.status(400).json({
          success: false,
          message: 'Both category and name are required.'
        });
      }

      const created = await masterSettingModel.create({
        category,
        name,
        code,
        description,
        sort_order
      });

      return res.status(201).json({
        success: true,
        message: `Added "${created.name}" to ${masterSettingModel.categoryMeta[created.category]?.label || created.category}.`,
        data: created
      });
    } catch (err) {
      console.error('[MasterSettingController] createSetting error:', err);
      return res.status(400).json({
        success: false,
        message: err.message || 'Failed to create setting option'
      });
    }
  }

  /**
   * PUT /api/admin/master-settings/:id
   * Body: { name, code, description, is_active, sort_order }
   */
  async updateSetting(req, res) {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Option ID is required.'
        });
      }

      const updated = await masterSettingModel.update(id, req.body);
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Setting option not found.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Option updated successfully.',
        data: updated
      });
    } catch (err) {
      console.error('[MasterSettingController] updateSetting error:', err);
      return res.status(400).json({
        success: false,
        message: err.message || 'Failed to update setting option'
      });
    }
  }

  /**
   * DELETE /api/admin/master-settings/:id
   */
  async deleteSetting(req, res) {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Option ID is required.'
        });
      }

      const deleted = await masterSettingModel.delete(id);
      return res.status(200).json({
        success: true,
        message: `Deleted "${deleted.name}" successfully.`,
        data: deleted
      });
    } catch (err) {
      console.error('[MasterSettingController] deleteSetting error:', err);
      return res.status(400).json({
        success: false,
        message: err.message || 'Failed to delete setting option'
      });
    }
  }
}

module.exports = new MasterSettingController();

