import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useTasks } from './hooks/useTasks'
import { KanbanBoard } from './components/KanbanBoard'
import { CreateTaskModal } from './components/CreateTaskModal'

function App() {
  const { user, loading: authLoading, error: authError } = useAuth()
  const { tasks, loading: tasksLoading, error: tasksError, createTask, updateTask, deleteTask } = useTasks(user?.id)
  const [showCreateModal, setShowCreateModal] = useState(false)

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center app-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Signing in...</p>
        </div>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center app-bg">
        <div className="text-center max-w-sm px-6">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-white font-semibold text-lg mb-2">Authentication Error</h2>
          <p className="text-gray-400 text-sm mb-5">{authError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col app-bg">
      {/* Header */}
      <header className="app-header px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-semibold text-base leading-none">Kanban</h1>
            <p className="text-gray-500 text-xs mt-0.5">Task Board</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {tasksError && (
            <span className="text-red-400 text-xs bg-red-400/10 px-3 py-1.5 rounded-lg border border-red-400/20">
              {tasksError}
            </span>
          )}

          {!tasksLoading && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
              <span className="bg-white/5 px-2.5 py-1 rounded-lg">{tasks.length} tasks</span>
            </div>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">New Task</span>
          </button>

          {user && (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center" title="Guest user">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 pt-2 overflow-x-auto">
        {tasksLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-gray-500 text-sm">Loading tasks...</p>
            </div>
          </div>
        ) : (
          <KanbanBoard
            tasks={tasks}
            onCreateTask={createTask}
            onUpdateTask={updateTask}
            onDeleteTask={deleteTask}
          />
        )}
      </main>

      {showCreateModal && (
        <CreateTaskModal
          defaultStatus="todo"
          onClose={() => setShowCreateModal(false)}
          onSubmit={createTask}
        />
      )}
    </div>
  )
}

export default App
