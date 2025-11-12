import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate, Link } from 'react-router-dom'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    // Validar que el nombre no esté vacío
    if (!fullName.trim()) {
      setError('El nombre completo es obligatorio')
      setLoading(false)
      return
    }
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Ingresá un email válido (ej: nombre@correo.com)')
      setLoading(false)
      return
    }

    try {
      // Primero creamos el usuario en la autenticación
      const { data, error: signUpError } = await supabase.auth.signUp({ 
        email, 
        password,
        options: { data: { full_name: fullName.trim() } }
      })
      
      if (signUpError) throw signUpError
      
      // Redirigir al dashboard o página principal (el perfil se autocreará al cargar la sesión)
      if (data.user) navigate('/')
    } catch (error) {
      console.error('Error en el registro:', error)
      setError(error.message || 'Ocurrió un error al crear la cuenta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto card p-6">
      <h1 className="text-2xl font-semibold text-black mb-4">Registrarse</h1>
      {error && <div className="text-red-700 text-sm mb-2">{error}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600">Nombre completo</label>
          <input 
            type="text" 
            className="w-full border rounded px-3 py-2" 
            value={fullName} 
            onChange={e => setFullName(e.target.value)} 
            placeholder="Ingresa tu nombre completo"
            required 
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Email</label>
          <input type="email" className="w-full border rounded px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Contraseña</label>
          <input type="password" className="w-full border rounded px-3 py-2" value={password} onChange={e=>setPassword(e.target.value)} required />
        </div>
        <button className="btn-primary" disabled={loading}>{loading? 'Creando...' : 'Crear cuenta'}</button>
      </form>
      <p className="text-sm mt-3">¿Ya tenés cuenta? <Link to="/auth/signin" className="underline">Ingresá</Link></p>
    </div>
  )
}
