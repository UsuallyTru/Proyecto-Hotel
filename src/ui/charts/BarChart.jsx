import { BarChart as RCBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function BarChart({ data, xKey, yKey }) {
  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <RCBarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey={xKey} stroke="#cbd5e1" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
          <YAxis stroke="#cbd5e1" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
          <Tooltip contentStyle={{ background: '#141a22', border: '1px solid rgba(255,255,255,0.06)', color: '#cbd5e1' }} cursor={{ fill: 'rgba(232,216,177,0.08)' }} />
          <Bar dataKey={yKey} fill="#e8d8b1" />
        </RCBarChart>
      </ResponsiveContainer>
    </div>
  )
}
