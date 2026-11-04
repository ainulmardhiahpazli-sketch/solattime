// js/common.js
// Small helper functions used by ALL pages.
// Loaded first in every HTML page, so the other scripts can call these.

// ---------- 1. Show a message to the user (DOM manipulation) ----------
// boxId : id of the <div> where the message appears
// text  : the message
// type  : 'success' | 'error' | 'info'  (changes the colour via CSS)
function showMessage(boxId, text, type) {
  const box = document.getElementById(boxId);
  box.textContent = text;                 // put the text inside the box
  box.className = 'message ' + type;      // set CSS class for colour
  box.style.display = 'block';            // make the box visible

  // Success messages disappear by themselves after 4 seconds
  if (type === 'success') {
    setTimeout(function () {
      box.style.display = 'none';
    }, 4000);
  }
}

// ---------- 2. Local Storage helpers ----------
// Local Storage only stores text, so we convert objects to JSON text.

// Save any object/array under a key
function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Read data back. If nothing is saved (or it is broken), return "fallback".
function loadData(key, fallback) {
  try {
    const text = localStorage.getItem(key);
    if (text === null) return fallback;
    return JSON.parse(text);
  } catch (error) {
    return fallback;
  }
}

// ---------- 3. Fetch JSON from an API ----------
// fetch() asks the internet for data. We wait for it with "await".
// If the internet is off, or the server is slow/down, this function throws an error
// which the calling page catches and shows as a clear message.
async function fetchJSON(url) {
  // Stop waiting after 10 seconds
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, 10000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error('Server error ' + response.status);
    }
    return await response.json(); // convert the reply text into a JavaScript object
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 4. Date helpers ----------
// Today at 00:00 (used for "days until" calculations)
function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Turn a Date into dd-mm-yyyy, the format the Aladhan API wants
function toApiDate(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return dd + '-' + mm + '-' + date.getFullYear();
}

// Friendly date text, e.g. "Mon, 8 Feb 2027"
function formatDate(date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });
}
