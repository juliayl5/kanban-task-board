import { useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import type { Task, Status, Column as ColumnType } from '../types'
import { Column } from './Column'
import { TaskCard } from './TaskCard'
import { CreateTaskModal } from './CreateTaskModal'
import { isSupabaseConfigured } from '../lib/supabase'

const COLUMNS: ColumnType[] = [
  { id: 'todo', title: 'To Do', color: '#6366f1' },
  { id: 'in_progress', title: 'In Progress', color: '#f59e0b' },
  { id: 'in_review', title: 'In Review', color: '#8b5cf6' },
  { id: 'done', title: 'Done', color: '#22c55e' },
]

interface KanbanBoardProps {
  tasks: Task[]
  onCreateTask: (input: { title: string; description?: string; priority: 'low' | 'normal' | 'high'; due_date?: string; status: Status }) => void
  onUpdateTask: (id: string, updates: Partial<Task>) => void
  onDeleteTask: (id: string) => void
}

export function KanbanBoard({ tasks, onCreateTask, onUpdateTask, onDeleteTask }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [showGlobalModal, setShowGlobalModal] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id)
    setActiveTask(task ?? null)
  }

  const handleDragOver = (_event: DragOverEvent) => {
    // handled in DragEnd for simplicity
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const taskId = active.id as string
    const newStatus = over.id as Status

    if (!COLUMNS.find(c => c.id === newStatus)) return

    const task = tasks.find(t => t.id === taskId)
    if (task && task.status !== newStatus) {
      onUpdateTask(taskId, { status: newStatus })
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 px-6 pb-6">
      {/* Demo banner */}
      {!isSupabaseConfigured && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            <strong>Demo mode</strong> — Configure Supabase credentials to enable persistence across devices.
          </span>
        </div>
      )}

      {/* Board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 flex-1">
          {COLUMNS.map(col => (
            <Column
              key={col.id}
              id={col.id}
              title={col.title}
              color={col.color}
              tasks={tasks.filter(t => t.status === col.id)}
              onCreateTask={onCreateTask}
              onDeleteTask={onDeleteTask}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="rotate-2 scale-105 opacity-90">
              <TaskCard task={activeTask} onDelete={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {showGlobalModal && (
        <CreateTaskModal
          defaultStatus="todo"
          onClose={() => setShowGlobalModal(false)}
          onSubmit={onCreateTask}
        />
      )}
    </div>
  )
}
