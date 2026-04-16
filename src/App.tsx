import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'

type Task = {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: 'low' | 'normal' | 'high' | null
  due_date: string | null
  user_id: string
  created_at: string
}

const columns: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'in_review', label: 'In Review' },
  { key: 'done', label: 'Done' },
]

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function loadTasks(currentUserId: string) {
    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      throw fetchError
    }

    setTasks((data ?? []) as Task[])
  }

  useEffect(() => {
    async function init() {
      try {
        setLoading(true)
        setError(null)

        const {
          data: { session },
        } = await supabase.auth.getSession()

        let currentUserId = session?.user?.id ?? null

        if (!currentUserId) {
          const { error: signInError } = await supabase.auth.signInAnonymously()
          if (signInError) throw signInError

          const {
            data: { session: newSession },
          } = await supabase.auth.getSession()

          currentUserId = newSession?.user?.id ?? null
        }

        if (!currentUserId) {
          throw new Error('Could not get anonymous user session.')
        }

        setUserId(currentUserId)
        await loadTasks(currentUserId)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    void init()
  }, [])

  async function handleCreateTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedTitle = newTitle.trim()

    if (!userId) {
      setCreateError('No guest user found.')
      return
    }

    if (!trimmedTitle) {
      setCreateError('Title is required.')
      return
    }

    try {
      setIsCreating(true)
      setCreateError(null)

      const { error: insertError } = await supabase.from('tasks').insert({
        title: trimmedTitle,
        status: 'todo',
        priority: 'normal',
        user_id: userId,
      })

      if (insertError) {
        throw insertError
      }

      await loadTasks(userId)
      setNewTitle('')
      setShowForm(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not create task.'
      setCreateError(message)
    } finally {
      setIsCreating(false)
    }
  }

  const tasksByColumn = useMemo(() => {
    return {
      todo: tasks.filter((task) => task.status === 'todo'),
      in_progress: tasks.filter((task) => task.status === 'in_progress'),
      in_review: tasks.filter((task) => task.status === 'in_review'),
      done: tasks.filter((task) => task.status === 'done'),
    }
  }, [tasks])

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-100 p-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-semibold tracking-tight">Task Board</h1>
          <p className="mt-2 text-sm text-neutral-600">Loading your board...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-neutral-100 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-red-700">Something went wrong</h1>
          <p className="mt-2 text-sm text-neutral-700">{error}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Task Board</h1>
            <p className="mt-2 text-sm text-neutral-600">Guest user: {userId}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowForm((current) => !current)
              setCreateError(null)
            }}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800"
          >
            {showForm ? 'Close Form' : '+ New Task'}
          </button>
        </header>

        {showForm && (
          <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Create New Task</h2>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="title"
                  className="mb-1 block text-sm font-medium text-neutral-700"
                >
                  Title
                </label>
                <input
                  id="title"
                  type="text"
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="Enter task title"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none ring-0 transition focus:border-neutral-500"
                />
              </div>

              {createError && (
                <p className="text-sm text-red-600">{createError}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isCreating || newTitle.trim() === ''}
                  className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create Task'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setNewTitle('')
                    setCreateError(null)
                  }}
                  className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((column) => {
            const columnTasks = tasksByColumn[column.key]

            return (
              <div
                key={column.key}
                className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
                    {column.label}
                  </h2>
                  <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-600">
                    {columnTasks.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {columnTasks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
                      No tasks yet
                    </div>
                  ) : (
                    columnTasks.map((task) => (
                      <article
                        key={task.id}
                        className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"
                      >
                        <h3 className="font-medium text-neutral-900">{task.title}</h3>
                        {task.description && (
                          <p className="mt-1 text-sm text-neutral-600">
                            {task.description}
                          </p>
                        )}
                      </article>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </section>
      </div>
    </main>
  )
}
