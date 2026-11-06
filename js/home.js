// js/home.js
// Page: HOME
// What this file does:
//   1. FETCH prayer times + Hijri date from the Aladhan API        (API 1 and 2)
//   2. FETCH the Qibla direction from the Aladhan API               (API 3)
//   3. FETCH an Ayah of the day from the Al-Quran Cloud API         (API 4)
//   4. Work out the NEXT prayer and show a countdown
//   5. Make a SUGGESTION using our own if...else logic and save it in Local Storage
//   (The 5th API data, the Ramadan date, is fetched in khatam.js)

// ---------- Settings / constants ----------
// Names shown to the user (API gives English names, we show Malay names)
const PRAYER_NAMES = {
  Fajr: 'Subuh',
  Sunrise: 'Syuruk',
  Dhuhr: 'Zohor',
  Asr: 'Asar',
  Maghrib: 'Maghrib',
  Isha: 'Isyak'
};

// Latitude and longitude of each city in our dropdown list.
// WHY we store these ourselves: the prayer times reply from Aladhan contains
// "placeholder" coordinates (8.88, 7.77) that are NOT the real city location,
// and using them gave a wrong Qibla direction. So we give the Qibla API
// the correct coordinates of the city the user chose.
const CITY_COORDINATES = {
  'Kuala Lumpur':     { lat: 3.1390, lng: 101.6869 },
  'Putrajaya':        { lat: 2.9264, lng: 101.6964 },
  'Shah Alam':        { lat: 3.0738, lng: 101.5183 },
  'Seremban':         { lat: 2.7258, lng: 101.9424 },
  'Melaka':           { lat: 2.1896, lng: 102.2501 },
  'Johor Bahru':      { lat: 1.4927, lng: 103.7414 },
  'Kuantan':          { lat: 3.8077, lng: 103.3260 },
  'Kuala Terengganu': { lat: 5.3302, lng: 103.1408 },
  'Kota Bharu':       { lat: 6.1254, lng: 102.2386 },
  'George Town':      { lat: 5.4141, lng: 100.3288 },
  'Ipoh':             { lat: 4.5975, lng: 101.0901 },
  'Alor Setar':       { lat: 6.1248, lng: 100.3678 },
  'Kangar':           { lat: 6.4414, lng: 100.1986 },
  'Kuching':          { lat: 1.5535, lng: 110.3593 },
  'Kota Kinabalu':    { lat: 5.9804, lng: 116.0735 }
};

// Keys used in Local Storage
const KEY_CITY = 'solattime_city';
const KEY_TIMES = 'solattime_timings';
const KEY_SUGGESTION = 'solattime_suggestion';

// Variables that remember data after the API replies
let currentTimings = null;   // the prayer times object from the API
let currentHijriDay = 0;     // today's Hijri day number (1-30)
let currentHijriMonth = 0;   // today's Hijri month number (1-12). Month 9 = Ramadan
let lastMinute = -1;         // used to refresh the suggestion once every minute

// ---------- Get the HTML elements we need to change ----------
const citySelect = document.getElementById('citySelect');
const loadButton = document.getElementById('loadButton');

// ---------- EVENT HANDLERS (what happens when the user clicks) ----------
loadButton.addEventListener('click', loadPrayerTimes);

// When the page opens, load the last city the user chose (saved in Local Storage)
const savedCity = loadData(KEY_CITY, '');
if (savedCity !== '') {
  citySelect.value = savedCity;
  loadPrayerTimes();
}

