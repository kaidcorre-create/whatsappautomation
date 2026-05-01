/**
 * Google Apps Script — YSA Temple Booking Sheet Sync
 *
 * Pulls booking data from the Cloudflare Worker /bookings endpoint
 * and upserts it into the correct session sheet, keyed by booking ID.
 *
 * Setup:
 *   1. Paste this into Apps Script (Extensions → Apps Script)
 *   2. Set WORKER_URL and API_KEY below
 *   3. Run syncBookings() once manually to test
 *   4. Add a daily trigger: Triggers → Add Trigger → syncBookings → Time-driven → Day timer
 *
 * Sheet structure per session:
 *   A: Booking ID | B: Name | C: Email | D: Signed Up | E: Status | F: Role (baptism only)
 */

const WORKER_URL = 'https://whatsapp-daily-update.kai-d-corre-ea2.workers.dev';
const API_KEY    = ''; // ← paste your MANUAL_TRIGGER_KEY here

// Maps D1 session title → Google Sheet tab name
const SESSION_SHEET_MAP = {
  // Baptism
  'Baptistry - Group One':      'Baptism One',
  'Baptistry - Group Two':      'Baptism Two',
  'Baptistry - Group Three':    'Baptism Three',
  'Baptistry - Group Four':     'Baptism Four',
  'Baptistry - Group Five':     'Baptism Five',
  'Baptistry - Group Six':      'Baptism Six',
  'Baptistry - Group Seven':    'Baptism Seven',
  'Baptistry - Group Eight':    'Baptism Eight',
  'Baptistry - Group Nine':     'Baptism Nine',
  'Baptistry - Group Ten':      'Baptism Ten',
  'Baptistry - Group Eleven':   'Baptism Eleven',
  'Baptistry - Group Twelve':   'Baptism Twelve',
  'Baptistry - Group Thirteen': 'Baptism Thirteen',
  'Baptistry - Group Fourteen': 'Baptism Fourteen',
  'Baptistry - Group Fifteen':  'Baptism Fifteen',
  // Endowment
  'Endowment - Group One':      'Endowment One',
  'Endowment - Group Two':      'Endowment Two',
  'Endowment - Group Three':    'Endowment Three',
  'Endowment - Group Four':     'Endowment Four',
  'Endowment - Group Five':     'Endowment Five',
  'Endowment - Group Six':      'Endowment Six',
  'Endowment - Group Seven':    'Endowment Seven',
  'Endowment - Group Eight':    'Endowment Eight',
  'Endowment - Group Nine':     'Endowment Nine',
  'Endowment - Group Ten':      'Endowment Ten',
  'Endowment - Group Eleven':   'Endowment Eleven',
  'Endowment - Group Twelve':   'Endowment Twelve',
  'Endowment - Group Thirteen': 'Endowment Thirteen',
  'Endowment - Group Fourteen': 'Endowment Fourteen',
  'Endowment - Group Fifteen':  'Endowment Fifteen',
};

const HEADERS = ['Booking ID', 'Name', 'Email', 'Signed Up', 'Status', 'Role'];

function syncBookings() {
  const url = `${WORKER_URL}/bookings?key=${API_KEY}`;
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

  if (response.getResponseCode() !== 200) {
    throw new Error(`Failed to fetch bookings: ${response.getContentText()}`);
  }

  const bookings = JSON.parse(response.getContentText());
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Group bookings by session sheet name
  const bySheet = {};
  for (const b of bookings) {
    const sheetName = SESSION_SHEET_MAP[b.session_title];
    if (!sheetName) continue; // skip unknown sessions
    if (!bySheet[sheetName]) bySheet[sheetName] = [];
    bySheet[sheetName].push(b);
  }

  // Upsert each sheet
  for (const [sheetName, rows] of Object.entries(bySheet)) {
    upsertSheet(ss, sheetName, rows);
  }
}

function upsertSheet(ss, sheetName, bookings) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // Ensure headers
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  // Build map of existing rows: bookingId → row number
  const lastRow = sheet.getLastRow();
  const existingIds = {};
  if (lastRow > 1) {
    const idCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < idCol.length; i++) {
      if (idCol[i][0]) existingIds[idCol[i][0]] = i + 2; // row number (1-indexed)
    }
  }

  for (const b of bookings) {
    const role = b.baptism_role ? formatRole(b.baptism_role) : '';
    const signedUp = b.created_at ? new Date(b.created_at).toLocaleDateString('en-GB') : '';
    const status = formatStatus(b.status);
    const rowData = [b.id, b.name, b.email, signedUp, status, role];

    if (existingIds[b.id]) {
      // Update existing row
      sheet.getRange(existingIds[b.id], 1, 1, rowData.length).setValues([rowData]);
    } else {
      // Append new row
      sheet.appendRow(rowData);
    }

    // Colour-code the status cell
    const rowNum = existingIds[b.id] || sheet.getLastRow();
    const statusCell = sheet.getRange(rowNum, 5);
    if (b.status === 'confirmed') {
      statusCell.setBackground('#d9ead3'); // green
    } else if (b.status === 'waitlist') {
      statusCell.setBackground('#fff2cc'); // yellow
    } else if (b.status === 'cancelled') {
      statusCell.setBackground('#f4cccc'); // red
    }
  }

  // Auto-resize columns for readability
  sheet.autoResizeColumns(1, HEADERS.length);
}

function formatStatus(status) {
  const map = { confirmed: 'Confirmed', waitlist: 'Waiting List', cancelled: 'Cancelled' };
  return map[status] || status;
}

function formatRole(role) {
  const map = {
    be_baptised: 'Being Baptised',
    baptise:     'Performing Baptism',
    record:      'Recording',
  };
  return map[role] || role;
}
