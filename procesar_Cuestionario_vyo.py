import os
import sys
import traceback
import json
import mimetypes

from pathlib import Path
from datetime import datetime, timezone

BASE_DIR = Path(__file__).resolve().parents[2]
sys.path.append(str(BASE_DIR / "06_Administrador_Clientes"))

# procesar_Cuestionario_vyo.py v2.0 — actualizado con 9 categorías...

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from pydantic import BaseModel, EmailStr, Field, field_validator
from dotenv import load_dotenv

from administrador_clientes.generador_cliente import GeneradorCliente

# Cargamos la configuración del archivo .env
load_dotenv()
 
app = Flask(__name__)
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:////C:/Users/Anuar/AURIA_2/instance/aur_ia_data.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
 
db = SQLAlchemy(app)

 
# --- MODELO DE BASE DE DATOS (SQLAlchemy) ---
class PerfilCliente(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100))
    email_contacto = db.Column(db.String(120))
    email_servicio = db.Column(db.String(120))
    clave_aplicacion = db.Column(db.String(100))
    celular = db.Column(db.String(20)) # Consultar a Claude Para el número de WhatsApp
    apodo = db.Column(db.Text)
    actividades = db.Column(db.Text)
    familia = db.Column(db.Text)
    amigos = db.Column(db.Text)
    mascotas = db.Column(db.Text)
    fechas = db.Column(db.Text)
    vida_extra = db.Column(db.Text)
    tarea_profesional = db.Column(db.Text)
    tipo_empleo = db.Column(db.Text)
    empresa = db.Column(db.Text)
    companeros = db.Column(db.Text)
    social_extra = db.Column(db.Text)
    obra_extra = db.Column(db.Text)
    cat1_modo = db.Column(db.Text)
    cat1_tono = db.Column(db.Text)
    cat2_modo = db.Column(db.Text)
    cat2_tono = db.Column(db.Text)
    cat3_modo = db.Column(db.Text)
    cat3_tono = db.Column(db.Text)
    cat4_modo = db.Column(db.Text)
    cat4_tono = db.Column(db.Text)
    cat5_modo = db.Column(db.Text)
    cat5_tono = db.Column(db.Text)
    cat6_modo = db.Column(db.Text) 
    cat6_tono = db.Column(db.Text)
    cat7_modo = db.Column(db.Text)
    cat7_tono = db.Column(db.Text)
    cat8_modo = db.Column(db.Text)
    cat8_tono = db.Column(db.Text)
    cat9_modo = db.Column(db.Text)
    # ── Campos personalizados por categoría (nuevos v2) ──
    cat1_personalizado = db.Column(db.Text)
    cat1_remitentes    = db.Column(db.Text)
    cat2_contactos     = db.Column(db.Text)
    cat3_personalizado = db.Column(db.Text)
    cat4_personalizado = db.Column(db.Text)
    cat9_bloqueados    = db.Column(db.Text)
    # ── Canales de mensajería (nuevos v2) ──
    tiene_telegram        = db.Column(db.Text)
    preferencia_whatsapp  = db.Column(db.Text)
    # ── Plan especial jubilado (nuevo v2) ──
    es_jubilado           = db.Column(db.Text)
    jubilado_comentario   = db.Column(db.Text)
    cliente_id = db.Column(db.String(20), unique=True)
    carpeta_cliente = db.Column(db.Text)
    fecha_recepcion = db.Column(
        db.DateTime, 
        default=lambda: datetime.now(timezone.utc))
 
# --- EL "PORTERO" DE SEGURIDAD (Pydantic) ---

class CategoriaSchema(BaseModel):
    enabled: bool = False
    modo: str = ""
    tono: str = ""
    personalizado: str = ""
    remitentes: str = ""

