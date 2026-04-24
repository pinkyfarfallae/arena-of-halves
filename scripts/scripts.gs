/**
 * Google Apps Script — Character + User Manager (single deployment)
 *
 * Deploy as Web App:
 * 1. Open https://script.google.com
 * 2. Paste this ENTIRE file (replaces both old files)
 * 3. Deploy → Manage deployments → edit → new version
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 
 * Required OAuth Scopes (for Firestore access):
 * - https://www.googleapis.com/auth/spreadsheets
 * - https://www.googleapis.com/auth/script.external_request
 * - https://www.googleapis.com/auth/datastore
 */

var SHEET_ID = '1P3gaozLPryFY8itFVx7YzBTrFfdSn2tllTKJIMXVWOA';
var FIRESTORE_PROJECT_ID = 'arena-of-halves';
var CHARACTER_SHEET_NAME = 'Character Info';
var USER_SHEET_NAME = 'User';
var HARVEST_SHEET_NAME = 'Strawberry Harvest';
var TRAINING_SHEET_NAME = 'Daily Training Dice';
var CUSTOM_EQUIPMENT = 'Custom Equipment';

/* ── GET handler ── */
function doGet(e) {
  var action = (e.parameter.action || '').toString();

  if (action === 'patch') {
    var fields = {};
    var skip = ['action', 'characterid'];
    for (var key in e.parameter) {
      if (skip.indexOf(key.toLowerCase()) === -1) {
        fields[key] = e.parameter[key];
      }
    }
    return handlePatch(e.parameter.characterId, fields);
  }

  if (action === 'updateTheme') {
    return handleUpdateTheme(e.parameter.characterId, e.parameter.theme);
  }

  if (action === 'createUser') {
    return handleCreateUser(e.parameter);
  }

  if (action === 'editUser') {
    var editFields = {};
    var editSkip = ['action', 'characterid'];
    for (var k in e.parameter) {
      if (editSkip.indexOf(k.toLowerCase()) === -1) {
        editFields[k] = e.parameter[k];
      }
    }
    return handleEditUser(e.parameter.characterId, editFields);
  }

  if (action === 'deleteUser') {
    return handleDeleteUser(e.parameter.characterId);
  }

  if (action === 'fetchHarvests') {
    return handleFetchHarvests(e.parameter.characterId, e.parameter.status);
  }

  if (action === 'fetchHarvestRecords') {
    return handleFetchHarvestRecords();
  }

  if (action === 'fetchTrainings') {
    return handleFetchTrainings(e.parameter.userId, e.parameter.verified, e.parameter.mode);
  }

  if (action === 'fetchAllTrainings') {
    return handleFetchAllTrainings();
  }

  if (action === 'fetchTopHarvesters') {
    return handleFetchTopHarvesters(e.parameter.limit);
  }

  if (action === 'updateCharacterDrachma' || action === 'addDrachma') {
    return updateCharacterDrachma(e.parameter.characterId, e.parameter.amount);
  }

  if (action === 'updateTrainingPoints') {
    return updateTrainingPoints(e.parameter.characterId, e.parameter.amount);
  }

  return jsonResponse({ status: 'ok', message: 'Updater is running' });
}

/* ── POST handler ── */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action === 'patch') {
      return handlePatch(data.characterId, data.fields);
    }

    if (data.action === 'updateTheme') {
      return handleUpdateTheme(data.characterId, data.theme);
    }

    if (data.action === 'createUser') {
      return handleCreateUser(data);
    }

    if (data.action === 'editUser') {
      return handleEditUser(data.characterId, data.fields);
    }

    if (data.action === 'deleteUser') {
      return handleDeleteUser(data.characterId);
    }

    if (data.action === 'submitHarvest') {
      return handleSubmitHarvest(data);
    }

    if (data.action === 'approveHarvest') {
      return handleApproveHarvest(data);
    }

    if (data.action === 'rejectHarvest') {
      return handleRejectHarvest(data);
    }

    if (data.action === 'fetchHarvests') {
      return handleFetchHarvests(data.characterId, data.status);
    }

    if (data.action === 'fetchHarvestRecords') {
      return handleFetchHarvestRecords();
    }

    if (data.action === 'fetchTopHarvesters') {
      return handleFetchTopHarvesters(data.limit);
    }

    if (data.action === 'updateCharacterDrachma' || data.action === 'addDrachma') {
      return updateCharacterDrachma(data.characterId, data.amount);
    }

    if (data.action === 'updateTrainingPoints') {
      return updateTrainingPoints(data.characterId, data.amount);
    }

    if (data.action === 'upgradeStat') {
      return upgradeStat(data.characterId, data.statId, data.pointsToSpend);
    }

    if (data.action === 'refundStat') {
      return refundStat(data.characterId, data.statId);
    }

    if (data.action === 'refundAllStats') {
      return refundAllStats(data.characterId);
    }

    if (data.action === 'submitTraining') {
      return handleSubmitTraining(data);
    }

    if (data.action === 'submitTrainingRoleplay') {
      return handleSubmitTrainingRoleplay(data);
    }

    if (data.action === 'verifyTraining') {
      return handleVerifyTraining(data);
    }

    if (data.action === 'recheckTraining') {
      return handleRecheckTraining(data);
    }

    if (data.action === 'createItem') {
      return handleCreateItem(data);
    }

    if (data.action === 'editItem') {
      return handleEditItem(data.itemId, data.fields);
    }

    if (data.action === 'deleteItem') {
      return handleDeleteItem(data.itemId);
    }

    if (data.action === 'createEquipment') {
      return handleCreateEquipment(data);
    }

    if (data.action === 'editEquipment') {
      return handleEditEquipment(data.itemId, data.fields);
    }

    if (data.action === 'deleteEquipment') {
      return handleDeleteEquipment(data.itemId);
    }

    return jsonResponse({ error: 'Unknown action: ' + data.action });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

/* ── OPTIONS handler (CORS preflight) ── */
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

/* ══════════════════════════════════════
   CREATE USER
   - Adds row to User sheet (characterId, password, role)
   - Adds row to Character Info sheet (characterId, names, deity)
   ══════════════════════════════════════ */
function handleCreateUser(params) {
  var characterId = (params.characterId || '').toString().trim();
  var password = (params.password || '').toString().trim();
  var nameThai = (params.nameThai || '').toString().trim();
  var nameEng = (params.nameEng || '').toString().trim();
  var nickThai = (params.nicknameThai || '').toString().trim();
  var nickEng = (params.nicknameEng || '').toString().trim();
  var deityBlood = (params.deityBlood || '').toString().trim();
  var sex = (params.sex || '').toString().trim();
  var cabin = parseInt(params.cabin || '0', 10) || 0;

  if (!characterId || !password) {
    return jsonResponse({ error: 'Missing characterId or password' });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);

  // ── 1. Add to User sheet ──
  var userSheet = ss.getSheetByName(USER_SHEET_NAME);
  if (!userSheet) {
    return jsonResponse({ error: 'Sheet not found: ' + USER_SHEET_NAME });
  }

  var userData = userSheet.getDataRange().getValues();
  var userHeaders = userData[0].map(function (h) { return h.toString().toLowerCase(); });
  var userIdCol = userHeaders.indexOf('characterid');

  // Check for duplicate
  if (userIdCol !== -1) {
    for (var i = 1; i < userData.length; i++) {
      if (userData[i][userIdCol].toString().trim().toLowerCase() === characterId.toLowerCase()) {
        return jsonResponse({ error: 'User already exists: ' + characterId });
      }
    }
  }

  // Build row for User sheet
  var userRow = [];
  for (var u = 0; u < userHeaders.length; u++) {
    var h = userHeaders[u];
    if (h === 'characterid') userRow.push(characterId);
    else if (h === 'password') userRow.push(password);
    else if (h === 'role') userRow.push('player');
    else userRow.push('');
  }
  userSheet.appendRow(userRow);

  // ── 2. Add to Character Info sheet ──
  var charSheet = ss.getSheetByName(CHARACTER_SHEET_NAME);
  if (!charSheet) {
    return jsonResponse({ error: 'Sheet not found: ' + CHARACTER_SHEET_NAME });
  }

  var charData = charSheet.getDataRange().getValues();
  var charHeaders = charData[0].map(function (h) { return h.toString().toLowerCase(); });

  var charRow = [];
  for (var c = 0; c < charHeaders.length; c++) {
    var ch = charHeaders[c];
    if (ch === 'characterid') charRow.push(characterId);
    else if (ch === 'name (thai)') charRow.push(nameThai);
    else if (ch === 'name (eng)') charRow.push(nameEng);
    else if (ch === 'nickname (thai)') charRow.push(nickThai);
    else if (ch === 'nickname (eng)') charRow.push(nickEng);
    else if (ch === 'deity blood') charRow.push(deityBlood);
    else if (ch === 'sex') charRow.push(sex);
    else if (ch === 'cabin') charRow.push(cabin);
    else if (ch === 'hp') charRow.push(10);
    else if (ch === 'damage') charRow.push(1);
    else if (ch === 'defend dice up') charRow.push(0);
    else if (ch === 'attack dice up') charRow.push(0);
    else if (ch === 'speed') charRow.push(10);
    else if (ch === 'passive skill point') charRow.push('locked');
    else if (ch === 'skill point') charRow.push(0);
    else if (ch === 'ultimate skill point') charRow.push('locked');
    else if (ch === 'reroll') charRow.push(0);
    else if (ch === 'currency') charRow.push(0);
    else if (ch === 'strength') charRow.push(0);
    else if (ch === 'mobility') charRow.push(0);
    else if (ch === 'intelligence') charRow.push(0);
    else if (ch === 'technique') charRow.push(0);
    else if (ch === 'experience') charRow.push(0);
    else if (ch === 'fortune') charRow.push(0);
    else if (ch === 'trainingpoints') charRow.push(0);
    else charRow.push('');
  }
  charSheet.appendRow(charRow);

  return jsonResponse({ success: true, characterId: characterId });
}

