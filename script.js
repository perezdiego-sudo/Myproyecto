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

      let selectorHTML = '';
      let inputHTML = '';
      const agotado = stockTotal !== null && stockTotal <= 0;

      // Estas categorías siempre se venden a granel (nunca en kilo, libra
      // ni media libra), sin importar cómo haya quedado guardado el
      // producto anteriormente. Polvos se vende en gramos; el resto de
      // categorías de granel (líquidos, perfumería, aromas y sabores) en
      // mililitros.
      const esGranelPorCategoria = producto.categoria !== 'envases';
      const unidadGranel = producto.categoria === 'polvos' ? 'g' : 'ml';

      // DETECCIÓN DEL NUEVO MODELO vs MODELO VIEJO (aplica solo a Envases)
      // Si el producto tiene 'tipo_venta', es el modelo nuevo. Si no, usa tu lógica vieja (Legacy).
      const esNuevoModelo = producto.tipo_venta !== undefined;

      if (esGranelPorCategoria) {
        // Polvos -> gramos. Líquidos, Perfumería, Aromas y Sabores -> mililitros
        const precioNum = Number(producto.precio_base) || 0;
        const minCantidad = Number(producto.cantidad_minima) || 125;

        div.dataset.tipoVenta = 'granel';
        div.dataset.precio = precioNum;
        div.dataset.unidadMedida = unidadGranel;

        // Solo se muestra como referencia el precio de los 1000 g/ml.
        // El cliente escribe la cantidad exacta que quiere y el sistema
        // calcula el subtotal automáticamente (nunca kilo, libra, litro
        // ni onzas).
        const precioMil = precioNum * 1000;

        selectorHTML = `
          <div class="info-precio-dinamico">
            <span class="precio-unitario">1000 ${unidadGranel}: $${precioMil.toLocaleString('es-CO')}</span>
            <div class="precio-total-dinamico" style="font-weight:bold; margin-top:5px; color:#2c3e50;">
              Subtotal: $${(precioNum * minCantidad).toLocaleString('es-CO')}
            </div>
          </div>`;

        inputHTML = `
          <label class="label-cantidad-exacta">¿Cuántos ${unidadGranel} necesitas?</label>
          <input type="number" class="cantidad" value="${minCantidad}" min="${minCantidad}" step="1" placeholder="Ej: 1500" ${agotado ? 'disabled' : ''}>`;


      } else if (esNuevoModelo) {
        // Envases guardados con el modelo nuevo pero sin lógica de granel
        const precioNum = Number(producto.precio_base) || 0;
        const minCantidad = Number(producto.cantidad_minima) || 1;

        div.dataset.tipoVenta = producto.tipo_venta;
        div.dataset.precio = precioNum;
        div.dataset.unidadMedida = 'und';

        selectorHTML = `<span class="precio">$${precioNum.toLocaleString('es-CO')}</span>`;
        inputHTML = `<input type="number" class="cantidad" value="${minCantidad}" min="${minCantidad}" step="1" ${agotado ? 'disabled' : ''}>`;

      } else {
        // LÓGICA LEGACY (Tus productos viejos siguen funcionando igual)
        const presentaciones = producto.presentaciones || [];
        if (presentaciones.length === 1 && presentaciones[0].nombre === 'Unidad') {
          const precioNum = Number(presentaciones[0].precio) || 0;
          div.dataset.precio = precioNum;
          div.dataset.equivalencia = Number(presentaciones[0].equivalencia) || 1;
          selectorHTML = `<span class="precio">$${precioNum.toLocaleString('es-CO')}</span>`;
        } else if (presentaciones.length > 0) {
          const opciones = presentaciones.map((p, i) => {
            const seleccionada = i === presentaciones.length - 1 ? 'selected' : '';
            const precioNum = Number(p.precio) || 0;
            const equivalencia = Number(p.equivalencia) || 1;
            let sufijo = '';
            if (stockTotal !== null) {
              const disp = Math.floor(stockTotal / equivalencia);
              sufijo = ` (${disp} disp.)`;
            }
            return `<option value="${p.nombre}" data-precio="${precioNum}" data-equivalencia="${equivalencia}" ${seleccionada}>${p.nombre} - $${precioNum.toLocaleString('es-CO')}${sufijo}</option>`;
          }).join('');
          selectorHTML = `<select class="presentacion">${opciones}</select>`;
        }
        inputHTML = `<input type="number" class="cantidad" value="1" min="1" ${agotado ? 'disabled' : ''}>`;
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
        <p>${producto.descripcion || ''}</p>
        ${selectorHTML}
        <div class="control-cantidad">
          ${inputHTML}
          <button class="btn-agregar-carrito" ${agotado ? 'disabled' : ''}>${agotado ? 'Agotado' : 'Agregar al carrito'}</button>
        </div>
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
  btnAbrirCarrito.addEventListener('click', () => {
    modalCarrito.classList.remove('oculto-modal');
  });
}

