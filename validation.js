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

    // -----------------------------------------------------------------
    // DETECCIÓN DE MODO Y VALIDACIÓN CONDICIONAL
    // -----------------------------------------------------------------
    const emailValor = emailInput ? emailInput.value.trim().toLowerCase() : "";

    // ÚNICAMENTE si el usuario escribió un email (y no está vacío), validamos su formato.
    // Si está vacío (como en Modo MANUAL), NO se bloquea la ejecución.
    if (emailValor.length > 0) {
        if (!validarEmail(emailValor)) {
            alert("❌ Por favor, introduce una dirección de correo electrónico válida.");
            if (emailInput) emailInput.focus();
            return;
        }
    }

    // Validación de clave_aplicacion (si se completó, debe ser válida)
    const rawClave = claveInput ? claveInput.value.replace(/\s/g, "") : "";
    if (rawClave.length > 0 && !validarClaveAplicacion(rawClave)) {
        alert("❌ La Clave de Conexión de Google ingresada no es válida. Debe tener exactamente 16 letras.");
        if (claveInput) claveInput.focus();
        return;
    }

    // Validación de celular (solo si el usuario escribió algo)
    if (celularInput && celularInput.value.trim().length > 0 && !validarCelular(celularInput.value)) {
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
        codigo_usuario: (formData.get("codigo_usu") || "").trim().toUpperCase(),  // ← LÍNEA NUEVA
        email_contacto: emailValor.length > 0 ? emailValor : "modo_manual@local.com",
        email_servicio: formData.get("email_servicio") || "auria.desarrollo@gmail.com",
        nombre: sanitizeText(formData.get("nombre")),
        celular: sanitizeText(formData.get("celular")),
        clave_aplicacion: rawClave,
        // ... el resto sigue exactamente igual, sin tocar nada más

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


            // La persona nueva recibe su código: se muestra en el campo para que los próximos envíos actualicen a la misma persona
            const campoUSU = document.getElementById("codigo_usu");
            if (campoUSU && result.codigo_usuario) {
                campoUSU.value = result.codigo_usuario;
            }

            // Si la base confirma que la clave quedó guardada, se borra de la pantalla y deja de exigirse
            if (result.clave_guardada && claveInput) {
                claveInput.value = "";
                claveInput.removeAttribute("required");
                claveInput.placeholder = "Clave ya guardada ✓ (escribí una nueva solo si querés cambiarla)";
            }

            // Si falta la contraseña de aplicación, se avisa con amabilidad (sin bloquear nada)
            if (result.aviso) {
                mostrarAlertaVyo("ℹ️ " + result.aviso, "info");
            }

            // ==========================================
            // Enviar Biblioteca de Archivos Personales
            // ==========================================

            // Persona nueva: se le muestra, una sola vez, su código y su clave de acceso
            if (result.clave_acceso) {
                alert("✅ Tus datos se guardaron.\n\nTU CÓDIGO: " + result.codigo_usuario + "\nTU CLAVE DE ACCESO: " + result.clave_acceso + "\n\nAnotalos ahora en un lugar seguro: la clave NO se vuelve a mostrar. Los vas a necesitar para volver a cargar tus datos.");

                if (document.getElementById("chk-recordarme") && document.getElementById("chk-recordarme").checked) {
                    guardarEnElNavegador(result.codigo_usuario, result.clave_acceso);
                }
            }

            // Muestra el cartel de ÉXITO con AURelia y AURhelios
            mostrarModalExito();

            console.log("ANTES DEL IF:", bibliotecaPendiente.length);

            if (bibliotecaPendiente.length > 0) {

                const fdBiblioteca = new FormData();

                fdBiblioteca.append(
                    "codigo_usuario",
                    result.codigo_usuario || document.getElementById("codigo_usu").value.trim().toUpperCase()
                );

                bibliotecaPendiente.forEach(file => {
                    fdBiblioteca.append("archivo", file);
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
function poblarFormulario(datos) {
    // Código de usuario
    const inputUSU = document.getElementById("codigo_usu");
    if (inputUSU && datos.codigo_usuario) {
        inputUSU.value = datos.codigo_usuario;
    }

    // Nombre completo
    const inputNombre = document.getElementById("nombre");
    if (inputNombre && datos.nombre) {
        inputNombre.value = datos.nombre;
    }

    // Email de contacto (aplica sobre todo a Modo AUTOMÁTICO)
    const inputEmail = document.getElementById("email");
    if (inputEmail && datos.email_contacto) {
        inputEmail.value = datos.email_contacto;
    }

    // Celular
    const inputCelular = document.getElementById("celular");
    if (inputCelular && datos.celular) {
        inputCelular.value = datos.celular;
    }

    // email_servicio no se toca: es un campo oculto con valor fijo, no hace falta autocompletarlo
    // ===== AGREGADO: campos personales, profesionales y Biblioteca =====
    const jsonInfo = datos.json_conocimiento || {};
    const perfil = jsonInfo.perfil_usuario || {};
    const vinculos = perfil.vinculos_y_entorno || {};
    const profesional = jsonInfo.esfera_profesional || {};

    // Vida personal (Modo INTEGRAL)
    const campoApodo = document.getElementById("apodo");
    if (campoApodo && perfil.apodo_preferido) campoApodo.value = perfil.apodo_preferido;

    const campoActividades = document.getElementById("actividades");
    if (campoActividades && perfil.actividades_y_hobbies) campoActividades.value = perfil.actividades_y_hobbies;

    const campoFamilia = document.getElementById("familia");
    if (campoFamilia && vinculos.familia) campoFamilia.value = vinculos.familia;

    const campoAmigos = document.getElementById("amigos");
    if (campoAmigos && vinculos.amigos) campoAmigos.value = vinculos.amigos;

    const campoMascotas = document.getElementById("mascotas");
    if (campoMascotas && vinculos.mascotas) campoMascotas.value = vinculos.mascotas;

    const campoFechas = document.getElementById("fechas");
    if (campoFechas && vinculos.fechas_importantes) campoFechas.value = vinculos.fechas_importantes;

    // Vida profesional (ambos modos)
    const campoTarea = document.getElementById("tarea_profesional");
    if (campoTarea && profesional.rol) campoTarea.value = profesional.rol;

    const campoTipoEmpleo = document.getElementById("tipo_empleo");
    if (campoTipoEmpleo && profesional.tipo_empleo) campoTipoEmpleo.value = profesional.tipo_empleo;

    const campoEmpresa = document.getElementById("empresa");
    if (campoEmpresa && profesional.empresa_o_proyecto) campoEmpresa.value = profesional.empresa_o_proyecto;

    const campoCompaneros = document.getElementById("companeros");
    if (campoCompaneros && profesional.companeros_clave) campoCompaneros.value = profesional.companeros_clave;

    const campoSocialExtra = document.getElementById("social_extra");
    if (campoSocialExtra && profesional.social_extra) campoSocialExtra.value = profesional.social_extra;

    const campoObraExtra = document.getElementById("obra_extra");
    if (campoObraExtra && profesional.obra_extra) campoObraExtra.value = profesional.obra_extra;

    const campoVidaExtra = document.getElementById("vida_extra");
    if (campoVidaExtra && profesional.vida_extra) campoVidaExtra.value = profesional.vida_extra;


    const campoFricciones = document.getElementById("fricciones_operativas");
    if (campoFricciones && profesional.fricciones_operativas) campoFricciones.value = profesional.fricciones_operativas;

    const campoPrioridades = document.getElementById("prioridades_delegacion");
    if (campoPrioridades && profesional.prioridades_delegacion) campoPrioridades.value = profesional.prioridades_delegacion;

    // Clave de aplicación: nunca se muestra; solo se avisa si ya hay una guardada
    const campoClave = document.querySelector('input[name="clave_aplicacion"]');
    if (campoClave && datos.clave_guardada) {
        campoClave.removeAttribute("required");
        campoClave.placeholder = "Clave ya guardada ✓ (escribí una nueva solo si querés cambiarla)";
    }
    // Biblioteca Personal: mostrar los archivos ya guardados
    if (jsonInfo.biblioteca_manual && typeof mostrarBibliotecaExistente === "function") {
        bibliotecaServidor = jsonInfo.biblioteca_manual;
        mostrarBibliotecaExistente(bibliotecaServidor);
    }
}
/**
 * Solicita los datos previos del usuario en base a su email y
 * puebla TODOS los campos (personales, profesionales y las 9
 * categorías). Siempre abre el formulario en modo Integral para
 * que se vea absolutamente toda la información recuperada.
 */
async function cargarDatos() {
    const codigoUsuInput = document.getElementById("codigo_usu");
    const claveInput = document.getElementById("clave_acceso_usu");
    const chkRecordar = document.getElementById("chk-recordarme");
    const recordar = !!(chkRecordar && chkRecordar.checked);
    const codigo_usu = codigoUsuInput ? codigoUsuInput.value.trim().toUpperCase() : "";
    const clave = claveInput ? claveInput.value.trim() : "";

    if (!codigo_usu || !clave) {
        mostrarMensajeAcceso('❌ Escribí tu código de usuario (USU-XXXX) y tu clave de acceso para recargar tus datos.', 'error');
        return;
    }

    const btnCargar = document.querySelector(".btn-cargar");
    const originalText = btnCargar ? btnCargar.innerText : "";
    if (btnCargar) {
        btnCargar.innerText = "Cargando...";
        btnCargar.disabled = true;
    }

    try {
        const respuesta = await fetch(`${BACKEND_URL}/cargar-datos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigo_usu: codigo_usu, clave: clave, recordar: recordar })
        });
        const data = await respuesta.json();

        if (respuesta.ok && data.status === "success") {
            if (data.datos) {
                poblarFormulario(data.datos);
                if (data.datos.modo === "automatico") {
                    activarModoAutomaticoSinRetorno();
                }
            }
            if (recordar) {
                guardarEnElNavegador(codigo_usu, clave);   // solo si la persona dijo que es su equipo
            }
            if (claveInput) {
                claveInput.value = "";
            }
            mostrarCierreDeSesion(true);
            mostrarIdentidad(data.datos);
            mostrarMensajeAcceso('✅ Datos cargados correctamente.', 'exito');
        } else {
            mostrarMensajeAcceso('⚠️ ' + (data.message || 'No se pudieron cargar los datos.') + ' ¿Olvidaste tu código o tu clave? Usá el enlace que está debajo.', 'error');
        }
    } catch (error) {
        console.error("Error al cargar datos:", error);
        mostrarMensajeAcceso('❌ Error de conexión al intentar recargar tus datos.', 'error');
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

// ==========================================
// BIBLIOTECA: selección múltiple y eliminación en un solo clic (versión 2 — 21/10/2026)
// ==========================================
const archivosSeleccionados = new Set();   // nombres de los archivos tildados
let nombresFiltrados = [];                 // nombres de todos los archivos que muestra la lista (según el buscador)
let ultimoTextoBusqueda = "";              // para volver a la página 1 cuando cambia la búsqueda

function crearBotonArchivo(clase, texto, accion) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = clase;
    boton.textContent = texto;
    boton.addEventListener("click", accion);
    return boton;
}

function seleccionadosVisibles() {
    return nombresFiltrados.filter(n => archivosSeleccionados.has(n));
}

function asegurarBarraSeleccion() {
    let barra = document.getElementById("barra-seleccion-biblioteca");
    if (barra) return barra;

    barra = document.createElement("div");
    barra.id = "barra-seleccion-biblioteca";
    barra.style.cssText = "display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin:10px 0; padding:8px 12px; border:1px solid #cfcfcf; border-radius:8px;";

    const etiqueta = document.createElement("label");
    etiqueta.style.cursor = "pointer";
    const chkTodos = document.createElement("input");
    chkTodos.type = "checkbox";
    chkTodos.id = "chk-seleccionar-todos";
    etiqueta.append(chkTodos, " Seleccionar todos");

    const texto = document.createElement("span");
    texto.id = "texto-seleccionados";

    const boton = document.createElement("button");
    boton.type = "button";
    boton.id = "btn-eliminar-seleccionados";
    boton.style.cursor = "pointer";
    boton.addEventListener("click", eliminarSeleccionados);

    chkTodos.addEventListener("change", () => {
        if (chkTodos.checked) {
            nombresFiltrados.forEach(n => archivosSeleccionados.add(n));
        } else {
            nombresFiltrados.forEach(n => archivosSeleccionados.delete(n));
        }
        mostrarBibliotecaExistente(bibliotecaServidor);
    });

    barra.append(etiqueta, texto, boton);
    listaBiblioteca.parentNode.insertBefore(barra, listaBiblioteca);
    return barra;
}

function actualizarBarraSeleccion() {
    const total = nombresFiltrados.length;
    const marcados = seleccionadosVisibles().length;

    const chkTodos = document.getElementById("chk-seleccionar-todos");
    if (chkTodos) {
        chkTodos.checked = total > 0 && marcados === total;
        chkTodos.indeterminate = marcados > 0 && marcados < total;
    }
    const texto = document.getElementById("texto-seleccionados");
    if (texto) texto.textContent = marcados + " seleccionado(s) de " + total;

    const boton = document.getElementById("btn-eliminar-seleccionados");
    if (boton) {
        boton.disabled = marcados === 0;
        boton.textContent = marcados > 0 ? "🗑 Eliminar seleccionados (" + marcados + ")" : "🗑 Eliminar seleccionados";
    }
}

async function eliminarSeleccionados() {
    const nombres = seleccionadosVisibles();
    if (nombres.length === 0) return;

    const campoCodigo = document.getElementById("codigo_usu");
    const codigo = campoCodigo ? campoCodigo.value.trim().toUpperCase() : "";
    if (!codigo) {
        alert("Escribí tu código de usuario para poder eliminar archivos.");
        return;
    }
    if (!confirm("¿Eliminar " + nombres.length + " archivo(s)? Esta acción no se puede deshacer.")) return;

    const boton = document.getElementById("btn-eliminar-seleccionados");
    if (boton) {
        boton.disabled = true;
        boton.textContent = "Eliminando…";
    }

    try {
        const respuesta = await fetch(`${BACKEND_URL}/eliminar-archivos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigo_usuario: codigo, nombres: nombres })
        });
        const datos = await respuesta.json();
        if (!respuesta.ok || datos.status !== "success") {
            throw new Error(datos.message || "No se pudieron eliminar los archivos.");
        }
        const eliminados = new Set(datos.eliminados || []);
        const quitar = new Set([...(datos.eliminados || []), ...(datos.no_encontrados || [])]);
        quitar.forEach(n => archivosSeleccionados.delete(n));
        bibliotecaServidor = bibliotecaServidor.filter(a => !quitar.has(a.nombre));
        mostrarMensajeBiblioteca("🗑 " + eliminados.size + " archivo(s) eliminado(s).");
    } catch (error) {
        console.error(error);
        alert("⚠️ " + error.message);
    } finally {
        mostrarBibliotecaExistente(bibliotecaServidor);
    }
}

function mostrarBibliotecaExistente(lista) {

    if (!listaBiblioteca) return;

    const barra = asegurarBarraSeleccion();
    const completa = Array.isArray(lista) ? lista : [];

    // Si algún archivo ya no existe, se saca de la selección
    const existentes = new Set(completa.map(a => a.nombre));
    Array.from(archivosSeleccionados).forEach(n => {
        if (!existentes.has(n)) archivosSeleccionados.delete(n);
    });

    // Buscador (trabaja sobre una copia: la lista original no se toca)
    let copia = [...completa];
    const buscador = document.getElementById("buscador-biblioteca");
    const textoBusqueda = buscador ? buscador.value.trim().toLowerCase() : "";
    if (textoBusqueda !== ultimoTextoBusqueda) {
        ultimoTextoBusqueda = textoBusqueda;
        paginaActual = 1;
    }
    if (textoBusqueda !== "") {
        copia = copia.filter(a => a.nombre.toLowerCase().includes(textoBusqueda));
    }

    // Orden: por nombre, o por fecha de subida (los más recientes primero)
    const selectorOrden = document.getElementById("orden-biblioteca");
    const orden = selectorOrden ? selectorOrden.value : "fecha";
    if (orden === "nombre") {
        copia.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } else {
        copia.sort((a, b) => (b.fecha || 0) - (a.fecha || 0));
    }

    nombresFiltrados = copia.map(a => a.nombre);

    // Paginación
    const totalPaginas = Math.max(1, Math.ceil(copia.length / ARCHIVOS_POR_PAGINA));
    if (paginaActual > totalPaginas) paginaActual = totalPaginas;
    if (paginaActual < 1) paginaActual = 1;

    const textoPagina = document.getElementById("texto-paginacion");
    if (textoPagina) textoPagina.textContent = "Página " + paginaActual + " de " + totalPaginas;
    const btnAnterior = document.getElementById("btn-pagina-anterior");
    if (btnAnterior) btnAnterior.disabled = (paginaActual === 1);
    const btnSiguiente = document.getElementById("btn-pagina-siguiente");
    if (btnSiguiente) btnSiguiente.disabled = (paginaActual === totalPaginas);

    listaBiblioteca.innerHTML = "";

    if (copia.length === 0) {
        const aviso = document.createElement("div");
        aviso.className = "biblioteca-vacia";
        aviso.textContent = completa.length === 0
            ? "📂 Aún no agregaste ningún archivo a tu Biblioteca Personal."
            : "🔍 No se encontraron archivos con esa búsqueda.";
        listaBiblioteca.appendChild(aviso);
        barra.style.display = "none";
        return;
    }
    barra.style.display = "flex";

    const inicio = (paginaActual - 1) * ARCHIVOS_POR_PAGINA;
    const archivosPagina = copia.slice(inicio, inicio + ARCHIVOS_POR_PAGINA);

    archivosPagina.forEach(archivo => {
        const fila = document.createElement("div");
        fila.className = "item-archivo";

        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.checked = archivosSeleccionados.has(archivo.nombre);
        chk.title = "Seleccionar para eliminar";
        chk.style.marginRight = "10px";
        chk.addEventListener("change", () => {
            if (chk.checked) {
                archivosSeleccionados.add(archivo.nombre);
            } else {
                archivosSeleccionados.delete(archivo.nombre);
            }
            actualizarBarraSeleccion();
        });

        const bloqueNombre = document.createElement("div");
        bloqueNombre.className = "archivo-nombre";
        const nombre = document.createElement("strong");
        nombre.textContent = archivo.nombre;
        const tamano = document.createElement("small");
        tamano.textContent = ((archivo.tamaño || 0) / 1024).toFixed(1) + " KB";
        bloqueNombre.append(chk, "📄 ", nombre, document.createElement("br"), tamano);

        const acciones = document.createElement("div");
        acciones.className = "acciones-archivo";
        acciones.append(
            crearBotonArchivo("btn-ver", "👁 Ver", () => verArchivo(archivo.nombre)),
            crearBotonArchivo("btn-descargar", "⬇ Descargar", () => descargarArchivo(archivo.nombre)),
            crearBotonArchivo("btn-eliminar", "🗑 Eliminar", () => eliminarArchivoServidor(archivo.nombre))
        );

        fila.append(bloqueNombre, acciones);
        listaBiblioteca.appendChild(fila);
    });

    actualizarBarraSeleccion();
}

function eliminarArchivoManual(indice) {

    bibliotecaPendiente.splice(indice, 1);

    mostrarArchivosPendientes();

}

// ==========================================
// COMIENZO "VER" ARCHIVO
// ==========================================

function verArchivo(nombre) {

    const cliente_id = document.getElementById("codigo_usu").value.trim().toUpperCase();

    window.open(
        `${BACKEND_URL}/ver-archivo/${cliente_id}/${encodeURIComponent(nombre)}`,
        "_blank"
    );

}

// ==========================================
// FIN "VER" ARCHIVO
// ==========================================
// ==========================================
// COMIENZO "DESCARGAR" ARCHIVO
// ==========================================

function descargarArchivo(nombre) {

    const cliente_id = document.getElementById("codigo_usu").value.trim().toUpperCase();

    window.open(
        `${BACKEND_URL}/descargar-archivo/${cliente_id}/${encodeURIComponent(nombre)}`,
        "_blank"
    );

}

// ==========================================
// FIN "DESCARGAR" ARCHIVO
// ==========================================

// ==========================================
// COMIENZO "ELIMINAR" ARCHIVO
// ==========================================

function eliminarArchivoServidor(nombre) {

    if (!confirm(`¿Eliminar "${nombre}"?`)) return;

    const cliente_id = document.getElementById("codigo_usu").value.trim().toUpperCase();

    fetch(
        `${BACKEND_URL}/eliminar-archivo/${cliente_id}/${encodeURIComponent(nombre)}`,
        { method: "DELETE" }
    )
        .then(r => r.json())
        .then(res => {

            alert(res.message);

            // Quitamos el archivo de la lista que ya tenemos en pantalla, sin volver a consultar al servidor
            bibliotecaServidor = bibliotecaServidor.filter(archivo => archivo.nombre !== nombre);

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

// Funcionalidad para mostrar u ocultar la contraseña de aplicación (Ojito)
document.addEventListener('DOMContentLoaded', function () {
    const inputClave = document.querySelector('input[name="clave_aplicacion"]') || document.getElementById('llave-conexion');
    const toggleBtn = document.getElementById('toggle-password');

    if (toggleBtn && inputClave) {
        toggleBtn.addEventListener('click', function () {
            if (inputClave.type === 'password') {
                inputClave.type = 'text';
                this.textContent = '🙈';
            } else {
                inputClave.type = 'password';
                this.textContent = '👁️';
            }
        });
    }
});

// ==========================================
// ACCESO PERSONAL: clave de acceso, "recordarme" y ayuda (versión 2 — 24/10/2026)
// ==========================================
var CORREO_DE_SOPORTE = "auria.desarrollo@gmail.com";   // correo al que escriben quienes necesitan ayuda con su código o su clave (cambialo si preferís otro)

var NUMERO_WHATSAPP_SOPORTE = "549XXXXXXXXXX";   // ← reemplazá las X por tu número, solo cifras

function mostrarAyudaRecuperacion() {
    const numeroConfigurado = /^\d{10,15}$/.test(NUMERO_WHATSAPP_SOPORTE);
    if (!numeroConfigurado) {
        alert(
            "¿Olvidaste tu código o tu clave de acceso?\n\n" +
            "Escribinos a " + CORREO_DE_SOPORTE + " con tu nombre completo y el celular que usaste al registrarte. " +
            "Te vamos a responder a ese celular con tu código y una clave nueva.\n\n" +
            "Por seguridad, no podemos mostrarte tus datos sin esa verificación."
        );
        return;
    }
    const campoCodigo = document.getElementById("codigo_usu");
    const codigoEscrito = campoCodigo ? campoCodigo.value.trim().toUpperCase() : "";
    const mensaje =
        "Hola, olvidé mi código o mi clave de acceso a AUR+IA." +
        (codigoEscrito ? " Mi código es " + codigoEscrito + "." : "") +
        " Mi nombre completo es: ";
    window.open("https://wa.me/" + NUMERO_WHATSAPP_SOPORTE + "?text=" + encodeURIComponent(mensaje), "_blank", "noopener");
}

function guardarEnElNavegador(codigo, clave) {
    // Ofrece guardar el código y la clave en el administrador de contraseñas del navegador (donde está disponible)
    try {
        if (window.PasswordCredential && navigator.credentials && navigator.credentials.store) {
            navigator.credentials.store(new PasswordCredential({ id: codigo, password: clave, name: codigo })).catch(() => { });
        }
    } catch (e) {
        // si el navegador no lo permite, no pasa nada
    }
}

function mostrarCierreDeSesion(visible) {
    const enlace = document.getElementById("enlace-cerrar-sesion");
    if (enlace) enlace.style.display = visible ? "inline" : "none";
}

function limpiarFormularioCompleto() {
    // Vuelve los formularios a su estado inicial (vacíos) y borra los campos clave por si el navegador los restauró
    document.querySelectorAll("form").forEach(f => f.reset());
    ["codigo_usu", "clave_acceso_usu", "llave-conexion"].forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });
}

async function cerrarSesion() {
    try {
        await fetch(`${BACKEND_URL}/cerrar-sesion`, { method: "POST" });
    } catch (e) {
        // aunque falle, se limpia la pantalla
    }
    limpiarFormularioCompleto();
    try {
        // Marca para limpiar otra vez después de recargar (algunos navegadores restauran los campos)
        sessionStorage.setItem("auria_sesion_cerrada", "1");
    } catch (e) {
        // si no se puede guardar la marca, igual se recarga
    }
    window.location.reload();
}

window.addEventListener("load", () => {
    try {
        if (sessionStorage.getItem("auria_sesion_cerrada") === "1") {
            sessionStorage.removeItem("auria_sesion_cerrada");
            limpiarFormularioCompleto();
            setTimeout(limpiarFormularioCompleto, 150);
        }
    } catch (e) {
        // sin marca, no se hace nada
    }
});

function mostrarIdentidad(datos) {
    const barra = document.getElementById("barra-acceso-personal");
    if (!barra || !datos) return;
    let saludo = document.getElementById("texto-bienvenida");
    if (!saludo) {
        saludo = document.createElement("span");
        saludo.id = "texto-bienvenida";
        saludo.style.fontWeight = "bold";
        barra.prepend(saludo);
    }
    saludo.textContent = "👤 Sesión abierta como " + (datos.nombre || "") + " (" + (datos.codigo_usuario || "") + ")";
}

async function intentarSesionGuardada() {
    try {
        const respuesta = await fetch(`${BACKEND_URL}/mi-sesion`, { cache: "no-store" });
        const data = await respuesta.json();
        if (data.status === "success" && data.datos) {
            poblarFormulario(data.datos);
            if (data.datos.modo === "automatico") {
                activarModoAutomaticoSinRetorno();
            }
            mostrarCierreDeSesion(true);
            mostrarIdentidad(data.datos);
        }
    } catch (e) {
        // sin sesión o sin conexión: no se hace nada
    }
}


document.addEventListener("DOMContentLoaded", () => {
    const campoCodigo = document.getElementById("codigo_usu");
    if (!campoCodigo || document.getElementById("barra-acceso-personal")) return;

    // Campo de la clave de acceso (si todavía no existe)
    let campoClave = document.getElementById("clave_acceso_usu");
    if (!campoClave) {
        campoClave = document.createElement("input");
        campoClave.type = "password";
        campoClave.id = "clave_acceso_usu";
        campoClave.name = "clave_acceso_usu";
        campoClave.placeholder = "Clave de acceso a AUR+IA";
        campoClave.style.cssText = "flex:1; text-transform:uppercase;";
        campoCodigo.insertAdjacentElement("afterend", campoClave);
    }
    // Estos datos permiten que el navegador ofrezca guardar y completar el código y la clave
    campoCodigo.autocomplete = "username";
    campoClave.autocomplete = "current-password";

    // Enter en estos campos recarga los datos (no envía el formulario por error)
    [campoCodigo, campoClave].forEach(campo => {
        campo.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                cargarDatos();
            }
        });
    });

    // Barra con "Recordarme", ayuda y cerrar sesión
    const barra = document.createElement("div");
    barra.id = "barra-acceso-personal";
    barra.style.cssText = "margin-top:6px; font-size:0.9em; display:flex; flex-wrap:wrap; gap:14px; align-items:center;";

    const etiqueta = document.createElement("label");
    etiqueta.style.cursor = "pointer";
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.id = "chk-recordarme";
    etiqueta.append(chk, " Recordarme en este dispositivo (usalo solo en tu equipo personal)");

    const ayuda = document.createElement("a");
    ayuda.href = "#";
    ayuda.textContent = "¿Olvidaste tu código o tu clave?";
    ayuda.addEventListener("click", (e) => {
        e.preventDefault();
        mostrarAyudaRecuperacion();
    });

    const salir = document.createElement("a");
    salir.href = "#";
    salir.id = "enlace-cerrar-sesion";
    salir.textContent = "Cerrar sesión";
    salir.style.display = "inline";
    salir.addEventListener("click", (e) => {
        e.preventDefault();
        cerrarSesion();
    });

    barra.append(etiqueta, ayuda, salir);
    campoCodigo.parentElement.insertAdjacentElement("afterend", barra);

    // Si la persona pidió que la recordaran y vuelve a entrar, se cargan sus datos solos
    intentarSesionGuardada();
});