/* ══════════════════════════════════════
   EDIT USER
   - Patches User sheet (password, role)
   - Patches Character Info sheet (other fields)
   ══════════════════════════════════════ */
function handleEditUser(characterId, fields) {
  characterId = (characterId || '').toString().trim();
  if (!characterId) {
    return jsonResponse({ error: 'Missing characterId' });
  }
  if (!fields || typeof fields !== 'object') {
    return jsonResponse({ error: 'Missing fields' });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var updated = [];

  // Fields that live on the User sheet
  var userFields = { password: true, role: true };
  var hasUserFields = false;
  var hasCharFields = false;

  for (var key in fields) {
    if (userFields[key.toLowerCase()]) hasUserFields = true;
    else hasCharFields = true;
  }

  // ── Patch User sheet ──
  if (hasUserFields) {
    var userSheet = ss.getSheetByName(USER_SHEET_NAME);
    if (userSheet) {
      var userData = userSheet.getDataRange().getValues();
      var userHeaders = userData[0].map(function (h) { return h.toString().toLowerCase(); });
      var userIdCol = userHeaders.indexOf('characterid');

      if (userIdCol !== -1) {
        for (var i = 1; i < userData.length; i++) {
          if (userData[i][userIdCol].toString().trim().toLowerCase() === characterId.toLowerCase()) {
            for (var field in fields) {
              if (!userFields[field.toLowerCase()]) continue;
              var colIdx = userHeaders.indexOf(field.toLowerCase());
              if (colIdx !== -1) {
                userSheet.getRange(i + 1, colIdx + 1).setValue(fields[field].toString());
                updated.push(field);
              }
            }
            break;
          }
        }
      }
    }
  }

  // ── Patch Character Info sheet ──
  if (hasCharFields) {
    var charSheet = ss.getSheetByName(CHARACTER_SHEET_NAME);
    if (charSheet) {
      var charData = charSheet.getDataRange().getValues();
      var charHeaders = charData[0].map(function (h) { return h.toString().toLowerCase(); });
      var charIdCol = charHeaders.indexOf('characterid');

      if (charIdCol !== -1) {
        for (var j = 1; j < charData.length; j++) {
          if (charData[j][charIdCol].toString().trim().toLowerCase() === characterId.toLowerCase()) {
            for (var f in fields) {
              if (userFields[f.toLowerCase()]) continue;
              var cIdx = charHeaders.indexOf(f.toLowerCase());
              if (cIdx !== -1) {
                charSheet.getRange(j + 1, cIdx + 1).setValue(fields[f].toString());
                updated.push(f);
              }
            }
            break;
          }
        }
      }
    }
  }

  return jsonResponse({ success: true, updated: updated });
}

/* ══════════════════════════════════════
   DELETE USER
   - Removes row from User sheet
   - Removes row from Character Info sheet
   ══════════════════════════════════════ */
function handleDeleteUser(characterId) {
  characterId = (characterId || '').toString().trim();
  if (!characterId) {
    return jsonResponse({ error: 'Missing characterId' });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var deleted = [];

  // ── Delete from User sheet ──
  var userSheet = ss.getSheetByName(USER_SHEET_NAME);
  if (userSheet) {
    var userData = userSheet.getDataRange().getValues();
    var userHeaders = userData[0].map(function (h) { return h.toString().toLowerCase(); });
    var userIdCol = userHeaders.indexOf('characterid');

    if (userIdCol !== -1) {
      for (var i = userData.length - 1; i >= 1; i--) {
        if (userData[i][userIdCol].toString().trim().toLowerCase() === characterId.toLowerCase()) {
          userSheet.deleteRow(i + 1);
          deleted.push('User');
          break;
        }
      }
    }
  }

  // ── Delete from Character Info sheet ──
  var charSheet = ss.getSheetByName(CHARACTER_SHEET_NAME);
  if (charSheet) {
    var charData = charSheet.getDataRange().getValues();
    var charHeaders = charData[0].map(function (h) { return h.toString().toLowerCase(); });
    var charIdCol = charHeaders.indexOf('characterid');

    if (charIdCol !== -1) {
      for (var j = charData.length - 1; j >= 1; j--) {
        if (charData[j][charIdCol].toString().trim().toLowerCase() === characterId.toLowerCase()) {
          charSheet.deleteRow(j + 1);
          deleted.push('Character Info');
          break;
        }
      }
    }
  }

  return jsonResponse({ success: true, deleted: deleted, characterId: characterId });
}

/* ── Patch character fields (Character Info sheet only) ── */
function handlePatch(characterId, fields) {
  characterId = (characterId || '').toString().trim();
  if (!characterId) {
    return jsonResponse({ error: 'Missing characterId' });
  }
  if (!fields || typeof fields !== 'object') {
    return jsonResponse({ error: 'Missing fields' });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(CHARACTER_SHEET_NAME);
  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + CHARACTER_SHEET_NAME });
  }
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });

  var idCol = headers.indexOf('characterid');
  if (idCol === -1) {
    return jsonResponse({ error: 'characterid column not found' });
  }

  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][idCol].toString().trim().toLowerCase() === characterId.toLowerCase()) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex === -1) {
    return jsonResponse({ error: 'Character not found: ' + characterId });
  }

  var updated = [];
  for (var key in fields) {
    var colIndex = headers.indexOf(key.toLowerCase());
    if (colIndex === -1) continue;

    sheet.getRange(rowIndex + 1, colIndex + 1).setValue(fields[key].toString());
    updated.push(key);
  }

  return jsonResponse({ success: true, updated: updated });
}

/* ── Update theme ── */
function handleUpdateTheme(characterId, themeString) {
  characterId = (characterId || '').toString().trim();
  if (!characterId) {
    return jsonResponse({ error: 'Missing characterId' });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(CHARACTER_SHEET_NAME);
  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + CHARACTER_SHEET_NAME });
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });

  var idCol = headers.indexOf('characterid');
  var themeCol = headers.indexOf('theme');

  if (idCol === -1 || themeCol === -1) {
    return jsonResponse({ error: 'characterid or theme column not found' });
  }

  for (var i = 1; i < data.length; i++) {
    if (data[i][idCol].toString().trim().toLowerCase() === characterId.toLowerCase()) {
      sheet.getRange(i + 1, themeCol + 1).setValue(themeString);
      return jsonResponse({ success: true });
    }
  }

  return jsonResponse({ error: 'Character not found' });
}

/* ══════════════════════════════════════
   HARVEST SUBMISSION SYSTEM
   ══════════════════════════════════════ */

/* ── Submit new harvest ── */
function handleSubmitHarvest(params) {
  var characterId = (params.characterId || '').toString().trim();
  var firstTweetUrl = (params.firstTweetUrl || '').toString().trim();
  var submittedAt = (params.submittedAt || new Date().toISOString()).toString();
  var id = (params.id || '').toString().trim();

  if (!characterId || !firstTweetUrl) {
    return jsonResponse({ error: 'Missing required fields' });
  }

  // If no UUID provided, generate a fallback ID (timestamp-based)
  if (!id) {
    id = 'H' + new Date().getTime();
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(HARVEST_SHEET_NAME);
  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + HARVEST_SHEET_NAME });
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });

  // Build row according to schema:
  // Includes: id, characterId, firstTweetUrl, status, submittedAt,
  // reviewedAt, reviewedBy, charCount, mentionCount, drachmaReward,
  // roleplayers, rejectReason
  var row = [];
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i];
    if (h === 'id') row.push(id);
    else if (h === 'characterid') row.push(characterId);
    else if (h === 'firsttweeturl') row.push(firstTweetUrl);
    else if (h === 'status') row.push('pending');
    else if (h === 'submittedat') row.push(submittedAt);
    else row.push('');
  }

  sheet.appendRow(row);
  return jsonResponse({ success: true, id: id });
}

