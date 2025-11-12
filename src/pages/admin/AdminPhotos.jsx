import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import DropzoneUploader from '../../ui/DropzoneUploader'

const BUCKET = 'room-photos'

export default function AdminPhotos() {
  const { profile } = useAuth()
  const [rooms, setRooms] = useState([])
  const [active, setActive] = useState('hotel')
  const [items, setItems] = useState([])
  const [dragIndex, setDragIndex] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [amenitiesText, setAmenitiesText] = useState('')

  useEffect(() => {
    async function loadRooms() {
      if (!profile?.hotel_id) return
      const { data } = await supabase
        .from('rooms')
        .select('id, name')
        .eq('hotel_id', profile.hotel_id)
        .order('id', { ascending: true })
      setRooms(data || [])
    }
    loadRooms()
  }, [profile?.hotel_id])

  // Amenities load/save only for room folders (excluir hero/hotel/about)
  const isRoom = active !== 'hero' && active !== 'hotel' && active !== 'about'
  useEffect(() => { if (isRoom) loadAmenities() }, [active])

  async function loadAmenities() {
    try {
      // Try via public URL to avoid RLS issues on download
      const pub = supabase.storage.from(BUCKET).getPublicUrl(`${folderPrefix}/amenities.json`).data.publicUrl
      const res = await fetch(pub, { cache: 'no-store' })
      if (res.ok) {
        const arr = await res.json()
        setAmenitiesText(Array.isArray(arr) ? arr.join('\n') : '')
      } else { setAmenitiesText('') }
    } catch { setAmenitiesText('') }
  }

  async function saveAmenities() {
    setLoading(true); setError('')
    try {
      const arr = amenitiesText.split('\n').map(s=>s.trim()).filter(Boolean)
      const blob = new Blob([JSON.stringify(arr)], { type: 'application/json' })
      const { error } = await supabase.storage.from(BUCKET).upload(`${folderPrefix}/amenities.json`, blob, { upsert: true, contentType: 'application/json' })
      if (error) throw error
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  async function saveOrder() {
    setLoading(true); setError('')
    try {
      const order = items
        .map(it => it.name)
        .filter(name => /\.(webp|jpe?g|png)$/i.test(name))
      const blob = new Blob([JSON.stringify(order)], { type: 'application/json' })
      const { error } = await supabase.storage.from(BUCKET).upload(`${folderPrefix}/index.json`, blob, { upsert: true, contentType: 'application/json' })
      if (error) throw error
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  function onDragStart(e, index) { setDragIndex(index) }
  function onDragOver(e) { e.preventDefault() }
  function onDrop(e, index) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    setItems(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(index, 0, moved)
      return next
    })
    setDragIndex(null)
  }

  const folderPrefix = useMemo(() => {
    if (active === 'hero') return 'hero'
    if (active === 'hotel') return 'hotel'
    if (active === 'about') return 'about'
    return `rooms/${active}`
  }, [active])

  async function loadList() {
    setLoading(true); setError('')
    try {
      const { data, error } = await supabase.storage.from(BUCKET).list(folderPrefix, { limit: 100, sortBy: { column: 'name', order: 'asc' } })
      if (error) throw error
      const hiddenRe = /^(index\.json|amenities\.json|\.keep|\.emptyFolderPlaceholder)$/i
      const imgRe = /\.(webp|jpe?g|png)$/i
      const list = (data || [])
        .filter(f => imgRe.test(f.name))
        .map(f => ({
          name: f.name,
          path: `${folderPrefix}/${f.name}`,
          url: supabase.storage.from(BUCKET).getPublicUrl(`${folderPrefix}/${f.name}`).data.publicUrl,
          size: f.metadata?.size || 0,
        }))
      // Intentar aplicar orden desde index.json SOLO si existe
      const hasIndex = (data || []).some(f => f.name === 'index.json')
      if (hasIndex) {
        try {
          const pubIdx = supabase.storage.from(BUCKET).getPublicUrl(`${folderPrefix}/index.json`).data.publicUrl
          const resIdx = await fetch(pubIdx, { cache: 'no-store' })
          if (resIdx.ok) {
            const order = await resIdx.json()
            const map = new Map(list.map(it => [it.name, it]))
            const ordered = [...order.filter(n=>imgRe.test(n)).map(n => map.get(n)).filter(Boolean), ...list.filter(it => !order.includes(it.name))]
            setItems(ordered)
            return
          }
        } catch {}
      }
      setItems(list)
    } catch (e) {
      setError(e.message)
      setItems([])
    } finally { setLoading(false) }
  }

  useEffect(() => { loadList() }, [folderPrefix])

  async function removeFile(path) {
    setLoading(true); setError('')
    try {
      const { error } = await supabase.storage.from(BUCKET).remove([path])
      if (error) throw error
      await loadList()
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button className={`${active==='hero'?'btn-primary':'btn-ghost'}`} onClick={()=>setActive('hero')}>Portada (Hero)</button>
        <button className={`${active==='hotel'?'btn-primary':'btn-ghost'}`} onClick={()=>setActive('hotel')}>Carrusel del hotel</button>
        <button className={`${active==='about'?'btn-primary':'btn-ghost'}`} onClick={()=>setActive('about')}>Sobre nosotros</button>
        {rooms.map(r => (
          <button key={r.id} className={`${String(active)===String(r.id)?'btn-primary':'btn-ghost'}`} onClick={()=>setActive(String(r.id))}>{r.name} #{r.id}</button>
        ))}
      </div>

      <div className="card p-4">
        <h3 className="font-semibold text-black mb-2">{active==='hero' ? 'Portada del Home' : 'Subir fotos'}</h3>
        <DropzoneUploader bucket={BUCKET} folderPrefix={folderPrefix} maxFiles={active==='hero'?1:10} exclusiveReplace={active==='hero'} />
        <div className="text-sm text-gray-600 mt-2">Carpeta destino: {folderPrefix} {active==='hero' && '· Máximo 1 imagen (reemplaza a la anterior)'}
        </div>
        <ul className="mt-2 text-sm text-gray-600 leading-5">
          <li>Portada (hero): 2560×1440 o 1920×1080 · 16:9</li>
          <li>Carrusel hotel: 1600×900 · 16:9</li>
          <li>Habitaciones (grande): 1600×1067 (3:2) o 1600×900 (16:9)</li>
          <li>Miniaturas: 480×320 (3:2) o 480×270 (16:9)</li>
          <li>Formato: WebP (recomendado) o JPG calidad 75–85 · ≤ 3MB</li>
        </ul>
      </div>

      {isRoom && (
        <div className="card p-4">
          <h3 className="font-semibold text-black mb-2">Amenities de la habitación #{active}</h3>
          <p className="text-sm text-gray-600 mb-2">Un ítem por línea. Se guardan en amenities.json dentro de la carpeta de la habitación.</p>
          <textarea className="w-full border rounded px-3 py-2" rows={6} value={amenitiesText} onChange={e=>setAmenitiesText(e.target.value)} placeholder={'WiFi de alta velocidad\nVista a la ciudad\nAire acondicionado'} />
          <div className="mt-2 flex gap-2">
            <button className="btn-primary" onClick={saveAmenities} disabled={loading}>{loading?'Guardando...':'Guardar amenities'}</button>
            <button className="btn-ghost" onClick={loadAmenities} disabled={loading}>Recargar</button>
          </div>
        </div>
      )}

      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-black">{active==='hero' ? 'Portada actual' : 'Listado'}</h3>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={loadList} disabled={loading}>{loading?'Actualizando...':'Actualizar'}</button>
            <button className="btn-primary" onClick={saveOrder} disabled={active==='hero' || loading || items.length===0}>{loading?'Guardando...':'Guardar orden'}</button>
          </div>
        </div>
        {error && <div className="text-sm text-red-700 mb-2">{error}</div>}
        {items.length === 0 ? (
          <div className="text-sm text-gray-600">No hay fotos en esta carpeta.</div>
        ) : (
          <ul className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((img, i) => (
              <li key={img.path} className="border rounded overflow-hidden hover-lift" draggable onDragStart={(e)=>onDragStart(e,i)} onDragOver={onDragOver} onDrop={(e)=>onDrop(e,i)}>
                <img src={img.url} alt={img.name} className="w-full h-40 object-cover smooth" />
                <div className="p-2 text-sm flex items-center justify-between gap-2">
                  <div className="truncate" title={img.name}>{img.name}</div>
                  <button className="btn-ghost text-red-700" onClick={()=>removeFile(img.path)}>Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
