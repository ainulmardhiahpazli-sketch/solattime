// js/khatam.js
// Page: KHATAM PLANNER
// This is OUR OWN calculation (not fetched from anywhere).
//
// The user types:   1) how many juzuk they have finished
//                   2) how many pages they read each day
// We calculate:     - pages left, days to finish, finish date
//                   - days until Ramadan (date comes from the Aladhan API)
//                   - are they on track to finish BEFORE Ramadan?
//                   - how many pages per day they need to finish before Ramadan

const TOTAL_PAGES = 604;   // pages in the Quran (Madinah Mushaf)
const TOTAL_JUZ = 30;      // juzuk in the Quran
const KEY_KHATAM = 'solattime_khatam_inputs';

let ramadanDate = null;    // will hold the Ramadan start date after the API replies

// HTML elements
const khatamForm = document.getElementById('khatamForm');
const juzInput = document.getElementById('juzDone');
const pagesInput = document.getElementById('pagesPerDay');

// ---------- EVENT HANDLER ----------
khatamForm.addEventListener('submit', function (event) {
  event.preventDefault();   // stop the page from reloading
  calculate();
});

// Restore the last numbers the user typed (from Local Storage)
const lastInputs = loadData(KEY_KHATAM, null);
if (lastInputs !== null) {
  juzInput.value = lastInputs.juz;
  pagesInput.value = lastInputs.pages;
}

// Fetch the Ramadan date as soon as the page opens
loadRamadanDate();

// =====================================================================
//  PART 1: FETCH THE RAMADAN START DATE (API 5)  - 2 API calls
// =====================================================================
async function loadRamadanDate() {
  const info = document.getElementById('ramadanInfo');

  try {
    // ---- API CALL 1: convert TODAY (Gregorian) to a Hijri date ----
    // We need to know the current Hijri year and month.
    const todayUrl = 'https://api.aladhan.com/v1/gToH/' + toApiDate(new Date());
    const todayJson = await fetchJSON(todayUrl);

    if (todayJson.code !== 200 || !todayJson.data) {
      info.textContent = 'Ramadan date not available.';
      return;
    }
    const hijriMonth = todayJson.data.hijri.month.number;     // 1 - 12 (Ramadan is 9)
    let hijriYear = parseInt(todayJson.data.hijri.year, 10);  // e.g. 1448

    // If Ramadan (month 9) has already passed this Hijri year, we want NEXT year's Ramadan
    if (hijriMonth > 9) {
      hijriYear = hijriYear + 1;
    }

    // ---- API CALL 2: convert "1 Ramadan <year>" (Hijri) to a Gregorian date ----
    const ramadanUrl = 'https://api.aladhan.com/v1/hToG/01-09-' + hijriYear;
    const ramadanJson = await fetchJSON(ramadanUrl);

    if (ramadanJson.code !== 200 || !ramadanJson.data) {
      info.textContent = 'Ramadan date not available.';
      return;
    }

    // The API gives the date as text "dd-mm-yyyy". We split it and make a Date object.
    const parts = ramadanJson.data.gregorian.date.split('-');
    ramadanDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));

    info.textContent = '1 Ramadan ' + hijriYear + ' H = ' + formatDate(ramadanDate);

  } catch (error) {
    // failed API request
    info.textContent = 'Could not load the Ramadan date.';
    showMessage('message', 'Could not load the Ramadan date. You can still see your finish date.', 'error');
  }
}

