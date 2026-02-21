import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function formatCOP(valor) {
  const num = typeof valor === 'string' ? parseFloat(valor) : valor
  if (isNaN(num) || num === 0) return '$0'
  return '$' + Math.round(num).toLocaleString('es-CO')
}

function parsePrecio(texto) {
  if (!texto) return 0
  return parseInt(texto.toString().replace(/\./g, '').replace(/,/g, '')) || 0
}

function formatInput(texto) {
  const limpio = texto.replace(/[^\d]/g, '')
  if (!limpio) return ''
  return parseInt(limpio).toLocaleString('es-CO')
}

function formatPeso(gramos) {
  if (gramos >= 1000) return `${(gramos / 1000).toFixed(gramos % 1000 === 0 ? 0 : 1)}kg (${gramos.toLocaleString('es-CO')}g)`
  return `${gramos.toLocaleString('es-CO')}g`
}

export default function Menu() {
  const [items, setItems] = useState([])
  const [variantes, setVariantes] = useState({})
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', precio: '', descripcion: '', activo: true, tipo_medida: 'unidad' })
  const [formVariantes, setFormVariantes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data: menuData } = await supabase.from('menu_items').select('*').order('nombre')
    const { data: varData } = await supabase.from('menu_item_variantes').select('*')
    setItems(menuData || [])
    const varMap = {}
    ;(varData || []).forEach(v => {
      if (!varMap[v.menu_item_id]) varMap[v.menu_item_id] = []
      varMap[v.menu_item_id].push(v)
    })
    setVariantes(varMap)
    setLoading(false)
  }

  function itemsFiltrados() {
    if (!busqueda) return items
    return items.filter(i => i.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  }

  function abrirNuevo() {
    setEditando(null)
    setForm({ nombre: '', precio: '', descripcion: '', activo: true, tipo_medida: 'unidad' })
    setFormVariantes([])
    setModal(true)
  }

  function abrirEditar(item) {
    setEditando(item)
    setForm({
      nombre: item.nombre,
      precio: item.precio > 0 ? formatInput(Math.round(item.precio).toString()) : '',
      descripcion: item.descripcion || '', activo: item.activo,
      tipo_medida: item.tipo_medida || 'unidad'
    })
    setFormVariantes(
      (variantes[item.id] || []).map(v => ({
        id: v.id, nombre: v.nombre,
        precio: formatInput(Math.round(v.precio).toString()),
        peso_gramos: v.peso_gramos ? v.peso_gramos.toString() : ''
      }))
    )
    setModal(true)
  }

  function cambiarTipoMedida(tipo) {
    setForm({ ...form, tipo_medida: tipo })
    // Si cambia a peso y no hay variantes, abrir 1 vacía como guía
    if (tipo === 'peso' && formVariantes.length === 0) {
      setFormVariantes([{ id: null, nombre: '', precio: '', peso_gramos: '' }])
    }
  }

  function agregarVariante() {
    setFormVariantes([...formVariantes, { id: null, nombre: '', precio: '', peso_gramos: '' }])
  }

  function editarVariante(idx, campo, valor) {
    const copia = [...formVariantes]
    if (campo === 'precio') copia[idx][campo] = formatInput(valor)
    else copia[idx][campo] = valor
    setFormVariantes(copia)
  }

  function quitarVariante(idx) { setFormVariantes(formVariantes.filter((_, i) => i !== idx)) }

  async function guardar() {
    if (!form.nombre.trim()) return alert('El nombre es obligatorio')
    const tieneVariantes = formVariantes.filter(v => v.nombre.trim() && parsePrecio(v.precio) > 0).length > 0
    const precioBase = tieneVariantes ? 0 : parsePrecio(form.precio)
    if (!tieneVariantes && precioBase === 0) return alert('Agrega un precio o al menos una variante con precio')

    const datos = {
      nombre: form.nombre.trim(), categoria: null,
      precio: precioBase, descripcion: form.descripcion.trim() || null,
      activo: form.activo, tipo_medida: form.tipo_medida
    }

    let itemId
    if (editando) {
      await supabase.from('menu_items').update(datos).eq('id', editando.id)
      itemId = editando.id
      await supabase.from('menu_item_variantes').delete().eq('menu_item_id', itemId)
    } else {
      const { data } = await supabase.from('menu_items').insert(datos).select().single()
      itemId = data.id
    }

    const varsValidas = formVariantes.filter(v => v.nombre.trim() && parsePrecio(v.precio) > 0)
    if (varsValidas.length > 0) {
      await supabase.from('menu_item_variantes').insert(
        varsValidas.map(v => ({
          menu_item_id: itemId, nombre: v.nombre.trim(),
          precio: parsePrecio(v.precio),
          peso_gramos: parseInt(v.peso_gramos) || 0
        }))
      )
    }

    setModal(false); cargar()
  }

  async function eliminar() {
    if (!editando || !confirm('¿Eliminar este producto?')) return
    await supabase.from('menu_items').delete().eq('id', editando.id)
    setModal(false); cargar()
  }

  async function toggleActivo(item) {
    await supabase.from('menu_items').update({ activo: !item.activo }).eq('id', item.id); cargar()
  }

  if (loading) return <div className="empty-state"><p>Cargando...</p></div>

  return (
    <div>
      <div className="flex-between mb-12">
        <h1 className="page-title" style={{ marginBottom: 0 }}>🍗 Menú</h1>
        <span className="text-sm text-gray">{items.length} productos</span>
      </div>

      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input className="input" placeholder="Buscar producto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      {itemsFiltrados().length === 0 ? (
        <div className="empty-state"><div className="icon">🍽️</div><p>No hay productos aún</p><p className="text-sm mt-8">Toca el botón + para agregar</p></div>
      ) : (
        itemsFiltrados().map(item => (
          <div key={item.id} className="card" onClick={() => abrirEditar(item)}>
            <div className="flex-between">
              <div className="flex gap-8" style={{ alignItems: 'center' }}>
                <span className="text-bold">{item.nombre}</span>
                {item.tipo_medida === 'peso' && <span className="badge" style={{ background: '#8e44ad22', color: '#af7ac5', fontSize: '0.65rem' }}>⚖️ Peso</span>}
              </div>
              <button className={`switch ${item.activo ? 'on' : ''}`} onClick={e => { e.stopPropagation(); toggleActivo(item) }} />
            </div>
            {item.descripcion && <p className="text-sm text-gray mt-8">{item.descripcion}</p>}
            <div className="mt-8 flex flex-wrap">
              {variantes[item.id] && variantes[item.id].length > 0
                ? variantes[item.id].map(v => (
                  <span key={v.id} className="precio-tag">
                    {v.nombre} {v.peso_gramos > 0 ? `(${formatPeso(v.peso_gramos)})` : ''} {formatCOP(v.precio)}
                  </span>
                ))
                : <span className="precio-tag">{formatCOP(item.precio)}</span>}
            </div>
          </div>
        ))
      )}

      <button className="fab" onClick={abrirNuevo}>+</button>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editando ? 'Editar producto' : 'Nuevo producto'}</h2>

            <div className="form-group"><label>Nombre *</label>
              <input className="input" placeholder="Ej: Punta de Anca" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
            </div>

            <div className="form-group"><label>Descripción</label>
              <input className="input" placeholder="Ej: Con papa, yuca, pichaque..." value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
            </div>

            <div className="form-group">
              <label>Tipo de stock</label>
              <div className="flex gap-8">
                <button className={`btn ${form.tipo_medida === 'unidad' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }} onClick={() => cambiarTipoMedida('unidad')}>🔢 Unidades</button>
                <button className={`btn ${form.tipo_medida === 'peso' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }} onClick={() => cambiarTipoMedida('peso')}>⚖️ Peso (kg)</button>
              </div>
              <p className="text-xs text-gray mt-8">
                {form.tipo_medida === 'unidad' ? 'Se mide en unidades (ej: 50 pedazos de pollo)' : 'Se mide en kilos. Agrega variantes con su peso en gramos.'}
              </p>
            </div>

            {formVariantes.length === 0 && (
              <div className="form-group"><label>Precio *</label>
                <input className="input" inputMode="numeric" placeholder="Ej: 20.000" value={form.precio}
                  onChange={e => setForm({ ...form, precio: formatInput(e.target.value) })} />
                {form.precio && <p className="text-xs mt-8" style={{ color: '#e8a849' }}>{formatCOP(parsePrecio(form.precio))}</p>}
              </div>
            )}

            <div className="form-group">
              <div className="flex-between mb-8">
                <label style={{ marginBottom: 0 }}>Variantes</label>
                <button className="btn btn-secondary btn-sm" onClick={agregarVariante}>+ Agregar</button>
              </div>
              {formVariantes.map((v, idx) => (
                <div key={idx} style={{ background: '#333', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <div className="variante-row" style={{ marginBottom: 0 }}>
                    <input className="input" placeholder="Nombre (ej: Libra)" value={v.nombre}
                      onChange={e => editarVariante(idx, 'nombre', e.target.value)} />
                    <input className="input input-precio" inputMode="numeric" placeholder="Precio"
                      value={v.precio} onChange={e => editarVariante(idx, 'precio', e.target.value)} />
                    <button className="variante-remove" onClick={() => quitarVariante(idx)}>✕</button>
                  </div>
                  {form.tipo_medida === 'peso' && (
                    <div className="mt-8">
                      <input className="input" inputMode="numeric" placeholder="Peso en gramos (ej: 250, 500, 1000)"
                        value={v.peso_gramos} onChange={e => editarVariante(idx, 'peso_gramos', e.target.value.replace(/[^\d]/g, ''))} />
                      {v.peso_gramos && parseInt(v.peso_gramos) > 0 && <p className="text-xs text-gray mt-8">= {formatPeso(parseInt(v.peso_gramos))}</p>}
                    </div>
                  )}
                </div>
              ))}
              {formVariantes.length > 0 && <p className="text-xs text-gray mt-8">Cuando hay variantes, el precio base se ignora</p>}
            </div>

            <div className="switch-row"><span>Producto activo</span>
              <button className={`switch ${form.activo ? 'on' : ''}`} onClick={() => setForm({ ...form, activo: !form.activo })} />
            </div>

            <button className="btn btn-primary mt-12" onClick={guardar}>{editando ? 'Guardar cambios' : 'Crear producto'}</button>
            {editando && <button className="btn btn-danger mt-8" style={{ width: '100%' }} onClick={eliminar}>Eliminar producto</button>}
            <button className="btn btn-secondary mt-8" style={{ width: '100%' }} onClick={() => setModal(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}