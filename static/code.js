// ── MAPA ──────────────────────────────────────────────
const map = L.map('map').setView([40.0, -6.0], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

let markers = [];
let confidenceChart = null;

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

            const icono = L.divIcon({
                className: '',
                html: `<div style="
                    width: 14px;
                    height: 14px;
                    background: #ff4444;
                    border: 2px solid white;
                    border-radius: 50%;
                    box-shadow: 0 0 8px #ff4444;
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

// ── ESTADÍSTICAS (estas son para la pestña de 'estadisticas')──────────────────────────────────────
function actualizarEstadisticas(events) {
    actualizarGraficaConfianza(events);
    actualizarTablaEventos(events);
}

function actualizarGraficaConfianza(events) {
    const canvas = document.getElementById('confidenceChart');
    if (!canvas) return;

    const ultimos = [...events].slice(-20);

    const labels = ultimos.map((ev, i) => {
        if (ev.timestamp_utc) {
            const d = new Date(ev.timestamp_utc);
            return d.toISOString().slice(11, 16); // HH:MM
        }
        return `Evento ${i + 1}`;
    });

    const data = ultimos.map(ev =>
        ev.confidence !== undefined ? Math.round(ev.confidence * 100) : 0
    );

    const chartData = {
        labels: labels,
        datasets: [{
            label: 'Confianza (%)',
            data: data,
            borderColor: '#7CFFB2',
            backgroundColor: 'rgba(124, 255, 178, 0.2)',
            borderWidth: 2,
            fill: true,
            tension: 0.25,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#7CFFB2',
            pointRadius: 4
        }]
    };

    if (confidenceChart) {
        confidenceChart.data = chartData;
        confidenceChart.update();
    } else {
        confidenceChart = new Chart(canvas, {
            type: 'line',
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
                        text: 'Confianza de detección en los últimos eventos',
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
                        max: 100,
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            color: 'rgba(255,255,255,0.08)'
                        },
                        title: {
                            display: true,
                            text: 'Confianza (%)',
                            color: 'white'
                        }
                    }
                }
            }
        });
    }
}

function actualizarTablaEventos(events) {
    const tbody = document.querySelector('#tabla-eventos tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const ordenados = [...events].sort((a, b) => {
        if (!a.timestamp_utc || !b.timestamp_utc) return 0;
        return new Date(b.timestamp_utc) - new Date(a.timestamp_utc);
    });

    ordenados.forEach(ev => {
        const tr = document.createElement('tr');

        let fecha = '-';
        let hora = '-';

        if (ev.timestamp_utc) {
            const d = new Date(ev.timestamp_utc);
            fecha = d.toISOString().slice(0, 10);
            hora = d.toISOString().slice(11, 19);
        }

        tr.innerHTML = `
            <td>${fecha}</td>
            <td>${hora}</td>
            <td>${ev.node_id || '-'}</td>
            <td>${ev.latitude !== undefined ? Number(ev.latitude).toFixed(4) : '-'}</td>
            <td>${ev.longitude !== undefined ? Number(ev.longitude).toFixed(4) : '-'}</td>
            <td>${ev.confidence !== undefined ? (ev.confidence * 100).toFixed(0) + '%' : '-'}</td>
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

        if (target === 'estadisticas' && confidenceChart) {
            setTimeout(() => confidenceChart.update(), 100);
        }
    });
});






