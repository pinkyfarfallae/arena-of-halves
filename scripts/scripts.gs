/**
 * Google Apps Script — Character + User Manager (single deployment)
 *
 * Deploy as Web App:
 * 1. Open https://script.google.com
 * 2. Paste this ENTIRE file (replaces both old files)
 * 3. Deploy → Manage deployments → edit → new version
 *    - Execute as: Me
 *    - Who has access: Anyone
 */

var SHEET_ID = '1P3gaozLPryFY8itFVx7YzBTrFfdSn2tllTKJIMXVWOA';
var CHARACTER_SHEET_NAME = 'Character Info';
var USER_SHEET_NAME = 'User';
var HARVEST_SHEET_NAME = 'Strawberry Harvest';
var DAILY_TRAINING_DICE = 'Daily Training Dice';

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
    return handleFetchTrainings(e.parameter.userId, e.parameter.verified);
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

    if (data.action === 'appendDailyTraining') {
      return handleAppendDailyTraining(data);
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
  var password    = (params.password || '').toString().trim();
  var nameThai    = (params.nameThai || '').toString().trim();
  var nameEng     = (params.nameEng || '').toString().trim();
  var nickThai    = (params.nicknameThai || '').toString().trim();
  var nickEng     = (params.nicknameEng || '').toString().trim();
  var deityBlood  = (params.deityBlood || '').toString().trim();
  var sex         = (params.sex || '').toString().trim();
  var cabin       = parseInt(params.cabin || '0', 10) || 0;

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
    else if (ch === 'skill point') charRow.push('locked');
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
  var drachmaReward = parseInt(params.drachmaReward || '0', 10);
  var roleplayers = params.roleplayers || []; // Array of characterIds

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

  var rowIndex = -1;
  var submitterCharId = '';

  // Find submission by ID
  for (var i = 1; i < harvestData.length; i++) {
    var recordId = harvestData[i][idCol] ? harvestData[i][idCol].toString().trim() : '';
    if (recordId === submissionId) {
      rowIndex = i;
      submitterCharId = harvestData[i][charIdCol].toString().trim();
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
  if (drachmaRewardCol !== -1) harvestSheet.getRange(rowIndex + 1, drachmaRewardCol + 1).setValue(drachmaReward);
  if (roleplayersCol !== -1) harvestSheet.getRange(rowIndex + 1, roleplayersCol + 1).setValue(roleplayers.join(','));

  // Award drachma to all roleplayers using updateCharacterDrachma
  var awarded = [];
  var failed = [];
  
  for (var r = 0; r < roleplayers.length; r++) {
    var roleplayerId = roleplayers[r].toString().trim();
    
    // Use the centralized updateCharacterDrachma function
    var result = updateCharacterDrachma(roleplayerId, drachmaReward);
    var resultData = JSON.parse(result.getContent());
    
    if (resultData.success) {
      awarded.push(roleplayerId + ': ' + resultData.previous + ' → ' + resultData.current);
    } else {
      failed.push(roleplayerId + ': ' + (resultData.error || 'Unknown error'));
    }
  }

  return jsonResponse({ 
    success: true, 
    awarded: awarded,
    failed: failed.length > 0 ? failed : undefined
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
        roleplayers: roleplayersCol !== -1 ? row[roleplayersCol].toString().split(',').filter(function(x) { return x.trim(); }) : [],
        url: urlCol !== -1 ? row[urlCol].toString() : '',
        submittedAt: submittedAtCol !== -1 ? row[submittedAtCol].toString() : ''
      });
    }
  }

  if (approvedHarvests.length === 0) {
    return jsonResponse({ records: {} });
  }

  // Sort by date (latest to oldest) to prioritize recent records in case of ties
  approvedHarvests.sort(function(a, b) {
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
      var drachma = drachmaRewardCol !== -1 ? parseInt(row[drachmaRewardCol] || '0', 10) : 0;
      var roleplayers = roleplayersCol !== -1 ? row[roleplayersCol].toString().split(',').filter(function(x) { return x.trim(); }) : [];

      for (var r = 0; r < roleplayers.length; r++) {
        var charId = roleplayers[r].trim();
        if (charId) {
          earnings[charId] = (earnings[charId] || 0) + drachma;
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

  leaderboard.sort(function(a, b) {
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
   DAILY TRAINING DICE
   - Append daily training roll results
   ══════════════════════════════════════ */

/**
 * Append a daily training roll to the sheet
 * Expects:
 *   - date: YYYY-MM-DD
 *   - userId: characterId
 *   - rolls: array [1-12, 1-12, 1-12, 1-12, 1-12]
 *   - target: 1-12
 *   - success: boolean
 *   - attempt: number of rolls attempted (1-5)
 *   - roleplay: optional string
 *   - tickets: number (default 0)
 */
function handleAppendDailyTraining(params) {
  var date = (params.date || '').toString().trim();
  var userId = (params.userId || '').toString().trim();
  var attempt = parseInt(params.attempt || '5', 10);
  var rolls = params.rolls || [];
  var target = parseInt(params.target || '0', 10);
  var success = params.success === true || params.success === 'true';
  var roleplay = (params.roleplay || '').toString().trim();
  var tickets = parseInt(params.tickets || '0', 10);

  if (!date || !userId || !Array.isArray(rolls) || rolls.length !== 5 || target < 1 || target > 12) {
    return jsonResponse({ error: 'Missing or invalid fields for daily training' });
  }

  // Validate rolls are all 0-12 (0 = unrolled)
  for (var i = 0; i < rolls.length; i++) {
    var roll = parseInt(rolls[i], 10);
    if (isNaN(roll) || roll < 0 || roll > 12) {
      return jsonResponse({ error: 'Invalid dice roll: ' + rolls[i] });
    }
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(DAILY_TRAINING_DICE);
  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + DAILY_TRAINING_DICE });
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });

  // Build row according to schema:
  // Date, User, Attempt, Rolls, Target, Success, Roleplay, Verified, Tickets
  var row = [];
  var rollsString = rolls.join(',');

  for (var j = 0; j < headers.length; j++) {
    var h = headers[j];
    if (h === 'date') row.push(date);
    else if (h === 'user') row.push(userId);
    else if (h === 'attempt') row.push(attempt);
    else if (h === 'rolls') row.push(rollsString);
    else if (h === 'target') row.push(target);
    else if (h === 'success') row.push(success);
    else if (h === 'roleplay') row.push(roleplay);
    else if (h === 'verified') row.push('pending'); // Default to pending, admin can update
    else if (h === 'tickets') row.push(tickets); // Training tickets earned
    else row.push('');
  }

  sheet.appendRow(row);
  return jsonResponse({ success: true, date: date, userId: userId });
}

/* ══════════════════════════════════════
   FETCH TRAININGS
   - Fetch training records filtered by userId and/or verified status
   - Similar to fetchHarvests
   ══════════════════════════════════════ */
function handleFetchTrainings(userId, verified) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(DAILY_TRAINING_DICE);
  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + DAILY_TRAINING_DICE });
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return jsonResponse({ trainings: [] });
  }

  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });
  var trainings = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var training = {};

    for (var j = 0; j < headers.length; j++) {
      training[headers[j]] = row[j] ? row[j].toString() : '';
    }

    // Add row index for updates
    training.rowIndex = i;

    // Filter by userId if provided
    if (userId && training.user !== userId) {
      continue;
    }

    // Filter by verified status if provided
    if (verified && training.verified !== verified) {
      continue;
    }

    trainings.push(training);
  }

  return jsonResponse({ trainings: trainings });
}

