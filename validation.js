/**
 * AUR+IA - Script de Validación, Sanitización y Conexión Front-End
 * Diseñado para Cuestionario_VyO.html (Vida y Obra)
 *
 * Reconstrucción completa de validation.js. Mantiene el contrato exacto
 * con el backend (IDs, nombres de campos, payload, endpoints) y corrige
 * los errores estructurales del archivo original:
 *   - cargarDatos() tenía el bloque try/catch mal cerrado: el try se
 *     cerraba antes de tiempo y el resto del código (campos profesionales,
 *     categorías, alert de éxito) quedaba fuera de la función, suelto en
 *     el archivo.
 *   - El bloque final que poblaba apodo/actividades/familia/amigos/
 *     mascotas/fechas/vida_extra vivía fuera de cualquier función,
 *     referenciando una variable "perfil" que no existía en ese scope
 *     (hubiera tirado ReferenceError al cargar el script).
 *   - mostrarModalExito() se llamaba desde handleFormSubmit() pero nunca
 *     estaba definida en el archivo.
 *   - cargarDatos() comprobaba response.status === 444 para "no
 *     encontrado", pero el backend responde 404 (ver /obtener-cuestionario
 *     en procesar_Cuestionario_vyo.py), así que esa rama nunca se
 *     ejecutaba.
 */

// =========================================================
// 1) INICIALIZACIÓN
// =========================================================

const BACKEND_URL = "http://127.0.0.1:5000";
const REQUEST_TIMEOUT_MS = 10000; // 10 segundos de límite de espera de red

// Variable de Estado del Flujo Activo ('integral' o 'profesional')
let flujoActivo = "profesional"; // Por defecto, según la especificación del HTML

document.addEventListener("DOMContentLoaded", () => {
    // Escuchar el evento de envío del formulario
    const form = document.getElementById("form-vyo");
    if (form) {
        form.addEventListener("submit", handleFormSubmit);
    }

    // Inicializar el flujo visual por defecto
    setFlujo("integral");

    // Formatear y validar en tiempo real la Clave de Aplicación de Google (16 caracteres)
    const claveInput = document.querySelector('input[name="clave_aplicacion"]');
    if (claveInput) {
        claveInput.addEventListener("input", (e) => {
            let val = e.target.value;
            // Remover todo lo que no sean letras latinas
            let cleanVal = val.replace(/[^a-zA-Z]/g, "").toLowerCase();

            // Limitar a 16 caracteres
            if (cleanVal.length > 16) {
                cleanVal = cleanVal.substring(0, 16);
            }

            // Formatear visualmente con espacios cada 4 letras (ej. abcd efgh ijkl mnop)
            let formatted = "";
            for (let i = 0; i < cleanVal.length; i++) {
                if (i > 0 && i % 4 === 0) {
                    formatted += " ";
                }
                formatted += cleanVal[i];
            }
            e.target.value = formatted;
        });

        claveInput.addEventListener("blur", (e) => {
            const rawKey = e.target.value.replace(/\s/g, "");
            if (rawKey.length > 0 && !validarClaveAplicacion(rawKey)) {
                alert("⚠️ La Clave de Conexión de Google debe tener exactamente 16 letras. Por favor, corrígela.");
                claveInput.style.borderColor = "#d9534f";
            } else if (rawKey.length === 16) {
                claveInput.style.borderColor = "#2E7D32"; // Borde verde si está bien
            }
        });
    }

    // Feedback visual en tiempo real para el celular (no bloquea, es de UX)
    const celularInput = document.querySelector('input[name="celular"]');
    if (celularInput) {
        celularInput.addEventListener("blur", (e) => {
            const valor = e.target.value.trim();
            if (valor.length === 0) {
                celularInput.style.borderColor = "";
                return;
            }
            celularInput.style.borderColor = validarCelular(valor) ? "#2E7D32" : "#d9534f";
        });
    }

    // Feedback visual en tiempo real para el email
    const emailInputInit = document.getElementById("email");
    if (emailInputInit) {
        emailInputInit.addEventListener("blur", (e) => {
            const valor = e.target.value.trim();
            if (valor.length === 0) {
                emailInputInit.style.borderColor = "";
                return;
            }
            emailInputInit.style.borderColor = validarEmail(valor) ? "#2E7D32" : "#d9534f";
        });
    }
});

