import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

function toISO(d){ return new Date(d).toISOString().slice(0,10) }
function addDays(date, d){ const nd = new Date(date); nd.setDate(nd.getDate()+d); return nd }

function MiniMonth({ year, month, occupied }){
  const first = new Date(year, month, 1)
  const startWeekday = (first.getDay()+6)%7
  const daysInMonth = new Date(year, month+1, 0).getDate()
  const cells = []
  for(let i=0;i<startWeekday;i++) cells.push(null)
  for(let d=1; d<=daysInMonth; d++) cells.push(new Date(year, month, d))
  const occ = useMemo(()=> new Set(occupied||[]), [occupied])
  return (
    <div className="text-xs">
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d,i)=>{
          if(!d) return <div key={i}></div>
          const iso = toISO(d)
          const isOcc = occ.has(iso)
          return (
            <div key={i} className={`h-6 rounded border text-center ${isOcc ? 'bg-red-200' : ''}`}>{d.getDate()}</div>
          )
        })}
      </div>
      <div className="text-[10px] text-gray-600 mt-1">Rojo ocupado</div>
    </div>
  )
}

export default function AdminOccupancy(){
  const { profile } = useAuth()
  const [rooms, setRooms] = useState([])
  const [byRoomOcc, setByRoomOcc] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cursor, setCursor] = useState(() => {
    const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1)
  })

  useEffect(()=>{
    async function loadRooms(){
      if(!profile?.hotel_id) return
      const { data, error } = await supabase
        .from('rooms')
        .select('id,name,capacity,status')
        .eq('hotel_id', profile.hotel_id)
        .order('id')
      if(error) setError(error.message)
      setRooms(data||[])
    }
    loadRooms()
  }, [profile?.hotel_id])

  useEffect(()=>{
    async function loadReservations(){
      if(!profile?.hotel_id) return
      setLoading(true); setError('')
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth()+1, 0)
      const { data, error } = await supabase
        .from('vw_reservations_with_room')
        .select('*')
        .eq('hotel_id', profile.hotel_id)
        .lte('check_in', toISO(monthEnd))
        .gte('check_out', toISO(monthStart))
      if(error) { setError(error.message); setLoading(false); return }
      const map = {}
      for(const r of data||[]){
        const rid = r.room_id ?? r.roomid ?? r.room
        if(!rid) continue
        if(!['confirmed','pending'].includes(r.status)) continue
        const dates = []
        try {
          let d = new Date(r.check_in)
          const end = new Date(r.check_out)
          while(d <= end){
            const iso = toISO(d)
            // Solo del mes mostrado
            const dt = new Date(iso)
            if (dt.getMonth() === cursor.getMonth() && dt.getFullYear() === cursor.getFullYear()) {
              dates.push(iso)
            }
            d = addDays(d,1)
          }
        } catch {}
        map[rid] = Array.from(new Set([...(map[rid]||[]), ...dates]))
      }
      setByRoomOcc(map)
      setLoading(false)
    }
    loadReservations()
  }, [profile?.hotel_id, cursor])

  const y = cursor.getFullYear()
  const m = cursor.getMonth()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-black">Ocupación</h2>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={()=>setCursor(new Date(y, m-1, 1))}>Mes anterior</button>
          <div className="text-sm text-gray-700">{cursor.toLocaleString('es-AR',{month:'long', year:'numeric'})}</div>
          <button className="btn-ghost" onClick={()=>setCursor(new Date(y, m+1, 1))}>Mes siguiente</button>
        </div>
      </div>
      {error && <div className="text-sm text-red-700">{error}</div>}
      {loading ? (
        <div>Cargando...</div>
      ) : rooms.length === 0 ? (
        <div className="text-sm text-gray-600">Sin habitaciones.</div>
      ) : (
        <ul className="grid md:grid-cols-2 gap-3">
          {rooms.map(r => (
            <li key={r.id} className="border rounded p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium text-black">{r.name} <span className="text-xs text-gray-500">#{r.id}</span></div>
                <div className="text-sm text-gray-600">Cap {r.capacity} · {r.status}</div>
              </div>
              <div className="mt-2">
                <MiniMonth year={y} month={m} occupied={byRoomOcc[r.id]||[]} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
