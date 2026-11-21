// Seleccionamos los elementos del HTML que vamos a utilizar
const formulario = document.getElementById("formulario-busqueda");
const campoCiudad = document.getElementById("ciudad");
const mensaje = document.getElementById("mensaje");
const panelClima = document.getElementById("panel-clima");
const botonActualizar = document.getElementById("actualizar");

// Guardamos las coordenadas de la última ubicación consultada
let ubicacionActual = null;

// Convierte el código meteorológico de Open-Meteo en texto e icono
function obtenerEstado(codigo) {
    if (codigo === 0) return { texto: "Despejado", icono: "☀️" };
    if ([1, 2].includes(codigo)) return { texto: "Parcialmente nublado", icono: "🌤️" };
    if (codigo === 3) return { texto: "Nublado", icono: "☁️" };
    if ([45, 48].includes(codigo)) return { texto: "Niebla", icono: "🌫️" };
    if ([51, 53, 55, 56, 57].includes(codigo)) return { texto: "Llovizna", icono: "🌦️" };
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(codigo)) return { texto: "Lluvia", icono: "🌧️" };
    if ([71, 73, 75, 77, 85, 86].includes(codigo)) return { texto: "Nieve", icono: "❄️" };
    if ([95, 96, 99].includes(codigo)) return { texto: "Tormenta", icono: "⛈️" };
    return { texto: "Estado no disponible", icono: "🌡️" };
}

// Muestra un mensaje en pantalla
function mostrarMensaje(texto, esError = false) {
    mensaje.textContent = texto; // Cambia el contenido del mensaje
    mensaje.classList.toggle("error", esError); // Activa el estilo de error si es necesario
}

// Busca las coordenadas de una ciudad usando el servicio de geocodificación
async function buscarCiudad(nombre) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nombre)}&count=1&language=es&format=json`;
    const respuesta = await fetch(url); // Solicita los datos de la ciudad

    if (!respuesta.ok) throw new Error("No fue posible buscar la ubicación.");

    const datos = await respuesta.json(); // Convierte la respuesta a JSON
    if (!datos.results || datos.results.length === 0) {
        throw new Error("No encontramos esa ubicación. Revisa el nombre e inténtalo otra vez.");
    }

    return datos.results[0]; // Devuelve el primer resultado encontrado
}

// Consulta el clima de acuerdo con las coordenadas recibidas
async function consultarClima(latitud, longitud, nombreLugar) {
    mostrarMensaje("Cargando información del clima..."); // Informa que se está cargando
    panelClima.classList.add("oculto"); // Oculta los datos anteriores

    // Preparamos la dirección de la API con el clima actual y datos por hora
    const parametros = new URLSearchParams({
        latitude: latitud,
        longitude: longitud,
        current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
        hourly: "temperature_2m,precipitation_probability,weather_code,wind_speed_10m",
        past_days: "1",
        forecast_days: "2",
        timezone: "auto"
    });

    const respuesta = await fetch(`https://api.open-meteo.com/v1/forecast?${parametros}`);
    if (!respuesta.ok) throw new Error("No se pudo obtener el clima. Inténtalo de nuevo.");

    const datos = await respuesta.json(); // Convierte la respuesta en un objeto
    mostrarClima(datos, nombreLugar); // Envía los datos a la función que los muestra
}

// Coloca la información meteorológica en el HTML
function mostrarClima(datos, nombreLugar) {
    const actual = datos.current; // Guarda los datos del momento actual
    const estado = obtenerEstado(actual.weather_code); // Obtiene texto e icono

    document.getElementById("nombre-lugar").textContent = nombreLugar;
    document.getElementById("fecha-actual").textContent =
        new Date(actual.time).toLocaleString("es-CO", { dateStyle: "full", timeStyle: "short" });
    document.getElementById("icono-actual").textContent = estado.icono;
    document.getElementById("temperatura").textContent = Math.round(actual.temperature_2m);
    document.getElementById("descripcion").textContent = estado.texto;
    document.getElementById("viento").textContent = `${actual.wind_speed_10m} km/h`;

    // Busca la probabilidad de lluvia correspondiente a la hora actual
    const indiceActual = datos.hourly.time.findIndex(hora => hora.slice(0, 13) === actual.time.slice(0, 13));
    const probabilidad = indiceActual >= 0
        ? datos.hourly.precipitation_probability[indiceActual]
        : null;
    document.getElementById("lluvia").textContent =
        probabilidad === null ? "No disponible" : `${probabilidad}%`;

    mostrarHoras(datos.hourly, indiceActual); // Muestra las horas anteriores y futuras
    panelClima.classList.remove("oculto"); // Enseña la información
    mostrarMensaje(`Última consulta: ${new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`);
}

