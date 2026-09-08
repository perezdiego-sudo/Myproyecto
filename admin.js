import { db, auth } from "./firebase_config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";


// ==========================================================
// ELEMENTOS DEL DOM
// ==========================================================

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

// Grupos que se muestran/ocultan según la categoría
const grupoPresentaciones = document.getElementById('grupo-presentaciones');
const grupoPrecioGranel = document.getElementById('grupo-precio-granel');

// CAMPOS DE PRECIO A GRANEL (1000, 500, 250, 125)
const inputPrecio1000 = document.getElementById('precio-1000');
const inputPrecio500 = document.getElementById('precio-500');
const inputPrecio250 = document.getElementById('precio-250');
const inputPrecio125 = document.getElementById('precio-125');

let todosLosProductos = [];

const STOCK_MINIMO_POR_DEFECTO = 5;


// ==========================================================
// UNIDAD BASE Y VERIFICACIÓN DE CATEGORÍA
// ==========================================================

function esCategoriaGranel(categoria) {
  const cat = (categoria || '').trim().toLowerCase();
  // Retorna false si la categoría es envases o envase
  return cat !== 'envases' && cat !== 'envase';
}

function obtenerUnidadStock(categoria) {
  const catLower = (categoria || '').trim().toLowerCase();
  const unidades = {
    polvos: 'g',
    liquidos: 'ml',
    perfumeria: 'ml',
    aromas: 'ml',
    sabores: 'ml',
    envases: 'unid.',
    envase: 'unid.'
  };

  return unidades[catLower] || 'unid.';
}


// ==========================================================
// CÁLCULO AUTOMÁTICO EN EL PANEL AL ESCRIBIR EN 1000g/ml
// ==========================================================

if (inputPrecio1000) {
  inputPrecio1000.addEventListener('input', () => {
    const p1000 = parseFloat(inputPrecio1000.value) || 0;
    if (inputPrecio500) inputPrecio500.value = p1000 ? Math.round(p1000 * 0.5) : '';
    if (inputPrecio250) inputPrecio250.value = p1000 ? Math.round(p1000 * 0.25) : '';
    if (inputPrecio125) inputPrecio125.value = p1000 ? Math.round(p1000 * 0.125) : '';
  });
}


// ==========================================================
// MOSTRAR EL BLOQUE CORRECTO SEGÚN LA CATEGORÍA
// ==========================================================

function actualizarVisibilidadPorCategoria() {
  const categoria = prodCategoriaInput ? prodCategoriaInput.value : 'polvos';
  const unidad = obtenerUnidadStock(categoria);

  if (unidadStockTxt) unidadStockTxt.textContent = unidad;
  if (unidadStockMinimoTxt) unidadStockMinimoTxt.textContent = unidad;

  document.querySelectorAll('.unidad-granel-txt').forEach(el => {
    el.textContent = unidad;
  });

  if (esCategoriaGranel(categoria)) {
    if (grupoPrecioGranel) grupoPrecioGranel.classList.remove('hidden');
    if (grupoPresentaciones) grupoPresentaciones.classList.add('hidden');
  } else {
    // Es categoría ENVASE / ENVASES
    if (grupoPrecioGranel) grupoPrecioGranel.classList.add('hidden');
    if (grupoPresentaciones) grupoPresentaciones.classList.remove('hidden');

    // Si no hay filas de precio, crea una por defecto con 'Unidad'
    if (listaPresentaciones && listaPresentaciones.children.length === 0) {
      crearFilaPresentacion('Unidad', '', '1');
    }
  }
}


// ==========================================================
// ACTUALIZAR AL CAMBIAR CATEGORÍA
// ==========================================================

if (prodCategoriaInput) {
  prodCategoriaInput.addEventListener('change', actualizarVisibilidadPorCategoria);
}


// ==========================================================
// PRESENTACIONES DINÁMICAS (SOLO ENVASES)
// ==========================================================