// =========================================================
// 2) BIFURCACIÓN DE FLUJO: setFlujo()
// =========================================================

/**
 * Alterna de forma limpia entre el Modo Integral y Profesional.
 * Muestra/oculta los campos personales y sincroniza el toggle de cat2.
 */
function setFlujo(modo) {
    flujoActivo = modo;

    const btnIntegral = document.getElementById("btn-integral");
    const btnProfesional = document.getElementById("btn-profesional");
    const personalFieldsContainer = document.getElementById("personal-fields");

    const toggleCat2 = document.getElementById("toggle-cat2");
    const cat7 = document.getElementById("contenedor-cat7");

    if (!btnIntegral || !btnProfesional || !personalFieldsContainer) return;

    if (modo === "integral") {

        btnIntegral.classList.add("active");
        btnProfesional.classList.remove("active");

        personalFieldsContainer.style.display = "block";

        setTimeout(() => {
            personalFieldsContainer.style.opacity = "1";
        }, 50);

        const inputs = personalFieldsContainer.querySelectorAll("textarea, input");
        inputs.forEach(input => input.removeAttribute("disabled"));

        if (toggleCat2) {
            toggleCat2.checked = true;
            toggleCategoria2();
        }

        if (cat7) {
            cat7.classList.remove("cat-deshabilitada");
        }

        console.log("AUR+IA: Flujo establecido en INTEGRAL.");

    } else {

        btnProfesional.classList.add("active");
        btnIntegral.classList.remove("active");

        personalFieldsContainer.style.opacity = "0";

        setTimeout(() => {
            personalFieldsContainer.style.display = "none";
        }, 300);

        const inputs = personalFieldsContainer.querySelectorAll("textarea, input");

        inputs.forEach(input => {
            input.setAttribute("disabled", "true");
        });

        if (toggleCat2) {
            toggleCat2.checked = false;
            toggleCategoria2();
        }

        if (cat7) {
            cat7.classList.add("cat-deshabilitada");
        }

        console.log("AUR+IA: Flujo establecido en PROFESIONAL.");
    }
}

// =========================================================
// 3) VALIDACIÓN (email, clave_aplicacion, celular)
// =========================================================

/**
 * Valida formato de email de manera robusta (no solo "incluye @").
 */
function validarEmail(valor) {
    if (typeof valor !== "string") return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(valor.trim());
}

/**
 * La Clave de Conexión de Google debe tener exactamente 16 letras
 * (una vez removidos los espacios de formato visual).
 */
function validarClaveAplicacion(valor) {
    const raw = (valor || "").replace(/\s/g, "");
    return raw.length === 16;
}

/**
 * El celular es opcional (el backend lo acepta vacío), pero si se
 * completa debe tener forma de número de teléfono válido: solo
 * dígitos, con un "+" inicial opcional, entre 8 y 15 dígitos.
 */
function validarCelular(valor) {
    const raw = (valor || "").replace(/[\s\-]/g, "");
    if (raw.length === 0) return true;
    const regex = /^\+?[0-9]{8,15}$/;
    return regex.test(raw);
}

// =========================================================
// 4) SANITIZACIÓN DE TEXTOS
// =========================================================

/**
 * Sanitización de Textos (Client-Side HTML Escaping)
 * Protege los prompts contra inyecciones y previene exploits básicos de caracteres.
 */
function sanitizeText(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/\//g, "&#x2F;")
        .trim();
}

// =========================================================
// 5) ENVÍO DEL FORMULARIO: handleFormSubmit()
// =========================================================

/**
 * Control del Envío del Formulario (Submit Handler)
 * Recolecta la configuración en un JSON anidado, realiza validaciones previas,
 * gestiona el timeout de la red mediante AbortController y maneja estados visuales.
 */
