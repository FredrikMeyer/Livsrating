export function getLocalTodayISODate() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

export function sortRatingsEntries(ratings = {}) {
  return Object.entries(ratings)
    .map(([date, rating]) => [date, Number(rating)])
    .filter(([, rating]) => Number.isFinite(rating))
    .sort(([a], [b]) => a.localeCompare(b));
}

export function summarizeRatings(entries = []) {
  if (!entries.length) {
    return { average: null, count: 0 };
  }

  const total = entries.reduce((sum, [, rating]) => sum + rating, 0);
  const average = Number((total / entries.length).toFixed(1));
  return { average, count: entries.length };
}

export function updateTabState(activeTab, tabButtons = [], tabPanels = []) {
  tabButtons.forEach((button) => {
    const isActive = button?.dataset?.tabButton === activeTab;
    if (typeof button?.setAttribute === 'function') {
      button.setAttribute('aria-selected', String(isActive));
    } else {
      button.ariaSelected = String(isActive);
    }
  });

  tabPanels.forEach((panel) => {
    const isActive = panel?.dataset?.tabPanel === activeTab;
    if (panel) {
      panel.hidden = !isActive;
    }
  });
}

export function setupRatings(doc = document) {
  const dateInput = doc.getElementById('date');
  const ratingInput = doc.getElementById('rating');
  const statusEl = doc.getElementById('status');
  const saveButton = doc.getElementById('save');
  const exportButton = doc.getElementById('export');
  const visualizationEl = doc.getElementById('visualization');
  const tabButtons = Array.from(doc.querySelectorAll('[data-tab-button]'));
  const tabPanels = Array.from(doc.querySelectorAll('[data-tab-panel]'));
  const storage = doc?.defaultView?.localStorage ?? globalThis.localStorage;

  if (!dateInput || !ratingInput || !statusEl || !saveButton || !exportButton || !visualizationEl || !storage || !tabButtons.length || !tabPanels.length) {
    console.warn('Daily ratings UI not found; skipping setup.');
    return;
  }

  const STORAGE_KEY = 'daily-ratings';

  const today = getLocalTodayISODate();
  dateInput.value = today;

  function loadRatings() {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.error('Unable to read localStorage', error);
      return {};
    }
  }

  function saveRatings(ratings) {
    storage.setItem(STORAGE_KEY, JSON.stringify(ratings));
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

  function renderVisualization() {
    const entries = sortRatingsEntries(loadRatings());
    visualizationEl.innerHTML = '';

    if (!entries.length) {
      const empty = doc.createElement('div');
      empty.className = 'viz-empty';
      empty.textContent = 'No answers yet. Save a rating to see your progress.';
      visualizationEl.append(empty);
      return;
    }

    const { average, count } = summarizeRatings(entries);
    const averageText = average?.toFixed ? average.toFixed(1) : '0.0';

    const summary = doc.createElement('div');
    summary.className = 'viz-summary';
    const averageChip = doc.createElement('span');
    averageChip.textContent = `Average rating: ${averageText}/5`;
    const countChip = doc.createElement('span');
    countChip.textContent = `${count} saved day${count === 1 ? '' : 's'}`;
    summary.append(averageChip, countChip);
    visualizationEl.append(summary);

    const bars = doc.createElement('div');
    bars.className = 'bars';
    entries.forEach(([date, rating]) => {
      const row = doc.createElement('div');
      row.className = 'bar-row';

      const label = doc.createElement('div');
      label.className = 'bar-label';
      label.textContent = date;

      const track = doc.createElement('div');
      track.className = 'bar-track';
      const fill = doc.createElement('div');
      fill.className = 'bar-fill';
      const normalizedRating = Math.max(0, Math.min(rating, 5));
      fill.style.width = `${(normalizedRating / 5) * 100}%`;
      track.append(fill);

      const value = doc.createElement('div');
      value.className = 'bar-value';
      value.textContent = `${rating}/5`;

      row.append(label, track, value);
      bars.append(row);
    });

    visualizationEl.append(bars);
  }

  function activateTab(tabName) {
    updateTabState(tabName, tabButtons, tabPanels);
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
    renderVisualization();
  }

  function handleExport() {
    const entries = sortRatingsEntries(loadRatings());

    if (!entries.length) {
      displayStatus('Nothing to export yet. Add a rating first.');
      return;
    }

    const lines = ['date,rating', ...entries.map(([date, rating]) => `${date},${rating}`)];
    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = doc.createElement('a');
    link.href = url;
    link.download = 'daily-ratings.csv';
    link.click();
    URL.revokeObjectURL(url);
    displayStatus('Exported ratings as CSV.');
  }

  dateInput.addEventListener('change', (event) => {
    loadExistingRating(event.target.value);
  });

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => activateTab(button.dataset.tabButton));
  });

  saveButton.addEventListener('click', handleSave);
  exportButton.addEventListener('click', handleExport);

  loadExistingRating(today);
  renderVisualization();
  activateTab('rate');
}

if (typeof document !== 'undefined') {
  setupRatings();
}
