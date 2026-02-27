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

    return jsonResponse({ error: 'Unknown action: ' + data.action });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
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

/* ── Helper ── */
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