class CuestionarioSchema(BaseModel):
    nombre: str = Field(..., min_length=2)
    email_contacto: EmailStr
    email_servicio: str = ""
    clave_aplicacion: str
    celular: str = ""
    apodo: str = ""
    actividades: str = ""
    familia: str = ""
    amigos: str = ""
    mascotas: str = ""
    fechas: str = ""
    vida_extra: str = ""
    tarea_profesional: str = ""
    tipo_empleo: str = ""
    empresa: str = ""
    companeros: str = ""
    social_extra: str = ""
    obra_extra: str = ""
    # ==========================================
    # COMIENZO CAMPO CONOCIMIENTO MANUAL
    # ==========================================

    conocimiento_manual: str = ""

    # ==========================================
    # FIN CAMPO CONOCIMIENTO MANUAL
    # ==========================================
    cat1_modo: str = ""
    cat1_tono: str = ""
    cat2_modo: str = ""
    cat2_tono: str = ""
    cat3_modo: str = ""
    cat3_tono: str = ""
    cat4_modo: str = ""
    cat4_tono: str = ""
    cat5_modo: str = ""
    cat5_tono: str = ""
    cat6_modo: str = ""
    cat6_tono: str = ""
    cat7_modo: str = ""
    cat7_tono: str = ""
    cat8_modo: str = ""
    cat8_tono: str = ""
    cat9_modo: str = ""
    # ── Campos personalizados por categoría (nuevos v2) ──
    cat1_personalizado: str = ""
    cat1_remitentes:    str = ""
    cat2_contactos:     str = ""
    cat3_personalizado: str = ""
    cat4_personalizado: str = ""
    cat9_bloqueados:    str = ""
    # ── Canales de mensajería (nuevos v2) ──
    tiene_telegram:       str = ""
    preferencia_whatsapp: str = ""
    # ── Plan especial jubilado (nuevo v2) ──
    es_jubilado:          str = ""
    jubilado_comentario:  str = ""
    
    categorias: dict[str, CategoriaSchema] = Field(default_factory=dict)
 
    @field_validator('clave_aplicacion')
    @classmethod
    def limpiar_clave(cls, v):
        return v.replace(" ", "")

    @field_validator('celular')
    @classmethod
    def limpiar_celular(cls, v):
        if v:
            return v.replace(" ", "").replace("-", "")
        return v

# Crear la base de datos si no existe
with app.app_context():
    db.create_all()

    print("\n========================")
    print("BASE DE DATOS REAL")
    print(db.engine.url.database)
    print("========================\n")
 
