import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuración de Firebase
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
const prodCategoriaInput = document.getElementById('prod-categoria');
const prodPrecioInput = document.getElementById('prod-precio');
const prodStockInput = document.getElementById('prod-stock');
const unidadStockTxt = document.getElementById('unidad-stock-txt');
const btnCancelarEdit = document.getElementById('btn-cancelar-edit');
const tablaBody = document.getElementById('tabla-productos-body');

let todosLosProductos = [];

// AUTENTICACIÓN
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

// CARGAR PRODUCTOS DESDE FIRESTORE EN TIEMPO REAL
function cargarProductos() {
  onSnapshot(collection(db, 'productos'), (snapshot) => {
    todosLosProductos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderizarTabla(todosLosProductos);
  });
}

// RENDERIZAR TABLA EN PANTALLA
function renderizarTabla(productos) {
  if (productos.length === 0) {
    tablaBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:16px; color:#888;">No hay productos registrados</td></tr>`;
    return;
  }

  tablaBody.innerHTML = productos.map(p => `
    <tr>
      <td><strong>${p.nombre || ''}</strong></td>
      <td><span class="badge-cat cat-${p.categoria}">${p.categoria || ''}</span></td>
      <td>$${(Number(p.precio) || 0).toLocaleString()}</td>
      <td><strong>${p.stock || 0}</strong> ${obtenerUnidadStock(p.categoria)}</td>
      <td>
        <div class="action-btns">
          <button class="btn-sm btn-edit" data-id="${p.id}"><i class="fa-solid fa-pen"></i> Editar</button>
          <button class="btn-sm btn-delete" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');

  // Eventos de botones
  tablaBody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => editarProducto(btn.dataset.id));
  });

  tablaBody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => eliminarProducto(btn.dataset.id));
  });
}

// OBTENER UNIDAD DE MEDIDA
function obtenerUnidadStock(cat) {
  const unidades = { polvos: 'kg', liquidos: 'L', perfumeria: 'L', envases: 'unid.' };
  return unidades[cat] || 'unid.';
}

prodCategoriaInput.addEventListener('change', () => {
  const unidad = obtenerUnidadStock(prodCategoriaInput.value);
  if (unidadStockTxt) unidadStockTxt.textContent = unidad;
  prodStockInput.placeholder = `Ej: 50 ${unidad}`;
});

// GUARDAR O ACTUALIZAR PRODUCTO
formProducto.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = prodIdInput.value;
  const dataProducto = {
    nombre: prodNombreInput.value.trim(),
    categoria: prodCategoriaInput.value,
    precio: parseFloat(prodPrecioInput.value) || 0,
    stock: parseFloat(prodStockInput.value) || 0
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

// EDITAR PRODUCTO
function editarProducto(id) {
  const prod = todosLosProductos.find(p => p.id === id);
  if (!prod) return;

  prodIdInput.value = prod.id;
  prodNombreInput.value = prod.nombre || '';
  prodCategoriaInput.value = prod.categoria || 'polvos';
  prodPrecioInput.value = prod.precio || 0;
  prodStockInput.value = prod.stock || 0;

  if (unidadStockTxt) unidadStockTxt.textContent = obtenerUnidadStock(prod.categoria);
  formTitle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Editar Producto`;
  btnCancelarEdit.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ELIMINAR PRODUCTO
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
  if (unidadStockTxt) unidadStockTxt.textContent = 'kg';
  formTitle.innerHTML = `<i class="fa-solid fa-square-plus"></i> Registrar Producto`;
  btnCancelarEdit.classList.add('hidden');
}

// NOTIFICACIONES TOAST
function mostrarToast(msj, tipo) {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.innerHTML = `<i class="fa-solid ${tipo === 'exito' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${msj}`;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}