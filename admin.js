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
const prodStockInput = document.getElementById('prod-stock');
const prodStockMinimoInput = document.getElementById('prod-stock-minimo');
const unidadStockTxt = document.getElementById('unidad-stock-txt');
const unidadStockMinimoTxt = document.getElementById('unidad-stock-minimo-txt');
const listaPresentaciones = document.getElementById('lista-presentaciones');
const btnAgregarPresentacion = document.getElementById('btn-agregar-presentacion');
const btnCancelarEdit = document.getElementById('btn-cancelar-edit');
const tablaBody = document.getElementById('tabla-productos-body');

let todosLosProductos = [];
const STOCK_MINIMO_POR_DEFECTO = 5;

// ==========================================================
// UNIDAD BASE SEGÚN CATEGORÍA
// ==========================================================

function obtenerUnidadStock(categoria) {
  const unidades = { polvos: 'kg', liquidos: 'L', perfumeria: 'L', sabores: 'L', envases: 'unid.' };
  return unidades[categoria] || 'unid.';
}

prodCategoriaInput.addEventListener('change', () => {
  unidadStockTxt.textContent = obtenerUnidadStock(prodCategoriaInput.value);
  unidadStockMinimoTxt.textContent = obtenerUnidadStock(prodCategoriaInput.value);
});

// ==========================================================
// PRESENTACIONES DINÁMICAS (nombre + precio + equivalencia)
// ==========================================================

function crearFilaPresentacion(nombre = '', precio = '', equivalencia = '') {
  const fila = document.createElement('div');
  fila.classList.add('fila-presentacion');
  fila.innerHTML = `
    <input type="text" class="presentacion-nombre" placeholder="Ej: 1/4 Litro" value="${nombre}" required>
    <input type="number" class="presentacion-precio" placeholder="Precio" min="0" value="${precio}" required>
    <input type="number" step="0.001" class="presentacion-equivalencia" placeholder="Equivale a" min="0" value="${equivalencia}">
    <button type="button" class="btn-quitar-presentacion"><i class="fa-solid fa-trash"></i></button>
    <small>Cuánto representa esta presentación de la unidad base (ej: Libra = 0.5 si la base es kg). Vacío = 1.</small>
  `;
  fila.querySelector('.btn-quitar-presentacion').addEventListener('click', () => fila.remove());
  listaPresentaciones.appendChild(fila);
}

btnAgregarPresentacion.addEventListener('click', () => crearFilaPresentacion());

