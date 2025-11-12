import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function AdminReservations() {
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    if (!profile?.hotel_id) return
    setLoading(true); setError('')
    const { data, error } = await supabase
      .from('reservations')
      .select('id, client_id, status, check_in, check_out, guests, total_amount, created_at')
      .eq('hotel_id', profile.hotel_id)
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [profile?.hotel_id])

  async function updateStatus(id, status) {
    const { error } = await supabase.from('reservations').update({ status }).eq('id', id)
    if (error) return setError(error.message)
    load()
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-black">Reservas</h2>
      {error && <div className="text-sm text-red-700">{error}</div>}
      {loading ? (
        <div>Cargando...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-600">No hay reservas.</div>
      ) : (
        <ul className="space-y-2">
          {items.map(r => (
            <li key={r.id} className="border rounded p-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-black">Reserva #{r.id} · {r.status}</div>
                <div className="text-sm text-gray-600">{r.check_in} → {r.check_out} · Huéspedes {r.guests} · ${r.total_amount}</div>
              </div>
              <div className="flex gap-2">
                {r.status !== 'confirmed' && (
                  <button className="btn-primary" onClick={()=>updateStatus(r.id, 'confirmed')}>Confirmar</button>
                )}
                {r.status !== 'cancelled' && (
                  <button className="border px-3 py-2 rounded" onClick={()=>updateStatus(r.id, 'cancelled')}>Cancelar</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
