/**
 * Google Apps Script — YSA Temple Trip Daily Stats
 *
 * Spreadsheet structure (two sheets):
 *
 * Sheet: "Daily Stats"
 * Columns: Date | Friday AM Arrivals | Friday PM Arrivals | Saturday Arrivals | Sunday Arrivals | Baptism Confirmed | Baptism Waiting | Endowment Confirmed | Endowment Waiting | Mission Call | Papers In | Preparing Papers
 *
 * Sheet: "Food Preferences"
 * Columns: Date | then one column per food type (e.g. Standard, Vegetarian, Vegan, Halal, Gluten Free)
 * Row 1 must be headers.
 *
 * Deploy as a Web App:
 *   Extensions → Apps Script → Deploy → New Deployment → Web App
 *   Execute as: Me | Who has access: Anyone
 *   Copy the web app URL → paste as SHEETS_WEB_APP_URL secret in Cloudflare
 */

function doGet(e) {
  try {
    const data = getTodayStats();
    return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getTodayStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // --- Daily Stats sheet ---
  const statsSheet = ss.getSheetByName('Daily Stats');
  const statsData = statsSheet.getDataRange().getValues();
  const statsHeaders = statsData[0];

  let statsRow = null;
  for (let i = 1; i < statsData.length; i++) {
    const rowDate = new Date(statsData[i][0]);
    rowDate.setHours(0, 0, 0, 0);
    if (rowDate.getTime() === today.getTime()) {
      statsRow = statsData[i];
      break;
    }
  }

  const col = (name) => {
    const idx = statsHeaders.indexOf(name);
    return statsRow && idx !== -1 ? (statsRow[idx] || 0) : 0;
  };

  // --- Food Preferences sheet ---
  const foodSheet = ss.getSheetByName('Food Preferences');
  const foodData = foodSheet.getDataRange().getValues();
  const foodHeaders = foodData[0]; // e.g. ["Date", "Standard", "Vegetarian", "Vegan", "Halal", "Gluten Free"]

  let foodRow = null;
  for (let i = 1; i < foodData.length; i++) {
    const rowDate = new Date(foodData[i][0]);
    rowDate.setHours(0, 0, 0, 0);
    if (rowDate.getTime() === today.getTime()) {
      foodRow = foodData[i];
      break;
    }
  }

  const food = {};
  for (let i = 1; i < foodHeaders.length; i++) {
    food[foodHeaders[i]] = foodRow ? (foodRow[i] || 0) : 0;
  }

  return {
    date: today.toISOString().split('T')[0],
    arrivals: {
      fridayone: col('Friday AM Arrivals'),
      fridaytwo: col('Friday PM Arrivals'),
      saturday:  col('Saturday Arrivals'),
      sunday:    col('Sunday Arrivals'),
    },
    baptism: {
      confirmed: col('Baptism Confirmed'),
      waiting:   col('Baptism Waiting'),
    },
    endowment: {
      confirmed: col('Endowment Confirmed'),
      waiting:   col('Endowment Waiting'),
    },
    mission: {
      call:       col('Mission Call'),
      papersIn:   col('Papers In'),
      preparing:  col('Preparing Papers'),
    },
    food,
  };
}
