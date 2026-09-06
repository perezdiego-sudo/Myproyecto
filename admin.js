import { db, auth } from "./firebase_config.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ELEMENTOS DEL DOM
const loginSection = document.getElementById('login-section');
const panelSection = document.getElementById('panel-section');
const userInfo = document.getElementById('user-info');
const userEmailSpan = document.getElementById('user-email');
const formLogin = document.getElementById('form-login');
const btnLogout = document.getElementById('btn-logout');

const formProducto = document.getElementById('form-producto');
const formTitle = document.getElementById('form-title');
const prodIdInput = document.getElementById('prod-id');
const prodNombreInput = document.getElementById('prod-nombre');
const prodDescripcionInput = document.getElementById('prod-descripcion');
const prodCategoriaInput = document.getElementById('prod-categoria');
const prodImagenInput = document.getElementById('prod-imagen');
const listaPresentaciones = document.getElementById('lista-presentaciones');
const btnAgregarPresentacion = document.getElementById('btn-agregar-presentacion');
const btnCancelarEdit = document.getElementById('btn-cancelar-edit');
const tablaBody = document.getElementById('tabla-productos-body');

let todosLosProductos = [];

// ==========================================================
// PRESENTACIONES DINÁMICAS (agregar/quitar filas nombre + precio)
// ==========================================================

function crearFilaPresentacion(nombre = '', precio = '', stock = '') {
  const fila = document.createElement('div');
  fila.classList.add('fila-presentacion');
  fila.innerHTML = `
    <input type="text" class="presentacion-nombre" placeholder="Ej: 1/4 Litro" value="${nombre}" required>
    <input type="number" class="presentacion-precio" placeholder="Precio" min="0" value="${precio}" required>
    <input type="number" class="presentacion-stock" placeholder="Stock (vacío = ilimitado)" min="0" value="${stock}">
    <button type="button" class="btn-quitar-presentacion"><i class="fa-solid fa-trash"></i></button>
  `;
  fila.querySelector('.btn-quitar-presentacion').addEventListener('click', () => fila.remove());
  listaPresentaciones.appendChild(fila);
}

function obtenerPresentacionesDelFormulario() {
  const filas = listaPresentaciones.querySelectorAll('.fila-presentacion');
  const presentaciones = [];

  filas.forEach(fila => {
    const nombre = fila.querySelector('.presentacion-nombre').value.trim();
    const precio = parseFloat(fila.querySelector('.presentacion-precio').value) || 0;
    const stockValor = fila.querySelector('.presentacion-stock').value;
    const stock = stockValor === '' ? null : parseFloat(stockValor);
    if (nombre) presentaciones.push({ nombre, precio, stock });
  });

  return presentaciones;
}

// ==========================================================
// AUTENTICACIÓN
// ==========================================================

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginSection.classList.add('hidden');
    panelSection.classList.remove('hidden');
    userInfo.classList.remove('hidden');
    userEmailSpan.textContent = user.email;
    cargarProductos();
  } else {
    loginSection.classList.remove('hidden');
    panelSection.classList.add('hidden');
    userInfo.classList.add('hidden');
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

// ==========================================================
// CARGAR PRODUCTOS DESDE FIRESTORE EN TIEMPO REAL
// ==========================================================

function cargarProductos() {
  onSnapshot(collection(db, 'productos'), (snapshot) => {
    todosLosProductos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderizarTabla(todosLosProductos);
  });
}

function renderizarTabla(productos) {
  if (productos.length === 0) {
    tablaBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:16px; color:#888;">No hay productos registrados</td></tr>`;
    return;
  }

  tablaBody.innerHTML = productos.map(p => {
    const presentaciones = p.presentaciones || [];
    const resumenPresentaciones = presentaciones
      .map(pr => `${pr.nombre}: $${(Number(pr.precio) || 0).toLocaleString('es-CO')}`)
      .join('<br>');

    return `
      <tr>
        <td><strong>${p.nombre || ''}</strong></td>
        <td><span class="badge-cat cat-${p.categoria}">${p.categoria || ''}</span></td>
        <td>${resumenPresentaciones || '—'}</td>
        <td>
          <div class="action-btns">
            <button class="btn-sm btn-edit" data-id="${p.id}"><i class="fa-solid fa-pen"></i> Editar</button>
            <button class="btn-sm btn-delete" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tablaBody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => editarProducto(btn.dataset.id));
  });

  tablaBody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => eliminarProducto(btn.dataset.id));
  });
}

// ==========================================================
// GUARDAR O ACTUALIZAR PRODUCTO
// ==========================================================

formProducto.addEventListener('submit', async (e) => {
  e.preventDefault();

  const presentaciones = obtenerPresentacionesDelFormulario();

  if (presentaciones.length === 0) {
    mostrarToast('Agrega al menos una presentación con su precio', 'error');
    return;
  }

  const id = prodIdInput.value;
  const dataProducto = {
    nombre: prodNombreInput.value.trim(),
    descripcion: prodDescripcionInput.value.trim(),
    categoria: prodCategoriaInput.value,
    imagen: prodImagenInput.value.trim(),
    presentaciones: presentaciones
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

// ==========================================================
// EDITAR PRODUCTO
// ==========================================================

function editarProducto(id) {
  const prod = todosLosProductos.find(p => p.id === id);
  if (!prod) return;

  prodIdInput.value = prod.id;
  prodNombreInput.value = prod.nombre || '';
  prodDescripcionInput.value = prod.descripcion || '';
  prodCategoriaInput.value = prod.categoria || 'polvos';
  prodImagenInput.value = prod.imagen || '';

  listaPresentaciones.innerHTML = '';
  (prod.presentaciones || []).forEach(p => crearFilaPresentacion(p.nombre, p.precio, p.stock ?? ''));

  formTitle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Editar Producto`;
  btnCancelarEdit.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================================
// ELIMINAR PRODUCTO
// ==========================================================

async function eliminarProducto(id) {
  if (confirm('¿Eliminar este producto permanentemente?')) {
    try {
      await deleteDoc(doc(db, 'productos', id));
      mostrarToast('Producto eliminado', 'exito');
    } catch (err) {
      mostrarToast('Error al eliminar: ' + err.message, 'error');
    }
  }
}

btnCancelarEdit.addEventListener('click', limpiarFormulario);

function limpiarFormulario() {
  formProducto.reset();
  prodIdInput.value = '';
  listaPresentaciones.innerHTML = '';
  crearFilaPresentacion(); // deja siempre una fila lista para empezar
  formTitle.innerHTML = `<i class="fa-solid fa-square-plus"></i> Registrar Producto`;
  btnCancelarEdit.classList.add('hidden');
}

// Arranca con una fila de presentación vacía lista para llenar
crearFilaPresentacion();

// ==========================================================
// NOTIFICACIONES TOAST
// ==========================================================

function mostrarToast(msj, tipo) {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.innerHTML = `<i class="fa-solid ${tipo === 'exito' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${msj}`;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}