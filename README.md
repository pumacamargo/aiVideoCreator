# aiVideoCreator

Una aplicación web local para la creación de videos asistida por IA, diseñada para simplificar el proceso de producción de video desde una idea hasta clips listos para editar. Utiliza una metáfora de pipeline de producción cinematográfica y se integra con un servidor remoto `n8n` para tareas intensivas de IA.

## Características

*   **Gestión de Proyectos:** Crea, guarda y carga proyectos de video localmente.
*   **Interfaz Intuitiva:** Frontend React con una experiencia de usuario fluida.
*   **Backend Robusto:** Servidor Node.js para coordinación local y gestión de archivos.
*   **Integración con IA:** Se conecta a un servidor `n8n` remoto para orquestar servicios de IA (generación de imágenes, video, etc.).
*   **Gestión de Activos:** Almacena todos los activos generados (imágenes, videos) de forma organizada y portátil.

## Arquitectura

La aplicación consta de tres componentes principales:

1.  **Frontend (React):** La interfaz de usuario, construida con React y Vite.
2.  **Backend (Node.js/Express):** Un servidor local que actúa como coordinador. Sirve la aplicación React, gestiona las operaciones del sistema de archivos (guardar/cargar proyectos, activos) y se comunica con el servidor `n8n` remoto a través de WebSockets.
3.  **Servidor n8n Remoto (VPS):** El motor creativo. Orquesta las llamadas a diversas APIs de IA y gestiona las credenciales de los servicios de IA.

## Prerrequisitos

Antes de ejecutar la aplicación, asegúrate de tener instalado lo siguiente:

*   **Node.js y npm:** Puedes descargarlos desde [nodejs.org](https://nodejs.org/).
*   **Servidor n8n Remoto:** Esta aplicación requiere una instancia de `n8n` ejecutándose en un servidor remoto (VPS) configurada para manejar las tareas de IA. El backend local se conectará a este servidor `n8n`.

## Instalación

Sigue estos pasos para configurar el proyecto localmente:

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/pumacamargo/aiVideoCreator.git
    cd aiVideoCreator
    ```
2.  **Instalar dependencias del Backend:**
    ```bash
    cd backend
    npm install
    cd ..
    ```
3.  **Instalar dependencias del Frontend:**
    ```bash
    cd frontend
    npm install
    cd ..
    ```

## Uso

Para iniciar la aplicación de forma sencilla:

1.  **Inicia el servidor n8n remoto:** Asegúrate de que tu instancia de `n8n` esté funcionando y accesible.
2.  **Ejecuta el script de inicio (Windows):**
    En la raíz del proyecto (`aiVideoCreator/`), haz doble clic en `start-app.bat`.

    Este script abrirá automáticamente el servidor de backend, el servidor de frontend y la aplicación en tu navegador predeterminado (`http://localhost:5173`).

### Ejecución Manual (Otros Sistemas Operativos)

Si no estás en Windows o prefieres iniciar los servidores manualmente:

1.  **Iniciar el Backend:**
    ```bash
    cd backend
    node server.js
    ```
2.  **Iniciar el Frontend:**
    ```bash
    cd frontend
    npm run dev
    ```
    Luego, abre tu navegador y ve a `http://localhost:5173`.

### Detener la aplicación

Para detener la aplicación, simplemente cierra las ventanas de la terminal que se abrieron para el "Backend Server" y el "Frontend Dev Server".