// ==========================================
// ==========================================
// PANTALLA: al abrir o refrescar, mostrar siempre la parte de arriba (versión 2 — 29/10/2026)
// ==========================================
if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";   // el navegador ya no vuelve solo a la posición anterior
}

let personaYaSeDesplazo = false;
["wheel", "touchstart", "keydown", "mousedown"].forEach(evento => {
    window.addEventListener(evento, () => { personaYaSeDesplazo = true; }, { passive: true, once: true });
});

function irAlInicioDeLaPagina() {
    try {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    } catch (e) {
        window.scrollTo(0, 0);
    }
}

window.addEventListener("load", () => {
    // Diagnóstico: qué elemento tiene el foco, si la dirección trae un ancla (#) y en qué posición cargó la página
    const foco = document.activeElement;
    console.log(
        "AUR+IA diagnóstico de pantalla → foco en:",
        foco ? (foco.tagName + "#" + (foco.id || "") + "." + (foco.className || "")) : "nada",
        "| ancla en la dirección:", window.location.hash || "ninguna",
        "| posición al cargar:", Math.round(window.scrollY)
    );

    if (foco && foco !== document.body && typeof foco.blur === "function") {
        foco.blur();   // si algo tomó el foco al cargar (por ejemplo el botón de enviar), se lo quita
    }
    irAlInicioDeLaPagina();
    [150, 400, 900].forEach(ms => setTimeout(() => {
        if (!personaYaSeDesplazo) irAlInicioDeLaPagina();
    }, ms));
});

