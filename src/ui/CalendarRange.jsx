import { useEffect, useMemo, useState } from 'react'

function addDays(date, d){ const nd = new Date(date); nd.setDate(nd.getDate()+d); return nd }
function toISO(date){ return new Date(date).toISOString().slice(0,10) }
function daysBetween(a,b){ const res=[]; let d=new Date(a); while(d<=new Date(b)){ res.push(toISO(d)); d=addDays(d,1);} return res }

function MonthGrid({year, month, occupied=new Set(), start, end, onPick}){
  const first = new Date(year, month, 1)
  const startWeekday = (first.getDay()+6)%7 // Mon=0
  const daysInMonth = new Date(year, month+1, 0).getDate()
  const cells = []
  // leading blanks
  for(let i=0;i<startWeekday;i++) cells.push(null)
  for(let d=1; d<=daysInMonth; d++) cells.push(new Date(year, month, d))
  const selected = useMemo(()=> start && end ? new Set(daysBetween(start,end)) : new Set(), [start,end])

  return (
    <div className="border rounded p-2">
      <div className="grid grid-cols-7 text-xs text-gray-600 mb-1">
        {["Lu","Ma","Mi","Ju","Vi","Sa","Do"].map(x=> <div key={x} className="text-center py-1">{x}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d,i)=>{
          if(!d) return <div key={i}></div>
          const iso = toISO(d)
          const isOcc = occupied.has(iso)
          const isSel = selected.has(iso)
          return (
            <button
              key={i}
              type="button"
              onClick={()=>onPick(iso)}
              disabled={isOcc}
              className={`h-10 rounded border text-sm ${isOcc? 'bg-red-200 cursor-not-allowed' : isSel? '' : 'hover:bg-gray-100'} `}
              style={isSel ? { background: 'var(--color-champagne)', color: 'var(--color-ink)', fontWeight: 600 } : undefined}
            >{d.getDate()}</button>
          )
        })}
      </div>
    </div>
  )
}

export default function CalendarRange({ occupiedDates = [], value, onChange }){
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [start, setStart] = useState(value?.start || null)
  const [end, setEnd] = useState(value?.end || null)
  const occSet = useMemo(()=> new Set(occupiedDates), [occupiedDates])

  useEffect(()=>{ if(onChange) onChange(start, end) }, [start,end])

  function pick(dayISO){
    if (!start || (start && end)) { setStart(dayISO); setEnd(null); return }
    if (dayISO < start) { setStart(dayISO); setEnd(null); return }
    setEnd(dayISO)
  }

  const y = cursor.getFullYear(); const m = cursor.getMonth()

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button type="button" className="btn-ghost" onClick={()=>setCursor(new Date(y, m-1, 1))}>Mes anterior</button>
        <div className="text-sm text-gray-700">{cursor.toLocaleString('es-AR',{month:'long', year:'numeric'})}</div>
        <button type="button" className="btn-ghost" onClick={()=>setCursor(new Date(y, m+1, 1))}>Mes siguiente</button>
      </div>
      <MonthGrid year={y} month={m} occupied={occSet} start={start} end={end} onPick={pick} />
      <div className="text-xs text-gray-600">Ocupado = rojo · Seleccionado = champagne</div>
    </div>
  )
}
