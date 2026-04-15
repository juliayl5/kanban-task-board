export type Priority = 'low' | 'normal' | 'high'
export type Status = 'todo' | 'in_progress' | 'in_review' | 'done'

export interface Task {
  id: string
  title: string
  description?: string
  status: Status
  priority: Priority
  due_date?: string
  user_id: string
  created_at: string
}

export interface Column {
  id: Status
  title: string
  color: string
}