function crearFilaPresentacion(
  nombre = '',
  precio = '',
  equivalencia = '1'
) {
  if (!listaPresentaciones) return;

  const fila = document.createElement('div');
  fila.classList.add('fila-presentacion');

  fila.innerHTML = `
    <input
      type="text"
      class="presentacion-nombre"
      placeholder="Ej: Unidad, Caja x 10, Paquete"
      value="${nombre}"
    >

    <input
      type="number"
      class="presentacion-precio"
      placeholder="Precio ($)"
      min="0"
      value="${precio}"
    >

    <input
      type="number"
      step="0.001"
      class="presentacion-equivalencia"
      placeholder="Equivale a (unid)"
      min="0"
      value="${equivalencia}"
    >

    <button
      type="button"
      class="btn-quitar-presentacion"
      title="Eliminar opción"
    >
      <i class="fa-solid fa-trash"></i>
    </button>
  `;

  fila
    .querySelector('.btn-quitar-presentacion')
    .addEventListener('click', () => {
      fila.remove();
    });

  listaPresentaciones.appendChild(fila);
}


// ==========================================================
// AGREGAR PRESENTACIÓN
// ==========================================================

if (btnAgregarPresentacion) {
  btnAgregarPresentacion.addEventListener('click', () => {
    if (prodCategoriaInput && esCategoriaGranel(prodCategoriaInput.value)) {
      prodCategoriaInput.value = 'envases';
      actualizarVisibilidadPorCategoria();
    }
    crearFilaPresentacion();
  });
}


// ==========================================================
// OBTENER PRESENTACIONES DEL FORMULARIO (SOLO ENVASES)
// ==========================================================

function obtenerPresentacionesDelFormulario() {
  if (!listaPresentaciones) return [];

  const filas = listaPresentaciones.querySelectorAll('.fila-presentacion');
  const presentaciones = [];

  filas.forEach(fila => {
    const nombre = fila.querySelector('.presentacion-nombre').value.trim();
    const precio = parseFloat(fila.querySelector('.presentacion-precio').value) || 0;
    const equivaliaValor = fila.querySelector('.presentacion-equivalencia').value;
    const equivalencia = equivaliaValor === '' ? 1 : parseFloat(equivaliaValor);

    if (nombre) {
      presentaciones.push({
        nombre,
        precio,
        equivalencia
      });
    }
  });

  return presentaciones;
}


// ==========================================================
// CONSTRUIR Y CARGAR PRESENTACIONES A GRANEL
// ==========================================================

function construirPresentacionGranel(categoria) {
  const unidad = obtenerUnidadStock(categoria);
  const p1000 = parseFloat(inputPrecio1000 ? inputPrecio1000.value : 0) || 0;
  const p500 = parseFloat(inputPrecio500 ? inputPrecio500.value : 0) || Math.round(p1000 * 0.5);
  const p250 = parseFloat(inputPrecio250 ? inputPrecio250.value : 0) || Math.round(p1000 * 0.25);
  const p125 = parseFloat(inputPrecio125 ? inputPrecio125.value : 0) || Math.round(p1000 * 0.125);

  return [
    { nombre: `125 ${unidad}`, equivalencia: 125, precio: p125 },
    { nombre: `250 ${unidad}`, equivalencia: 250, precio: p250 },
    { nombre: `500 ${unidad}`, equivalencia: 500, precio: p500 },
    { nombre: `1000 ${unidad}`, equivalencia: 1000, precio: p1000 }
  ];
}

function cargarPreciosGranelEdicion(presentaciones) {
  const buscarPrecio = (eq) => {
    const p = presentaciones.find(item => Number(item.equivalencia) === eq);
    return p ? p.precio : '';
  };

  if (inputPrecio1000) inputPrecio1000.value = buscarPrecio(1000);
  if (inputPrecio500) inputPrecio500.value = buscarPrecio(500);
  if (inputPrecio250) inputPrecio250.value = buscarPrecio(250);
  if (inputPrecio125) inputPrecio125.value = buscarPrecio(125);
}


// ==========================================================
// AUTENTICACIÓN
// ==========================================================

onAuthStateChanged(auth, (user) => {
  if (user) {
    if (loginSection) loginSection.classList.add('hidden');
    if (panelSection) panelSection.classList.remove('hidden');
    if (userInfo) userInfo.classList.remove('hidden');
    if (userEmailSpan) userEmailSpan.textContent = user.email;

    cargarProductos();
  } else {
    if (loginSection) loginSection.classList.remove('hidden');
    if (panelSection) panelSection.classList.add('hidden');
    if (userInfo) userInfo.classList.add('hidden');
  }
});


