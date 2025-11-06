const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3001;

const projectsDir = path.join(__dirname, '..', 'projects');

// Ensure the main projects directory exists
if (!fs.existsSync(projectsDir)) {
  fs.mkdirSync(projectsDir);
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket server');

  ws.on('message', (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      console.log('Received message from client:', parsedMessage);

      switch (parsedMessage.action) {
        case 'new_project':
          handleNewProject(ws, parsedMessage.payload);
          break;
        case 'list_projects':
          handleListProjects(ws);
          break;
        case 'load_project':
          handleLoadProject(ws, parsedMessage.payload);
          break;
        default:
          ws.send(JSON.stringify({ status: 'error', message: 'Unknown action' }));
      }
    } catch (error) {
      console.error('Failed to parse message or handle action:', error);
      ws.send(JSON.stringify({ status: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

function handleNewProject(ws, payload) {
  const { projectName } = payload;
  if (!projectName) {
    return ws.send(JSON.stringify({ status: 'error', message: 'Project name is required' }));
  }

  // Sanitize project name to prevent directory traversal
  const sanitizedProjectName = projectName.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const projectPath = path.join(projectsDir, sanitizedProjectName);

  if (fs.existsSync(projectPath)) {
    return ws.send(JSON.stringify({ status: 'error', message: `Project '${sanitizedProjectName}' already exists.` }));
  }

  try {
    // Create project folders
    fs.mkdirSync(projectPath, { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'assets'), { recursive: true });

    // Create initial project file
    const initialProjectData = {
      projectName: sanitizedProjectName,
      createdAt: new Date().toISOString(),
      idea: '',
      artDirection: {},
      shots: [],
    };
    fs.writeFileSync(path.join(projectPath, `${sanitizedProjectName}.aivc`), JSON.stringify(initialProjectData, null, 2));

    // Send success response
    ws.send(JSON.stringify({ 
      status: 'success', 
      action: 'new_project_created', 
      payload: { projectName: sanitizedProjectName } 
    }));

    console.log(`Project '${sanitizedProjectName}' created successfully.`);

  } catch (error) {
    console.error(`Failed to create project '${sanitizedProjectName}':`, error);
    ws.send(JSON.stringify({ status: 'error', message: 'Failed to create project on the server.' }));
  }
}

function handleListProjects(ws) {
  fs.readdir(projectsDir, { withFileTypes: true }, (err, dirents) => {
    if (err) {
      console.error('Failed to list projects:', err);
      return ws.send(JSON.stringify({ status: 'error', message: 'Failed to read projects directory.' }));
    }

    const projectNames = dirents
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    ws.send(JSON.stringify({
      status: 'success',
      action: 'project_list',
      payload: { projects: projectNames }
    }));
  });
}

function handleLoadProject(ws, payload) {
  const { projectName } = payload;
  if (!projectName) {
    return ws.send(JSON.stringify({ status: 'error', message: 'Project name is required for loading.' }));
  }

  const sanitizedProjectName = projectName.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const projectFilePath = path.join(projectsDir, sanitizedProjectName, `${sanitizedProjectName}.aivc`);

  fs.readFile(projectFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`Failed to read project file '${projectFilePath}':`, err);
      return ws.send(JSON.stringify({ status: 'error', message: `Could not load project '${sanitizedProjectName}'.` }));
    }

    try {
      const projectData = JSON.parse(data);
      ws.send(JSON.stringify({
        status: 'success',
        action: 'project_loaded',
        payload: projectData
      }));
    } catch (parseError) {
      console.error(`Failed to parse project file '${projectFilePath}':`, parseError);
      ws.send(JSON.stringify({ status: 'error', message: `Project file for '${sanitizedProjectName}' is corrupted.` }));
    }
  });
}

server.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});