async function handleFormSubmit(event) {
    event.preventDefault();

    const form = event.target;
    const submitBtn = form.querySelector(".btn-submit");
    const emailInput = document.getElementById("email");
    const claveInput = form.querySelector('input[name="clave_aplicacion"]');
    const celularInput = form.querySelector('input[name="celular"]');

    // Validación de email
    if (!emailInput || !validarEmail(emailInput.value)) {
        alert("❌ Por favor, introduce una dirección de correo electrónico válida.");
        if (emailInput) emailInput.focus();
        return;
    }

    // Validación de clave_aplicacion (si se completó, debe ser válida)
    const rawClave = claveInput ? claveInput.value.replace(/\s/g, "") : "";
    if (rawClave.length > 0 && !validarClaveAplicacion(rawClave)) {
        alert("❌ La Clave de Conexión de Google ingresada no es válida. Debe tener exactamente 16 letras.");
        if (claveInput) claveInput.focus();
        return;
    }

    // Validación de celular (si se completó, debe tener formato válido)
    if (celularInput && !validarCelular(celularInput.value)) {
        alert("❌ El número de celular ingresado no es válido. Usá solo números (podés incluir un '+' inicial), entre 8 y 15 dígitos.");
        celularInput.focus();
        return;
    }

    // Cambiar estado visual del botón (Loading State Premium)
    const originalBtnText = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
        submitBtn.innerHTML = `🌀 Guardando Configuración VyO en Servidor Local...`;
        submitBtn.disabled = true;
    }

    // Construcción del Objeto JSON Estructurado para el Backend
    const formData = new FormData(form);

    console.log("NOMBRE =", formData.get("nombre"));
    console.log("EMAIL =", formData.get("email_contacto"));
    console.log("EMPRESA =", formData.get("empresa"));
    console.log(formData);

    const payload = {
        flujo: flujoActivo,
        email_contacto: emailInput.value.trim().toLowerCase(),
        email_servicio: formData.get("email_servicio") || "auria.desarrollo@gmail.com",
        nombre: sanitizeText(formData.get("nombre")),
        celular: sanitizeText(formData.get("celular")),
        clave_aplicacion: rawClave,

        // Datos de Obra (Profesionales)
        tarea_profesional: sanitizeText(formData.get("tarea_profesional")),
        fricciones_operativas: sanitizeText(formData.get("fricciones_operativas")),
        prioridades_delegacion: sanitizeText(formData.get("prioridades_delegacion")),
        tipo_empleo: sanitizeText(formData.get("tipo_empleo")),
        empresa: sanitizeText(formData.get("empresa")),
        companeros: sanitizeText(formData.get("companeros")),
        social_extra: sanitizeText(formData.get("social_extra")),
        obra_extra: sanitizeText(formData.get("obra_extra")),

        // ==========================================
        // COMIENZO PERSISTENCIA CONOCIMIENTO MANUAL
        // ==========================================

        conocimiento_manual: sanitizeText(
            document.getElementById("conocimiento_manual").value
        ),

        // ==========================================
        // FIN PERSISTENCIA CONOCIMIENTO MANUAL
        // ==========================================

        // Subcontenedor de Categorías Postales
        categorias: {}
    };
    // Biblioteca del Modo Manual
    payload.biblioteca_manual = bibliotecaServidor;

    // Agregar campos del Modo Integral si está activo
    if (flujoActivo === "integral") {
        payload.apodo = sanitizeText(formData.get("apodo"));
        payload.actividades = sanitizeText(formData.get("actividades"));
        payload.familia = sanitizeText(formData.get("familia"));
        payload.amigos = sanitizeText(formData.get("amigos"));
        payload.mascotas = sanitizeText(formData.get("mascotas"));
        payload.fechas = sanitizeText(formData.get("fechas"));
        payload.vida_extra = sanitizeText(formData.get("vida_extra"));
    }

    // Mapear la configuración detallada de cada categoría postal (1 a 9)
    for (let i = 1; i <= 9; i++) {
        // En el HTML, toggle-cat2 es un checkbox. Las demás pueden estar activas por defecto
        const toggleEl = document.getElementById(`toggle-cat${i}`);
        const isEnabled = toggleEl ? toggleEl.checked : true;

        payload.categorias[i] = {
            enabled: isEnabled,
            modo: formData.get(`cat${i}_modo`) || "revision",
            tono: sanitizeText(formData.get(`cat${i}_tono`)),

            personalizado:
                i === 9
                    ? ""
                    : sanitizeText(formData.get(`cat${i}_personalizado`)) || "",

            remitentes:
                i === 2
                    ? sanitizeText(formData.get("cat2_contactos"))
                    : i === 9
                        ? sanitizeText(formData.get("cat9_bloqueados"))
                        : sanitizeText(formData.get(`cat${i}_remitentes`))
        };
    }

    // Envío Robusto de Datos con Manejo de Excepciones y Timeouts
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(`${BACKEND_URL}/enviar-cuestionario`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const result = await response.json();

        if (response.ok && result.status === "success") {

            mostrarModalExito();

            // ==========================================
            // Enviar Biblioteca de Archivos Personales
            // ==========================================

            console.log("ANTES DEL IF:", bibliotecaPendiente.length);

            if (bibliotecaPendiente.length > 0) {

                const fdBiblioteca = new FormData();

                fdBiblioteca.append(
                    "email",
                    emailInput.value.trim().toLowerCase()
                );

                bibliotecaPendiente.forEach(file => {
                    fdBiblioteca.append("archivos", file);
                });

                const respuestaBiblioteca = await fetch(`${BACKEND_URL}/subir-biblioteca`, {
                    method: "POST",
                    body: fdBiblioteca
                });

                if (respuestaBiblioteca.ok) {

                    mostrarMensajeBiblioteca(
                        `✅ "${bibliotecaPendiente.map(f => f.name).join(", ")}" fue agregado correctamente a tu Biblioteca Personal.`
                    );

                    bibliotecaPendiente = [];

                    inputBiblioteca.value = "";

                    mostrarArchivosPendientes();

                }

            }

            console.log("AUR+IA: Respuesta exitosa del backend.", result);

        } else {

            throw new Error(result.message || `Error del servidor (Código ${response.status})`);

        }

    } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === "AbortError") {
            alert("⏱️ La petición de guardado ha excedido el tiempo de espera (Timeout). Comprueba si el servidor local de AUR+IA está activo en el puerto 5000.");
        } else if (error.message.includes("Failed to fetch")) {
            alert("❌ No se pudo conectar con el Backend local. Asegúrate de ejecutar 'python app.py' en tu consola local para que esté listo en http://127.0.0.1:5000");
        } else {
            alert(`⚠️ Error al enviar el cuestionario: ${error.message}`);
        }
        console.error("AUR+IA: Error en conexión Front-Back:", error);
    } finally {
        // Restaurar estado del botón
        if (submitBtn) {
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
        }
    }
}

