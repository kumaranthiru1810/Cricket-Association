/**
 * tests/test_player_details_validation.js
 * Comprehensive tests for Club/Academy, Studying, and Working validation.
 */

const assert = require('assert');
const {
  normalizeSpaces,
  validatePersonName,
  validateClubOrAcademyName,
  validateStudyingInstitution,
  validateStudyLevel,
  validateStudyBranchOrClass,
  validateWorkingInstitution,
  validateDeclarationDate,
  validateDeclarationPlace,
  validateIndianMobile
} = require('../utils/playerDetailsValidation');
const { validateBody, playerRegistrationSchema } = require('../middleware/validationMiddleware');
const playerAuth = require('../services/auth/playerAuth');

function runMockValidation(schema, body) {
  let status = 200;
  let jsonResponse = null;
  let nextCalled = false;

  const req = { body };
  const res = {
    status(code) { status = code; return this; },
    json(payload) { jsonResponse = payload; return this; }
  };
  const next = () => { nextCalled = true; };

  validateBody(schema)(req, res, next);
  return { status, jsonResponse, nextCalled, validatedBody: req.body };
}

async function run() {
  console.log('\n=== PLAYER DETAILS VALIDATION TESTS ===\n');

  // 1. Club / School / College / Academy Name
  assert.strictEqual(validateClubOrAcademyName('').isValid, false);
  assert.strictEqual(validateClubOrAcademyName('   \t  ').isValid, false);
  assert.strictEqual(validateClubOrAcademyName('AB').isValid, false);
  assert.strictEqual(validateClubOrAcademyName('A'.repeat(101)).isValid, false);
  assert.strictEqual(validateClubOrAcademyName('123456').isValid, false);
  assert.strictEqual(validateClubOrAcademyName('---...&&&').isValid, false);
  assert.strictEqual(validateClubOrAcademyName('Strikers @ Club').isValid, false);

  const clubOk = validateClubOrAcademyName("  St. Xavier's   Cricket & Sports-Club  ");
  assert.strictEqual(clubOk.isValid, true);
  assert.strictEqual(clubOk.normalized, "St. Xavier's Cricket & Sports-Club");
  console.log('PASS 1: Club / School / College / Academy validation');

  // 2. Studying Institution Name
  assert.strictEqual(validateStudyingInstitution('').isValid, false);
  assert.strictEqual(validateStudyingInstitution('   ').isValid, false);
  assert.strictEqual(validateStudyingInstitution('AB').isValid, false);
  assert.strictEqual(validateStudyingInstitution('A'.repeat(121)).isValid, false);
  assert.strictEqual(validateStudyingInstitution('98765').isValid, false);
  assert.strictEqual(validateStudyingInstitution('@@@###').isValid, false);

  const studyOk = validateStudyingInstitution("  V.H.N.S.N.   College,  Virudhunagar  ");
  assert.strictEqual(studyOk.isValid, true);
  assert.strictEqual(studyOk.normalized, 'V.H.N.S.N. College, Virudhunagar');
  console.log('PASS 2: Studying institution validation');

  // 3. Institution Type (COLLEGE / SCHOOL)
  assert.strictEqual(validateStudyLevel('').isValid, false);
  assert.strictEqual(validateStudyLevel('UNIVERSITY').isValid, false);
  assert.strictEqual(validateStudyLevel('COLLEGE').isValid, true);
  assert.strictEqual(validateStudyLevel('SCHOOL').isValid, true);
  console.log('PASS 3: Studying institution type validation');

  // 4. Branch / Year / Section & Class / Section
  assert.strictEqual(validateStudyBranchOrClass('', 'COLLEGE').isValid, false);
  assert.strictEqual(validateStudyBranchOrClass('   ', 'COLLEGE').isValid, false);
  assert.strictEqual(validateStudyBranchOrClass('A', 'COLLEGE').isValid, false);
  assert.strictEqual(validateStudyBranchOrClass('A'.repeat(101), 'COLLEGE').isValid, false);
  assert.strictEqual(validateStudyBranchOrClass('---///', 'COLLEGE').isValid, false);
  assert.strictEqual(validateStudyBranchOrClass('B.Sc @ CS', 'COLLEGE').isValid, false);

  for (const validFmt of [
    'B.Sc Computer Science - III Year - A',
    'B.Com - II Year - B',
    '10th Standard - A Section',
    'B.E. CSE / IV Year & Sec A'
  ]) {
    assert.strictEqual(validateStudyBranchOrClass(validFmt, 'COLLEGE').isValid, true, `Should accept: ${validFmt}`);
  }
  console.log('PASS 4: Branch / Year / Section and Class / Section validation');

  // 5. Working Institution Name
  assert.strictEqual(validateWorkingInstitution('').isValid, false);
  assert.strictEqual(validateWorkingInstitution('   ').isValid, false);
  assert.strictEqual(validateWorkingInstitution('AB').isValid, false);
  assert.strictEqual(validateWorkingInstitution('A'.repeat(121)).isValid, false);
  assert.strictEqual(validateWorkingInstitution('1234567').isValid, false);
  assert.strictEqual(validateWorkingInstitution('...---').isValid, false);
  assert.strictEqual(validateWorkingInstitution('SBI @ Branch').isValid, false);

  const workOk = validateWorkingInstitution('  State   Bank of India (Main Branch),  Virudhunagar  ');
  assert.strictEqual(workOk.isValid, true);
  assert.strictEqual(workOk.normalized, 'State Bank of India (Main Branch), Virudhunagar');
  console.log('PASS 5: Working institution validation');

  // 6. Middleware conditional validation (STUDYING, WORKING, NONE/Other)
  const base = {
    name: 'M. Saravanan',
    fatherName: 'R. Mahalingam',
    email: 'saravanan@example.com',
    mobile: '9876543210',
    address: '12, Gandhi Nagar, Virudhunagar - 626001',
    clubChoice: '  Virudhunagar   Strikers CC  ',
    declarationPlace: 'Virudhunagar',
    declarationDate: '2026-11-28'
  };

  // 5C. Declaration Date & Declaration Place
  assert.strictEqual(validateDeclarationDate('').isValid, false);
  assert.strictEqual(validateDeclarationDate('28/11/2026').isValid, false);
  assert.strictEqual(validateDeclarationDate('2026-02-30').isValid, false);
  assert.strictEqual(validateDeclarationDate('2099-01-01').isValid, false);
  assert.strictEqual(validateDeclarationDate('2026-11-28').isValid, true);

  assert.strictEqual(validateDeclarationPlace('').isValid, false);
  assert.strictEqual(validateDeclarationPlace('   ').isValid, false);
  assert.strictEqual(validateDeclarationPlace('A').isValid, false);
  assert.strictEqual(validateDeclarationPlace('Virudhunagar123').isValid, false);
  assert.strictEqual(validateDeclarationPlace('Sivakasi@').isValid, false);
  assert.strictEqual(validateDeclarationPlace('Sivakasi 🏏').isValid, false);
  const declPlaceOk = validateDeclarationPlace('  Rajapalayam   Town  ');
  assert.strictEqual(declPlaceOk.isValid, true);
  assert.strictEqual(declPlaceOk.normalized, 'Rajapalayam Town');
  console.log('PASS 5C: Declaration Date & Declaration Place validation');

  // 5D. Indian Mobile Number validation
  for (const validMob of ['6123456789', '7890123456', '8765432109', '9876543210']) {
    assert.strictEqual(validateIndianMobile(validMob).isValid, true, `Should accept valid Indian mobile: ${validMob}`);
  }
  for (const badMob of ['', '   ', '1234567890', '5987654321', '987654321', '98765432101', '98765abcde', '98765 43210', '@$', '987654321🏏']) {
    assert.strictEqual(validateIndianMobile(badMob).isValid, false, `Should reject invalid mobile: ${badMob}`);
    const mwMob = runMockValidation(playerRegistrationSchema, { ...base, mobile: badMob });
    assert.strictEqual(mwMob.status, 400, `Middleware should reject mobile: ${badMob}`);
  }
  console.log('PASS 5D: Indian Mobile Number validation (validator + middleware)');

  // 5B. Player Full Name & Father Name (STEP 5 test cases)
  for (const validName of ['Athi Lingam', 'M. Athi Lingam', 'R. Kumar', 'Mohamed Ali', 'John-Paul', "D'Costa"]) {
    assert.strictEqual(validatePersonName(validName, 'Player Full Name').isValid, true, `Should accept Player Name: ${validName}`);
    assert.strictEqual(validatePersonName(validName, 'Father Name').isValid, true, `Should accept Father Name: ${validName}`);
  }
  for (const invalidName of ['123456', '@@@@@@@', '@Athi#', '123 Athi', '     ', '']) {
    const pRes = validatePersonName(invalidName, 'Player Full Name');
    const fRes = validatePersonName(invalidName, 'Father Name');
    assert.strictEqual(pRes.isValid, false, `Should reject Player Name: "${invalidName}"`);
    assert.strictEqual(fRes.isValid, false, `Should reject Father Name: "${invalidName}"`);
    const mwP = runMockValidation(playerRegistrationSchema, { ...base, name: invalidName });
    assert.strictEqual(mwP.status, 400, `Middleware should reject Player Name "${invalidName}"`);
    const mwF = runMockValidation(playerRegistrationSchema, { ...base, fatherName: invalidName });
    assert.strictEqual(mwF.status, 400, `Middleware should reject Father Name "${invalidName}"`);
  }
  console.log('PASS 5B: Player Full Name & Father Name STEP 5 test cases (validator + middleware)');

  // STUDYING missing branchYearSec -> fail
  const studyFail = runMockValidation(playerRegistrationSchema, {
    ...base,
    occupationType: 'STUDYING',
    studyingInstitution: 'VHNSN College',
    studyLevel: 'COLLEGE',
    branchYearSec: '   '
  });
  assert.strictEqual(studyFail.status, 400);
  assert.strictEqual(studyFail.jsonResponse.code, 'VALIDATION_ERROR');

  // STUDYING valid -> pass & normalized
  const studyPass = runMockValidation(playerRegistrationSchema, {
    ...base,
    occupationType: 'STUDYING',
    studyingInstitution: '  VHNSN   College  ',
    studyLevel: 'COLLEGE',
    branchYearSec: 'B.Sc Computer Science - III Year - A'
  });
  assert.strictEqual(studyPass.nextCalled, true);
  assert.strictEqual(studyPass.validatedBody.clubChoice, 'Virudhunagar Strikers CC');

  // WORKING invalid -> fail
  const workFail = runMockValidation(playerRegistrationSchema, {
    ...base,
    occupationType: 'WORKING',
    workingInstitution: '12345'
  });
  assert.strictEqual(workFail.status, 400);

  // WORKING valid -> pass
  const workPass = runMockValidation(playerRegistrationSchema, {
    ...base,
    occupationType: 'WORKING',
    workingInstitution: 'Tamil Nadu Mercantile Bank'
  });
  assert.strictEqual(workPass.nextCalled, true);

  // NONE (Other) -> untouched, passes without studying/working fields
  const otherPass = runMockValidation(playerRegistrationSchema, {
    ...base,
    occupationType: 'NONE'
  });
  assert.strictEqual(otherPass.nextCalled, true);
  console.log('PASS 6: Middleware conditional validation & Other untouched');

  // 7. Service-level rejection
  let svcErr = null;
  try {
    await playerAuth.registerPlayer({
      ...base,
      email: `unique.test.${Date.now()}@example.com`,
      mobile: `9${String(Date.now()).slice(-9)}`,
      clubChoice: '123456'
    });
  } catch (err) {
    svcErr = err;
  }
  assert.ok(svcErr && svcErr.status === 400);
  console.log('PASS 7: Service-level registerPlayer rejects invalid clubChoice');

  // 8. Duplicate mobile rejection (9876543210 already exists in DB)
  let dupMobErr = null;
  try {
    await playerAuth.registerPlayer({
      ...base,
      email: `dup.mob.${Date.now()}@example.com`,
      mobile: '9876543210'
    });
  } catch (err) {
    dupMobErr = err;
  }
  assert.ok(dupMobErr && dupMobErr.status === 409);
  console.log('PASS 8: Service-level registerPlayer rejects duplicate mobile number with 409');

  console.log('\nALL PLAYER DETAILS VALIDATION TESTS PASSED!\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

