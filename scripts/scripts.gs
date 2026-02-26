/**
 * Google Apps Script — Character + Theme Updater (single deployment)
 *
 * Deploy as Web App:
 * 1. Open https://script.google.com
 * 2. Paste this ENTIRE file (replaces both old files)
 * 3. Deploy → Manage deployments → edit → new version
 *    - Execute as: Me
 *    - Who has access: Anyone
 */

const SHEET_ID = '1P3gaozLPryFY8itFVx7YzBTrFfdSn2tllTKJIMXVWOA';
const CHARACTER_SHEET_NAME = 'Character Info';

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

    return jsonResponse({ error: 'Unknown action: ' + data.action });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

/* ── Patch character fields (only changed fields) ── */
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
