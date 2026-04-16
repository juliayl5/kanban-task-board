import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  DndContext,
  type DragEndEvent,
  closestCorners,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import { supabase } from './lib/supabase'

type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'
type Priority = 'low' | 'normal' | 'high'
type PriorityFilter = 'all' | Priority

type Task = {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: Priority | null
  due_date: string | null
  user_id: string
  created_at: string
}

type TeamMember = {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

type TaskAssignee = {
  id: string
  task_id: string
  team_member_id: string
  user_id: string
  created_at: string
}

type TaskActivityLog = {
  id: string
  task_id: string
  user_id: string
  event_type:
    | 'task_created'
    | 'task_updated'
    | 'status_changed'
    | 'assignee_added'
    | 'assignee_removed'
  message: string
  created_at: string
}

const columns: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'in_review', label: 'In Review' },
  { key: 'done', label: 'Done' },
]

function statusLabel(status: TaskStatus) {
  switch (status) {
    case 'todo':
      return 'To Do'
    case 'in_progress':
      return 'In Progress'
    case 'in_review':
      return 'In Review'
    case 'done':
      return 'Done'
  }
}

function getColumnId(status: TaskStatus) {
  return `column-${status}`
}

function getTaskDragId(taskId: string) {
  return `task-${taskId}`
}

