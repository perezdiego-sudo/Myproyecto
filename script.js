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

// CARRITO Y WHATSAPP
const NUMERO_WHATSAPP = "573136375152";

let carrito = [];

const botonesAgregar = document.querySelectorAll('.btn-agregar-carrito');
const listaCarrito = document.getElementById('lista-carrito');
const totalCarrito = document.getElementById('total-carrito');
const btnEnviarPedido = document.getElementById('btn-enviar-pedido');

botonesAgregar.forEach(boton => {
  boton.addEventListener('click', () => {
    const productoDiv = boton.closest('.producto');
    
    // CORRECCIÓN AQUÍ: Busca selectores con la clase 'presentacion' O 'talla'
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

    // Validación por si falta algún precio
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

// Actualizar carrito //


function actualizarCarrito() {
  listaCarrito.innerHTML = '';
  let total = 0;

  carrito.forEach((item, index) => {
    const subtotal = item.precio * item.cantidad;
    total += subtotal;

    const li = document.createElement('li');
    li.classList.add('item-carrito'); // Importante para que tome los estilos CSS de la grilla

    // Separamos la cantidad, el nombre y el subtotal en spans independientes
    li.innerHTML = `
      <span class="item-cantidad">${item.cantidad}x</span>
      <span class="item-nombre">${item.nombre}</span>
      <span class="item-subtotal">$${subtotal.toLocaleString('es-CO')}</span>
      <button class="btn-eliminar">✕</button>
    `;

    // Evento para eliminar el producto
    li.querySelector('.btn-eliminar').addEventListener('click', () => {
      carrito.splice(index, 1);
      actualizarCarrito();
    });

    listaCarrito.appendChild(li);
  });

  totalCarrito.textContent = `Total: $${total.toLocaleString('es-CO')}`;
  localStorage.setItem('carrito', JSON.stringify(carrito));
}

btnEnviarPedido.addEventListener('click', () => {
  if (carrito.length === 0) {
    alert('Tu carrito está vacío. Agrega productos antes de enviar.');
    return;
  }

  // Encabezado y saludo personalizado
  let mensaje = 'Hola, Químicos de la Sabana, quiero realizar el siguiente pedido:%0A%0A';


  // Productos con precio al lado del nombre
  carrito.forEach(item => {
    const subtotal = item.precio * item.cantidad;
    mensaje += `*${item.cantidad}x* ${item.nombre} - *$${subtotal.toLocaleString('es-CO')}*%0A`;
  });

  // Total acumulado
  const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  mensaje += `%0A💰 *Total: $${total.toLocaleString('es-CO')}*`;

  // Enviar a WhatsApp
  const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${mensaje}`;
  window.open(url, '_blank');
});