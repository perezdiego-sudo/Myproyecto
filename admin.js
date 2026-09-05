// admin.js - Módulo de Gestión de Inventario y Autenticación con Firebase v10
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  runTransaction 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. Configuración Real de Firebase Quimiaseo Caribe
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

// 2. Inicialización
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const productosRef = collection(db, "productos");

// Referencias DOM
const loginSection = document.getElementById("login-section");
const panelSection = document.getElementById("panel-section");
const userInfo = document.getElementById("user-info");
const userEmailSpan = document.getElementById("user-email");

const formLogin = document.getElementById("form-login");
const inputLoginEmail = document.getElementById("login-email");
const inputLoginPass = document.getElementById("login-password");
const btnLogout = document.getElementById("btn-logout");

const formProducto = document.getElementById("form-producto");
const inputProdId = document.getElementById("prod-id");
const inputProdNombre = document.getElementById("prod-nombre");
const selectProdCat = document.getElementById("prod-categoria");
const inputProdPrecio = document.getElementById("prod-precio");
const inputProdStock = document.getElementById("prod-stock");
const spanUnidadStock = document.getElementById("unidad-stock-txt");

const formTitle = document.getElementById("form-title");
const btnGuardarProd = document.getElementById("btn-guardar-prod");
const btnCancelarEdit = document.getElementById("btn-cancelar-edit");
const tablaBody = document.getElementById("tabla-productos-body");

let unsubscribeProductos = null;

// ==========================================
// 3. OBTENER UNIDAD SEGÚN CATEGORÍA
// ==========================================

export function obtenerUnidadStock(categoria) {
  const cat = (categoria || '').toLowerCase();
  switch (cat) {
    case 'polvos':
      return 'kg';
    case 'liquidos':
    case 'perfumeria':
      return 'L';
    case 'envases':
      return 'unid.';
    default:
      return 'unid.';
  }
}

// Cambiar la etiqueta dinámicamente al seleccionar categoría
selectProdCat.addEventListener("change", () => {
  const unidad = obtenerUnidadStock(selectProdCat.value);
  if (spanUnidadStock) spanUnidadStock.textContent = unidad;
  inputProdStock.placeholder = `Ej: 50 ${unidad}`;
});

function mostrarToast(mensaje, tipo = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  
  const icon = tipo === "exito" ? "fa-circle-check" : (tipo === "error" ? "fa-circle-exclamation" : "fa-info-circle");
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${mensaje}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// ==========================================
// 4. AUTENTICACIÓN
// ==========================================

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginSection.classList.add("hidden");
    panelSection.classList.remove("hidden");
    userInfo.classList.remove("hidden");
    userEmailSpan.textContent = user.email;

    escucharProductos();
  } else {
    loginSection.classList.remove("hidden");
    panelSection.classList.add("hidden");
    userInfo.classList.add("hidden");
    userEmailSpan.textContent = "";

    if (unsubscribeProductos) unsubscribeProductos();
  }
});

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = inputLoginEmail.value.trim();
  const password = inputLoginPass.value.trim();

  try {
    await signInWithEmailAndPassword(auth, email, password);
    mostrarToast("¡Bienvenido al Panel de Administración!", "exito");
    formLogin.reset();
  } catch (error) {
    console.error("Error al iniciar sesión:", error.code, error.message);
    if (error.code === 'auth/api-key-not-valid') {
      mostrarToast("API Key no válida. Revisa las credenciales.", "error");
    } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
      mostrarToast("Credenciales incorrectas: Correo o contraseña erróneos.", "error");
    } else {
      mostrarToast(`Error: ${error.message}`, "error");
    }
  }
});

btnLogout.addEventListener("click", async () => {
  try {
    await signOut(auth);
    mostrarToast("Has cerrado sesión.", "exito");
  } catch (error) {
    mostrarToast("Error al cerrar sesión", "error");
  }
});

// ==========================================
// 5. GESTIÓN DE PRODUCTOS (CRUD)
// ==========================================

