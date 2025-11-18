const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const cors = require('cors');

// Configure fluent-ffmpeg with ffmpeg-static
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const port = 3001;

const projectsDir = path.join(__dirname, '..', 'projects');
const templatesDir = path.join(__dirname, '..', 'templates');
const rendersDir = path.join(__dirname, '..', 'renders');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// Serve static files from the 'projects' and 'renders' directories
app.use('/projects', express.static(projectsDir));
app.use('/renders', express.static(rendersDir));

// Ensure the main directories exist
if (!fs.existsSync(projectsDir)) {
  fs.mkdirSync(projectsDir);
}
if (!fs.existsSync(templatesDir)) {
  fs.mkdirSync(templatesDir);
}
if (!fs.existsSync(rendersDir)) {
  fs.mkdirSync(rendersDir);
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ========================================
// RENDER ENDPOINT
// ========================================

/**
 * Download file from URL to local disk
 */
async function downloadFile(url, filePath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }
  const buffer = await response.buffer();
  fs.writeFileSync(filePath, buffer);
}

/**
 * Create image-to-video clip (5 seconds)
 */
function createImageClip(imagePath, outputPath, duration = 5) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(imagePath)
      .inputOptions(['-loop 1', '-framerate 30'])
      .input('anullsrc=channel_layout=stereo:sample_rate=44100')
      .inputOptions(['-f lavfi'])
      .outputOptions([
        '-c:v libx264',
        '-t ' + duration,
        '-pix_fmt yuv420p',
        '-vf scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
        '-r 30',
        '-c:a aac',
        '-shortest'
      ])
      .output(outputPath)
      .on('start', (cmd) => console.log('FFmpeg command:', cmd))
      .on('end', () => {
        console.log(`Image clip created: ${outputPath}`);
        resolve();
      })
      .on('error', (err) => {
        console.error('Error creating image clip:', err);
        reject(err);
      })
      .run();
  });
}

/**
 * Merge multiple video files
 */