/* ══════════════════════════════════════
   FETCH ALL TRAININGS
   - Fetch all training records (for admin view)
   ══════════════════════════════════════ */
function handleFetchAllTrainings() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(DAILY_TRAINING_DICE);
  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + DAILY_TRAINING_DICE });
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return jsonResponse({ trainings: [] });
  }

  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });
  var trainings = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var training = {};

    for (var j = 0; j < headers.length; j++) {
      training[headers[j]] = row[j] ? row[j].toString() : '';
    }

    // Add row index for updates
    training.rowIndex = i;

    trainings.push(training);
  }

  return jsonResponse({ trainings: trainings });
}

/* ══════════════════════════════════════
   SUBMIT TRAINING ROLEPLAY
   - Update roleplay link for a training record
   - User submits after completing training
   ══════════════════════════════════════ */
function handleSubmitTrainingRoleplay(params) {
  var userId = (params.userId || '').toString().trim();
  var date = (params.date || '').toString().trim();
  var roleplayUrl = (params.roleplayUrl || '').toString().trim();

  if (!userId || !date || !roleplayUrl) {
    return jsonResponse({ error: 'Missing required fields: userId, date, roleplayUrl' });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(DAILY_TRAINING_DICE);
  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + DAILY_TRAINING_DICE });
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });

  var userCol = headers.indexOf('user');
  var dateCol = headers.indexOf('date');
  var roleplayCol = headers.indexOf('roleplay');
  var verifiedCol = headers.indexOf('verified');

  // Find the training record
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    var recordUser = data[i][userCol] ? data[i][userCol].toString().trim() : '';
    var recordDate = data[i][dateCol] ? data[i][dateCol].toString().trim() : '';
    
    if (recordUser === userId && recordDate === date) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex === -1) {
    return jsonResponse({ error: 'Training record not found for user: ' + userId + ' on date: ' + date });
  }

  // Update roleplay URL
  if (roleplayCol !== -1) {
    sheet.getRange(rowIndex + 1, roleplayCol + 1).setValue(roleplayUrl);
  }

  // Reset verified to pending if it was rejected
  var currentVerified = data[rowIndex][verifiedCol] ? data[rowIndex][verifiedCol].toString().toLowerCase() : '';
  if (currentVerified === 'rejected' && verifiedCol !== -1) {
    sheet.getRange(rowIndex + 1, verifiedCol + 1).setValue('pending');
  }

  return jsonResponse({ success: true, userId: userId, date: date });
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
    return jsonResponse({ error: 'Invalid verified status. Must be \"approved\" or \"rejected\"' });
  }

  if (verified === 'rejected' && !rejectReason) {
    return jsonResponse({ error: 'Reject reason is required when rejecting' });
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(DAILY_TRAINING_DICE);
  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + DAILY_TRAINING_DICE });
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });

  var userCol = headers.indexOf('user');
  var dateCol = headers.indexOf('date');
  var verifiedCol = headers.indexOf('verified');
  var verifiedByCol = headers.indexOf('verifiedby');
  var verifiedAtCol = headers.indexOf('verifiedat');
  var rejectReasonCol = headers.indexOf('rejectreason');

  // Find the training record
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    var recordUser = data[i][userCol] ? data[i][userCol].toString().trim() : '';
    var recordDate = data[i][dateCol] ? data[i][dateCol].toString().trim() : '';
    
    if (recordUser === userId && recordDate === date) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex === -1) {
    return jsonResponse({ error: 'Training record not found for user: ' + userId + ' on date: ' + date });
  }

  // Update verified status
  if (verifiedCol !== -1) {
    sheet.getRange(rowIndex + 1, verifiedCol + 1).setValue(verified);
  }

  // Update verifiedBy
  if (verifiedByCol !== -1) {
    sheet.getRange(rowIndex + 1, verifiedByCol + 1).setValue(verifiedBy);
  }

  // Update verifiedAt
  if (verifiedAtCol !== -1) {
    sheet.getRange(rowIndex + 1, verifiedAtCol + 1).setValue(new Date().toISOString());
  }

  // Update reject reason if rejected
  if (verified === 'rejected' && rejectReasonCol !== -1) {
    sheet.getRange(rowIndex + 1, rejectReasonCol + 1).setValue(rejectReason);
  } else if (verified === 'approved' && rejectReasonCol !== -1) {
    // Clear reject reason if approving
    sheet.getRange(rowIndex + 1, rejectReasonCol + 1).setValue('');
  }

  return jsonResponse({ 
    success: true, 
    userId: userId, 
    date: date, 
    verified: verified 
  });
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

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(DAILY_TRAINING_DICE);
  if (!sheet) {
    return jsonResponse({ error: 'Sheet not found: ' + DAILY_TRAINING_DICE });
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return h.toString().toLowerCase(); });

  var userCol = headers.indexOf('user');
  var dateCol = headers.indexOf('date');
  var verifiedCol = headers.indexOf('verified');

  // Find the training record
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    var recordUser = data[i][userCol] ? data[i][userCol].toString().trim() : '';
    var recordDate = data[i][dateCol] ? data[i][dateCol].toString().trim() : '';
    
    if (recordUser === userId && recordDate === date) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex === -1) {
    return jsonResponse({ error: 'Training record not found for user: ' + userId + ' on date: ' + date });
  }

  // Check if currently rejected
  var currentVerified = data[rowIndex][verifiedCol] ? data[rowIndex][verifiedCol].toString().toLowerCase() : '';
  if (currentVerified !== 'rejected') {
    return jsonResponse({ error: 'Can only recheck rejected trainings. Current status: ' + currentVerified });
  }

  // Change verified to pending
  if (verifiedCol !== -1) {
    sheet.getRange(rowIndex + 1, verifiedCol + 1).setValue('pending');
  }

  return jsonResponse({ 
    success: true, 
    userId: userId, 
    date: date,
    verified: 'pending'
  });
}