// ==========================================================
// LOGIN
// ==========================================================

if (formLogin) {
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
}


// ==========================================================
// CERRAR SESIÓN
// ==========================================================

if (btnLogout) {
  btnLogout.addEventListener('click', () => {
    signOut(auth);
    mostrarToast('Sesión cerrada', 'exito');
  });
}


// ==========================================================
// CARGAR PRODUCTOS DESDE FIRESTORE
// ==========================================================

function cargarProductos() {
  onSnapshot(collection(db, 'productos'), (snapshot) => {
    todosLosProductos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    renderizarTabla(todosLosProductos);
  });
}


// ==========================================================
// RENDERIZAR TABLA
// ==========================================================

function renderizarTabla(productos) {
  if (!tablaBody) return;

  if (productos.length === 0) {
    tablaBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:16px; color:#888;">
          No hay productos registrados
        </td>
      </tr>
    `;
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
        <td><span style="color:${stockColor}; font-weight:600;">${stockTexto}</span></td>
        <td>${resumenPresentaciones || '—'}</td>
        <td>
          <div class="action-btns">
            <button class="btn-sm btn-edit" data-id="${p.id}">
              <i class="fa-solid fa-pen"></i> Editar
            </button>
            <button class="btn-sm btn-stock" data-id="${p.id}" data-stock="${tieneStock ? p.stock : ''}">
              <i class="fa-solid fa-cubes"></i> Ajustar
            </button>
            <button class="btn-sm btn-delete" data-id="${p.id}">
              <i class="fa-solid fa-trash"></i>
            </button>
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
// AJUSTE RÁPIDO DE STOCK
// ==========================================================

async function ajustarStockRapido(id, stockActual) {
  const producto = todosLosProductos.find(p => p.id === id);
  const unidad = producto ? obtenerUnidadStock(producto.categoria) : 'unid.';

  const nuevoValor = prompt(
    `Nuevo stock total en ${unidad} (deja vacío para ilimitado):`,
    stockActual || ''
  );

  if (nuevoValor === null) return;

  const texto = nuevoValor.trim();
  const stockNumerico = texto === '' ? null : parseFloat(texto);

  if (stockNumerico !== null && (isNaN(stockNumerico) || stockNumerico < 0)) {
    mostrarToast('Escribe un número válido (0 o mayor), o deja vacío para ilimitado', 'error');
    return;
  }

  try {
    await updateDoc(doc(db, 'productos', id), { stock: stockNumerico });
    mostrarToast(`Stock actualizado en ${unidad}`, 'exito');
  } catch (err) {
    mostrarToast('Error al actualizar stock: ' + err.message, 'error');
  }
}


// ==========================================================
// GUARDAR / ACTUALIZAR PRODUCTO
// ==========================================================

if (formProducto) {
  formProducto.addEventListener('submit', async (e) => {
    e.preventDefault();

    const categoria = prodCategoriaInput.value;
    let presentaciones;

    if (esCategoriaGranel(categoria)) {
      const precio1000 = parseFloat(inputPrecio1000 ? inputPrecio1000.value : 0) || 0;

      if (precio1000 <= 0) {
        mostrarToast(`Escribe al menos el precio para 1000 ${obtenerUnidadStock(categoria)}`, 'error');
        return;
      }

      presentaciones = construirPresentacionGranel(categoria);

    } else {
      presentaciones = obtenerPresentacionesDelFormulario();

      if (presentaciones.length === 0) {
        mostrarToast('Agrega al menos un precio para el envase', 'error');
        return;
      }
    }

    const stockValor = prodStockInput.value;
    const stock = stockValor === '' ? null : parseFloat(stockValor);

    const stockMinimoValor = prodStockMinimoInput.value;
    const stockMinimo = stockMinimoValor === '' ? null : parseFloat(stockMinimoValor);

    const id = prodIdInput.value;

    const dataProducto = {
      nombre: prodNombreInput.value.trim(),
      descripcion: prodDescripcionInput.value.trim(),
      categoria: categoria,
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
}


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

  actualizarVisibilidadPorCategoria();

  const presentacionesGuardadas = prod.presentaciones || [];

  if (esCategoriaGranel(prod.categoria)) {
    cargarPreciosGranelEdicion(presentacionesGuardadas);
    if (listaPresentaciones) listaPresentaciones.innerHTML = '';
  } else {
    if (inputPrecio1000) inputPrecio1000.value = '';
    if (inputPrecio500) inputPrecio500.value = '';
    if (inputPrecio250) inputPrecio250.value = '';
    if (inputPrecio125) inputPrecio125.value = '';

    if (listaPresentaciones) listaPresentaciones.innerHTML = '';

    presentacionesGuardadas.forEach(p => {
      crearFilaPresentacion(p.nombre, p.precio, p.equivalencia ?? '1');
    });

    if (presentacionesGuardadas.length === 0) {
      crearFilaPresentacion('Unidad', '', '1');
    }
  }

  if (formTitle) {
    formTitle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Editar Producto`;
  }

  if (btnCancelarEdit) {
    btnCancelarEdit.classList.remove('hidden');
  }

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


// ==========================================================
// CANCELAR EDICIÓN
// ==========================================================

if (btnCancelarEdit) {
  btnCancelarEdit.addEventListener('click', limpiarFormulario);
}


// ==========================================================
// LIMPIAR FORMULARIO
// ==========================================================

function limpiarFormulario() {
  if (formProducto) formProducto.reset();

  prodIdInput.value = '';
  prodStockInput.value = '';
  prodStockMinimoInput.value = '';

  if (inputPrecio1000) inputPrecio1000.value = '';
  if (inputPrecio500) inputPrecio500.value = '';
  if (inputPrecio250) inputPrecio250.value = '';
  if (inputPrecio125) inputPrecio125.value = '';

  if (listaPresentaciones) listaPresentaciones.innerHTML = '';

  actualizarVisibilidadPorCategoria();

  if (formTitle) {
    formTitle.innerHTML = `<i class="fa-solid fa-square-plus"></i> Registrar Producto`;
  }

  if (btnCancelarEdit) {
    btnCancelarEdit.classList.add('hidden');
  }
}


// ==========================================================
// INICIAR ESTADO DEL FORMULARIO
// ==========================================================

actualizarVisibilidadPorCategoria();


// ==========================================================
// IMPORTACIÓN MASIVA CSV
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
  if (lineas.length === 0) return [];

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


if (btnImportarCSV) {
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
            stock: (fila.stock === '' || fila.stock === undefined) ? null : parseFloat(fila.stock),
            stockMinimo: (fila.stock_minimo === '' || fila.stock_minimo === undefined) ? null : parseFloat(fila.stock_minimo),
            presentaciones: []
          };
        }

        if (fila.presentacion) {
          productosPorId[id].presentaciones.push({
            nombre: fila.presentacion,
            precio: parseFloat(fila.precio) || 0,
            equivalencia: (fila.equivalencia === '' || fila.equivalencia === undefined) ? 1 : parseFloat(fila.equivalencia)
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
}


if (btnDescargarPlantilla) {
  btnDescargarPlantilla.addEventListener('click', () => {
    const contenido =
      'id_producto,nombre,descripcion,categoria,imagen,stock,stock_minimo,presentacion,equivalencia,precio\n' +
      '1,Alcohol al 96%,Alcohol de alta pureza para limpieza,liquidos,imagenes/alcohol.jpg,5000,500,1000 ml,1000,10000\n' +
      '2,Bicarbonato de Sodio,Polvo multiusos,polvos,imagenes/bicarbonato.jpg,5000,500,1000 g,1000,8000\n' +
      '3,Envase plástico 500 ml,Envase reutilizable,envases,imagenes/envase.jpg,200,20,Unidad,1,1000\n';

    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');

    enlace.href = url;
    enlace.download = 'plantilla_productos.csv';
    enlace.click();

    URL.revokeObjectURL(url);
  });
}


// ==========================================================
// NOTIFICACIONES TOAST
// ==========================================================

function mostrarToast(msj, tipo) {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.innerHTML = `
    <i class="fa-solid ${tipo === 'exito' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>
    ${msj}
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}