function mergeVideos(videoPaths, outputPath) {
  return new Promise((resolve, reject) => {
    if (videoPaths.length === 0) {
      return reject(new Error('No videos to merge'));
    }

    if (videoPaths.length === 1) {
      // If only one video, just copy it
      fs.copyFileSync(videoPaths[0], outputPath);
      return resolve();
    }

    // Create concat demuxer file
    const concatFilePath = path.join(rendersDir, `concat_${Date.now()}.txt`);
    const concatContent = videoPaths
      .map(videoPath => `file '${videoPath.replace(/\\/g, '/')}'`)
      .join('\n');

    fs.writeFileSync(concatFilePath, concatContent);

    console.log('Concat file content:\n', concatContent);

    ffmpeg()
      .input(concatFilePath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions([
        '-c:v libx264',
        '-c:a aac',
        '-strict experimental'
      ])
      .output(outputPath)
      .on('start', (cmd) => console.log('Merge FFmpeg command:', cmd))
      .on('end', () => {
        console.log('Videos merged successfully');
        // Clean up concat file
        try {
          fs.unlinkSync(concatFilePath);
        } catch (e) {
          console.error('Could not delete concat file:', e);
        }
        resolve();
      })
      .on('error', (err) => {
        console.error('Merge error:', err);
        // Clean up concat file on error too
        try {
          fs.unlinkSync(concatFilePath);
        } catch (e) {}
        reject(err);
      })
      .run();
  });
}

/**
 * POST /render - Combine videos and images into final video
 */
app.post('/render', async (req, res) => {
  try {
    const { shots, projectName } = req.body;

    if (!shots || !Array.isArray(shots) || shots.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No shots provided' });
    }

    console.log(`Starting render for project: ${projectName}`);

    const timestamp = Date.now();
    const projectRenderDir = path.join(rendersDir, projectName || 'render', timestamp.toString());
    const tmpDir = path.join(projectRenderDir, 'tmp');

    // Create directories
    fs.mkdirSync(projectRenderDir, { recursive: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    const videoPaths = [];
    let shotIndex = 0;

    // Process each shot
    for (const shot of shots) {
      shotIndex++;
      const tmpVideoPath = path.join(tmpDir, `shot_${shotIndex}.mp4`);

      if (shot.video) {
        // Download and use video
        console.log(`Shot ${shotIndex}: Downloading video from ${shot.video}`);
        const tmpVideoFile = path.join(tmpDir, `video_${shotIndex}_tmp.mp4`);
        await downloadFile(shot.video, tmpVideoFile);

        // Copy video with correct codec
        await new Promise((resolve, reject) => {
          ffmpeg(tmpVideoFile)
            .videoCodec('libx264')
            .audioCodec('aac')
            .output(tmpVideoPath)
            .on('end', () => {
              fs.unlinkSync(tmpVideoFile);
              resolve();
            })
            .on('error', reject)
            .run();
        });

        videoPaths.push(tmpVideoPath);
      } else if (shot.image) {
        // Download image and create 5-second clip
        console.log(`Shot ${shotIndex}: Creating image clip from ${shot.image}`);
        const tmpImageFile = path.join(tmpDir, `image_${shotIndex}_tmp.jpg`);
        await downloadFile(shot.image, tmpImageFile);

        await createImageClip(tmpImageFile, tmpVideoPath, 5);
        fs.unlinkSync(tmpImageFile);

        videoPaths.push(tmpVideoPath);
      } else {
        // Skip shot with no video or image
        console.log(`Shot ${shotIndex}: Skipped (no video or image)`);
      }
    }

    if (videoPaths.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No videos or images to render' });
    }

    // Merge all videos
    const finalVideoPath = path.join(projectRenderDir, `${projectName || 'render'}_final.mp4`);
    console.log(`Merging ${videoPaths.length} video(s)...`);
    await mergeVideos(videoPaths, finalVideoPath);

    // Clean up tmp directory
    videoPaths.forEach(p => {
      try { fs.unlinkSync(p); } catch (e) {}
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });

    // Use relative path so it works from any server
    const videoUrl = path.posix.join('renders', projectName || 'render', timestamp.toString(), `${projectName || 'render'}_final.mp4`);

    console.log(`Render completed successfully: ${videoUrl}`);
    res.json({
      status: 'success',
      message: 'Video rendered successfully',
      videoUrl: videoUrl
    });

  } catch (error) {
    console.error('Render error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to render video',
      error: error.message
    });
  }
});

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
        case 'save_video_to_project':
          await handleSaveVideoToProject(ws, parsedMessage.payload);
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
        case 'save_reference_history':
          handleSaveReferenceHistory(ws, parsedMessage.payload);
          break;
        case 'load_reference_history':
          handleLoadReferenceHistory(ws);
          break;
        case 'set_default_template':
          handleSetDefaultTemplate(ws, parsedMessage.payload);
          break;
        case 'get_default_templates':
          handleGetDefaultTemplates(ws);
          break;
        case 'save_soundfx_to_project':
          await handleSaveSoundFXToProject(ws, parsedMessage.payload);
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

function handleSaveReferenceHistory(ws, payload) {
  const { url } = payload;
  if (!url) {
    return ws.send(JSON.stringify({ status: 'error', message: 'URL is required to save reference history.' }));
  }

  const referenceHistoryPath = path.join(templatesDir, 'reference_images.json');

  // Read existing history
  let history = [];
  if (fs.existsSync(referenceHistoryPath)) {
    try {
      const data = fs.readFileSync(referenceHistoryPath, 'utf8');
      history = JSON.parse(data);
    } catch (err) {
      console.error('Failed to read reference history:', err);
    }
  }

  // Add new entry with timestamp
  const newEntry = {
    url,
    timestamp: new Date().toISOString()
  };

  // Check if URL already exists
  const existingIndex = history.findIndex(item => item.url === url);
  if (existingIndex !== -1) {
    // Update timestamp if it exists
    history[existingIndex] = newEntry;
  } else {
    // Add new entry to the beginning
    history.unshift(newEntry);
  }

  // Limit to last 50 images
  if (history.length > 50) {
    history = history.slice(0, 50);
  }

  // Save updated history
  fs.writeFile(referenceHistoryPath, JSON.stringify(history, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('Failed to save reference history:', err);
      return ws.send(JSON.stringify({ status: 'error', message: 'Failed to save reference history.' }));
    }
    console.log('Reference history saved successfully');
    ws.send(JSON.stringify({
      status: 'success',
      action: 'reference_history_saved',
      payload: { history }
    }));
  });
}

function handleLoadReferenceHistory(ws) {
  const referenceHistoryPath = path.join(templatesDir, 'reference_images.json');

  if (!fs.existsSync(referenceHistoryPath)) {
    // Return empty history if file doesn't exist
    return ws.send(JSON.stringify({
      status: 'success',
      action: 'reference_history_loaded',
      payload: { history: [] }
    }));
  }

  fs.readFile(referenceHistoryPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Failed to read reference history:', err);
      return ws.send(JSON.stringify({ status: 'error', message: 'Failed to load reference history.' }));
    }

    try {
      const history = JSON.parse(data);
      ws.send(JSON.stringify({
        status: 'success',
        action: 'reference_history_loaded',
        payload: { history }
      }));
    } catch (parseErr) {
      console.error('Failed to parse reference history:', parseErr);
      ws.send(JSON.stringify({ status: 'error', message: 'Failed to parse reference history.' }));
    }
  });
}