// =====================================================================
//  PART 1: FETCH PRAYER TIMES (API 1 + 2)
// =====================================================================
async function loadPrayerTimes() {
  const city = citySelect.value;

  // ERROR HANDLING 1: invalid input (no city chosen)
  if (city === '') {
    showMessage('message', 'Please select a city first.', 'error');
    return;
  }

  showMessage('message', 'Loading prayer times for ' + city + '...', 'info');

  try {
    // ---- API CALL: Aladhan "timingsByCity" ----
    // method=17 is the JAKIM (Malaysia) calculation method
    const url = 'https://api.aladhan.com/v1/timingsByCity?city=' +
                encodeURIComponent(city) + '&country=Malaysia&method=17';
    const json = await fetchJSON(url);

    // ERROR HANDLING 2: empty results (API replied but has no timings)
    if (json.code !== 200 || !json.data || !json.data.timings) {
      showMessage('message', 'No prayer times found for ' + city + '. Please try another city.', 'error');
      return;
    }

    // ---- PROCESS THE JSON ----
    // json.data.timings -> { Fajr: "05:45", Sunrise: "07:02", ... }
    // json.data.date.hijri -> { day: "22", month: { en: "Jumada al-Awwal" }, year: "1448" }
    currentTimings = json.data.timings;
    const hijri = json.data.date.hijri;
    currentHijriDay = parseInt(hijri.day, 10);
    currentHijriMonth = hijri.month.number; // 9 means it is Ramadan now

    // Show the data on the page
    showHijriDate(hijri, json.data.date.gregorian);
    showTimesTable();
    showSuggestion();
    startCountdown();

    // Save city + timings in Local Storage (Reminders page reads these too)
    saveData(KEY_CITY, city);
    saveData(KEY_TIMES, { city: city, timings: currentTimings });

    showMessage('message', 'Prayer times loaded for ' + city + '.', 'success');

    // Ask for the Qibla direction (API 3) using the coordinates of the chosen city
    loadQibla(CITY_COORDINATES[city].lat, CITY_COORDINATES[city].lng);
    // Ask for the Ayah of the day (API 4)
    loadAyah();

  } catch (error) {
    // ERROR HANDLING 3: failed API request (no internet, server down)
    showMessage('message', 'Could not get prayer times. Please check your internet connection and try again.', 'error');
  }
}

// ---------- Show Hijri + Gregorian date (DOM manipulation) ----------
function showHijriDate(hijri, gregorian) {
  document.getElementById('hijriDate').textContent =
    hijri.day + ' ' + hijri.month.en + ' ' + hijri.year + ' H';
  document.getElementById('gregorianDate').textContent =
    gregorian.weekday.en + ', ' + gregorian.date;
}

// ---------- Build the prayer times table (DOM manipulation) ----------
function showTimesTable() {
  const tbody = document.getElementById('timesBody');
  tbody.innerHTML = ''; // clear old rows

  // Go through each prayer name and create one table row for it
  for (const apiName in PRAYER_NAMES) {
    const row = document.createElement('tr');
    row.id = 'row-' + apiName;

    const nameCell = document.createElement('td');
    nameCell.textContent = PRAYER_NAMES[apiName];

    const timeCell = document.createElement('td');
    timeCell.textContent = cleanTime(currentTimings[apiName]);

    row.appendChild(nameCell);
    row.appendChild(timeCell);
    tbody.appendChild(row);
  }
  highlightCurrentPrayer();
}

// The API may send "05:45 (+08)". We only keep "05:45".
function cleanTime(text) {
  return String(text).split(' ')[0];
}

