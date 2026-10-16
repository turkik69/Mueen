import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDeviceCommand } from '../native/device-commands.mjs';

test('alarm phrase sets the device clock time without storing a reminder', () => {
  assert.deepEqual(parseDeviceCommand('معين عين لي منبه الساعه ٥ مساءً'), { type: 'alarm', hour: 17, minute: 0 });
  assert.deepEqual(parseDeviceCommand('حط منبه الساعة 12:30 صباحا'), { type: 'alarm', hour: 0, minute: 30 });
  assert.deepEqual(parseDeviceCommand('منبه الساعة 18:45'), { type: 'alarm', hour: 18, minute: 45 });
  assert.match(parseDeviceCommand('منبه الساعة 5').error, /صباحًا أو مساءً/);
  assert.match(parseDeviceCommand('منبه الساعة 25:00').error, /غير صحيح/);
});

test('a named call is separated from the ordinary reminder parser', () => {
  assert.deepEqual(parseDeviceCommand('معين اتصل في تركي اليحيائي الحين'), { type: 'call', name: 'تركي اليحيائي' });
  assert.equal(parseDeviceCommand('ذكرني أتصل في تركي غدًا الساعة 5'), null);
});
