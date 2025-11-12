import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const HOTEL_POS = { lat: -24.78553448612288, lng: -65.3984571057463 } // Sheraton Salta (provisto)

const statusStyle = {
  open: { color: '#16a34a' },         // green-600
  closed: { color: '#6b7280' },       // gray-500
  maintenance: { color: '#ea580c' },  // orange-600
}

export default function AdminRoomMap() {
  const { profile } = useAuth()
  const [rooms, setRooms] = useState([])
  const [avoidOverlap, setAvoidOverlap] = useState(true)

  useEffect(() => {
    async function load() {
      if (!profile?.hotel_id) return
      const { data } = await supabase
        .from('rooms')
        .select('id, name, status')
        .eq('hotel_id', profile.hotel_id)
        .order('id', { ascending: true })
      setRooms(data || [])
    }
    load()
  }, [profile?.hotel_id])

  // Jitter simple para no superponer todos en el mismo punto
  const markers = useMemo(() => {
    return rooms.map((r, idx) => {
      const angle = (idx / Math.max(rooms.length, 1)) * Math.PI * 2
      // Si evitamos superposición, aplicamos un radio pequeño; si no, todos al centro
      const radius = avoidOverlap ? (0.00008 + (idx % 5) * 0.00003) : 0
      return {
        ...r,
        lat: HOTEL_POS.lat + Math.sin(angle) * radius,
        lng: HOTEL_POS.lng + Math.cos(angle) * radius,
      }
    })
  }, [rooms, avoidOverlap])

  return (
    <div className="grid md:grid-cols-3 gap-4 fade-in-up">
      <div className="md:col-span-2 h-[420px] rounded overflow-hidden border">
        <MapContainer center={[HOTEL_POS.lat, HOTEL_POS.lng]} zoom={17} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
          />
          {markers.map(m => (
            <CircleMarker key={m.id} center={[m.lat, m.lng]} radius={10} pathOptions={{ color: statusStyle[m.status]?.color || '#1f2937', weight: 3 }}>
              <Popup>
                <div className="text-sm">
                  <div className="font-medium">{m.name}</div>
                  <div>Estado: {m.status}</div>
                  <div>ID: {m.id}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <div className="space-y-3">
        <div>
          <h4 className="font-semibold text-black">Índice (colores)</h4>
          <ul className="text-sm text-gray-700 space-y-1 mt-2">
            <li className="flex items-center gap-2"><span style={{background:'#16a34a', width:10, height:10, borderRadius:999}}></span> Abierta</li>
            <li className="flex items-center gap-2"><span style={{background:'#6b7280', width:10, height:10, borderRadius:999}}></span> Cerrada</li>
            <li className="flex items-center gap-2"><span style={{background:'#ea580c', width:10, height:10, borderRadius:999}}></span> Mantenimiento</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-black">Habitaciones</h4>
          <ul className="text-sm text-gray-700 space-y-1 mt-2 max-h-72 overflow-auto">
            {rooms.map(r => (
              <li key={r.id} className="flex items-center gap-2">
                <span style={{background: statusStyle[r.status]?.color || '#1f2937', width:8, height:8, borderRadius:999}}></span>
                {r.name} <span className="text-xs text-gray-500">#{r.id}</span>
              </li>
            ))}
            {rooms.length === 0 && <li className="text-gray-500">Sin habitaciones</li>}
          </ul>
        </div>
        <div className="pt-2">
          <label className="text-sm text-gray-700 inline-flex items-center gap-2">
            <input type="checkbox" checked={avoidOverlap} onChange={e=>setAvoidOverlap(e.target.checked)} />
            Evitar superposición
          </label>
        </div>
      </div>
    </div>
  )
}
