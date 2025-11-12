import { useEffect, useMemo, useState } from 'react'
import { format, addDays } from 'date-fns'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Rooms() {
  const { profile } = useAuth()
  const [checkIn, setCheckIn] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [checkOut, setCheckOut] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'))
  const [guests, setGuests] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rooms, setRooms] = useState([])
  const [thumbs, setThumbs] = useState({})

  const datesValid = useMemo(() => new Date(checkOut) > new Date(checkIn), [checkIn, checkOut])

  // Keep dates coherent like Landing
  useEffect(() => {
    if (checkOut < checkIn) setCheckOut(checkIn)
  }, [checkIn])

  useEffect(() => {
    async function fetchAvailability() {
      setError(''); setLoading(true)
      try {
        const hotel_id = profile?.hotel_id || (await getHotelIdByName('Sheraton Salta'))
        if (!hotel_id) { setRooms([]); return }
        const safeGuests = Math.max(1, Number(guests) || 1)

        if (!datesValid) {
          const { data: allRooms, error: e1 } = await supabase
            .from('rooms')
            .select('id, name, capacity, base_price, status')
            .eq('hotel_id', hotel_id)
            .eq('status', 'open')
            .gte('capacity', safeGuests)
            .order('id')
          if (e1) throw e1
          setRooms(allRooms || [])
          return
        }

        const { data: available, error: eRpc } = await supabase.rpc('get_available_rooms', {
          p_hotel_id: hotel_id,
          p_check_in: checkIn,
          p_check_out: checkOut,
          p_guests: safeGuests
        })
        if (eRpc) throw eRpc
        setRooms(available || [])
      } catch (err) {
        setError(err.message)
        setRooms([])
      } finally {
        setLoading(false)
      }
    }
    fetchAvailability()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.hotel_id, checkIn, checkOut, guests])

  // Load thumbnails for each room from Storage (supports public or private buckets)
  useEffect(() => {
    async function loadThumbs(rs) {
      const IMG_RE = /\.(webp|jpe?g|png)$/i
      const entries = await Promise.all((rs || []).map(async (r) => {
        const folder = `rooms/${r.id}`
        try {
          // Discover filename
          let filename = ''
          // 1) Try order from index.json via SIGNED URL (works for private buckets)
          try {
            const { data: signedIdx } = await supabase.storage.from('room-photos').createSignedUrl(`${folder}/index.json`, 3600)
            if (signedIdx?.signedUrl) {
              const resp = await fetch(signedIdx.signedUrl, { cache: 'no-store' })
              if (resp.ok) {
                const order = await resp.json()
                const first = Array.isArray(order) ? order.find((n) => IMG_RE.test(n)) : null
                if (first) filename = first
              }
            }
          } catch {}

          // 2) If not found, list files and pick first image-like (requires policy access)
          if (!filename) {
            try {
              const { data: list } = await supabase.storage.from('room-photos').list(folder, { limit: 100, sortBy: { column: 'name', order: 'asc' } })
              const names = (list || []).map(f => f.name)
              const first = names.find(n => IMG_RE.test(n))
              if (first) filename = first
            } catch {}
          }

          if (filename) {
            const path = `${folder}/${filename}`
            // Prefer signed URL to work with private buckets
            try {
              const { data: signed, error } = await supabase.storage.from('room-photos').createSignedUrl(path, 3600)
              if (!error && signed?.signedUrl) return [r.id, signed.signedUrl]
            } catch {}
            // Fallback to public URL (for public buckets)
            const pub = supabase.storage.from('room-photos').getPublicUrl(path).data.publicUrl
            return [r.id, pub]
          }
          return [r.id, '']
        } catch {
          return [r.id, '']
        }
      }))
      setThumbs(Object.fromEntries(entries))
    }
    if (rooms.length) loadThumbs(rooms)
  }, [rooms])

  async function getHotelIdByName(name) {
    const { data } = await supabase.from('hotels').select('id').eq('name', name).limit(1).maybeSingle()
    return data?.id || null
  }

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <div className="grid sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-600">Check-in</label>
            <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className="w-full rounded px-3 py-2 bg-white text-black border-none" />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Check-out</label>
            <input type="date" value={checkOut} min={checkIn} onChange={e => setCheckOut(e.target.value)} className="w-full rounded px-3 py-2 bg-white text-black border-none" />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Huéspedes</label>
            <input
              type="number"
              min={1}
              value={guests}
              onChange={e => {
                const v = e.target.value
                if (v === '') { setGuests(''); return }
                const n = Number(v)
                if (Number.isNaN(n)) return
                setGuests(Math.max(1, n))
              }}
              onBlur={e => {
                const v = e.target.value
                const n = Number(v)
                setGuests(!v || Number.isNaN(n) || n < 1 ? 1 : n)
              }}
              className="w-full rounded px-3 py-2 bg-white text-black border-none"
            />
          </div>
        </div>
        {!datesValid && <div className="text-sm text-red-700 mt-2">La fecha de salida debe ser posterior al check-in.</div>}
      </div>

      {error && <div className="text-sm text-red-700">{error}</div>}
      {loading && <div>Cargando disponibilidad...</div>}

      <ul className="grid md:grid-cols-2 gap-4 fade-in-up">
        {rooms.map(r => (
          <li key={r.id} className="card p-0 overflow-hidden hover-lift">
            <div className="grid grid-cols-1 md:grid-cols-3">
              <div className="md:col-span-2">
                {thumbs[r.id] ? (
                  <img src={thumbs[r.id]} alt={r.name} className="ar-16x9 smooth" loading="lazy" />
                ) : (
                  <div className="ar-16x9" style={{background:'#e5e7eb'}}></div>
                )}
              </div>
              <div className="p-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-black">{r.name}</h3>
                  <p className="text-sm text-gray-600">Capacidad: {r.capacity}</p>
                </div>
                <div className="text-right">
                  <div className="text-black font-semibold">${r.base_price}/noche</div>
                  <Link to={`/rooms/${r.id}`} className="btn-primary mt-2 inline-block">Ver detalle</Link>
                </div>
              </div>
            </div>
          </li>
        ))}
        {!loading && rooms.length === 0 && (
          <li className="text-sm text-gray-600">No hay habitaciones disponibles para el rango seleccionado.</li>
        )}
      </ul>
    </div>
  )
}