/* ── Approve harvest and award drachma to all roleplayers ── */
function handleApproveHarvest(params) {
  var submissionId = (params.submissionId || '').toString().trim();
  var reviewedBy = (params.reviewedBy || '').toString().trim();
  var charCount = parseInt(params.charCount || '0', 10);
  var mentionCount = parseInt(params.mentionCount || '0', 10);
  var drachmaReward = params.drachmaReward || ''; // Can be number or JSON string
  var roleplayers = params.roleplayers || []; // Array of characterIds
  var demeterBonusIds = params.demeterBonusIds || []; // Array of characterIds with Demeter blessing

  if (!submissionId || !reviewedBy || !charCount || !drachmaReward) {
    return jsonResponse({ error: 'Missing required fields' });
  }

  if (!Array.isArray(roleplayers) || roleplayers.length === 0) {
    return jsonResponse({ error: 'No roleplayers specified' });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var harvestSheet = ss.getSheetByName(HARVEST_SHEET_NAME);
  if (!harvestSheet) {
    return jsonResponse({ error: 'Sheet not found: ' + HARVEST_SHEET_NAME });
  }

  var harvestData = harvestSheet.getDataRange().getValues();
  var harvestHeaders = harvestData[0].map(function (h) { return h.toString().toLowerCase(); });

  // Find submission by matching firstTweetUrl or characterId + submittedAt
  // (Since we don't have a proper ID column, we'll match by row index or unique field)
  var charIdCol = harvestHeaders.indexOf('characterid');
  var statusCol = harvestHeaders.indexOf('status');
  var reviewedAtCol = harvestHeaders.indexOf('reviewedat');
  var reviewedByCol = harvestHeaders.indexOf('reviewedby');
  var charCountCol = harvestHeaders.indexOf('charcount');
  var mentionCountCol = harvestHeaders.indexOf('mentioncount');
  var drachmaRewardCol = harvestHeaders.indexOf('drachmareward');
  var roleplayersCol = harvestHeaders.indexOf('roleplayers');
  var idCol = harvestHeaders.indexOf('id');
  var submittedAtCol = harvestHeaders.indexOf('submittedat');

  var rowIndex = -1;
  var submitterCharId = '';
  var submittedAtDate = '';

  // Find submission by ID
  for (var i = 1; i < harvestData.length; i++) {
    var recordId = harvestData[i][idCol] ? harvestData[i][idCol].toString().trim() : '';
    if (recordId === submissionId) {
      rowIndex = i;
      submitterCharId = harvestData[i][charIdCol].toString().trim();
      if (submittedAtCol !== -1) {
        submittedAtDate = harvestData[i][submittedAtCol].toString().trim();
      }
      break;
    }
  }

  if (rowIndex === -1) {
    return jsonResponse({ error: 'Submission not found: ' + submissionId });
  }

  // Check if already approved
  var currentStatus = harvestData[rowIndex][statusCol] ? harvestData[rowIndex][statusCol].toString().toLowerCase() : '';
  if (currentStatus === 'approved') {
    return jsonResponse({ error: 'Submission already approved' });
  }

  // Update harvest submission
  var reviewedAt = new Date().toISOString();
  if (statusCol !== -1) harvestSheet.getRange(rowIndex + 1, statusCol + 1).setValue('approved');
  if (reviewedAtCol !== -1) harvestSheet.getRange(rowIndex + 1, reviewedAtCol + 1).setValue(reviewedAt);
  if (reviewedByCol !== -1) harvestSheet.getRange(rowIndex + 1, reviewedByCol + 1).setValue(reviewedBy);
  if (charCountCol !== -1) harvestSheet.getRange(rowIndex + 1, charCountCol + 1).setValue(charCount);
  if (mentionCountCol !== -1) harvestSheet.getRange(rowIndex + 1, mentionCountCol + 1).setValue(mentionCount);
  if (drachmaRewardCol !== -1) harvestSheet.getRange(rowIndex + 1, drachmaRewardCol + 1).setValue(drachmaReward); // Now accepts JSON string map
  if (roleplayersCol !== -1) harvestSheet.getRange(rowIndex + 1, roleplayersCol + 1).setValue(roleplayers.join(','));

  // Note: Drachma distribution is now handled by the frontend with individual calculated rewards
  // This backend call only records the drachmaReward (JSON map: {charId: amount}) for leaderboard tracking
  // The frontend awards each participant their individual reward (base + gardening set + solo + Demeter wish bonuses)

  return jsonResponse({
    success: true,
    message: 'Harvest approved and recorded. Individual rewards handled by frontend.'
  });
}

/* ── Reject harvest ── */
function handleRejectHarvest(params) {
  var submissionId = (params.submissionId || '').toString().trim();
  var reviewedBy = (params.reviewedBy || '').toString().trim();
  var rejectReason = (params.rejectReason || '').toString().trim();

  if (!submissionId || !reviewedBy || !rejectReason) {
    return jsonResponse({ error: 'Missing required fields' });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(HARVEST_SHEET_NAME);
  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + HARVEST_SHEET_NAME });
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });

  var statusCol = headers.indexOf('status');
  var reviewedAtCol = headers.indexOf('reviewedat');
  var reviewedByCol = headers.indexOf('reviewedby');
  var rejectReasonCol = headers.indexOf('rejectreason');
  var idCol = headers.indexOf('id');

  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    var recordId = data[i][idCol] ? data[i][idCol].toString().trim() : '';
    if (recordId === submissionId) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex === -1) {
    return jsonResponse({ error: 'Submission not found: ' + submissionId });
  }

  // Check if already rejected
  var currentStatus = data[rowIndex][statusCol] ? data[rowIndex][statusCol].toString().toLowerCase() : '';
  if (currentStatus === 'rejected') {
    return jsonResponse({ error: 'Submission already rejected' });
  }

  var reviewedAt = new Date().toISOString();
  if (statusCol !== -1) sheet.getRange(rowIndex + 1, statusCol + 1).setValue('rejected');
  if (reviewedAtCol !== -1) sheet.getRange(rowIndex + 1, reviewedAtCol + 1).setValue(reviewedAt);
  if (reviewedByCol !== -1) sheet.getRange(rowIndex + 1, reviewedByCol + 1).setValue(reviewedBy);
  if (rejectReasonCol !== -1) sheet.getRange(rowIndex + 1, rejectReasonCol + 1).setValue(rejectReason);

  return jsonResponse({ success: true });
}

/* ── Fetch harvests (optionally filter by characterId or status) ── */
function handleFetchHarvests(characterId, status) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(HARVEST_SHEET_NAME);
  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + HARVEST_SHEET_NAME });
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return jsonResponse({ harvests: [] });
  }

  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });
  var harvests = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var harvest = {};

    for (var j = 0; j < headers.length; j++) {
      harvest[headers[j]] = row[j] ? row[j].toString() : '';
    }

    // Filter by characterId if provided
    if (characterId && harvest.characterid !== characterId) {
      continue;
    }

    // Filter by status if provided
    if (status && harvest.status !== status) {
      continue;
    }

    harvests.push(harvest);
  }

  return jsonResponse({ harvests: harvests });
}

/* ── Helper ── */
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ══════════════════════════════════════
   UPDATE CHARACTER DRACHMA
   - Adds or subtracts currency (supports positive/negative amounts)
   - Used for rewards, purchases, refunds, etc.
   ══════════════════════════════════════ */
function updateCharacterDrachma(characterId, amount) {
  characterId = (characterId || '').toString().trim();
  amount = parseInt(amount || '0', 10);

  if (!characterId) {
    return jsonResponse({ error: 'Missing characterId' });
  }

  if (isNaN(amount) || amount === 0) {
    return jsonResponse({ error: 'Invalid amount (must be non-zero number)' });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(CHARACTER_SHEET_NAME);
  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + CHARACTER_SHEET_NAME });
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });

  var idCol = headers.indexOf('characterid');
  var currencyCol = headers.indexOf('currency');

  if (idCol === -1 || currencyCol === -1) {
    return jsonResponse({ error: 'characterid or currency column not found' });
  }

  for (var i = 1; i < data.length; i++) {
    if (data[i][idCol].toString().trim().toLowerCase() === characterId.toLowerCase()) {
      var currentCurrency = parseInt(data[i][currencyCol] || '0', 10);
      var newCurrency = currentCurrency + amount;

      // Prevent negative currency
      if (newCurrency < 0) {
        return jsonResponse({
          error: 'Insufficient funds',
          current: currentCurrency,
          attempted: amount,
          required: Math.abs(amount)
        });
      }

      sheet.getRange(i + 1, currencyCol + 1).setValue(newCurrency);
      return jsonResponse({
        success: true,
        characterId: characterId,
        previous: currentCurrency,
        change: amount,
        current: newCurrency
      });
    }
  }

  return jsonResponse({ error: 'Character not found: ' + characterId });
}