function handleSetDefaultTemplate(ws, payload) {
  const { templateName, templateType } = payload;
  if (!templateName || !templateType) {
    return ws.send(JSON.stringify({ status: 'error', message: 'Template name and type are required.' }));
  }

  const defaultTemplatesPath = path.join(templatesDir, 'default_templates.json');

  // Read existing defaults
  let defaults = {};
  if (fs.existsSync(defaultTemplatesPath)) {
    try {
      const data = fs.readFileSync(defaultTemplatesPath, 'utf8');
      defaults = JSON.parse(data);
    } catch (err) {
      console.error('Failed to read default templates:', err);
    }
  }

  // Set the default for this type
  defaults[templateType] = templateName;

  // Save updated defaults
  fs.writeFile(defaultTemplatesPath, JSON.stringify(defaults, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('Failed to save default template:', err);
      return ws.send(JSON.stringify({ status: 'error', message: 'Failed to save default template.' }));
    }
    console.log(`Default template for ${templateType} set to ${templateName}`);
    ws.send(JSON.stringify({
      status: 'success',
      action: 'default_template_set',
      payload: { templateType, templateName }
    }));
  });
}

function handleGetDefaultTemplates(ws) {
  const defaultTemplatesPath = path.join(templatesDir, 'default_templates.json');

  if (!fs.existsSync(defaultTemplatesPath)) {
    // Return empty defaults if file doesn't exist
    return ws.send(JSON.stringify({
      status: 'success',
      action: 'default_templates_loaded',
      payload: { defaults: {} }
    }));
  }

  fs.readFile(defaultTemplatesPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Failed to read default templates:', err);
      return ws.send(JSON.stringify({ status: 'error', message: 'Failed to load default templates.' }));
    }

    try {
      const defaults = JSON.parse(data);
      ws.send(JSON.stringify({
        status: 'success',
        action: 'default_templates_loaded',
        payload: { defaults }
      }));
    } catch (parseErr) {
      console.error('Failed to parse default templates:', parseErr);
      ws.send(JSON.stringify({ status: 'error', message: 'Failed to parse default templates.' }));
    }
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
    const relativeImagePath = path.posix.join('projects', sanitizedProjectName, 'assets', 'images', imageFileName); // Use posix path for URLs

    fs.writeFileSync(localImagePath, imageBuffer);

    // Store relative path so it works from any server
    const localImageUrl = relativeImagePath;

    ws.send(JSON.stringify({
      status: 'success',
      action: 'image_saved_to_project',
      payload: {
        projectName: sanitizedProjectName,
        externalImageUrl: externalImageUrl,
        localImageUrl: localImageUrl
      }
    }));
    console.log(`Image saved to project '${sanitizedProjectName}': ${localImagePath}`);

  } catch (error) {
    console.error(`Failed to save image to project '${sanitizedProjectName}':`, error);
    ws.send(JSON.stringify({ status: 'error', message: `Failed to save image to project: ${error.message}` }));
  }
}

