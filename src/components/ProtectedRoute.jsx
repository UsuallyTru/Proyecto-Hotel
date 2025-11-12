import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, roles = [] }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <div>Loading...</div>
  if (!user) return <Navigate to="/auth/signin" replace />
  // Si se requieren roles, esperar a que el perfil esté cargado
  if (roles.length && !profile) return <div>Loading...</div>
  if (roles.length && !roles.includes(profile?.role)) return <Navigate to="/" replace />

  return children
}