/* ── Add drachma (wrapper for backwards compatibility) ── */
function addDrachma(characterId, amount) {
  return updateCharacterDrachma(characterId, amount);
}

/* ══════════════════════════════════════
   UPDATE TRAINING POINTS
   - Adds or subtracts training points (supports positive/negative amounts)
   - Used for earning points through training or spending on stat upgrades
   ══════════════════════════════════════ */
function updateTrainingPoints(characterId, amount) {
  characterId = (characterId || '').toString().trim();
  amount = parseInt(amount || '0', 10);

  if (!characterId) {
    return jsonResponse({ error: 'Missing characterId' });
  }

  if (isNaN(amount) || amount === 0) {
    return jsonResponse({ error: 'Invalid amount (must be non-zero number)' });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(CHARACTER_SHEET_NAME);
  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + CHARACTER_SHEET_NAME });
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });

  var idCol = headers.indexOf('characterid');
  var trainingPointsCol = headers.indexOf('trainingpoints');

  if (idCol === -1) {
    return jsonResponse({ error: 'characterid column not found' });
  }

  if (trainingPointsCol === -1) {
    return jsonResponse({
      error: 'trainingPoints column not found in spreadsheet. Please add a "trainingPoints" column to the Character Info sheet.'
    });
  }

  for (var i = 1; i < data.length; i++) {
    if (data[i][idCol].toString().trim().toLowerCase() === characterId.toLowerCase()) {
      var currentPoints = parseInt(data[i][trainingPointsCol] || '0', 10);
      var newPoints = currentPoints + amount;

      // Prevent negative training points
      if (newPoints < 0) {
        return jsonResponse({
          error: 'Insufficient training points',
          current: currentPoints,
          attempted: amount,
          required: Math.abs(amount)
        });
      }

      sheet.getRange(i + 1, trainingPointsCol + 1).setValue(newPoints);
      return jsonResponse({
        success: true,
        characterId: characterId,
        previous: currentPoints,
        change: amount,
        current: newPoints
      });
    }
  }

  return jsonResponse({ error: 'Character not found: ' + characterId });
}

/* ══════════════════════════════════════
   UPGRADE STAT
   - Upgrades a character's practice stat using training points
   - Stats range from 0-5, cost is always 1 point per level
   ══════════════════════════════════════ */
function upgradeStat(characterId, statId, pointsToSpend) {
  characterId = (characterId || '').toString().trim();
  statId = (statId || '').toString().toLowerCase();
  pointsToSpend = parseInt(pointsToSpend || '0', 10);

  if (!characterId) {
    return jsonResponse({ error: 'Missing characterId' });
  }

  if (!statId) {
    return jsonResponse({ error: 'Missing statId' });
  }

  if (isNaN(pointsToSpend) || pointsToSpend <= 0) {
    return jsonResponse({ error: 'Invalid pointsToSpend (must be positive number)' });
  }

  var validStats = ['strength', 'mobility', 'intelligence', 'technique', 'experience', 'fortune'];
  if (validStats.indexOf(statId) === -1) {
    return jsonResponse({ error: 'Invalid statId. Must be one of: ' + validStats.join(', ') });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(CHARACTER_SHEET_NAME);
  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + CHARACTER_SHEET_NAME });
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });

  var idCol = headers.indexOf('characterid');
  var trainingPointsCol = headers.indexOf('trainingpoints');
  var statCol = headers.indexOf(statId);

  if (idCol === -1) {
    return jsonResponse({ error: 'characterid column not found' });
  }

  if (trainingPointsCol === -1) {
    return jsonResponse({ error: 'trainingpoints column not found' });
  }

  if (statCol === -1) {
    return jsonResponse({ error: statId + ' column not found' });
  }

  var MAX_STAT_LEVEL = 5;
  var COST_PER_LEVEL = 1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][idCol].toString().trim().toLowerCase() === characterId.toLowerCase()) {
      var currentPoints = parseInt(data[i][trainingPointsCol] || '0', 10);
      var currentStatValue = parseInt(data[i][statCol] || '0', 10);

      // Check if stat is already at max
      if (currentStatValue >= MAX_STAT_LEVEL) {
        return jsonResponse({
          error: 'Stat is already at maximum level',
          currentValue: currentStatValue,
          maxLevel: MAX_STAT_LEVEL
        });
      }

      // Check if character has enough training points
      if (currentPoints < pointsToSpend) {
        return jsonResponse({
          error: 'Insufficient training points',
          available: currentPoints,
          required: pointsToSpend
        });
      }

      // Calculate how many levels can be upgraded (flat cost of 1 per level)
      var levelsToGain = Math.min(pointsToSpend, MAX_STAT_LEVEL - currentStatValue);
      var pointsUsed = levelsToGain * COST_PER_LEVEL;
      var newStatValue = currentStatValue + levelsToGain;
      var newPoints = currentPoints - pointsUsed;

      if (levelsToGain === 0) {
        return jsonResponse({
          error: 'Cannot upgrade. Stat is at max level.',
          currentValue: currentStatValue
        });
      }

      // Update both training points and stat value
      sheet.getRange(i + 1, trainingPointsCol + 1).setValue(newPoints);
      sheet.getRange(i + 1, statCol + 1).setValue(newStatValue);

      // Update derived stats based on which practice stat was upgraded
      switch (statId) {
        case 'strength':
          switch (newStatValue) {
            case 1:
            case 2:
            case 4:
              const currentDamageRaw = getCharacterInfo(characterId, 'damage');
              const currentDamage = Number(currentDamageRaw) || 0;
              handleEditUser(characterId, { 'damage': currentDamage + 1 });
              break;
            default:
              break;
          };
          break;

        case 'mobility':
          const currentSpeedRaw = getCharacterInfo(characterId, 'speed');
          const currentSpeed = Number(currentSpeedRaw) || 0;

          switch (newStatValue) {
            case 1:
            case 2:
            case 3:
              handleEditUser(characterId, { 'speed': currentSpeed + 1 });
              break;
            case 4:
              handleEditUser(characterId, { 'speed': currentSpeed + 2 });
              break;
            case 5:
              handleEditUser(characterId, { 'reroll': 3 });
              break;
            default:
              break;
          };
          break;

        case 'intelligence':
          let def = Number(getCharacterInfo(characterId, 'defend dice up')) || 0;
          let atk = Number(getCharacterInfo(characterId, 'attack dice up')) || 0;

          if (newStatValue % 2 === 0) {
            def += 1;
          } else {
            atk += 1;
            if (newStatValue === 5) def += 1;
          }

          handleEditUser(characterId, {
            'defend dice up': def,
            'attack dice up': atk
          });
          break;
          break;

        case 'technique':
          switch (newStatValue) {
            case 1:
              handleEditUser(characterId, { 'passive skill point': 'unlocked' });
              break;
            case 2:
              handleEditUser(characterId, { 'skill point': '1' });
              break;
            case 4:
              handleEditUser(characterId, { 'skill point': '2' });
              break;
            case 5:
              handleEditUser(characterId, { 'ultimate skill point': 'unlocked' });
              break;
            default:
              break;
          }
          break;

        case 'experience':
          if (newStatValue !== 5) {
            const currentHp = Number(getCharacterInfo(characterId, 'hp')) || 0;
            handleEditUser(characterId, { 'hp': currentHp + newStatValue });
          }
          break;
      }

      return jsonResponse({
        success: true,
        characterId: characterId,
        stat: statId,
        previousValue: currentStatValue,
        newValue: newStatValue,
        levelsGained: levelsToGain,
        pointsSpent: pointsUsed,
        remainingPoints: newPoints
      });
    }
  }

  return jsonResponse({ error: 'Character not found: ' + characterId });
}

/* ══════════════════════════════════════
   REVERT DERIVED STATS FOR REFUND
   - Helper function to revert derived stats when refunding a practice stat
   ══════════════════════════════════════ */
