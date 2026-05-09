import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task } from '../../types/planner.types';
import KanbanTaskCard from './KanbanTaskCard';
import { Plus } from 'lucide-react';

interface KanbanColumnProps {
    id: string;
    title: string;
    tasks: Task[];
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ id, title, tasks }) => {
    const { setNodeRef } = useDroppable({ id });

    return (
        <div className="flex flex-col bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50 h-full overflow-hidden">
            <div className="flex justify-between items-center mb-4 px-1">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-700 dark:text-slate-300">{title}</h3>
                    <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {tasks.length}
                    </span>
                </div>
                <button className="text-slate-400 hover:text-indigo-500 transition-colors">
                    <Plus size={18} />
                </button>
            </div>
            
            <div ref={setNodeRef} className="flex-1 overflow-y-auto scrollbar-hide min-h-[100px]">
                <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {tasks.map(task => (
                        <KanbanTaskCard key={task.id} task={task} />
                    ))}
                </SortableContext>
            </div>
        </div>
    );
};

export default KanbanColumn;
