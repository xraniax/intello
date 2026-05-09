import React from 'react';
import { 
    DndContext, 
    closestCorners, 
    KeyboardSensor, 
    PointerSensor, 
    useSensor, 
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { 
    arrayMove, 
    SortableContext, 
    sortableKeyboardCoordinates, 
    verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { Task } from '../../types/planner.types';
import KanbanColumn from './KanbanColumn';
import KanbanTaskCard from './KanbanTaskCard';

const COLUMNS = [
    { id: 'PENDING', title: 'Inbox' },
    { id: 'IN_PROGRESS', title: 'In Progress' },
    { id: 'COMPLETED', title: 'Done' }
];

const PlannerKanban: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
    const [activeId, setActiveId] = React.useState<string | null>(null);
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const getTasksByStatus = (status: string) => tasks.filter(t => t.status === status);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full min-h-[500px]">
            <DndContext 
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={(event) => setActiveId(event.active.id as string)}
                onDragEnd={() => setActiveId(null)}
            >
                {COLUMNS.map(col => (
                    <KanbanColumn 
                        key={col.id} 
                        id={col.id} 
                        title={col.title} 
                        tasks={getTasksByStatus(col.id)} 
                    />
                ))}
                
                <DragOverlay dropAnimation={{
                    sideEffects: defaultDropAnimationSideEffects({
                        styles: {
                            active: {
                                opacity: '0.5',
                            },
                        },
                    }),
                }}>
                    {activeId ? (
                        <KanbanTaskCard task={tasks.find(t => t.id === activeId)!} isOverlay />
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
};

export default PlannerKanban;