function revertDerivedStatsForRefund(characterId, statId, oldValue, newValue) {
  switch (statId) {
    case 'strength':
      // Strength gives +1 damage at levels 1, 2, and 4
      if (oldValue === 1 || oldValue === 2 || oldValue === 4) {
        var currentDamage = Number(getCharacterInfo(characterId, 'damage')) || 0;
        handleEditUser(characterId, { 'damage': Math.max(1, currentDamage - 1) });
      }
      break;

    case 'mobility':
      // Mobility gives +1 speed at levels 1, 2, 3 and +2 at level 4
      var currentSpeed = Number(getCharacterInfo(characterId, 'speed')) || 0;
      if (oldValue === 4) {
        handleEditUser(characterId, { 'speed': Math.max(10, currentSpeed - 2) });
      } else if (oldValue === 1 || oldValue === 2 || oldValue === 3) {
        handleEditUser(characterId, { 'speed': Math.max(10, currentSpeed - 1) });
      }
      break;

    case 'intelligence':
      // Intelligence alternates between defense and attack dice up
      // Even levels: +1 defend dice up, Odd levels: +1 attack dice up (plus def at 5)
      var currentDefDiceUp = Number(getCharacterInfo(characterId, 'defend dice up')) || 0;
      var currentAtkDiceUp = Number(getCharacterInfo(characterId, 'attack dice up')) || 0;

      if (oldValue % 2 === 0) {
        // Was even level, revert defend dice up
        handleEditUser(characterId, { 'defend dice up': Math.max(0, currentDefDiceUp - 1) });
      } else {
        // Was odd level, revert attack dice up
        handleEditUser(characterId, { 'attack dice up': Math.max(0, currentAtkDiceUp - 1) });
        if (oldValue === 5) {
          // Level 5 also gave defend dice up
          handleEditUser(characterId, { 'defend dice up': Math.max(0, currentDefDiceUp - 1) });
        }
      }
      break;

    case 'technique':
      // Revert skill unlocks
      if (oldValue === 1) {
        handleEditUser(characterId, { 'passive skill point': 'locked' });
      } else if (oldValue === 2) {
        handleEditUser(characterId, { 'skill point': '0' });
      } else if (oldValue === 3) {
        // Level 3 gave +1 training point, already handled by refund system
      } else if (oldValue === 4) {
        handleEditUser(characterId, { 'skill point': '1' });
      } else if (oldValue === 5) {
        handleEditUser(characterId, { 'ultimate skill point': 'locked' });
      }
      break;

    case 'experience':
      // Experience gives HP based on level (except level 5)
      if (oldValue !== 5) {
        var currentHp = Number(getCharacterInfo(characterId, 'hp')) || 0;
        handleEditUser(characterId, { 'hp': Math.max(10, currentHp - oldValue) });
      }
      break;

    case 'fortune':
      // Fortune has no derived stats currently
      break;
  }
}

/* ══════════════════════════════════════
   REFUND STAT
   - Refunds one level from a stat and returns 1 training point
   - Stats range from 0-5
   ══════════════════════════════════════ */
function refundStat(characterId, statId) {
  characterId = (characterId || '').toString().trim();
  statId = (statId || '').toString().toLowerCase();

  if (!characterId) {
    return jsonResponse({ error: 'Missing characterId' });
  }

  if (!statId) {
    return jsonResponse({ error: 'Missing statId' });
  }

  var validStats = ['strength', 'mobility', 'intelligence', 'technique', 'experience', 'fortune'];
  if (validStats.indexOf(statId) === -1) {
    return jsonResponse({ error: 'Invalid statId. Must be one of: ' + validStats.join(', ') });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(CHARACTER_SHEET_NAME);
  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + CHARACTER_SHEET_NAME });
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });

  var idCol = headers.indexOf('characterid');
  var trainingPointsCol = headers.indexOf('trainingpoints');
  var statCol = headers.indexOf(statId);

  if (idCol === -1) {
    return jsonResponse({ error: 'characterid column not found' });
  }

  if (trainingPointsCol === -1) {
    return jsonResponse({ error: 'trainingpoints column not found' });
  }

  if (statCol === -1) {
    return jsonResponse({ error: statId + ' column not found' });
  }

  var REFUND_AMOUNT = 1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][idCol].toString().trim().toLowerCase() === characterId.toLowerCase()) {
      var currentPoints = parseInt(data[i][trainingPointsCol] || '0', 10);
      var currentStatValue = parseInt(data[i][statCol] || '0', 10);

      // Check if stat is already at minimum
      if (currentStatValue <= 0) {
        return jsonResponse({
          error: 'Stat is already at minimum level (0)',
          currentValue: currentStatValue
        });
      }

      // Reduce stat by 1 and refund 1 point
      var newStatValue = currentStatValue - 1;
      var newPoints = currentPoints + REFUND_AMOUNT;

      // Update both training points and stat value
      sheet.getRange(i + 1, trainingPointsCol + 1).setValue(newPoints);
      sheet.getRange(i + 1, statCol + 1).setValue(newStatValue);

      // Revert derived stats based on refunded practice stat
      revertDerivedStatsForRefund(characterId, statId, currentStatValue, newStatValue);

      return jsonResponse({
        success: true,
        characterId: characterId,
        stat: statId,
        previousValue: currentStatValue,
        newValue: newStatValue,
        pointsRefunded: REFUND_AMOUNT,
        remainingPoints: newPoints
      });
    }
  }

  return jsonResponse({ error: 'Character not found: ' + characterId });
}

/* ══════════════════════════════════════
   REFUND ALL STATS
   - Resets all practice stats to 0
   - Returns all spent training points to the character
   ══════════════════════════════════════ */
function refundAllStats(characterId) {
  characterId = (characterId || '').toString().trim();

  if (!characterId) {
    return jsonResponse({ error: 'Missing characterId' });
  }

  var validStats = ['strength', 'mobility', 'intelligence', 'technique', 'experience', 'fortune'];

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(CHARACTER_SHEET_NAME);
  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + CHARACTER_SHEET_NAME });
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });

  var idCol = headers.indexOf('characterid');
  var trainingPointsCol = headers.indexOf('trainingpoints');

  if (idCol === -1) {
    return jsonResponse({ error: 'characterid column not found' });
  }

  if (trainingPointsCol === -1) {
    return jsonResponse({ error: 'trainingpoints column not found' });
  }

  var statCols = {};
  for (var s = 0; s < validStats.length; s++) {
    var statId = validStats[s];
    var col = headers.indexOf(statId);
    if (col === -1) {
      return jsonResponse({ error: statId + ' column not found' });
    }
    statCols[statId] = col;
  }

  for (var i = 1; i < data.length; i++) {
    if (data[i][idCol].toString().trim().toLowerCase() === characterId.toLowerCase()) {
      var currentPoints = parseInt(data[i][trainingPointsCol] || '0', 10);
      var previousValues = {};
      var pointsRefunded = 0;

      for (var j = 0; j < validStats.length; j++) {
        var statKey = validStats[j];
        var currentStatValue = parseInt(data[i][statCols[statKey]] || '0', 10);
        previousValues[statKey] = currentStatValue;
        pointsRefunded += currentStatValue;
        sheet.getRange(i + 1, statCols[statKey] + 1).setValue(0);
      }

      var newPoints = currentPoints + pointsRefunded;
      sheet.getRange(i + 1, trainingPointsCol + 1).setValue(newPoints);

      // Reset all derived stats to initial values
      handleEditUser(characterId, {
        'hp': 10,
        'damage': 1,
        'defend dice up': 0,
        'attack dice up': 0,
        'speed': 10,
        'passive skill point': 'locked',
        'skill point': '0',
        'ultimate skill point': 'locked'
      });

      return jsonResponse({
        success: true,
        characterId: characterId,
        previousValues: previousValues,
        newValues: {
          strength: 0,
          mobility: 0,
          intelligence: 0,
          technique: 0,
          experience: 0,
          fortune: 0
        },
        pointsRefunded: pointsRefunded,
        remainingPoints: newPoints
      });
    }
  }

  return jsonResponse({ error: 'Character not found: ' + characterId });
}

/* ══════════════════════════════════════
   HARVEST RECORD BOOK
   - Returns interesting harvest statistics/records
   ══════════════════════════════════════ */
