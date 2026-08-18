// FILTROS DE CATEGORÍA
const botonesFiltro = document.querySelectorAll('.btn-filtro');
const productos = document.querySelectorAll('.producto');

botonesFiltro.forEach(boton => {
  boton.addEventListener('click', () => {
    botonesFiltro.forEach(b => b.classList.remove('activo'));
    boton.classList.add('activo');

    const categoria = boton.dataset.categoria;

    productos.forEach(producto => {
      if (categoria === 'todos' || producto.dataset.categoria === categoria) {
        producto.classList.remove('oculto');
      } else {
        producto.classList.add('oculto');
      }
    });
  });
});

// CONTROL DEL MODAL Y ELEMENTOS DEL CARRITO
const modalCarrito = document.getElementById('modal-carrito');
const btnAbrirCarrito = document.getElementById('btn-abrir-carrito');
const btnCerrarCarrito = document.getElementById('btn-cerrar-carrito');
const btnVaciarCarrito = document.getElementById('btn-vaciar-carrito');
const contadorCarrito = document.getElementById('contador-carrito');

const NUMERO_WHATSAPP = "573136375152";

// Cargar carrito previo desde localStorage
let carrito = JSON.parse(localStorage.getItem('carrito')) || [];

const botonesAgregar = document.querySelectorAll('.btn-agregar-carrito');
const listaCarrito = document.getElementById('lista-carrito');
const totalCarrito = document.getElementById('total-carrito');
const btnEnviarPedido = document.getElementById('btn-enviar-pedido');

// Eventos para abrir/cerrar la ventana modal
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

// Evento para vaciar/borrar todo el carrito
if (btnVaciarCarrito) {
  btnVaciarCarrito.addEventListener('click', () => {
    if (carrito.length === 0) return;

    if (confirm('¿Estás seguro de que deseas vaciar todo el carrito?')) {
      carrito = [];
      actualizarCarrito();
    }
  });
}

// Cerrar el modal si el cliente toca fuera de la ventana
if (modalCarrito) {
  modalCarrito.addEventListener('click', (e) => {
    if (e.target === modalCarrito) {
      modalCarrito.classList.add('oculto-modal');
    }
  });
}

// Renderizar carrito si ya tenía items al abrir la página
document.addEventListener('DOMContentLoaded', actualizarCarrito);

botonesAgregar.forEach(boton => {
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

// Actualizar vista del carrito, contador flotante y guardar en localStorage
function actualizarCarrito() {
  listaCarrito.innerHTML = '';
  let total = 0;

  carrito.forEach((item, index) => {
    const subtotal = item.precio * item.cantidad;
    total += subtotal;

    const li = document.createElement('li');
    li.classList.add('item-carrito');

    li.innerHTML = `
      <span class="item-cantidad">${item.cantidad}x</span>
      <span class="item-nombre">${item.nombre}</span>
      <span class="item-subtotal">$${subtotal.toLocaleString('es-CO')}</span>
      <button class="btn-eliminar" aria-label="Eliminar producto">✕</button>
    `;

    li.querySelector('.btn-eliminar').addEventListener('click', () => {
      carrito.splice(index, 1);
      actualizarCarrito();
    });

    listaCarrito.appendChild(li);
  });

  // Actualiza el texto del total y la burbuja del botón flotante
  totalCarrito.textContent = `Total: $${total.toLocaleString('es-CO')}`;
  
  if (contadorCarrito) {
    const totalUnidades = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    contadorCarrito.textContent = totalUnidades;
  }

  localStorage.setItem('carrito', JSON.stringify(carrito));
}

// ENVIAR A WHATSAPP
btnEnviarPedido.addEventListener('click', () => {
  if (carrito.length === 0) {
    alert('Tu carrito está vacío. Agrega productos antes de enviar.');
    return;
  }

  const requiereDomicilio = document.querySelector('input[name="tipoEnvio"]:checked').value;
  
  const fecha = new Date().toLocaleDateString('es-CO');
  const hora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  let mensaje = '```==============================```%0A';
  mensaje += '*QUÍMICOS DE LA SABANA*%0A';
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
  mensaje += `*TOTAL A PAGAR:* $${total.toLocaleString('es-CO')}%0A`;
  mensaje += '```==============================```%0A';
  mensaje += '_(El valor final con domicilio será confirmado por el vendedor)_';

  const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${mensaje}`;
  window.open(url, '_blank');
});