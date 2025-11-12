import KpiCard from '../../ui/KpiCard'
import LineChart from '../../ui/charts/LineChart'
import BarChart from '../../ui/charts/BarChart'
import DonutChart from '../../ui/charts/DonutChart'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function ManagerDashboard() {
  const { user, profile } = useAuth()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(false)
  // Mes seleccionado
  const [calCursor, setCalCursor] = useState(()=>{ const d=new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [kpiLoading, setKpiLoading] = useState(false)
  const [revenueSeries, setRevenueSeries] = useState([])
  const [occSeries, setOccSeries] = useState([])
  const [adrValue, setAdrValue] = useState('-')
  const [revparValue, setRevparValue] = useState('-')
  const [revenueTotal, setRevenueTotal] = useState('-')
  const currency = useMemo(()=> new Intl.NumberFormat('es-AR',{ style:'currency', currency:'ARS' }), [])
  const [roomStatusCounts, setRoomStatusCounts] = useState({ open:0, closed:0, maintenance:0, total:0 })
  const [revByRoom, setRevByRoom] = useState([])
  const [pFullName, setPFullName] = useState('')
  const [pEmail, setPEmail] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saveOk, setSaveOk] = useState('')
  const [saving, setSaving] = useState(false)

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
        .upsert({ user_id: user.id, full_name: pFullName, role: profile?.role || 'manager', hotel_id: profile?.hotel_id || null })
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

  async function loadStaff() {
    if (!profile?.hotel_id) return
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, role, hotel_id')
      .eq('hotel_id', profile.hotel_id)
    setStaff(data || [])
    setLoading(false)
  }

  useEffect(() => { loadStaff() }, [profile?.hotel_id])

  async function updateRole(user_id, role) {
    await supabase.from('profiles').update({ role }).eq('user_id', user_id)
    loadStaff()
  }

  async function loadKpis() {
    if (!profile?.hotel_id) return
    setKpiLoading(true)
    try {
      // Compute month range from calCursor
      const y = calCursor.getFullYear(); const m = calCursor.getMonth()
      const monthStart = new Date(y,m,1).toISOString().slice(0,10)
      const monthEnd = new Date(y,m+1,0).toISOString().slice(0,10)
      // Revenue by day
      const { data: rev } = await supabase
        .from('vw_kpi_revenue_by_day')
        .select('day,revenue,hotel_id')
        .eq('hotel_id', profile.hotel_id)
        .gte('day', monthStart)
        .lte('day', monthEnd)
        .order('day', { ascending: true })
      const revSeries = (rev||[]).map(r => ({ day: r.day, revenue: Number(r.revenue)||0 }))
      setRevenueSeries(revSeries)
      const revTotal = (revSeries||[]).reduce((a,b)=>a+(b.revenue||0),0)
      setRevenueTotal(currency.format(revTotal))

      // Occupancy by day
      const { data: occ } = await supabase
        .from('vw_kpi_occupancy')
        .select('day,rooms_occupied,hotel_id')
        .eq('hotel_id', profile.hotel_id)
        .gte('day', monthStart)
        .lte('day', monthEnd)
        .order('day', { ascending: true })
      const occArr = (occ||[]).map(o => ({ day: o.day, rooms_occupied: Number(o.rooms_occupied)||0 }))
      setOccSeries(occArr)

      // ADR and RevPAR (promedios en rango)
      const { data: adr } = await supabase
        .from('vw_kpi_adr')
        .select('day,adr,hotel_id')
        .eq('hotel_id', profile.hotel_id)
        .gte('day', monthStart)
        .lte('day', monthEnd)
      const adrAvg = Math.round(((adr||[]).reduce((a,b)=>a+(Number(b.adr)||0),0) / Math.max((adr||[]).length,1))||0)
      setAdrValue(currency.format(adrAvg))

      const { data: rp } = await supabase
        .from('vw_kpi_revpar')
        .select('day,revpar,hotel_id')
        .eq('hotel_id', profile.hotel_id)
        .gte('day', monthStart)
        .lte('day', monthEnd)
      const revparAvg = Math.round(((rp||[]).reduce((a,b)=>a+(Number(b.revpar)||0),0) / Math.max((rp||[]).length,1))||0)
      setRevparValue(currency.format(revparAvg))

      // Room status counts for donut
      const { data: rooms } = await supabase
        .from('rooms')
        .select('id,status,name')
        .eq('hotel_id', profile.hotel_id)
      const counts = { open:0, closed:0, maintenance:0, total: (rooms||[]).length }
      for(const r of (rooms||[])){ counts[r.status] = (counts[r.status]||0)+1 }
      setRoomStatusCounts(counts)

      // Revenue by room for selected month (payments approved)
      const { data: pays } = await supabase
        .from('payments')
        .select('reservation_id, amount, status, created_at')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd)
        .eq('status','approved')
      const resIds = Array.from(new Set((pays||[]).map(p=>p.reservation_id)))
      let roomMap = new Map()
      if (resIds.length) {
        const { data: resvRoom } = await supabase
          .from('vw_reservations_with_room')
          .select('reservation_id, room_id')
          .in('reservation_id', resIds)
          .eq('hotel_id', profile.hotel_id)
        for(const rr of (resvRoom||[])) roomMap.set(rr.reservation_id, rr.room_id)
      }
      const nameMap = new Map((rooms||[]).map(r => [r.id, r.name]))
      const agg = {}
      for(const p of (pays||[])){
        const rid = p.reservation_id
        const roomId = roomMap.get(rid)
        if(!roomId) continue
        agg[roomId] = (agg[roomId]||0) + Number(p.amount||0)
      }
      const byRoom = Object.entries(agg).map(([roomId, amount]) => ({ name: nameMap.get(Number(roomId)) || `Habitación #${roomId}`, value: amount }))
      byRoom.sort((a,b)=> b.value - a.value)
      setRevByRoom(byRoom)
    } finally {
      setKpiLoading(false)
    }
  }

  // Helpers for monthly calendar
  function monthDays(date){
    const y = date.getFullYear(); const m = date.getMonth()
    const first = new Date(y,m,1); const last = new Date(y,m+1,0)
    const days=[]; for(let d=1; d<=last.getDate(); d++) days.push(new Date(y,m,d))
    return { first, last, days }
  }

  function MonthGrid({ cursor, occSeries, totalRooms }){
    const { first, days } = monthDays(cursor)
    const startWeekday = (first.getDay()+6)%7 // lunes=0
    const cells = []
    for(let i=0;i<startWeekday;i++) cells.push(null)
    const map = new Map((occSeries||[]).map(o => [new Date(o.day).toISOString().slice(0,10), Number(o.rooms_occupied||0)]))
    function colorFor(v){
      if (!totalRooms || totalRooms<=0) return 'bg-gray-800'
      const pct = Math.min(1, v/totalRooms)
      if (pct===0) return 'bg-gray-900'
      if (pct<0.34) return 'bg-green-700'
      if (pct<0.67) return 'bg-yellow-600'
      return 'bg-red-600'
    }
    for(const d of days) cells.push(d)
    while(cells.length % 7 !== 0) cells.push(null)
    const labels = ['Lu','Ma','Mi','Ju','Vi','Sa','Do']
    return (
      <div>
        <div className="grid grid-cols-7 gap-1 text-xs text-graysoft/70 mb-1">
          {labels.map(l=> <div key={l} className="text-center">{l}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d,i)=>{
            if (!d) return <div key={i} className="h-10 border rounded bg-transparent" />
            const iso = d.toISOString().slice(0,10)
            const occ = map.get(iso)||0
            return (
              <div key={iso} className={`h-10 border rounded flex items-center justify-center ${colorFor(occ)}`} title={`${iso}: ${occ} ocupadas`}>
                <span className="text-white text-xs">{d.getDate()}</span>
              </div>
            )
          })}
        </div>
        <div className="flex gap-3 mt-2 text-xs text-graysoft/70">
          <div className="flex items-center gap-1"><span className="w-3 h-3 inline-block bg-gray-900 border rounded" /> 0%</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 inline-block bg-green-700 border rounded" /> Baja</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 inline-block bg-yellow-600 border rounded" /> Media</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 inline-block bg-red-600 border rounded" /> Alta</div>
        </div>
      </div>
    )
  }

  useEffect(() => { loadKpis() }, [profile?.hotel_id, calCursor])

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <h2 className="text-xl font-semibold text-graysoft mb-2">Mi perfil</h2>
        {saveError && <div className="text-sm text-red-700 mb-2">{saveError}</div>}
        {saveOk && <div className="text-sm text-green-700 mb-2">{saveOk}</div>}
        <form onSubmit={saveAccount} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600">Nombre completo</label>
            <input className="w-full border rounded px-3 py-2" value={pFullName} onChange={e=>setPFullName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Correo electrónico</label>
            <input type="email" className="w-full border rounded px-3 py-2" value={pEmail} onChange={e=>setPEmail(e.target.value)} required />
          </div>
          <button className="btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </form>
      </div>
      <div className="card p-4">
        <div className="flex items-end justify-between">
          <div className="flex gap-2 items-center">
            <button className="btn-ghost" onClick={()=>setCalCursor(prev=> new Date(prev.getFullYear(), prev.getMonth()-1, 1))}>Mes anterior</button>
            <div className="text-lg font-semibold">{calCursor.toLocaleString(undefined,{ month:'long', year:'numeric' })}</div>
            <button className="btn-ghost" onClick={()=>setCalCursor(prev=> new Date(prev.getFullYear(), prev.getMonth()+1, 1))}>Mes siguiente</button>
          </div>
          <div className="text-sm text-graysoft/70">{kpiLoading ? 'Actualizando KPIs...' : ''}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <KpiCard title="Ingresos" value={revenueTotal} subtitle="Suma en rango" />
        <KpiCard title="Ocupación" value={(function(){
          const days = occSeries.length
          const totalR = roomStatusCounts.total
          if (!days || !totalR) return '-'
          const sumOcc = occSeries.reduce((a,b)=>a+(b.rooms_occupied||0),0)
          const pct = Math.round((sumOcc / (days*totalR))*100)
          return `${pct}%`
        })()} subtitle="Promedio" />
        <KpiCard title="ADR" value={adrValue} subtitle="Promedio" />
        <KpiCard title="RevPAR" value={revparValue} subtitle="Promedio" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="font-semibold text-graysoft mb-2">Ingresos por día</h3>
          <LineChart data={revenueSeries} xKey="day" yKey="revenue" />
        </div>
        <div className="card p-4">
          <h3 className="font-semibold text-graysoft mb-2">Ocupación por día</h3>
          <BarChart data={occSeries} xKey="day" yKey="rooms_occupied" />
        </div>
      </div>
      <div className="card p-4">
        <h3 className="font-semibold text-graysoft mb-2">Ingresos por habitación (mes)</h3>
        <BarChart data={revByRoom} xKey="name" yKey="value" />
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-graysoft">Ocupación mensual</h3>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={()=>setCalCursor(prev=> new Date(prev.getFullYear(), prev.getMonth()-1, 1))}>Mes anterior</button>
            <div className="px-2 py-1 text-sm">{calCursor.toLocaleString(undefined,{ month:'long', year:'numeric' })}</div>
            <button className="btn-ghost" onClick={()=>setCalCursor(prev=> new Date(prev.getFullYear(), prev.getMonth()+1, 1))}>Mes siguiente</button>
          </div>
        </div>
        <MonthGrid cursor={calCursor} occSeries={occSeries} totalRooms={roomStatusCounts.total} />
      </div>
      <div className="card p-4">
        <h3 className="font-semibold text-graysoft mb-4">Gestión de roles del hotel</h3>
        {loading ? (
          <div>Cargando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-graysoft/70">
                <th className="py-2">Nombre</th>
                <th className="py-2">Usuario</th>
                <th className="py-2">Rol</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.user_id} className="border-t">
                  <td className="py-2">{s.full_name || '-'}</td>
                  <td className="py-2">{s.user_id}</td>
                  <td className="py-2">
                    <select
                      className="border rounded px-2 py-1"
                      value={s.role}
                      onChange={(e) => updateRole(s.user_id, e.target.value)}
                    >
                      <option value="client">Cliente</option>
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
