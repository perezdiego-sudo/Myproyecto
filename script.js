import { db } from "./firebase_config.js";
import {
  collection, getDocs, doc, getDoc, runTransaction
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ==========================================================
// REFERENCIAS A ELEMENTOS DEL DOM
// ==========================================================
const contenedor = document.getElementById('productos-container');
const modalCarrito = document.getElementById('modal-carrito');
const btnAbrirCarrito = document.getElementById('btn-abrir-carrito');
const btnCerrarCarrito = document.getElementById('btn-cerrar-carrito');
const btnVaciarCarrito = document.getElementById('btn-vaciar-carrito');
const contadorCarrito = document.getElementById('contador-carrito');
const inputDireccion = document.getElementById('input-direccion');
const radiosEnvio = document.querySelectorAll('input[name="tipoEnvio"]');
const listaCarrito = document.getElementById('lista-carrito');
const subtotalCarrito = document.getElementById('subtotal-carrito');
const totalCarrito = document.getElementById('total-carrito');
const btnEnviarPedido = document.getElementById('btn-enviar-pedido');

const modalZoom = document.getElementById('modal-zoom');
const zoomImagenActual = document.getElementById('zoom-imagen-actual');

const NUMERO_WHATSAPP = "573136375152";

let carrito = JSON.parse(localStorage.getItem('carrito')) || [];

// ==========================================================
// CARGA DE PRODUCTOS DESDE FIREBASE
// ==========================================================

async function cargarProductos() {
  if (!contenedor) return;

  try {
    const snapshot = await getDocs(collection(db, "productos"));
    contenedor.innerHTML = '';

    if (snapshot.empty) {
      contenedor.innerHTML = '<p style="text-align:center; width:100%;">No hay productos registrados en el catálogo.</p>';
      return;
    }

    snapshot.forEach(docSnap => {
      const producto = docSnap.data();
      const div = document.createElement('div');
      div.classList.add('producto');
      div.dataset.categoria = producto.categoria || '';
      div.dataset.nombre = producto.nombre || '';
      div.dataset.id = docSnap.id;

      const stockTotal = (producto.stock === null || producto.stock === undefined) ? null : Number(producto.stock);
      div.dataset.stock = stockTotal === null ? '' : stockTotal;

      let cuerpoTarjetaHTML = '';
      const agotado = stockTotal !== null && stockTotal <= 0;

      const esGranelPorCategoria = producto.categoria !== 'envases';
      const unidadGranel = producto.categoria === 'polvos' ? 'g' : 'ml';
      const esNuevoModelo = producto.tipo_venta !== undefined;

      if (esGranelPorCategoria) {
        const presentaciones = producto.presentaciones || [];
        const pres1000 = presentaciones.find(p => Number(p.equivalencia) === 1000);
        const precioMil = pres1000 ? Number(pres1000.precio) : (Number(producto.precio_base) * 1000 || 0);
        const minCantidad = Number(producto.cantidad_minima) || 125;

        const presMin = presentaciones.find(p => Number(p.equivalencia) === minCantidad);
        const subtotalInicial = presMin ? Number(presMin.precio) : Math.round((minCantidad / 1000) * precioMil);

        div.dataset.tipoVenta = 'granel';
        div.dataset.precioMil = precioMil;
        div.dataset.unidadMedida = unidadGranel;
        div.dataset.presentaciones = JSON.stringify(presentaciones);

        const opcionesPreset = [1000, 500, 250, 125].filter(val => val >= minCantidad);
        const botonesPresetsHTML = opcionesPreset.map(val => `
          <button type="button" class="btn-preset ${val === minCantidad ? 'activo' : ''}" data-valor="${val}" ${agotado ? 'disabled' : ''}>
            ${val}${unidadGranel}
          </button>
        `).join('');

        cuerpoTarjetaHTML = `
          <div class="precio-referencia">
            <span>Precio base: <strong>1000 ${unidadGranel} = $${precioMil.toLocaleString('es-CO')}</strong></span>
          </div>

          <div class="seccion-seleccion-granel">
            <label class="label-seccion">Selecciona la cantidad:</label>
            <div class="contenedor-presets">
              ${botonesPresetsHTML}
            </div>
            
            <div class="input-custom-group">
              <label for="cant-${docSnap.id}">O escribe otra cantidad (${unidadGranel}):</label>
              <input type="number" id="cant-${docSnap.id}" class="cantidad" value="${minCantidad}" min="1" step="1" placeholder="Ej: 100" ${agotado ? 'disabled' : ''}>
            </div>
          </div>

          <div class="subtotal-card-box">
            <span class="subtotal-label">Subtotal a pagar</span>
            <div class="precio-total-dinamico">$${subtotalInicial.toLocaleString('es-CO')}</div>
          </div>

          <button class="btn-agregar-carrito" ${agotado ? 'disabled' : ''}>${agotado ? 'Agotado' : 'Agregar al carrito'}</button>
        `;

      } else if (esNuevoModelo) {
        const precioNum = Number(producto.precio_base) || 0;
        const minCantidad = Number(producto.cantidad_minima) || 1;

        div.dataset.tipoVenta = producto.tipo_venta;
        div.dataset.precio = precioNum;
        div.dataset.unidadMedida = 'und';

        cuerpoTarjetaHTML = `
          <div class="precio-referencia">
            <span>Precio unitario: <strong>$${precioNum.toLocaleString('es-CO')}</strong></span>
          </div>

          <div class="input-custom-group margin-v">
            <label>Cantidad (Unidades):</label>
            <input type="number" class="cantidad" value="${minCantidad}" min="${minCantidad}" step="1" ${agotado ? 'disabled' : ''}>
          </div>

          <div class="subtotal-card-box">
            <span class="subtotal-label">Subtotal a pagar</span>
            <div class="precio-total-dinamico">$${(precioNum * minCantidad).toLocaleString('es-CO')}</div>
          </div>

          <button class="btn-agregar-carrito" ${agotado ? 'disabled' : ''}>${agotado ? 'Agotado' : 'Agregar al carrito'}</button>
        `;

      } else {
        const presentaciones = producto.presentaciones || [];
        if (presentaciones.length === 1 && presentaciones[0].nombre === 'Unidad') {
          const precioNum = Number(presentaciones[0].precio) || 0;
          div.dataset.precio = precioNum;
          div.dataset.equivalencia = Number(presentaciones[0].equivalencia) || 1;

          cuerpoTarjetaHTML = `
            <div class="precio-referencia">
              <span>Precio: <strong>$${precioNum.toLocaleString('es-CO')}</strong></span>
            </div>

            <div class="input-custom-group margin-v">
              <label>Cantidad:</label>
              <input type="number" class="cantidad" value="1" min="1" ${agotado ? 'disabled' : ''}>
            </div>

            <div class="subtotal-card-box">
              <span class="subtotal-label">Subtotal a pagar</span>
              <div class="precio-total-dinamico">$${precioNum.toLocaleString('es-CO')}</div>
            </div>

            <button class="btn-agregar-carrito" ${agotado ? 'disabled' : ''}>${agotado ? 'Agotado' : 'Agregar al carrito'}</button>
          `;
        } else {
          const opciones = presentaciones.map((p, i) => {
            const seleccionada = i === presentaciones.length - 1 ? 'selected' : '';
            const precioNum = Number(p.precio) || 0;
            const equivalencia = Number(p.equivalencia) || 1;
            let sufijo = stockTotal !== null ? ` (${Math.floor(stockTotal / equivalencia)} disp.)` : '';
            return `<option value="${p.nombre}" data-precio="${precioNum}" data-equivalencia="${equivalencia}" ${seleccionada}>${p.nombre} - $${precioNum.toLocaleString('es-CO')}${sufijo}</option>`;
          }).join('');

          const ultimaPres = presentaciones[presentaciones.length - 1];
          const precioInicial = Number(ultimaPres?.precio) || 0;

          cuerpoTarjetaHTML = `
            <div class="input-custom-group margin-v">
              <label>Presentación:</label>
              <select class="presentacion select-estilizado">${opciones}</select>
            </div>

            <div class="input-custom-group margin-v">
              <label>Cantidad:</label>
              <input type="number" class="cantidad" value="1" min="1" ${agotado ? 'disabled' : ''}>
            </div>

            <div class="subtotal-card-box">
              <span class="subtotal-label">Subtotal a pagar</span>
              <div class="precio-total-dinamico">$${precioInicial.toLocaleString('es-CO')}</div>
            </div>

            <button class="btn-agregar-carrito" ${agotado ? 'disabled' : ''}>${agotado ? 'Agotado' : 'Agregar al carrito'}</button>
          `;
        }
      }

      div.innerHTML = `
        <div class="producto-imagen-wrap">
          <span class="badge-categoria badge-${producto.categoria}">${producto.categoria || ''}</span>
          ${agotado ? '<span class="badge-agotado">Agotado</span>' : ''}
          ${producto.imagen
            ? `<img src="${producto.imagen}" alt="${producto.nombre || ''}" class="producto-img" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('div'),{className:'producto-img producto-img-placeholder',innerHTML:'📦'}));">`
            : `<div class="producto-img producto-img-placeholder">📦</div>`}
        </div>
        <h3>${producto.nombre || ''}</h3>
        <p class="producto-descripcion">${producto.descripcion || ''}</p>
        ${cuerpoTarjetaHTML}
      `;

      if (agotado) div.classList.add('agotado');
      contenedor.appendChild(div);
    });

    inicializarEventosProductos();

  } catch (error) {
    contenedor.innerHTML = `<p style="color:red; text-align:center;">Error cargando productos: ${error.message}</p>`;
    console.error("Error al obtener los productos desde Firebase:", error);
  }
}

// ==========================================================
// FILTROS DE CATEGORÍA
// ==========================================================

const botonesFiltro = document.querySelectorAll('.btn-filtro');

botonesFiltro.forEach(boton => {
  boton.addEventListener('click', () => {
    botonesFiltro.forEach(b => b.classList.remove('activo'));
    boton.classList.add('activo');

    const categoria = boton.dataset.categoria;
    const productos = document.querySelectorAll('.producto');

    productos.forEach(producto => {
      if (categoria === 'todos' || producto.dataset.categoria === categoria) {
        producto.classList.remove('oculto');
      } else {
        producto.classList.add('oculto');
      }
    });
  });
});

// ==========================================================
// CONTROL DEL MODAL Y ELEMENTOS DEL CARRITO
// ==========================================================

if (btnAbrirCarrito) {
  btnAbrirCarrito.addEventListener('click', () => modalCarrito.classList.remove('oculto-modal'));
}

if (btnCerrarCarrito) {
  btnCerrarCarrito.addEventListener('click', () => modalCarrito.classList.add('oculto-modal'));
}

if (btnVaciarCarrito) {
  btnVaciarCarrito.addEventListener('click', () => {
    if (carrito.length === 0) return;
    if (confirm('¿Estás seguro de que deseas vaciar todo el carrito?')) {
      carrito = [];
      actualizarCarrito();
    }
  });
}

if (modalCarrito) {
  modalCarrito.addEventListener('click', (e) => {
    if (e.target === modalCarrito) modalCarrito.classList.add('oculto-modal');
  });
}

radiosEnvio.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.value === 'Sí' && radio.checked) {
      inputDireccion.classList.remove('oculto');
    } else if (radio.value === 'No' && radio.checked) {
      inputDireccion.classList.add('oculto');
    }
  });
});

// ==========================================================
// LÍMITE DE CANTIDAD Y ACTUALIZACIÓN DINÁMICA
// ==========================================================

function actualizarMaxCantidad(productoDiv) {
  const inputCantidad = productoDiv.querySelector('.cantidad');
  if (!inputCantidad) return;

  const stockTotalTxt = productoDiv.dataset.stock;

  if (stockTotalTxt === '' || stockTotalTxt === undefined) {
    inputCantidad.removeAttribute('max');
    return;
  }

  const stockTotal = Number(stockTotalTxt);
  let maxUnidades;

  if (productoDiv.dataset.tipoVenta === 'granel' || productoDiv.dataset.tipoVenta === 'unidad') {
    maxUnidades = stockTotal;
  } else {
    const select = productoDiv.querySelector('.presentacion');
    const equivalencia = select ? Number(select.options[select.selectedIndex]?.dataset.equivalencia) || 1 : Number(productoDiv.dataset.equivalencia) || 1;
    maxUnidades = Math.floor(stockTotal / equivalencia);
  }

  inputCantidad.max = maxUnidades;
  const minPermitido = Number(inputCantidad.min) || 1;
  if (parseInt(inputCantidad.value) > maxUnidades) {
    inputCantidad.value = maxUnidades >= minPermitido ? maxUnidades : minPermitido;
  }
}

function recalcularSubtotalTarjeta(productoDiv) {
  const precioTotalDinamico = productoDiv.querySelector('.precio-total-dinamico');
  const inputCant = productoDiv.querySelector('.cantidad');
  if (!precioTotalDinamico || !inputCant) return;

  const cant = Math.max(0, parseInt(inputCant.value) || 0);

  if (productoDiv.dataset.tipoVenta === 'granel') {
    const precioMil = Number(productoDiv.dataset.precioMil) || 0;
    let presentaciones = [];

    try {
      presentaciones = JSON.parse(productoDiv.dataset.presentaciones || '[]');
    } catch (e) {}

    const presExacta = presentaciones.find(p => Number(p.equivalencia) === cant);
    let subtotal = presExacta ? Number(presExacta.precio) : Math.round((cant / 1000) * precioMil);
    precioTotalDinamico.textContent = `$${subtotal.toLocaleString('es-CO')}`;

  } else {
    const selectPresentacion = productoDiv.querySelector('.presentacion');
    let precioUnitario = selectPresentacion
      ? Number(selectPresentacion.options[selectPresentacion.selectedIndex]?.dataset.precio) || 0
      : Number(productoDiv.dataset.precio) || 0;

    const subtotal = Math.round(precioUnitario * cant);
    precioTotalDinamico.textContent = `$${subtotal.toLocaleString('es-CO')}`;
  }
}

// ==========================================================
// EVENTOS DE BOTONES Y CAMPO DE TEXTO
// ==========================================================

function inicializarEventosProductos() {
  document.querySelectorAll('.producto').forEach(productoDiv => {
    actualizarMaxCantidad(productoDiv);

    const select = productoDiv.querySelector('.presentacion');
    if (select) {
      select.addEventListener('change', () => {
        actualizarMaxCantidad(productoDiv);
        recalcularSubtotalTarjeta(productoDiv);
      });
    }

    const inputCant = productoDiv.querySelector('.cantidad');
    const botonesPreset = productoDiv.querySelectorAll('.btn-preset');

    if (botonesPreset.length > 0 && inputCant) {
      botonesPreset.forEach(btn => {
        btn.addEventListener('click', () => {
          const valor = btn.dataset.valor;
          inputCant.value = valor;

          botonesPreset.forEach(b => b.classList.remove('activo'));
          btn.classList.add('activo');

          recalcularSubtotalTarjeta(productoDiv);
        });
      });
    }

    if (inputCant) {
      inputCant.addEventListener('input', () => {
        const valIngresado = Number(inputCant.value);

        if (botonesPreset.length > 0) {
          botonesPreset.forEach(btn => {
            if (Number(btn.dataset.valor) === valIngresado) {
              btn.classList.add('activo');
            } else {
              btn.classList.remove('activo');
            }
          });
        }

        recalcularSubtotalTarjeta(productoDiv);
      });
    }
  });

  document.querySelectorAll('.btn-agregar-carrito').forEach(boton => {
    boton.addEventListener('click', () => {
      const productoDiv = boton.closest('.producto');
      const cantidadInput = productoDiv.querySelector('.cantidad');
      const cantidad = parseInt(cantidadInput.value) || 1;

      let nombre = productoDiv.dataset.nombre;
      let precio, presentacionNombre, unidadMedida, tipoVenta;

      if (productoDiv.dataset.tipoVenta === 'granel') {
        tipoVenta = 'granel';
        unidadMedida = productoDiv.dataset.unidadMedida;
        presentacionNombre = 'Granel';

        const precioMil = Number(productoDiv.dataset.precioMil) || 0;
        let presentaciones = [];

        try {
          presentaciones = JSON.parse(productoDiv.dataset.presentaciones || '[]');
        } catch (e) {}

        const presExacta = presentaciones.find(p => Number(p.equivalencia) === cantidad);
        let subtotalCalculado = presExacta ? Number(presExacta.precio) : Math.round((cantidad / 1000) * precioMil);

        precio = cantidad > 0 ? (subtotalCalculado / cantidad) : 0;

      } else if (productoDiv.dataset.tipoVenta !== undefined) {
        tipoVenta = productoDiv.dataset.tipoVenta;
        precio = Number(productoDiv.dataset.precio);
        unidadMedida = 'und';
        presentacionNombre = 'Unidad';
      } else {
        const selectPresentacion = productoDiv.querySelector('.presentacion');
        if (selectPresentacion) {
          const opcion = selectPresentacion.options[selectPresentacion.selectedIndex];
          nombre = `${productoDiv.dataset.nombre} (${opcion.value})`;
          precio = parseInt(opcion.dataset.precio);
          presentacionNombre = opcion.value;
        } else {
          precio = parseInt(productoDiv.dataset.precio);
          presentacionNombre = 'Unidad';
        }
        unidadMedida = 'und';
        tipoVenta = 'legacy';
      }

      if (isNaN(precio)) {
        console.error(`No se pudo obtener el precio para: ${nombre}`);
        return;
      }

      const productoId = productoDiv.dataset.id;
      const productoExistente = carrito.find(item => item.nombre === nombre);

      if (productoExistente) {
        productoExistente.cantidad += cantidad;
      } else {
        carrito.push({ nombre, precio, cantidad, productoId, presentacionNombre, unidadMedida, tipoVenta });
      }

      actualizarCarrito();
    });
  });

  document.querySelectorAll('.producto-img').forEach(imagen => {
    imagen.addEventListener('click', () => {
      if (modalZoom && zoomImagenActual) {
        zoomImagenActual.src = imagen.src;
        modalZoom.classList.remove('oculto-modal');
      }
    });
  });
}

// ==========================================================
// ACTUALIZAR CARRITO
// ==========================================================

function actualizarCarrito() {
  if (!listaCarrito) return;

  listaCarrito.innerHTML = '';
  let total = 0;

  carrito.forEach((item, index) => {
    const subtotal = Math.round(item.precio * item.cantidad);
    total += subtotal;

    const li = document.createElement('li');
    li.classList.add('item-carrito');
    const unidadVisual = item.unidadMedida ? item.unidadMedida : 'und';

    li.innerHTML = `
      <div class="item-cantidad-control">
        <button class="btn-restar" aria-label="Restar cantidad">−</button>
        <span class="item-cantidad">${item.cantidad} ${unidadVisual}</span>
        <button class="btn-sumar" aria-label="Sumar cantidad">+</button>
      </div>
      <span class="item-nombre">${item.nombre}</span>
      <span class="item-subtotal">$${subtotal.toLocaleString('es-CO')}</span>
      <button class="btn-eliminar" aria-label="Eliminar producto">✕</button>
    `;

    li.querySelector('.btn-eliminar').addEventListener('click', () => {
      carrito.splice(index, 1);
      actualizarCarrito();
    });

    li.querySelector('.btn-sumar').addEventListener('click', () => {
      carrito[index].cantidad += 1;
      actualizarCarrito();
    });

    li.querySelector('.btn-restar').addEventListener('click', () => {
      if (carrito[index].cantidad > 1) {
        carrito[index].cantidad -= 1;
      } else {
        carrito.splice(index, 1);
      }
      actualizarCarrito();
    });

    listaCarrito.appendChild(li);
  });

  if (subtotalCarrito) {
    subtotalCarrito.textContent = `Subtotal: $${Math.round(total).toLocaleString('es-CO')}`;
  }

  if (totalCarrito) {
    totalCarrito.textContent = `Total: $${Math.round(total).toLocaleString('es-CO')}`;
  }

  if (contadorCarrito) {
    const totalUnidades = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    contadorCarrito.textContent = totalUnidades;
  }

  localStorage.setItem('carrito', JSON.stringify(carrito));
}

// ==========================================================
// VERIFICAR Y DESCONTAR STOCK
// ==========================================================

async function verificarYDescontarStock(itemsCarrito) {
  for (const item of itemsCarrito) {
    if (!item.productoId) continue;
    const snap = await getDoc(doc(db, 'productos', item.productoId));
    if (!snap.exists()) continue;

    const data = snap.data();
    if (data.stock === null || data.stock === undefined) continue;

    let cantidadARestar = (item.tipoVenta === 'granel' || item.tipoVenta === 'unidad')
      ? item.cantidad
      : item.cantidad * ((data.presentaciones || []).find(p => p.nombre === item.presentacionNombre)?.equivalencia || 1);

    if (Number(data.stock) < cantidadARestar) {
      throw new Error(`No hay suficiente stock de "${item.nombre}". Ajusta la cantidad.`);
    }
  }

  for (const item of itemsCarrito) {
    if (!item.productoId) continue;
    const refProducto = doc(db, 'productos', item.productoId);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(refProducto);
      if (!snap.exists()) return;

      const data = snap.data();
      if (data.stock === null || data.stock === undefined) return;

      let cantidadARestar = (item.tipoVenta === 'granel' || item.tipoVenta === 'unidad')
        ? item.cantidad
        : item.cantidad * ((data.presentaciones || []).find(p => p.nombre === item.presentacionNombre)?.equivalencia || 1);

      const nuevoStock = Math.max(0, Number(data.stock) - cantidadARestar);
      transaction.update(refProducto, { stock: nuevoStock });
    });
  }
}

// ==========================================================
// ENVIAR A WHATSAPP
// ==========================================================

if (btnEnviarPedido) {
  btnEnviarPedido.addEventListener('click', async () => {
    if (carrito.length === 0) {
      alert('Tu carrito está vacío. Agrega productos antes de enviar.');
      return;
    }

    const requiereDomicilio = document.querySelector('input[name="tipoEnvio"]:checked').value;

    if (requiereDomicilio === 'Sí' && inputDireccion.value.trim() === '') {
      alert('Por favor escribe la dirección para el domicilio.');
      return;
    }

    try {
      await verificarYDescontarStock(carrito);
    } catch (error) {
      alert(error.message);
      return;
    }

    const fecha = new Date().toLocaleDateString('es-CO');
    const hora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    let mensaje = '```==============================```%0A';
    mensaje += '*QUIMIASEO Y PERFUMERIA DEL CARIBE*%0A';
    mensaje += '```    COMPROBANTE DE PEDIDO     ```%0A';
    mensaje += `\`\`\`Fecha: ${fecha} | ${hora}\`\`\`%0A`;
    mensaje += '```==============================```%0A%0A';
    mensaje += 'Hola, quiero realizar el siguiente pedido:%0A%0A';

    carrito.forEach(item => {
      const subtotal = Math.round(item.precio * item.cantidad);
      const unidad = item.unidadMedida ? item.unidadMedida : 'und';
      mensaje += `*${item.cantidad} ${unidad} x* ${item.nombre} - *$${subtotal.toLocaleString('es-CO')}*%0A`;
    });

    const total = carrito.reduce((sum, item) => sum + Math.round(item.precio * item.cantidad), 0);

    mensaje += '%0A```==============================```%0A';
    mensaje += `*¿Requiere domicilio?:* ${requiereDomicilio}%0A`;

    if (requiereDomicilio === 'Sí') {
      mensaje += `*Dirección:* ${inputDireccion.value.trim()}%0A`;
    }

    mensaje += `*TOTAL A PAGAR:* $${total.toLocaleString('es-CO')}%0A`;
    mensaje += '```==============================```%0A';
    mensaje += '_(El valor final con domicilio será confirmado por el vendedor)_';

    window.open(`https://wa.me/${NUMERO_WHATSAPP}?text=${mensaje}`, '_blank');

    carrito = [];
    actualizarCarrito();
    cargarProductos();
  });
}

// ==========================================================
// ZOOM Y CARGA INICIAL
// ==========================================================

if (modalZoom) {
  modalZoom.addEventListener('click', () => modalZoom.classList.add('oculto-modal'));
}

cargarProductos();
actualizarCarrito();