async function handleSaveVideoToProject(ws, payload) {
  const { projectName, externalVideoUrl } = payload;
  if (!projectName || !externalVideoUrl) {
    return ws.send(JSON.stringify({ status: 'error', message: 'Project name and external video URL are required to save video.' }));
  }

  const sanitizedProjectName = projectName.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const projectVideosDir = path.join(projectsDir, sanitizedProjectName, 'assets', 'videos');

  try {
    fs.mkdirSync(projectVideosDir, { recursive: true });

    const response = await fetch(externalVideoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }

    const videoBuffer = await response.buffer();
    const videoFileName = `${Date.now()}_${path.basename(new URL(externalVideoUrl).pathname)}`;
    const localVideoPath = path.join(projectVideosDir, videoFileName);
    const relativeVideoPath = path.posix.join('projects', sanitizedProjectName, 'assets', 'videos', videoFileName); // Use posix path for URLs

    fs.writeFileSync(localVideoPath, videoBuffer);

    // Store relative path so it works from any server
    const localVideoUrl = relativeVideoPath;

    ws.send(JSON.stringify({
      status: 'success',
      action: 'video_saved_to_project',
      payload: {
        projectName: sanitizedProjectName,
        externalVideoUrl: externalVideoUrl,
        localVideoUrl: localVideoUrl
      }
    }));
    console.log(`Video saved to project '${sanitizedProjectName}': ${localVideoPath}`);

  } catch (error) {
    console.error(`Failed to save video to project '${sanitizedProjectName}':`, error);
    ws.send(JSON.stringify({ status: 'error', message: `Failed to save video to project: ${error.message}` }));
  }
}

async function handleSaveSoundFXToProject(ws, payload) {
  const { projectName, externalSoundFXUrl } = payload;
  if (!projectName || !externalSoundFXUrl) {
    return ws.send(JSON.stringify({ status: 'error', message: 'Project name and external SoundFX URL are required to save SoundFX.' }));
  }

  const sanitizedProjectName = projectName.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const projectSoundFXDir = path.join(projectsDir, sanitizedProjectName, 'assets', 'soundfx');

  try {
    fs.mkdirSync(projectSoundFXDir, { recursive: true });

    const response = await fetch(externalSoundFXUrl);
    if (!response.ok) {
      throw new Error(`Failed to download SoundFX: ${response.statusText}`);
    }

    const soundFXBuffer = await response.buffer();
    const soundFXFileName = `${Date.now()}_${path.basename(new URL(externalSoundFXUrl).pathname)}`;
    const localSoundFXPath = path.join(projectSoundFXDir, soundFXFileName);
    const relativeSoundFXPath = path.posix.join('projects', sanitizedProjectName, 'assets', 'soundfx', soundFXFileName); // Use posix path for URLs

    fs.writeFileSync(localSoundFXPath, soundFXBuffer);

    // Store relative path so it works from any server
    const localSoundFXUrl = relativeSoundFXPath;

    ws.send(JSON.stringify({
      status: 'success',
      action: 'soundfx_saved_to_project',
      payload: {
        projectName: sanitizedProjectName,
        externalSoundFXUrl: externalSoundFXUrl,
        localSoundFXUrl: localSoundFXUrl
      }
    }));
    console.log(`SoundFX saved to project '${sanitizedProjectName}': ${localSoundFXPath}`);

  } catch (error) {
    console.error(`Failed to save SoundFX to project '${sanitizedProjectName}':`, error);
    ws.send(JSON.stringify({ status: 'error', message: `Failed to save SoundFX to project: ${error.message}` }));
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
    fs.mkdirSync(path.join(projectPath, 'assets', 'videos'), { recursive: true }); // Ensure videos directory exists
    fs.mkdirSync(path.join(projectPath, 'assets', 'soundfx'), { recursive: true }); // Ensure soundfx directory exists

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