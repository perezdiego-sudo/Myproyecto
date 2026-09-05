import { db, auth } from "./firebase_config.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Referencias del DOM
const vistaLogin = document.getElementById('vista-login');
const vistaAdmin = document.getElementById('vista-admin');
const formLogin = document.getElementById('form-login');
const btnLogout = document.getElementById('btn-logout');
const userEmail = document.getElementById('user-email');

const formProducto = document.getElementById('form-producto');
const productoIdInput = document.getElementById('producto-id');
const tituloForm = document.getElementById('titulo-form');
const btnGuardar = document.getElementById('btn-guardar');
const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion');
const contenedorPresentaciones = document.getElementById('contenedor-presentaciones');
const btnAgregarPresentacion = document.getElementById('btn-agregar-presentacion');
const imagenInput = document.getElementById('imagen');
const imgPreview = document.getElementById('img-preview');
const previewPlaceholder = document.getElementById('preview-placeholder');

const tablaBody = document.getElementById('tabla-body');
const inputBuscar = document.getElementById('input-buscar');
const filtroCategoria = document.getElementById('filtro-tabla-categoria');

const kpiTotal = document.getElementById('kpi-total');
const kpiCategorias = document.getElementById('kpi-categorias');
const kpiPresentaciones = document.getElementById('kpi-presentaciones');

let productosLocales = [];
let productosData = {};
let unsubscribeProductos = null;

// ==========================================
// NOTIFICACIONES TOAST (SIN ALERT)
// ==========================================
function mostrarToast(mensaje, tipo = 'exito') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  const icono = tipo === 'exito' ? 'fa-circle-check' : 'fa-circle-exclamation';
  
  toast.innerHTML = `<i class="fa-solid ${icono}"></i> <span>${mensaje}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ==========================================
// 1. CONTROL DE SESIÓN EN TIEMPO REAL
// ==========================================
onAuthStateChanged(auth, (user) => {
  if (user) {
    vistaLogin.classList.add('oculto');
    vistaAdmin.classList.remove('oculto');
    userEmail.textContent = user.email;
    inicializarFormulario();

    if (unsubscribeProductos) unsubscribeProductos();
    escucharProductos();
  } else {
    vistaLogin.classList.remove('oculto');
    vistaAdmin.classList.add('oculto');
    if (unsubscribeProductos) unsubscribeProductos();
  }
});

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();

  try {
    await signInWithEmailAndPassword(auth, email, password);
    formLogin.reset();
    mostrarToast("Inicio de sesión exitoso", "exito");
  } catch (error) {
    mostrarToast("Error de autenticación: Verifica tus datos.", "error");
  }
});

btnLogout.addEventListener('click', () => {
  signOut(auth);
  mostrarToast("Sesión cerrada", "exito");
});

// ==========================================
// 2. CONVERSOR DE DRIVE, PREVIEW Y PRESENTACIONES
// ==========================================
function convertirLinkGoogleDrive(url) {
  if (!url) return '';
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return match && match[1] ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
}

imagenInput.addEventListener('input', () => {
  const urlProcesada = convertirLinkGoogleDrive(imagenInput.value.trim());
  if (urlProcesada) {
    imgPreview.src = urlProcesada;
    imgPreview.classList.remove('oculto');
    previewPlaceholder.classList.add('oculto');
  } else {
    imgPreview.src = '';
    imgPreview.classList.add('oculto');
    previewPlaceholder.classList.remove('oculto');
  }
});

imgPreview.addEventListener('error', () => {
  imgPreview.classList.add('oculto');
  previewPlaceholder.classList.remove('oculto');
});

function agregarFilaPresentacion(nombre = '', precio = '') {
  const div = document.createElement('div');
  div.classList.add('presentacion-row');
  div.innerHTML = `
    <input type="text" class="pres-nombre" placeholder="Ej: Litro, Galón, Unidad" value="${nombre}" required style="flex: 2;">
    <input type="number" class="pres-precio" placeholder="Precio ($)" value="${precio}" required style="flex: 1;">
    <button type="button" class="btn-eliminar btn-quitar-fila"><i class="fa-solid fa-xmark"></i></button>
  `;
  
  div.querySelector('.btn-quitar-fila').addEventListener('click', () => {
    const filas = contenedorPresentaciones.querySelectorAll('.presentacion-row');
    if (filas.length > 1) {
      div.remove();
    } else {
      mostrarToast("Debe existir al menos una presentación", "error");
    }
  });
  contenedorPresentaciones.appendChild(div);
}

btnAgregarPresentacion.addEventListener('click', (e) => {
  e.preventDefault();
  agregarFilaPresentacion('', '');
});

function inicializarFormulario() {
  formProducto.reset();
  productoIdInput.value = '';
  tituloForm.innerHTML = `<i class="fa-solid fa-circle-plus"></i> Agregar Nuevo Producto`;
  btnGuardar.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Producto`;
  btnCancelarEdicion.classList.add('oculto');
  contenedorPresentaciones.innerHTML = '';
  imgPreview.classList.add('oculto');
  previewPlaceholder.classList.remove('oculto');
  agregarFilaPresentacion('', '');
}

