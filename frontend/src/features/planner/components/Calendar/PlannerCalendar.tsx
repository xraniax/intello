import React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { ScheduleBlock } from '../../types/planner.types';

interface PlannerCalendarProps {
    schedule: ScheduleBlock[];
}

const PlannerCalendar: React.FC<PlannerCalendarProps> = ({ schedule }) => {
    const events = schedule.map(block => ({
        id: block.id,
        title: block.title,
        start: block.block_date ? `${block.block_date}T${block.start_time}` : undefined,
        end: block.block_date ? `${block.block_date}T${block.end_time}` : undefined,
        daysOfWeek: block.day_of_week ? [block.day_of_week === 7 ? 0 : block.day_of_week] : undefined,
        startTime: block.day_of_week ? block.start_time : undefined,
        endTime: block.day_of_week ? block.end_time : undefined,
        backgroundColor: block.color,
        borderColor: block.color,
        textColor: '#fff',
    }));

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden h-full">
            <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                }}
                events={events}
                editable={true}
                selectable={true}
                selectMirror={true}
                dayMaxEvents={true}
                height="auto"
                slotMinTime="07:00:00"
                slotMaxTime="22:00:00"
                allDaySlot={false}
                themeSystem="standard"
            />
            
            <style>{`
                .fc { --fc-border-color: #f1f5f9; font-family: inherit; }
                .dark .fc { --fc-border-color: #334155; --fc-page-bg-color: #1e293b; }
                .fc-toolbar-title { font-size: 1.25rem !important; font-weight: 700 !important; }
                .fc-button-primary { background-color: #4f46e5 !important; border-color: #4f46e5 !important; }
                .fc-event { border-radius: 6px !important; border: none !important; padding: 2px 4px !important; }
                .fc-v-event { box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1) !important; }
            `}</style>
        </div>
    );
};

export default PlannerCalendar;
