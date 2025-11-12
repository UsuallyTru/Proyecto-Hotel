import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Link, useNavigate } from 'react-router-dom'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true); setOk(''); setError('')
    try {
      if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres')
      if (password !== confirm) throw new Error('Las contraseñas no coinciden')
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setOk('Contraseña actualizada. Redirigiendo a Ingresar...')
      navigate('/auth/signin?reset=1')
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto card p-6">
      <h1 className="text-2xl font-semibold text-black mb-4">Restablecer contraseña</h1>
      {ok && <div className="text-green-700 text-sm mb-2">{ok}</div>}
      {error && <div className="text-red-700 text-sm mb-2">{error}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600">Nueva contraseña</label>
          <input type="password" className="w-full border rounded px-3 py-2" value={password} onChange={e=>setPassword(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Confirmar contraseña</label>
          <input type="password" className="w-full border rounded px-3 py-2" value={confirm} onChange={e=>setConfirm(e.target.value)} required />
        </div>
        <button className="btn-primary" disabled={loading}>{loading? 'Actualizando...' : 'Guardar'}</button>
      </form>
      <p className="text-sm mt-3">¿Recordaste tu contraseña? <Link to="/auth/signin" className="underline">Ingresá</Link></p>
    </div>
  )
}
