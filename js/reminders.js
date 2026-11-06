// js/reminders.js
// Page: REMINDERS
// This file does CRUD (Create, Read, Update, Delete) on a list of reminders.
// All reminders are saved in Local Storage, so they are still there
// after the app is closed and opened again.

const KEY_REMINDERS = 'solattime_reminders';
const KEY_TIMES = 'solattime_timings'; // saved by the Home page

// Names for the prayer choices (to show text like "After Zohor")
const WHEN_TEXT = {
  Anytime: 'Anytime',
  Fajr: 'After Subuh',
  Dhuhr: 'After Zohor',
  Asr: 'After Asar',
  Maghrib: 'After Maghrib',
  Isha: 'After Isyak'
};

// The list of reminders in memory. Loaded from Local Storage when the page opens.
let reminders = loadData(KEY_REMINDERS, []);

// HTML elements
const form = document.getElementById('reminderForm');
const idInput = document.getElementById('reminderId');
const titleInput = document.getElementById('title');
const categoryInput = document.getElementById('category');
const prayerInput = document.getElementById('prayer');
const noteInput = document.getElementById('note');
const saveButton = document.getElementById('saveButton');
const cancelButton = document.getElementById('cancelButton');

// ---------- EVENT HANDLERS ----------
form.addEventListener('submit', handleSave);       // user presses "Add/Update"
cancelButton.addEventListener('click', resetForm); // user presses "Cancel Edit"

// READ: show the saved reminders when the page opens
renderList();

// =====================================================================
//  CREATE + UPDATE (one form is used for both)
// =====================================================================
function handleSave(event) {
  event.preventDefault(); // stop the page from reloading

  const title = titleInput.value.trim();
  const category = categoryInput.value;
  const prayer = prayerInput.value;
  const note = noteInput.value.trim();

  // ---- INPUT VALIDATION ----
  if (title.length < 3) {
    showMessage('message', 'Title must be at least 3 characters.', 'error');
    return;
  }
  if (category === '') {
    showMessage('message', 'Please choose a category.', 'error');
    return;
  }

  if (idInput.value === '') {
    // ---- CREATE: no id in the hidden field, so this is a new record ----
    const newReminder = {
      id: getNextId(),     // a unique number (highest existing id + 1)
      title: title,
      category: category,
      prayer: prayer,
      note: note
    };
    reminders.push(newReminder);
    saveData(KEY_REMINDERS, reminders);
    showMessage('message', 'Reminder added.', 'success');
  } else {
    // ---- UPDATE: the hidden field holds the id of the reminder we are editing ----
    const id = Number(idInput.value);
    for (let i = 0; i < reminders.length; i++) {
      if (reminders[i].id === id) {
        reminders[i].title = title;
        reminders[i].category = category;
        reminders[i].prayer = prayer;
        reminders[i].note = note;
      }
    }
    saveData(KEY_REMINDERS, reminders);
    showMessage('message', 'Reminder updated.', 'success');
  }

  resetForm();
  renderList();
}

// =====================================================================
//  READ: show all reminders on the page
// =====================================================================
function renderList() {
  const list = document.getElementById('reminderList');
  list.innerHTML = '';
  document.getElementById('count').textContent = reminders.length;

  // EMPTY RESULT message
  if (reminders.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No reminders yet. Add your first one using the form.';
    list.appendChild(empty);
    return;
  }

  // Prayer times saved by the Home page (may be null if the user never opened Home)
  const saved = loadData(KEY_TIMES, null);

  for (let i = 0; i < reminders.length; i++) {
    const item = reminders[i];
    const card = document.createElement('div');
    card.className = 'reminder';

    // Left side: text
    const info = document.createElement('div');

    const heading = document.createElement('h3');
    heading.textContent = item.title;
    info.appendChild(heading);

    const meta = document.createElement('div');
    meta.className = 'meta';
    let whenText = WHEN_TEXT[item.prayer];
    // If we know today's prayer time from the API, show it too
    if (saved !== null && item.prayer !== 'Anytime' && saved.timings[item.prayer]) {
      whenText += ' (' + String(saved.timings[item.prayer]).split(' ')[0] + ', ' + saved.city + ')';
    }
    meta.textContent = item.category + ' | ' + whenText;
    info.appendChild(meta);

    if (item.note !== '') {
      const note = document.createElement('div');
      note.className = 'note';
      note.textContent = item.note;
      info.appendChild(note);
    }

    // Right side: Edit and Delete buttons
    const actions = document.createElement('div');
    actions.className = 'actions';

    const editButton = document.createElement('button');
    editButton.className = 'small';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', function () { startEdit(item.id); });

    const deleteButton = document.createElement('button');
    deleteButton.className = 'small danger';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', function () { deleteReminder(item.id); });

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);

    card.appendChild(info);
    card.appendChild(actions);
    list.appendChild(card);
  }
}

// Look through the list and return the reminder with this id (or null)
function findReminder(id) {
  for (let i = 0; i < reminders.length; i++) {
    if (reminders[i].id === id) {
      return reminders[i];
    }
  }
  return null;
}

// =====================================================================
//  UPDATE (step 1): put the chosen reminder back into the form
// =====================================================================
function startEdit(id) {
  const item = findReminder(id);
  if (item === null) return;

  idInput.value = item.id;           // remember which one we are editing
  titleInput.value = item.title;
  categoryInput.value = item.category;
  prayerInput.value = item.prayer;
  noteInput.value = item.note;

  document.getElementById('formTitle').textContent = 'Edit Reminder';
  saveButton.textContent = 'Update Reminder';
  cancelButton.style.display = 'inline-block';
  showMessage('message', 'Editing "' + item.title + '". Change it and press Update.', 'info');
}

// =====================================================================
//  DELETE
// =====================================================================
function deleteReminder(id) {
  const item = findReminder(id);
  if (item === null) return;

  // Ask the user to confirm
  if (confirm('Delete "' + item.title + '"?') === false) return;

  // Keep every reminder EXCEPT the one with this id
  const remaining = [];
  for (let i = 0; i < reminders.length; i++) {
    if (reminders[i].id !== id) {
      remaining.push(reminders[i]);
    }
  }
  reminders = remaining;
  saveData(KEY_REMINDERS, reminders);

  // If we were editing this one, clear the form
  if (idInput.value === String(id)) resetForm();

  showMessage('message', 'Reminder deleted.', 'success');
  renderList();
}

// Make a new unique id: find the biggest id we already have, then add 1.
// (If the list is empty, the first id is 1.)
function getNextId() {
  let biggest = 0;
  for (let i = 0; i < reminders.length; i++) {
    if (reminders[i].id > biggest) {
      biggest = reminders[i].id;
    }
  }
  return biggest + 1;
}

// Put the form back to "Add" mode
function resetForm() {
  form.reset();
  idInput.value = '';
  document.getElementById('formTitle').textContent = 'Add a Reminder';
  saveButton.textContent = 'Add Reminder';
  cancelButton.style.display = 'none';
}
