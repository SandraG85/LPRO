// ── MAPA ──────────────────────────────────────────────
const map = L.map('map').setView([40.0, -6.0], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

let markers = [];

function cargarEventos() {
    fetch('https://lpro-kk59.onrender.com/api/events')
        .then(res => res.json())
        .then(events => {
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
        })
        .catch(err => console.error('Error al cargar eventos:', err));
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
    });
});
