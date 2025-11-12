import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true); setOk(''); setError('')
    try {
      const redirectTo = `${window.location.origin}/auth/reset`
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) throw error
      setOk('Te enviamos un email con el enlace para restablecer tu contraseña.')
    } catch (err) {
      setError(err.message || 'No se pudo enviar el email de recuperación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto card p-6">
      <h1 className="text-2xl font-semibold text-black mb-4">Recuperar contraseña</h1>
      {ok && <div className="text-green-700 text-sm mb-2">{ok}</div>}
      {error && <div className="text-red-700 text-sm mb-2">{error}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600">Email</label>
          <input type="email" className="w-full border rounded px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <button className="btn-primary" disabled={loading}>{loading? 'Enviando...' : 'Enviar enlace'}</button>
      </form>
      <p className="text-sm mt-3">¿Recordaste tu contraseña? <Link to="/auth/signin" className="underline">Ingresá</Link></p>
    </div>
  )
}
