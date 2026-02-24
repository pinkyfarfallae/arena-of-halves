/**
 * Google Apps Script — Deploy as Web App
 *
 * 1. Open https://script.google.com and create a new project
 * 2. Paste this code
 * 3. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the deployment URL and paste into src/data/characters.ts (APPS_SCRIPT_URL)
 */

const SHEET_ID = '1P3gaozLPryFY8itFVx7YzBTrFfdSn2tllTKJIMXVWOA';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action === 'updateTheme') {
      return updateTheme(data.characterId, data.theme);
    }

    return ContentService.createTextOutput(JSON.stringify({ error: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function updateTheme(characterId, themeString) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheets()[0]; // First sheet (Character sheet, gid=0)
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase());

  const idCol = headers.indexOf('characterid');
  const themeCol = headers.indexOf('theme');

  if (idCol === -1 || themeCol === -1) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Column not found' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol].toString().trim().toLowerCase() === characterId.toLowerCase()) {
      sheet.getRange(i + 1, themeCol + 1).setValue(themeString);
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ error: 'Character not found' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Allow GET for testing
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'Theme updater is running' }))
    .setMimeType(ContentService.MimeType.JSON);
}
