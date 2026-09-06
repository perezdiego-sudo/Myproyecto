import { db } from "./firebase_config.js";
import { collection, getDocs, doc, getDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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

// Elementos del Modal Zoom
const modalZoom = document.getElementById('modal-zoom');
const zoomImagenActual = document.getElementById('zoom-imagen-actual');

const NUMERO_WHATSAPP = "573136375152";

// Cargar carrito previo desde localStorage
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

    snapshot.forEach(doc => {
      const producto = doc.data();
      const div = document.createElement('div');
      div.classList.add('producto');
      div.dataset.categoria = producto.categoria || '';
      div.dataset.nombre = producto.nombre || '';
      div.dataset.id = doc.id; 

      const presentaciones = producto.presentaciones || [];
      let selectorHTML = '';

      const stockBase = producto.stock; // stock total del producto en su unidad base (null/undefined = ilimitado)

      // Calcula cuántas unidades de una presentación concreta se pueden vender
      // a partir del stock base del producto y la equivalencia de esa presentación.
      function calcularDisponible(equivalencia) {
        if (stockBase === null || stockBase === undefined || stockBase === '') return '';
        const equiv = Number(equivalencia) || 1;
        return Math.floor(Number(stockBase) / equiv);
      }

      if (presentaciones.length === 1 && presentaciones[0].nombre === 'Unidad') {
        const disponible = calcularDisponible(presentaciones[0].equivalencia);
        const agotado = disponible !== '' && Number(disponible) <= 0;
        div.dataset.precio = Number(presentaciones[0].precio) || 0;
        div.dataset.stock = disponible;
        selectorHTML = agotado
          ? `<span class="texto-agotado">Agotado</span>`
          : `<span class="precio">$${(Number(presentaciones[0].precio) || 0).toLocaleString('es-CO')}</span>`;
      } else if (presentaciones.length > 0) {
        // Elegimos como opción por defecto la última presentación que SÍ tenga stock;
        // si todas están agotadas, se deja la última (el producto completo se marcará agotado).
        let indiceDefecto = presentaciones.length - 1;
        for (let i = presentaciones.length - 1; i >= 0; i--) {
          const disp = calcularDisponible(presentaciones[i].equivalencia);
          if (disp === '' || Number(disp) > 0) { indiceDefecto = i; break; }
        }

        const opciones = presentaciones.map((p, i) => {
          const precioNum = Number(p.precio) || 0;
          const disponible = calcularDisponible(p.equivalencia);
          const agotado = disponible !== '' && Number(disponible) <= 0;
          const seleccionada = i === indiceDefecto ? 'selected' : '';
          const disabledAttr = agotado ? 'disabled' : '';
          const stockTxt = agotado ? ' - AGOTADO' : (disponible === '' ? '' : ` (${disponible} disp.)`);
          return `<option value="${p.nombre}" data-precio="${precioNum}" data-stock="${disponible}" ${seleccionada} ${disabledAttr}>${p.nombre} - $${precioNum.toLocaleString('es-CO')}${stockTxt}</option>`;
        }).join('');
        selectorHTML = `<select class="presentacion">${opciones}</select>`;
      }

      div.innerHTML = `
  <div class="producto-imagen-wrap">
    <span class="badge-categoria badge-${producto.categoria}">${producto.categoria || ''}</span>
    <img src="${producto.imagen || 'https://placehold.co/260x140?text=Sin+imagen'}" alt="${producto.nombre || ''}" class="producto-img" onerror="this.onerror=null;this.src='https://placehold.co/260x140?text=Sin+imagen';">
  </div>
  <h3>${producto.nombre || ''}</h3>
  <p>${producto.descripcion || ''}</p>
  ${selectorHTML}
  <div class="control-cantidad">
    <input type="number" class="cantidad" value="1" min="1">
    <button class="btn-agregar-carrito">Agregar al carrito</button>
  </div>
      `;

      contenedor.appendChild(div);
    });

    // Una vez creados los productos en el HTML, conectamos sus botones e imágenes
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
// EVENTOS QUE DEPENDEN DE LOS PRODUCTOS (se re-conectan tras cargarlos)
// ==========================================================
function actualizarMaxCantidad(productoDiv) {
  const select = productoDiv.querySelector('.presentacion, .talla');
  const inputCantidad = productoDiv.querySelector('.cantidad');
  const stock = select ? select.options[select.selectedIndex].dataset.stock : productoDiv.dataset.stock;

  if (stock !== undefined && stock !== '') {
    inputCantidad.max = stock;
    if (parseInt(inputCantidad.value) > parseInt(stock)) inputCantidad.value = stock;
  } else {
    inputCantidad.removeAttribute('max');
  }
}

function actualizarEstadoAgotado(productoDiv) {
  const select = productoDiv.querySelector('.presentacion, .talla');
  const boton = productoDiv.querySelector('.btn-agregar-carrito');
  const inputCantidad = productoDiv.querySelector('.cantidad');
  const stock = select ? select.options[select.selectedIndex]?.dataset.stock : productoDiv.dataset.stock;

  const agotado = stock !== undefined && stock !== '' && Number(stock) <= 0;

  if (boton) {
    boton.disabled = agotado;
    boton.textContent = agotado ? 'Agotado' : 'Agregar al carrito';
  }
  if (inputCantidad) {
    inputCantidad.disabled = agotado;
  }
}

function inicializarEventosProductos() {
  // Botones "Agregar al carrito"
  document.querySelectorAll('.btn-agregar-carrito').forEach(boton => {
    boton.addEventListener('click', () => {
      const productoDiv = boton.closest('.producto');

      const selectPresentacion = productoDiv.querySelector('.presentacion, .talla');
      const cantidadInput = productoDiv.querySelector('.cantidad');
      let cantidad = parseInt(cantidadInput.value) || 1;

      let nombre, precio, presentacionNombre, stockDisponible;

      if (selectPresentacion) {
        const opcionSeleccionada = selectPresentacion.options[selectPresentacion.selectedIndex];
        nombre = `${productoDiv.dataset.nombre} (${opcionSeleccionada.value})`;
        precio = parseInt(opcionSeleccionada.dataset.precio);
        presentacionNombre = opcionSeleccionada.value;
        stockDisponible = opcionSeleccionada.dataset.stock;
      } else {
        nombre = productoDiv.dataset.nombre;
        precio = parseInt(productoDiv.dataset.precio);
        presentacionNombre = 'Unidad';
        stockDisponible = productoDiv.dataset.stock;
      }

      if (stockDisponible !== undefined && stockDisponible !== '') {
        const stockNum = Number(stockDisponible);
        if (stockNum <= 0) {
          alert('Este producto está agotado en esta presentación.');
          return;
        }
        if (cantidad > stockNum) {
          alert(`Solo hay ${stockNum} disponibles. Se ajustó la cantidad.`);
          cantidad = stockNum;
          cantidadInput.value = stockNum;
        }
      }

      const productoId = productoDiv.dataset.id;

      const productoExistente = carrito.find(item => item.nombre === nombre);

      if (productoExistente) {
        productoExistente.cantidad += cantidad;
      } else {
        carrito.push({ nombre, precio, cantidad, presentacionNombre, productoId });
      }

      actualizarCarrito();
    });
  });

  // Selector de presentación: actualiza el máximo permitido y si está agotada
  document.querySelectorAll('.producto').forEach(productoDiv => {
    const select = productoDiv.querySelector('.presentacion, .talla');

    // Estado inicial al cargar el producto
    actualizarMaxCantidad(productoDiv);
    actualizarEstadoAgotado(productoDiv);

    if (select) {
      select.addEventListener('change', () => {
        actualizarMaxCantidad(productoDiv);
        actualizarEstadoAgotado(productoDiv);
      });
    }
  });

  // Zoom de imagen del producto
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

    li.innerHTML = `
      <div class="item-cantidad-control">
        <button class="btn-restar" aria-label="Restar cantidad">−</button>
        <span class="item-cantidad">${item.cantidad}</span>
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



async function verificarYDescontarStock(itemsCarrito) {
  // Fase 1: verificar que haya suficiente, sin modificar nada todavía
  for (const item of itemsCarrito) {
    if (!item.productoId) continue;
    const refProducto = doc(db, 'productos', item.productoId);
    const snap = await getDoc(refProducto);
    if (!snap.exists()) continue;

    const datos = snap.data();
    const stockBase = datos.stock;
    if (stockBase === null || stockBase === undefined) continue; // ilimitado

    const presentacion = (datos.presentaciones || []).find(p => p.nombre === item.presentacionNombre);
    const equivalencia = Number(presentacion?.equivalencia) || 1;
    const necesarioEnBase = item.cantidad * equivalencia;

    if (Number(stockBase) < necesarioEnBase) {
      const disponible = Math.floor(Number(stockBase) / equivalencia);
      throw new Error(`Solo quedan ${disponible} unidades disponibles de "${item.nombre}". Ajusta la cantidad e intenta de nuevo.`);
    }
  }

  // Fase 2: descontar de verdad, un producto a la vez y de forma transaccional
  for (const item of itemsCarrito) {
    if (!item.productoId) continue;
    const refProducto = doc(db, 'productos', item.productoId);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(refProducto);
      if (!snap.exists()) return;

      const datos = snap.data();
      const stockBase = datos.stock;
      if (stockBase === null || stockBase === undefined) return; // ilimitado, no hay nada que descontar

      const presentacion = (datos.presentaciones || []).find(p => p.nombre === item.presentacionNombre);
      const equivalencia = Number(presentacion?.equivalencia) || 1;
      const necesarioEnBase = item.cantidad * equivalencia;

      const nuevoStock = Math.max(0, Number(stockBase) - necesarioEnBase);
      transaction.update(refProducto, { stock: nuevoStock });
    });
  }
}

// ==========================================================
// ENVIAR A WHATSAPP
// ==========================================================

if (btnEnviarPedido) {
  btnEnviarPedido.addEventListener('click', async() => {
    if (carrito.length === 0) {
      alert('Tu carrito está vacío. Agrega productos antes de enviar.');
      return;
    }

    const requiereDomicilio = document.querySelector('input[name="tipoEnvio"]:checked').value;

    if (requiereDomicilio === 'Sí' && inputDireccion.value.trim() === '') {
      alert('Por favor escribe la dirección para el domicilio.');
      return;
    }

    try{
      await verificarYDescontarStock(carrito);
    } catch (error) {
      alert(error.message);
      return;
    }

    const fecha = new Date().toLocaleDateString('es-CO');
    const hora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    let mensaje = '```==============================```\n';
    mensaje += '*QUIMIASEO Y PERFUMERIA DEL CARIBE*\n';
    mensaje += '```    COMPROBANTE DE PEDIDO     ```\n';
    mensaje += `\`\`\`Fecha: ${fecha} | ${hora}\`\`\`\n`;
    mensaje += '```==============================```\n\n';
    mensaje += 'Hola, quiero realizar el siguiente pedido:\n\n';

    carrito.forEach(item => {
      const subtotal = item.precio * item.cantidad;
      const esEnvase = item.nombre.toLowerCase().includes('envase');
      const prefijoCantidad = esEnvase ? `${item.cantidad} und x` : `${item.cantidad}x`;

      mensaje += `*${prefijoCantidad}* ${item.nombre} - *$${subtotal.toLocaleString('es-CO')}*\n`;
    });

    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

    mensaje += '\n```==============================```\n';
    mensaje += `*¿Requiere domicilio?:* ${requiereDomicilio}\n`;

    if (requiereDomicilio === 'Sí') {
      const direccion = inputDireccion.value.trim();
      mensaje += `*Dirección:* ${direccion}\n`;
    }

    mensaje += `*TOTAL A PAGAR:* $${total.toLocaleString('es-CO')}\n`;
    mensaje += '```==============================```\n';
    mensaje += '_(El valor final con domicilio será confirmado por el vendedor)_';

    const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
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