btnCancelarEdicion.addEventListener('click', (e) => {
  e.preventDefault();
  inicializarFormulario();
});

// ==========================================
// 3. CÁLCULO DE MÉTRICAS (KPIs)
// ==========================================
function actualizarMetricas(productos) {
  const totalProductos = productos.length;
  const categoriasUnicas = new Set(productos.map(p => p.categoria).filter(Boolean));
  let variacionesTotales = 0;

  productos.forEach(p => {
    if (Array.isArray(p.presentaciones)) {
      variacionesTotales += p.presentaciones.length;
    }
  });

  kpiTotal.textContent = totalProductos;
  kpiCategorias.textContent = categoriasUnicas.size;
  kpiPresentaciones.textContent = variacionesTotales;
}

// ==========================================
// 4. GUARDAR / EDITAR EN FIRESTORE
// ==========================================
formProducto.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = productoIdInput.value;
  const nombre = document.getElementById('nombre').value.trim();
  const categoria = document.getElementById('categoria').value;
  const descripcion = document.getElementById('descripcion').value.trim();
  const urlOriginal = document.getElementById('imagen').value.trim();
  const imagen = convertirLinkGoogleDrive(urlOriginal);

  const presentaciones = [];
  document.querySelectorAll('.presentacion-row').forEach(row => {
    const n = row.querySelector('.pres-nombre').value.trim();
    const p = Number(row.querySelector('.pres-precio').value);
    if (n && !isNaN(p)) presentaciones.push({ nombre: n, precio: p });
  });

  const datosProducto = { nombre, categoria, descripcion, imagen, presentaciones };

  try {
    if (id) {
      await updateDoc(doc(db, "productos", id), datosProducto);
      mostrarToast("Producto actualizado correctamente.", "exito");
    } else {
      await addDoc(collection(db, "productos"), datosProducto);
      mostrarToast("Producto agregado al catálogo.", "exito");
    }
    inicializarFormulario();
  } catch (error) {
    mostrarToast("Error al procesar: " + error.message, "error");
  }
});

// ==========================================
// 5. LECTURA Y RENDERIZADO CON FILTROS
// ==========================================
function escucharProductos() {
  unsubscribeProductos = onSnapshot(collection(db, "productos"), (snapshot) => {
    if (snapshot.metadata.hasPendingWrites) return;

    productosLocales = [];
    productosData = {};

    snapshot.forEach((documento) => {
      const prod = documento.data();
      prod.id = documento.id;
      productosLocales.push(prod);
      productosData[documento.id] = prod;
    });

    actualizarMetricas(productosLocales);
    renderizarTabla();
  });
}

