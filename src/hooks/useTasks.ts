import { useState, useEffect, useCallback } from 'react'
import type { Task, Status, Priority } from '../types'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const SAMPLE_TASKS: Task[] = [
  {
    id: 'sample-1',
    title: 'Design system setup',
    description: 'Establish color palette, typography, and component library foundations.',
    status: 'todo',
    priority: 'high',
    due_date: '2025-05-01',
    user_id: 'demo-user-id',
    created_at: new Date().toISOString(),
  },
  {
    id: 'sample-2',
    title: 'User research interviews',
    description: 'Conduct 5 user interviews to validate product assumptions.',
    status: 'todo',
    priority: 'normal',
    due_date: '2025-05-10',
    user_id: 'demo-user-id',
    created_at: new Date().toISOString(),
  },
  {
    id: 'sample-3',
    title: 'API integration',
    description: 'Connect frontend to REST API endpoints for data fetching.',
    status: 'in_progress',
    priority: 'high',
    due_date: '2025-04-28',
    user_id: 'demo-user-id',
    created_at: new Date().toISOString(),
  },
  {
    id: 'sample-4',
    title: 'Authentication flow',
    description: 'Implement login, signup, and password reset screens.',
    status: 'in_progress',
    priority: 'normal',
    user_id: 'demo-user-id',
    created_at: new Date().toISOString(),
  },
  {
    id: 'sample-5',
    title: 'Dashboard analytics',
    description: 'Build charts and metrics for the main dashboard view.',
    status: 'in_review',
    priority: 'normal',
    due_date: '2025-04-25',
    user_id: 'demo-user-id',
    created_at: new Date().toISOString(),
  },
  {
    id: 'sample-6',
    title: 'Onboarding email sequence',
    description: 'Write and schedule welcome email drip campaign.',
    status: 'in_review',
    priority: 'low',
    user_id: 'demo-user-id',
    created_at: new Date().toISOString(),
  },
  {
    id: 'sample-7',
    title: 'Landing page copy',
    description: 'Finalize hero section and feature descriptions.',
    status: 'done',
    priority: 'normal',
    user_id: 'demo-user-id',
    created_at: new Date().toISOString(),
  },
  {
    id: 'sample-8',
    title: 'CI/CD pipeline',
    description: 'Set up GitHub Actions for automated testing and deployment.',
    status: 'done',
    priority: 'high',
    user_id: 'demo-user-id',
    created_at: new Date().toISOString(),
  },
]

type CreateTaskInput = {
  title: string
  description?: string
  priority: Priority
  due_date?: string
  status?: Status
}

interface TasksState {
  tasks: Task[]
  loading: boolean
  error: string | null
  createTask: (input: CreateTaskInput & { status: Status }) => Promise<void>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
}

export function useTasks(userId: string | undefined): TasksState {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return

    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem('kanban-tasks')
      if (stored) {
        try {
          setTasks(JSON.parse(stored))
        } catch {
          setTasks(SAMPLE_TASKS)
          localStorage.setItem('kanban-tasks', JSON.stringify(SAMPLE_TASKS))
        }
      } else {
        setTasks(SAMPLE_TASKS)
        localStorage.setItem('kanban-tasks', JSON.stringify(SAMPLE_TASKS))
      }
      setLoading(false)
      return
    }

    const fetchTasks = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError
        setTasks(data ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch tasks')
      } finally {
        setLoading(false)
      }
    }

    fetchTasks()
  }, [userId])

  const persistLocal = useCallback((updated: Task[]) => {
    if (!isSupabaseConfigured) {
      localStorage.setItem('kanban-tasks', JSON.stringify(updated))
    }
  }, [])

  const createTask = useCallback(async (input: CreateTaskInput & { status: Status }) => {
    if (!userId) return

    if (!isSupabaseConfigured) {
      const newTask: Task = {
        id: `local-${Date.now()}`,
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        due_date: input.due_date,
        user_id: userId,
        created_at: new Date().toISOString(),
      }
      setTasks(prev => {
        const updated = [newTask, ...prev]
        persistLocal(updated)
        return updated
      })
      return
    }

    try {
      const { data, error: insertError } = await supabase
        .from('tasks')
        .insert([{ ...input, user_id: userId }])
        .select()
        .single()

      if (insertError) throw insertError
      setTasks(prev => [data, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task')
    }
  }, [userId, persistLocal])

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    if (!isSupabaseConfigured) {
      setTasks(prev => {
        const updated = prev.map(t => t.id === id ? { ...t, ...updates } : t)
        persistLocal(updated)
        return updated
      })
      return
    }

    try {
      const { data, error: updateError } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError
      setTasks(prev => prev.map(t => t.id === id ? data : t))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task')
    }
  }, [persistLocal])

  const deleteTask = useCallback(async (id: string) => {
    if (!isSupabaseConfigured) {
      setTasks(prev => {
        const updated = prev.filter(t => t.id !== id)
        persistLocal(updated)
        return updated
      })
      return
    }

    try {
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      setTasks(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task')
    }
  }, [persistLocal])

  return { tasks, loading, error, createTask, updateTask, deleteTask }
}
