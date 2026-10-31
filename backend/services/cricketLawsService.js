/**
 * services/cricketLawsService.js
 * MCC Cricket Laws – Database Service Layer
 * MCC 2017 Code – Fourth Edition 2026, Effective 1 October 2026
 */

const db = require('../config/db');

const { v4: uuidv4 } = (() => {
  try { return require('crypto'); } catch (_) { return { v4: () => Math.random().toString(36).slice(2) }; }
})();

function generateId(prefix) {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public APIs
// ─────────────────────────────────────────────────────────────────────────────

async function getAllLaws({ category, search, isAmended } = {}) {
  await db.initDb();
  const { CricketLaw, CricketLawSection } = db.models;

  const filter = { is_active: true };
  if (category && category !== 'ALL') filter.category = category;
  if (isAmended === 'true') filter.is_amended_2026 = true;
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { short_description: { $regex: search, $options: 'i' } },
      { amendment_notes: { $regex: search, $options: 'i' } }
    ];
  }

  const laws = await CricketLaw.find(filter).sort({ law_number: 1 }).lean();

  // Attach section counts
  const counts = await CricketLawSection.aggregate([
    { $match: { is_active: true, depth: 1 } },
    { $group: { _id: '$law_id', count: { $sum: 1 } } }
  ]);
  const countMap = {};
  counts.forEach(c => { countMap[c._id] = c.count; });

  return laws.map(l => ({
    ...l,
    subsection_count: countMap[l.id] || l.subsection_count || 0
  }));
}

async function getLawById(id) {
  await db.initDb();
  const { CricketLaw, CricketLawSection } = db.models;

  const law = await CricketLaw.findOne({ $or: [{ id }, { law_number: parseInt(id, 10) }], is_active: true }).lean();
  if (!law) return null;

  const sections = await CricketLawSection.find({ law_id: law.id, is_active: true }).sort({ display_order: 1 }).lean();

  // Build nested section tree
  const topLevel = sections.filter(s => !s.parent_section_id);
  const buildTree = (parentId) => {
    return sections
      .filter(s => s.parent_section_id === parentId)
      .sort((a, b) => a.display_order - b.display_order)
      .map(s => ({ ...s, children: buildTree(s.id) }));
  };

  const sectionTree = topLevel.map(s => ({ ...s, children: buildTree(s.id) }));

  return { ...law, sections: sectionTree };
}

async function searchLaws(query) {
  await db.initDb();
  const { CricketLaw, CricketLawSection } = db.models;

  if (!query || query.trim().length < 1) return [];

  const q = query.trim();
  const numQ = parseFloat(q);
  const isNum = !isNaN(numQ);

  const lawFilter = {
    is_active: true,
    $or: [
      { title: { $regex: q, $options: 'i' } },
      { short_description: { $regex: q, $options: 'i' } },
      { amendment_notes: { $regex: q, $options: 'i' } }
    ]
  };
  if (isNum && Number.isInteger(numQ)) {
    lawFilter.$or.push({ law_number: numQ });
  }

  const sectionFilter = {
    is_active: true,
    $or: [
      { section_number: { $regex: q, $options: 'i' } },
      { section_title: { $regex: q, $options: 'i' } },
      { explanation: { $regex: q, $options: 'i' } },
      { practical_example: { $regex: q, $options: 'i' } }
    ]
  };

  const [matchedLaws, matchedSections] = await Promise.all([
    CricketLaw.find(lawFilter).sort({ law_number: 1 }).lean(),
    CricketLawSection.find(sectionFilter).sort({ law_number: 1, display_order: 1 }).lean()
  ]);

  // Get laws for matched sections
  const sectionLawIds = [...new Set(matchedSections.map(s => s.law_id))];
  const sectionLaws = sectionLawIds.length
    ? await CricketLaw.find({ id: { $in: sectionLawIds }, is_active: true }).lean()
    : [];

  // Merge results
  const lawMap = {};
  matchedLaws.forEach(l => { lawMap[l.id] = { ...l, matchedSections: [], matchType: 'LAW' }; });
  sectionLaws.forEach(l => {
    if (!lawMap[l.id]) lawMap[l.id] = { ...l, matchedSections: [], matchType: 'SECTION' };
  });
  matchedSections.forEach(s => {
    if (lawMap[s.law_id]) {
      lawMap[s.law_id].matchedSections.push(s);
    }
  });

  return Object.values(lawMap).sort((a, b) => a.law_number - b.law_number);
}