function formatDueDate(dateString: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${dateString}T00:00:00`))
}

function formatRelativeTime(dateString: string) {
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const diffMs = now - then

  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < minute) return 'just now'
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} min ago`
  if (diffMs < day) return `${Math.floor(diffMs / hour)} hr ago`
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)} day ago`

  return new Date(dateString).toLocaleDateString()
}

function isTaskOverdue(task: Task) {
  if (!task.due_date || task.status === 'done') return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const due = new Date(`${task.due_date}T00:00:00`)
  return due.getTime() < today.getTime()
}

function getPriorityBadgeClasses(priority: Priority | null) {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-700'
    case 'normal':
      return 'bg-blue-100 text-blue-700'
    case 'low':
      return 'bg-emerald-100 text-emerald-700'
    default:
      return 'bg-neutral-200 text-neutral-700'
  }
}

function getDueDateBadge(dueDate: string | null, status: TaskStatus) {
  if (!dueDate) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const due = new Date(`${dueDate}T00:00:00`)
  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )

  if (status !== 'done' && diffDays < 0) {
    return {
      text: `Overdue · ${formatDueDate(dueDate)}`,
      classes: 'bg-red-100 text-red-700',
    }
  }

  if (status !== 'done' && diffDays === 0) {
    return {
      text: 'Due today',
      classes: 'bg-amber-100 text-amber-700',
    }
  }

  if (status !== 'done' && diffDays <= 2) {
    return {
      text: `Due soon · ${formatDueDate(dueDate)}`,
      classes: 'bg-amber-100 text-amber-700',
    }
  }

  return {
    text: formatDueDate(dueDate),
    classes: 'bg-neutral-200 text-neutral-700',
  }
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function buildTaskUpdateMessage(
  previousTask: Task,
  nextValues: {
    title: string
    description: string | null
    priority: Priority
    due_date: string | null
  },
) {
  const changedFields: string[] = []

  if (previousTask.title !== nextValues.title) changedFields.push('title')
  if ((previousTask.description ?? null) !== nextValues.description) {
    changedFields.push('description')
  }
  if ((previousTask.priority ?? 'normal') !== nextValues.priority) {
    changedFields.push('priority')
  }
  if ((previousTask.due_date ?? null) !== nextValues.due_date) {
    changedFields.push('due date')
  }

  if (changedFields.length === 0) {
    return 'Updated task details'
  }

  return `Updated ${changedFields.join(', ')}`
}

function TaskForm({
  heading,
  submitLabel,
  title,
  description,
  priority,
  dueDate,
  isSubmitting,
  onTitleChange,
  onDescriptionChange,
  onPriorityChange,
  onDueDateChange,
  onSubmit,
  onCancel,
}: {
  heading: string
  submitLabel: string
  title: string
  description: string
  priority: Priority
  dueDate: string
  isSubmitting: boolean
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onPriorityChange: (value: Priority) => void
  onDueDateChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  return (
    <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-semibold text-neutral-900">{heading}</h2>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="taskTitle"
            className="mb-1 block text-sm font-medium text-neutral-700"
          >
            Title
          </label>
          <input
            id="taskTitle"
            type="text"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Enter task title"
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
          />
        </div>

        <div>
          <label
            htmlFor="taskDescription"
            className="mb-1 block text-sm font-medium text-neutral-700"
          >
            Description
          </label>
          <textarea
            id="taskDescription"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Add a short description"
            rows={3}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="taskPriority"
              className="mb-1 block text-sm font-medium text-neutral-700"
            >
              Priority
            </label>
            <select
              id="taskPriority"
              value={priority}
              onChange={(event) => onPriorityChange(event.target.value as Priority)}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="taskDueDate"
              className="mb-1 block text-sm font-medium text-neutral-700"
            >
              Due date
            </label>
            <input
              id="taskDueDate"
              type="date"
              value={dueDate}
              onChange={(event) => onDueDateChange(event.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={isSubmitting || title.trim() === ''}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : submitLabel}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  )
}

function DraggableTaskCard({
  task,
  assignees,
  onEdit,
  onDelete,
  onOpenDetails,
}: {
  task: Task
  assignees: TeamMember[]
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onOpenDetails: (task: Task) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: getTaskDragId(task.id),
    })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined

  const dueDateBadge = getDueDateBadge(task.due_date, task.status)

  const priorityBorder =
    task.priority === 'high'
      ? 'border-l-4 border-l-red-400'
      : task.priority === 'normal'
        ? 'border-l-4 border-l-blue-400'
        : task.priority === 'low'
          ? 'border-l-4 border-l-emerald-400'
          : ''

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-neutral-200 bg-neutral-50 p-3 shadow-sm transition ${priorityBorder} ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words font-medium text-neutral-900">{task.title}</h3>
        </div>

        <button
          type="button"
          {...listeners}
          {...attributes}
          className="shrink-0 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-100"
          title="Drag task"
          aria-label={`Drag ${task.title}`}
        >
          Drag
        </button>
      </div>

      {task.description && (
        <p className="mt-2 break-words text-sm leading-6 text-neutral-600">
          {task.description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {task.priority && (
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${getPriorityBadgeClasses(task.priority)}`}
          >
            {task.priority}
          </span>
        )}

        {dueDateBadge && (
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${dueDateBadge.classes}`}
          >
            {dueDateBadge.text}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex -space-x-2">
          {assignees.map((member) => (
            <div
              key={member.id}
              title={member.name}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white shadow-sm"
              style={{ backgroundColor: member.color }}
            >
              {getInitials(member.name)}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onOpenDetails(task)}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          Details
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onEdit(task)}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          Edit
        </button>

        <button
          type="button"
          onClick={() => onDelete(task)}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
        >
          Delete
        </button>
      </div>
    </article>
  )
}

function DroppableColumn({
  status,
  label,
  tasks,
  onEdit,
  onDelete,
  onOpenDetails,
  getAssigneesForTask,
}: {
  status: TaskStatus
  label: string
  tasks: Task[]
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onOpenDetails: (task: Task) => void
  getAssigneesForTask: (taskId: string) => TeamMember[]
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: getColumnId(status),
  })

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
        isOver
          ? 'border-neutral-500 ring-2 ring-neutral-300'
          : 'border-neutral-200'
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
          {label}
        </h2>
        <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-600">
          {tasks.length}
        </span>
      </div>

      <div className="min-h-[120px] space-y-3">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
            No matching tasks
          </div>
        ) : (
          tasks.map((task) => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              assignees={getAssigneesForTask(task.id)}
              onEdit={onEdit}
              onDelete={onDelete}
              onOpenDetails={onOpenDetails}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [taskAssignees, setTaskAssignees] = useState<TaskAssignee[]>([])
  const [activityLogs, setActivityLogs] = useState<TaskActivityLog[]>([])

  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showTeamForm, setShowTeamForm] = useState(false)

  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isCreatingMember, setIsCreatingMember] = useState(false)
  const [isMovingTask, setIsMovingTask] = useState(false)
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)

  const [createTitle, setCreateTitle] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createPriority, setCreatePriority] = useState<Priority>('normal')
  const [createDueDate, setCreateDueDate] = useState('')

  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPriority, setEditPriority] = useState<Priority>('normal')
  const [editDueDate, setEditDueDate] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberColor, setNewMemberColor] = useState('#64748b')

  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  async function loadTasks(currentUserId: string) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })

    if (error) throw error
    setTasks((data ?? []) as Task[])
  }

  async function loadTeamMembers(currentUserId: string) {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: true })

    if (error) throw error
    setTeamMembers((data ?? []) as TeamMember[])
  }

  async function loadTaskAssignees(currentUserId: string) {
    const { data, error } = await supabase
      .from('task_assignees')
      .select('*')
      .eq('user_id', currentUserId)

    if (error) throw error
    setTaskAssignees((data ?? []) as TaskAssignee[])
  }

  async function loadActivityLogs(currentUserId: string) {
    const { data, error } = await supabase
      .from('task_activity_logs')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })

    if (error) throw error
    setActivityLogs((data ?? []) as TaskActivityLog[])
  }

  async function loadAll(currentUserId: string) {
    await Promise.all([
      loadTasks(currentUserId),
      loadTeamMembers(currentUserId),
      loadTaskAssignees(currentUserId),
      loadActivityLogs(currentUserId),
    ])
  }

  async function addActivityLog(
    currentUserId: string,
    taskId: string,
    eventType: TaskActivityLog['event_type'],
    message: string,
  ) {
    const { error } = await supabase.from('task_activity_logs').insert({
      task_id: taskId,
      user_id: currentUserId,
      event_type: eventType,
      message,
    })

    if (error) throw error
  }

  function resetCreateForm() {
    setCreateTitle('')
    setCreateDescription('')
    setCreatePriority('normal')
    setCreateDueDate('')
  }

  function resetEditForm() {
    setEditTitle('')
    setEditDescription('')
    setEditPriority('normal')
    setEditDueDate('')
  }

  function closeCreateForm() {
    setShowCreateForm(false)
    resetCreateForm()
  }

  function closeEditForm() {
    setEditingTaskId(null)
    resetEditForm()
  }

  function closeTeamForm() {
    setShowTeamForm(false)
    setNewMemberName('')
    setNewMemberColor('#64748b')
  }

  function startEditing(task: Task) {
    setShowCreateForm(false)
    setEditingTaskId(task.id)
    setEditTitle(task.title)
    setEditDescription(task.description ?? '')
    setEditPriority(task.priority ?? 'normal')
    setEditDueDate(task.due_date ?? '')
    setActionError(null)
  }

  function getAssigneesForTask(taskId: string) {
    const links = taskAssignees.filter((item) => item.task_id === taskId)

    return links
      .map((link) => teamMembers.find((member) => member.id === link.team_member_id))
      .filter(Boolean) as TeamMember[]
  }

  function getLogsForTask(taskId: string) {
    return activityLogs.filter((log) => log.task_id === taskId)
  }

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  )

  useEffect(() => {
    async function init() {
      try {
        setLoading(true)
        setFatalError(null)

        const {
          data: { session },
        } = await supabase.auth.getSession()

        let currentUserId = session?.user?.id ?? null

        if (!currentUserId) {
          const { error } = await supabase.auth.signInAnonymously()
          if (error) throw error

          const {
            data: { session: newSession },
          } = await supabase.auth.getSession()

          currentUserId = newSession?.user?.id ?? null
        }

        if (!currentUserId) {
          throw new Error('Could not get anonymous user session.')
        }

        setUserId(currentUserId)
        await loadAll(currentUserId)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong.'
        setFatalError(message)
      } finally {
        setLoading(false)
      }
    }

    void init()
  }, [])

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedTitle = createTitle.trim()
    const trimmedDescription = createDescription.trim()

    if (!userId) {
      setActionError('No guest user found.')
      return
    }

    if (!trimmedTitle) {
      setActionError('Title is required.')
      return
    }

    try {
      setIsCreating(true)
      setActionError(null)

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: trimmedTitle,
          description: trimmedDescription || null,
          status: 'todo',
          priority: createPriority,
          due_date: createDueDate || null,
          user_id: userId,
        })
        .select()
        .single()

      if (error) throw error

      await addActivityLog(
        userId,
        data.id,
        'task_created',
        `Created task "${data.title}"`,
      )

      await loadAll(userId)
      closeCreateForm()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not create task.'
      setActionError(message)
    } finally {
      setIsCreating(false)
    }
  }

  async function handleUpdateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedTitle = editTitle.trim()
    const trimmedDescription = editDescription.trim()
    const nextDescription = trimmedDescription || null
    const nextDueDate = editDueDate || null

    if (!userId || !editingTaskId) {
      setActionError('No task selected.')
      return
    }

    if (!trimmedTitle) {
      setActionError('Title is required.')
      return
    }

    const previousTask = tasks.find((task) => task.id === editingTaskId)
    if (!previousTask) {
      setActionError('Could not find task to update.')
      return
    }

    const updateMessage = buildTaskUpdateMessage(previousTask, {
      title: trimmedTitle,
      description: nextDescription,
      priority: editPriority,
      due_date: nextDueDate,
    })

    try {
      setIsUpdating(true)
      setActionError(null)

      const { error } = await supabase
        .from('tasks')
        .update({
          title: trimmedTitle,
          description: nextDescription,
          priority: editPriority,
          due_date: nextDueDate,
        })
        .eq('id', editingTaskId)
        .eq('user_id', userId)

      if (error) throw error

      await addActivityLog(userId, editingTaskId, 'task_updated', updateMessage)
      await loadAll(userId)
      closeEditForm()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not update task.'
      setActionError(message)
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleDeleteTask(task: Task) {
    if (!userId) {
      setActionError('No guest user found.')
      return
    }

    const confirmed = window.confirm(`Delete "${task.title}"?`)
    if (!confirmed) return

    try {
      setDeletingTaskId(task.id)
      setActionError(null)

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id)
        .eq('user_id', userId)

      if (error) throw error

      await loadAll(userId)

      if (editingTaskId === task.id) {
        closeEditForm()
      }

      if (selectedTaskId === task.id) {
        setSelectedTaskId(null)
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not delete task.'
      setActionError(message)
    } finally {
      setDeletingTaskId(null)
    }
  }

  async function handleCreateTeamMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = newMemberName.trim()

    if (!userId) {
      setActionError('No guest user found.')
      return
    }

    if (!trimmedName) {
      setActionError('Team member name is required.')
      return
    }

    try {
      setIsCreatingMember(true)
      setActionError(null)

      const { error } = await supabase.from('team_members').insert({
        name: trimmedName,
        color: newMemberColor,
        user_id: userId,
      })

      if (error) throw error

      await loadAll(userId)
      closeTeamForm()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not create team member.'
      setActionError(message)
    } finally {
      setIsCreatingMember(false)
    }
  }

  async function assignMemberToTask(task: Task, member: TeamMember) {
    if (!userId) return

    const alreadyAssigned = taskAssignees.some(
      (item) => item.task_id === task.id && item.team_member_id === member.id,
    )

    if (alreadyAssigned) return

    try {
      setActionError(null)

      const { error } = await supabase.from('task_assignees').insert({
        task_id: task.id,
        team_member_id: member.id,
        user_id: userId,
      })

      if (error) throw error

      await addActivityLog(
        userId,
        task.id,
        'assignee_added',
        `Assigned ${member.name}`,
      )

      await loadAll(userId)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not assign member.'
      setActionError(message)
    }
  }

  async function unassignMemberFromTask(task: Task, member: TeamMember) {
    if (!userId) return

    try {
      setActionError(null)

      const { error } = await supabase
        .from('task_assignees')
        .delete()
        .eq('task_id', task.id)
        .eq('team_member_id', member.id)
        .eq('user_id', userId)

      if (error) throw error

      await addActivityLog(
        userId,
        task.id,
        'assignee_removed',
        `Removed assignee ${member.name}`,
      )

      await loadAll(userId)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not remove assignee.'
      setActionError(message)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || !userId) {
      return
    }

    const activeId = String(active.id)
    const overId = String(over.id)

    if (!activeId.startsWith('task-') || !overId.startsWith('column-')) {
      return
    }

    const taskId = activeId.replace('task-', '')
    const nextStatus = overId.replace('column-', '') as TaskStatus
    const task = tasks.find((item) => item.id === taskId)

    if (!task || nextStatus === task.status) {
      return
    }

    const previousTasks = tasks
    setActionError(null)

    setTasks((currentTasks) =>
      currentTasks.map((item) =>
        item.id === taskId ? { ...item, status: nextStatus } : item,
      ),
    )

    try {
      setIsMovingTask(true)

      const { error } = await supabase
        .from('tasks')
        .update({ status: nextStatus })
        .eq('id', taskId)
        .eq('user_id', userId)

      if (error) throw error

      await addActivityLog(
        userId,
        taskId,
        'status_changed',
        `Moved from ${statusLabel(task.status)} → ${statusLabel(nextStatus)}`,
      )

      await loadActivityLogs(userId)
    } catch (err) {
      setTasks(previousTasks)
      const message =
        err instanceof Error ? err.message : 'Could not move task.'
      setActionError(message)
    } finally {
      setIsMovingTask(false)
    }
  }

  const filteredTasks = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return tasks.filter((task) => {
      const matchesSearch =
        normalizedQuery === '' ||
        task.title.toLowerCase().includes(normalizedQuery) ||
        (task.description ?? '').toLowerCase().includes(normalizedQuery)

      const matchesPriority =
        priorityFilter === 'all' || task.priority === priorityFilter

      return matchesSearch && matchesPriority
    })
  }, [tasks, searchQuery, priorityFilter])

  const tasksByColumn = useMemo(() => {
    return {
      todo: filteredTasks.filter((task) => task.status === 'todo'),
      in_progress: filteredTasks.filter((task) => task.status === 'in_progress'),
      in_review: filteredTasks.filter((task) => task.status === 'in_review'),
      done: filteredTasks.filter((task) => task.status === 'done'),
    }
  }, [filteredTasks])

  const stats = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter((task) => task.status === 'done').length
    const inProgress = tasks.filter((task) => task.status === 'in_progress').length
    const overdue = tasks.filter((task) => isTaskOverdue(task)).length

    return [
      { label: 'Total tasks', value: total.toString() },
      { label: 'Done', value: done.toString() },
      { label: 'In progress', value: inProgress.toString() },
      { label: 'Overdue', value: overdue.toString() },
    ]
  }, [tasks])

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-100 p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-semibold tracking-tight">Task Board</h1>
          <p className="mt-2 text-sm text-neutral-600">Loading your board...</p>
        </div>
      </main>
    )
  }

  if (fatalError) {
    return (
      <main className="min-h-screen bg-neutral-100 p-4 sm:p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-red-700">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-neutral-700">{fatalError}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-100 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight">Task Board</h1>
            <p className="mt-2 break-all text-sm text-neutral-600">
              Guest user: {userId}
            </p>
            {isMovingTask && (
              <p className="mt-2 text-sm text-neutral-500">Saving move...</p>
            )}
            {deletingTaskId && (
              <p className="mt-2 text-sm text-neutral-500">Deleting task...</p>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setActionError(null)
                closeEditForm()
                setShowCreateForm((current) => !current)
              }}
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800"
            >
              {showCreateForm ? 'Close Form' : '+ New Task'}
            </button>

            <button
              type="button"
              onClick={() => {
                setActionError(null)
                setShowTeamForm((current) => !current)
              }}
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              {showTeamForm ? 'Close Team Form' : '+ Add Team Member'}
            </button>
          </div>
        </header>

        <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Team</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Add members and assign them inside the task detail drawer
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {teamMembers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-300 px-4 py-3 text-sm text-neutral-500">
                No team members yet
              </div>
            ) : (
              teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-2"
                >
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{ backgroundColor: member.color }}
                  >
                    {getInitials(member.name)}
                  </div>
                  <span className="text-sm text-neutral-800">{member.name}</span>
                </div>
              ))
            )}
          </div>

          {showTeamForm && (
            <form
              onSubmit={handleCreateTeamMember}
              className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px_auto]"
            >
              <input
                type="text"
                value={newMemberName}
                onChange={(event) => setNewMemberName(event.target.value)}
                placeholder="Member name"
                className="rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
              />

              <input
                type="color"
                value={newMemberColor}
                onChange={(event) => setNewMemberColor(event.target.value)}
                className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-2 py-2"
              />

              <button
                type="submit"
                disabled={isCreatingMember || newMemberName.trim() === ''}
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreatingMember ? 'Adding...' : 'Add Member'}
              </button>
            </form>
          )}
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <p className="text-sm text-neutral-500">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
            <div>
              <label
                htmlFor="search"
                className="mb-1 block text-sm font-medium text-neutral-700"
              >
                Search tasks
              </label>
              <input
                id="search"
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by title or description"
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
              />
            </div>

            <div>
              <label
                htmlFor="priorityFilter"
                className="mb-1 block text-sm font-medium text-neutral-700"
              >
                Priority filter
              </label>
              <select
                id="priorityFilter"
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(event.target.value as PriorityFilter)
                }
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-neutral-500"
              >
                <option value="all">All priorities</option>
                <option value="low">Low only</option>
                <option value="normal">Normal only</option>
                <option value="high">High only</option>
              </select>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setPriorityFilter('all')
                }}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                Clear filters
              </button>
            </div>
          </div>

          <p className="mt-3 text-sm text-neutral-500">
            Showing {filteredTasks.length} of {tasks.length} tasks
          </p>
        </section>

        {actionError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {showCreateForm && (
          <TaskForm
            heading="Create New Task"
            submitLabel="Create Task"
            title={createTitle}
            description={createDescription}
            priority={createPriority}
            dueDate={createDueDate}
            isSubmitting={isCreating}
            onTitleChange={setCreateTitle}
            onDescriptionChange={setCreateDescription}
            onPriorityChange={setCreatePriority}
            onDueDateChange={setCreateDueDate}
            onSubmit={handleCreateTask}
            onCancel={() => {
              setActionError(null)
              closeCreateForm()
            }}
          />
        )}

        {editingTaskId && (
          <TaskForm
            heading="Edit Task"
            submitLabel="Save Changes"
            title={editTitle}
            description={editDescription}
            priority={editPriority}
            dueDate={editDueDate}
            isSubmitting={isUpdating}
            onTitleChange={setEditTitle}
            onDescriptionChange={setEditDescription}
            onPriorityChange={setEditPriority}
            onDueDateChange={setEditDueDate}
            onSubmit={handleUpdateTask}
            onCancel={() => {
              setActionError(null)
              closeEditForm()
            }}
          />
        )}

        <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {columns.map((column) => (
              <DroppableColumn
                key={column.key}
                status={column.key}
                label={statusLabel(column.key)}
                tasks={tasksByColumn[column.key]}
                onEdit={startEditing}
                onDelete={handleDeleteTask}
                onOpenDetails={(task) => setSelectedTaskId(task.id)}
                getAssigneesForTask={getAssigneesForTask}
              />
            ))}
          </section>
        </DndContext>
      </div>

      {selectedTask && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/25"
            onClick={() => setSelectedTaskId(null)}
          />

          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-neutral-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="break-words text-xl font-semibold text-neutral-900">
                  {selectedTask.title}
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {statusLabel(selectedTask.status)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTaskId(null)}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition hover:bg-neutral-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {selectedTask.priority && (
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${getPriorityBadgeClasses(selectedTask.priority)}`}
                >
                  {selectedTask.priority}
                </span>
              )}

              {selectedTask.due_date && (
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    getDueDateBadge(selectedTask.due_date, selectedTask.status)?.classes ??
                    'bg-neutral-200 text-neutral-700'
                  }`}
                >
                  {getDueDateBadge(selectedTask.due_date, selectedTask.status)?.text ??
                    formatDueDate(selectedTask.due_date)}
                </span>
              )}
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
                Description
              </h3>

              <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                {selectedTask.description ? (
                  <p className="text-sm leading-6 text-neutral-700">
                    {selectedTask.description}
                  </p>
                ) : (
                  <p className="text-sm text-neutral-500">No description</p>
                )}
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
                Assignees
              </h3>

              <div className="mt-3 space-y-2">
                {teamMembers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
                    No team members yet. Add team members from the main page first.
                  </div>
                ) : (
                  teamMembers.map((member) => {
                    const assigned = getAssigneesForTask(selectedTask.id).some(
                      (item) => item.id === member.id,
                    )

                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between rounded-xl border border-neutral-200 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: member.color }}
                          >
                            {getInitials(member.name)}
                          </div>
                          <span className="text-sm text-neutral-800">
                            {member.name}
                          </span>
                        </div>

                        {assigned ? (
                          <button
                            type="button"
                            onClick={() => unassignMemberFromTask(selectedTask, member)}
                            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => assignMemberToTask(selectedTask, member)}
                            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800"
                          >
                            Assign
                          </button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
                Activity
              </h3>

              <div className="mt-3 space-y-3">
                {getLogsForTask(selectedTask.id).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
                    No activity yet
                  </div>
                ) : (
                  getLogsForTask(selectedTask.id).map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"
                    >
                      <p className="text-sm text-neutral-800">{log.message}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {formatRelativeTime(log.created_at)} ·{' '}
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </>
      )}
    </main>
  )
}
