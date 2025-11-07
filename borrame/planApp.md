# Development Plan: aiVideoCreator

## 1. Overview

**Project Name:** aiVideoCreator
**Objective:** To create a local web application that streamlines the AI-powered video creation process, from a simple idea to a collection of video clips ready for final editing. The application will follow a film production pipeline metaphor.
**Target Users:** Private, local use for a small team (2 people).
**Core Interaction:** The app will interface with a **remote `n8n` server on a VPS** via WebSockets to handle AI-intensive tasks.

---

## 2. Core Technologies

*   **Frontend:** **React** (using Vite for a fast development environment).
*   **Backend:** **Node.js** with **Express** for serving the frontend and the **`ws` library** for WebSocket communication.
*   **Styling:** **Bootstrap** or **Tailwind CSS** for rapid UI development.
*   **State Management:** **Zustand** or **Redux Toolkit** to manage the global project state.
*   **Drag-and-Drop:** A library like **`dnd-kit`** for reordering script shots.

---

## 3. Application Architecture

The application is a local SPA served by a Node.js backend. It communicates with a remote `n8n` server.

1.  **Frontend (React):** Manages the UI, starting with a project selection screen. It sends user actions to the local backend.
2.  **Backend (Node.js):** Acts as a local coordinator.
    *   Serves the React application.
    *   Manages file system operations (saving/loading projects, saving assets).
    *   Connects securely to the remote `n8n` server, forwarding requests and relaying responses.
3.  **Remote `n8n` Server (VPS):** The creative engine.
    *   Exposes a secure WebSocket or webhook endpoint.
    *   Holds all AI service credentials.
    *   Orchestrates calls to various AI APIs.

4.  **Data Flow:**
    `Frontend <-> Local Backend <-> Remote n8n Server (VPS) <-> AI Services`

---

## 4. Project Management

*   **Objective:** Allow users to save, load, and create multiple video projects.
*   **Saving Mechanism:** The primary method will be **auto-saving**. The project file will be saved automatically a few seconds after any change. A manual "Save" button will be available as a backup.
*   **File Format:** Projects are saved as a single JSON file (`.aivc`).
*   **Interaction Flow:**
    1.  **On App Start:** A `ProjectHome` screen is shown to create or open a project.
    2.  **New Project:** User provides a name (e.g., "CatBakingCake"). The app creates a folder `projects/CatBakingCake` and an empty `CatBakingCake.aivc` file inside it.
    3.  **Open Project:** User selects a `.aivc` file. The app loads the project state from the file.

---

## 5. Asset Management

*   **Objective:** To properly store and link all generated media (images, videos).
*   **Folder Structure:** All generated assets for a project will be stored in a dedicated subfolder: `projects/MyProject/assets/`.
*   **File Paths:** The `.aivc` project file will use relative paths to its assets (e.g., `"imageUrl": "assets/shot_1_image.png"`), making the entire project folder portable.
*   **Asset Generation Flow:**
    1.  The local backend requests a file from the remote `n8n` server.
    2.  `n8n` generates the file and sends back the raw data (e.g., as a Base64 encoded string).
    3.  The local backend decodes the data and saves it as a file in the project's `assets` folder.

---

## 6. Error Handling & n8n Contract

*   **Objective:** To make the application resilient and provide clear feedback to the user.
*   **Communication Contract:** The `n8n` workflow must **always** return a JSON object with a `status` field.
    *   **Success:** `{ "status": "success", "data": { ... } }`
    *   **Error:** `{ "status": "error", "message": "Descriptive error from the AI service." }`
*   **Frontend Logic:** The frontend will check `response.status`. If it's `"error"`, it will display `response.message` in the UI instead of crashing or hanging.

---

## 7. Feature Breakdown: The Production Pipeline

(The stages remain the same as previously defined: Script, Art Direction, 2D Image Generation, Video Generation, Trimming, and Render. The underlying logic will now incorporate the asset management and error handling described above.)

---

## 8. Data Models

The central `Project` object, which is saved in the `.aivc` file, will use relative paths for its assets.

```json
{
  "projectName": "CatBakingCake",
  "idea": "A cat trying to bake a cake.",
  "artDirection": {
    "referenceImage": "assets/reference.jpg",
    // ... other fields
  },
  "shots": [
    {
      "id": "shot-1",
      "script": "The cat stands on a stool, looking at a recipe book.",
      "imageUrl": "assets/shot_1_image.png",
      "videoUrl": "assets/shot_1_video.mp4",
      // ... other fields
    }
  ]
}
```