// =====================================================================
//  PART 2: THE CALCULATION (our own formulas)
// =====================================================================
function calculate() {
  // Read the numbers typed by the user
  const juzDone = Number(juzInput.value);
  const pagesPerDay = Number(pagesInput.value);

  // ---- INPUT VALIDATION (boundary cases) ----
  if (juzInput.value === '' || pagesInput.value === '') {
    showMessage('message', 'Please fill in both fields.', 'error');
    return;
  }
  if (Number.isInteger(juzDone) === false || juzDone < 0 || juzDone > TOTAL_JUZ) {
    showMessage('message', 'Juzuk completed must be a whole number from 0 to 30.', 'error');
    return;
  }
  if (Number.isInteger(pagesPerDay) === false || pagesPerDay < 1 || pagesPerDay > TOTAL_PAGES) {
    showMessage('message', 'Pages per day must be a whole number from 1 to 604.', 'error');
    return;
  }

  // Save what the user typed (Local Storage)
  saveData(KEY_KHATAM, { juz: juzDone, pages: pagesPerDay });
  showMessage('message', 'Calculation done.', 'success');

  // ---- FORMULA 1: pages already read ----
  // 604 pages / 30 juzuk = about 20.13 pages per juzuk
  const pagesRead = Math.round(juzDone * TOTAL_PAGES / TOTAL_JUZ);

  // ---- FORMULA 2: pages left ----
  const pagesLeft = TOTAL_PAGES - pagesRead;

  const box = document.getElementById('results');
  box.innerHTML = '';

  // Boundary case: the Quran is already finished
  if (pagesLeft === 0) {
    addStatus(box, 'Alhamdulillah! You have already completed the whole Quran.', 'good');
    return;
  }

  // ---- FORMULA 3: days to finish at the user's pace ----
  // Math.ceil rounds UP, because a part of a day still counts as one day.
  // Example: 10 pages left, 3 pages/day -> 3.33 -> 4 days
  const daysNeeded = Math.ceil(pagesLeft / pagesPerDay);

  // ---- FORMULA 4: finish date ----
  // Today counts as day 1, so the last day is (today + daysNeeded - 1)
  const today = startOfToday();
  const finishDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysNeeded - 1);

  // Show the first group of results
  const rows = [
    ['Pages already read', pagesRead + ' pages'],
    ['Pages left', pagesLeft + ' pages'],
    ['Days to finish at your pace', daysNeeded + ' days'],
    ['Expected finish date', formatDate(finishDate)]
  ];

  // ---- Ramadan part (only if the API gave us the date) ----
  if (ramadanDate !== null) {
    // FORMULA 5: days from today until Ramadan starts
    const daysToRamadan = Math.round((ramadanDate - today) / 86400000); // 86400000 ms = 1 day
    rows.push(['Days until Ramadan', daysToRamadan + ' days']);

    if (daysToRamadan <= 0) {
      // Boundary case: Ramadan already started
      showTable(box, rows);
      addStatus(box, 'Ramadan has already started. Keep reading, and may Allah accept it!', 'good');
      return;
    }

    // FORMULA 6: pages per day needed to finish before Ramadan starts
    const neededPerDay = Math.ceil(pagesLeft / daysToRamadan);
    rows.push(['Pages/day needed to finish before Ramadan', neededPerDay + ' pages/day']);
    rows.push(['Same as about', (neededPerDay / (TOTAL_PAGES / TOTAL_JUZ)).toFixed(2) + ' juzuk/day']);

    showTable(box, rows);

    // FORMULA 7: compare "days needed" with "days until Ramadan"
    if (daysNeeded <= daysToRamadan) {
      const early = daysToRamadan - daysNeeded;
      addStatus(box, 'On track! You will finish ' + early + ' day(s) before Ramadan starts.', 'good');
    } else {
      const late = daysNeeded - daysToRamadan;
      addStatus(box, 'You will finish ' + late + ' day(s) after Ramadan starts. Try to read ' +
                neededPerDay + ' pages/day to finish before Ramadan.', 'late');
    }
  } else {
    // API failed earlier: still show what we can calculate
    showTable(box, rows);
    addStatus(box, 'The Ramadan date is not loaded, so we cannot compare with Ramadan.', 'late');
  }
}

// ---------- Helpers to draw the results (DOM manipulation) ----------
function showTable(box, rows) {
  const table = document.createElement('table');
  table.className = 'result-table';
  const body = document.createElement('tbody');

  rows.forEach(function (row) {
    const tr = document.createElement('tr');
    const label = document.createElement('td');
    label.textContent = row[0];
    const value = document.createElement('td');
    value.textContent = row[1];
    tr.appendChild(label);
    tr.appendChild(value);
    body.appendChild(tr);
  });

  table.appendChild(body);
  box.appendChild(table);
}

function addStatus(box, text, kind) {
  const div = document.createElement('div');
  div.className = 'status ' + kind;   // 'good' (green) or 'late' (yellow)
  div.textContent = text;
  box.appendChild(div);
}