window.addEventListener("pageshow", (evento) => {
    if (evento.persisted) irAlInicioDeLaPagina();   // al volver con el botón "atrás" del navegador
});

// ==========================================
// AVISO: dispositivo propio o compartido (versión 1 — 30/10/2026)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const campoCodigo = document.getElementById("codigo_usu");
    if (!campoCodigo || document.getElementById("aviso-dispositivo")) return;

    const aviso = document.createElement("div");
    aviso.id = "aviso-dispositivo";
    aviso.style.cssText = "margin:0 0 10px 0; padding:10px 12px; border-left:4px solid #F5A623; border-radius:6px; background:rgba(245,166,35,0.10); font-size:0.9em; line-height:1.45;";
    aviso.textContent =
        "🔒 Si estás en tu dispositivo personal, marcá “Recordarme en este dispositivo”: el sistema te reconocerá durante 30 días y vas a poder entrar sin escribir tu código y tu clave. " +
        "Si usás un dispositivo compartido, no marques esa casilla y, cuando termines, pulsá “Cerrar sesión” para que nadie pueda ver ni modificar tu información.";
    campoCodigo.parentElement.insertAdjacentElement("beforebegin", aviso);
});
// ==========================================
// AVISOS DE ACCESO: se muestran arriba, en la barra de acceso, sin mover la pantalla (versión 1 — 31/10/2026)
// ==========================================
function mostrarMensajeAcceso(texto, tipo) {
    const barra = document.getElementById("barra-acceso-personal");
    if (!barra) {
        mostrarAlertaVyo(texto, tipo);
        return;
    }
    let caja = document.getElementById("mensaje-acceso");
    if (!caja) {
        caja = document.createElement("div");
        caja.id = "mensaje-acceso";
        caja.style.cssText = "flex-basis:100%; margin-top:6px; padding:8px 10px; border-radius:6px; font-size:0.95em;";
        barra.appendChild(caja);
    }
    const esError = (tipo === "error");
    caja.style.background = esError ? "rgba(220,53,69,0.12)" : "rgba(40,167,69,0.12)";
    caja.style.borderLeft = "4px solid " + (esError ? "#dc3545" : "#28a745");
    caja.textContent = texto;
    clearTimeout(caja._temporizador);
    caja._temporizador = setTimeout(() => { caja.remove(); }, 8000);
}
// ==========================================
// NAVEGACIÓN: botones para volver al inicio (versión 1 — 31/10/2026)
// ==========================================
function volverAlInicio() {
    try {
        window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    } catch (e) {
        window.scrollTo(0, 0);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("btn-flotante-inicio")) return;

    // 1) Botón flotante: aparece cuando la persona baja en la página (muy útil en el celular)
    const flotante = document.createElement("button");
    flotante.type = "button";
    flotante.id = "btn-flotante-inicio";
    flotante.setAttribute("aria-label", "Volver al inicio");
    flotante.title = "Volver al inicio";
    flotante.textContent = "⬆";
    flotante.style.cssText = "position:fixed; right:16px; bottom:16px; z-index:9999; width:48px; height:48px; border-radius:50%; border:none; cursor:pointer; font-size:22px; background:#F5A623; color:#222; box-shadow:0 2px 8px rgba(0,0,0,0.35); display:none;";
    flotante.addEventListener("click", volverAlInicio);
    document.body.appendChild(flotante);
    window.addEventListener("scroll", () => {
        flotante.style.display = window.scrollY > 400 ? "block" : "none";
    }, { passive: true });

    // 2) Botón debajo de "Enviar"
    const botonEnviar = Array.from(document.querySelectorAll("#form-vyo button"))
        .find(b => /enviar/i.test(b.textContent) && b.id !== "btn-inicio-bajo-enviar");
    if (botonEnviar && !document.getElementById("btn-inicio-bajo-enviar")) {
        const debajo = document.createElement("button");
        debajo.type = "button";
        debajo.id = "btn-inicio-bajo-enviar";
        debajo.textContent = "⬆ Volver al inicio del cuestionario";
        debajo.style.cssText = "display:block; margin:12px auto 0 auto; padding:10px 18px; border-radius:8px; border:2px solid #F5A623; background:transparent; color:inherit; cursor:pointer; font-size:0.95em;";
        debajo.addEventListener("click", volverAlInicio);
        botonEnviar.insertAdjacentElement("afterend", debajo);
    }
});

