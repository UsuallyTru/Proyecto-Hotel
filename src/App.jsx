import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import Landing from './pages/Landing'
import Rooms from './pages/Rooms'
import RoomDetail from './pages/RoomDetail'
import Checkout from './pages/Checkout'
import Account from './pages/Account'
import AdminDashboard from './pages/admin/AdminDashboard'
import ManagerDashboard from './pages/manager/ManagerDashboard'
import SignIn from './pages/auth/SignIn'
import SignUp from './pages/auth/SignUp'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import React from 'react'

function Navbar() {
  const { user, profile } = useAuth()
  const location = useLocation()
  const isHome = location.pathname === '/'
  const [solid, setSolid] = React.useState(false)
  React.useEffect(() => {
    if (!isHome) { setSolid(true); return }
    const onScroll = () => {
      const y = window.scrollY || 0
      setSolid(y > 40)
    }
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [isHome])
  async function signOut() {
    const { supabase } = await import('./lib/supabase')
    await supabase.auth.signOut()
  }
  return (
    <header className={isHome && !solid ? 'navbar-transparent' : 'navbar-dark'}>
      <div className="w-full px-6 lg:px-8 flex items-center justify-between py-5">
        <Link to="/" className={`flex items-center gap-2 text-3xl font-brand ${isHome && !solid ? 'navbar-link-invert' : 'navbar-link'}`} aria-current={location.pathname==='/' ? 'page' : undefined}>
          <img src="/src/assets/logo-sheraton.svg" alt="Hotel Sheraton Salta" width={28} height={28} aria-hidden="true" />
          Hotel Sheraton Salta
        </Link>
        <nav className="flex gap-6 text-sm items-center">
          <Link to="/rooms" className={`${isHome && !solid ? 'navbar-link-invert' : 'navbar-link'} hover:opacity-80 link-underline ${location.pathname.startsWith('/rooms') ? 'underline underline-offset-4' : ''}`} aria-current={location.pathname.startsWith('/rooms') ? 'page' : undefined}>Habitaciones</Link>
          {profile?.role === 'client' && (
            <Link to="/account" className={`${isHome && !solid ? 'navbar-link-invert' : 'navbar-link'} hover:opacity-80 link-underline ${location.pathname==='/account' ? 'underline underline-offset-4' : ''}`} aria-current={location.pathname==='/account' ? 'page' : undefined}>Cuenta</Link>
          )}
          {profile?.role === 'admin' && (
            <Link to="/admin" className={`${isHome && !solid ? 'navbar-link-invert' : 'navbar-link'} hover:opacity-80 link-underline ${location.pathname.startsWith('/admin') ? 'underline underline-offset-4' : ''}`} aria-current={location.pathname.startsWith('/admin') ? 'page' : undefined}>Admin</Link>
          )}
          {profile?.role === 'manager' && (
            <Link to="/manager" className={`${isHome && !solid ? 'navbar-link-invert' : 'navbar-link'} hover:opacity-80 link-underline ${location.pathname.startsWith('/manager') ? 'underline underline-offset-4' : ''}`} aria-current={location.pathname.startsWith('/manager') ? 'page' : undefined}>Gerencia</Link>
          )}
          {!user && (
            <>
              <Link to="/auth/signin" className={`${isHome && !solid ? 'navbar-link-invert' : 'navbar-link'} hover:opacity-80 link-underline ${location.pathname==='/auth/signin' ? 'underline underline-offset-4' : ''}`} aria-current={location.pathname==='/auth/signin' ? 'page' : undefined}>Ingresar</Link>
              <Link to="/auth/signup" className={`${isHome && !solid ? 'navbar-link-invert' : 'navbar-link'} hover:opacity-80 link-underline ${location.pathname==='/auth/signup' ? 'underline underline-offset-4' : ''}`} aria-current={location.pathname==='/auth/signup' ? 'page' : undefined}>Crear cuenta</Link>
            </>
          )}
          {user && (
            <button onClick={signOut} className="navbar-link hover:opacity-80 underline-offset-4">Salir</button>
          )}
        </nav>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-800" style={{background:'var(--color-surface)'}}>
      <div className="container-page py-6">
        <div className="grid md:grid-cols-4 gap-4 text-sm mb-4">
          <a className="border rounded p-3 glass flex items-center gap-3 hover-lift" href="https://instagram.com/sheratonsalta" target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Ir al Instagram de Sheraton Salta">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2C4.24 2 2 4.24 2 7v10c0 2.76 2.24 5 5 5h10c2.76 0 5-2.24 5-5V7c0-2.76-2.24-5-5-5H7zm0 2h10c1.66 0 3 1.34 3 3v10c0 1.66-1.34 3-3 3H7c-1.66 0-3-1.34-3-3V7c0-1.66 1.34-3 3-3zm11 1.5a1 1 0 100 2 1 1 0 000-2zM12 7a5 5 0 100 10 5 5 0 000-10z"/></svg>
            <div>
              <div className="text-black font-medium">Instagram</div>
              <div className="text-gray-700">@sheratonsalta</div>
            </div>
          </a>
          <a className="border rounded p-3 glass flex items-center gap-3 hover-lift" href="tel:+543875551234" title="Teléfono" aria-label="Llamar al teléfono del hotel">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V21a1 1 0 01-1 1C10.07 22 2 13.93 2 3a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.2 2.2z"/></svg>
            <div>
              <div className="text-black font-medium">Teléfono</div>
              <div className="text-gray-700">+54 387 555-1234</div>
            </div>
          </a>
          <a className="border rounded p-3 glass flex items-center gap-3 hover-lift" href="mailto:contacto@sheratonsalta.com" title="Email" aria-label="Enviar email a Sheraton Salta">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 2v.01L12 13 4 6.01V6h16z"/></svg>
            <div>
              <div className="text-black font-medium">Email</div>
              <div className="text-gray-700">contacto@sheratonsalta.com</div>
            </div>
          </a>
          <a className="border rounded p-3 glass flex items-center gap-3 hover-lift" href="https://www.google.com/maps?q=Sheraton+Salta" target="_blank" rel="noopener noreferrer" title="Ubicación" aria-label="Abrir ubicación en Google Maps">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>
            <div>
              <div className="text-black font-medium">Ubicación</div>
              <div className="text-gray-700">Salta, Argentina</div>
            </div>
          </a>
        </div>
        <div className="text-sm text-gray-700">
          &copy; {new Date().getFullYear()} Sheraton Salta. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  )
}

function Main() {
  const location = useLocation()
  const isHomePath = location.pathname === '/'
  return (
    <>
      {!isHomePath && <div style={{height: '64px'}} />}
      <main className={isHomePath ? '' : 'container-page py-6'}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/rooms/:id" element={<RoomDetail />} />
          <Route
            path="/checkout"
            element={
              <ProtectedRoute roles={["client"]}>
                <Checkout />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute roles={["client"]}>
                <Account />
              </ProtectedRoute>
            }
          />
          <Route path="/auth/signin" element={<SignIn />} />
          <Route path="/auth/signup" element={<SignUp />} />
          <Route path="/auth/forgot" element={<ForgotPassword />} />
          <Route path="/auth/reset" element={<ResetPassword />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager"
            element={
              <ProtectedRoute roles={["manager"]}>
                <ManagerDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Main />
        <Footer />
      </BrowserRouter>
    </AuthProvider>
  )
}
