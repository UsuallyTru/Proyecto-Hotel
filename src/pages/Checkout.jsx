import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import CalendarRange from '../ui/CalendarRange'

const providers = [
  { id: 'mock', name: 'Pago Mock' },
]

export default function Checkout() {
  const { user, profile } = useAuth()
  const [provider, setProvider] = useState('mock')
  const [simulateResult, setSimulateResult] = useState('approved') // 'approved' | 'rejected'
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState(1)

  // Prefill from URL
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const urlCheckIn = params.get('checkIn')
  const urlCheckOut = params.get('checkOut')
  const urlGuests = params.get('guests')
  const urlRoomId = params.get('roomId')

  const [checkIn, setCheckIn] = useState(() => urlCheckIn || new Date().toISOString().slice(0,10))
  const [checkOut, setCheckOut] = useState(() => urlCheckOut || new Date(Date.now()+86400000).toISOString().slice(0,10))
  const [guests, setGuests] = useState(() => (urlGuests ? Number(urlGuests) : 1))
  const [rooms, setRooms] = useState([])
  const [roomId, setRoomId] = useState(urlRoomId || '')
  const [guestName, setGuestName] = useState(profile?.full_name || '')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestNotes, setGuestNotes] = useState('')
  const [occupiedDates, setOccupiedDates] = useState([])

  const nights = useMemo(() => {
    try {
      const a = new Date(checkIn)
      const b = new Date(checkOut)
      const d = Math.ceil((b-a)/(1000*60*60*24))
      return d > 0 ? d : 1
    } catch { return 1 }
  }, [checkIn, checkOut])

  // Habitación seleccionada y capacidad máxima para limitar huéspedes
  const selectedRoom = useMemo(() => rooms.find(r => String(r.id) === String(roomId)) || null, [rooms, roomId])
  const maxGuests = useMemo(() => selectedRoom?.capacity ? Number(selectedRoom.capacity) : 1, [selectedRoom])

  const stepValid = useMemo(() => {
    if (step === 1) {
      return (guestName && guestName.trim().length >= 2)
    }
    if (step === 2) {
      const validDates = Boolean(checkIn) && Boolean(checkOut) && new Date(checkOut) > new Date(checkIn)
      const validGuests = Number(guests) >= 1
      const validRoom = Boolean(roomId)
      return validDates && validGuests && validRoom
    }
    if (step === 3) {
      return Boolean(provider)
    }
    return true
  }, [step, guestName, checkIn, checkOut, guests, roomId, provider])

  useEffect(() => {
    async function loadRooms() {
      setError('')
      const hotel_id = profile?.hotel_id || (await getHotelIdByName('Sheraton Salta'))
      if (!hotel_id) return
      const safeGuests = Math.max(1, Number(guests) || 1)
      const { data, error } = await supabase
        .from('rooms')
        .select('id, name, base_price, capacity, status')
        .eq('hotel_id', hotel_id)
        .eq('status', 'open')
        .gte('capacity', safeGuests)
        .order('id')
      if (error) setError(error.message)
      setRooms(data || [])
      if (data && data.length) {
        if (roomId && !data.find(r => String(r.id) === String(roomId))) {
          // preseleccionada no disponible por capacidad/estado
          setError('La habitación preseleccionada no está disponible para los parámetros actuales. Seleccioná otra disponible.')
          setRoomId(String(data[0].id))
        } else if (!roomId) {
          setRoomId(String(data[0].id))
        }
      }
    }
    loadRooms()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.hotel_id, guests])

  // Al cambiar de habitación, asegurar que huéspedes no exceda capacidad
  useEffect(() => {
    if (!selectedRoom) return
    setGuests(prev => {
      const n = Number(prev) || 1
      return Math.min(Math.max(1, n), maxGuests)
    })
  }, [selectedRoom, maxGuests])

  // Cargar fechas ocupadas para la habitación seleccionada
  useEffect(() => {
    async function loadOccupied() {
      setOccupiedDates([])
      if (!roomId) return
      const { data, error } = await supabase
        .from('vw_reservations_with_room')
        .select('*')
        .eq('room_id', Number(roomId))
      if (error) return
      const days = []
      function addISO(iso, delta){
        const [y,m,d] = iso.split('-').map(Number)
        const dt = new Date(Date.UTC(y, m-1, d))
        dt.setUTCDate(dt.getUTCDate()+delta)
        const y2 = dt.getUTCFullYear()
        const m2 = String(dt.getUTCMonth()+1).padStart(2,'0')
        const d2 = String(dt.getUTCDate()).padStart(2,'0')
        return `${y2}-${m2}-${d2}`
      }
      for (const r of (data||[])) {
        // Bloquear tanto confirmadas como pendientes
        if (!['confirmed','pending','checked_in'].includes(r.status)) continue
        try {
          let cur = String(r.check_in).slice(0,10)
          const end = String(r.check_out).slice(0,10)
          while (true) {
            days.push(cur)
            if (cur === end) break
            cur = addISO(cur, 1)
          }
        } catch {}
      }
      setOccupiedDates(Array.from(new Set(days)))
    }
    loadOccupied()
  }, [roomId])

  async function getHotelIdByName(name) {
    const { data } = await supabase.from('hotels').select('id').eq('name', name).limit(1).maybeSingle()
    return data?.id || null
  }

  async function confirmCheckout() {
    try {
      setSubmitting(true); setError(''); setOk(''); setStatus(null)
      if (!user) throw new Error('Debes iniciar sesión')
      const hotel_id = profile?.hotel_id || (await getHotelIdByName('Sheraton Salta'))
      if (!hotel_id) throw new Error('Hotel no disponible')
      const selected = rooms.find(r => String(r.id) === String(roomId))
      if (!selected) throw new Error('Seleccioná una habitación disponible')
      const safeGuests = Math.max(1, Number(guests) || 1)

      // Crear reserva + pago atómicamente en la DB (revalida disponibilidad y calcula total por fecha)
      const { data: created, error: rpcErr } = await supabase.rpc('confirm_reservation', {
        p_hotel_id: hotel_id,
        p_client_id: user.id,
        p_room_id: selected.id,
        p_check_in: checkIn,
        p_check_out: checkOut,
        p_guests: safeGuests,
        p_provider: provider,
      })
      if (rpcErr) throw rpcErr
      const resvId = created?.[0]?.reservation_id
      const payId = created?.[0]?.payment_id
      const total = created?.[0]?.total_amount
      if (!resvId || !payId) throw new Error('No se pudo confirmar la reserva')
      const booking_code = `RESV-${new Date(checkIn).toISOString().slice(0,10).replace(/-/g,'')}-${resvId}`

      // 4) Simular resultado del proveedor
      await new Promise(r => setTimeout(r, 600))
      if (simulateResult === 'approved') {
        await supabase.from('payments').update({ status: 'approved' }).eq('id', payId)
        await supabase.from('reservations').update({ status: 'confirmed' }).eq('id', resvId)
        setStatus('approved')
        setOk(`Reserva confirmada (${booking_code}). Total $${total}`)
      } else {
        await supabase.from('payments').update({ status: 'rejected' }).eq('id', payId)
        // Podés dejarla pending o cancelarla; dejamos pending para permitir reintento
        setStatus('rejected')
        setOk(`Pago rechazado. La reserva #${resvId} sigue pendiente.`)
      }
      setStep(4)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card p-4 space-y-4">
      <h1 className="text-xl font-semibold text-black">Checkout</h1>

      {error && <div className="text-sm text-red-700">{error}</div>}
      {ok && <div className="text-sm text-green-700">{ok}</div>}

      <div className="flex items-center gap-2 text-sm">
        <div className={`px-2 py-1 rounded ${step>=1?'bg-black text-white':'bg-gray-200'}`}>1. Huésped</div>
        <div className="opacity-50">→</div>
        <div className={`px-2 py-1 rounded ${step>=2?'bg-black text-white':'bg-gray-200'}`}>2. Fechas y habitación</div>
        <div className="opacity-50">→</div>
        <div className={`px-2 py-1 rounded ${step>=3?'bg-black text-white':'bg-gray-200'}`}>3. Pago y revisión</div>
        <div className="opacity-50">→</div>
        <div className={`px-2 py-1 rounded ${step>=4?'bg-black text-white':'bg-gray-200'}`}>4. Resultado</div>
      </div>

      {step === 1 && (
        <div className="card p-3">
          <h3 className="font-semibold text-black mb-2">Datos del huésped</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Nombre y apellido</label>
              <input className="border rounded px-3 py-2 w-full" value={guestName} onChange={e=>setGuestName(e.target.value)} placeholder={profile?.full_name || 'Nombre del huésped'} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Teléfono</label>
              <input
                className="border rounded px-3 py-2 w-full"
                value={guestPhone}
                onChange={e=>{
                  const digits = (e.target.value || '').replace(/\D+/g,'')
                  setGuestPhone(digits)
                }}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Ej: 3874659876"
              />
            </div>
            <div className="md:col-span-1"></div>
            <div className="md:col-span-3">
              <label className="block text-sm text-gray-600 mb-1">Comentarios (opcional)</label>
              <textarea rows={3} className="border rounded px-3 py-2 w-full" value={guestNotes} onChange={e=>setGuestNotes(e.target.value)} placeholder="Horario estimado de llegada, preferencias, etc." />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-600 mb-2">Seleccioná fechas</label>
              <CalendarRange
                occupiedDates={occupiedDates}
                value={{ start: checkIn, end: checkOut }}
                onChange={(start,end)=>{ if(start) setCheckIn(start); if(end) setCheckOut(end) }}
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Huéspedes</label>
                <input
                  type="number"
                  min={1}
                  max={maxGuests}
                  value={guests}
                  onChange={e => {
                    const v = e.target.value
                    if (v === '') { setGuests(''); return }
                    const n = Number(v)
                    if (Number.isNaN(n)) return
                    setGuests(Math.min(Math.max(1, n), maxGuests))
                  }}
                  onBlur={e => {
                    const v = e.target.value
                    const n = Number(v)
                    if (!v || Number.isNaN(n) || n < 1) { setGuests(1); return }
                    setGuests(Math.min(n, maxGuests))
                  }}
                  className="border rounded px-3 py-2 w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Habitación disponible</label>
                <select value={roomId} onChange={e=>setRoomId(e.target.value)} className="border rounded px-3 py-2">
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.name} · cap {r.capacity} · ${r.base_price}</option>
                  ))}
                </select>
                {rooms.length === 0 && <div className="text-sm text-gray-600 mt-1">No hay habitaciones abiertas que cumplan la capacidad.</div>}
              </div>
            </div>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="card p-3">
            <h3 className="font-semibold text-black mb-2">Resumen</h3>
            <div className="text-sm text-gray-700 grid sm:grid-cols-2 gap-2">
              <div>Huésped: <span className="text-black">{guestName || profile?.full_name || user?.email}</span></div>
              <div>Teléfono: <span className="text-black">{guestPhone || '-'}</span></div>
              <div>Check-in: <span className="text-black">{checkIn}</span></div>
              <div>Check-out: <span className="text-black">{checkOut}</span></div>
              <div>Huéspedes: <span className="text-black">{guests}</span></div>
              <div>Noches: <span className="text-black">{nights}</span></div>
              {roomId && rooms.length>0 && (
                <>
                  <div>Habitación: <span className="text-black">{rooms.find(r=>String(r.id)===String(roomId))?.name} #{roomId}</span></div>
                  <div>Tarifa/noche: <span className="text-black">${rooms.find(r=>String(r.id)===String(roomId))?.base_price}</span></div>
                  <div className="sm:col-span-2">Total estimado: <span className="text-black font-semibold">${(Number(rooms.find(r=>String(r.id)===String(roomId))?.base_price)||0) * nights}</span></div>
                </>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Proveedor de pago</label>
              <select value={provider} onChange={e => setProvider(e.target.value)} className="border rounded px-3 py-2 w-full">
                {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Resultado simulado</label>
              <select value={simulateResult} onChange={e=>setSimulateResult(e.target.value)} className="border rounded px-3 py-2 w-full">
                <option value="approved">Aprobar</option>
                <option value="rejected">Rechazar</option>
              </select>
            </div>
          </div>
        </>
      )}

      {step === 4 && (
        <div className="text-sm">
          <div>Estado del pago: <span className="font-semibold">{status}</span></div>
          {ok && <div className="mt-2 text-green-700">{ok}</div>}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2">
        {step > 1 && step < 4 && (
          <button className="border px-3 py-2 rounded" onClick={() => setStep(step-1)} disabled={submitting}>Atrás</button>
        )}
        {step < 3 && (
          <button className="btn-primary" onClick={() => { if(stepValid) setStep(step+1) }} disabled={!stepValid || submitting}>Siguiente</button>
        )}
        {step === 3 && (
          <button className="btn-primary" onClick={confirmCheckout} disabled={submitting || !stepValid}>Confirmar y pagar</button>
        )}
        {step === 4 && (
          <button className="border px-3 py-2 rounded" onClick={() => setStep(1)}>Nueva reserva</button>
        )}
      </div>
    </div>
  )
}
