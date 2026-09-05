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
const tablaBody = document.getElementById('tabla-body');

let productosData = {};
let unsubscribeProductos = null;

// ==========================================
// 1. CONTROL DE SESIÓN EN TIEMPO REAL
// ==========================================
onAuthStateChanged(auth, (user) => {
  if (user) {
    vistaLogin.classList.add('oculto');
    vistaAdmin.classList.remove('oculto');
    userEmail.textContent = user.email;
    inicializarFormulario();

    // Detener suscripciones previas si la sesión cambia para evitar duplicaciones
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
  } catch (error) {
    alert("Error de autenticación: Verifica tu correo y contraseña.");
  }
});

btnLogout.addEventListener('click', () => signOut(auth));

// ==========================================
// 2. CONVERSOR DE DRIVE Y PRESENTACIONES
// ==========================================
function convertirLinkGoogleDrive(url) {
  if (!url) return '';
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return match && match[1] ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
}

function agregarFilaPresentacion(nombre = '', precio = '') {
  const div = document.createElement('div');
  div.classList.add('presentacion-row');
  div.innerHTML = `
    <input type="text" class="pres-nombre" placeholder="Ej: Litro, Galón, Unidad" value="${nombre}" required style="flex: 2;">
    <input type="number" class="pres-precio" placeholder="Precio ($)" value="${precio}" required style="flex: 1;">
    <button type="button" class="btn-eliminar btn-quitar-fila">✕</button>
  `;
  
  div.querySelector('.btn-quitar-fila').addEventListener('click', () => div.remove());
  contenedorPresentaciones.appendChild(div);
}

btnAgregarPresentacion.addEventListener('click', (e) => {
  e.preventDefault();
  agregarFilaPresentacion('', '');
});

function inicializarFormulario() {
  formProducto.reset();
  productoIdInput.value = '';
  tituloForm.textContent = 'Agregar Nuevo Producto';
  btnGuardar.textContent = 'Guardar Producto';
  btnCancelarEdicion.classList.add('oculto');
  contenedorPresentaciones.innerHTML = '';
  agregarFilaPresentacion('', '');
}

btnCancelarEdicion.addEventListener('click', (e) => {
  e.preventDefault();
  inicializarFormulario();
});

// ==========================================
// 3. GUARDAR / EDITAR EN FIRESTORE
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
      alert("Producto actualizado correctamente.");
    } else {
      await addDoc(collection(db, "productos"), datosProducto);
      alert("Producto agregado al catálogo.");
    }
    inicializarFormulario();
  } catch (error) {
    alert("Error al procesar la solicitud: " + error.message);
  }
});

// ==========================================
// 4. LECTURA Y DELEGACIÓN DE EVENTOS EN TABLA
// ==========================================
function escucharProductos() {
  unsubscribeProductos = onSnapshot(collection(db, "productos"), (snapshot) => {
    tablaBody.innerHTML = '';
    productosData = {};

    if (snapshot.empty) {
      tablaBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No hay productos registrados.</td></tr>';
      return;
    }

    snapshot.forEach((documento) => {
      const prod = documento.data();
      const id = documento.id;
      productosData[id] = prod;

      const tr = document.createElement('tr');
      const listaPres = prod.presentaciones 
        ? prod.presentaciones.map(p => `${p.nombre}: $${Number(p.precio).toLocaleString('es-CO')}`).join('<br>') 
        : 'Sin precios';

      tr.innerHTML = `
        <td><img src="${prod.imagen || ''}" class="tabla-img" alt="${prod.nombre}" onerror="this.src='https://via.placeholder.com/50?text=Error'"></td>
        <td><strong>${prod.nombre || ''}</strong></td>
        <td>${prod.categoria || ''}</td>
        <td><small>${listaPres}</small></td>
        <td>
          <button type="button" class="btn-editar" data-id="${id}">Editar</button>
          <button type="button" class="btn-eliminar btn-borrar-prod" data-id="${id}">✕</button>
        </td>
      `;
      tablaBody.appendChild(tr);
    });
  });
}

// Delegación de eventos única fuera del snapshot para evitar reinicios de listeners
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

      contenedorPresentaciones.innerHTML = '';
      if (prod.presentaciones && prod.presentaciones.length > 0) {
        prod.presentaciones.forEach(p => agregarFilaPresentacion(p.nombre, p.precio));
      } else {
        agregarFilaPresentacion('', '');
      }

      tituloForm.textContent = 'Editar Producto';
      btnGuardar.textContent = 'Actualizar Producto';
      btnCancelarEdicion.classList.remove('oculto');

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  if (btnBorrar) {
    const id = btnBorrar.dataset.id;
    if (confirm("¿Estás seguro de que deseas eliminar este producto?")) {
      try {
        await deleteDoc(doc(db, "productos", id));
      } catch (err) {
        alert("Error al eliminar: " + err.message);
      }
    }
  }
});