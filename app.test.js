import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getLocalTodayISODate } from './app.js';

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