// =========================================================
// 6) AUTOCOMPLETADO DEL FORMULARIO: cargarDatos()
// =========================================================

/**
 * Solicita los datos previos del usuario en base a su email y
 * puebla TODOS los campos (personales, profesionales y las 9
 * categorías). Siempre abre el formulario en modo Integral para
 * que se vea absolutamente toda la información recuperada.
 */
async function cargarDatos() {
    const emailInput = document.getElementById("email");
    if (!emailInput || !validarEmail(emailInput.value)) {
        alert("❌ Por favor, escribe tu dirección de email principal para recuperar tus configuraciones.");
        if (emailInput) emailInput.focus();
        return;
    }

    const email = emailInput.value.trim().toLowerCase();
    const btnCargar = document.querySelector(".btn-cargar");
    const originalText = btnCargar ? btnCargar.innerText : "";

    if (btnCargar) {
        btnCargar.innerText = "Cargando...";
        btnCargar.disabled = true;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/obtener-cuestionario/${encodeURIComponent(email)}`);

        // El backend (procesar_Cuestionario_vyo.py) responde 404 cuando no
        // encuentra el perfil, no 444.
        if (response.status === 404) {
            alert(`ℹ️ No se encontró ninguna configuración guardada anteriormente para el email: ${email}\n\nPodés comenzar a rellenar el formulario e iniciar tu registro.`);
            return;
        }

        if (!response.ok) {
            const errJson = await response.json();
            throw new Error(errJson.message || "Fallo en la comunicación.");
        }

        const respuesta = await response.json();
        const perfil = respuesta.data;
        console.log("PERFIL RECIBIDO:", perfil);

        const asignar = (id, valor) => {
            const el = document.getElementById(id);
            if (el) el.value = valor || "";
        };

        // Campos principales
        asignar("nombre", perfil.nombre);
        asignar("celular", perfil.celular);

        if (perfil.clave_aplicacion) {
            const claveInput = document.querySelector('input[name="clave_aplicacion"]');
            if (claveInput) {
                claveInput.value = perfil.clave_aplicacion;
                claveInput.style.borderColor = "#2E7D32";
            }
        }

        // Siempre se abre en modo Integral para mostrar absolutamente todos los datos
        setFlujo("integral");

        // Campos personales
        asignar("apodo", perfil.apodo);
        asignar("actividades", perfil.actividades);
        asignar("familia", perfil.familia);
        asignar("amigos", perfil.amigos);
        asignar("mascotas", perfil.mascotas);
        asignar("fechas", perfil.fechas);
        asignar("vida_extra", perfil.vida_extra);

        // Campos profesionales
        asignar("tarea_profesional", perfil.tarea_profesional);
        asignar("fricciones_operativas", perfil.fricciones_operativas);
        asignar("prioridades_delegacion", perfil.prioridades_delegacion);
        asignar("tipo_empleo", perfil.tipo_empleo);
        asignar("empresa", perfil.empresa);
        asignar("companeros", perfil.companeros);
        asignar("social_extra", perfil.social_extra);
        asignar("obra_extra", perfil.obra_extra);

        // ==========================================
        // COMIENZO RECUPERAR CONOCIMIENTO MANUAL
        // ==========================================

        asignar("conocimiento_manual", perfil.conocimiento_manual);

        // ==========================================
        // FIN RECUPERAR CONOCIMIENTO MANUAL
        // ==========================================

        // Categorías 1 a 9
        asignar("cat1_modo", perfil.cat1_modo);
        asignar("cat1_tono", perfil.cat1_tono);
        asignar("cat1_personalizado", perfil.cat1_personalizado);
        asignar("cat1_remitentes", perfil.cat1_remitentes);

        asignar("cat2_modo", perfil.cat2_modo);
        asignar("cat2_tono", perfil.cat2_tono);
        asignar("cat2_contactos", perfil.cat2_contactos);

        asignar("cat3_modo", perfil.cat3_modo);
        asignar("cat3_tono", perfil.cat3_tono);
        asignar("cat3_personalizado", perfil.cat3_personalizado);

        asignar("cat4_modo", perfil.cat4_modo);
        asignar("cat4_tono", perfil.cat4_tono);
        asignar("cat4_personalizado", perfil.cat4_personalizado);

        asignar("cat5_modo", perfil.cat5_modo);
        asignar("cat5_tono", perfil.cat5_tono);

        asignar("cat6_modo", perfil.cat6_modo);
        asignar("cat6_tono", perfil.cat6_tono);

        asignar("cat7_modo", perfil.cat7_modo);
        asignar("cat7_tono", perfil.cat7_tono);

        asignar("cat8_modo", perfil.cat8_modo);
        asignar("cat8_tono", perfil.cat8_tono);

        asignar("cat9_modo", perfil.cat9_modo);
        asignar("cat9_bloqueados", perfil.cat9_bloqueados);

        bibliotecaServidor = perfil.biblioteca_manual || [];

        console.log("bibliotecaServidor:", bibliotecaServidor);

        mostrarBibliotecaExistente(bibliotecaServidor);
        alert("✨ ¡La Magia ha ocurrido! Tus datos guardados han sido recuperados exitosamente.");

    } catch (err) {
        alert(`❌ Error al recuperar tus datos: ${err.message}`);
        console.error("AUR+IA: Error al recuperar datos de usuario:", err);
    } finally {
        if (btnCargar) {
            btnCargar.innerText = originalText;
            btnCargar.disabled = false;
        }
    }
}

// =========================================================
// 7) TOGGLE VISUAL DE CATEGORÍA 2: toggleCategoria2()
// =========================================================

/**
 * Soporte interactivo para el toggle visual de las categorías.
 * Añade la clase de opacidad (.cat-deshabilitada) al desactivar el checkbox.
 */
function toggleCategoria2() {
    const checkbox = document.getElementById("toggle-cat2");
    const contenedor = document.getElementById("contenedor-cat2");
    const camposInternos = document.getElementById("campos-internos-cat2");

    if (!checkbox || !contenedor || !camposInternos) return;

    if (checkbox.checked) {
        contenedor.classList.remove("cat-deshabilitada");
        camposInternos.style.opacity = "1";
        camposInternos.style.maxHeight = "500px";
        const inputs = camposInternos.querySelectorAll("textarea, select");
        inputs.forEach(el => el.removeAttribute("disabled"));
    } else {
        contenedor.classList.add("cat-deshabilitada");
        camposInternos.style.opacity = "0.2";
        camposInternos.style.maxHeight = "0"; // Esconde el contenido de forma animada
        const inputs = camposInternos.querySelectorAll("textarea, select");
        inputs.forEach(el => el.setAttribute("disabled", "true"));
    }
}

// =========================================================
// 8) MODAL DE ÉXITO
// =========================================================

/**
 * Muestra el modal de éxito al guardar la configuración correctamente.
 * Busca el modal por su id convencional (#modal-exito). Si el HTML
 * todavía no tiene ese modal, cae a un alert() para no romper el flujo
 * de guardado (handleFormSubmit ya confirmó que el backend respondió
 * "success" antes de llegar acá).
 */
function mostrarModalExito() {
    const modal = document.getElementById("modal-exito");

    if (!modal) {
        alert("✅ ¡Configuración guardada con éxito en AUR+IA!");
        return;
    }

    modal.classList.add("visible");
    modal.style.display = "flex";

    window.scrollTo({ top: 0, behavior: "smooth" });

}
// ======================================================
// Pantalla inicial de selección de modalidad
// ======================================================

document.addEventListener("DOMContentLoaded", function () {

    const pantalla = document.getElementById("pantalla-inicial-auria");
    const bloque = document.getElementById("bloque-cuestionario");

    if (pantalla && bloque) {
        bloque.style.display = "none";
        pantalla.style.display = "block";
    }

});


function volverAlInicio() {

    if (typeof window.volverAlInicioHTML === "function") {
        window.volverAlInicioHTML();
        return;
    }

}
// ======================================================
// Biblioteca Visual de Conocimiento
// ======================================================

// Biblioteca persistida en el servidor
let bibliotecaServidor = [];

// Archivos seleccionados que aún no fueron enviados
let bibliotecaPendiente = [];


let paginaActual = 1;
const ARCHIVOS_POR_PAGINA = 20;

const inputBiblioteca = document.getElementById("biblioteca_manual");
const listaBiblioteca = document.getElementById("lista-archivos-manual");
const listaPendientes = document.getElementById("lista-archivos-pendientes");

if (inputBiblioteca) {

    inputBiblioteca.addEventListener("change", function () {

        Array.from(this.files).forEach(file => {

            bibliotecaPendiente.push(file);

        });

        this.value = "";

        mostrarArchivosPendientes();

        mostrarMensajeBiblioteca(
            "✅ \"" + bibliotecaPendiente[bibliotecaPendiente.length - 1].name + "\" fue agregado a tu Biblioteca Personal."
        );

    });

}

mostrarArchivosPendientes()

function mostrarMensajeBiblioteca(texto, tipo = "success") {

    const mensaje = document.getElementById("mensaje-biblioteca");

    if (!mensaje) return;

    mensaje.textContent = texto;

    mensaje.className = "mensaje-biblioteca " + tipo;

    mensaje.style.display = "block";

    clearTimeout(mensaje._temporizador);

    mensaje._temporizador = setTimeout(() => {

        mensaje.style.display = "none";

    }, 3500);

}

function mostrarArchivosPendientes() {

    if (!listaPendientes) return;

    listaPendientes.innerHTML = "";

    if (bibliotecaPendiente.length === 0) {
        listaPendientes.style.display = "none";
        return;
    }

    listaPendientes.style.display = "block";

    bibliotecaPendiente.forEach((archivo, indice) => {

        const fila = document.createElement("div");

        fila.className = "item-archivo";

        fila.innerHTML = `
            📄 <strong>${archivo.name}</strong>

            <button
                type="button"
                class="btn-eliminar-archivo"
                onclick="eliminarArchivoManual(${indice})">

                ❌ Quitar

            </button>
        `;

        listaPendientes.appendChild(fila);

    });

}

function mostrarBibliotecaExistente(lista) {

    if (!listaBiblioteca) return;

    // ==========================================
    // comienzo BUSCADOR
    // ==========================================

    const buscador = document.getElementById("buscador-biblioteca");

    if (buscador && buscador.value.trim() !== "") {

        const texto = buscador.value.toLowerCase();

        lista = lista.filter(archivo =>
            archivo.nombre.toLowerCase().includes(texto)
        );

    }
    // ==========================================
    // fin BUSCADOR
    // ==========================================

    // ==========================================
    // COMIENZO ORDENAMIENTO
    // ==========================================

    const selectorOrden = document.getElementById("orden-biblioteca");

    console.log("Orden seleccionado:", selectorOrden.value);
    console.log(lista.map(a => a.nombre));

    if (selectorOrden) {

        if (selectorOrden.value === "nombre") {

            lista.sort((a, b) =>
                a.nombre.localeCompare(b.nombre)
            );

        } else {

            lista.reverse();

        }
    }

    // ==========================================
    // FIN ORDENAMIENTO
    // ==========================================

    listaBiblioteca.innerHTML = "";

    if (lista.length === 0) {
        listaBiblioteca.innerHTML = `
        <div class="biblioteca-vacia">
            📂 Aún no agregaste ningún archivo a tu Biblioteca Personal.
        </div>
    `;
        return;
    }

    // -----------------------------
    // Paginación
    // -----------------------------
    const inicio = (paginaActual - 1) * ARCHIVOS_POR_PAGINA;
    const fin = inicio + ARCHIVOS_POR_PAGINA;

    const archivosPagina = lista.slice(inicio, fin);

    // Mostrar únicamente los archivos de la página actual
    archivosPagina.forEach(archivo => {

        const fila = document.createElement("div");

        fila.className = "item-archivo";

        const tamañoKB = (archivo.tamaño / 1024).toFixed(1);

        fila.innerHTML = `
    <div class="archivo-nombre">
        📄 <strong>${archivo.nombre}</strong><br>
        <small>${tamañoKB} KB</small>
    </div>

    <div class="acciones-archivo">

        <button
            type="button"
            class="btn-ver"
            onclick='verArchivo(${JSON.stringify(archivo.nombre)})'>
            👁 Ver
        </button>

        <button
            type="button"
            class="btn-descargar"
            onclick='descargarArchivo(${JSON.stringify(archivo.nombre)})'>
            ⬇ Descargar
        </button>

        <button
            type="button"
            class="btn-eliminar"
            onclick="eliminarArchivoServidor('${archivo.nombre}')">
            🗑 Eliminar
        </button>

    </div>
`;

        listaBiblioteca.appendChild(fila);

    });

    // ==========================================
    // COMIENZO ACTUALIZAR PAGINACIÓN
    // ==========================================

    const totalPaginas = Math.max(
        1,
        Math.ceil(lista.length / ARCHIVOS_POR_PAGINA)
    );

    document.getElementById("texto-paginacion").textContent =
        `Página ${paginaActual} de ${totalPaginas}`;

    document.getElementById("btn-pagina-anterior").disabled =
        (paginaActual === 1);

    document.getElementById("btn-pagina-siguiente").disabled =
        (paginaActual === totalPaginas);

    // ==========================================
    // FIN ACTUALIZAR PAGINACIÓN
    // ==========================================

}

function eliminarArchivoManual(indice) {

    bibliotecaPendiente.splice(indice, 1);

    mostrarArchivosPendientes();

}

// ==========================================
// COMIENZO "VER" ARCHIVO
// ==========================================

function verArchivo(nombre) {

    const email = document
        .getElementById("email")
        .value
        .trim()
        .toLowerCase();

    fetch(`${BACKEND_URL}/obtener-cuestionario/${encodeURIComponent(email)}`)
        .then(r => r.json())
        .then(res => {

            const cliente_id = res.data.cliente_id;

            window.open(
                `${BACKEND_URL}/ver-archivo/${cliente_id}/${encodeURIComponent(nombre)}`,
                "_blank"
            );

        });

}

// ==========================================
// FIN "VER" ARCHIVO
// ==========================================
// ==========================================
// COMIENZO "DESCARGAR" ARCHIVO
// ==========================================

function descargarArchivo(nombre) {

    const email = document
        .getElementById("email")
        .value
        .trim()
        .toLowerCase();

    fetch(`${BACKEND_URL}/obtener-cuestionario/${encodeURIComponent(email)}`)
        .then(r => r.json())
        .then(res => {

            const cliente_id = res.data.cliente_id;

            window.open(
                `${BACKEND_URL}/descargar-archivo/${cliente_id}/${encodeURIComponent(nombre)}`,
                "_blank"
            );

        });

}

// ==========================================
// FIN "DESCARGAR" ARCHIVO
// ==========================================

// ==========================================
// COMIENZO "ELIMINAR" ARCHIVO
// ==========================================

function eliminarArchivoServidor(nombre) {

    if (!confirm(`¿Eliminar "${nombre}"?`)) return;

    const email = document
        .getElementById("email")
        .value
        .trim()
        .toLowerCase();

    fetch(`${BACKEND_URL}/obtener-cuestionario/${encodeURIComponent(email)}`)
        .then(r => r.json())
        .then(res => {

            const cliente_id = res.data.cliente_id;

            return fetch(
                `${BACKEND_URL}/eliminar-archivo/${cliente_id}/${encodeURIComponent(nombre)}`,
                {
                    method: "DELETE"
                }
            );

        })
        .then(r => r.json())
        .then(res => {

            alert(res.message);

            return fetch(`${BACKEND_URL}/obtener-cuestionario/${encodeURIComponent(email)}`);

        })
        .then(r => r.json())
        .then(res => {

            bibliotecaServidor = res.data.biblioteca_manual || [];

            if (paginaActual > Math.ceil(bibliotecaServidor.length / ARCHIVOS_POR_PAGINA)) {
                paginaActual = Math.max(1, Math.ceil(bibliotecaServidor.length / ARCHIVOS_POR_PAGINA));
            }

            mostrarBibliotecaExistente(bibliotecaServidor);

        })
        .catch(err => {

            console.error(err);

            alert("Error eliminando archivo.");

        });

}

// ==========================================
// FIN "ELIMINAR" ARCHIVO
// ==========================================

// ==========================================
// COMIENZO PAGINACIÓN
// ==========================================

document.getElementById("btn-pagina-anterior").addEventListener("click", () => {

    if (paginaActual > 1) {

        paginaActual--;

        mostrarBibliotecaExistente(bibliotecaServidor);

    }

});

document.getElementById("btn-pagina-siguiente").addEventListener("click", () => {

    const totalPaginas = Math.ceil(
        bibliotecaServidor.length / ARCHIVOS_POR_PAGINA
    );

    if (paginaActual < totalPaginas) {

        paginaActual++;

        mostrarBibliotecaExistente(bibliotecaServidor);

    }

});

// ==========================================
// FIN PAGINACIÓN
// =========================================