function handleFetchHarvestRecords() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(HARVEST_SHEET_NAME);
  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + HARVEST_SHEET_NAME });
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return jsonResponse({ records: {} });
  }

  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });
  var charCountCol = headers.indexOf('charcount');
  var mentionCountCol = headers.indexOf('mentioncount');
  var drachmaRewardCol = headers.indexOf('drachmareward');
  var roleplayersCol = headers.indexOf('roleplayers');
  var statusCol = headers.indexOf('status');
  var charIdCol = headers.indexOf('characterid');
  var urlCol = headers.indexOf('firsttweeturl');
  var submittedAtCol = headers.indexOf('submittedat');

  var approvedHarvests = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (statusCol !== -1 && row[statusCol].toString().toLowerCase() === 'approved') {
      approvedHarvests.push({
        characterId: charIdCol !== -1 ? row[charIdCol].toString() : '',
        charCount: charCountCol !== -1 ? parseInt(row[charCountCol] || '0', 10) : 0,
        mentionCount: mentionCountCol !== -1 ? parseInt(row[mentionCountCol] || '0', 10) : 0,
        drachmaReward: drachmaRewardCol !== -1 ? parseInt(row[drachmaRewardCol] || '0', 10) : 0,
        roleplayers: roleplayersCol !== -1 ? row[roleplayersCol].toString().split(',').filter(function (x) { return x.trim(); }) : [],
        url: urlCol !== -1 ? row[urlCol].toString() : '',
        submittedAt: submittedAtCol !== -1 ? row[submittedAtCol].toString() : ''
      });
    }
  }

  if (approvedHarvests.length === 0) {
    return jsonResponse({ records: {} });
  }

  // Sort by date (latest to oldest) to prioritize recent records in case of ties
  approvedHarvests.sort(function (a, b) {
    var dateA = new Date(a.submittedAt).getTime();
    var dateB = new Date(b.submittedAt).getTime();
    return dateB - dateA; // Descending (latest first)
  });

  // Calculate records
  var longestHarvest = approvedHarvests[0];
  var mostParticipants = approvedHarvests[0];
  var biggestReward = approvedHarvests[0];
  var mostTweets = approvedHarvests[0];

  for (var j = 0; j < approvedHarvests.length; j++) {
    var harvest = approvedHarvests[j];

    if (harvest.charCount > longestHarvest.charCount) {
      longestHarvest = harvest;
    }

    if (harvest.roleplayers.length > mostParticipants.roleplayers.length) {
      mostParticipants = harvest;
    }

    if (harvest.drachmaReward > biggestReward.drachmaReward) {
      biggestReward = harvest;
    }

    if (harvest.mentionCount > mostTweets.mentionCount) {
      mostTweets = harvest;
    }
  }

  var records = {
    totalApproved: approvedHarvests.length,
    longestHarvest: {
      charCount: longestHarvest.charCount,
      characterId: longestHarvest.characterId,
      url: longestHarvest.url,
      submittedAt: longestHarvest.submittedAt
    },
    mostParticipants: {
      participantCount: mostParticipants.roleplayers.length,
      participants: mostParticipants.roleplayers,
      characterId: mostParticipants.characterId,
      url: mostParticipants.url,
      submittedAt: mostParticipants.submittedAt
    },
    biggestReward: {
      drachmaReward: biggestReward.drachmaReward,
      characterId: biggestReward.characterId,
      url: biggestReward.url,
      submittedAt: biggestReward.submittedAt
    },
    mostTweets: {
      tweetCount: mostTweets.mentionCount,
      characterId: mostTweets.characterId,
      url: mostTweets.url,
      submittedAt: mostTweets.submittedAt
    }
  };

  return jsonResponse({ records: records });
}

/* ══════════════════════════════════════
   TOP HARVESTERS LEADERBOARD
   - Returns characters ranked by total drachma earned from harvests
   ══════════════════════════════════════ */
function handleFetchTopHarvesters(limit) {
  limit = limit ? parseInt(limit, 10) : 0;
  if (limit < 0) limit = 0;

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var harvestSheet = ss.getSheetByName(HARVEST_SHEET_NAME);
  if (!harvestSheet) {
    return jsonResponse({ error: 'Sheet not found: ' + HARVEST_SHEET_NAME });
  }

  var harvestData = harvestSheet.getDataRange().getValues();
  if (harvestData.length <= 1) {
    return jsonResponse({ topHarvesters: [] });
  }

  var headers = harvestData[0].map(function (h) { return h.toString().toLowerCase(); });
  var statusCol = headers.indexOf('status');
  var drachmaRewardCol = headers.indexOf('drachmareward');
  var roleplayersCol = headers.indexOf('roleplayers');

  // Accumulate drachma earned per character
  var earnings = {}; // { characterId: totalDrachma }

  for (var i = 1; i < harvestData.length; i++) {
    var row = harvestData[i];
    if (statusCol !== -1 && row[statusCol].toString().toLowerCase() === 'approved') {
      var drachmaValue = drachmaRewardCol !== -1 ? row[drachmaRewardCol] : '';
      var drachmaStr = drachmaValue.toString().trim();

      // Try to parse as JSON map (new format: {"charA": 50, "charB": 100})
      if (drachmaStr && (drachmaStr.indexOf('{') === 0)) {
        try {
          var rewardMap = JSON.parse(drachmaStr);
          for (var charId in rewardMap) {
            var amount = parseInt(rewardMap[charId], 10) || 0;
            earnings[charId] = (earnings[charId] || 0) + amount;
          }
        } catch (e) {
          // Invalid JSON, skip this record
        }
      } else {
        // Legacy format: single number divided among participants
        var drachma = parseInt(drachmaStr || '0', 10);
        var roleplayers = roleplayersCol !== -1 ? row[roleplayersCol].toString().split(',').filter(function (x) { return x.trim(); }) : [];
        var participantCount = roleplayers.length || 1;
        var perParticipant = Math.floor(drachma / participantCount);

        for (var r = 0; r < roleplayers.length; r++) {
          var charId = roleplayers[r].trim();
          if (charId) {
            earnings[charId] = (earnings[charId] || 0) + perParticipant;
          }
        }
      }
    }
  }

  // Convert to array and sort (top to bottom: highest to lowest)
  var leaderboard = [];
  for (var char in earnings) {
    leaderboard.push({
      characterId: char,
      totalDrachma: earnings[char]
    });
  }

  leaderboard.sort(function (a, b) {
    return b.totalDrachma - a.totalDrachma; // Descending (highest first)
  });

  // Get character names from Character Info sheet
  var charSheet = ss.getSheetByName(CHARACTER_SHEET_NAME);
  if (charSheet) {
    var charData = charSheet.getDataRange().getValues();
    var charHeaders = charData[0].map(function (h) { return h.toString().toLowerCase(); });
    var charIdCol = charHeaders.indexOf('characterid');
    var nickEngCol = charHeaders.indexOf('nickname (eng)');
    var nickThaiCol = charHeaders.indexOf('nickname (thai)');

    for (var l = 0; l < leaderboard.length; l++) {
      var leaderId = leaderboard[l].characterId.toLowerCase();

      for (var c = 1; c < charData.length; c++) {
        if (charIdCol !== -1 && charData[c][charIdCol].toString().trim().toLowerCase() === leaderId) {
          leaderboard[l].nicknameEng = nickEngCol !== -1 ? charData[c][nickEngCol].toString() : '';
          leaderboard[l].nicknameThai = nickThaiCol !== -1 ? charData[c][nickThaiCol].toString() : '';
          break;
        }
      }
    }
  }

  // Limit results (0 = no limit)
  if (limit > 0 && leaderboard.length > limit) {
    leaderboard = leaderboard.slice(0, limit);
  }

  return jsonResponse({ topHarvesters: leaderboard });
}

/* ══════════════════════════════════════
   TRAINING SYSTEM (Google Sheets as Primary Source)
    Sheet: Training Tasks
    Columns: Id | Date | withFullLevelFortune | User | Attempt | Rolls | Mode | Success | Roleplay |
      Tickets | Verified | VerifiedBy | VerifiedAt | RejectReason |
      ArenaId | OpponentId | OpponentName | BattleRounds
   ══════════════════════════════════════ */

// Get the existing training sheet
function getTrainingSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(TRAINING_SHEET_NAME);

  if (!sheet) {
    return null;
  }

  return sheet;
}

// Helper: Find task row by ID
function findTaskRow(sheet, id) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      return i + 1;
    }
  }
  return -1;
}

// Find a training row by userId + date prefix (id may include time suffix)
function findTaskRowByPrefix(sheet, userId, date) {
  var prefix = userId + '_' + date;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var cellId = data[i][0].toString();
    if (cellId.indexOf(prefix) === 0) {
      return i + 1;
    }
  }
  return -1;
}

/* ══════════════════════════════════════
   SUBMIT TRAINING
   - Create new training task record
   - Called when training is completed
   ══════════════════════════════════════ */
function handleSubmitTraining(params) {
  var userId = (params.userId || '').toString().trim();
  var date = (params.date || '').toString().trim();
  var withFullLevelFortune = params.withFullLevelFortune === true || params.withFullLevelFortune === 'true';
  var submittedAt = new Date().toISOString();
  var attempt = parseInt(params.attempt || '5', 10);
  var rolls = params.rolls || [];
  var mode = (params.mode || 'admin').toString().trim();
  var success = params.success === true || params.success === 'true';
  var arenaId = (params.arenaId || '').toString().trim();
  var opponentId = (params.opponentId || '').toString().trim();
  var opponentName = (params.opponentName || '').toString().trim();
  var battleRounds = parseInt(params.battleRounds || '0', 10);

  if (!userId || !date || !Array.isArray(rolls)) {
    return jsonResponse({ error: 'Missing required fields: userId, date, rolls' });
  }

  var sheet = getTrainingSheet();

  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + TRAINING_SHEET_NAME });
  }

  var id = userId + '_' + submittedAt;

  if (findTaskRowByPrefix(sheet, userId, date) > 0) {
    return jsonResponse({ error: 'Training task already exists for this date' });
  }

  // Build row in the requested sequence:
  // Id | Date | withFullLevelFortune | User | Attempt | Rolls | Mode | Success | Roleplay | Tickets | Verified | ...
  var newRow = [
    id,                           // 1: Id
    date,                         // 2: Date
    withFullLevelFortune ? 'TRUE' : 'FALSE', // 3: withFullLevelFortune
    userId,                       // 4: User
    attempt,                      // 5: Attempt
    JSON.stringify(rolls),        // 6: Rolls
    mode,                         // 7: Mode
    success ? 'TRUE' : 'FALSE',   // 8: Success
    '',                           // 9: Roleplay
    0,                            // 10: Tickets
    'pending',                    // 11: Verified
  ];

  sheet.appendRow(newRow);
  return jsonResponse({ success: true, id: id });
}