@app.route('/enviar-cuestionario', methods=['POST'])
def recibir_datos():
    try:
        datos_raw = request.json

        print("\n========== JSON CRUDO ==========")
        print(datos_raw)
        print("===============================\n")

        cuestionario = CuestionarioSchema(**datos_raw)

        # --- GENERACIÓN DE .JSON INDIVIDUAL POR CLIENTE (MAPA_OPERATIVO v3.0) ---
        import json, re
        from pathlib import Path

        # Construir nombre de carpeta a partir del nombre del cliente
        # Ej: "Anuar Giménez Tolosa" → "anuar_gimenez_tolosa"
        nombre_limpio = re.sub(r"[^a-zA-Z0-9 ]", "", cuestionario.nombre)
        nombre_slug   = nombre_limpio.strip().lower().replace(" ", "_")

        # Ruta según MAPA_OPERATIVO:
        # 00_Base_Conocimiento_json_Clientes/01_nombre_cliente/
        
        # Nombre del archivo: nombre_base_conocimiento.json

        # Estructura alineada con template_base_conocimiento.json v3.0
        
        

        gc = GeneradorCliente()

        datos_cliente = cuestionario.model_dump()

        datos_cliente["categorias"] = {
            k: v.model_dump()
            for k, v in cuestionario.categorias.items()
        }

        # ==========================================
        # Compatibilidad entre el nuevo cuestionario
        # y la estructura histórica de perfil_cliente
        # ==========================================

        datos_cliente["cat1_remitentes"] = (
            datos_cliente["categorias"].get("1", {}).get("remitentes", "")
        )

        datos_cliente["cat2_contactos"] = (
            datos_cliente["categorias"].get("2", {}).get("remitentes", "")
        )

        datos_cliente["cat3_personalizado"] = (
            datos_cliente["categorias"].get("3", {}).get("personalizado", "")
        )

        datos_cliente["cat4_personalizado"] = (
            datos_cliente["categorias"].get("4", {}).get("personalizado", "")
        )

        datos_cliente["cat9_bloqueados"] = (
            datos_cliente["categorias"].get("9", {}).get("remitentes", "")
        )

        print("\n========== DATOS RECIBIDOS DEL CUESTIONARIO ==========")

        for clave, valor in datos_cliente.items():
            print(f"{clave}: {valor}")

        print("=====================================================\n")

        # ---------------------------------------------------------
        # ¿El cliente ya existe?
        # ---------------------------------------------------------

        perfil_existente = PerfilCliente.query.filter_by(
            email_contacto=datos_cliente["email_contacto"]
        ).first()

        if perfil_existente:

            cliente_id = perfil_existente.cliente_id
            if perfil_existente.carpeta_cliente:
                carpeta = Path(perfil_existente.carpeta_cliente)
            else:
                print("⚠ Cliente existente sin carpeta registrada. Se crea una nueva.")

                cliente_id, carpeta = gc.alta_cliente(datos_cliente["nombre"])
                
                perfil_existente.cliente_id = cliente_id
                perfil_existente.carpeta_cliente = str(carpeta)

                db.session.commit()

            biblioteca = os.path.join(
                                carpeta,
                                "Biblioteca_de_ARCHIVOS_PERSONALES"
                            )

            os.makedirs(biblioteca, exist_ok=True)
            print("\n" + "=" * 70)
            print("♻️ CLIENTE EXISTENTE")
            print("=" * 70)
            print(f"ID.....................: {cliente_id}")
            print(f"Nombre.................: {datos_cliente['nombre']}")
            print(f"E-mail................: {datos_cliente['email_contacto']}")
            print(f"Carpeta...............: {carpeta}")
            print("=" * 70 + "\n")

        else:

            cliente_id, carpeta = gc.alta_cliente(datos_cliente["nombre"])
            biblioteca = os.path.join(
                carpeta,
                "Biblioteca_de_ARCHIVOS_PERSONALES"
            )

            os.makedirs(biblioteca, exist_ok=True)
            print("\n" + "=" * 70)
            print("🆕 NUEVO CLIENTE REGISTRADO")
            print("=" * 70)
            print(f"ID.....................: {cliente_id}")
            print(f"Nombre.................: {datos_cliente['nombre']}")
            print(f"E-mail................: {datos_cliente['email_contacto']}")
            print(f"Carpeta...............: {carpeta}")
            print(f"Fecha.................: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print("=" * 70 + "\n")
        
        json_cliente = {
            "metadata": {
                "version":                  "3.2",
                "estado_servicio":          "activo",
                "cliente_id": cliente_id,
                "fecha_alta":               datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "fecha_ultima_actualizacion": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "autor":                    "AURIA_2 — Onboarding Automático",
                "plan_servicio":            "gratuito_jubilado" if datos_cliente.get("es_jubilado") == "si" else "gratuito_individual"
            },
            "perfil_usuario": {
                "nombre_completo":        datos_cliente.get("nombre", ""),
                "apodo_preferido":        datos_cliente.get("apodo", ""),
                "tratamiento":            "vos",
                "tipo_perfil":            "individual",
                "segmento":               "A_individual",
                "idiomas":                ["español"],
                "zona_horaria":           "America/Argentina/Buenos_Aires",
                "actividades_y_hobbies":  datos_cliente.get("actividades", ""),
                "vinculos_y_entorno": {
                    "familia":            datos_cliente.get("familia", ""),
                    "amigos":             datos_cliente.get("amigos", ""),
                    "mascotas":           datos_cliente.get("mascotas", ""),
                    "fechas_importantes": datos_cliente.get("fechas", "")
                }
            },
            "contacto": {
                "email_principal":   datos_cliente.get("email_contacto", ""),
                "email_servicio":    datos_cliente.get("email_servicio", ""),
                "celular_whatsapp":  datos_cliente.get("celular", ""),
                "telegram_chat_id":  "",
                "nota_seguridad":    "La App Password va ÚNICAMENTE en el archivo .env — nunca en este JSON"
            },
            "esfera_profesional": {
                "rol":                    datos_cliente.get("tarea_profesional", ""),
                "tipo_empleo":            datos_cliente.get("tipo_empleo", ""),
                "empresa_o_proyecto":     datos_cliente.get("empresa", ""),
                "companeros_clave":       datos_cliente.get("companeros", ""),
                "social_extra":           datos_cliente.get("social_extra", ""),
                "obra_extra":             datos_cliente.get("obra_extra", ""),
                "vida_extra":             datos_cliente.get("vida_extra", ""),
                "contactos_prioritarios": [],
                "dominios_prioritarios":  [],
                "palabras_clave_urgentes": []
            },
            "campos_personalizados": {
                "cat1_urgente": datos_cliente["categorias"].get("1", {}),
                "cat2_familia_amigos": datos_cliente["categorias"].get("2", {}),
                "cat3_turnos_vencimientos": datos_cliente["categorias"].get("3", {}),
                "cat4_laboral_inmediato": datos_cliente["categorias"].get("4", {}),
                "cat5": datos_cliente["categorias"].get("5", {}),
                "cat6": datos_cliente["categorias"].get("6", {}),
                "cat7": datos_cliente["categorias"].get("7", {}),
                "cat8": datos_cliente["categorias"].get("8", {}),
                "cat9_spam_bloqueo": datos_cliente["categorias"].get("9", {})
            },
            "canales_notificacion": {
                "whatsapp_habilitado":   False,
                "telegram_habilitado":   datos_cliente.get("tiene_telegram", "") not in ("", "No tengo Telegram"),
                "email_habilitado":      True,
                "canal_preferido":       "telegram" if datos_cliente.get("tiene_telegram", "") not in ("", "No tengo Telegram") else "email",
                "preferencia_whatsapp":  datos_cliente.get("preferencia_whatsapp", ""),
                "urgentes_inmediatas":   True
            },
            "plan_especial_jubilado": {
                "es_jubilado":         datos_cliente.get("es_jubilado", "no"),
                "comentario":          datos_cliente.get("jubilado_comentario", ""),
                "tres_reportes_gratis": datos_cliente.get("es_jubilado") == "si"
            },
            "logica_de_clasificacion": {
                "cat1": datos_cliente["categorias"].get("1", {}),
                "cat2": datos_cliente["categorias"].get("2", {}),
                "cat3": datos_cliente["categorias"].get("3", {}),
                "cat4": datos_cliente["categorias"].get("4", {}),
                "cat5": datos_cliente["categorias"].get("5", {}),
                "cat6": datos_cliente["categorias"].get("6", {}),
                "cat7": datos_cliente["categorias"].get("7", {}),
                "cat8": datos_cliente["categorias"].get("8", {}),
                "cat9": datos_cliente["categorias"].get("9", {})
            },
            
            "idea_patron_fundamental": {
    "concepto": "Inteligencia Empática Absoluta",
    "regla_de_oro": "AURelia y AURhelios deben ser totalmente empáticos, amistosos y serviciales. La frialdad tecnológica está prohibida.",
    "mision_postal": "Transformar la gestión de correos en una experiencia de acompañamiento y alivio para el cliente."
    },

    # ==========================================
    # COMIENZO PERSISTENCIA CONOCIMIENTO MANUAL
    # ==========================================

    "conocimiento_manual": datos_cliente.get(
        "conocimiento_manual",
        ""
    ),

    # ==========================================
    # FIN PERSISTENCIA CONOCIMIENTO MANUAL
    # ==========================================

    "biblioteca_manual": []
}


        # --------------------------------------------------
        # Eliminar versiones antiguas del JSON del cliente
        # --------------------------------------------------
        nombre_archivo = carpeta / f"{cliente_id}_base_conocimiento.json"
        
        if nombre_archivo.exists():
            with open(nombre_archivo, "r", encoding="utf-8") as f:
                json_anterior = json.load(f)
        
        for archivo in carpeta.glob(f"{cliente_id}_*_base_conocimiento.json"):
            try:
                archivo.unlink()
                print(f"🗑 JSON antiguo eliminado: {archivo.name}")
            except Exception as e:
                print(f"⚠ No se pudo eliminar {archivo.name}: {e}")

        if 'json_anterior' in locals():
            
            # ==========================================
            # COMIENZO CONSERVAR CONOCIMIENTO MANUAL
            # ==========================================

            json_cliente["conocimiento_manual"] = datos_cliente.get(
                "conocimiento_manual",
                json_anterior.get("conocimiento_manual", "")
            )

            # ==========================================
            # FIN CONSERVAR CONOCIMIENTO MANUAL
            # ==========================================

        with open(nombre_archivo, "w", encoding="utf-8") as f:
            json.dump(json_cliente, f, ensure_ascii=False, indent=4)

        sincronizar_biblioteca_json(
            carpeta,
            cliente_id
        )

        # --------------------------------------------------
 
        # Busca si ya existe un perfil con ese email
        perfil_existente = PerfilCliente.query.filter_by(
            email_contacto=cuestionario.email_contacto
        ).first()
 
        if perfil_existente:
            # Actualizar datos existentes
            for campo, valor in datos_cliente.items():
                setattr(perfil_existente, campo, valor)

            perfil_existente.cliente_id = cliente_id
            perfil_existente.carpeta_cliente = str(carpeta)

            db.session.commit()

            return jsonify({
                "status": "success",
                "message": "Datos actualizados correctamente."
            }), 200

        else:
            # Crear nuevo perfil
            nuevo_perfil = PerfilCliente(**datos_cliente)

            nuevo_perfil.cliente_id = cliente_id
            nuevo_perfil.carpeta_cliente = str(carpeta)

            db.session.add(nuevo_perfil)
            db.session.commit()

            return jsonify({
                "status": "success",
                "message": "Nuevo cliente registrado."
            }), 201
 

    except Exception as e:
        traceback.print_exc()

        return jsonify({
            "status":"error",
            "message":str(e)
        }),400
 
@app.route('/obtener-cuestionario/<email>', methods=['GET'])
def obtener_datos(email):
    perfil = PerfilCliente.query.filter_by(email_contacto=email).order_by(PerfilCliente.id.desc()).first()
    if perfil:

        datos = {
            c.name: getattr(perfil, c.name)
            for c in perfil.__table__.columns
            if c.name not in ("id", "fecha_recepcion")
        }

        json_path = Path(perfil.carpeta_cliente) / f"{perfil.cliente_id}_base_conocimiento.json"

        # ==========================================
        # COMIENZO "RECUPERAR DATOS DEL JSON DEL CLIENTE
        # ==========================================

        if json_path.exists():
            with open(json_path, "r", encoding="utf-8") as f:
                json_cliente = json.load(f)

            datos["conocimiento_manual"] = json_cliente.get(
                "conocimiento_manual",
                ""
            )
        # ==========================================
        # FIN "RECUPERAR DATOS DEL JSON DEL CLIENTE"
        # ==========================================

        print("JSON esperado:", json_path)
        print("Existe:", json_path.exists())
        print("Archivos JSON encontrados:")

        for f in Path(perfil.carpeta_cliente).glob("*.json"):
            print(" -", f.name)

        datos["biblioteca_manual"] = []

        biblioteca = Path(perfil.carpeta_cliente) / "Biblioteca_de_ARCHIVOS_PERSONALES"

        if biblioteca.exists():
            for archivo in biblioteca.iterdir():
                if archivo.is_file():
                    datos["biblioteca_manual"].append({
                        "nombre": archivo.name,
                        "tamaño": archivo.stat().st_size,
                        "tipo": mimetypes.guess_type(archivo.name)[0] or "application/octet-stream",
                        "fecha": archivo.stat().st_mtime
                    })
                    
        return jsonify({
            "status": "success",
            "data": datos
        }), 200
    else:
        return jsonify({"status": "not_found"}), 404
 
@app.route('/')
def index():
    return send_from_directory('.', 'Cuestionario_VyO.html')

@app.route('/favicon_Cuestionario_VyO/<path:filename>')
def favicon(filename):
    return send_from_directory('favicon_Cuestionario_VyO', filename)

@app.route('/imagenes_Cuestionario_VyO/<path:filename>')
def imagenes(filename):
    return send_from_directory('imagenes_Cuestionario_VyO', filename)

@app.route('/validation.js')
def validation_js():
    return send_from_directory('.', 'validation.js')
 
@app.route('/limpiar-duplicados', methods=['GET'])
def limpiar_duplicados():
    perfiles = PerfilCliente.query.order_by(PerfilCliente.id.desc()).all()
    emails_vistos = set()
    for perfil in perfiles:
        if perfil.email_contacto in emails_vistos:
            db.session.delete(perfil)
        else:
            emails_vistos.add(perfil.email_contacto)
    db.session.commit()
    return jsonify({"status": "success", "message": "Duplicados eliminados"}), 200
 
@app.route('/resetear-db', methods=['GET'])
def resetear_db():
    db.drop_all()
    db.create_all()
    return jsonify({"status": "success", "message": "Base de datos reseteada"}), 200

@app.route('/ver-instructivo-prueba')
def ver_instructivo_prueba():
    # Le indicamos explícitamente a Flask que busque en tu carpeta externa de correos
    ruta_emails = r"C:\Users\Anuar\AURIA_2\emails_para_clientes_potenciales"
    return send_from_directory(ruta_emails, 'email_04_INSTRUCTIVO.html')

@app.route('/email_04_imagenes_para_instructivos/<path:filename>')
def imagenes_instructivo(filename):
    ruta = r"C:\Users\Anuar\AURIA_2\emails_para_clientes_potenciales\email_04_imagenes_para_instructivos"
    return send_from_directory(ruta, filename)

# ==========================================
# inicio SINCRONIZAR biblioteca_manual DEL JSON
# ==========================================

def sincronizar_biblioteca_json(carpeta_cliente, cliente_id):
    print("\n==============================")
    print("ENTRÉ A sincronizar_biblioteca_json")
    print("==============================")
    carpeta_cliente = Path(carpeta_cliente)

    json_path = carpeta_cliente / f"{cliente_id}_base_conocimiento.json"

    biblioteca = carpeta_cliente / "Biblioteca_de_ARCHIVOS_PERSONALES"

    if not json_path.exists():
        return

    with open(json_path, "r", encoding="utf-8") as f:
        datos = json.load(f)

    datos["biblioteca_manual"] = []

    if biblioteca.exists():
        for archivo in biblioteca.iterdir():
            if archivo.is_file():
                datos["biblioteca_manual"].append({
                    "nombre": archivo.name,
                    "tamaño": archivo.stat().st_size,
                    "tipo": mimetypes.guess_type(archivo.name)[0] or "application/octet-stream",
                    "fecha": archivo.stat().st_mtime
                })

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=4)
# ==========================================
# fin SINCRONIZAR biblioteca_manual DEL JSON
# ==========================================

