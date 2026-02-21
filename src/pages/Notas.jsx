import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Notas() {
  const [notas, setNotas] = useState([])
  const [loading, setLoading] = useState(true)
  const [nuevaNota, setNuevaNota] = useState('')
  const [filtro, setFiltro] = useState('pendientes')
  const hoy = new Date().toISOString().split('T')[0]

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('notas_diarias')
      .select('*')
      .order('created_at', { ascending: false })
    setNotas(data || [])
    setLoading(false)
  }

  async function crear() {
    if (!nuevaNota.trim()) return
    await supabase.from('notas_diarias').insert({
      fecha: hoy,
      contenido: nuevaNota.trim(),
      resuelta: false
    })
    setNuevaNota('')
    cargar()
  }

  async function toggleResuelta(nota) {
    await supabase.from('notas_diarias').update({ resuelta: !nota.resuelta }).eq('id', nota.id)
    cargar()
  }

  async function eliminar(nota) {
    if (!confirm('¿Eliminar esta nota?')) return
    await supabase.from('notas_diarias').delete().eq('id', nota.id)
    cargar()
  }

  function notasFiltradas() {
    if (filtro === 'pendientes') return notas.filter(n => !n.resuelta)
    if (filtro === 'resueltas') return notas.filter(n => n.resuelta)
    if (filtro === 'hoy') return notas.filter(n => n.fecha === hoy)
    return notas
  }

  if (loading) return <div className="empty-state"><p>Cargando...</p></div>

  return (
    <div>
      <h1 className="page-title">📝 Notas</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          className="input"
          placeholder="Nueva nota... (deuda, imprevisto, etc.)"
          value={nuevaNota}
          onChange={e => setNuevaNota(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') crear() }}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 16px' }} onClick={crear}>+</button>
      </div>

      <div className="tabs">
        {[
          { key: 'pendientes', label: 'Pendientes' },
          { key: 'resueltas', label: 'Resueltas' },
          { key: 'hoy', label: 'Hoy' },
          { key: 'todas', label: 'Todas' }
        ].map(t => (
          <button key={t.key} className={`tab ${filtro === t.key ? 'active' : ''}`} onClick={() => setFiltro(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {notasFiltradas().length === 0 ? (
        <div className="empty-state">
          <div className="icon">📝</div>
          <p>{filtro === 'pendientes' ? 'Sin notas pendientes' : 'No hay notas'}</p>
        </div>
      ) : (
        notasFiltradas().map(nota => (
          <div key={nota.id} className="card">
            <div className="flex-between">
              <div style={{ flex: 1 }} onClick={() => toggleResuelta(nota)}>
                <p style={{
                  textDecoration: nota.resuelta ? 'line-through' : 'none',
                  opacity: nota.resuelta ? 0.5 : 1
                }}>
                  {nota.contenido}
                </p>
                <p className="text-xs text-gray mt-8">{nota.fecha}</p>
              </div>
              <div className="flex gap-8">
                <button
                  className={`switch ${nota.resuelta ? 'on' : ''}`}
                  onClick={() => toggleResuelta(nota)}
                  style={{ width: 36, height: 20 }}
                />
                <button className="variante-remove" onClick={() => eliminar(nota)}>✕</button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}