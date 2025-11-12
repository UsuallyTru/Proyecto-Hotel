import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function AdminPayments() {
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)

  const fmtCurrency = useMemo(() =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }),
  [])

  async function load() {
    if (!profile?.hotel_id) return
    setLoading(true)
    setError('')
    try {
      const { data: resv, error: er } = await supabase
        .from('reservations')
        .select('id')
        .eq('hotel_id', profile.hotel_id)
      if (er) throw er

      const ids = (resv || []).map(r => r.id)
      if (!ids.length) {
        setItems([])
        return
      }

      const { data: pays, error: e2 } = await supabase
        .from('payments')
        .select('id, reservation_id, client_id, provider, amount, status, created_at')
        .in('reservation_id', ids)
      if (e2) throw e2
      setItems(pays || [])
    } catch (err) {
      setError(err?.message || 'Error al cargar pagos')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [profile?.hotel_id])

  async function setStatus(id, status) {
    setError('')
    setUpdatingId(id)
    const prev = items
    // Update optimista
    setItems(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    try {
      const { error } = await supabase.from('payments').update({ status }).eq('id', id)
      if (error) throw error
    } catch (err) {
      // Revertir y recargar si falla
      setItems(prev)
      setError(err?.message || 'No se pudo actualizar el estado')
      await load()
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-black">Pagos</h2>
      {error && <div className="text-sm text-red-700" role="alert" aria-live="polite">{error}</div>}
      {loading ? (
        <div aria-busy="true">Cargando...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-600">No hay pagos.</div>
      ) : (
        <ul className="space-y-2">
          {items.map(p => (
            <li key={p.id} className="border rounded p-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-black">Pago #{p.id} — {p.provider} — {p.status}</div>
                <div className="text-sm text-gray-600">Reserva #{p.reservation_id} · {fmtCurrency.format(Number(p.amount) || 0)} · {new Date(p.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</div>
              </div>
              <div className="flex gap-2">
                {p.status !== 'approved' && (
                  <button
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={()=>setStatus(p.id, 'approved')}
                    disabled={loading || updatingId === p.id}
                  >Aprobar</button>
                )}
                {p.status !== 'rejected' && (
                  <button
                    className="border px-3 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={()=>setStatus(p.id, 'rejected')}
                    disabled={loading || updatingId === p.id}
                  >Rechazar</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