# ======================================================
# Biblioteca de Archivos Personales
# ======================================================

@app.route("/subir-biblioteca", methods=["POST"])
def subir_biblioteca():
    print("🔥 ENTRÉ A /subir-biblioteca")

    archivos = request.files.getlist("archivos")
    email = request.form.get("email", "").strip().lower()

    print("\n📚 ARCHIVOS RECIBIDOS")
    print(f"Cliente: {email}")


    # Buscar la carpeta correspondiente al cliente

    perfil = PerfilCliente.query.filter_by(
        email_contacto=email
    ).first()

    if not perfil:
        return jsonify({
            "status": "error",
            "message": "Cliente no encontrado."
        }), 404

    carpeta_cliente = Path(perfil.carpeta_cliente)

    biblioteca = carpeta_cliente / "Biblioteca_de_ARCHIVOS_PERSONALES"

    biblioteca.mkdir(exist_ok=True)

    for archivo in archivos:

        nombre_archivo = archivo.filename or "archivo_sin_nombre"

        destino = biblioteca / nombre_archivo

        archivo.save(destino)

        print(f"✅ Guardado: {destino}")

        # ==========================================
        # comienzo SINCRONIZAR JSON CON LA BIBLIOTECA
        # ==========================================

        sincronizar_biblioteca_json(
            perfil.carpeta_cliente,
            perfil.cliente_id
        )        
        # ==========================================
        # fin SINCRONIZAR JSON CON LA BIBLIOTECA
        # ==========================================
        

    json_path = carpeta_cliente / f"{perfil.cliente_id}_base_conocimiento.json"

    if json_path.exists():

        with open(json_path, "r", encoding="utf-8") as f:
            datos = json.load(f)

        print("📁 Biblioteca:", biblioteca)
        datos["biblioteca_manual"] = []

        for f_archivo in biblioteca.iterdir():
            print("➡ Encontrado:", f_archivo.name)
            
            if f_archivo.is_file():
                datos["biblioteca_manual"].append({
                    "nombre": f_archivo.name,
                    "tamaño": f_archivo.stat().st_size,
                    "tipo": mimetypes.guess_type(f_archivo.name)[0] or "application/octet-stream",
                    "fecha": f_archivo.stat().st_mtime
                })

        print("📚 biblioteca_manual =", datos["biblioteca_manual"])

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(datos, f, ensure_ascii=False, indent=4)

    return jsonify({
        "status": "success",
        "cantidad": len(archivos)
    })

