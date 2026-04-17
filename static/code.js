// ── MAPA ──────────────────────────────────────────────
const map = L.map('map').setView([40.0, -6.0], 6);
const BOYAS = {
    boya_1: { lat: 42.235940, lon: -8.849534, color: "#ff4d4d" },
    boya_2: { lat: 42.190278, lon: -8.856384, color: "#4da6ff" },
    boya_3: { lat: 42.216111, lon: -8.797224, color: "#ffd24d" },
    boya_4: { lat: 42.249771, lon: -8.772315, color: "#66e066" },
    boya_5: { lat: 42.263137, lon: -8.721873, color: "#cc66ff" }
};

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

let markers = [];
let buoyChart = null;
let confianzaChart = null;
let eventosGlobales = [];

// ── NORMALIZACIÓN ─────────────────────────────────────
function normalizarTimestamp(valor) {
    if (!valor) return null;

    if (typeof valor === 'string' && valor.includes(' - ')) {
        return valor.replace(' - ', 'T') + 'Z';
    }

    return valor;
}

function normalizarNodeId(valor) {
    if (!valor) return null;

    let limpio = String(valor).trim();

    if (limpio.startsWith('RECIBIDO:')) {
        limpio = limpio.replace('RECIBIDO:', '').trim();
    }

    return limpio;
}

function normalizarEvento(ev) {
    return {
        event_id: ev.event_id || null,
        node_id: normalizarNodeId(ev.node_id),
        event: ev.event || null,
        timestamp_utc: normalizarTimestamp(ev.timestamp_utc || ev["Hora de la explosion"]),
        latitude: Number(ev.latitude ?? ev["Latitud"] ?? 0),
        longitude: Number(ev.longitude ?? ev["Longitud"] ?? 0),
        confidence: Number(ev.confidence ?? ev["Confianza"] ?? 0),
        rssi_dbm: ev.rssi_dbm ?? ev["RSSI (dBm)"] ?? null
    };
    // Soporta ambos esquemas de claves y limpia el prefijo "RECIBIDO:" del node_id.[web:573][web:607]
}

function cargarEventos() {
    fetch('https://lpro-kwtd.onrender.com/api/events')
        .then(res => res.json())
        .then(events => {
            eventosGlobales = (events || []).map(normalizarEvento);
            actualizarMapa(eventosGlobales);
            actualizarEstadisticas(eventosGlobales);
        })
        .catch(err => console.error('Error al cargar eventos:', err));
}

