from flask import Flask, render_template, request, jsonify
from twilio.rest import Client
import os

app = Flask(__name__)

# Almacenamiento temporal en memoria para pruebas
events = []

# Variables de entorno
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER")
ALERT_TO_NUMBER = os.environ.get("ALERT_TO_NUMBER")

def should_send_sms(event_data):
    try:
        return (
            event_data.get("event") == "explosion_detected"
            and float(event_data.get("confidence", 0)) >= 0.90
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

@app.route("/")
def inicio():
    return render_template("index.html", events=events)

@app.route("/api/events", methods=["POST"])
def recibir_evento():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"ok": False, "error": "JSON no valido"}), 400

    events.append(data)

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

@app.route("/api/events", methods=["GET"])
def listar_eventos():
    return jsonify(events), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
