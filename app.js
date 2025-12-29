export function getLocalTodayISODate() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

export function setupRatings(doc = document) {
  const dateInput = doc.getElementById('date');
  const ratingInput = doc.getElementById('rating');
  const statusEl = doc.getElementById('status');
  const saveButton = doc.getElementById('save');
  const exportButton = doc.getElementById('export');

  if (!dateInput || !ratingInput || !statusEl || !saveButton || !exportButton) {
    console.warn('Daily ratings UI not found; skipping setup.');
    return;
  }

  const STORAGE_KEY = 'daily-ratings';

  const today = getLocalTodayISODate();
  dateInput.value = today;

  function loadRatings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.error('Unable to read localStorage', error);
      return {};
    }
  }

  function saveRatings(ratings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings));
  }

  function displayStatus(message) {
    statusEl.textContent = message;
  }

  function loadExistingRating(date) {
    const ratings = loadRatings();
    const value = ratings[date];
    ratingInput.value = value ?? '';
    if (value) {
      displayStatus(`You rated this day ${value}/5.`);
    } else {
      displayStatus('No rating saved for this date yet.');
    }
  }

  function handleSave() {
    const selectedDate = dateInput.value;
    const value = Number(ratingInput.value);

    if (!selectedDate) {
      displayStatus('Please pick a date.');
      return;
    }

    if (!Number.isInteger(value) || value < 1 || value > 5) {
      displayStatus('Enter a whole number between 1 and 5.');
      return;
    }

    const ratings = loadRatings();
    ratings[selectedDate] = value;
    saveRatings(ratings);
    displayStatus(`Saved ${value}/5 for ${selectedDate}.`);
  }

  function handleExport() {
    const ratings = loadRatings();
    const entries = Object.entries(ratings).sort(([a], [b]) => a.localeCompare(b));

    if (!entries.length) {
      displayStatus('Nothing to export yet. Add a rating first.');
      return;
    }

    const lines = ['date,rating', ...entries.map(([date, rating]) => `${date},${rating}`)];
    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'daily-ratings.csv';
    link.click();
    URL.revokeObjectURL(url);
    displayStatus('Exported ratings as CSV.');
  }

  dateInput.addEventListener('change', (event) => {
    loadExistingRating(event.target.value);
  });

  saveButton.addEventListener('click', handleSave);
  exportButton.addEventListener('click', handleExport);

  loadExistingRating(today);
}

if (typeof document !== 'undefined') {
  setupRatings();
}
