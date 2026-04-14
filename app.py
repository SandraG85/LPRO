from flask import Flask, render_template, request, jsonify
from twilio.rest import Client
import os
import json
import base64
import requests

app = Flask(__name__)

# =========================
# Variables de entorno
# =========================
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER")
ALERT_TO_NUMBER = os.environ.get("ALERT_TO_NUMBER")

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_OWNER = os.environ.get("GITHUB_OWNER")
GITHUB_REPO = os.environ.get("GITHUB_REPO")
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main")
GITHUB_FILE_PATH = "events.json"

# =========================
# Utilidades GitHub
# =========================
def github_headers():
    return {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json"
    }

def github_file_url():
    return f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/contents/{GITHUB_FILE_PATH}"

def get_github_events():
    if not all([GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO]):
        print("[GITHUB] Faltan variables de entorno.")
        return []

    r = requests.get(
        github_file_url(),
        headers=github_headers(),
        params={"ref": GITHUB_BRANCH},
        timeout=20
    )

    if r.status_code == 404:
        print("[GITHUB] events.json no existe todavía.")
        return []

    r.raise_for_status()
    data = r.json()

    content_b64 = data.get("content", "")
    if not content_b64:
        return []

    decoded = base64.b64decode(content_b64).decode("utf-8")
    try:
        return json.loads(decoded)
    except json.JSONDecodeError:
        print("[GITHUB] Error decodificando events.json")
        return []

def get_github_file_sha():
    r = requests.get(
        github_file_url(),
        headers=github_headers(),
        params={"ref": GITHUB_BRANCH},
        timeout=20
    )

    if r.status_code == 404:
        return None

    r.raise_for_status()
    return r.json().get("sha")

def save_events_to_github(events):
    content_str = json.dumps(events, ensure_ascii=False, indent=2)
    content_b64 = base64.b64encode(content_str.encode("utf-8")).decode("utf-8")
    sha = get_github_file_sha()

    payload = {
        "message": "Actualizar events.json desde WaveBlaster",
        "content": content_b64,
        "branch": GITHUB_BRANCH
    }

    if sha:
        payload["sha"] = sha

    r = requests.put(
        github_file_url(),
        headers=github_headers(),
        json=payload,
        timeout=30
    )

    r.raise_for_status()
    return r.json()

def append_event_to_github(event_data):
    events = get_github_events()
    events.append(event_data)
    save_events_to_github(events)

def delete_all_events_github():
    save_events_to_github([])

# =========================
# Lógica SMS
# =========================
def should_send_sms(event_data):
    try:
        return (
            event_data.get("event") == "explosion_detected"
            #and float(event_data.get("confidence", 0)) >= 0.90
        )
    except Exception:
        return False

def build_sms_text(event_data):
    return (
        "ALERTA LPRO\n"
        f"Evento: {event_data.get('event')}\n"
        f"Nodo: {event_data.get('node_id')}\n"
        f"Hora: {event_data.get('timestamp_utc')}\n"
        f"Lat: {event_data.get('latitude')} Lon: {event_data.get('longitude')}\n"
        f"Confianza: {event_data.get('confidence')}"
    )

def send_sms_alert(event_data):
    if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, ALERT_TO_NUMBER]):
        print("[SMS] Faltan variables de entorno. No se envia SMS.")
        return False

    client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

    message = client.messages.create(
        body=build_sms_text(event_data),
        from_=TWILIO_FROM_NUMBER,
        to=ALERT_TO_NUMBER
    )

    print(f"[SMS] Enviado correctamente. SID: {message.sid}")
    return True

# =========================
# Rutas Flask
# =========================
@app.route("/")
def inicio():
    events = get_github_events()
    return render_template("index.html", events=events)

@app.route("/api/events", methods=["GET"])
def listar_eventos():
    try:
        events = get_github_events()
        return jsonify(events), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/events", methods=["POST"])
def recibir_evento():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"ok": False, "error": "JSON no valido"}), 400

    try:
        append_event_to_github(data)
    except Exception as e:
        return jsonify({"ok": False, "error": f"Error guardando en GitHub: {str(e)}"}), 500

    sms_sent = False
    if should_send_sms(data):
        try:
            sms_sent = send_sms_alert(data)
        except Exception as e:
            print(f"[SMS ERROR] {e}")

    return jsonify({
        "ok": True,
        "received": data,
        "sms_sent": sms_sent
    }), 201

@app.route("/api/events", methods=["DELETE"])
def borrar_eventos():
    try:
        delete_all_events_github()
        return jsonify({
            "ok": True,
            "message": "Todos los eventos han sido borrados"
        }), 200
    except Exception as e:
        return jsonify({"ok": False, "error": f"Error borrando eventos: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