// ==========================================
// MODO AUTOMÁTICO SIN RETORNO (versión 1 — 4/11/2026)
// Quien tiene el correo conectado no puede volver al Modo MANUAL; quien está en Modo MANUAL puede pasar al AUTOMÁTICO.
// ==========================================
let modoAutomaticoBloqueado = false;

function activarModoAutomaticoSinRetorno() {
    if (typeof window.seleccionarModo !== "function") return;

    // 1) Desde ahora, pedir el Modo MANUAL no hace nada
    if (!window.__seleccionarModoOriginal) {
        window.__seleccionarModoOriginal = window.seleccionarModo;
        window.seleccionarModo = function (modo) {
            if (modoAutomaticoBloqueado && modo === "manual") {
                mostrarMensajeAcceso("Tu correo ya está conectado: desde acá no se puede volver al Modo MANUAL. Si querés desconectarlo, escribinos por WhatsApp.", "error");
                return;
            }
            return window.__seleccionarModoOriginal.apply(this, arguments);
        };
    }
    modoAutomaticoBloqueado = true;

    // 2) Si la pantalla no está en Modo AUTOMÁTICO, se pasa directo al cuestionario automático (sin instructivo)
    const bloqueCuestionario = document.getElementById("bloque-cuestionario");
    const bloqueEmail = document.getElementById("bloque-email");
    const cuestionarioVisible = bloqueCuestionario && getComputedStyle(bloqueCuestionario).display !== "none";
    const emailVisible = bloqueEmail && getComputedStyle(bloqueEmail).display !== "none";
    if (!(cuestionarioVisible && emailVisible)) {
        window.__seleccionarModoOriginal("automatico");
        if (typeof irAlCuestionarioDesdeInstructivo === "function") {
            irAlCuestionarioDesdeInstructivo();
        }
        mostrarMensajeAcceso("Tu correo está conectado: abrimos tu cuestionario en Modo AUTOMÁTICO.", "exito");
    }

    // 3) Sin botón para volver a elegir modo
    const volver = document.getElementById("btn-volver-global");
    if (volver) volver.style.display = "none";
}