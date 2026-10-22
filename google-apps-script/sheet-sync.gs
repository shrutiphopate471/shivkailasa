// Paste into Extensions > Apps Script on the target Google Sheet, then
// Deploy > New deployment > type "Web app" > execute as "Me" > access "Anyone".
// Copy the resulting /exec URL into api/config.php as sheet_webhook_url.
// SECRET below must match api/config.php's sheet_secret.

var SECRET = 'change-me-to-a-long-random-string';
var SHEET_NAME = 'Leads';
var HEADERS = ['Lead ID', 'Ref', 'Name', 'Phone', 'Email', 'Purpose', 'BHK', 'Budget',
  'Attracted', 'Score', 'Tag', 'Status', 'Visit Date', 'Visit Time', 'Visitors',
  'Created At', 'Updated At'];

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_json' });
  }
  if (data.secret !== SECRET) return json_({ ok: false, error: 'forbidden' });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.setFrozenRows(1);
      // Keep phone and visit date/time as plain text
      sheet.getRange('D:D').setNumberFormat('@');
      sheet.getRange('M:N').setNumberFormat('@');
    }

    var row = [data.id, data.ref, data.name, String(data.phone || ''), data.email || '',
      data.purpose || '', data.bhk || '', data.budget || '', data.attracted || '',
      data.score, data.tag, data.status,
      String(data.visit_date || ''), String(data.visit_time || ''), data.visitors || '',
      data.created_at, data.updated_at];

    var lastRow = sheet.getLastRow();
    var rowIdx = -1;
    if (lastRow > 1) {
      var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (ids[i][0] === data.id) { rowIdx = i + 2; break; }
      }
    }

    if (rowIdx > 0) sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}