function renderizarTabla() {
  const textoBusqueda = inputBuscar ? inputBuscar.value.toLowerCase().trim() : '';
  const categoriaFiltro = filtroCategoria ? filtroCategoria.value : 'todos';

  const productosFiltrados = productosLocales.filter(prod => {
    const coincideNombre = (prod.nombre || '').toLowerCase().includes(textoBusqueda);
    const coincideCategoria = categoriaFiltro === 'todos' || prod.categoria === categoriaFiltro;
    return coincideNombre && coincideCategoria;
  });

  tablaBody.innerHTML = '';

  if (productosFiltrados.length === 0) {
    tablaBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--admin-text-muted); padding: 24px;">
          <i class="fa-solid fa-magnifying-glass" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
          No se encontraron productos coincidentes.
        </td>
      </tr>
    `;
    return;
  }

  const fragmento = document.createDocumentFragment();

  productosFiltrados.forEach((prod) => {
    const tr = document.createElement('tr');
    const listaPres = prod.presentaciones 
      ? prod.presentaciones.map(p => `${p.nombre}: <strong>$${Number(p.precio).toLocaleString('es-CO')}</strong>`).join('<br>') 
      : 'Sin precios';

    tr.innerHTML = `
      <td>
        <div class="contenedor-img-tabla">
          <img src="${prod.imagen || ''}" class="tabla-img" alt="${prod.nombre}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/50?text=Sin+Foto'">
        </div>
      </td>
      <td><strong>${prod.nombre || ''}</strong></td>
      <td><span class="badge-categoria" style="text-transform: capitalize; background: #e0e7ff; color: #3730a3; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">${prod.categoria || ''}</span></td>
      <td><small>${listaPres}</small></td>
      <td>
        <button type="button" class="btn-editar" data-id="${prod.id}"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
        <button type="button" class="btn-eliminar btn-borrar-prod" data-id="${prod.id}"><i class="fa-solid fa-trash-can"></i></button>
      </td>
    `;
    fragmento.appendChild(tr);
  });

  tablaBody.appendChild(fragmento);
}

if (inputBuscar) inputBuscar.addEventListener('input', renderizarTabla);
if (filtroCategoria) filtroCategoria.addEventListener('change', renderizarTabla);

// ==========================================
// 6. DELEGACIÓN DE EVENTOS EN TABLA
// ==========================================
tablaBody.addEventListener('click', async (e) => {
  const btnEditar = e.target.closest('.btn-editar');
  const btnBorrar = e.target.closest('.btn-borrar-prod');

  if (btnEditar) {
    const id = btnEditar.dataset.id;
    const prod = productosData[id];

    if (prod) {
      productoIdInput.value = id;
      document.getElementById('nombre').value = prod.nombre || '';
      document.getElementById('categoria').value = prod.categoria || 'envases';
      document.getElementById('descripcion').value = prod.descripcion || '';
      document.getElementById('imagen').value = prod.imagen || '';

      if (prod.imagen) {
        imgPreview.src = prod.imagen;
        imgPreview.classList.remove('oculto');
        previewPlaceholder.classList.add('oculto');
      }

      contenedorPresentaciones.innerHTML = '';
      if (prod.presentaciones && prod.presentaciones.length > 0) {
        prod.presentaciones.forEach(p => agregarFilaPresentacion(p.nombre, p.precio));
      } else {
        agregarFilaPresentacion('', '');
      }

      tituloForm.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Editar Producto`;
      btnGuardar.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Actualizar Producto`;
      btnCancelarEdicion.classList.remove('oculto');

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  if (btnBorrar) {
    const id = btnBorrar.dataset.id;
    if (confirm("¿Estás seguro de que deseas eliminar este producto?")) {
      try {
        await deleteDoc(doc(db, "productos", id));
        mostrarToast("Producto eliminado", "exito");
      } catch (err) {
        mostrarToast("Error al eliminar: " + err.message, "error");
      }
    }
  }
});