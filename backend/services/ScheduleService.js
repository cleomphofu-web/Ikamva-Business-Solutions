/**
 * ScheduleService.js
 *
 * Evaluates whether an employee is actively within their scheduled operating window.
 * All shift-hours and timezone evaluations are deterministic and calculated in code.
 */

export class ScheduleService {
  /**
   * Determine if the given time is within the configured schedule window.
   *
   * @param {object} schedule - { days: string[], start: string, end: string, timezone: string }
   * @param {Date} [now=new Date()]
   * @returns {{ isWithinShift: boolean, isStartMinute: boolean, isEndMinute: boolean, currentDay: string, currentTime: string, timezone: string }}
   */
  static evaluate(schedule = {}, now = new Date()) {
    const timezone = schedule.timezone || 'UTC';
    const start = schedule.start || null;
    const end = schedule.end || null;
    const days = Array.isArray(schedule.days) && schedule.days.length > 0
      ? schedule.days.map(d => String(d).toLowerCase().slice(0, 3))
      : ['mon', 'tue', 'wed', 'thu', 'fri'];

    if (!start || !end) {
      return {
        isWithinShift: true,
        isStartMinute: false,
        isEndMinute: false,
        currentDay: '',
        currentTime: '',
        timezone,
      };
    }

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const getPart = type => parts.find(p => p.type === type)?.value || '';
    const currentDay = getPart('weekday').toLowerCase().slice(0, 3);
    const currentHour = getPart('hour');
    const currentMinute = getPart('minute');
    const currentTime = `${currentHour}:${currentMinute}`;

    const toMinutes = str => {
      const [h, m] = String(str).split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const currentTotal = Number(currentHour) * 60 + Number(currentMinute);
    const startTotal = toMinutes(start);
    const endTotal = toMinutes(end);

    const isDayActive = days.includes(currentDay);
    const isTimeActive = currentTotal >= startTotal && currentTotal < endTotal;
    const isWithinShift = isDayActive && isTimeActive;
    const isStartMinute = isDayActive && currentTime === start;
    const isEndMinute = isDayActive && currentTime === end;

    return {
      isWithinShift,
      isStartMinute,
      isEndMinute,
      currentDay,
      currentTime,
      timezone,
    };
  }
}