function obtenerPresentacionesDelFormulario() {
  const filas = listaPresentaciones.querySelectorAll('.fila-presentacion');
  const presentaciones = [];

  filas.forEach(fila => {
    const nombre = fila.querySelector('.presentacion-nombre').value.trim();
    const precio = parseFloat(fila.querySelector('.presentacion-precio').value) || 0;
    const equivaliaValor = fila.querySelector('.presentacion-equivalencia').value;
    const equivalencia = equivaliaValor === '' ? 1 : parseFloat(equivaliaValor);
    if (nombre) presentaciones.push({ nombre, precio, equivalencia });
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
    tablaBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:16px; color:#888;">No hay productos registrados</td></tr>`;
    return;
  }

  tablaBody.innerHTML = productos.map(p => {
    const presentaciones = p.presentaciones || [];
    const resumenPresentaciones = presentaciones
      .map(pr => `${pr.nombre}: $${(Number(pr.precio) || 0).toLocaleString('es-CO')}`)
      .join('<br>');

    const tieneStock = p.stock !== null && p.stock !== undefined && p.stock !== '';
    const unidad = obtenerUnidadStock(p.categoria);
    const stockTexto = tieneStock ? `${p.stock} ${unidad}` : 'Ilimitado';
    const stockColor = tieneStock && Number(p.stock) <= 0 ? '#c62828' : '#333';

    // Determina la clase de la fila según el nivel de stock
    let claseFila = '';
    if (tieneStock) {
      const stockMinimo = (p.stockMinimo === null || p.stockMinimo === undefined || p.stockMinimo === '')
        ? STOCK_MINIMO_POR_DEFECTO
        : Number(p.stockMinimo);

      if (Number(p.stock) <= 0) {
        claseFila = 'fila-agotado';
      } else if (Number(p.stock) <= stockMinimo) {
        claseFila = 'fila-stock-bajo';
      }
    }

    return `
      <tr class="${claseFila}">
        <td><strong>${p.nombre || ''}</strong></td>
        <td><span class="badge-cat cat-${p.categoria}">${p.categoria || ''}</span></td>
        <td style="color:${stockColor}; font-weight:600;">${stockTexto}</td>
        <td>${resumenPresentaciones || '—'}</td>
        <td>
          <div class="action-btns">
            <button class="btn-sm btn-edit" data-id="${p.id}"><i class="fa-solid fa-pen"></i> Editar</button>
            <button class="btn-sm btn-stock" data-id="${p.id}" data-stock="${tieneStock ? p.stock : ''}"><i class="fa-solid fa-cubes"></i> Ajustar</button>
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

  tablaBody.querySelectorAll('.btn-stock').forEach(btn => {
    btn.addEventListener('click', () => ajustarStockRapido(btn.dataset.id, btn.dataset.stock));
  });
}

// ==========================================================
// AJUSTE RÁPIDO DE STOCK (sin abrir el formulario completo)
// ==========================================================

async function ajustarStockRapido(id, stockActual) {
  const nuevoValor = prompt('Nuevo stock total para este producto (deja vacío para ilimitado):', stockActual || '');
  if (nuevoValor === null) return; // canceló

  const texto = nuevoValor.trim();
  const stockNumerico = texto === '' ? null : parseFloat(texto);

  if (stockNumerico !== null && (isNaN(stockNumerico) || stockNumerico < 0)) {
    mostrarToast('Escribe un número válido (0 o mayor), o deja vacío para ilimitado', 'error');
    return;
  }

  try {
    await updateDoc(doc(db, 'productos', id), { stock: stockNumerico });
    mostrarToast('Stock actualizado', 'exito');
  } catch (err) {
    mostrarToast('Error al actualizar stock: ' + err.message, 'error');
  }
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

  const stockValor = prodStockInput.value;
  const stock = stockValor === '' ? null : parseFloat(stockValor);

  const stockMinimoValor = prodStockMinimoInput.value;
  const stockMinimo = stockMinimoValor === '' ? null : parseFloat(stockMinimoValor);

  const id = prodIdInput.value;
  const dataProducto = {
    nombre: prodNombreInput.value.trim(),
    descripcion: prodDescripcionInput.value.trim(),
    categoria: prodCategoriaInput.value,
    imagen: prodImagenInput.value.trim(),
    presentaciones: presentaciones,
    stock: stock,
    stockMinimo: stockMinimo
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
  prodStockInput.value = (prod.stock === null || prod.stock === undefined) ? '' : prod.stock;
  prodStockMinimoInput.value = (prod.stockMinimo === null || prod.stockMinimo === undefined) ? '' : prod.stockMinimo;
  unidadStockTxt.textContent = obtenerUnidadStock(prod.categoria);
  unidadStockMinimoTxt.textContent = obtenerUnidadStock(prod.categoria);

  listaPresentaciones.innerHTML = '';
  (prod.presentaciones || []).forEach(p => crearFilaPresentacion(p.nombre, p.precio, p.equivalencia ?? ''));

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
  prodStockInput.value = '';
  prodStockMinimoInput.value = '';
  unidadStockTxt.textContent = obtenerUnidadStock(prodCategoriaInput.value);
  unidadStockMinimoTxt.textContent = obtenerUnidadStock(prodCategoriaInput.value);
  listaPresentaciones.innerHTML = '';
  crearFilaPresentacion();
  formTitle.innerHTML = `<i class="fa-solid fa-square-plus"></i> Registrar Producto`;
  btnCancelarEdit.classList.add('hidden');
}

// Arranca con una fila de presentación vacía lista para llenar
crearFilaPresentacion();

// ==========================================================
// IMPORTACIÓN MASIVA DESDE CSV
// ==========================================================

const inputCSV = document.getElementById('input-csv');
const btnImportarCSV = document.getElementById('btn-importar-csv');
const btnDescargarPlantilla = document.getElementById('btn-descargar-plantilla');
const progresoImportacion = document.getElementById('progreso-importacion');

function dividirLineaCSV(linea) {
  const resultado = [];
  let actual = '';
  let dentroDeComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const car = linea[i];
    if (car === '"') {
      dentroDeComillas = !dentroDeComillas;
    } else if (car === ',' && !dentroDeComillas) {
      resultado.push(actual);
      actual = '';
    } else {
      actual += car;
    }
  }
  resultado.push(actual);
  return resultado;
}

function parsearCSV(texto) {
  const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== '');
  const encabezados = dividirLineaCSV(lineas[0]).map(h => h.trim());

  return lineas.slice(1).map(linea => {
    const valores = dividirLineaCSV(linea);
    const fila = {};
    encabezados.forEach((encabezado, i) => {
      fila[encabezado] = (valores[i] || '').trim();
    });
    return fila;
  });
}

btnImportarCSV.addEventListener('click', async () => {
  const archivo = inputCSV.files[0];

  if (!archivo) {
    mostrarToast('Selecciona un archivo CSV primero', 'error');
    return;
  }

  progresoImportacion.textContent = 'Leyendo archivo...';

  try {
    const texto = await archivo.text();
    const filas = parsearCSV(texto);

    const productosPorId = {};

    filas.forEach(fila => {
      const id = fila.id_producto;
      if (!id) return;

      if (!productosPorId[id]) {
        productosPorId[id] = {
          nombre: fila.nombre || '',
          descripcion: fila.descripcion || '',
          categoria: fila.categoria || '',
          imagen: fila.imagen || '',
          stock: fila.stock === '' || fila.stock === undefined ? null : parseFloat(fila.stock),
          stockMinimo: fila.stock_minimo === '' || fila.stock_minimo === undefined ? null : parseFloat(fila.stock_minimo),
          presentaciones: []
        };
      }

      if (fila.presentacion) {
        productosPorId[id].presentaciones.push({
          nombre: fila.presentacion,
          precio: parseFloat(fila.precio) || 0,
          equivalencia: fila.equivalencia === '' || fila.equivalencia === undefined ? 1 : parseFloat(fila.equivalencia)
        });
      }
    });

    const listaProductos = Object.values(productosPorId);

    if (listaProductos.length === 0) {
      mostrarToast('No se encontraron productos válidos en el archivo', 'error');
      progresoImportacion.textContent = '';
      return;
    }

    let exitosos = 0;
    let fallidos = 0;

    for (let i = 0; i < listaProductos.length; i++) {
      const producto = listaProductos[i];
      progresoImportacion.textContent = `Importando ${i + 1} de ${listaProductos.length}: ${producto.nombre}...`;

      try {
        await addDoc(collection(db, 'productos'), producto);
        exitosos++;
      } catch (err) {
        console.error(`Error con ${producto.nombre}:`, err);
        fallidos++;
      }
    }

    progresoImportacion.textContent = `Importación terminada: ${exitosos} productos agregados, ${fallidos} fallidos.`;
    mostrarToast(`${exitosos} productos importados correctamente`, 'exito');
    inputCSV.value = '';

  } catch (error) {
    mostrarToast('Error leyendo el archivo: ' + error.message, 'error');
    progresoImportacion.textContent = '';
  }
});

btnDescargarPlantilla.addEventListener('click', () => {
  const contenido =
    'id_producto,nombre,descripcion,categoria,imagen,stock,stock_minimo,presentacion,equivalencia,precio\n' +
    '1,Alcohol al 96%,Alcohol de alta pureza para limpieza,liquidos,imagenes/alcohol.jpg,50,5,1/4 Litro,0.25,3000\n' +
    '1,Alcohol al 96%,Alcohol de alta pureza para limpieza,liquidos,imagenes/alcohol.jpg,50,5,Litro,1,10000\n' +
    '2,Bicarbonato de Sodio,Polvo multiusos,polvos,imagenes/bicarbonato.jpg,50,5,Kilo,1,8000\n' +
    '2,Bicarbonato de Sodio,Polvo multiusos,polvos,imagenes/bicarbonato.jpg,50,5,Libra,0.5,4000\n';

  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'plantilla_productos.csv';
  enlace.click();
  URL.revokeObjectURL(url);
});

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