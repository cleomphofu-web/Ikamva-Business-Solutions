import test from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleService } from '../services/ScheduleService.js';

test('ScheduleService: evaluates within-shift vs outside-shift deterministically', () => {
  const schedule = {
    days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    start: '09:00',
    end: '17:00',
    timezone: 'Africa/Johannesburg', // UTC+2
  };

  // 2026-09-16 is a Wednesday.
  // 10:30 CAT is 08:30 UTC -> inside shift
  const duringShift = new Date('2026-09-16T08:30:00Z');
  const res1 = ScheduleService.evaluate(schedule, duringShift);
  assert.equal(res1.isWithinShift, true);
  assert.equal(res1.currentDay, 'wed');
  assert.equal(res1.currentTime, '10:30');
  assert.equal(res1.isStartMinute, false);
  assert.equal(res1.isEndMinute, false);

  // 09:00 CAT is 07:00 UTC -> exactly start minute
  const startMinute = new Date('2026-09-16T07:00:00Z');
  const resStart = ScheduleService.evaluate(schedule, startMinute);
  assert.equal(resStart.isWithinShift, true);
  assert.equal(resStart.isStartMinute, true);
  assert.equal(resStart.isEndMinute, false);

  // 17:00 CAT is 15:00 UTC -> end minute (shift ended)
  const endMinute = new Date('2026-09-16T15:00:00Z');
  const resEnd = ScheduleService.evaluate(schedule, endMinute);
  assert.equal(resEnd.isWithinShift, false);
  assert.equal(resEnd.isStartMinute, false);
  assert.equal(resEnd.isEndMinute, true);

  // 20:00 CAT is 18:00 UTC -> outside shift
  const outsideShift = new Date('2026-09-16T18:00:00Z');
  const res2 = ScheduleService.evaluate(schedule, outsideShift);
  assert.equal(res2.isWithinShift, false);
  assert.equal(res2.isStartMinute, false);
  assert.equal(res2.isEndMinute, false);

  // 2026-09-20 is a Sunday -> outside scheduled days
  const weekend = new Date('2026-09-20T10:00:00Z');
  const resWeekend = ScheduleService.evaluate(schedule, weekend);
  assert.equal(resWeekend.isWithinShift, false);
  assert.equal(resWeekend.currentDay, 'sun');
});

test('ScheduleService: defaults to always active if no start/end specified', () => {
  const res = ScheduleService.evaluate({}, new Date());
  assert.equal(res.isWithinShift, true);
});
