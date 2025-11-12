import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function RoomsCrud() {
  const { profile } = useAuth()
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({ name: '', description: '', capacity: 2, base_price: 100, status: 'open' })

  async function loadRooms() {
    if (!profile?.hotel_id) return
    setLoading(true); setError('')
    const { data, error } = await supabase
      .from('rooms')
      .select('id, name, description, capacity, base_price, status, created_at')
      .eq('hotel_id', profile.hotel_id)
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    setRooms(data || [])
    setLoading(false)
  }

  useEffect(() => { loadRooms() }, [profile?.hotel_id])

  async function createRoom(e) {
    e.preventDefault()
    if (!profile?.hotel_id) return
    const payload = { ...form, hotel_id: profile.hotel_id }
    const { data: created, error } = await supabase
      .from('rooms')
      .insert(payload)
      .select('id')
      .single()
    if (error) return setError(error.message)
    // Crear solo marcador opcional para la carpeta (sin index.json vacío)
    try {
      const folder = `rooms/${created.id}`
      const keep = new Blob([''], { type: 'text/plain' })
      await supabase.storage.from('room-photos').upload(`${folder}/.keep`, keep, { upsert: true, contentType: 'text/plain' })
    } catch {}
    setForm({ name: '', description: '', capacity: 2, base_price: 100, status: 'open' })
    loadRooms()
  }

  async function updateRoom(id, patch) {
    const { error } = await supabase.from('rooms').update(patch).eq('id', id)
    if (error) return setError(error.message)
    loadRooms()
  }

  async function deleteRoom(id) {
    const ok = window.confirm('¿Eliminar esta habitación? Esta acción no se puede deshacer.')
    if (!ok) return
    const { error } = await supabase.from('rooms').delete().eq('id', id)
    if (error) { setError(error.message); return }
    loadRooms()
  }

  async function toggleStatus(id, current) {
    const next = current === 'open' ? 'closed' : 'open'
    await updateRoom(id, { status: next })
  }

  function handlePriceLocal(id, value) {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, base_price: value } : r))
  }

  async function handlePriceCommit(id, value) {
    await updateRoom(id, { base_price: Number(value) })
  }

  async function handleStatusChange(id, value) {
    await updateRoom(id, { status: value })
  }

  function handleLocal(id, field, value) {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  async function handleCommit(id, field, value) {
    const patch = { [field]: field === 'capacity' || field === 'base_price' ? Number(value) : value }
    await updateRoom(id, patch)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-black">Rooms CRUD</h3>
      {error && <div className="text-sm text-red-700">{error}</div>}

      <form onSubmit={createRoom} className="grid md:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-sm text-gray-600">Nombre</label>
          <input className="w-full border rounded px-3 py-2" value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))} required />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600">Descripción</label>
          <input className="w-full border rounded px-3 py-2" value={form.description} onChange={e=>setForm(f=>({...f, description:e.target.value}))} />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Capacidad</label>
          <input type="number" min={1} className="w-full border rounded px-3 py-2" value={form.capacity} onChange={e=>setForm(f=>({...f, capacity:Number(e.target.value)}))} />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Precio base</label>
          <input type="number" min={0} className="w-full border rounded px-3 py-2" value={form.base_price} onChange={e=>setForm(f=>({...f, base_price:Number(e.target.value)}))} />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Estado</label>
          <select className="w-full border rounded px-3 py-2" value={form.status} onChange={e=>setForm(f=>({...f, status:e.target.value}))}>
            <option value="open">Abierta</option>
            <option value="closed">Cerrada</option>
            <option value="maintenance">Mantenimiento</option>
          </select>
        </div>
        <div className="md:col-span-5">
          <button className="btn-primary">Crear habitación</button>
        </div>
      </form>

      <div className="border-t pt-4">
        {loading ? (
          <div>Cargando...</div>
        ) : rooms.length === 0 ? (
          <div className="text-sm text-gray-600">No hay habitaciones.</div>
        ) : (
          <ul className="space-y-2">
            {rooms.map(r => (
              <li key={r.id} className="border rounded p-3 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="font-semibold text-black flex items-center gap-2">
                    <input
                      className="border rounded px-2 py-1"
                      value={r.name}
                      onChange={e=>handleLocal(r.id,'name', e.target.value)}
                      onBlur={e=>handleCommit(r.id,'name', e.target.value)}
                    />
                    <span className="text-xs text-gray-500">#{r.id}</span>
                  </div>
                  <div>
                    <input
                      className="border rounded px-2 py-1 w-64"
                      placeholder="Descripción"
                      value={r.description || ''}
                      onChange={e=>handleLocal(r.id,'description', e.target.value)}
                      onBlur={e=>handleCommit(r.id,'description', e.target.value)}
                    />
                  </div>
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    <span>Capacidad</span>
                    <input type="number" min={1} className="border rounded px-2 py-1 w-20"
                      value={r.capacity}
                      onChange={e=>handleLocal(r.id,'capacity', Number(e.target.value))}
                      onBlur={e=>handleCommit(r.id,'capacity', e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-600">Precio $</span>
                    <input type="number" min={0} value={r.base_price}
                      onChange={e=>handlePriceLocal(r.id, Number(e.target.value))}
                      onBlur={e=>handlePriceCommit(r.id, e.target.value)}
                      className="w-24 border rounded px-2 py-1" />
                  </div>
                  <select className="border rounded px-2 py-1" value={r.status} onChange={e=>handleStatusChange(r.id, e.target.value)}>
                    <option value="open">Abierta</option>
                    <option value="closed">Cerrada</option>
                    <option value="maintenance">Mantenimiento</option>
                  </select>
                  <button className="border px-3 py-2 rounded" onClick={()=>toggleStatus(r.id, r.status)}>
                    {r.status === 'open' ? 'Cerrar' : 'Abrir'}
                  </button>
                  <button className="border px-3 py-2 rounded text-red-700" onClick={()=>deleteRoom(r.id)}>Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