/* ══════════════════════════════════════
   SUBMIT TRAINING ROLEPLAY
   - Update roleplay link and tickets for a training task
   - Called when user submits roleplay after training
   ══════════════════════════════════════ */
function handleSubmitTrainingRoleplay(params) {
  var userId = (params.userId || '').toString().trim();
  var date = (params.date || '').toString().trim();
  var roleplayUrl = (params.roleplayUrl || '').toString().trim();
  var tickets = parseInt(params.tickets || '0', 10);

  if (!userId || !date || !roleplayUrl) {
    return jsonResponse({ error: 'Missing required fields: userId, date, roleplayUrl' });
  }

  var sheet = getTrainingSheet();

  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + TRAINING_SHEET_NAME });
  }

  var row = findTaskRowByPrefix(sheet, userId, date);

  if (row === -1) {
    return jsonResponse({ error: 'Training task not found' });
  }

  // Roleplay is column 9, tickets column 10, verified column 11
  sheet.getRange(row, 9).setValue(roleplayUrl);
  sheet.getRange(row, 10).setValue(tickets);

  var currentVerified = sheet.getRange(row, 11).getValue().toString().toLowerCase();
  if (currentVerified === 'rejected') {
    sheet.getRange(row, 11).setValue('pending');
    sheet.getRange(row, 14).setValue('');
  }

  return jsonResponse({ success: true });
}

/* ══════════════════════════════════════
   VERIFY TRAINING
   - Admin approves or rejects a training submission
   - verified: 'approved' or 'rejected'
   ══════════════════════════════════════ */
function handleVerifyTraining(params) {
  var userId = (params.userId || '').toString().trim();
  var date = (params.date || '').toString().trim();
  var verified = (params.verified || '').toString().trim().toLowerCase();
  var verifiedBy = (params.verifiedBy || '').toString().trim();
  var rejectReason = (params.rejectReason || '').toString().trim();

  if (!userId || !date || !verified || !verifiedBy) {
    return jsonResponse({ error: 'Missing required fields: userId, date, verified, verifiedBy' });
  }

  if (verified !== 'approved' && verified !== 'rejected') {
    return jsonResponse({ error: 'verified must be "approved" or "rejected"' });
  }

  var sheet = getTrainingSheet();

  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + TRAINING_SHEET_NAME });
  }

  var row = findTaskRowByPrefix(sheet, userId, date);

  if (row === -1) {
    return jsonResponse({ error: 'Training task not found' });
  }

  // Read fields according to the new column order:
  // Mode is column 7, Success is column 8, withFullLevelFortune is column 3
  var mode = sheet.getRange(row, 7).getValue().toString().toLowerCase();
  var success = sheet.getRange(row, 8).getValue().toString().toUpperCase() === 'TRUE';

  var withFullLevelFortune = false;
  try {
    var wffCell = sheet.getRange(row, 3).getValue();
    withFullLevelFortune = (wffCell === true || wffCell === 'TRUE' || wffCell === 'true' || wffCell === '1' || wffCell === 1);
  } catch (e) {
    withFullLevelFortune = params.withFullLevelFortune === true || params.withFullLevelFortune === 'true';
  }

  sheet.getRange(row, 11).setValue(verified);

  // Award training point if approved
  if (verified === 'approved') {
    var shouldAwardPoint = false;

    // PvP mode: award TP for both success and fail
    if (mode === 'pvp') {
      shouldAwardPoint = true;
    }
    // Normal/Admin mode: award TP only if success is true
    else if (success) {
      shouldAwardPoint = true;
    }

    if (shouldAwardPoint) {
      var trainingPointResult = updateTrainingPoints(userId, withFullLevelFortune ? 2 : 1);
      var trainingPointData = JSON.parse(trainingPointResult.getContent());

      if (!trainingPointData.success) {
        return jsonResponse({
          success: false,
          verified: verified,
          error: 'Training verified but failed to award point: ' + (trainingPointData.error || 'Unknown error')
        });
      }

      return jsonResponse({
        success: true,
        verified: verified,
        trainingPoints: {
          previous: trainingPointData.previous,
          current: trainingPointData.current
        }
      });
    }
  }

  return jsonResponse({ success: true, verified: verified });
}

/* ══════════════════════════════════════
   RECHECK TRAINING
   - User requests recheck after rejection
   - Changes verified from 'rejected' to 'pending'
   ══════════════════════════════════════ */
function handleRecheckTraining(params) {
  var userId = (params.userId || '').toString().trim();
  var date = (params.date || '').toString().trim();

  if (!userId || !date) {
    return jsonResponse({ error: 'Missing required fields: userId, date' });
  }

  var sheet = getTrainingSheet();

  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + TRAINING_SHEET_NAME });
  }

  var row = findTaskRowByPrefix(sheet, userId, date);

  if (row === -1) {
    return jsonResponse({ error: 'Training task not found' });
  }

  var currentVerified = sheet.getRange(row, 11).getValue().toString().toLowerCase();
  if (currentVerified !== 'rejected') {
    return jsonResponse({ error: 'Can only recheck rejected trainings. Current status: ' + currentVerified });
  }

  sheet.getRange(row, 11).setValue('pending');
  sheet.getRange(row, 14).setValue('');

  return jsonResponse({ success: true, verified: 'pending' });
}

/* ══════════════════════════════════════
   FETCH TRAININGS
   - Fetch training records with filters
   - Supports userId, verified, and mode filters
   ══════════════════════════════════════ */
function handleFetchTrainings(userId, verified, mode) {
  var sheet = getTrainingSheet();

  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + TRAINING_SHEET_NAME });
  }

  var data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return jsonResponse({ trainings: [] });
  }

  var trainings = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];

    if (userId && row[2] !== userId) continue;
    if (verified && row[9].toString().toLowerCase() !== verified.toLowerCase()) continue;
    if (mode && row[5] !== mode) continue;

    var rolls = [];
    try {
      rolls = JSON.parse(row[4]);
    } catch (e) {
      rolls = [];
    }

    trainings.push({
      id: row[0] || '',
      date: row[1] || '',
      userId: row[2] || '',
      attempt: row[3] || 0,
      rolls: rolls,
      mode: row[5] || 'admin',
      success: row[6] === 'TRUE' || row[6] === true,
      roleplay: row[7] || '',
      tickets: row[8] || 0,
      verified: row[9] || 'pending',
      verifiedBy: row[10] || '',
      verifiedAt: row[11] || '',
      rejectReason: row[12] || '',
      arenaId: row[13] || '',
      opponentId: row[14] || '',
      opponentName: row[15] || '',
      battleRounds: row[16] || 0
    });
  }

  return jsonResponse({ trainings: trainings });
}

/* ══════════════════════════════════════
   FETCH ALL TRAININGS
   - Fetch all training records (for admin view)
   - No filters applied
   ══════════════════════════════════════ */
function handleFetchAllTrainings() {
  return handleFetchTrainings(null, null, null);
}

/* ══════════════════════════════════════
   CREATE ITEM
   - Adds a new item or weapon to the appropriate sheet
   - Determines sheet based on itemId prefix (weapon_ → Weapon Info)
   ══════════════════════════════════════ */
function handleCreateItem(params) {
  var itemId = (params.itemId || '').toString().trim();
  var labelEng = (params.labelEng || '').toString().trim();
  var labelThai = (params.labelThai || '').toString().trim();
  var imageUrl = (params.imageUrl || '').toString().trim();
  var tier = (params.tier || '').toString().trim();
  var description = (params.description || '').toString().trim();
  var price = parseFloat(params.price || '0');
  var piece = params.piece === 'infinity' ? 'infinity' : parseInt(params.piece || '0', 10);
  var available = params.available === 'true' || params.available === true;

  if (!itemId || !labelEng) {
    return jsonResponse({ error: 'Missing itemId or labelEng' });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);

  // Determine which sheet to use
  var isWeapon = itemId.toLowerCase().startsWith('weapon_');
  var sheetName = isWeapon ? 'Weapon Info' : 'Item Info';
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + sheetName });
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });
  var itemIdCol = headers.indexOf('itemid');

  // Check for duplicate
  if (itemIdCol !== -1) {
    for (var i = 1; i < data.length; i++) {
      if (data[i][itemIdCol].toString().trim().toLowerCase() === itemId.toLowerCase()) {
        return jsonResponse({ error: 'Item already exists: ' + itemId });
      }
    }
  }

  // Build row for sheet
  var row = [];
  for (var j = 0; j < headers.length; j++) {
    var h = headers[j];
    if (h === 'itemid') row.push(itemId);
    else if (h === 'labeleng') row.push(labelEng);
    else if (h === 'labelthai') row.push(labelThai);
    else if (h === 'imageurl') row.push(imageUrl);
    else if (h === 'tier') row.push(tier);
    else if (h === 'description') row.push(description);
    else if (h === 'price') row.push(price);
    else if (h === 'piece') row.push(piece);
    else if (h === 'available') row.push(available);
    else row.push('');
  }

  sheet.appendRow(row);

  return jsonResponse({ success: true, itemId: itemId, sheet: sheetName });
}

