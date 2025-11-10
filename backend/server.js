const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // Import node-fetch

const app = express();
const port = 3001;

const projectsDir = path.join(__dirname, '..', 'projects');
const templatesDir = path.join(__dirname, '..', 'templates');

// Serve static files from the 'projects' directory
app.use('/projects', express.static(projectsDir));

// Ensure the main projects and templates directories exist
if (!fs.existsSync(projectsDir)) {
  fs.mkdirSync(projectsDir);
}
if (!fs.existsSync(templatesDir)) {
  fs.mkdirSync(templatesDir);
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket server');

  ws.on('message', async (message) => { // Make the handler async
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
        case 'save_project':
          handleSaveProject(ws, parsedMessage.payload);
          break;
        case 'save_image_to_project':
          await handleSaveImageToProject(ws, parsedMessage.payload);
          break;
        case 'save_template':
          handleSaveTemplate(ws, parsedMessage.payload);
          break;
        case 'list_templates':
          handleListTemplates(ws, parsedMessage.payload);
          break;
        case 'load_template':
          handleLoadTemplate(ws, parsedMessage.payload);
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

function handleListTemplates(ws, payload) {
  const { templateType } = payload;
  if (!templateType) {
    return ws.send(JSON.stringify({ status: 'error', message: 'Template type is required.' }));
  }
  const typeDir = path.join(templatesDir, templateType);
  fs.mkdirSync(typeDir, { recursive: true }); // Ensure directory exists

  fs.readdir(typeDir, (err, files) => {
    if (err) {
      console.error('Failed to list templates:', err);
      return ws.send(JSON.stringify({ status: 'error', message: 'Failed to read templates directory.' }));
    }
    const templateNames = files.map(file => path.parse(file).name);
    ws.send(JSON.stringify({
      status: 'success',
      action: 'template_list',
      payload: { templates: templateNames, templateType: templateType }
    }));
  });
}

function handleLoadTemplate(ws, payload) {
  const { templateName, templateType } = payload;
  if (!templateName || !templateType) {
    return ws.send(JSON.stringify({ status: 'error', message: 'Template name and type are required for loading.' }));
  }

  const sanitizedTemplateName = templateName.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const templateFilePath = path.join(templatesDir, templateType, `${sanitizedTemplateName}.txt`);

  fs.readFile(templateFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`Failed to read template file '${templateFilePath}':`, err);
      return ws.send(JSON.stringify({ status: 'error', message: `Could not load template '${sanitizedTemplateName}'.` }));
    }
    ws.send(JSON.stringify({
      status: 'success',
      action: 'template_loaded',
      payload: { templateName: sanitizedTemplateName, templateContent: data, templateType: templateType }
    }));
  });
}

function handleSaveTemplate(ws, payload) {
  const { templateName, templateContent, templateType } = payload;
  if (!templateName || !templateContent || !templateType) {
    return ws.send(JSON.stringify({ status: 'error', message: 'Template name, content, and type are required.' }));
  }

  const sanitizedTemplateName = templateName.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const typeDir = path.join(templatesDir, templateType);
  fs.mkdirSync(typeDir, { recursive: true }); // Ensure directory exists
  const templateFilePath = path.join(typeDir, `${sanitizedTemplateName}.txt`);

  fs.writeFile(templateFilePath, templateContent, 'utf8', (err) => {
    if (err) {
      console.error(`Failed to save template '${sanitizedTemplateName}':`, err);
      return ws.send(JSON.stringify({ status: 'error', message: 'Failed to save template on the server.' }));
    }
    console.log(`Template '${sanitizedTemplateName}' of type '${templateType}' saved successfully.`);
    ws.send(JSON.stringify({ status: 'success', action: 'template_saved', payload: { templateName: sanitizedTemplateName, templateType: templateType } }));
  });
}

async function handleSaveImageToProject(ws, payload) {
  const { projectName, externalImageUrl } = payload;
  if (!projectName || !externalImageUrl) {
    return ws.send(JSON.stringify({ status: 'error', message: 'Project name and external image URL are required to save image.' }));
  }

  const sanitizedProjectName = projectName.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const projectImagesDir = path.join(projectsDir, sanitizedProjectName, 'assets', 'images');

  try {
    fs.mkdirSync(projectImagesDir, { recursive: true });

    const response = await fetch(externalImageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const imageBuffer = await response.buffer();
    const imageFileName = `${Date.now()}_${path.basename(new URL(externalImageUrl).pathname)}`;
    const localImagePath = path.join(projectImagesDir, imageFileName);
    const relativeImagePath = path.join('projects', sanitizedProjectName, 'assets', 'images', imageFileName); // Path accessible from frontend

    fs.writeFileSync(localImagePath, imageBuffer);

    ws.send(JSON.stringify({
      status: 'success',
      action: 'image_saved_to_project',
      payload: {
        projectName: sanitizedProjectName,
        externalImageUrl: externalImageUrl,
        localImageUrl: `http://localhost:${port}/${relativeImagePath.replace(/\\/g, '/')}` // Ensure URL is correct for frontend
      }
    }));
    console.log(`Image saved to project '${sanitizedProjectName}': ${localImagePath}`);

  } catch (error) {
    console.error(`Failed to save image to project '${sanitizedProjectName}':`, error);
    ws.send(JSON.stringify({ status: 'error', message: `Failed to save image to project: ${error.message}` }));
  }
}

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
    fs.mkdirSync(path.join(projectPath, 'assets', 'images'), { recursive: true }); // Ensure images directory exists

    // Create initial project file
    const initialProjectData = {
      projectName: sanitizedProjectName,
      createdAt: new Date().toISOString(),
      idea: '',
      artDirection: {},
      shots: [],
      characters: [], // New field for global characters
      outfits: [],    // New field for global outfits
      locations: [],  // New field for global locations
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

function handleSaveProject(ws, projectData) {
  if (!projectData || !projectData.projectName) {
    return ws.send(JSON.stringify({ status: 'error', message: 'Project data or project name is missing for saving.' }));
  }

  const sanitizedProjectName = projectData.projectName.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const projectFilePath = path.join(projectsDir, sanitizedProjectName, `${sanitizedProjectName}.aivc`);

  fs.writeFile(projectFilePath, JSON.stringify(projectData, null, 2), 'utf8', (err) => {
    if (err) {
      console.error(`Failed to save project '${sanitizedProjectName}':`, err);
      return ws.send(JSON.stringify({ status: 'error', message: 'Failed to save project on the server.' }));
    }
    console.log(`Project '${sanitizedProjectName}' saved successfully.`);
    ws.send(JSON.stringify({ status: 'success', action: 'project_saved', payload: { projectName: sanitizedProjectName } }));
  });
}

server.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});