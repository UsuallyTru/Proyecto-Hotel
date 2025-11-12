import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Account() {
  const { user, profile } = useAuth()
  const fmtCurrency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
  const [pFullName, setPFullName] = useState('')
  const [pEmail, setPEmail] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saveOk, setSaveOk] = useState('')
  const [saving, setSaving] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [inquiries, setInquiries] = useState([])
  const [loading, setLoading] = useState(false)
  const [myRes, setMyRes] = useState([])
  const [resLoading, setResLoading] = useState(false)
  const [resError, setResError] = useState('')
  const needsVerify = !!user && !user.email_confirmed_at
  async function resendVerification() {
    try {
      setOk(''); setError('')
      const email = user?.email
      if (!email) throw new Error('Usuario sin email')
      const { error } = await supabase.auth.resend({ type: 'signup', email })
      if (error) throw error
      setOk('Te reenviamos el email de verificación. Revisá tu bandeja de entrada y spam.')
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    setPFullName(profile?.full_name || '')
    setPEmail(user?.email || '')
  }, [profile?.full_name, user?.email])

  async function saveAccount(e) {
    e.preventDefault()
    setSaveError(''); setSaveOk(''); setSaving(true)
    try {
      if (!user) throw new Error('Debes iniciar sesión')
      const { error: upErr } = await supabase
        .from('profiles')
        .upsert({ user_id: user.id, full_name: pFullName, role: profile?.role || 'client', hotel_id: profile?.hotel_id || null })
      if (upErr) throw upErr
      const { error: authErr } = await supabase.auth.updateUser({ email: pEmail, data: { full_name: pFullName } })
      if (authErr) throw authErr
      setSaveOk('Datos guardados. Si cambiaste el correo, revisá tu email para confirmar el cambio.')
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function ensureHotelId() {
    if (profile?.hotel_id) return profile.hotel_id
    const { data } = await supabase.from('hotels').select('id').eq('name','Sheraton Salta').limit(1).maybeSingle()
    return data?.id || null
  }

  async function loadMyInquiries() {
    if (!user) return
    // Intentar traer response; si la columna no existe, caer sin response
    let { data, error } = await supabase
      .from('inquiries')
      .select('id, subject, message, response, answered, created_at')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
    if (error) {
      const res2 = await supabase
        .from('inquiries')
        .select('id, subject, message, answered, created_at')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false })
      data = res2.data
    }
    setInquiries(data || [])
  }

  async function deleteInquiry(id) {
    if (!user || !id) return
    const ok = window.confirm('¿Eliminar esta consulta? Esta acción no se puede deshacer.')
    if (!ok) return
    await supabase.from('inquiries').delete().eq('id', id).eq('client_id', user.id)
    await loadMyInquiries()
  }

  useEffect(() => { loadMyInquiries() }, [user?.id])

  async function loadMyReservations() {
    if (!user) return
    setResLoading(true); setResError('')
    try {
      // 1) Reservas del usuario (una fila por habitación)
      const { data: resv, error: e1 } = await supabase
        .from('vw_reservations_with_room')
        .select('reservation_id, room_id, status, check_in, check_out, guests, total_amount, created_at')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false })
      if (e1) throw e1
      const items = (resv || []).map(r => ({
        id: r.reservation_id,
        room_id: r.room_id,
        status: r.status,
        check_in: r.check_in,
        check_out: r.check_out,
        guests: r.guests,
        total_amount: r.total_amount,
        created_at: r.created_at,
      }))
      if (items.length === 0) { setMyRes([]); return }
      // 2) Nombres de habitaciones
      const roomIdsRaw = Array.from(new Set(items.map(r => r.room_id).filter(Boolean)))
      const roomIdsNum = roomIdsRaw.map(v => Number(v)).filter(v => !Number.isNaN(v))
      let roomMap = {}
      if (roomIdsNum.length) {
        const { data: rooms } = await supabase
          .from('rooms')
          .select('id,name')
          .in('id', roomIdsNum)
        roomMap = Object.fromEntries((rooms||[]).map(r => [String(r.id), r.name]))
      }
      // 3) Último estado de pago por reserva
      const resIds = Array.from(new Set(items.map(r => r.id)))
      const { data: pays } = await supabase
        .from('payments')
        .select('id,reservation_id,status,amount,created_at')
        .in('reservation_id', resIds)
      const payMap = {}
      for (const p of (pays||[])) {
        const prev = payMap[p.reservation_id]
        if (!prev || new Date(p.created_at) > new Date(prev.created_at)) payMap[p.reservation_id] = p
      }
      setMyRes(items.map(r => ({
        ...r,
        room_name: roomMap[String(r.room_id)] || (r.room_id ? `Habitación #${r.room_id}` : 'Habitación N/D'),
        payment_status: payMap[r.id]?.status || 'pending',
        payment_amount: payMap[r.id]?.amount || r.total_amount,
      })))
    } catch (err) {
      setResError(err?.message || 'No se pudieron cargar tus reservas')
      setMyRes([])
    } finally { setResLoading(false) }
  }

  useEffect(() => { loadMyReservations() }, [user?.id])

  async function submitInquiry(e) {
    e.preventDefault()
    setError(''); setOk(''); setLoading(true)
    try {
      if (!user) throw new Error('Debes iniciar sesión')
      const hotel_id = await ensureHotelId()
      if (!hotel_id) throw new Error('No se encontró hotel asociado')
      const { error } = await supabase.from('inquiries').insert({
        hotel_id,
        client_id: user.id,
        subject,
        message,
      })
      if (error) throw error
      setOk('Consulta enviada')
      setSubject(''); setMessage('')
      loadMyInquiries()
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      {needsVerify && (
        <div className="card p-4">
          <div className="text-sm text-graysoft">
            Confirmá tu correo para activar tu cuenta. Te enviamos un email de verificación.
            <button className="btn-ghost ml-2" onClick={resendVerification}>Reenviar</button>
          </div>
        </div>
      )}

      <div className="card p-4">
        <h2 className="text-xl font-semibold text-white mb-2">Mi perfil</h2>
        {saveError && <div className="text-sm text-red-700 mb-2">{saveError}</div>}
        {saveOk && <div className="text-sm text-green-700 mb-2">{saveOk}</div>}
        <form onSubmit={saveAccount} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-200">Nombre completo</label>
            <input className="w-full border rounded px-3 py-2 text-white placeholder-gray-300" value={pFullName} onChange={e=>setPFullName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm text-gray-200">Correo electrónico</label>
            <input type="email" className="w-full border rounded px-3 py-2 text-white placeholder-gray-300" value={pEmail} onChange={e=>setPEmail(e.target.value)} required />
          </div>
          <button className="btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </form>
      </div>

      <div className="card p-4">
        <h1 className="text-2xl font-semibold text-white">Mi cuenta</h1>
        <p className="text-gray-300">Historial de reservas y pagos.</p>
      </div>

      <div className="card p-4">
        <h2 className="text-xl font-semibold text-white mb-2">Mis reservas</h2>
        {resError && <div className="text-sm text-red-700 mb-2">{resError}</div>}
        {resLoading ? (
          <div className="text-sm">Cargando...</div>
        ) : myRes.length === 0 ? (
          <div className="text-sm text-gray-300">No tenés reservas todavía.</div>
        ) : (
          <ul className="space-y-2">
            {myRes.map(r => (
              <li key={r.id} className="border rounded p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">Reserva #{r.id} · {r.room_name}</div>
                  <div className="text-sm text-gray-300">{r.check_in} → {r.check_out} · Huéspedes {r.guests} · {fmtCurrency.format(Number(r.total_amount) || Number(r.payment_amount) || 0)}</div>
                  <div className="text-xs text-gray-400">Creada {new Date(r.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-white">Estado: {r.status}</div>
                  <div className="text-xs text-gray-300">Pago: {r.payment_status}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-4">
        <h2 className="text-xl font-semibold text-white mb-2">Enviar consulta</h2>
        {error && <div className="text-sm text-red-700 mb-2">{error}</div>}
        {ok && <div className="text-sm text-green-700 mb-2">{ok}</div>}
        <form onSubmit={submitInquiry} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-200">Asunto</label>
            <input className="w-full border rounded px-3 py-2 text-white placeholder-gray-300" value={subject} onChange={e=>setSubject(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm text-gray-200">Mensaje</label>
            <textarea className="w-full border rounded px-3 py-2 text-white placeholder-gray-300" rows={4} value={message} onChange={e=>setMessage(e.target.value)} required />
          </div>
          <button className="btn-primary" disabled={loading}>{loading ? 'Enviando...' : 'Enviar'}</button>
        </form>
      </div>

      <div className="card p-4">
        <h2 className="text-xl font-semibold text-white mb-2">Mis consultas</h2>
        {inquiries.length === 0 ? (
          <div className="text-sm text-gray-300">No hay consultas.</div>
        ) : (
          <ul className="space-y-2">
            {inquiries.map(q => (
              <li key={q.id} className="border rounded p-3">
                <div className="font-medium text-white">{q.subject}</div>
                <div className="text-sm text-gray-200 whitespace-pre-wrap">{q.message}</div>
                <div className="text-xs text-gray-400 mt-1">{new Date(q.created_at).toLocaleString()} · {q.answered ? 'Respondida' : 'Pendiente'}</div>
                {q.response && (
                  <div className="mt-2 border rounded p-2 bg-black/20">
                    <div className="text-xs text-gray-400 mb-1">Respuesta del hotel</div>
                    <div className="text-sm text-gray-200 whitespace-pre-wrap">{q.response}</div>
                  </div>
                )}
                <div className="mt-2 flex justify-end">
                  <button className="px-3 py-1 text-sm border rounded hover:bg-red-600/10" onClick={()=>deleteInquiry(q.id)}>Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
