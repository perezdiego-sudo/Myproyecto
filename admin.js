// IMPORTACIÓN DE FIREBASE (Asegúrate de tener tu archivo firebase-config.js o tus credenciales)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// REEMPLAZA ESTE OBJETO CON TU CONFIGURACIÓN DE FIREBASE SI LO TIENES EN OTRO LADO
const firebaseConfig = {
  apiKey: "AIzaSyB5iP0E5BVu0XX0bclE-0j1ym24GRbYDNQ",
  authDomain: "quimiaseo-caribe.firebaseapp.com",
  databaseURL: "https://quimiaseo-caribe-default-rtdb.firebaseio.com",
  projectId: "quimiaseo-caribe",
  storageBucket: "quimiaseo-caribe.firebasestorage.app",
  messagingSenderId: "673921871746",
  appId: "1:673921871746:web:7b2203db138de8edf0a99b",
  measurementId: "G-MRCXCVJS84"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ELEMENTOS DEL DOM
const vistaLogin = document.getElementById('vista-login');
const vistaAdmin = document.getElementById('vista-admin');
const formLogin = document.getElementById('form-login');
const userEmailSpan = document.getElementById('user-email');
const btnLogout = document.getElementById('btn-logout');

const kpiTotal = document.getElementById('kpi-total');
const kpiStock = document.getElementById('kpi-stock');

const formProducto = document.getElementById('form-producto');
const productoIdInput = document.getElementById('producto-id');
const nombreInput = document.getElementById('nombre');
const categoriaInput = document.getElementById('categoria');
const stockInput = document.getElementById('stock');
const descripcionInput = document.getElementById('descripcion');
const imagenInput = document.getElementById('imagen');
const imgPreview = document.getElementById('img-preview');
const previewPlaceholder = document.getElementById('preview-placeholder');
const contenedorPresentaciones = document.getElementById('contenedor-presentaciones');
const btnAgregarPresentacion = document.getElementById('btn-agregar-presentacion');
const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion');
const tituloForm = document.getElementById('titulo-form');

const tablaBody = document.getElementById('tabla-body');
const inputBuscar = document.getElementById('input-buscar');
const filtroCategoria = document.getElementById('filtro-tabla-categoria');

let todosLosProductos = [];

// AUTENTICACIÓN
onAuthStateChanged(auth, (user) => {
  if (user) {
    vistaLogin.classList.add('oculto');
    vistaAdmin.classList.remove('oculto');
    userEmailSpan.textContent = user.email;
    cargarProductos();
  } else {
    vistaLogin.classList.remove('oculto');
    vistaAdmin.classList.add('oculto');
  }
});

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    mostrarToast('Sesión iniciada con éxito', 'exito');
  } catch (err) {
    mostrarToast('Credenciales incorrectas: ' + err.message, 'error');
  }
});

btnLogout.addEventListener('click', () => {
  signOut(auth);
  mostrarToast('Sesión cerrada', 'exito');
});

// GESTIÓN DE PRESENTACIONES EN EL FORMULARIO
btnAgregarPresentacion.addEventListener('click', () => agregarFilaPresentacion());

function agregarFilaPresentacion(nombre = '', precio = '') {
  const row = document.createElement('div');
  row.className = 'presentacion-row';
  row.innerHTML = `
    <input type="text" class="pres-nombre" placeholder="Medida (ej: 1 Litro, Galón)" value="${nombre}" required>
    <input type="number" class="pres-precio" placeholder="Precio ($)" value="${precio}" min="0" step="any" required>
    <button type="button" class="btn-eliminar"><i class="fa-solid fa-trash"></i></button>
  `;

  row.querySelector('.btn-eliminar').addEventListener('click', () => {
    if (contenedorPresentaciones.children.length > 1) {
      row.remove();
    } else {
      mostrarToast('Debe haber al menos una presentación', 'error');
    }
  });

  contenedorPresentaciones.appendChild(row);
}

// PREVIEW DE IMAGEN
imagenInput.addEventListener('input', () => {
  const url = imagenInput.value.trim();
  if (url) {
    imgPreview.src = url;
    imgPreview.classList.remove('oculto');
    previewPlaceholder.classList.add('oculto');
  } else {
    imgPreview.classList.add('oculto');
    previewPlaceholder.classList.remove('oculto');
  }
});

// CARGAR PRODUCTOS DESDE FIRESTORE
function cargarProductos() {
  onSnapshot(collection(db, 'productos'), (snapshot) => {
    todosLosProductos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    actualizarMetricas(todosLosProductos);
    renderizarTabla(todosLosProductos);
  });
}

// ACTUALIZAR LAS 3 MÉTRICAS
function actualizarMetricas(productos) {
  const totalProds = productos.length;
  const totalUnidadesStock = productos.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);

  if (kpiTotal) kpiTotal.textContent = totalProds;
  if (kpiStock) kpiStock.textContent = totalUnidadesStock;
}

