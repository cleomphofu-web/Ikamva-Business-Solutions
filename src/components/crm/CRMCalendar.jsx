import appServices from '@/lib/app-services';
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { ChevronLeft, ChevronRight, Clock, CheckSquare } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths } from 'date-fns';

export default function CRMCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: tasks = [] } = useQuery({ queryKey: ['crm-all-tasks'], queryFn: () => appServices.records.Task.list() });
  const { data: notes = [] } = useQuery({ queryKey: ['crm-all-notes'], queryFn: () => appServices.records.CRMNote.list('-created_date', 200) });

  const events = useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      if (t.due_date) {
        const key = t.due_date.split('T')[0];
        if (!map[key]) map[key] = [];
        map[key].push({ type: 'task', title: t.title, status: t.status, detail: t.client_email });
      }
    });
    notes.forEach(n => {
      if (n.next_action_date) {
        const key = n.next_action_date.split('T')[0];
        if (!map[key]) map[key] = [];
        map[key].push({ type: 'followup', title: n.next_action || 'Follow-up', status: '', detail: n.client_email });
      }
    });
    return map;
  }, [tasks, notes]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const today = new Date();
  const todayEvents = events[format(today, 'yyyy-MM-dd')] || [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Calendar</h1>
          <p className="text-sm text-slate-500 mt-0.5">Task deadlines & follow-ups</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50" onClick={() => setCurrentDate(addMonths(currentDate, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-slate-800 min-w-32 text-center">{format(currentDate, 'MMMM yyyy')}</span>
          <button className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="w-4 h-4" />
          </button>
          <button className="ml-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700" onClick={() => setCurrentDate(new Date())}>
            Today
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        {/* Calendar */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center py-2.5 text-xs font-semibold text-slate-500 uppercase">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map(d => {
              const key = format(d, 'yyyy-MM-dd');
              const dayEvents = events[key] || [];
              const inMonth = isSameMonth(d, currentDate);
              const isToday = isSameDay(d, today);
              return (
                <div key={key} className={`min-h-24 border-r border-b border-slate-100 p-1.5 ${inMonth ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <div className={`text-xs font-medium mb-1 inline-flex items-center justify-center w-6 h-6 rounded-full ${
                    isToday ? 'bg-indigo-600 text-white' : inMonth ? 'text-slate-700' : 'text-slate-300'
                  }`}>{format(d, 'd')}</div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev, i) => (
                      <div key={i} className={`text-[10px] px-1.5 py-0.5 rounded truncate ${
                        ev.type === 'task' 
                          ? ev.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
                          : 'bg-orange-50 text-orange-700'
                      }`}>
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && <p className="text-[10px] text-slate-400 px-1">+{dayEvents.length - 3} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Today's events */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-1">Today</h3>
          <p className="text-xs text-slate-400 mb-4">{format(today, 'EEEE, MMM d')}</p>
          <div className="space-y-2">
            {todayEvents.length > 0 ? todayEvents.map((ev, i) => (
              <div key={i} className={`p-3 rounded-xl border ${ev.type === 'task' ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {ev.type === 'task' ? <CheckSquare className="w-3 h-3 text-blue-600" /> : <Clock className="w-3 h-3 text-orange-600" />}
                  <span className="text-xs font-medium text-slate-700 capitalize">{ev.type}</span>
                </div>
                <p className="text-sm font-medium text-slate-800">{ev.title}</p>
                {ev.detail && <p className="text-xs text-slate-400 mt-0.5">{ev.detail}</p>}
              </div>
            )) : <p className="text-sm text-slate-400 py-4 text-center">No events today</p>}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100">
            <h3 className="font-semibold text-slate-900 mb-3">Legend</h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded bg-blue-50 border border-blue-200" />
                <span className="text-slate-600">Task due date</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded bg-green-50 border border-green-200" />
                <span className="text-slate-600">Completed task</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded bg-orange-50 border border-orange-100" />
                <span className="text-slate-600">Follow-up</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}