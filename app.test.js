import { strict as assert } from 'node:assert';
import test from 'node:test';
import { getLocalTodayISODate } from './app.js';

test('getLocalTodayISODate returns today in local timezone', () => {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  const expected = today.toISOString().slice(0, 10);

  assert.equal(getLocalTodayISODate(), expected);
});