function escucharProductos() {
  unsubscribeProductos = onSnapshot(productosRef, (snapshot) => {
    const productos = [];
    snapshot.forEach((docSnap) => {
      productos.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderizarTabla(productos);
  }, (error) => {
    mostrarToast("Error al cargar productos.", "error");
  });
}

function renderizarTabla(productos) {
  if (productos.length === 0) {
    tablaBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #777;">No hay productos en el inventario.</td></tr>`;
    return;
  }

  tablaBody.innerHTML = productos.map((p) => {
    const unidad = obtenerUnidadStock(p.categoria);
    const precioFormat = Number(p.precio || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
    
    return `
      <tr>
        <td><strong>${p.nombre || 'Sin nombre'}</strong></td>
        <td><span class="badge-cat cat-${p.categoria || 'envases'}">${p.categoria || 'N/A'}</span></td>
        <td>${precioFormat}</td>
        <td>
          <strong style="font-size: 1.05rem; color: #0d47a1;">${p.stock || 0}</strong> ${unidad}
        </td>
        <td>
          <div class="action-btns">
            <button class="btn-sm btn-edit" onclick="prepararEdicion('${p.id}', '${p.nombre}', '${p.categoria}', ${p.precio}, ${p.stock})" title="Editar Producto">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn-sm btn-discount" onclick="promptDescontarStock('${p.id}', '${p.nombre}', ${p.stock}, '${p.categoria}')" title="Descontar Pedido">
              <i class="fa-solid fa-minus"></i> Pedido
            </button>
            <button class="btn-sm btn-delete" onclick="confirmarEliminar('${p.id}', '${p.nombre}')" title="Eliminar Producto">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

formProducto.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = inputProdId.value;
  const nombre = inputProdNombre.value.trim();
  const categoria = selectProdCat.value;
  const precio = parseFloat(inputProdPrecio.value);
  const stock = parseFloat(inputProdStock.value);

  const productoData = {
    nombre,
    categoria,
    precio,
    stock,
    actualizadoEn: new Date()
  };

  try {
    if (id) {
      await updateDoc(doc(db, "productos", id), productoData);
      mostrarToast(`Producto "${nombre}" actualizado.`, "exito");
    } else {
      await addDoc(productosRef, { ...productoData, creadoEn: new Date() });
      mostrarToast(`Producto "${nombre}" agregado.`, "exito");
    }
    resetFormulario();
  } catch (error) {
    mostrarToast("Error al guardar en la base de datos.", "error");
  }
});

window.prepararEdicion = (id, nombre, categoria, precio, stock) => {
  inputProdId.value = id;
  inputProdNombre.value = nombre;
  selectProdCat.value = categoria;
  inputProdPrecio.value = precio;
  inputProdStock.value = stock;

  spanUnidadStock.textContent = obtenerUnidadStock(categoria);
  formTitle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Editar Producto`;
  btnGuardarProd.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Actualizar Producto`;
  btnCancelarEdit.classList.remove("hidden");
};

btnCancelarEdit.addEventListener("click", resetFormulario);

function resetFormulario() {
  inputProdId.value = "";
  formProducto.reset();
  spanUnidadStock.textContent = obtenerUnidadStock(selectProdCat.value);
  formTitle.innerHTML = `<i class="fa-solid fa-square-plus"></i> Registrar Producto`;
  btnGuardarProd.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Producto`;
  btnCancelarEdit.classList.add("hidden");
}

window.confirmarEliminar = async (id, nombre) => {
  if (confirm(`¿Deseas eliminar el producto "${nombre}"?`)) {
    try {
      await deleteDoc(doc(db, "productos", id));
      mostrarToast(`Producto "${nombre}" eliminado.`, "exito");
    } catch (error) {
      mostrarToast("Error al eliminar.", "error");
    }
  }
};

// ==========================================
// 6. DESCUENTO AUTOMÁTICO / TRANSACCIONAL DE STOCK
// ==========================================

export async function descontarStock(productoId, cantidadPedida) {
  const prodRef = doc(db, "productos", productoId);

  try {
    await runTransaction(db, async (transaction) => {
      const prodDoc = await transaction.get(prodRef);

      if (!prodDoc.exists()) {
        throw new Error("El producto no existe.");
      }

      const data = prodDoc.data();
      const stockActual = Number(data.stock) || 0;
      const unidad = obtenerUnidadStock(data.categoria);

      if (stockActual < cantidadPedida) {
        throw new Error(`Stock insuficiente de "${data.nombre}". Quedan ${stockActual} ${unidad} y se solicitaron ${cantidadPedida} ${unidad}.`);
      }

      const nuevoStock = stockActual - cantidadPedida;
      transaction.update(prodRef, { stock: nuevoStock });
    });

    mostrarToast(`Se descontaron ${cantidadPedida} unidades del inventario.`, "exito");
    return true;

  } catch (error) {
    console.error("Error al descontar stock:", error.message);
    mostrarToast(error.message, "error");
    return false;
  }
}

// Botón de acceso rápido en la tabla para simular/procesar un pedido
window.promptDescontarStock = async (id, nombre, stockActual, categoria) => {
  const unidad = obtenerUnidadStock(categoria);
  const resp = prompt(`Ingresa la cantidad enviada en el pedido para "${nombre}" (Stock actual: ${stockActual} ${unidad}):`, "10");
  
  if (resp === null) return;

  const cantidad = parseFloat(resp);
  if (isNaN(cantidad) || cantidad <= 0) {
    mostrarToast("Ingresa un número mayor a 0.", "error");
    return;
  }

  await descontarStock(id, cantidad);
};