# aiVideoCreator

A local web application for AI-assisted video creation, designed to streamline the video production pipeline from a simple idea to a collection of clips ready for final editing. It uses a film production pipeline metaphor and integrates with a remote `n8n` server to handle AI-intensive tasks.

## Features

*   **Project Management:** Create, save, and load video projects locally.
*   **Intuitive UI:** A smooth user experience built with React.
*   **Robust Backend:** A Node.js server for local coordination and file management.
*   **AI Integration:** Connects to a remote `n8n` server to orchestrate various AI services (image generation, video, etc.).
*   **Asset Management:** All generated assets (images, videos) are stored in an organized and portable manner.

## Architecture

The application consists of three main components:

1.  **Frontend (React):** The user interface, built with React and Vite.
2.  **Backend (Node.js/Express):** A local server that acts as a coordinator. It serves the React application, handles file system operations (saving/loading projects and assets), and communicates with the remote `n8n` server via WebSockets.
3.  **Remote n8n Server (VPS):** The creative engine. This server orchestrates calls to various AI APIs and manages the necessary credentials.

## Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js and npm:** You can download them from [nodejs.org](https://nodejs.org/).
*   **Remote n8n Server:** This application requires an `n8n` instance running on a remote server (VPS) that has been configured to handle the AI tasks. The local backend will connect to this `n8n` server.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/pumacamargo/aiVideoCreator.git
    cd aiVideoCreator
    ```

2.  **Install Root Dependencies:**
    ```bash
    npm install
    ```
    This installs `concurrently`, which allows both backend and frontend to run simultaneously.

3.  **Install Backend Dependencies:**
    ```bash
    cd backend
    npm install
    cd ..
    ```

4.  **Install Frontend Dependencies:**
    ```bash
    cd frontend
    npm install
    cd ..
    ```

## Usage

1.  **Start the remote n8n server:** Ensure your `n8n` instance is running and accessible.
2.  **Start the application:** From the project's root directory (`aiVideoCreator/`), run the following command:
    ```bash
    npm start
    ```
    This will use `concurrently` to start both the backend and frontend servers in a single terminal. The application should automatically open in your default browser at `http://localhost:5173`.

### For Windows Users (Easy Start)

Alternatively, you can simply double-click the `start-app.bat` file in the root directory. This will open a new terminal and run `npm start` for you.

## Stopping the Application

To stop both servers, go to the terminal where they are running and press `Ctrl+C`.