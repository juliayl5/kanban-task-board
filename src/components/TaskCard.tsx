import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Task, Priority } from '../types'

interface TaskCardProps {
  task: Task
  onDelete: (id: string) => void
}

const priorityConfig: Record<Priority, { label: string; color: string; dot: string }> = {
  high: { label: 'High', color: 'text-red-400', dot: 'bg-red-400' },
  normal: { label: 'Normal', color: 'text-blue-400', dot: 'bg-blue-400' },
  low: { label: 'Low', color: 'text-emerald-400', dot: 'bg-emerald-400' },
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isOverdue(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00')
  return date < new Date(new Date().toDateString())
}

export function TaskCard({ task, onDelete }: TaskCardProps) {
  const [showDelete, setShowDelete] = useState(false)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  }

  const pc = priorityConfig[task.priority]
  const overdue = task.due_date && isOverdue(task.due_date)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card group relative rounded-xl p-4 cursor-grab active:cursor-grabbing transition-all ${isDragging ? 'shadow-2xl ring-2 ring-indigo-500/50' : ''}`}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      {...attributes}
      {...listeners}
    >
      {/* Priority indicator */}
      <div className={`absolute top-0 left-0 w-1 h-full rounded-l-xl ${pc.dot}`} />

      <div className="pl-2">
        {/* Title */}
        <p className="text-sm font-medium text-gray-100 leading-snug pr-6">{task.title}</p>

        {/* Description preview */}
        {task.description && (
          <p className="mt-1.5 text-xs text-gray-500 line-clamp-2 leading-relaxed">{task.description}</p>
        )}

        {/* Meta row */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {/* Priority badge */}
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${pc.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
            {pc.label}
          </span>

          {/* Due date */}
          {task.due_date && (
            <span className={`inline-flex items-center gap-1 text-xs ${overdue ? 'text-red-400' : 'text-gray-500'}`}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(task.due_date)}
            </span>
          )}
        </div>
      </div>

      {/* Delete button */}
      {showDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(task.id)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
          aria-label="Delete task"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
