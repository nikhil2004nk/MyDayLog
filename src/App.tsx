import { Routes, Route, Navigate } from 'react-router-dom'
import AuthPage from './pages/Auth'
import Dashboard from './pages/Dashboard'
import { useAuth } from './auth/AuthContext'

function App() {
  const { token, initializing } = useAuth();

  if (initializing) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-gray-700 dark:text-gray-200">Loading...</div>
    </div>
  );

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={token ? '/dashboard' : '/auth'} replace />}
      />
      <Route
        path="/auth"
        element={token ? <Navigate to="/dashboard" replace /> : <AuthPage />}
      />
      <Route
        path="/dashboard"
        element={token ? <Dashboard /> : <Navigate to="/auth" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
