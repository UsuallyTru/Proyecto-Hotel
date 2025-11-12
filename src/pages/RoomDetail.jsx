import { Link, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function RoomDetail() {
  const { id } = useParams()
  const [room, setRoom] = useState(null)
  const [photos, setPhotos] = useState([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [amenities, setAmenities] = useState([])
  const [checkIn, setCheckIn] = useState(() => new Date().toISOString().slice(0,10))
  const [checkOut, setCheckOut] = useState(() => new Date(Date.now()+86400000).toISOString().slice(0,10))
  const [guests, setGuests] = useState(2)
  const maxGuests = useMemo(() => room?.capacity ? Number(room.capacity) : 1, [room?.capacity])
  const nights = useMemo(() => {
    try {
      const a = new Date(checkIn); const b = new Date(checkOut)
      const d = Math.ceil((b-a)/(1000*60*60*24))
      return d>0?d:1
    } catch { return 1 }
  }, [checkIn, checkOut])

  // Keep dates coherent like in Landing/Rooms
  useEffect(() => {
    if (checkOut < checkIn) setCheckOut(checkIn)
  }, [checkIn])

  // Asegurar que huéspedes nunca exceda la capacidad al cambiar la habitación
  useEffect(() => {
    setGuests(prev => {
      const n = Number(prev) || 1
      return Math.min(Math.max(1, n), maxGuests)
    })
  }, [maxGuests])

  const isValid = (checkIn && checkOut && checkOut >= checkIn && (guests||0) >= 1)

  useEffect(() => {
    async function load() {
      setLoading(true); setError('')
      const { data, error } = await supabase
        .from('rooms')
        .select('id, name, description, capacity, base_price, status')
        .eq('id', id)
        .maybeSingle()
      if (error) setError(error.message)
      setRoom(data)

      const folder = `rooms/${id}`
      const { data: list } = await supabase.storage.from('room-photos').list(folder, { limit: 100, sortBy: { column: 'name', order: 'asc' } })
      const imgRe = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i
      let files = (list||[]).map(f => f.name).filter(n => imgRe.test(n))
      // Intentar leer index.json para respetar el orden elegido en Admin
      try {
        const hasIndex = (list || []).some(f => f.name === 'index.json')
        if (hasIndex) {
          const idxPath = `${folder}/index.json`
          const { data: idxFile } = await supabase.storage.from('room-photos').download(idxPath)
          if (idxFile) {
            const text = await idxFile.text()
            const order = JSON.parse(text) // ['foto1.jpg','foto2.jpg']
            const setOrder = new Set(order)
            const remaining = files.filter(n => !setOrder.has(n))
            files = [...order.filter(n => files.includes(n)), ...remaining]
          }
        }
      } catch {}
      const urls = files.map(name => supabase.storage.from('room-photos').getPublicUrl(`${folder}/${name}`).data.publicUrl)
      setPhotos(urls)
      // amenities.json opcional
      try {
        const hasAmenities = (list || []).some(f => f.name === 'amenities.json')
        if (hasAmenities) {
          const { data: amen } = await supabase.storage.from('room-photos').download(`${folder}/amenities.json`)
          if (amen) {
            const text = await amen.text()
            const arr = JSON.parse(text)
            if (Array.isArray(arr)) setAmenities(arr)
          }
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [id])

  return (
    <div className="space-y-4">
      <div className="card p-4 fade-in-up">
        <h1 className="text-2xl font-semibold text-black">{room ? room.name : `Habitación #${id}`}</h1>
        <p className="text-gray-600">{room?.description || 'Descripción de la habitación, servicios y fotos.'}</p>
        {photos.length > 0 ? (
          <div className="mt-4">
            <div className="relative">
              <img key={active} src={photos[active]} alt="Foto habitación" className="w-full h-72 object-cover rounded border smooth fade-in" />
              {photos.length > 1 && (
                <>
                  <button className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 text-white px-3 py-1 rounded" onClick={()=>setActive((active-1+photos.length)%photos.length)}>&lt;</button>
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 text-white px-3 py-1 rounded" onClick={()=>setActive((active+1)%photos.length)}>&gt;</button>
                  <div className="absolute inset-x-0 bottom-2 flex justify-center gap-2">
                    {photos.map((_, i) => (
                      <button key={i} onClick={()=>setActive(i)} className={`w-2 h-2 rounded-full ${i===active? 'bg-white' : 'bg-white/60'}`}></button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {photos.length > 1 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {photos.slice(0,3).map((src,i)=>(
                  <img key={i} src={src} alt="Thumb" className="w-full h-24 object-cover rounded border cursor-pointer smooth" loading="lazy" onClick={()=>setActive(i)} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-600 mt-4">Sin fotos cargadas aún.</div>
        )}
        {room && (
          <div className="grid sm:grid-cols-3 gap-4 mt-4 text-sm text-gray-700">
            <div className="border rounded p-3 hover-lift">
              <div className="text-black font-medium">Precio por noche</div>
              <div className="text-lg text-black">${room.base_price}</div>
            </div>
            <div className="border rounded p-3 hover-lift">
              <div className="text-black font-medium">Capacidad máxima</div>
              <div>{room.capacity} huéspedes</div>
            </div>
            <div className="border rounded p-3 hover-lift">
              <div className="text-black font-medium">Estado</div>
              <div>{room.status}</div>
            </div>
          </div>
        )}
        {room && (
          <div className="card p-3 mt-4">
            <div className="grid sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-sm text-gray-600">Check-in</label>
                <input type="date" value={checkIn} onChange={e=>setCheckIn(e.target.value)} className="w-full rounded px-3 py-2 bg-white text-black border-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Check-out</label>
                <input type="date" value={checkOut} min={checkIn} onChange={e=>setCheckOut(e.target.value)} className="w-full rounded px-3 py-2 bg-white text-black border-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Huéspedes</label>
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
                  className="w-full rounded px-3 py-2 bg-white text-black border-none"
                />
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Noches: {nights}</div>
                <div className="text-lg font-semibold text-black">Total aprox: ${room.base_price * nights}</div>
              </div>
            </div>
            <div className="mt-3">
              <Link to={`/checkout?roomId=${id}&checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`} className={`btn-primary ${!isValid ? 'pointer-events-none opacity-60' : ''}`}>Reservar ahora</Link>
            </div>
            {!isValid && <div className="text-xs text-red-700 mt-1">Verificá fechas y cantidad de huéspedes.</div>}
          </div>
        )}
        <div className="mt-4">
          <h3 className="text-lg font-semibold text-black mb-2">Beneficios y servicios</h3>
          <ul className="grid md:grid-cols-2 gap-2 text-sm text-gray-700">
            {(amenities.length>0 ? amenities : ['WiFi de alta velocidad','Vista a la ciudad','Aire acondicionado','TV 50"','Caja de seguridad','Mini bar']).map((a,i)=>(
              <li key={i} className="border rounded px-3 py-2">{a}</li>
            ))}
          </ul>
        </div>
        {error && <div className="text-sm text-red-700 mt-2">{error}</div>}
        {loading && <div className="text-sm mt-2">Cargando...</div>}
      </div>
      <div className="flex gap-3">
        <Link to="/rooms" className="border px-4 py-2 rounded">Volver</Link>
        <Link to="/checkout" className="btn-primary">Reservar</Link>
      </div>
    </div>
  )
}