// Change "05:45" into minutes since midnight (5*60+45 = 345). Easier to compare.
function toMinutes(text) {
  const parts = cleanTime(text).split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

// Colour the row of the prayer time we are in now (DOM manipulation)
function highlightCurrentPrayer() {
  // remove old highlight
  const rows = document.querySelectorAll('#timesBody tr');
  for (let i = 0; i < rows.length; i++) {
    rows[i].classList.remove('current');
  }

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let current = null;

  // The current prayer is the last one whose time has already passed
  for (const apiName in PRAYER_NAMES) {
    if (nowMin >= toMinutes(currentTimings[apiName])) {
      current = apiName;
    }
  }
  if (current !== null) {
    document.getElementById('row-' + current).classList.add('current');
  }
}

// =====================================================================
//  PART 2: NEXT PRAYER COUNTDOWN
// =====================================================================
let countdownTimer = null;         // remembers the timer so we never run two at once

function startCountdown() {
  clearInterval(countdownTimer);   // stop the old timer (if the user picked another city)
  tick();                          // run once now
  countdownTimer = setInterval(tick, 1000); // then run every 1 second (1000 ms)
}

function tick() {
  if (currentTimings === null) return;

  const now = new Date();
  const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  // The 5 obligatory prayers (Syuruk is not a prayer, so we skip it)
  const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  let nextName = 'Fajr';           // if all today's prayers passed, next is tomorrow's Fajr
  let secondsLeft = 0;
  let found = false;

  for (let i = 0; i < prayers.length; i++) {
    const prayerSeconds = toMinutes(currentTimings[prayers[i]]) * 60;
    if (prayerSeconds > nowSeconds) {
      nextName = prayers[i];
      secondsLeft = prayerSeconds - nowSeconds;
      found = true;
      break;                       // stop at the first prayer that is still ahead
    }
  }

  if (found === false) {
    // After Isyak: count down to tomorrow's Subuh
    secondsLeft = (24 * 3600 - nowSeconds) + toMinutes(currentTimings.Fajr) * 60;
  }

  // Change seconds into hours : minutes : seconds
  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;

  document.getElementById('nextName').textContent = PRAYER_NAMES[nextName] + ' in';
  document.getElementById('countdown').textContent =
    twoDigits(h) + ':' + twoDigits(m) + ':' + twoDigits(s);

  // Once every minute, refresh the highlighted row and the suggestion
  if (now.getMinutes() !== lastMinute) {
    lastMinute = now.getMinutes();
    highlightCurrentPrayer();
    showSuggestion();
  }
}

// =====================================================================
//  PART 3: SUGGESTION LOGIC (written by us, not from an API)
// =====================================================================
// Inputs  : prayer times (API), current time, today's weekday, Hijri day and month (API)
// Output  : an object { title, message, extras[] }  OR null if we cannot suggest
function getSuggestion(timings, hijriDay, hijriMonth, now) {
  // Convert all times to minutes since midnight
  const fajr = toMinutes(timings.Fajr);
  const sunrise = toMinutes(timings.Sunrise);
  const dhuhr = toMinutes(timings.Dhuhr);
  const asr = toMinutes(timings.Asr);
  const maghrib = toMinutes(timings.Maghrib);
  const isha = toMinutes(timings.Isha);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const day = now.getDay(); // 0 = Sunday ... 5 = Friday ... 6 = Saturday

  // FALLBACK: if any time is missing/broken, we cannot make a suggestion
  if (isNaN(fajr) || isNaN(sunrise) || isNaN(dhuhr) || isNaN(asr) || isNaN(maghrib) || isNaN(isha)) {
    return null;
  }

  let title = '';
  let message = '';

  // ---- Main suggestion: depends on the CURRENT TIME and the PRAYER TIMES ----
  if (nowMin < fajr - 90) {
    title = 'Night time';
    message = 'It is still early. Rest well so that you can wake up for Subuh.';
  } else if (nowMin < fajr) {
    title = 'Last part of the night';
    message = 'A blessed time for Solat Tahajjud, istighfar and doa. Prepare for Subuh.';
  } else if (nowMin < sunrise) {
    title = 'Subuh time';
    message = 'Perform Solat Subuh, then read the morning zikr and a few verses of the Quran.';
  } else if (nowMin < sunrise + 15) {
    title = 'Sunrise';
    message = 'Do not pray right now. Continue your zikr and wait until the sun has fully risen.';
  } else if (nowMin < dhuhr - 15) {
    title = 'Dhuha time';
    message = 'Perform Solat Dhuha (2 to 8 rakaat), or start your work and studies with bismillah.';
  } else if (nowMin < dhuhr) {
    title = 'Zohor is near';
    message = 'Take your wudhu and get ready for Solat Zohor.';
  } else if (nowMin < asr) {
    if (day === 5) {
      title = 'Friday prayer time';
      message = 'Perform Solat Jumaat. Remember to wear clean clothes and read selawat.';
    } else {
      title = 'Zohor time';
      message = 'Perform Solat Zohor and the sunnah rawatib prayers.';
    }
  } else if (nowMin < maghrib - 60) {
    title = 'Asar time';
    message = 'Perform Solat Asar, then read your afternoon zikr.';
  } else if (nowMin < maghrib) {
    title = 'Before Maghrib';
    message = 'The last hour before Maghrib is a good time for doa and istighfar.';
  } else if (nowMin < isha) {
    title = 'Maghrib time';
    message = 'Perform Solat Maghrib, then read the Quran until Isyak.';
  } else {
    title = 'Isyak time';
    message = 'Perform Solat Isyak and Witir. Try to sleep early.';
  }

  // ---- Extra tips: depend on the WEEKDAY and the HIJRI DATE (API) ----
  const extras = [];

  switch (day) {
    case 1: // Monday
    case 4: // Thursday
      // (not shown in Ramadan, because everyone is already fasting)
      if (hijriMonth !== 9) {
        extras.push('Today is Monday/Thursday: a sunnah day to fast.');
      }
      break;
    case 5: // Friday
      extras.push('It is Friday: read Surah Al-Kahf and increase your selawat.');
      break;
    default:
      break; // other days have no extra tip
  }

  if (hijriMonth !== 9 && hijriDay >= 13 && hijriDay <= 15) {
    extras.push('Today is one of the Ayyamul Bidh (13th-15th of the Hijri month): sunnah to fast.');
  }

  // ---- Ramadan tips: only when the Hijri month from the API is 9 (Ramadan) ----
  if (hijriMonth === 9) {
    if (nowMin >= fajr - 90 && nowMin < fajr) {
      extras.push('Ramadan: it is sahur time. Eat and drink before Subuh starts.');
    }
    if (nowMin >= maghrib - 30 && nowMin < maghrib + 30) {
      extras.push('Ramadan: it is time to break your fast (iftar). Start with dates and water.');
    }
    if (nowMin >= isha) {
      extras.push('Ramadan: after Isyak, perform Solat Tarawih.');
    }
  }

  return { title: title, message: message, extras: extras };
}

// Show the suggestion on the page and save it in Local Storage
function showSuggestion() {
  const box = document.getElementById('suggestionBox');
  const now = new Date();
  const suggestion = getSuggestion(currentTimings, currentHijriDay, currentHijriMonth, now);

  box.innerHTML = ''; // clear old content

  // FALLBACK message when there is no suitable suggestion
  if (suggestion === null) {
    const p = document.createElement('p');
    p.className = 'big-label';
    p.textContent = 'No suitable suggestion is available right now. Please load valid prayer times.';
    box.appendChild(p);
    return;
  }

  // Build the suggestion box with DOM elements
  const wrapper = document.createElement('div');
  wrapper.className = 'suggestion';

  const heading = document.createElement('h3');
  heading.textContent = suggestion.title;
  wrapper.appendChild(heading);

  const para = document.createElement('p');
  para.textContent = suggestion.message;
  wrapper.appendChild(para);

  for (let i = 0; i < suggestion.extras.length; i++) {
    const extra = document.createElement('p');
    extra.className = 'extra';
    extra.textContent = suggestion.extras[i];
    wrapper.appendChild(extra);
  }

  box.appendChild(wrapper);

  // LOCAL STORAGE: save the latest suggestion
  saveData(KEY_SUGGESTION, {
    title: suggestion.title,
    message: suggestion.message,
    extras: suggestion.extras,
    savedAt: now.toISOString()
  });
}

// =====================================================================
//  PART 4: FETCH QIBLA DIRECTION (API 3)
// =====================================================================
async function loadQibla(latitude, longitude) {
  const text = document.getElementById('qiblaText');
  const arrow = document.getElementById('qiblaArrow');

  try {
    // ---- API CALL: Aladhan "qibla" ----
    const url = 'https://api.aladhan.com/v1/qibla/' + latitude + '/' + longitude;
    const json = await fetchJSON(url);

    // json.data.direction -> a number of degrees from North, e.g. 292.5
    if (json.code !== 200 || !json.data || json.data.direction === undefined) {
      text.textContent = 'Qibla direction is not available for this location.';
      return;
    }

    const degrees = Number(json.data.direction);
    arrow.style.transform = 'rotate(' + degrees + 'deg)'; // turn the arrow (DOM)
    text.textContent = 'Face ' + degrees.toFixed(1) + '° from North (clockwise).';
  } catch (error) {
    text.textContent = 'Could not load the Qibla direction right now.';
  }
}

// =====================================================================
//  PART 5: FETCH AYAH OF THE DAY (API 4)
// =====================================================================
async function loadAyah() {
  const box = document.getElementById('ayahBox');

  // The Quran has 6236 ayat. We pick one number that changes every day.
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((today - startOfYear) / 86400000); // 1 - 366
  const ayahNumber = ((dayOfYear * 37) % 6236) + 1;

  try {
    // ---- API CALL: Al-Quran Cloud, 2 editions: Arabic + English ----
    const url = 'https://api.alquran.cloud/v1/ayah/' + ayahNumber + '/editions/quran-uthmani,en.sahih';
    const json = await fetchJSON(url);

    // json.data is an array: [0] = Arabic edition, [1] = English edition
    if (json.code !== 200 || !json.data || json.data.length < 2) {
      box.textContent = 'No ayah found for today.';
      return;
    }

    const arabic = json.data[0];
    const english = json.data[1];

    box.innerHTML = '';

    const arabicText = document.createElement('div');
    arabicText.className = 'arabic';
    arabicText.textContent = arabic.text;

    const englishText = document.createElement('div');
    englishText.className = 'translation';
    englishText.textContent = english.text;

    const reference = document.createElement('div');
    reference.className = 'reference';
    reference.textContent = 'Surah ' + english.surah.englishName + ' (' +
                            english.surah.number + ':' + english.numberInSurah + ')';

    box.appendChild(arabicText);
    box.appendChild(englishText);
    box.appendChild(reference);
  } catch (error) {
    box.textContent = 'Could not load the ayah of the day right now.';
  }
}
