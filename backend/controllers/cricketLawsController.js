/**
 * controllers/cricketLawsController.js
 * Controller for MCC Cricket Laws API + Calculation Settings API
 */

const cricketLawsService = require('../services/cricketLawsService');
const dlsService = require('../services/dlsService');
const vjdService = require('../services/vjdService');

// ─────────────────────────────────────────────────────────────────────────────
// Public Endpoints
// ─────────────────────────────────────────────────────────────────────────────

exports.getAllLaws = async (req, res) => {
  try {
    const { category, search, isAmended } = req.query;
    const laws = await cricketLawsService.getAllLaws({ category, search, isAmended });
    res.json({ success: true, laws, total: laws.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getLawById = async (req, res) => {
  try {
    const law = await cricketLawsService.getLawById(req.params.id);
    if (!law) return res.status(404).json({ success: false, error: 'Law not found' });
    res.json({ success: true, law });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.searchLaws = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1) {
      return res.json({ success: true, results: [], total: 0 });
    }
    const results = await cricketLawsService.searchLaws(q);
    res.json({ success: true, results, total: results.length, query: q });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getLawCategories = async (req, res) => {
  try {
    const categories = await cricketLawsService.getLawCategories();
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getLawStats = async (req, res) => {
  try {
    const stats = await cricketLawsService.getLawStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Admin Endpoints
// ─────────────────────────────────────────────────────────────────────────────

exports.createLaw = async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'admin@cfvd.org';
    const adminName = req.adminUser?.name || 'Administrator';
    const law = await cricketLawsService.createLaw(req.body, adminEmail, adminName);
    res.status(201).json({ success: true, message: 'Law created successfully', law });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.updateLaw = async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'admin@cfvd.org';
    const adminName = req.adminUser?.name || 'Administrator';
    const law = await cricketLawsService.updateLaw(req.params.id, req.body, adminEmail, adminName);
    res.json({ success: true, message: 'Law updated successfully', law });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.addSection = async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'admin@cfvd.org';
    const adminName = req.adminUser?.name || 'Administrator';
    const section = await cricketLawsService.addSection(req.params.id, req.body, adminEmail, adminName);
    res.status(201).json({ success: true, message: 'Section added successfully', section });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.publishLaw = async (req, res) => {
  try {
    const adminEmail = req.adminUser?.email || 'admin@cfvd.org';
    const adminName = req.adminUser?.name || 'Administrator';
    const law = await cricketLawsService.publishLaw(req.params.id, adminEmail, adminName);
    res.json({ success: true, message: `Law ${law.law_number} published successfully`, law });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const { lawId, limit } = req.query;
    const logs = await cricketLawsService.getAuditLogs({ lawId, limit: parseInt(limit, 10) || 50 });
    res.json({ success: true, logs, total: logs.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Tournament Calculation Settings
// ─────────────────────────────────────────────────────────────────────────────

exports.getCalculationSettings = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const settings = await cricketLawsService.getCalculationSettings(tournamentId);
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateCalculationSettings = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { calculation_method } = req.body;
    const adminEmail = req.adminUser?.email || 'admin@cfvd.org';
    const adminName = req.adminUser?.name || 'Administrator';

    if (!calculation_method) {
      return res.status(400).json({ success: false, error: 'calculation_method is required (DLS or VJD)' });
    }

    const settings = await cricketLawsService.updateCalculationSettings(
      tournamentId, calculation_method, adminEmail, adminName
    );

    res.json({
      success: true,
      message: `Calculation method updated to ${calculation_method} for tournament ${tournamentId}`,
      settings
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DLS / VJD Live Calculation
// ─────────────────────────────────────────────────────────────────────────────

exports.calculatePrediction = async (req, res) => {
  try {
    const { tournamentId, method, ...params } = req.body;

    // Get active method from tournament settings if not specified
    let activeMethod = method;
    if (!activeMethod && tournamentId) {
      const settings = await cricketLawsService.getCalculationSettings(tournamentId);
      activeMethod = settings?.calculation_method || 'DLS';
    }
    activeMethod = (activeMethod || 'DLS').toUpperCase();

    let result;
    if (activeMethod === 'DLS') {
      result = dlsService.getDLSPrediction(params);
    } else if (activeMethod === 'VJD') {
      result = vjdService.getVJDPrediction(params);
    } else {
      return res.status(400).json({ success: false, error: `Unknown method: ${activeMethod}` });
    }

    res.json({ success: true, method: activeMethod, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