if (btnCerrarCarrito) {
  btnCerrarCarrito.addEventListener('click', () => {
    modalCarrito.classList.add('oculto-modal');
  });
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
    if (e.target === modalCarrito) {
      modalCarrito.classList.add('oculto-modal');
    }
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
// LÍMITE DE CANTIDAD SEGÚN STOCK DISPONIBLE
// ==========================================================

function actualizarMaxCantidad(productoDiv) {
  const inputCantidad = productoDiv.querySelector('.cantidad');
  const stockTotalTxt = productoDiv.dataset.stock;

  if (stockTotalTxt === '' || stockTotalTxt === undefined) {
    inputCantidad.removeAttribute('max');
    return;
  }

  const stockTotal = Number(stockTotalTxt);
  let maxUnidades;

  if (productoDiv.dataset.tipoVenta === 'granel' || productoDiv.dataset.tipoVenta === 'unidad') {
    maxUnidades = stockTotal; // 1 gramo = 1 unidad de stock
  } else {
    // Legacy
    const select = productoDiv.querySelector('.presentacion, .talla');
    const equivalencia = select ? Number(select.options[select.selectedIndex].dataset.equivalencia) || 1 : Number(productoDiv.dataset.equivalencia) || 1;
    maxUnidades = Math.floor(stockTotal / equivalencia);
  }

  inputCantidad.max = maxUnidades;
  const minPermitido = Number(inputCantidad.min) || 1;
  if (parseInt(inputCantidad.value) > maxUnidades) {
    inputCantidad.value = maxUnidades >= minPermitido ? maxUnidades : minPermitido;
  }
}

// ==========================================================
// EVENTOS QUE DEPENDEN DE LOS PRODUCTOS
// ==========================================================

function inicializarEventosProductos() {
  document.querySelectorAll('.producto').forEach(productoDiv => {
    actualizarMaxCantidad(productoDiv);

    const select = productoDiv.querySelector('.presentacion, .talla');
    if (select) {
      select.addEventListener('change', () => actualizarMaxCantidad(productoDiv));
    }

    // Efecto visual de calculadora para ventas a granel
    const inputCant = productoDiv.querySelector('.cantidad');
    const precioTotalDinamico = productoDiv.querySelector('.precio-total-dinamico');
    if (precioTotalDinamico && inputCant) {
      inputCant.addEventListener('input', () => {
        let cant = parseInt(inputCant.value) || 0;
        const precioUnidad = Number(productoDiv.dataset.precio) || 0;
        precioTotalDinamico.textContent = `Subtotal: $${(cant * precioUnidad).toLocaleString('es-CO')}`;
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

      // Evaluar si es el modelo nuevo o el viejo al agregarlo al carrito
      if (productoDiv.dataset.tipoVenta !== undefined) {
        tipoVenta = productoDiv.dataset.tipoVenta;
        precio = Number(productoDiv.dataset.precio);
        unidadMedida = productoDiv.dataset.unidadMedida;
        presentacionNombre = tipoVenta === 'granel' ? 'Granel' : 'Unidad';
      } else {
        // Lógica Legacy
        const selectPresentacion = productoDiv.querySelector('.presentacion, .talla');
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
        // Guardamos también el tipoVenta y unidadMedida en el carrito
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
    const subtotal = item.precio * item.cantidad;
    total += subtotal;

    const li = document.createElement('li');
    li.classList.add('item-carrito');

    // Añadimos la unidad de medida visualmente si existe, o 'und' por defecto
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

  if (totalCarrito) {
    totalCarrito.textContent = `Total: $${total.toLocaleString('es-CO')}`;
  }

  if (contadorCarrito) {
    const totalUnidades = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    contadorCarrito.textContent = totalUnidades;
  }

  localStorage.setItem('carrito', JSON.stringify(carrito));
}

// ==========================================================
// VERIFICAR Y DESCONTAR STOCK (unidad base por producto)
// ==========================================================

async function verificarYDescontarStock(itemsCarrito) {
  // Fase 1: verificar disponibilidad
  for (const item of itemsCarrito) {
    if (!item.productoId) continue;
    const snap = await getDoc(doc(db, 'productos', item.productoId));
    if (!snap.exists()) continue;

    const data = snap.data();
    if (data.stock === null || data.stock === undefined) continue;

    let cantidadARestar = 0;
    if (item.tipoVenta === 'granel' || item.tipoVenta === 'unidad') {
      cantidadARestar = item.cantidad; // Resta directa (ej. 50g = 50 unidades de stock)
    } else {
      const presentacion = (data.presentaciones || []).find(p => p.nombre === item.presentacionNombre);
      const equivalencia = presentacion ? (Number(presentacion.equivalencia) || 1) : 1;
      cantidadARestar = item.cantidad * equivalencia;
    }

    if (Number(data.stock) < cantidadARestar) {
      throw new Error(`No hay suficiente stock de "${item.nombre}". Ajusta la cantidad.`);
    }
  }

  // Fase 2: descontar de verdad
  for (const item of itemsCarrito) {
    if (!item.productoId) continue;
    const refProducto = doc(db, 'productos', item.productoId);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(refProducto);
      if (!snap.exists()) return;

      const data = snap.data();
      if (data.stock === null || data.stock === undefined) return;

      let cantidadARestar = 0;
      if (item.tipoVenta === 'granel' || item.tipoVenta === 'unidad') {
        cantidadARestar = item.cantidad;
      } else {
        const presentacion = (data.presentaciones || []).find(p => p.nombre === item.presentacionNombre);
        const equivalencia = presentacion ? (Number(presentacion.equivalencia) || 1) : 1;
        cantidadARestar = item.cantidad * equivalencia;
      }

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
      const subtotal = item.precio * item.cantidad;
      const unidad = item.unidadMedida ? item.unidadMedida : 'und';
      
      mensaje += `*${item.cantidad} ${unidad} x* ${item.nombre} - *$${subtotal.toLocaleString('es-CO')}*%0A`;
    });

    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

    mensaje += '%0A```==============================```%0A';
    mensaje += `*¿Requiere domicilio?:* ${requiereDomicilio}%0A`;

    if (requiereDomicilio === 'Sí') {
      const direccion = inputDireccion.value.trim();
      mensaje += `*Dirección:* ${direccion}%0A`;
    }

    mensaje += `*TOTAL A PAGAR:* $${total.toLocaleString('es-CO')}%0A`;
    mensaje += '```==============================```%0A';
    mensaje += '_(El valor final con domicilio será confirmado por el vendedor)_';

    const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${mensaje}`;
    window.open(url, '_blank');

    // El stock ya se descontó, así que el carrito se vacía para evitar descuentos dobles
    carrito = [];
    actualizarCarrito();
    cargarProductos(); // recarga para reflejar el nuevo stock en pantalla
  });
}

// ==========================================================
// ZOOM DE IMAGEN
// ==========================================================

if (modalZoom) {
  modalZoom.addEventListener('click', () => {
    modalZoom.classList.add('oculto-modal');
  });
}

// ==========================================================
// INICIO: cargar productos y el carrito guardado
// ==========================================================

cargarProductos();
actualizarCarrito();