// RENDERIZAR TABLA
function renderizarTabla(productos) {
  const textoBuscado = inputBuscar.value.toLowerCase().trim();
  const catFiltrada = filtroCategoria.value;

  const filtrados = productos.filter(p => {
    const coincideNombre = p.nombre.toLowerCase().includes(textoBuscado);
    const coincideCat = catFiltrada === 'todos' || p.categoria === catFiltrada;
    return coincideNombre && coincideCat;
  });

  if (filtrados.length === 0) {
    tablaBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:16px;">No se encontraron productos</td></tr>`;
    return;
  }

  tablaBody.innerHTML = filtrados.map(p => {
    const preciosTexto = p.presentaciones ? p.presentaciones.map(pr => `${pr.nombre}: $${pr.precio}`).join('<br>') : '';
    
    return `
      <tr>
        <td>
          <div class="contenedor-img-tabla">
            <img src="${p.imagen}" class="tabla-img" onerror="this.src='https://via.placeholder.com/40'">
          </div>
        </td>
        <td><strong>${p.nombre}</strong></td>
        <td><span style="text-transform:capitalize;">${p.categoria}</span></td>
        <td><strong>${p.stock || 0}</strong> u.</td>
        <td style="font-size: 11px;">${preciosTexto}</td>
        <td>
          <button class="btn-editar" data-id="${p.id}"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-eliminar" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  // Eventos de botones en la tabla
  tablaBody.querySelectorAll('.btn-editar').forEach(btn => {
    btn.addEventListener('click', () => editarProducto(btn.dataset.id));
  });

  tablaBody.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', () => eliminarProducto(btn.dataset.id));
  });
}

// FILTROS
inputBuscar.addEventListener('input', () => renderizarTabla(todosLosProductos));
filtroCategoria.addEventListener('change', () => renderizarTabla(todosLosProductos));

// GUARDAR / ACTUALIZAR PRODUCTO
formProducto.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = productoIdInput.value;
  const filasPres = document.querySelectorAll('.presentacion-row');
  const presentaciones = Array.from(filasPres).map(row => ({
    nombre: row.querySelector('.pres-nombre').value.trim(),
    precio: parseFloat(row.querySelector('.pres-precio').value)
  }));

  const dataProducto = {
    nombre: nombreInput.value.trim(),
    categoria: categoriaInput.value,
    stock: parseInt(stockInput.value) || 0,
    descripcion: descripcionInput.value.trim(),
    imagen: imagenInput.value.trim(),
    presentaciones
  };

  try {
    if (id) {
      await updateDoc(doc(db, 'productos', id), dataProducto);
      mostrarToast('Producto actualizado', 'exito');
    } else {
      await addDoc(collection(db, 'productos'), dataProducto);
      mostrarToast('Producto registrado', 'exito');
    }
    limpiarFormulario();
  } catch (err) {
    mostrarToast('Error al guardar: ' + err.message, 'error');
  }
});

// EDITAR Y ELIMINAR
function editarProducto(id) {
  const prod = todosLosProductos.find(p => p.id === id);
  if (!prod) return;

  productoIdInput.value = prod.id;
  nombreInput.value = prod.nombre;
  categoriaInput.value = prod.categoria;
  stockInput.value = prod.stock || 0;
  descripcionInput.value = prod.descripcion;
  imagenInput.value = prod.imagen;
  imgPreview.src = prod.imagen;
  imgPreview.classList.remove('oculto');
  previewPlaceholder.classList.add('oculto');

  contenedorPresentaciones.innerHTML = '';
  if (prod.presentaciones && prod.presentaciones.length > 0) {
    prod.presentaciones.forEach(pr => agregarFilaPresentacion(pr.nombre, pr.precio));
  } else {
    agregarFilaPresentacion();
  }

  tituloForm.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Editar Producto`;
  btnCancelarEdicion.classList.remove('oculto');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function eliminarProducto(id) {
  if (confirm('¿Eliminar este producto permanentemente?')) {
    try {
      await deleteDoc(doc(db, 'productos', id));
      mostrarToast('Producto eliminado', 'exito');
    } catch (err) {
      mostrarToast('Error al eliminar', 'error');
    }
  }
}

btnCancelarEdicion.addEventListener('click', limpiarFormulario);

function limpiarFormulario() {
  formProducto.reset();
  productoIdInput.value = '';
  contenedorPresentaciones.innerHTML = '';
  agregarFilaPresentacion();
  imgPreview.classList.add('oculto');
  previewPlaceholder.classList.remove('oculto');
  tituloForm.innerHTML = `<i class="fa-solid fa-circle-plus"></i> Agregar Nuevo Producto`;
  btnCancelarEdicion.classList.add('oculto');
}

// INICIALIZAR PRIMERA FILA AL CARGAR
agregarFilaPresentacion();

// NOTIFICACIONES TOAST
function mostrarToast(msj, tipo) {
  const toastContainer = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.innerHTML = `<i class="fa-solid ${tipo === 'exito' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${msj}`;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}