/* ══════════════════════════════════════
   EDIT ITEM
   - Updates an existing item/weapon in the appropriate sheet
   ══════════════════════════════════════ */
function handleEditItem(itemId, fields) {
  itemId = (itemId || '').toString().trim();
  if (!itemId) {
    return jsonResponse({ error: 'Missing itemId' });
  }
  if (!fields || typeof fields !== 'object') {
    return jsonResponse({ error: 'Missing fields' });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);

  // Try both sheets
  var sheets = ['Item Info', 'Weapon Info'];
  var updated = false;

  for (var s = 0; s < sheets.length; s++) {
    var sheet = ss.getSheetByName(sheets[s]);
    if (!sheet) continue;

    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });
    var itemIdCol = headers.indexOf('itemid');

    if (itemIdCol === -1) continue;

    // Find the item row
    for (var i = 1; i < data.length; i++) {
      if (data[i][itemIdCol].toString().trim().toLowerCase() === itemId.toLowerCase()) {
        // Update fields
        for (var fieldName in fields) {
          var colIdx = headers.indexOf(fieldName.toLowerCase());
          if (colIdx !== -1) {
            var value = fields[fieldName];
            // Convert types for specific fields
            if (fieldName.toLowerCase() === 'price') {
              value = parseFloat(value) || 0;
            } else if (fieldName.toLowerCase() === 'piece') {
              value = value === 'infinity' ? 'infinity' : parseInt(value, 10) || 0;
            } else if (fieldName.toLowerCase() === 'available') {
              value = value === 'true' || value === true;
            }
            sheet.getRange(i + 1, colIdx + 1).setValue(value);
          }
        }
        updated = true;
        return jsonResponse({ success: true, itemId: itemId, sheet: sheets[s] });
      }
    }
  }

  if (!updated) {
    return jsonResponse({ error: 'Item not found: ' + itemId });
  }
}

/* ══════════════════════════════════════
   DELETE ITEM
   - Removes an item/weapon from the appropriate sheet
   ══════════════════════════════════════ */
function handleDeleteItem(itemId) {
  itemId = (itemId || '').toString().trim();
  if (!itemId) {
    return jsonResponse({ error: 'Missing itemId' });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);

  // Try both sheets
  var sheets = ['Item Info', 'Weapon Info'];

  for (var s = 0; s < sheets.length; s++) {
    var sheet = ss.getSheetByName(sheets[s]);
    if (!sheet) continue;

    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });
    var itemIdCol = headers.indexOf('itemid');

    if (itemIdCol === -1) continue;

    // Find and delete the item row
    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][itemIdCol].toString().trim().toLowerCase() === itemId.toLowerCase()) {
        sheet.deleteRow(i + 1);
        return jsonResponse({ success: true, itemId: itemId, sheet: sheets[s] });
      }
    }
  }

  return jsonResponse({ error: 'Item not found: ' + itemId });
}

/* ══════════════════════════════════════
   CUSTOM EQUIPMENT MANAGEMENT
   ══════════════════════════════════════ */

/* ══════════════════════════════════════
   CREATE CUSTOM EQUIPMENT
   - Adds a new custom equipment to the Custom Equipment sheet
   ══════════════════════════════════════ */
function handleCreateEquipment(params) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(CUSTOM_EQUIPMENT);

  if (!sheet) {
    return jsonResponse({ error: 'Custom Equipment sheet not found. Please create it first.' });
  }

  var itemId = (params.itemId || '').toString().trim();
  if (!itemId) {
    return jsonResponse({ error: 'Missing itemId' });
  }

  // Check if item already exists
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });
  var itemIdCol = headers.indexOf('itemid');

  if (itemIdCol !== -1) {
    for (var i = 1; i < data.length; i++) {
      if (data[i][itemIdCol].toString().trim().toLowerCase() === itemId.toLowerCase()) {
        return jsonResponse({ error: 'Equipment with this ID already exists: ' + itemId });
      }
    }
  }

  // Map headers to column indices
  var colMap = {};
  headers.forEach(function (h, idx) {
    colMap[h] = idx;
  });

  // Prepare row data (match header order)
  var newRow = [];
  for (var i = 0; i < headers.length; i++) {
    newRow.push(''); // Initialize with empty values
  }

  // Fill in the values
  if (colMap['itemid'] !== undefined) newRow[colMap['itemid']] = params.itemId || '';
  if (colMap['label (eng)'] !== undefined) newRow[colMap['label (eng)']] = params.labelEng || '';
  if (colMap['label (thai)'] !== undefined) newRow[colMap['label (thai)']] = params.labelThai || '';
  if (colMap['image url'] !== undefined) newRow[colMap['image url']] = params.imageUrl || '';
  if (colMap['description'] !== undefined) newRow[colMap['description']] = params.description || '';
  if (colMap['categories'] !== undefined) newRow[colMap['categories']] = params.categories || '';
  if (colMap['characterid'] !== undefined) newRow[colMap['characterid']] = params.characterId || '';
  if (colMap['price'] !== undefined) newRow[colMap['price']] = params.price || 0;
  if (colMap['available'] !== undefined) newRow[colMap['available']] = params.available !== undefined ? params.available : true;

  sheet.appendRow(newRow);
  return jsonResponse({ success: true, itemId: params.itemId });
}

/* ══════════════════════════════════════
   EDIT CUSTOM EQUIPMENT
   - Updates an existing custom equipment
   ══════════════════════════════════════ */
function handleEditEquipment(itemId, fields) {
  itemId = (itemId || '').toString().trim();
  if (!itemId) {
    return jsonResponse({ error: 'Missing itemId' });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(CUSTOM_EQUIPMENT);

  if (!sheet) {
    return jsonResponse({ error: 'Custom Equipment sheet not found' });
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });
  var itemIdCol = headers.indexOf('itemid');

  if (itemIdCol === -1) {
    return jsonResponse({ error: 'itemid column not found' });
  }

  // Find the equipment row
  for (var i = 1; i < data.length; i++) {
    if (data[i][itemIdCol].toString().trim().toLowerCase() === itemId.toLowerCase()) {
      // Update each field
      for (var key in fields) {
        if (fields.hasOwnProperty(key)) {
          var colIdx = headers.indexOf(key.toLowerCase());
          if (colIdx !== -1) {
            var value = fields[key];
            // Convert string 'true'/'false' to boolean for available field
            if (key.toLowerCase() === 'available' && typeof value === 'string') {
              value = value === 'true' || value === true;
            }
            sheet.getRange(i + 1, colIdx + 1).setValue(value);
          }
        }
      }
      return jsonResponse({ success: true, itemId: itemId });
    }
  }

  return jsonResponse({ error: 'Equipment not found: ' + itemId });
}

/* ══════════════════════════════════════
   DELETE CUSTOM EQUIPMENT
   - Removes a custom equipment from the sheet
   ══════════════════════════════════════ */
function handleDeleteEquipment(itemId) {
  itemId = (itemId || '').toString().trim();
  if (!itemId) {
    return jsonResponse({ error: 'Missing itemId' });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(CUSTOM_EQUIPMENT);

  if (!sheet) {
    return jsonResponse({ error: 'Custom Equipment sheet not found' });
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });
  var itemIdCol = headers.indexOf('itemid');

  if (itemIdCol === -1) {
    return jsonResponse({ error: 'itemid column not found' });
  }

  // Find and delete the equipment row
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][itemIdCol].toString().trim().toLowerCase() === itemId.toLowerCase()) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: true, itemId: itemId });
    }
  }

  return jsonResponse({ error: 'Equipment not found: ' + itemId });
}

/* ══════════════════════════════════════
   INSIDE HELPER
   ══════════════════════════════════════ */

function getCharacterInfo(characterId, field) {
  characterId = (characterId || '').toString().trim().toLowerCase();
  field = (field || '').toString().trim().toLowerCase();

  if (!characterId || !field) return null;

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(CHARACTER_SHEET_NAME);
  if (!sheet) return null;

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;

  var headers = data[0].map(h => h.toString().toLowerCase());
  var idCol = headers.indexOf('characterid');
  var fieldCol = headers.indexOf(field);

  if (idCol === -1 || fieldCol === -1) return null;

  for (var i = 1; i < data.length; i++) {
    if (data[i][idCol].toString().trim().toLowerCase() === characterId) {
      return data[i][fieldCol];
    }
  }

  return null; // not found
}