async function getLawCategories() {
  await db.initDb();
  const { CricketLaw } = db.models;
  const cats = await CricketLaw.aggregate([
    { $match: { is_active: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
  return cats.map(c => ({ category: c._id, count: c.count }));
}

async function getLawStats() {
  await db.initDb();
  const { CricketLaw, CricketLawSection } = db.models;
  const [totalLaws, totalSections, updatedLaws, categories] = await Promise.all([
    CricketLaw.countDocuments({ is_active: true }),
    CricketLawSection.countDocuments({ is_active: true }),
    CricketLaw.countDocuments({ is_active: true, is_amended_2026: true }),
    CricketLaw.distinct('category', { is_active: true })
  ]);
  return {
    totalLaws,
    totalSections,
    updatedLaws,
    totalCategories: categories.length,
    edition: '2017 Code – Fourth Edition 2026',
    effectiveDate: '1 October 2026',
    source: 'Marylebone Cricket Club (MCC)',
    sourceUrl: 'https://lawsofcricket.lords.org/'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin APIs
// ─────────────────────────────────────────────────────────────────────────────

async function createLaw(data, adminEmail, adminName) {
  await db.initDb();
  const { CricketLaw, CricketLawVersion, CricketLawAuditLog } = db.models;

  const id = generateId('LAW');
  const law = await CricketLaw.create({
    id,
    law_number: data.law_number,
    title: data.title,
    short_description: data.short_description || '',
    category: data.category || 'General',
    edition: data.edition || '2017 Code – Fourth Edition 2026',
    effective_date: data.effective_date || '1 October 2026',
    source_url: data.source_url || 'https://lawsofcricket.lords.org/',
    is_amended_2026: data.is_amended_2026 || false,
    amendment_notes: data.amendment_notes || '',
    display_order: data.law_number,
    is_active: true,
    last_verified_at: new Date()
  });

  // Create version record
  await CricketLawVersion.create({
    id: generateId('VER'),
    law_id: id,
    law_number: data.law_number,
    edition: data.edition || '2017 Code – Fourth Edition 2026',
    amendment_notes: data.amendment_notes || '',
    effective_date: data.effective_date || '1 October 2026',
    is_current: true
  });

  // Audit log
  await CricketLawAuditLog.create({
    id: generateId('AUDIT'),
    law_id: id,
    law_number: data.law_number,
    action: 'CREATE',
    updated_by: adminName || 'Administrator',
    updated_by_email: adminEmail || '',
    previous_version: null,
    new_version: law.toObject(),
    notes: `Law ${data.law_number} created`
  });

  return law;
}

async function updateLaw(lawId, data, adminEmail, adminName) {
  await db.initDb();
  const { CricketLaw, CricketLawAuditLog } = db.models;

  const existing = await CricketLaw.findOne({ id: lawId }).lean();
  if (!existing) throw new Error(`Law with id '${lawId}' not found`);

  const updated = await CricketLaw.findOneAndUpdate(
    { id: lawId },
    { $set: { ...data, last_verified_at: new Date() } },
    { new: true }
  ).lean();

  await CricketLawAuditLog.create({
    id: generateId('AUDIT'),
    law_id: lawId,
    law_number: existing.law_number,
    action: 'UPDATE',
    updated_by: adminName || 'Administrator',
    updated_by_email: adminEmail || '',
    previous_version: existing,
    new_version: updated,
    notes: `Law ${existing.law_number} updated`
  });

  return updated;
}

async function addSection(lawId, sectionData, adminEmail, adminName) {
  await db.initDb();
  const { CricketLaw, CricketLawSection, CricketLawAuditLog } = db.models;

  const law = await CricketLaw.findOne({ id: lawId }).lean();
  if (!law) throw new Error(`Law '${lawId}' not found`);

  const sectionId = generateId('SEC');
  const depth = sectionData.parent_section_id ? 2 : 1;

  const section = await CricketLawSection.create({
    id: sectionId,
    law_id: lawId,
    law_number: law.law_number,
    section_number: sectionData.section_number,
    section_title: sectionData.section_title,
    explanation: sectionData.explanation || '',
    detailed_explanation: sectionData.detailed_explanation || '',
    practical_example: sectionData.practical_example || '',
    parent_section_id: sectionData.parent_section_id || null,
    depth,
    display_order: sectionData.display_order || 0,
    is_active: true
  });

  // Update subsection count
  const count = await CricketLawSection.countDocuments({ law_id: lawId, is_active: true, depth: 1 });
  await CricketLaw.updateOne({ id: lawId }, { $set: { subsection_count: count } });

  await CricketLawAuditLog.create({
    id: generateId('AUDIT'),
    law_id: lawId,
    law_number: law.law_number,
    action: 'SECTION_ADD',
    updated_by: adminName || 'Administrator',
    updated_by_email: adminEmail || '',
    previous_version: null,
    new_version: section.toObject(),
    notes: `Section ${sectionData.section_number} added to Law ${law.law_number}`
  });

  return section;
}

async function publishLaw(lawId, adminEmail, adminName) {
  await db.initDb();
  const { CricketLaw, CricketLawAuditLog } = db.models;

  const law = await CricketLaw.findOneAndUpdate(
    { id: lawId },
    { $set: { is_active: true, last_verified_at: new Date() } },
    { new: true }
  ).lean();

  if (!law) throw new Error(`Law '${lawId}' not found`);

  await CricketLawAuditLog.create({
    id: generateId('AUDIT'),
    law_id: lawId,
    law_number: law.law_number,
    action: 'PUBLISH',
    updated_by: adminName || 'Administrator',
    updated_by_email: adminEmail || '',
    previous_version: null,
    new_version: law,
    notes: `Law ${law.law_number} published by ${adminName || adminEmail}`
  });

  return law;
}

async function getAuditLogs({ lawId, limit = 50 } = {}) {
  await db.initDb();
  const { CricketLawAuditLog } = db.models;
  const filter = lawId ? { law_id: lawId } : {};
  return CricketLawAuditLog.find(filter).sort({ timestamp: -1 }).limit(limit).lean();
}

// ─────────────────────────────────────────────────────────────────────────────
// Tournament Calculation Settings
// ─────────────────────────────────────────────────────────────────────────────

async function getCalculationSettings(tournamentId) {
  await db.initDb();
  const { TournamentCalculation, Tournament } = db.models;

  let setting = await TournamentCalculation.findOne({ tournament_id: tournamentId }).lean();
  if (!setting) {
    // Return default setting (DLS) if not configured yet
    const tournament = await Tournament.findOne({ id: tournamentId }).lean();
    setting = {
      tournament_id: tournamentId,
      tournament_name: tournament?.name || '',
      calculation_method: 'DLS',
      updated_by: 'Default',
      updated_at: null,
      is_default: true
    };
  }
  return setting;
}

async function updateCalculationSettings(tournamentId, method, adminEmail, adminName) {
  await db.initDb();
  const { TournamentCalculation, Tournament } = db.models;

  if (!['DLS', 'VJD'].includes(method)) {
    throw new Error(`Invalid calculation method '${method}'. Must be 'DLS' or 'VJD'.`);
  }

  const tournament = await Tournament.findOne({ id: tournamentId }).lean();
  if (!tournament) throw new Error(`Tournament '${tournamentId}' not found`);

  const existing = await TournamentCalculation.findOne({ tournament_id: tournamentId });

  if (existing) {
    existing.calculation_method = method;
    existing.updated_by = adminEmail || 'admin@cfvd.org';
    existing.updated_by_name = adminName || 'Administrator';
    existing.updated_at = new Date();
    await existing.save();
    return existing.toObject();
  } else {
    const setting = await TournamentCalculation.create({
      id: generateId('CALC'),
      tournament_id: tournamentId,
      tournament_name: tournament.name,
      calculation_method: method,
      updated_by: adminEmail || 'admin@cfvd.org',
      updated_by_name: adminName || 'Administrator',
      updated_at: new Date()
    });
    return setting.toObject();
  }
}

module.exports = {
  getAllLaws,
  getLawById,
  searchLaws,
  getLawCategories,
  getLawStats,
  createLaw,
  updateLaw,
  addSection,
  publishLaw,
  getAuditLogs,
  getCalculationSettings,
  updateCalculationSettings
};