@app.route("/ver-archivo/<cliente_id>/<path:nombre>")
def ver_archivo(cliente_id, nombre):

    print("\n==============================")
    print("ENTRÓ A VER_ARCHIVO")
    print("cliente_id:", cliente_id)
    print("nombre:", nombre)
    print("==============================")

    perfil = PerfilCliente.query.filter_by(
        cliente_id=cliente_id
    ).first()

    if not perfil:
        return "Cliente no encontrado", 404

    carpeta = (
        Path(perfil.carpeta_cliente)
        / "Biblioteca_de_ARCHIVOS_PERSONALES"
    )

    return send_from_directory(
        carpeta,
        nombre
    )

@app.route("/descargar-archivo/<cliente_id>/<path:nombre>")
def descargar_archivo(cliente_id, nombre):

    perfil = PerfilCliente.query.filter_by(
        cliente_id=cliente_id
    ).first()

    if not perfil:
        return "Cliente no encontrado", 404

    carpeta = (
        Path(perfil.carpeta_cliente)
        / "Biblioteca_de_ARCHIVOS_PERSONALES"
    )

    return send_from_directory(
        carpeta,
        nombre,
        as_attachment=True
    )

@app.route("/eliminar-archivo/<cliente_id>/<path:nombre>", methods=["DELETE"])
def eliminar_archivo(cliente_id, nombre):

    perfil = PerfilCliente.query.filter_by(
        cliente_id=cliente_id
    ).first()

    if not perfil:
        return jsonify({
            "status": "error",
            "message": "Cliente no encontrado"
        }), 404

    carpeta = (
        Path(perfil.carpeta_cliente)
        / "Biblioteca_de_ARCHIVOS_PERSONALES"
    )

    archivo = carpeta / nombre

    if not archivo.exists():
        return jsonify({
            "status": "error",
            "message": "Archivo inexistente"
        }), 404

    # Eliminar archivo físico
    archivo.unlink()

    # ==========================================
    # COMIENZO SINCRONIZAR JSON CON LA BIBLIOTECA
    # ==========================================

    sincronizar_biblioteca_json(
        perfil.carpeta_cliente,
        perfil.cliente_id
    )

    # ==========================================
    # FIN SINCRONIZAR JSON CON LA BIBLIOTECA
    # ==========================================# 

    return jsonify({
        "status": "success",
        "message": "Archivo eliminado"
    }), 200

if __name__ == "__main__":
    print("🚀 Motor AUR+IA (Versión Profesional) encendido...")
    app.run(port=5000, debug=True)

