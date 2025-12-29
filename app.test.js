import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getLocalTodayISODate, sortRatingsEntries, summarizeRatings, updateTabState } from './app.js';

test('getLocalTodayISODate returns today in local timezone', () => {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  const expected = today.toISOString().slice(0, 10);

  assert.equal(getLocalTodayISODate(), expected);
});

test('date and number inputs use visible text color', () => {
  const html = readFileSync(resolve('index.html'), 'utf-8');
  const inputRulePattern = /input\[type="date"\],\s*input\[type="number"\][\s\S]*?color:\s*var\(--text\)/m;
  assert.match(html, inputRulePattern);
});

test('ratings are sorted, filtered, and summarized before visualization', () => {
  const ratings = {
    '2024-01-02': '4',
    '2024-01-03': 2,
    '2024-01-01': 5,
    'invalid': 'not-a-number',
  };

  const sorted = sortRatingsEntries(ratings);
  const summary = summarizeRatings(sorted);

  assert.deepEqual(sorted, [
    ['2024-01-01', 5],
    ['2024-01-02', 4],
    ['2024-01-03', 2],
  ]);
  assert.equal(summary.average, 3.7);
  assert.equal(summary.count, 3);
});

test('tab state toggles visibility and aria selection', () => {
  const tabs = [
    { dataset: { tabButton: 'rate' }, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } },
    { dataset: { tabButton: 'answers' }, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } },
  ];
  const panels = [
    { dataset: { tabPanel: 'rate' }, hidden: false },
    { dataset: { tabPanel: 'answers' }, hidden: true },
  ];

  updateTabState('answers', tabs, panels);

  assert.equal(tabs[0].attributes['aria-selected'], 'false');
  assert.equal(tabs[1].attributes['aria-selected'], 'true');
  assert.equal(panels[0].hidden, true);
  assert.equal(panels[1].hidden, false);
});
