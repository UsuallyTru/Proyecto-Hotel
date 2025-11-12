import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate, Link } from 'react-router-dom'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const [info, setInfo] = useState('')

  useEffect(() => {
    const hasReset = new URLSearchParams(window.location.search).get('reset')
    if (hasReset) setInfo('Contraseña actualizada. Ingresá con tu nueva contraseña.')
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      setNotFound(/invalid login credentials/i.test(error.message))
      return
    }
    navigate('/')
  }

  return (
    <div className="max-w-md mx-auto card p-6">
      <h1 className="text-2xl font-semibold text-black mb-4">Ingresar</h1>
      {info && <div className="text-green-700 text-sm mb-2">{info}</div>}
      {error && <div className="text-red-700 text-sm mb-2">{error}</div>}
      {notFound && (
        <div className="text-sm text-gray-700 mb-2">
          ¿No tenés cuenta? <Link to="/auth/signup" className="underline">Registrate</Link>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600">Email</label>
          <input type="email" className="w-full border rounded px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Contraseña</label>
          <input type="password" className="w-full border rounded px-3 py-2" value={password} onChange={e=>setPassword(e.target.value)} required />
        </div>
        <button className="btn-primary" disabled={loading}>{loading? 'Ingresando...' : 'Ingresar'}</button>
      </form>
      <p className="text-sm mt-3">¿Olvidaste tu contraseña? <Link to="/auth/forgot" className="underline">Recuperar</Link></p>
      <p className="text-sm">¿No tenés cuenta? <Link to="/auth/signup" className="underline">Registrate</Link></p>
    </div>
  )
}
