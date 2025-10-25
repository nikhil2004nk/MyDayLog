import { Routes, Route, Navigate } from 'react-router-dom'
import AuthPage from './pages/Auth'
import Dashboard from './pages/Dashboard'
import { useAuth } from './auth/AuthContext'

function App() {
  const { token, initializing } = useAuth();

  if (initializing) return null;

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
