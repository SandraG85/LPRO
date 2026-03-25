from flask import Flask, render_template, request, jsonify
import os

app = Flask(__name__)

# Almacenamiento temporal en memoria para pruebas
events = []

@app.route("/")
def inicio():
    return render_template("index.html", events=events)

@app.route("/api/events", methods=["POST"])
def recibir_evento():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"ok": False, "error": "JSON no válido"}), 400

    events.append(data)
    return jsonify({"ok": True, "received": data}), 201

@app.route("/api/events", methods=["GET"])
def listar_eventos():
    return jsonify(events), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
