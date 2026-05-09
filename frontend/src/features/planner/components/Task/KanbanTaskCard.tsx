import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '../../types/planner.types';
import { MoreHorizontal, GripVertical } from 'lucide-react';

interface KanbanTaskCardProps {
    task: Task;
    isOverlay?: boolean;
}

const KanbanTaskCard: React.FC<KanbanTaskCardProps> = ({ task, isOverlay }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const priorityColors = {
        LOW: 'bg-blue-100 text-blue-600',
        MEDIUM: 'bg-amber-100 text-amber-600',
        HIGH: 'bg-rose-100 text-rose-600'
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`bg-white dark:bg-slate-700 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-600 mb-3 group cursor-pointer ${isOverlay ? 'shadow-lg scale-105' : ''}`}
        >
            <div className="flex items-start gap-2">
                <div {...attributes} {...listeners} className="mt-1 text-slate-300 dark:text-slate-500 hover:text-slate-500 cursor-grab active:cursor-grabbing">
                    <GripVertical size={16} />
                </div>
                <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${priorityColors[task.priority]}`}>
                            {task.priority}
                        </span>
                        <button className="text-slate-400 hover:text-slate-600">
                            <MoreHorizontal size={14} />
                        </button>
                    </div>
                    <h5 className="text-sm font-semibold text-slate-800 dark:text-white mb-1">{task.title}</h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{task.description}</p>
                </div>
            </div>
        </div>
    );
};

export default KanbanTaskCard;
