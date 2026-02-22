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

function stockColor(c) { return c < 10 ? 'stock-red' : c < 20 ? 'stock-yellow' : 'stock-green' }
function stockColorPeso(kg) { return kg < 1 ? 'stock-red' : kg < 3 ? 'stock-yellow' : 'stock-green' }

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([])
  const [clientes, setClientes] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [variantes, setVariantes] = useState({})
  const [stockMap, setStockMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [modalPago, setModalPago] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const hoy = new Date().toISOString().split('T')[0]

  const [clienteInput, setClienteInput] = useState('')
  const [sugerencias, setSugerencias] = useState([])
  const [tipoEntrega, setTipoEntrega] = useState('domicilio')
  const [horaEntrega, setHoraEntrega] = useState('')
  const [notasPedido, setNotasPedido] = useState('')
  const [itemsPedido, setItemsPedido] = useState([])
  const [totalManual, setTotalManual] = useState('')

  const [metodoPago, setMetodoPago] = useState('efectivo')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data: pedidosData } = await supabase.from('pedidos').select('*').eq('fecha', hoy).order('created_at', { ascending: false })
    const { data: clientesData } = await supabase.from('clientes').select('*').order('identificador')
    const { data: menuData } = await supabase.from('menu_items').select('*').eq('activo', true).order('nombre')
    const { data: varData } = await supabase.from('menu_item_variantes').select('*')
    const { data: stockData } = await supabase.from('stock_diario').select('*').eq('fecha', hoy)
    const { data: pagosData } = await supabase.from('pagos').select('*')
    const { data: pedidoItemsData } = await supabase.from('pedido_items').select('*')

    const varMap = {}
    ;(varData || []).forEach(v => {
      if (!varMap[v.menu_item_id]) varMap[v.menu_item_id] = []
      varMap[v.menu_item_id].push(v)
    })
    const sMap = {}
    ;(stockData || []).forEach(s => { sMap[s.menu_item_id] = s })

    const pedidosEnriquecidos = (pedidosData || []).map(p => {
      const cliente = (clientesData || []).find(c => c.id === p.cliente_id)
      const items = (pedidoItemsData || []).filter(pi => pi.pedido_id === p.id)
      const pago = (pagosData || []).find(pg => pg.pedido_id === p.id)
      const itemsConNombre = items.map(pi => {
        const menu = (menuData || []).find(m => m.id === pi.menu_item_id)
        return { ...pi, nombre_producto: menu?.nombre || 'Producto eliminado' }
      })
      return { ...p, cliente, items: itemsConNombre, pago }
    })

    setPedidos(pedidosEnriquecidos)
    setClientes(clientesData || [])
    setMenuItems(menuData || [])
    setVariantes(varMap)
    setStockMap(sMap)
    setLoading(false)
  }

  function esPeso(menuItemId) { return menuItems.find(m => m.id === menuItemId)?.tipo_medida === 'peso' }

  function getStockDisponible(menuItemId) {
    const s = stockMap[menuItemId]
    if (!s) return null
    if (!s.disponible) return 0
    return s.cantidad_disponible
  }

  function getStockTiempoReal(menuItemId, excludeIdx) {
    const base = getStockDisponible(menuItemId)
    if (base === null) return null
    let usado = 0
    itemsPedido.forEach((item, idx) => {
      if (idx === excludeIdx) return
      if (item.menu_item_id === menuItemId) usado += calcularDescuentoItem(item)
    })
    return Math.max(0, Math.round((base - usado) * 100) / 100)
  }

  function getVariantePeso(menuItemId, varianteId) {
    return (variantes[menuItemId] || []).find(v => v.id === varianteId)?.peso_gramos || 0
  }

  function calcularDescuentoItem(item) {
    if (esPeso(item.menu_item_id) && item.variante_id) {
      return (getVariantePeso(item.menu_item_id, item.variante_id) / 1000) * item.cantidad
    }
    return item.cantidad
  }

  // Stock obligatorio o no: si no hay registro de stock para este producto, se puede pedir
  function productoDisponible(menuItemId) {
    const s = stockMap[menuItemId]
    if (!s) return true // sin stock configurado = disponible
    if (!s.disponible) return false
    if (s.cantidad_disponible <= 0 && s.cantidad_inicial > 0) return false
    return true
  }

  function abrirNuevoPedido() {
    setClienteInput(''); setSugerencias([]); setTipoEntrega('domicilio')
    setHoraEntrega(''); setNotasPedido(''); setItemsPedido([]); setTotalManual('')
    setModal(true)
  }

  function buscarCliente(texto) {
    setClienteInput(texto)
    setSugerencias(texto.length >= 1 ? clientes.filter(c => c.identificador.toLowerCase().includes(texto.toLowerCase())).slice(0, 5) : [])
  }

  function seleccionarCliente(c) { setClienteInput(c.identificador); setSugerencias([]) }

  function agregarItem() { setItemsPedido([...itemsPedido, { menu_item_id: '', variante_id: '', cantidad: 1, cantidadTexto: '1', notas: '' }]) }

  function editarItem(idx, campo, valor) {
    const copia = [...itemsPedido]
    if (campo === 'menu_item_id') {
      copia[idx].menu_item_id = valor; copia[idx].variante_id = ''; copia[idx].cantidad = 1; copia[idx].cantidadTexto = '1'
    } else if (campo === 'cantidadTexto') {
      const soloNumeros = valor.replace(/[^\d]/g, '')
      copia[idx].cantidadTexto = soloNumeros
      const num = parseInt(soloNumeros) || 0
      if (!esPeso(copia[idx].menu_item_id)) {
        const disponible = getStockTiempoReal(copia[idx].menu_item_id, idx)
        if (disponible !== null && disponible > 0) {
          copia[idx].cantidad = Math.min(num, Math.floor(disponible))
        } else {
          copia[idx].cantidad = num
        }
      } else {
        copia[idx].cantidad = num
      }
    } else { copia[idx][campo] = valor }
    setItemsPedido(copia)
  }

  function validarCantidad(idx) {
    const copia = [...itemsPedido]
    const num = parseInt(copia[idx].cantidadTexto) || 0
    if (num < 1) {
      copia[idx].cantidadTexto = '1'; copia[idx].cantidad = 1
    } else {
      copia[idx].cantidadTexto = copia[idx].cantidad.toString()
    }
    setItemsPedido(copia)
  }

  function seleccionarTodo(e) { e.target.select() }

  function quitarItem(idx) { setItemsPedido(itemsPedido.filter((_, i) => i !== idx)) }

  function getPrecioItem(item) {
    if (item.variante_id) {
      const v = (variantes[item.menu_item_id] || []).find(v => v.id === item.variante_id)
      return v ? parseFloat(v.precio) : 0
    }
    const menu = menuItems.find(m => m.id === item.menu_item_id)
    return menu ? parseFloat(menu.precio) : 0
  }

  function totalCalculado() { return itemsPedido.reduce((sum, item) => sum + (getPrecioItem(item) * item.cantidad), 0) }
  function totalFinal() { return totalManual ? parsePrecio(totalManual) : totalCalculado() }

  async function crearPedido() {
    if (!clienteInput.trim()) return alert('Escribe el identificador del cliente')
    if (itemsPedido.length === 0) return alert('Agrega al menos un producto')
    if (itemsPedido.some(i => !i.menu_item_id)) return alert('Selecciona un producto para cada item')
    if (itemsPedido.some(i => i.cantidad < 1)) return alert('La cantidad debe ser al menos 1')

    for (const item of itemsPedido) {
      const disponibleReal = getStockTiempoReal(item.menu_item_id, -1)
      if (disponibleReal !== null && disponibleReal > 0) {
        const descuento = calcularDescuentoItem(item)
        if (descuento > disponibleReal) {
          const menu = menuItems.find(m => m.id === item.menu_item_id)
          const unidad = esPeso(item.menu_item_id) ? 'kg' : 'und'
          return alert(`No hay suficiente stock de ${menu?.nombre}. Disponible: ${disponibleReal} ${unidad}`)
        }
      }
    }

    let clienteId
    const clienteExistente = clientes.find(c => c.identificador.toLowerCase() === clienteInput.trim().toLowerCase())
    if (clienteExistente) { clienteId = clienteExistente.id }
    else {
      const { data } = await supabase.from('clientes').insert({ identificador: clienteInput.trim() }).select().single()
      clienteId = data.id
    }

    const { data: pedido } = await supabase.from('pedidos').insert({
      cliente_id: clienteId, fecha: hoy, tipo_entrega: tipoEntrega, estado: 'en_proceso',
      hora_entrega: horaEntrega ? new Date(`${hoy}T${horaEntrega}`).toISOString() : null,
      total: totalFinal(), notas: notasPedido.trim() || null
    }).select().single()

    const itemsToInsert = itemsPedido.map(item => {
      const precio = getPrecioItem(item)
      const variante = (variantes[item.menu_item_id] || []).find(v => v.id === item.variante_id)
      return {
        pedido_id: pedido.id, menu_item_id: item.menu_item_id, cantidad: item.cantidad,
        precio_unitario: precio, subtotal: precio * item.cantidad,
        notas: variante ? `${variante.nombre}${item.notas ? ' - ' + item.notas : ''}` : (item.notas || null)
      }
    })
    await supabase.from('pedido_items').insert(itemsToInsert)

    for (const item of itemsPedido) {
      const s = stockMap[item.menu_item_id]
      if (s && s.cantidad_disponible > 0) {
        const descuento = calcularDescuentoItem(item)
        const nuevoStock = Math.max(0, parseFloat(s.cantidad_disponible) - descuento)
        const redondeado = esPeso(item.menu_item_id) ? Math.round(nuevoStock * 100) / 100 : Math.round(nuevoStock)
        await supabase.from('stock_diario').update({ cantidad_disponible: redondeado }).eq('id', s.id)
      }
    }

    if (horaEntrega) {
      const horaAlerta = new Date(`${hoy}T${horaEntrega}`)
      horaAlerta.setMinutes(horaAlerta.getMinutes() - 10)
      await supabase.from('recordatorios').insert({
        pedido_id: pedido.id, hora_alerta: horaAlerta.toISOString(),
        mensaje: `Pedido para ${clienteInput.trim()} a las ${horaEntrega}`
      })
    }

    setModal(false); cargar()
  }

  function estadoVisual(p) {
    if (p.estado === 'en_proceso') return { clase: 'badge-pending', texto: '⏳ Preparando', cardClass: 'card-en-proceso' }
    if (p.estado === 'no_entregado' || p.estado === 'entregado') {
      if (p.pago) return { clase: 'badge-done', texto: '✅ Completado', cardClass: 'card-entregado' }
      return { clase: 'badge-progress', texto: '🔴 No pagado', cardClass: 'card-no-entregado' }
    }
    return { clase: '', texto: p.estado, cardClass: '' }
  }

  async function cambiarEstado(pedido, nuevoEstado) {
    await supabase.from('pedidos').update({ estado: nuevoEstado }).eq('id', pedido.id)
    setDetalle(null); cargar()
  }

  function abrirPago(pedido) { setModalPago(pedido); setMetodoPago('efectivo') }

  async function registrarPago() {
    if (!modalPago) return
    await supabase.from('pagos').insert({
      pedido_id: modalPago.id, monto: parseFloat(modalPago.total), metodo_pago: metodoPago, referencia: null
    })
    setModalPago(null); cargar()
  }

  async function editarTotal(pedido, nuevoTotalTexto) {
    const nuevoTotal = parsePrecio(nuevoTotalTexto)
    if (nuevoTotal > 0) { await supabase.from('pedidos').update({ total: nuevoTotal }).eq('id', pedido.id); cargar() }
  }

  async function eliminarPedido(pedido) {
    if (!confirm('¿Eliminar este pedido?')) return
    await supabase.from('pedidos').delete().eq('id', pedido.id); setDetalle(null); cargar()
  }

  function pedidosFiltrados() {
    if (filtroEstado === 'todos') return pedidos
    if (filtroEstado === 'preparando') return pedidos.filter(p => p.estado === 'en_proceso')
    if (filtroEstado === 'no_pagado') return pedidos.filter(p => !p.pago && p.estado !== 'en_proceso')
    if (filtroEstado === 'completado') return pedidos.filter(p => p.pago && p.estado !== 'en_proceso')
    if (filtroEstado === 'sin_pagar') return pedidos.filter(p => !p.pago)
    return pedidos
  }

  if (loading) return <div className="empty-state"><p>Cargando...</p></div>

  return (
    <div>
      <div className="flex-between mb-12">
        <h1 className="page-title" style={{ marginBottom: 0 }}>📋 Pedidos</h1>
        <span className="text-sm text-gray">{pedidos.length} hoy</span>
      </div>

      <div className="tabs">
        {[{ key: 'todos', label: 'Todos' }, { key: 'preparando', label: '⏳ Preparando' }, { key: 'no_pagado', label: '🔴 No pagado' }, { key: 'completado', label: '✅ Completado' }, { key: 'sin_pagar', label: '💰 Sin pagar' }].map(t => (
          <button key={t.key} className={`tab ${filtroEstado === t.key ? 'active' : ''}`} onClick={() => setFiltroEstado(t.key)}>{t.label}</button>
        ))}
      </div>

      {pedidosFiltrados().length === 0 ? (
        <div className="empty-state"><div className="icon">📋</div><p>{filtroEstado === 'todos' ? 'No hay pedidos hoy' : 'No hay pedidos con este filtro'}</p><p className="text-sm mt-8">Toca + para crear un pedido</p></div>
      ) : (
        pedidosFiltrados().map(p => {
          const ev = estadoVisual(p)
          return (
            <div key={p.id} className={`card ${ev.cardClass}`} onClick={() => setDetalle(p)}>
              <div className="flex-between">
                <span className="text-bold">{p.cliente?.identificador || 'Sin cliente'}</span>
                <span className={`badge ${ev.clase}`}>{ev.texto}</span>
              </div>
              <div className="flex-between mt-8">
                <div>
                  <span className="text-sm text-gray">{p.tipo_entrega === 'local' ? '🏠 Local' : '🛵 Domicilio'}</span>
                  {p.hora_entrega && <span className="text-sm text-gray" style={{ marginLeft: 8 }}>⏰ {new Date(p.hora_entrega).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
                <span className="precio-tag">{formatCOP(p.total)}</span>
              </div>
              <div className="mt-8 text-sm text-gray">
                {p.items.map((item, i) => (<span key={i}>{item.cantidad}x {item.nombre_producto}{item.notas ? ` (${item.notas})` : ''}{i < p.items.length - 1 ? ' · ' : ''}</span>))}
              </div>
              <div className="flex-between mt-8">
                <span className={`badge ${p.pago ? 'badge-paid' : 'badge-unpaid'}`}>{p.pago ? `✓ ${p.pago.metodo_pago}` : '⏳ Sin pagar'}</span>
                <span className="text-xs text-gray">{new Date(p.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          )
        })
      )}

      <button className="fab" onClick={abrirNuevoPedido}>+</button>

      {/* MODAL NUEVO PEDIDO */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Nuevo pedido</h2>

            <div className="form-group"><label>Cliente *</label>
              <input className="input" placeholder="Ej: Portal D4, Casa I1..." value={clienteInput} onChange={e => buscarCliente(e.target.value)} />
              {sugerencias.length > 0 && (
                <div style={{ background: '#333', borderRadius: 8, marginTop: 4 }}>
                  {sugerencias.map(c => (<div key={c.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #3a3a3a' }} onClick={() => seleccionarCliente(c)}>{c.identificador}</div>))}
                </div>
              )}
            </div>

            <div className="form-group"><label>Tipo de entrega</label>
              <div className="flex gap-8">
                <button className={`btn ${tipoEntrega === 'domicilio' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setTipoEntrega('domicilio')}>🛵 Domicilio</button>
                <button className={`btn ${tipoEntrega === 'local' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setTipoEntrega('local')}>🏠 Local</button>
              </div>
            </div>

            <div className="form-group"><label>Hora de entrega (opcional)</label>
              <input className="input" type="time" value={horaEntrega} onChange={e => setHoraEntrega(e.target.value)} />
            </div>

            <div className="form-group">
              <div className="flex-between mb-8"><label style={{ marginBottom: 0 }}>Productos *</label><button className="btn btn-secondary btn-sm" onClick={agregarItem}>+ Agregar</button></div>
              {itemsPedido.map((item, idx) => {
                const vars = variantes[item.menu_item_id] || []
                const peso = esPeso(item.menu_item_id)
                const disponibleReal = getStockTiempoReal(item.menu_item_id, idx)
                const descuento = calcularDescuentoItem(item)
                const stockSuficiente = disponibleReal === null || descuento <= disponibleReal

                return (
                  <div key={idx} style={{ background: '#333', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                    <div className="flex gap-8" style={{ alignItems: 'center' }}>
                      <select className="select" value={item.menu_item_id} onChange={e => editarItem(idx, 'menu_item_id', e.target.value)} style={{ flex: 1 }}>
                        <option value="">Seleccionar...</option>
                        {menuItems.map(m => {
                          const noDisp = !productoDisponible(m.id)
                          const stk = getStockTiempoReal(m.id, idx)
                          const unidad = m.tipo_medida === 'peso' ? 'kg' : ''
                          return <option key={m.id} value={m.id} disabled={noDisp}>
                            {m.nombre} {stk !== null && stk > 0 ? `(${Math.round(stk * 100) / 100}${unidad})` : ''} {noDisp ? '— AGOTADO' : ''}
                          </option>
                        })}
                      </select>
<input
  type="text"
  inputMode="numeric"
  className="input"
  value={item.cantidad}
  onChange={e => {
    const copia = [...itemsPedido]
    copia[idx] = { ...copia[idx], cantidad: e.target.value }
    setItemsPedido(copia)
  }}
  style={{ width: 50, textAlign: 'center', padding: '6px' }}
/>
                      <button className="variante-remove" onClick={() => quitarItem(idx)}>✕</button>
                    </div>

                    {item.menu_item_id && disponibleReal !== null && disponibleReal > 0 && (
                      <div className="mt-8">
                        <span className={`stock-indicator ${peso ? stockColorPeso(disponibleReal) : stockColor(disponibleReal)}`}>
                          📦 {peso ? `${disponibleReal} kg` : `${disponibleReal} disponible${disponibleReal !== 1 ? 's' : ''}`}
                        </span>
                        {peso && item.variante_id && (
                          <span className={`stock-indicator ${stockSuficiente ? 'stock-green' : 'stock-red'}`} style={{ marginLeft: 4 }}>
                            {stockSuficiente ? '✓' : '✕'} {descuento.toFixed(2)} kg
                          </span>
                        )}
                      </div>
                    )}

                    {vars.length > 0 && (
                      <select className="select mt-8" value={item.variante_id} onChange={e => editarItem(idx, 'variante_id', e.target.value)}>
                        <option value="">Seleccionar tamaño...</option>
                        {vars.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.nombre} {v.peso_gramos > 0 ? `(${v.peso_gramos >= 1000 ? (v.peso_gramos/1000)+'kg' : v.peso_gramos+'g'})` : ''} — {formatCOP(v.precio)}
                          </option>
                        ))}
                      </select>
                    )}

                    <input className="input mt-8" placeholder="Notas (opcional)" value={item.notas} onChange={e => editarItem(idx, 'notas', e.target.value)} />
                    <div className="text-right mt-8"><span className="precio-tag">{formatCOP(getPrecioItem(item) * item.cantidad)}</span></div>
                  </div>
                )
              })}
              {itemsPedido.length === 0 && <p className="text-sm text-gray">Toca "+ Agregar" para añadir productos</p>}
            </div>

            <div className="form-group"><label>Notas del pedido</label><input className="input" placeholder="Notas adicionales..." value={notasPedido} onChange={e => setNotasPedido(e.target.value)} /></div>

            <div className="total-editable mt-12 mb-8"><span className="text-bold" style={{ flex: 1 }}>Total</span><span className="text-sm" style={{ color: '#e8a849' }}>{formatCOP(totalCalculado())}</span></div>
            <div className="form-group"><label>Editar total (opcional)</label>
              <input className="input" inputMode="numeric" placeholder={formatInput(totalCalculado().toString())} value={totalManual} onChange={e => setTotalManual(formatInput(e.target.value))} onFocus={seleccionarTodo} />
              {totalManual && <p className="text-xs mt-8" style={{ color: '#e8a849' }}>Total ajustado: {formatCOP(parsePrecio(totalManual))}</p>}
            </div>

            <button className="btn btn-primary mt-8" onClick={crearPedido}>Crear pedido</button>
            <button className="btn btn-secondary mt-8" style={{ width: '100%' }} onClick={() => setModal(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* MODAL DETALLE */}
      {detalle && (() => {
        const ev = estadoVisual(detalle)
        return (
          <div className="modal-overlay" onClick={() => setDetalle(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2 className="modal-title">Pedido — {detalle.cliente?.identificador}</h2>
              <div className="flex-between mb-8"><span className={`badge ${ev.clase}`}>{ev.texto}</span><span className="text-sm text-gray">{detalle.tipo_entrega === 'local' ? '🏠 Local' : '🛵 Domicilio'}</span></div>

              {detalle.estado === 'en_proceso' && <p className="text-xs mb-8" style={{ color: '#e8a849' }}>⏳ El domicilio aún no ha salido</p>}
              {detalle.estado !== 'en_proceso' && !detalle.pago && <p className="text-xs mb-8" style={{ color: '#e74c3c' }}>🔴 Se envió pero no se ha pagado</p>}

              {detalle.hora_entrega && <p className="text-sm mb-8">⏰ Entrega: {new Date(detalle.hora_entrega).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</p>}

              <div style={{ background: '#333', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                {detalle.items.map((item, i) => (
                  <div key={i} className="flex-between" style={{ padding: '4px 0' }}>
                    <span className="text-sm">{item.cantidad}x {item.nombre_producto} {item.notas ? `(${item.notas})` : ''}</span>
                    <span className="text-sm text-bold">{formatCOP(item.subtotal)}</span>
                  </div>
                ))}
                <div className="flex-between" style={{ borderTop: '1px solid #444', paddingTop: 8, marginTop: 8 }}>
                  <span className="text-bold">Total</span><span className="text-bold" style={{ color: '#e8a849' }}>{formatCOP(detalle.total)}</span>
                </div>
              </div>

              <div className="form-group"><label>Editar total</label>
                <input className="input" inputMode="numeric" placeholder={formatInput(Math.round(parseFloat(detalle.total)).toString())}
                  onFocus={seleccionarTodo}
                  onBlur={e => { if (e.target.value) { editarTotal(detalle, e.target.value); setDetalle({ ...detalle, total: parsePrecio(e.target.value) }) } }} />
              </div>

              {detalle.notas && <p className="text-sm text-gray mb-12">📝 {detalle.notas}</p>}

              {!detalle.pago && (
                <div className="flex gap-8 mb-12">
                  <button className="btn btn-success" style={{ flex: 1 }} onClick={() => { setDetalle(null); abrirPago(detalle) }}>💳 Registrar pago</button>
                </div>
              )}
              {detalle.pago && <p className="text-sm mb-12" style={{ color: '#2ecc71' }}>✓ Pagado con {detalle.pago.metodo_pago}</p>}

              {detalle.estado === 'en_proceso' && detalle.tipo_entrega === 'domicilio' && (
                <button className="btn btn-primary mb-8" onClick={() => cambiarEstado(detalle, 'no_entregado')}>🛵 Enviar domicilio</button>
              )}
              {detalle.estado === 'en_proceso' && detalle.tipo_entrega === 'local' && (
                <button className="btn btn-primary mb-8" onClick={() => cambiarEstado(detalle, 'entregado')}>✅ Entregado</button>
              )}

              <button className="btn btn-danger mb-8" style={{ width: '100%' }} onClick={() => eliminarPedido(detalle)}>🗑 Eliminar pedido</button>
              <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setDetalle(null)}>Cerrar</button>
            </div>
          </div>
        )
      })()}

      {/* MODAL PAGO */}
      {modalPago && (
        <div className="modal-overlay" onClick={() => setModalPago(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Registrar pago</h2>
            <p className="text-sm text-gray mb-12">{modalPago.cliente?.identificador} — {formatCOP(modalPago.total)}</p>
            <div className="form-group"><label>Método de pago</label>
              <div className="flex gap-8">
                <button className={`btn ${metodoPago === 'efectivo' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setMetodoPago('efectivo')}>💵 Efectivo</button>
                <button className={`btn ${metodoPago === 'nequi' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setMetodoPago('nequi')}>📱 Nequi</button>
              </div>
            </div>
            <button className="btn btn-primary mt-12" onClick={registrarPago}>Confirmar pago</button>
            <button className="btn btn-secondary mt-8" style={{ width: '100%' }} onClick={() => setModalPago(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}