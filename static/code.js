

// ── MAPA ──────────────────────────────────────────────
const map = L.map('map').setView([40.0, -6.0], 6);
const BOYAS = {
    boya_1: { color: "#ff4d4d" },  // rojo
    boya_2: { color: "#4da6ff" },  // azul
    boya_3: { color: "#ffd24d" },  // amarillo
    boya_4: { color: "#66e066" },  // verde
    boya_5: { color: "#cc66ff" }   // morado
};

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

let markers = [];
let buoyChart = null;

function cargarEventos() {
    fetch('https://lpro-kk59.onrender.com/api/events')
        .then(res => res.json())
        .then(events => {
            actualizarMapa(events);
            actualizarEstadisticas(events);
        })
        .catch(err => console.error('Error al cargar eventos:', err));
}

function actualizarMapa(events) {
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    events.forEach(ev => {
        if (ev.latitude !== undefined && ev.longitude !== undefined) {
    
            const boya = BOYAS[ev.node_id] || { color: "#ff4444" };
    
            const icono = L.divIcon({
                className: '',
                html: `<div style="
                    width: 14px;
                    height: 14px;
                    background: ${boya.color};
                    border: 2px solid white;
                    border-radius: 50%;
                    box-shadow: 0 0 8px ${boya.color};
                "></div>`,
                iconSize: [14, 14],
                iconAnchor: [7, 7]
            });
    
            const marker = L.marker([ev.latitude, ev.longitude], { icon: icono })
                .addTo(map)
                .bindPopup(`
                    <b>💥 ${ev.event || 'Explosión detectada'}</b><br>
                    <b>Nodo:</b> ${ev.node_id || '-'}<br>
                    <b>Confianza:</b> ${ev.confidence !== undefined ? (ev.confidence * 100).toFixed(0) + '%' : '-'}<br>
                    <b>Lat:</b> ${ev.latitude}<br>
                    <b>Lon:</b> ${ev.longitude}<br>
                    <b>Hora UTC:</b> ${ev.timestamp_utc || '-'}
                `);
    
            markers.push(marker);
        }
    });
}

// ── ESTADÍSTICAS ──────────────────────────────────────
function actualizarEstadisticas(events) {
    actualizarGraficaBoyas(events);
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
            if (!resumen[id].ultima || new Date(ev.timestamp_utc) > new Date(resumen[id].ultima)) {
                resumen[id].ultima = ev.timestamp_utc;
            }
        }
    });

    return resumen;
}

function actualizarGraficaBoyas(events) {
    const canvas = document.getElementById('buoyChart');
    if (!canvas) return;

    const resumen = resumirPorBoya(events);

    const labels = Object.keys(resumen);
    const data = labels.map(id => resumen[id].total);

    const chartData = {
        labels: labels,
        datasets: [{
            label: 'Número de explosiones',
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
                        text: 'Explosiones registradas por boya',
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
            ultima = d.toISOString().slice(0, 19).replace('T', ' ');
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${id}</td>
            <td>${item.total}</td>
            <td>${confianzaMedia}</td>
            <td>${ultima}</td>
        `;
        tbody.appendChild(tr);
    });
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

        if (target === 'estadisticas' && buoyChart) {
            setTimeout(() => buoyChart.update(), 100);
        }
    });
});






