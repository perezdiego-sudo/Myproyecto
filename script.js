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

function actualizarCarrito() {
  listaCarrito.innerHTML = '';
  let total = 0;

  carrito.forEach((item, index) => {
    const subtotal = item.precio * item.cantidad;
    total += subtotal;

    const li = document.createElement('li');

    const textoSpan = document.createElement('span');
    textoSpan.textContent = `${item.cantidad}x ${item.nombre} - $${subtotal.toLocaleString('es-CO')}`;

    const btnEliminar = document.createElement('button');
    btnEliminar.textContent = '✕';
    btnEliminar.classList.add('btn-eliminar');
    btnEliminar.addEventListener('click', () => {
      carrito.splice(index, 1);
      actualizarCarrito();
    });

    li.appendChild(textoSpan);
    li.appendChild(btnEliminar);
    listaCarrito.appendChild(li);
  });

  totalCarrito.textContent = `Total: $${total.toLocaleString('es-CO')}`;
}

btnEnviarPedido.addEventListener('click', () => {
  if (carrito.length === 0) {
    alert('Tu carrito está vacío. Agrega productos antes de hacer el pedido.');
    return;
  }

  let mensaje = 'Hola Quimicos de la sabana, quiero realizar el siguiente pedido:%0A%0A';

  carrito.forEach(item => {
    mensaje += `- ${item.cantidad}x ${item.nombre}%0A`;
  });

  const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  mensaje += `%0ATotal: $${total.toLocaleString('es-CO')}`;

  const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${mensaje}`;
  window.open(url, '_blank');
});