// Crea las tarjetas de las 24 horas anteriores y las próximas 24 horas
function mostrarHoras(horario, indiceActual) {
    const lista = document.getElementById("lista-horas");
    lista.innerHTML = ""; // Limpia las tarjetas anteriores

    if (indiceActual < 0) {
        lista.textContent = "No se encontró el horario actual.";
        return;
    }

    // Incluye desde 24 horas antes hasta 24 horas después (49 registros contando la hora actual)
    const inicio = Math.max(0, indiceActual - 24);
    const final = Math.min(horario.time.length, indiceActual + 25);

    for (let i = inicio; i < final; i++) {
        const estado = obtenerEstado(horario.weather_code[i]);
        const tarjeta = document.createElement("article"); // Crea una tarjeta por hora
        tarjeta.className = "hora";

        const fechaHora = new Date(horario.time[i]);
        const etiquetaHora = fechaHora.toLocaleString("es-CO", {
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit"
        });

        const momento = i < indiceActual ? "Anterior" : (i === indiceActual ? "Ahora" : "Próxima");
        tarjeta.innerHTML = `
            <small>${momento}</small>
            <small>${etiquetaHora}</small>
            <span class="emoji" title="${estado.texto}">${estado.icono}</span>
            <strong>${Math.round(horario.temperature_2m[i])}°C</strong>
            <small>Lluvia: ${horario.precipitation_probability[i] ?? "—"}%</small>
        `;
        lista.appendChild(tarjeta); // Agrega la tarjeta a la página
    }
}

// Cuando el usuario envía el formulario, buscamos la ciudad
formulario.addEventListener("submit", async function(evento) {
    evento.preventDefault(); // Evita que la página se recargue
    const nombre = campoCiudad.value.trim(); // Lee y limpia el texto

    if (!nombre) return; // No continúa si el campo está vacío

    try {
        mostrarMensaje("Buscando ubicación...");
        const lugar = await buscarCiudad(nombre); // Obtiene latitud y longitud
        ubicacionActual = {
            latitud: lugar.latitude,
            longitud: lugar.longitude,
            nombre: `${lugar.name}${lugar.admin1 ? ", " + lugar.admin1 : ""}${lugar.country ? ", " + lugar.country : ""}`
        };
        await consultarClima(ubicacionActual.latitud, ubicacionActual.longitud, ubicacionActual.nombre);
    } catch (error) {
        mostrarMensaje(error.message, true); // Muestra el error al usuario
    }
});

// Actualiza los datos de la última ubicación consultada
botonActualizar.addEventListener("click", async function() {
    if (!ubicacionActual) return; // Comprueba que exista una ubicación
    botonActualizar.disabled = true; // Evita varios clics mientras carga

    try {
        await consultarClima(ubicacionActual.latitud, ubicacionActual.longitud, ubicacionActual.nombre);
    } catch (error) {
        mostrarMensaje(error.message, true);
    } finally {
        botonActualizar.disabled = false; // Habilita nuevamente el botón
    }
});

// Al abrir la página, intenta detectar la ubicación del usuario
function iniciarAplicacion() {
    if (!navigator.geolocation) {
        mostrarMensaje("Tu navegador no permite detectar la ubicación. Busca una ciudad manualmente.", true);
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async function(posicion) {
            const latitud = posicion.coords.latitude;
            const longitud = posicion.coords.longitude;
            ubicacionActual = { latitud, longitud, nombre: "Mi ubicación actual" };

            try {
                await consultarClima(latitud, longitud, ubicacionActual.nombre);
            } catch (error) {
                mostrarMensaje(error.message, true);
            }
        },
        function() {
            mostrarMensaje("No se pudo acceder a tu ubicación. Escribe una ciudad para consultar el clima.");
        },
        { enableHighAccuracy: false, timeout: 10000 }
    );
}

// Ejecuta la aplicación al cargar el documento
iniciarAplicacion();