function actualizarMapa(events) {
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    const resumen = {
        boya_1: { total: 0 },
        boya_2: { total: 0 },
        boya_3: { total: 0 },
        boya_4: { total: 0 },
        boya_5: { total: 0 }
    };

    events.forEach(ev => {
        if (ev.node_id && resumen[ev.node_id]) {
            resumen[ev.node_id].total += 1;
        }
    });

    Object.keys(BOYAS).forEach(nodeId => {
        const infoBoya = BOYAS[nodeId];
        const total = resumen[nodeId] ? resumen[nodeId].total : 0;

        const icono = L.divIcon({
            className: '',
            html: `<div style="
                width: 18px;
                height: 18px;
                background: ${infoBoya.color};
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 0 10px ${infoBoya.color};
            "></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });

        const marker = L.marker([infoBoya.lat, infoBoya.lon], { icon: icono })
            .addTo(map)
            .bindPopup(`
                <b>${nodeId}</b><br>
                Lat: ${infoBoya.lat.toFixed(5)}<br>
                Lon: ${infoBoya.lon.toFixed(5)}<br>
                Explosiones registradas: <b>${total}</b>
            `);

        markers.push(marker);
    });
}

// ── ESTADÍSTICAS ──────────────────────────────────────
function filtrarUltimaSemana(events) {
    const ahora = new Date();
    const hace7Dias = new Date();
    hace7Dias.setDate(ahora.getDate() - 7);

    return events.filter(ev => {
        if (!ev.timestamp_utc) return false;
        const fecha = new Date(ev.timestamp_utc);
        return !isNaN(fecha) && fecha >= hace7Dias && fecha <= ahora;
    });
    // Filtra por últimos 7 días usando Date en JavaScript.[web:609]
}

function actualizarEstadisticas(events) {
    actualizarGraficaBoyas(events);
    actualizarGraficaConfianza(events);
    actualizarTablaBoyas(events);
}

function resumirPorBoya(events) {
    const resumen = {
        boya_1: { total: 0, sumaConfianza: 0, ultima: null },
        boya_2: { total: 0, sumaConfianza: 0, ultima: null },
        boya_3: { total: 0, sumaConfianza: 0, ultima: null },
        boya_4: { total: 0, sumaConfianza: 0, ultima: null },
        boya_5: { total: 0, sumaConfianza: 0, ultima: null }
    };

    events.forEach(ev => {
        const id = ev.node_id;
        if (!resumen[id]) return;

        resumen[id].total += 1;
        resumen[id].sumaConfianza += Number(ev.confidence || 0);

        if (ev.timestamp_utc) {
            const fecha = new Date(ev.timestamp_utc);
            if (!isNaN(fecha)) {
                if (!resumen[id].ultima || fecha > new Date(resumen[id].ultima)) {
                    resumen[id].ultima = ev.timestamp_utc;
                }
            }
        }
    });

    return resumen;
}

function actualizarGraficaBoyas(events) {
    const canvas = document.getElementById('buoyChart');
    if (!canvas) return;

    const eventosSemana = filtrarUltimaSemana(events);
    const resumen = resumirPorBoya(eventosSemana);

    const labels = Object.keys(resumen);
    const data = labels.map(id => resumen[id].total);

    const chartData = {
        labels: labels,
        datasets: [{
            label: 'Número de explosiones (últimos 7 días)',
            data: data,
            backgroundColor: [
                '#ff4d4d',
                '#4da6ff',
                '#ffd24d',
                '#66e066',
                '#cc66ff'
            ],
            borderColor: '#ffffff',
            borderWidth: 1
        }]
    };

    if (buoyChart) {
        buoyChart.data = chartData;
        buoyChart.update();
    } else {
        buoyChart = new Chart(canvas, {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: 'white'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Explosiones registradas por boya (últimos 7 días)',
                        color: 'white'
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            color: 'rgba(255,255,255,0.08)'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: 'white',
                            precision: 0
                        },
                        grid: {
                            color: 'rgba(255,255,255,0.08)'
                        },
                        title: {
                            display: true,
                            text: 'Número de explosiones',
                            color: 'white'
                        }
                    }
                }
            }
        });
    }
}

function actualizarTablaBoyas(events) {
    const tbody = document.querySelector('#tabla-boyas tbody');
    if (!tbody) return;

    const resumen = resumirPorBoya(events);
    tbody.innerHTML = '';

    Object.keys(resumen).forEach(id => {
        const item = resumen[id];

        const confianzaMedia = item.total > 0
            ? ((item.sumaConfianza / item.total) * 100).toFixed(1) + '%'
            : '-';

        let ultima = '-';
        if (item.ultima) {
            const d = new Date(item.ultima);
            if (!isNaN(d)) {
                ultima = d.toISOString().slice(0, 19).replace('T', ' ');
            }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><button class="link-boya" data-boya="${id}">${id}</button></td>
            <td>${item.total}</td>
            <td>${confianzaMedia}</td>
            <td>${ultima}</td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.link-boya').forEach(btn => {
        btn.addEventListener('click', () => {
            const boyaId = btn.getAttribute('data-boya');
            mostrarHistorialBoya(boyaId);
        });
    });
}

function mostrarHistorialBoya(boyaId) {
    const contenedor = document.getElementById('detalle-boya');
    if (!contenedor) return;

    const eventosBoya = eventosGlobales
        .filter(ev => ev.node_id === boyaId)
        .sort((a, b) => new Date(b.timestamp_utc) - new Date(a.timestamp_utc));

    if (eventosBoya.length === 0) {
        contenedor.innerHTML = `
            <h3>Historial de ${boyaId}</h3>
            <p>No hay eventos registrados para esta boya.</p>
        `;
        return;
    }

    let filas = '';
    eventosBoya.forEach(ev => {
        let fecha = '-';
        if (ev.timestamp_utc) {
            const d = new Date(ev.timestamp_utc);
            if (!isNaN(d)) {
                fecha = d.toISOString().slice(0, 19).replace('T', ' ');
            }
        }

        const confianza = ev.confidence != null
            ? (Number(ev.confidence) * 100).toFixed(1) + '%'
            : '-';

        const lat = ev.latitude != null ? Number(ev.latitude).toFixed(5) : '-';
        const lon = ev.longitude != null ? Number(ev.longitude).toFixed(5) : '-';

        filas += `
            <tr>
                <td>${fecha}</td>
                <td>${ev.event || '-'}</td>
                <td>${confianza}</td>
                <td>${lat}</td>
                <td>${lon}</td>
            </tr>
        `;
    });

    contenedor.innerHTML = `
        <h3>Historial de ${boyaId}</h3>
        <table class="tabla-estadisticas tabla-historial">
            <thead>
                <tr>
                    <th>Fecha / hora (UTC)</th>
                    <th>Evento</th>
                    <th>Confianza</th>
                    <th>Latitud</th>
                    <th>Longitud</th>
                </tr>
            </thead>
            <tbody>
                ${filas}
            </tbody>
        </table>
    `;
}

function actualizarGraficaConfianza(events) {
    const canvas = document.getElementById('confianzaChart');
    if (!canvas) return;

    const resumen = resumirPorBoya(events);

    const labels = Object.keys(resumen);
    const data = labels.map(id =>
        resumen[id].total > 0
            ? Number(((resumen[id].sumaConfianza / resumen[id].total) * 100).toFixed(1))
            : 0
    );

    const chartData = {
        labels: labels,
        datasets: [{
            label: 'Confianza media (%)',
            data: data,
            backgroundColor: [
                '#ff4d4d',
                '#4da6ff',
                '#ffd24d',
                '#66e066',
                '#cc66ff'
            ],
            borderColor: '#ffffff',
            borderWidth: 1
        }]
    };

    if (confianzaChart) {
        confianzaChart.data = chartData;
        confianzaChart.update();
    } else {
        confianzaChart = new Chart(canvas, {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: 'white'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            color: 'rgba(255,255,255,0.08)'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            color: 'white',
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        grid: {
                            color: 'rgba(255,255,255,0.08)'
                        },
                        title: {
                            display: true,
                            text: 'Confianza media (%)',
                            color: 'white'
                        }
                    }
                }
            }
        });
    }
}

cargarEventos();
setInterval(cargarEventos, 5000);

// ── PESTAÑAS ──────────────────────────────────────────
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const target = button.getAttribute('data-tab');

        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        button.classList.add('active');
        document.getElementById(target).classList.add('active');

        if (target === 'mapa') {
            setTimeout(() => map.invalidateSize(), 100);
        }

        if (target === 'num-explosiones' && buoyChart) {
            setTimeout(() => buoyChart.resize(), 100);
        }

        if (target === 'confianza-boya' && confianzaChart) {
            setTimeout(() => confianzaChart.resize(), 100);
        }
    });
});


