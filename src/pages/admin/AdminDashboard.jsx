import DropzoneUploader from '../../ui/DropzoneUploader'
import { useAuth } from '../../context/AuthContext'
import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import RoomsCrud from './RoomsCrud'
import AdminPhotos from './AdminPhotos'
import AdminReservations from './AdminReservations'
import AdminPayments from './AdminPayments'
import AdminRoomMap from './AdminRoomMap'
import AdminOccupancy from './AdminOccupancy'

export default function AdminDashboard() {
  const { user, profile } = useAuth()
  const [pFullName, setPFullName] = useState('')
  const [pEmail, setPEmail] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saveOk, setSaveOk] = useState('')
  const [saving, setSaving] = useState(false)
  const [inquiries, setInquiries] = useState([])
  const [loadingQ, setLoadingQ] = useState(false)
  const [errorQ, setErrorQ] = useState('')
  const [replyMap, setReplyMap] = useState({})
  // KPIs
  const [kpiFrom, setKpiFrom] = useState(()=>{
    const d = new Date(); d.setDate(d.getDate()-30); return d.toISOString().slice(0,10)
  })
  const [kpiTo, setKpiTo] = useState(()=> new Date().toISOString().slice(0,10))
  const [kpi, setKpi] = useState({ revenue: 0, occPct: null, adr: null, revpar: null, byDay: [], occByDay: [], roomStatus: {open:0,closed:0,maintenance:0,total:0} })
  const currency = new Intl.NumberFormat('es-AR',{ style:'currency', currency:'ARS' })
  const [calCursor, setCalCursor] = useState(()=>{ const d=new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })

  // Simple SVG charts (no deps)
  function BarChart({ data, xKey, yKey, height=160, color='#4ade80', formatY=(v)=>v }){
    const width = 300
    const pad = 24
    const maxY = Math.max(1, ...data.map(d=>Number(d[yKey]||0)))
    const barW = Math.max(4, (width - pad*2) / Math.max(1, data.length))
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40">
        <line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} stroke="#444" />
        {data.map((d,i)=>{
          const v = Number(d[yKey]||0)
          const h = (v/maxY) * (height - pad*2)
          const x = pad + i*barW
          const y = height - pad - h
          return <rect key={i} x={x+1} y={y} width={barW-2} height={h} fill={color} />
        })}
      </svg>
    )
  }

  function Donut({ open=0, closed=0, maintenance=0, size=160 }){
    const total = open+closed+maintenance
    const r = size/2 - 12
    const cx = size/2, cy = size/2
    const circ = 2*Math.PI*r
    const seg = [
      { v: open, color: '#22c55e' },
      { v: closed, color: '#ef4444' },
      { v: maintenance, color: '#f59e0b' },
    ]
    let offset = 0
    return (
      <svg width={size} height={size} className="mx-auto">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1f2937" strokeWidth={12} />
        {seg.map((s,i)=>{
          const len = total? (s.v/total)*circ : 0
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={12}
              strokeDasharray={`${len} ${circ-len}`} strokeDashoffset={-offset} />
          )
          offset += len
          return el
        })}
      </svg>
    )
  }

  function monthDays(date){
    const y = date.getFullYear(); const m = date.getMonth()
    const first = new Date(y,m,1); const last = new Date(y,m+1,0)
    const days=[]; for(let d=1; d<=last.getDate(); d++) days.push(new Date(y,m,d))
    return { first, last, days }
  }

  function CalendarMonth({ cursor, totalRooms, occByDay }){
    const { first, last, days } = monthDays(cursor)
    const startWeekday = (first.getDay()+6)%7 // lunes 0
    const cells = []
    for(let i=0;i<startWeekday;i++) cells.push(null)
    const map = new Map((occByDay||[]).map(o => [new Date(o.day).toISOString().slice(0,10), Number(o.rooms_occupied||0)]))
    const maxOcc = Math.max(1, ...Array.from(map.values()))
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
        <div className="grid grid-cols-7 gap-1 text-xs text-gray-400 mb-1">
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
        <div className="flex gap-3 mt-2 text-xs text-gray-500">
          <div className="flex items-center gap-1"><span className="w-3 h-3 inline-block bg-gray-900 border rounded" /> 0%</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 inline-block bg-green-700 border rounded" /> Baja</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 inline-block bg-yellow-600 border rounded" /> Media</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 inline-block bg-red-600 border rounded" /> Alta</div>
        </div>
      </div>
    )
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
        .upsert({ user_id: user.id, full_name: pFullName, role: profile?.role || 'admin', hotel_id: profile?.hotel_id || null })
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

  async function deleteInquiry(id){
    const ok = window.confirm('¿Eliminar esta consulta?')
    if(!ok) return
    await supabase.from('inquiries').delete().eq('id', id)
    await loadInquiries()
  }

  async function loadInquiries() {
    if (!profile?.hotel_id) return
    setLoadingQ(true); setErrorQ('')
    const { data, error } = await supabase
      .from('inquiries')
      .select('id, subject, message, response, answered, created_at, client_id')
      .eq('hotel_id', profile.hotel_id)
      .order('created_at', { ascending: false })
    if (error) setErrorQ(error.message)
    setInquiries(data || [])
    setLoadingQ(false)
  }

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error, info) { /* noop */ }
  render() {
    if (this.state.hasError) {
      return (<div className="border rounded p-4 text-sm text-red-700">{this.props.fallback || 'Sección no disponible.'}</div>)
    }
    return this.props.children
  }
}

  useEffect(() => { loadInquiries() }, [profile?.hotel_id])

  // Load KPIs from views
  useEffect(() => {
    async function loadKpis(){
      if(!profile?.hotel_id) return
      const hid = profile.hotel_id
      const from = kpiFrom
      const to = kpiTo
      // revenue by day
      const { data: rev } = await supabase
        .from('vw_kpi_revenue_by_day')
        .select('day,revenue')
        .eq('hotel_id', hid)
        .gte('day', from)
        .lte('day', to)
      const revenue = (rev||[]).reduce((s,x)=> s + Number(x.revenue||0), 0)
      // occupancy by day (rooms occupied count)
      const { data: occ } = await supabase
        .from('vw_kpi_occupancy')
        .select('day,rooms_occupied')
        .eq('hotel_id', hid)
        .gte('day', from)
        .lte('day', to)
      // room counts
      const { data: rooms } = await supabase
        .from('rooms').select('id,status').eq('hotel_id', hid)
      const totalRooms = (rooms||[]).length || 0
      const occAvg = (occ&&occ.length && totalRooms) ? (occ.reduce((s,x)=> s + Number(x.rooms_occupied||0), 0) / (occ.length * totalRooms)) : null
      // ADR & RevPAR
      const { data: adrRows } = await supabase
        .from('vw_kpi_adr')
        .select('day,adr')
        .eq('hotel_id', hid)
        .gte('day', from)
        .lte('day', to)
      const adr = (adrRows&&adrRows.length) ? adrRows.reduce((s,x)=> s + Number(x.adr||0),0)/adrRows.length : null
      const { data: revparRows } = await supabase
        .from('vw_kpi_revpar')
        .select('day,revpar')
        .eq('hotel_id', hid)
        .gte('day', from)
        .lte('day', to)
      const revpar = (revparRows&&revparRows.length) ? revparRows.reduce((s,x)=> s + Number(x.revpar||0),0)/revparRows.length : null
      // room status pie data
      const statusCounts = { open:0, closed:0, maintenance:0, total: totalRooms }
      for(const r of (rooms||[])) { statusCounts[r.status] = (statusCounts[r.status]||0)+1 }
      setKpi({
        revenue,
        occPct: occAvg !== null ? Math.round(occAvg*100) : null,
        adr, revpar,
        byDay: rev||[],
        occByDay: occ||[],
        roomStatus: statusCounts,
      })
    }
    loadKpis()
  }, [profile?.hotel_id, kpiFrom, kpiTo])

  async function markAnswered(id, answered) {
    await supabase.from('inquiries').update({ answered }).eq('id', id)
    loadInquiries()
  }

  async function sendReply(id) {
    const text = (replyMap[id] || '').trim()
    setErrorQ('')
    try {
      if (!text) {
        // Si no hay texto, solo marcar respondida
        await supabase.from('inquiries').update({ answered: true }).eq('id', id)
        await loadInquiries();
        return
      }
      // Intentar guardar en columna 'response' + answered
      const { error } = await supabase.from('inquiries').update({ response: text, answered: true }).eq('id', id)
      if (error) {
        // Fallback: si la columna no existe, al menos marcar respondida
        await supabase.from('inquiries').update({ answered: true }).eq('id', id)
      }
      setReplyMap(prev => ({ ...prev, [id]: '' }))
      await loadInquiries()
    } catch (e) {
      setErrorQ(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-4">
        <h2 className="text-xl font-semibold text-black mb-2">Mi perfil</h2>
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
      </section>
      <section className="card p-4">
        <h2 className="text-xl font-semibold text-black mb-2">Mapa de estado de habitaciones</h2>
        <AdminRoomMap />
      </section>
      <section className="card p-4">
        <h2 className="text-xl font-semibold text-black mb-2">Ocupación por habitación (mini calendario)</h2>
        <AdminOccupancy />
      </section>
      <section className="card p-4">
        <h2 className="text-xl font-semibold text-black mb-2">Habitaciones (CRUD)</h2>
        <p className="text-gray-600 mb-3">Crear/editar habitaciones y subir fotos (drag & drop a Supabase Storage).</p>
        <DropzoneUploader bucket="room-photos" folderPrefix="rooms/demo" />
        <div className="mt-6">
          <RoomsCrud />
        </div>
      </section>
      <section className="card p-4">
        <h2 className="text-xl font-semibold text-black mb-2">Fotos del hotel y habitaciones</h2>
        <p className="text-gray-600 mb-3">Elegí qué fotos van al carrusel del hotel y a cada habitación. Podés subir o eliminar archivos.</p>
        <AdminPhotos />
      </section>
      <section className="card p-4">
        <h2 className="text-xl font-semibold text-black mb-2">Reservas</h2>
        <AdminReservations />
      </section>
      <section className="card p-4">
        <h2 className="text-xl font-semibold text-black mb-2">Pagos</h2>
        <AdminPayments />
      </section>
      <section className="card p-4">
        <h2 className="text-xl font-semibold text-black mb-4">Consultas</h2>
        {errorQ && <div className="text-red-700 text-sm mb-2">{errorQ}</div>}
        {loadingQ ? (
          <div>Cargando...</div>
        ) : inquiries.length === 0 ? (
          <div className="text-sm text-gray-600">No hay consultas.</div>
        ) : (
          <ul className="space-y-2">
            {inquiries.map(q => (
              <li key={q.id} className="border rounded p-3">
                <div className="font-medium text-black">{q.subject}</div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{q.message}</div>
                <div className="text-sm text-gray-500 mt-1">{new Date(q.created_at).toLocaleString()} · {q.answered ? 'Respondida' : 'Pendiente'}</div>
                <div className="mt-2 flex flex-col gap-2">
                  {(!!!q.response) && (
                    <>
                      <textarea
                        rows={2}
                        className="border rounded px-3 py-2"
                        placeholder="Escribir respuesta..."
                        value={replyMap[q.id] || ''}
                        onChange={e=>setReplyMap(prev=>({ ...prev, [q.id]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <button className="btn-primary" onClick={()=>sendReply(q.id)}>Responder</button>
                        {!q.answered && (
                          <button className="btn-ghost" onClick={()=>markAnswered(q.id, true)}>Marcar respondida</button>
                        )}
                      </div>
                    </>
                  )}
                  {q.response && (
                    <div className="border rounded p-2 bg-black/10">
                      <div className="text-xs text-gray-500 mb-1">Respuesta enviada</div>
                      <div className="text-sm whitespace-pre-wrap">{q.response}</div>
                    </div>
                  )}
                  {q.answered && (
                    <div className="flex gap-2">
                      <button className="btn-ghost" onClick={()=>markAnswered(q.id, false)}>Marcar pendiente</button>
                      <button className="btn-ghost text-red-700" onClick={()=>deleteInquiry(q.id)}>Eliminar</button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
