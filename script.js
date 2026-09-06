import { db } from "./firebase_config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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

      const presentaciones = producto.presentaciones || [];
      let selectorHTML = '';

      if (presentaciones.length === 1 && presentaciones[0].nombre === 'Unidad') {
        // Producto de precio único (sin desplegable)
        const precioNum = Number(presentaciones[0].precio) || 0;
        div.dataset.precio = precioNum;
        selectorHTML = `<span class="precio">$${precioNum.toLocaleString('es-CO')}</span>`;
      } else if (presentaciones.length > 0) {
        // Producto con varias presentaciones (con desplegable)
        const opciones = presentaciones.map((p, i) => {
          const seleccionada = i === presentaciones.length - 1 ? 'selected' : '';
          const precioNum = Number(p.precio) || 0;
          return `<option value="${p.nombre}" data-precio="${precioNum}" ${seleccionada}>${p.nombre} - $${precioNum.toLocaleString('es-CO')}</option>`;
        }).join('');
        selectorHTML = `<select class="presentacion">${opciones}</select>`;
      }

      div.innerHTML = `
  <div class="producto-imagen-wrap">
    <span class="badge-categoria badge-${producto.categoria}">${producto.categoria || ''}</span>
    <img src="${producto.imagen || ''}" alt="${producto.nombre || ''}" class="producto-img">
  </div>
  <h3>${producto.nombre || ''}</h3>
  <p>${producto.descripcion || ''}</p>
  ${selectorHTML}
  <div class="control-cantidad">
    <input type="number" class="cantidad" value="1" min="1">
    <button class="btn-agregar-carrito">Agregar al carrito</button>
  </div>

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

function inicializarEventosProductos() {
  // Botones "Agregar al carrito"
  document.querySelectorAll('.btn-agregar-carrito').forEach(boton => {
    boton.addEventListener('click', () => {
      const productoDiv = boton.closest('.producto');

      const selectPresentacion = productoDiv.querySelector('.presentacion, .talla');
      const cantidadInput = productoDiv.querySelector('.cantidad');
      const cantidad = parseInt(cantidadInput.value) || 1;

      let nombre;
      let precio;

      if (selectPresentacion) {
        const opcionSeleccionada = selectPresentacion.options[selectPresentacion.selectedIndex];
        nombre = `${productoDiv.dataset.nombre} (${opcionSeleccionada.value})`;
        precio = parseInt(opcionSeleccionada.dataset.precio);
      } else {
        nombre = productoDiv.dataset.nombre;
        precio = parseInt(productoDiv.dataset.precio);
      }

      if (isNaN(precio)) {
        console.error(`No se pudo obtener el precio para: ${nombre}`);
        return;
      }

      const productoExistente = carrito.find(item => item.nombre === nombre);

      if (productoExistente) {
        productoExistente.cantidad += cantidad;
      } else {
        carrito.push({ nombre, precio, cantidad });
      }

      actualizarCarrito();
    });
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

// ==========================================================
// ENVIAR A WHATSAPP
// ==========================================================

if (btnEnviarPedido) {
  btnEnviarPedido.addEventListener('click', () => {
    if (carrito.length === 0) {
      alert('Tu carrito está vacío. Agrega productos antes de enviar.');
      return;
    }

    const requiereDomicilio = document.querySelector('input[name="tipoEnvio"]:checked').value;

    if (requiereDomicilio === 'Sí' && inputDireccion.value.trim() === '') {
      alert('Por favor escribe la dirección para el domicilio.');
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
      const esEnvase = item.nombre.toLowerCase().includes('envase');
      const prefijoCantidad = esEnvase ? `${item.cantidad} und x` : `${item.cantidad}x`;

      mensaje += `*${prefijoCantidad}* ${item.nombre} - *$${subtotal.toLocaleString('es-CO')}*%0A`;
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