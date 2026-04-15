import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { Task, Status } from '../types'
import { TaskCard } from './TaskCard'
import { CreateTaskModal } from './CreateTaskModal'

interface ColumnProps {
  id: Status
  title: string
  color: string
  tasks: Task[]
  onCreateTask: (input: { title: string; description?: string; priority: 'low' | 'normal' | 'high'; due_date?: string; status: Status }) => void
  onDeleteTask: (id: string) => void
}

const columnHeaderColors: Record<Status, string> = {
  todo: 'text-indigo-400',
  in_progress: 'text-amber-400',
  in_review: 'text-violet-400',
  done: 'text-emerald-400',
}

const columnDotColors: Record<Status, string> = {
  todo: 'bg-indigo-400',
  in_progress: 'bg-amber-400',
  in_review: 'bg-violet-400',
  done: 'bg-emerald-400',
}

export function Column({ id, title, tasks, onCreateTask, onDeleteTask }: ColumnProps) {
  const [showModal, setShowModal] = useState(false)

  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <>
      <div className="flex flex-col min-w-0 w-full">
        {/* Column header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${columnDotColors[id]}`} />
            <h2 className={`text-sm font-semibold uppercase tracking-wider ${columnHeaderColors[id]}`}>
              {title}
            </h2>
            <span className="text-xs font-medium text-gray-500 bg-white/5 rounded-full px-2 py-0.5 min-w-[1.25rem] text-center">
              {tasks.length}
            </span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"
            aria-label={`Add task to ${title}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Drop zone */}
        <div
          ref={setNodeRef}
          className={`column-body flex-1 rounded-2xl p-3 transition-all min-h-[200px] ${
            isOver ? 'ring-2 ring-indigo-500/50 bg-indigo-500/5' : ''
          }`}
        >
          <div className="space-y-3">
            {tasks.map(task => (
              <TaskCard key={task.id} task={task} onDelete={onDeleteTask} />
            ))}
          </div>

          {tasks.length === 0 && !isOver && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-xs text-gray-600">No tasks yet</p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                + Add one
              </button>
            </div>
          )}

          {isOver && tasks.length === 0 && (
            <div className="flex items-center justify-center py-10">
              <div className="w-full h-12 rounded-xl border-2 border-dashed border-indigo-500/40 flex items-center justify-center">
                <p className="text-xs text-indigo-400">Drop here</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <CreateTaskModal
          defaultStatus={id}
          onClose={() => setShowModal(false)}
          onSubmit={onCreateTask}
        />
      )}
    </>
  )
}
