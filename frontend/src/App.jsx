import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { DndContext, closestCorners } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { DraggableScriptCard } from './components/DraggableScriptCard';
import { ArtDirectionCard } from './components/ArtDirectionCard';
import { ImageGenerationTable } from './components/ImageGenerationTable';
import { VideoGenerationTable } from './components/VideoGenerationTable';
import { SoundFXGenerationTable } from './components/SoundFXGenerationTable';

const WEBHOOK_URLS = {
  test: {
    script: 'https://n8n.lemonsushi.com/webhook-test/scriptIdea',
    artDirection: 'https://n8n.lemonsushi.com/webhook-test/artdirection',
    imageGen: 'https://n8n.lemonsushi.com/webhook-test/ImageGenFromPrompt',
    promptGen: 'https://n8n.lemonsushi.com/webhook-test/promptImageGen',
    videoPromptGen: 'https://n8n.lemonsushi.com/webhook-test/prompVideoGen',
    videoGen: 'https://n8n.lemonsushi.com/webhook-test/VideoGenFromPrompt',
    soundFXPromptGen: 'https://n8n.lemonsushi.com/webhook-test/prompSoundFXGen',
    soundFXGen: 'https://n8n.lemonsushi.com/webhook-test/SoundFXGenFromPrompt',
    imageUpload: 'https://n8n.lemonsushi.com/webhook-test/uploadReferenceImage',
    render: 'http://localhost:3001/render',
  },
  production: {
    script: 'https://n8n.lemonsushi.com/webhook/scriptIdea',
    artDirection: 'https://n8n.lemonsushi.com/webhook/artdirection',
    imageGen: 'https://n8n.lemonsushi.com/webhook/ImageGenFromPrompt',
    promptGen: 'https://n8n.lemonsushi.com/webhook/promptImageGen',
    videoPromptGen: 'https://n8n.lemonsushi.com/webhook/prompVideoGen',
    videoGen: 'https://n8n.lemonsushi.com/webhook/VideoGenFromPrompt',
    soundFXPromptGen: 'https://n8n.lemonsushi.com/webhook/prompSoundFXGen',
    soundFXGen: 'https://n8n.lemonsushi.com/webhook/SoundFXGenFromPrompt',
    imageUpload: 'https://n8n.lemonsushi.com/webhook/uploadReferenceImage',
    render: 'http://localhost:3001/render',
  }
};

/**
 * Convert a relative path to a proper URL
 * - If it's already a full URL, return as is
 * - If it's a relative path, prepend the current origin
 */
const formatMediaUrl = (url) => {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // It's a relative path, convert to absolute URL using backend server
  return `http://localhost:3001/${url}`;
};

/**
 * Get the backend server URL dynamically based on current location
 */
const getBackendUrl = () => {
  return `http://${window.location.hostname}:3001`;
};

function App() {
  const [currentView, setCurrentView] = useState('projectSelection');
  const [project, setProject] = useState(null);
  const [projectList, setProjectList] = useState([]);
  const [videoIdea, setVideoIdea] = useState('pomeranian being a police officer');
  const [artDirectionIdea, setArtDirectionIdea] = useState('');
  const [artDirectionImage, setArtDirectionImage] = useState(null);
  const [artDirectionResponse, setArtDirectionResponse] = useState('');
  const [scriptResponse, setScriptResponse] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyPointer, setHistoryPointer] = useState(-1);
  const [currentStep, setCurrentStep] = useState(0);
  const [imageGenUrl, setImageGenUrl] = useState('');
  const [referenceImageFile, setReferenceImageFile] = useState(null);
  const [uploadingReferenceImage, setUploadingReferenceImage] = useState(false);
  const [referenceImageHistory, setReferenceImageHistory] = useState([]);
  const [environment, setEnvironment] = useState('production');
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [promptTemplate, setPromptTemplate] = useState('Create a script for a short video about {{videoIdea}}. The script should have a few shots, each with a clear action.');
  const [showTemplateList, setShowTemplateList] = useState(false);
  const [templateList, setTemplateList] = useState([]);
  const [selectedTemplateName, setSelectedTemplateName] = useState(null);

  // State for Art Direction Templates
  const [artDirectionPromptTemplate, setArtDirectionPromptTemplate] = useState('Generate an art direction based on the following script: {{script}}. Additional guidance: {{artDirectionIdea}}');
  const [showArtDirectionTemplateEditor, setShowArtDirectionTemplateEditor] = useState(false);
  const [selectedArtDirectionTemplateName, setSelectedArtDirectionTemplateName] = useState(null);
  const [artDirectionTemplateList, setArtDirectionTemplateList] = useState([]);
  const [showArtDirectionTemplateList, setShowArtDirectionTemplateList] = useState(false);

  // State for Image Generation Templates
  const [imageGenPromptTemplate, setImageGenPromptTemplate] = useState('Generate an image based on the following script shot: {{script}}. Art direction: {{artDirection}}. Image reference: {{image}}');
  const [showImageGenTemplateEditor, setShowImageGenTemplateEditor] = useState(false);
  const [selectedImageGenTemplateName, setSelectedImageGenTemplateName] = useState(null);
  const [imageGenTemplateList, setImageGenTemplateList] = useState([]);
  const [showImageGenTemplateList, setShowImageGenTemplateList] = useState(false);

  // State for Video Generation Templates
  const [videoGenPromptTemplate, setVideoGenPromptTemplate] = useState('Generate a video based on the following script shot: {{script}}. Art direction: {{artDirection}}. Image prompt: {{imagePrompt}}');
  const [showVideoGenTemplateEditor, setShowVideoGenTemplateEditor] = useState(false);
  const [selectedVideoGenTemplateName, setSelectedVideoGenTemplateName] = useState(null);
  const [videoGenTemplateList, setVideoGenTemplateList] = useState([]);
  const [showVideoGenTemplateList, setShowVideoGenTemplateList] = useState(false);

  // State for SoundFX Generation Templates
  const [soundFXPromptTemplate, setSoundFXPromptTemplate] = useState('Generate sound effects based on the following script shot: {{script}}. Art direction: {{artDirection}}. Image prompt: {{imagePrompt}}. The sound should complement the visual content and enhance the overall video experience.');
  const [showSoundFXGenTemplateEditor, setShowSoundFXGenTemplateEditor] = useState(false);
  const [selectedSoundFXGenTemplateName, setSelectedSoundFXGenTemplateName] = useState(null);
  const [soundFXGenTemplateList, setSoundFXGenTemplateList] = useState([]);
  const [showSoundFXGenTemplateList, setShowSoundFXGenTemplateList] = useState(false);

  // State for Render Section
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState(null);

  // State for Default Templates
  const [defaultTemplates, setDefaultTemplates] = useState({});

  const pipelineSteps = ['Script', 'Art Direction', 'Image Generation', 'Video Generation', 'SoundFX', 'Render'];
  const websocket = useRef(null);
  const [websocketReady, setWebsocketReady] = useState(false);

  const debounce = (func, delay) => {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), delay);
    };
  };

  const sendSaveProject = useCallback((projectToSave) => {
    if (websocket.current && websocket.current.readyState === WebSocket.OPEN && projectToSave) {
      setIsSaving(true);
      const message = { action: 'save_project', payload: projectToSave };
      websocket.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not open or project not defined, cannot auto-save.');
    }
  }, []);

  const debouncedSaveProject = useCallback(debounce(sendSaveProject, 3000), [sendSaveProject]);

  useEffect(() => {
    if (project && (history.length === 0 || project !== history[historyPointer])) {
      const newHistory = history.slice(0, historyPointer + 1);
      newHistory.push(project);
      if (newHistory.length > 50) {
        newHistory.shift();
        setHistoryPointer(prev => prev - 1);
      }
      setHistory(newHistory);
      setHistoryPointer(newHistory.length - 1);
    }
  }, [project]);

  useEffect(() => {
    console.log('[Template List Request]', {
      currentView,
      websocketReady
    });
    if (currentView === 'mainApp' && websocketReady) {
      console.log('[Template List Request] Sending list_templates requests');
      websocket.current.send(JSON.stringify({ action: 'list_templates', payload: { templateType: 'script' } }));
      websocket.current.send(JSON.stringify({ action: 'list_templates', payload: { templateType: 'art_direction' } }));
      websocket.current.send(JSON.stringify({ action: 'list_templates', payload: { templateType: 'image_generation' } }));
      websocket.current.send(JSON.stringify({ action: 'list_templates', payload: { templateType: 'video_generation' } }));
      websocket.current.send(JSON.stringify({ action: 'list_templates', payload: { templateType: 'sound_fx' } }));
      websocket.current.send(JSON.stringify({ action: 'load_reference_history' }));
    }
  }, [currentView, websocketReady]);

  // Auto-load default template for script when list becomes available
  useEffect(() => {
    console.log('[Script Template Auto-Load]', {
      selectedTemplateName,
      templateListLength: templateList.length,
      templateList,
      defaultTemplate: defaultTemplates.script
    });
    if (!selectedTemplateName && templateList.length > 0) {
      const defaultTemplate = defaultTemplates.script;
      const templateToLoad = (defaultTemplate && templateList.includes(defaultTemplate))
        ? defaultTemplate
        : templateList[0]; // Already sorted
      console.log('[Script Template Auto-Load] Loading:', templateToLoad);
      handleLoadTemplate(templateToLoad, 'script');
    }
  }, [templateList]);

  // Auto-load default template for art direction when list becomes available
  useEffect(() => {
    if (!selectedArtDirectionTemplateName && artDirectionTemplateList.length > 0) {
      const defaultTemplate = defaultTemplates.art_direction;
      const templateToLoad = (defaultTemplate && artDirectionTemplateList.includes(defaultTemplate))
        ? defaultTemplate
        : artDirectionTemplateList[0];
      handleLoadTemplate(templateToLoad, 'art_direction');
    }
  }, [artDirectionTemplateList]);

  // Auto-load default template for image generation when list becomes available
  useEffect(() => {
    if (!selectedImageGenTemplateName && imageGenTemplateList.length > 0) {
      const defaultTemplate = defaultTemplates.image_generation;
      const templateToLoad = (defaultTemplate && imageGenTemplateList.includes(defaultTemplate))
        ? defaultTemplate
        : imageGenTemplateList[0];
      handleLoadTemplate(templateToLoad, 'image_generation');
    }
  }, [imageGenTemplateList]);

  // Auto-load default template for video generation when list becomes available
  useEffect(() => {
    if (!selectedVideoGenTemplateName && videoGenTemplateList.length > 0) {
      const defaultTemplate = defaultTemplates.video_generation;
      const templateToLoad = (defaultTemplate && videoGenTemplateList.includes(defaultTemplate))
        ? defaultTemplate
        : videoGenTemplateList[0];
      handleLoadTemplate(templateToLoad, 'video_generation');
    }
  }, [videoGenTemplateList]);

  // Auto-load default template for SoundFX generation when list becomes available
  useEffect(() => {
    if (!selectedSoundFXGenTemplateName && soundFXGenTemplateList.length > 0) {
      const defaultTemplate = defaultTemplates.sound_fx;
      const templateToLoad = (defaultTemplate && soundFXGenTemplateList.includes(defaultTemplate))
        ? defaultTemplate
        : soundFXGenTemplateList[0];
      handleLoadTemplate(templateToLoad, 'sound_fx');
    }
  }, [soundFXGenTemplateList]);

  useEffect(() => {
    websocket.current = new WebSocket('ws://localhost:3001');
    websocket.current.onopen = () => {
      console.log('WebSocket connection established');
      setWebsocketReady(true);
      // Load reference history when WebSocket connects
      websocket.current.send(JSON.stringify({ action: 'load_reference_history' }));
      // Load default templates
      websocket.current.send(JSON.stringify({ action: 'get_default_templates' }));
    };
    websocket.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('Received from server:', message);
      if (message.action === 'new_project_created' && message.status === 'success') {
        setProject(message.payload);
        setCurrentView('mainApp');
      } else if (message.action === 'project_list' && message.status === 'success') {
        setProjectList(message.payload.projects);
        setCurrentView('projectOpenSelection');
      } else if (message.action === 'project_loaded' && message.status === 'success') {
        const loadedProject = {
          ...message.payload,
          shots: message.payload.shots?.map(shot => ({
            ...shot,
            imageUrls: (shot.imageUrls || (shot.imageUrl ? [shot.imageUrl] : [])).map(formatMediaUrl),
            selectedImageUrl: formatMediaUrl(shot.selectedImageUrl || shot.imageUrl || ''),
            videoUrls: (shot.videoUrls || (shot.videoUrl ? [shot.videoUrl] : [])).map(formatMediaUrl),
            selectedVideoUrl: formatMediaUrl(shot.selectedVideoUrl || shot.videoUrl || ''),
            soundFXUrls: (shot.soundFXUrls || []).map(formatMediaUrl),
            selectedSoundFXUrl: formatMediaUrl(shot.selectedSoundFXUrl || '')
          })) || [],
          artDirection: message.payload.artDirection || {},
        };
        setProject(loadedProject);
        setScriptResponse(loadedProject.shots);
        if (loadedProject.artDirection?.rawResponse) {
          setArtDirectionResponse(formatN8NResponseForDisplay(loadedProject.artDirection.rawResponse));
        } else {
          setArtDirectionResponse('');
        }
        setCurrentView('mainApp');
      } else if (message.action === 'project_saved' && message.status === 'success') {
        setIsSaving(false);
      } else if (message.action === 'template_saved' && message.status === 'success') {
        alert(`Template '${message.payload.templateName}' saved successfully!`);
        if (message.payload.templateType === 'script') {
          setSelectedTemplateName(message.payload.templateName);
          websocket.current.send(JSON.stringify({ action: 'list_templates', payload: { templateType: 'script' } }));
        } else if (message.payload.templateType === 'art_direction') {
          setSelectedArtDirectionTemplateName(message.payload.templateName);
          websocket.current.send(JSON.stringify({ action: 'list_templates', payload: { templateType: 'art_direction' } }));
        } else if (message.payload.templateType === 'image_generation') {
          setSelectedImageGenTemplateName(message.payload.templateName);
          websocket.current.send(JSON.stringify({ action: 'list_templates', payload: { templateType: 'image_generation' } }));
        } else if (message.payload.templateType === 'video_generation') {
          setSelectedVideoGenTemplateName(message.payload.templateName);
          websocket.current.send(JSON.stringify({ action: 'list_templates', payload: { templateType: 'video_generation' } }));
        } else if (message.payload.templateType === 'sound_fx') {
          setSelectedSoundFXGenTemplateName(message.payload.templateName);
          websocket.current.send(JSON.stringify({ action: 'list_templates', payload: { templateType: 'sound_fx' } }));
        }
      } else if (message.action === 'template_list' && message.status === 'success') {
        const { templateType, templates } = message.payload;
        const sortedTemplates = [...templates].sort();

        if (templateType === 'script') {
          setTemplateList(sortedTemplates);
        } else if (templateType === 'art_direction') {
          setArtDirectionTemplateList(sortedTemplates);
        } else if (templateType === 'image_generation') {
          setImageGenTemplateList(sortedTemplates);
        } else if (templateType === 'video_generation') {
          setVideoGenTemplateList(sortedTemplates);
        } else if (templateType === 'sound_fx') {
          setSoundFXGenTemplateList(sortedTemplates);
        }
      } else if (message.action === 'template_loaded' && message.status === 'success') {
        if (message.payload.templateType === 'script') {
          setPromptTemplate(message.payload.templateContent);
          setSelectedTemplateName(message.payload.templateName);
          setShowTemplateList(false);
        } else if (message.payload.templateType === 'art_direction') {
          setArtDirectionPromptTemplate(message.payload.templateContent);
          setSelectedArtDirectionTemplateName(message.payload.templateName);
          setShowArtDirectionTemplateList(false);
        } else if (message.payload.templateType === 'image_generation') {
          setImageGenPromptTemplate(message.payload.templateContent);
          setSelectedImageGenTemplateName(message.payload.templateName);
          setShowImageGenTemplateList(false);
        } else if (message.payload.templateType === 'video_generation') {
          setVideoGenPromptTemplate(message.payload.templateContent);
          setSelectedVideoGenTemplateName(message.payload.templateName);
          setShowVideoGenTemplateList(false);
        } else if (message.payload.templateType === 'sound_fx') {
          setSoundFXPromptTemplate(message.payload.templateContent);
          setSelectedSoundFXGenTemplateName(message.payload.templateName);
          setShowSoundFXGenTemplateList(false);
        }
      } else if (message.action === 'image_saved_to_project' && message.status === 'success') {
        const { externalImageUrl, localImageUrl } = message.payload;
        const formattedLocalImageUrl = formatMediaUrl(localImageUrl);
        setScriptResponse(prev => {
          const newScripts = prev.map(shot => {
            const newImageUrls = shot.imageUrls.map(url => url === externalImageUrl ? formattedLocalImageUrl : url);
            const newSelectedImageUrl = shot.selectedImageUrl === externalImageUrl ? formattedLocalImageUrl : shot.selectedImageUrl;
            return { ...shot, imageUrls: newImageUrls, selectedImageUrl: newSelectedImageUrl };
          });
          return newScripts;
        });
        setProject(p => {
          const newScripts = p.shots.map(shot => {
            const newImageUrls = shot.imageUrls.map(url => url === externalImageUrl ? formattedLocalImageUrl : url);
            const newSelectedImageUrl = shot.selectedImageUrl === externalImageUrl ? formattedLocalImageUrl : shot.selectedImageUrl;
            return { ...shot, imageUrls: newImageUrls, selectedImageUrl: newSelectedImageUrl };
          });
          return { ...p, shots: newScripts };
        });
      } else if (message.action === 'video_saved_to_project' && message.status === 'success') {
        const { externalVideoUrl, localVideoUrl } = message.payload;
        const formattedLocalVideoUrl = formatMediaUrl(localVideoUrl);
        setScriptResponse(prev => {
          const newScripts = prev.map(shot => {
            const newVideoUrls = shot.videoUrls.map(url => url === externalVideoUrl ? formattedLocalVideoUrl : url);
            const newSelectedVideoUrl = shot.selectedVideoUrl === externalVideoUrl ? formattedLocalVideoUrl : shot.selectedVideoUrl;
            return { ...shot, videoUrls: newVideoUrls, selectedVideoUrl: newSelectedVideoUrl };
          });
          return newScripts;
        });
        setProject(p => {
          const newScripts = p.shots.map(shot => {
            const newVideoUrls = shot.videoUrls.map(url => url === externalVideoUrl ? formattedLocalVideoUrl : url);
            const newSelectedVideoUrl = shot.selectedVideoUrl === externalVideoUrl ? formattedLocalVideoUrl : shot.selectedVideoUrl;
            return { ...shot, videoUrls: newVideoUrls, selectedVideoUrl: newSelectedVideoUrl };
          });
          return { ...p, shots: newScripts };
        });
      } else if (message.action === 'soundfx_saved_to_project' && message.status === 'success') {
        const { externalSoundFXUrl, localSoundFXUrl } = message.payload;
        const formattedLocalSoundFXUrl = formatMediaUrl(localSoundFXUrl);
        setScriptResponse(prev => {
          const newScripts = prev.map(shot => {
            const newSoundFXUrls = shot.soundFXUrls.map(url => url === externalSoundFXUrl ? formattedLocalSoundFXUrl : url);
            const newSelectedSoundFXUrl = shot.selectedSoundFXUrl === externalSoundFXUrl ? formattedLocalSoundFXUrl : shot.selectedSoundFXUrl;
            return { ...shot, soundFXUrls: newSoundFXUrls, selectedSoundFXUrl: newSelectedSoundFXUrl };
          });
          return newScripts;
        });
        setProject(p => {
          const newScripts = p.shots.map(shot => {
            const newSoundFXUrls = shot.soundFXUrls.map(url => url === externalSoundFXUrl ? formattedLocalSoundFXUrl : url);
            const newSelectedSoundFXUrl = shot.selectedSoundFXUrl === externalSoundFXUrl ? formattedLocalSoundFXUrl : shot.selectedSoundFXUrl;
            return { ...shot, soundFXUrls: newSoundFXUrls, selectedSoundFXUrl: newSelectedSoundFXUrl };
          });
          return { ...p, shots: newScripts };
        });
      } else if (message.action === 'reference_history_loaded' && message.status === 'success') {
        setReferenceImageHistory(message.payload.history || []);
      } else if (message.action === 'reference_history_saved' && message.status === 'success') {
        setReferenceImageHistory(message.payload.history || []);
      } else if (message.action === 'default_templates_loaded' && message.status === 'success') {
        setDefaultTemplates(message.payload.defaults || {});
      } else if (message.action === 'default_template_set' && message.status === 'success') {
        setDefaultTemplates(prev => ({
          ...prev,
          [message.payload.templateType]: message.payload.templateName
        }));
      } else if (message.status === 'error') {
        alert(`Error: ${message.message}`);
        setIsSaving(false);
        setUploadingReferenceImage(false);
      }
    };
    websocket.current.onclose = () => {
      console.log('WebSocket connection closed');
      setWebsocketReady(false);
    };
    return () => {
      if (websocket.current) websocket.current.close();
    };
  }, [scriptResponse, selectedTemplateName, selectedArtDirectionTemplateName, selectedImageGenTemplateName]); // Add dependencies

  useEffect(() => {
    if (project) debouncedSaveProject(project);
  }, [project, debouncedSaveProject]);

  const handleImageChange = (event) => {
    if (event.target.files && event.target.files[0]) setArtDirectionImage(event.target.files[0]);
  };

  const handleImageGenUrlChange = (event) => {
    setImageGenUrl(event.target.value);
  };

  const handleReferenceImageFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setReferenceImageFile(file);
    }
  };

  const handleUploadReferenceImage = async () => {
    if (!referenceImageFile) {
      alert('Please select an image file first');
      return;
    }

    setUploadingReferenceImage(true);

    try {
      // Send to n8n webhook using FormData
      const uploadWebhookUrl = WEBHOOK_URLS[environment].imageUpload || 'YOUR_N8N_UPLOAD_WEBHOOK_URL';

      const formData = new FormData();
      formData.append('file', referenceImageFile);

      const response = await fetch(uploadWebhookUrl, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const responseData = await response.json();
        // Handle different response formats
        let imageUrl = null;
        if (responseData.url) {
          // Format: { url: "..." }
          imageUrl = responseData.url;
        } else if (responseData[0]?.publicUrl) {
          // Format: [{ publicUrl: "...", filename: "...", filepath: "..." }]
          imageUrl = responseData[0].publicUrl;
        }

        if (imageUrl) {
          // Update the image URL in state
          setImageGenUrl(imageUrl);
          setUploadingReferenceImage(false);

          // Save to reference history via backend
          if (websocket.current) {
            websocket.current.send(JSON.stringify({
              action: 'save_reference_history',
              payload: { url: imageUrl }
            }));
          }
        } else {
          alert('Failed to get image URL from upload');
          console.log('Response data:', responseData);
          setUploadingReferenceImage(false);
        }
      } else {
        alert('Failed to upload image. Check console for details.');
        setUploadingReferenceImage(false);
      }
    } catch (error) {
      console.error('Error uploading reference image:', error);
      alert('Error uploading image. Check console for details.');
      setUploadingReferenceImage(false);
    }
  };

  const handleSelectReferenceFromHistory = (imageUrl) => {
    setImageGenUrl(imageUrl);
  };

  const handleNewProject = () => {
    const projectName = prompt('Please enter a name for your new project:');
    if (projectName && websocket.current) {
      websocket.current.send(JSON.stringify({ action: 'new_project', payload: { projectName } }));
    }
  };

  const handleOpenProject = () => {
    console.log('handleOpenProject called');
    if (websocket.current) {
      console.log('Sending list_projects message');
      websocket.current.send(JSON.stringify({ action: 'list_projects' }));
    }
  };

  const handleSelectProject = (projectName) => {
    if (websocket.current) {
      websocket.current.send(JSON.stringify({ action: 'load_project', payload: { projectName } }));
    }
  };

  const handleSaveTemplate = (templateType) => {
    const templateName = prompt(`Please enter a name for your ${templateType} template:`);
    if (templateName && websocket.current) {
      let templateContent;
      if (templateType === 'script') {
        templateContent = promptTemplate;
      } else if (templateType === 'art_direction') {
        templateContent = artDirectionPromptTemplate;
      } else if (templateType === 'image_generation') {
        templateContent = imageGenPromptTemplate;
      } else if (templateType === 'video_generation') {
        templateContent = videoGenPromptTemplate;
      } else if (templateType === 'sound_fx') {
        templateContent = soundFXPromptTemplate;
      }
      websocket.current.send(JSON.stringify({
        action: 'save_template',
        payload: {
          templateName: templateName,
          templateContent: templateContent,
          templateType: templateType
        }
      }));
    }
  };

  const handleOpenTemplate = (templateType) => {
    if (websocket.current) {
      websocket.current.send(JSON.stringify({ action: 'list_templates', payload: { templateType } }));
    }
    if (templateType === 'script') {
      setShowTemplateList(s => !s);
    } else if (templateType === 'art_direction') {
      setShowArtDirectionTemplateList(s => !s);
    } else if (templateType === 'image_generation') {
      setShowImageGenTemplateList(s => !s);
    } else if (templateType === 'video_generation') {
      setShowVideoGenTemplateList(s => !s);
    } else if (templateType === 'sound_fx') {
      setShowSoundFXGenTemplateList(s => !s);
    }
  };

  const handleLoadTemplate = (templateName, templateType) => {
    if (websocket.current) {
      websocket.current.send(JSON.stringify({ action: 'load_template', payload: { templateName, templateType } }));
    }
  };

  const handleSetDefaultTemplate = (templateName, templateType) => {
    if (websocket.current) {
      websocket.current.send(JSON.stringify({
        action: 'set_default_template',
        payload: { templateName, templateType }
      }));
    }
  };

  const handleSendFormDataToN8N = async (webhookUrl, formData, processResponse) => {
    setIsLoading(true);
    try {
      const response = await fetch(webhookUrl, { method: 'POST', body: formData });
      if (response.ok) {
        const data = await response.json();
        processResponse(data);
        alert('Data sent to n8n successfully!');
      } else {
        alert('Failed to send form data to n8n. Check console for details.');
      }
    } catch (error) {
      alert('Error sending form data to n8n. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendIdeaToN8N = async (webhookUrl, payload, processResponse) => {
    setIsLoading(true);
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const data = await response.json();
        processResponse(data);
        alert('Idea sent to n8n successfully!');
      } else {
        alert('Failed to send idea to n8n. Check console for details.');
      }
    } catch (error) {
      alert('Error sending idea to n8n. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setScriptResponse((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        setProject(prevProject => ({ ...prevProject, shots: newOrder }));
        return newOrder;
      });
    }
  };

  const handleScriptChange = (id, newScript) => {
    const updatedScripts = scriptResponse.map(s => (s.id === id ? { ...s, script: newScript } : s));
    setScriptResponse(updatedScripts);
    setProject(p => ({ ...p, shots: updatedScripts }));
  };

  const handleAddNewCard = () => {
    const newId = `shot-${Date.now()}`;
    const newCard = { id: newId, script: 'New script idea...', imageUrls: [], selectedImageUrl: '' };
    setScriptResponse(s => [...s, newCard]);
    setProject(p => ({ ...p, shots: [...(p.shots || []), newCard] }));
  };

  const handleUndo = () => {
    if (historyPointer > 0) {
      const newPointer = historyPointer - 1;
      setHistoryPointer(newPointer);
      setProject(history[newPointer]);
      setScriptResponse(history[newPointer].shots || []);
    }
  };

  const handleRedo = () => {
    if (historyPointer < history.length - 1) {
      const newPointer = historyPointer + 1;
      setHistoryPointer(newPointer);
      setProject(history[newPointer]);
      setScriptResponse(history[newPointer].shots || []);
    }
  };

  const handleDeleteScriptCard = (id) => {
    const updatedScripts = scriptResponse.filter(s => s.id !== id);
    setScriptResponse(updatedScripts);
    setProject(p => ({ ...p, shots: updatedScripts }));
  };

  const handleNextStep = () => setCurrentStep(s => Math.min(s + 1, pipelineSteps.length - 1));
  const handlePreviousStep = () => setCurrentStep(s => Math.max(s - 1, 0));

  const formatN8NResponseForDisplay = (data) => {
    if (!data) return "No response data.";
    if (typeof data === 'string') return data;
    if (data.output && typeof data.output === 'string') return data.output;
    if (data['0'] && data['0'].output && typeof data['0'].output === 'string') return data['0'].output;
    return JSON.stringify(data, null, 2);
  };

  const handleArtDirectionChange = (newDescription) => {
    setProject(p => ({ ...p, artDirection: { ...p.artDirection, rawResponse: newDescription } }));
    setArtDirectionResponse(newDescription);
  };

  const handleGenerateArtDirection = () => {
    const scriptText = scriptResponse.map(shot => shot.script).join('\n');
    const n8nWebhookUrl = WEBHOOK_URLS[environment].artDirection;
    const processResponse = (data) => {
      setProject(p => ({ ...p, artDirection: { rawResponse: data } }));
      setArtDirectionResponse(formatN8NResponseForDisplay(data));
    };

    handleSendIdeaToN8N(n8nWebhookUrl, {
      artDirectionPromptTemplate: artDirectionPromptTemplate,
      artDirectionIdea: artDirectionIdea,
      script: scriptText,
      image: imageGenUrl
    }, processResponse);
  };

  const handleNewImageFromAI = (shotId, externalImageUrl) => {
    setScriptResponse(prev => {
      const updatedScripts = prev.map(s => {
        if (s.id === shotId) {
          const newImageUrls = [...s.imageUrls, externalImageUrl];
          return { ...s, imageUrls: newImageUrls, selectedImageUrl: externalImageUrl };
        }
        return s;
      });
      return updatedScripts;
    });
    setProject(p => {
      const updatedScripts = p.shots.map(s => {
        if (s.id === shotId) {
          const newImageUrls = [...s.imageUrls, externalImageUrl];
          return { ...s, imageUrls: newImageUrls, selectedImageUrl: externalImageUrl };
        }
        return s;
      });
      return { ...p, shots: updatedScripts };
    });

    if (websocket.current && project) {
      websocket.current.send(JSON.stringify({
        action: 'save_image_to_project',
        payload: {
          projectName: project.projectName,
          externalImageUrl: externalImageUrl,
        }
      }));
    }
  };

  const handleSetSelectedImage = (shotId, imageUrl) => {
    setScriptResponse(prev =>
      prev.map(s =>
        s.id === shotId ? { ...s, selectedImageUrl: imageUrl } : s
      )
    );
    setProject(p => ({ ...p, shots: p.shots.map(s =>
      s.id === shotId ? { ...s, selectedImageUrl: imageUrl } : s
    )}));
  };

  const handleRemoveImageFromShot = (shotId, imageUrlToRemove) => {
    setScriptResponse(prev => {
      const updatedScripts = prev.map(s => {
        if (s.id === shotId) {
          const newImageUrls = s.imageUrls.filter(url => url !== imageUrlToRemove);
          const newSelectedImageUrl = s.selectedImageUrl === imageUrlToRemove
            ? (newImageUrls.length > 0 ? newImageUrls[0] : null)
            : s.selectedImageUrl;
          return { ...s, imageUrls: newImageUrls, selectedImageUrl: newSelectedImageUrl };
        }
        return s;
      });
      return updatedScripts;
    });
    setProject(p => {
      const updatedScripts = p.shots.map(s => {
        if (s.id === shotId) {
          const newImageUrls = s.imageUrls.filter(url => url !== imageUrlToRemove);
          const newSelectedImageUrl = s.selectedImageUrl === imageUrlToRemove
            ? (newImageUrls.length > 0 ? newImageUrls[0] : null)
            : s.selectedImageUrl;
          return { ...s, imageUrls: newImageUrls, selectedImageUrl: newSelectedImageUrl };
        }
        return s;
      });
      return { ...p, shots: updatedScripts };
    });
  };

  const handleShotPromptChange = (shotId, newPrompt) => {
    console.log(`[handleShotPromptChange] shotId: ${shotId}, newPrompt length: ${newPrompt?.length}`);

    // Use a microtask to ensure state updates don't conflict
    queueMicrotask(() => {
      setScriptResponse(prev => {
        console.log(`[handleShotPromptChange] prev state:`, prev.map(s => ({ id: s.id, promptLength: s.prompt?.length })));
        const updatedScripts = prev.map(s =>
          s.id === shotId ? { ...s, prompt: newPrompt } : s
        );
        console.log(`[handleShotPromptChange] new state:`, updatedScripts.map(s => ({ id: s.id, promptLength: s.prompt?.length })));
        return updatedScripts;
      });
      setProject(p => {
        const updatedShots = p.shots.map(s =>
          s.id === shotId ? { ...s, prompt: newPrompt } : s
        );
        return { ...p, shots: updatedShots };
      });
    });
  };

  const handleVideoPromptChange = (shotId, newVideoPrompt) => {
    queueMicrotask(() => {
      setScriptResponse(prev => {
        const updatedScripts = prev.map(s =>
          s.id === shotId ? { ...s, videoPrompt: newVideoPrompt } : s
        );
        return updatedScripts;
      });
      setProject(p => {
        const updatedShots = p.shots.map(s =>
          s.id === shotId ? { ...s, videoPrompt: newVideoPrompt } : s
        );
        return { ...p, shots: updatedShots };
      });
    });
  };

  const handleNewVideoFromAI = (shotId, newVideoUrl) => {
    setScriptResponse(prev => {
      const updatedScripts = prev.map(s => {
        if (s.id === shotId) {
          const newVideoUrls = [...(s.videoUrls || []), newVideoUrl];
          return { ...s, videoUrls: newVideoUrls, selectedVideoUrl: newVideoUrl };
        }
        return s;
      });
      return updatedScripts;
    });
    setProject(p => {
      const updatedScripts = p.shots.map(s => {
        if (s.id === shotId) {
          const newVideoUrls = [...(s.videoUrls || []), newVideoUrl];
          return { ...s, videoUrls: newVideoUrls, selectedVideoUrl: newVideoUrl };
        }
        return s;
      });
      return { ...p, shots: updatedScripts };
    });

    if (websocket.current && project) {
      websocket.current.send(JSON.stringify({
        action: 'save_video_to_project',
        payload: {
          projectName: project.projectName,
          externalVideoUrl: newVideoUrl,
        }
      }));
    }
  };

  const handleSetSelectedVideo = (shotId, videoUrl) => {
    setScriptResponse(prev =>
      prev.map(s =>
        s.id === shotId ? { ...s, selectedVideoUrl: videoUrl } : s
      )
    );
    setProject(p => ({ ...p, shots: p.shots.map(s =>
      s.id === shotId ? { ...s, selectedVideoUrl: videoUrl } : s
    )}));
  };

  const handleRemoveVideoFromShot = (shotId, videoUrlToRemove) => {
    setScriptResponse(prev => {
      const updatedScripts = prev.map(s => {
        if (s.id === shotId) {
          const newVideoUrls = s.videoUrls.filter(url => url !== videoUrlToRemove);
          const newSelectedVideoUrl = s.selectedVideoUrl === videoUrlToRemove
            ? (newVideoUrls.length > 0 ? newVideoUrls[0] : null)
            : s.selectedVideoUrl;
          return { ...s, videoUrls: newVideoUrls, selectedVideoUrl: newSelectedVideoUrl };
        }
        return s;
      });
      return updatedScripts;
    });
    setProject(p => {
      const updatedScripts = p.shots.map(s => {
        if (s.id === shotId) {
          const newVideoUrls = s.videoUrls.filter(url => url !== videoUrlToRemove);
          const newSelectedVideoUrl = s.selectedVideoUrl === videoUrlToRemove
            ? (newVideoUrls.length > 0 ? newVideoUrls[0] : null)
            : s.selectedVideoUrl;
          return { ...s, videoUrls: newVideoUrls, selectedVideoUrl: newSelectedVideoUrl };
        }
        return s;
      });
      return { ...p, shots: updatedScripts };
    });
  };

  const handleSoundFXPromptChange = (shotId, newSoundFXPrompt) => {
    queueMicrotask(() => {
      setScriptResponse(prev => {
        const updatedScripts = prev.map(s =>
          s.id === shotId ? { ...s, soundFXPrompt: newSoundFXPrompt } : s
        );
        return updatedScripts;
      });
      setProject(p => {
        const updatedShots = p.shots.map(s =>
          s.id === shotId ? { ...s, soundFXPrompt: newSoundFXPrompt } : s
        );
        return { ...p, shots: updatedShots };
      });
    });
  };

  const handleNewSoundFXFromAI = (shotId, newSoundFXUrl, newVideoUrl) => {
    setScriptResponse(prev => {
      const updatedScripts = prev.map(s => {
        if (s.id === shotId) {
          const newSoundFXUrls = [...(s.soundFXUrls || []), newSoundFXUrl];
          // If video URL is provided from SoundFX generation, add it to video URLs as well
          let updatedShot = { ...s, soundFXUrls: newSoundFXUrls, selectedSoundFXUrl: newSoundFXUrl };
          if (newVideoUrl) {
            const newVideoUrls = [...(s.videoUrls || []), newVideoUrl];
            updatedShot = { ...updatedShot, videoUrls: newVideoUrls, selectedVideoUrl: newVideoUrl };
          }
          return updatedShot;
        }
        return s;
      });
      return updatedScripts;
    });
    setProject(p => {
      const updatedScripts = p.shots.map(s => {
        if (s.id === shotId) {
          const newSoundFXUrls = [...(s.soundFXUrls || []), newSoundFXUrl];
          // If video URL is provided from SoundFX generation, add it to video URLs as well
          let updatedShot = { ...s, soundFXUrls: newSoundFXUrls, selectedSoundFXUrl: newSoundFXUrl };
          if (newVideoUrl) {
            const newVideoUrls = [...(s.videoUrls || []), newVideoUrl];
            updatedShot = { ...updatedShot, videoUrls: newVideoUrls, selectedVideoUrl: newVideoUrl };
          }
          return updatedShot;
        }
        return s;
      });
      return { ...p, shots: updatedScripts };
    });

    if (websocket.current && project) {
      const payload = {
        projectName: project.projectName,
        externalSoundFXUrl: newSoundFXUrl,
      };
      // If video URL is provided, also save it
      if (newVideoUrl) {
        payload.externalVideoUrl = newVideoUrl;
      }
      websocket.current.send(JSON.stringify({
        action: 'save_soundfx_to_project',
        payload
      }));
    }
  };

  const handleSetSelectedSoundFX = (shotId, soundFXUrl) => {
    setScriptResponse(prev =>
      prev.map(s =>
        s.id === shotId ? { ...s, selectedSoundFXUrl: soundFXUrl } : s
      )
    );
    setProject(p => ({ ...p, shots: p.shots.map(s =>
      s.id === shotId ? { ...s, selectedSoundFXUrl: soundFXUrl } : s
    )}));
  };

  const handleRemoveSoundFXFromShot = (shotId, soundFXUrlToRemove) => {
    setScriptResponse(prev => {
      const updatedScripts = prev.map(s => {
        if (s.id === shotId) {
          const newSoundFXUrls = s.soundFXUrls.filter(url => url !== soundFXUrlToRemove);
          const newSelectedSoundFXUrl = s.selectedSoundFXUrl === soundFXUrlToRemove
            ? (newSoundFXUrls.length > 0 ? newSoundFXUrls[0] : null)
            : s.selectedSoundFXUrl;
          return { ...s, soundFXUrls: newSoundFXUrls, selectedSoundFXUrl: newSelectedSoundFXUrl };
        }
        return s;
      });
      return updatedScripts;
    });
    setProject(p => {
      const updatedScripts = p.shots.map(s => {
        if (s.id === shotId) {
          const newSoundFXUrls = s.soundFXUrls.filter(url => url !== soundFXUrlToRemove);
          const newSelectedSoundFXUrl = s.selectedSoundFXUrl === soundFXUrlToRemove
            ? (newSoundFXUrls.length > 0 ? newSoundFXUrls[0] : null)
            : s.selectedSoundFXUrl;
          return { ...s, soundFXUrls: newSoundFXUrls, selectedSoundFXUrl: newSelectedSoundFXUrl };
        }
        return s;
      });
      return { ...p, shots: updatedScripts };
    });
  };

  const handleRender = async () => {
    setIsRendering(true);
    setRenderProgress(0);

    try {
      // Prepare render data - filter shots that have soundFX, video or image
      // Priority: SoundFX > Video > Image (if SoundFX exists, use it; otherwise check video; otherwise check image)
      const shotsForRender = scriptResponse
        .filter(shot => shot.selectedSoundFXUrl || shot.selectedVideoUrl || shot.selectedImageUrl)
        .map(shot => ({
          id: shot.id,
          soundfx: shot.selectedSoundFXUrl || null,
          video: shot.selectedVideoUrl || null,
          image: shot.selectedImageUrl || null,
        }));

      if (shotsForRender.length === 0) {
        alert('No soundFX, videos or images selected to render. Please select at least one.');
        setIsRendering(false);
        return;
      }

      const response = await fetch(WEBHOOK_URLS[environment].render, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shots: shotsForRender,
          projectName: project?.projectName || 'rendered-video',
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        let videoUrl = responseData?.videoUrl || responseData?.data?.videoUrl;

        if (videoUrl) {
          // Format the video URL if it's a relative path
          videoUrl = formatMediaUrl(videoUrl);
          setRenderedVideoUrl(videoUrl);
          alert('Video rendered successfully!');
        } else {
          alert('Render completed but could not retrieve video URL. Check console for details.');
          console.log('Render response:', responseData);
        }
      } else {
        alert('Failed to render video. Check console for details.');
      }
    } catch (error) {
      alert('Error rendering video. Check console for details.');
      console.error('Error rendering video:', error);
    } finally {
      setIsRendering(false);
    }
  };

  const toggleEnvironment = () => {
    setEnvironment(env => (env === 'production' ? 'test' : 'production'));
  };

  return (
    <div className="App">
      {currentView === 'projectSelection' && (
        <div className="project-selection-container">
          <h1>AI Video Creator</h1>
          <p>Welcome! Please select an option to get started.</p>
          <div className="button-group">
            <button onClick={handleNewProject}>New Project</button>
            <button onClick={handleOpenProject}>Open Project</button>
          </div>
        </div>
      )}

      {currentView === 'projectOpenSelection' && (
        <div className="project-selection-container">
          <h2>Select a Project</h2>
          <div className="project-list">
            {projectList.length > 0 ? (
              projectList.map(name => <button key={name} onClick={() => handleSelectProject(name)}>{name}</button>)
            ) : <p>No projects found.</p>}
          </div>
          <button onClick={() => setCurrentView('projectSelection')}>Back</button>
        </div>
      )}

      {currentView === 'mainApp' && (
        <div>
          <div className="project-header">
            <button onClick={() => setCurrentView('projectSelection')}>My Projects</button>
            <button onClick={toggleEnvironment} style={{ marginLeft: 'auto' }}>
              Switch to {environment === 'production' ? 'Test' : 'Production'}
            </button>
            {isSaving && <span className="saving-indicator">Saving...</span>}
          </div>

          <nav className="navigation">
            <div className="navigation-content">
              <div className="project-info">
                <h2>{project?.projectName}</h2>
                <p>Complete the steps below to create your video.</p>
              </div>

              <div className="step-tabs">
                {pipelineSteps.map((step, index) => (
                  <button
                    key={step}
                    className={`step-tab ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
                    onClick={() => setCurrentStep(index)}
                  >
                    <span className="step-number">{index + 1}</span>
                    <span>{step}</span>
                  </button>
                ))}
              </div>
            </div>
          </nav>

          {currentStep === 0 && (
            <div className="main-container">
              {/* Template Section */}
              <div className="section-card">
                <div className="section-header">
                  <h3 className="section-title">AI Prompt Template</h3>
                  <button onClick={() => setShowTemplateEditor(!showTemplateEditor)}>
                    {showTemplateEditor ? 'Hide Template' : 'Choose Template'}
                  </button>
                </div>

                {selectedTemplateName && <p className="template-info">Selected: {selectedTemplateName}</p>}
                {!selectedTemplateName && templateList.length === 0 && <p className="template-info">No template selected</p>}

                {showTemplateEditor && (
                  <div className="template-editor-container">
                    <textarea
                      value={promptTemplate}
                      onChange={(e) => setPromptTemplate(e.target.value)}
                      rows="6"
                      style={{width: '100%', marginBottom: '10px'}}
                    />
                    <div className="button-group">
                      <button onClick={() => handleSaveTemplate('script')}>Save Template</button>
                      <button onClick={() => handleOpenTemplate('script')}>Open Template</button>
                    </div>
                    {showTemplateList && (
                      <div className="template-list-modal">
                        <h4>Select a Template</h4>
                        {templateList.length > 0 ? (
                          <>
                            <div className="button-group">
                              {templateList.map(name => (
                                <button
                                  key={name}
                                  onClick={() => handleLoadTemplate(name, 'script')}
                                  className={name === selectedTemplateName ? 'primary' : ''}
                                >
                                  {name} {defaultTemplates.script === name && '⭐'}
                                </button>
                              ))}
                            </div>
                            {selectedTemplateName && (
                              <button
                                onClick={() => handleSetDefaultTemplate(selectedTemplateName, 'script')}
                                style={{marginTop: '10px'}}
                              >
                                Set "{selectedTemplateName}" as Default
                              </button>
                            )}
                          </>
                        ) : (
                          <p>No templates available.</p>
                        )}
                        <button onClick={() => setShowTemplateList(false)}>Close</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Video Idea Section */}
              <div className="section-card">
                <div className="section-header">
                  <h3 className="section-title">Video Idea</h3>
                </div>

                <label className="section-label">Enter your video concept:</label>
                <div className="input-group">
                  <textarea
                    value={videoIdea}
                    onChange={(e) => setVideoIdea(e.target.value)}
                    placeholder="Enter video idea (e.g., 'pomeranian being a police officer')"
                    disabled={isLoading}
                    rows="4"
                  />
                  <button
                    className="primary"
                    onClick={() => {
                      handleSendIdeaToN8N(WEBHOOK_URLS[environment].script, {
                        promptTemplate: promptTemplate,
                        videoIdea: videoIdea
                      }, (data) => {
                        let allShots = [];
                        if (data && data[0]) {
                          Object.values(data[0]).forEach(section => {
                            if (Array.isArray(section)) {
                              allShots.push(...section.map(shot => ({ id: `shot-${shot.shot_number}`, script: shot.action_shot, imageUrls: [], selectedImageUrl: '' })));
                            }
                          });
                        }
                        setScriptResponse(allShots);
                        setProject(p => ({ ...p, idea: videoIdea, shots: allShots }));
                      })
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Generating...' : 'Generate Script'}
                  </button>
                </div>
                {isLoading && <p className="template-info">Loading script from AI...</p>}
              </div>

              {/* Generated Shots Section */}
              {scriptResponse.length > 0 && (
                <div className="section-card">
                  <div className="section-header">
                    <h3 className="section-title">Script Shots</h3>
                    <div className="button-group">
                      <button onClick={handleUndo} disabled={historyPointer <= 0}>Undo</button>
                      <button onClick={handleRedo} disabled={historyPointer >= history.length - 1}>Redo</button>
                      <button onClick={handleAddNewCard} className="primary">Add New Shot</button>
                    </div>
                  </div>

                  <div className="section-content">
                    <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
                      <SortableContext items={scriptResponse.map(item => item.id)} strategy={verticalListSortingStrategy}>
                        {scriptResponse.map(shot => (
                          <DraggableScriptCard
                            key={shot.id}
                            id={shot.id}
                            script={shot.script}
                            onScriptChange={handleScriptChange}
                            onDelete={handleDeleteScriptCard}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 1 && (
            <div className="main-container">
              {/* Template Section */}
              <div className="section-card">
                <div className="section-header">
                  <h3 className="section-title">AI Prompt Template</h3>
                  <button onClick={() => setShowArtDirectionTemplateEditor(!showArtDirectionTemplateEditor)}>
                    {showArtDirectionTemplateEditor ? 'Hide Template' : 'Choose Template'}
                  </button>
                </div>

                {selectedArtDirectionTemplateName && <p className="template-info">Selected: {selectedArtDirectionTemplateName}</p>}
                {!selectedArtDirectionTemplateName && artDirectionTemplateList.length === 0 && <p className="template-info">No template selected</p>}

                {showArtDirectionTemplateEditor && (
                  <div className="template-editor-container">
                    <textarea
                      value={artDirectionPromptTemplate}
                      onChange={(e) => setArtDirectionPromptTemplate(e.target.value)}
                      rows="6"
                      style={{width: '100%', marginBottom: '10px'}}
                    />
                    <div className="button-group">
                      <button onClick={() => handleSaveTemplate('art_direction')}>Save Template</button>
                      <button onClick={() => handleOpenTemplate('art_direction')}>Open Template</button>
                    </div>
                    {showArtDirectionTemplateList && (
                      <div className="template-list-modal">
                        <h4>Select a Template</h4>
                        {artDirectionTemplateList.length > 0 ? (
                          <>
                            <div className="button-group">
                              {artDirectionTemplateList.map(name => (
                                <button
                                  key={name}
                                  onClick={() => handleLoadTemplate(name, 'art_direction')}
                                  className={name === selectedArtDirectionTemplateName ? 'primary' : ''}
                                >
                                  {name} {defaultTemplates.art_direction === name && '⭐'}
                                </button>
                              ))}
                            </div>
                            {selectedArtDirectionTemplateName && (
                              <button
                                onClick={() => handleSetDefaultTemplate(selectedArtDirectionTemplateName, 'art_direction')}
                                style={{marginTop: '10px'}}
                              >
                                Set "{selectedArtDirectionTemplateName}" as Default
                              </button>
                            )}
                          </>
                        ) : (
                          <p>No templates available.</p>
                        )}
                        <button onClick={() => setShowArtDirectionTemplateList(false)}>Close</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Input Section */}
              <div className="section-card">
                <div className="section-header">
                  <h3 className="section-title">Generate Art Direction</h3>
                </div>

                <div className="section-content">
                  <label className="section-label">Script Preview:</label>
                  <div className="script-preview-box">
                    {scriptResponse.map(shot => <p key={shot.id}>{shot.script}</p>)}
                  </div>

                  <label className="section-label" style={{marginTop: 'var(--spacing-lg)'}}>Additional Information:</label>
                  <textarea
                    value={artDirectionIdea}
                    onChange={(e) => setArtDirectionIdea(e.target.value)}
                    placeholder="Characters, Locations, Outfits..."
                    disabled={isLoading}
                    rows="4"
                  />

                  <label className="section-label" style={{marginTop: 'var(--spacing-lg)'}}>Upload Reference Image:</label>
                  <div className="input-group" style={{marginBottom: 'var(--spacing-md)'}}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReferenceImageFileChange}
                      disabled={uploadingReferenceImage}
                    />
                    <button
                      className="primary-button"
                      onClick={handleUploadReferenceImage}
                      disabled={!referenceImageFile || uploadingReferenceImage}
                    >
                      {uploadingReferenceImage ? 'Uploading...' : 'Upload Image'}
                    </button>
                  </div>

                  {imageGenUrl && (
                    <div style={{marginBottom: 'var(--spacing-md)'}}>
                      <label className="section-label">Current Reference URL:</label>
                      <input
                        type="text"
                        value={imageGenUrl}
                        readOnly
                        style={{backgroundColor: '#2a2a2a', color: '#e0e0e0', cursor: 'default'}}
                      />
                    </div>
                  )}

                  {referenceImageHistory.length > 0 && (
                    <div style={{marginBottom: 'var(--spacing-md)'}}>
                      <label className="section-label">Previously Uploaded References:</label>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                        gap: '10px',
                        marginTop: '10px'
                      }}>
                        {referenceImageHistory.map((item, index) => (
                          <div
                            key={index}
                            onClick={() => handleSelectReferenceFromHistory(item.url)}
                            style={{
                              cursor: 'pointer',
                              border: imageGenUrl === item.url ? '3px solid #007bff' : '2px solid #ddd',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              aspectRatio: '1',
                              position: 'relative'
                            }}
                          >
                            <img
                              src={formatMediaUrl(item.url)}
                              alt={`Reference ${index + 1}`}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button className="primary" onClick={handleGenerateArtDirection} disabled={isLoading} style={{width: '100%'}}>
                    {isLoading ? 'Generating...' : 'Generate Art Direction'}
                  </button>
                </div>
              </div>

              {/* Art Direction Result */}
              {artDirectionResponse && (
                <div className="section-card">
                  <div className="section-header">
                    <h3 className="section-title">Art Direction Result</h3>
                  </div>
                  <ArtDirectionCard name="Art Direction" description={artDirectionResponse} onSave={handleArtDirectionChange} />
                </div>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="main-container">
              {/* Template Section */}
              <div className="section-card">
                <div className="section-header">
                  <h3 className="section-title">AI Prompt Template</h3>
                  <button onClick={() => setShowImageGenTemplateEditor(!showImageGenTemplateEditor)}>
                    {showImageGenTemplateEditor ? 'Hide Template' : 'Choose Template'}
                  </button>
                </div>

                {selectedImageGenTemplateName && <p className="template-info">Selected: {selectedImageGenTemplateName}</p>}
                {!selectedImageGenTemplateName && imageGenTemplateList.length === 0 && <p className="template-info">No template selected</p>}

                {showImageGenTemplateEditor && (
                  <div className="template-editor-container">
                    <textarea
                      value={imageGenPromptTemplate}
                      onChange={(e) => setImageGenPromptTemplate(e.target.value)}
                      rows="6"
                      style={{width: '100%', marginBottom: '10px'}}
                    />
                    <div className="button-group">
                      <button onClick={() => handleSaveTemplate('image_generation')}>Save Template</button>
                      <button onClick={() => handleOpenTemplate('image_generation')}>Open Template</button>
                    </div>
                    {showImageGenTemplateList && (
                      <div className="template-list-modal">
                        <h4>Select a Template</h4>
                        {imageGenTemplateList.length > 0 ? (
                          <>
                            <div className="button-group">
                              {imageGenTemplateList.map(name => (
                                <button
                                  key={name}
                                  onClick={() => handleLoadTemplate(name, 'image_generation')}
                                  className={name === selectedImageGenTemplateName ? 'primary' : ''}
                                >
                                  {name} {defaultTemplates.image_generation === name && '⭐'}
                                </button>
                              ))}
                            </div>
                            {selectedImageGenTemplateName && (
                              <button
                                onClick={() => handleSetDefaultTemplate(selectedImageGenTemplateName, 'image_generation')}
                                style={{marginTop: '10px'}}
                              >
                                Set "{selectedImageGenTemplateName}" as Default
                              </button>
                            )}
                          </>
                        ) : (
                          <p>No templates available.</p>
                        )}
                        <button onClick={() => setShowImageGenTemplateList(false)}>Close</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Settings Section */}
              <div className="section-card">
                <div className="section-header">
                  <h3 className="section-title">Image Generation Settings</h3>
                </div>

                <div className="section-content">
                  <label className="section-label">Upload Reference Image:</label>
                  <div className="input-group" style={{marginBottom: 'var(--spacing-md)'}}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReferenceImageFileChange}
                      disabled={uploadingReferenceImage}
                    />
                    <button
                      className="primary-button"
                      onClick={handleUploadReferenceImage}
                      disabled={!referenceImageFile || uploadingReferenceImage}
                    >
                      {uploadingReferenceImage ? 'Uploading...' : 'Upload Image'}
                    </button>
                  </div>

                  {imageGenUrl && (
                    <div style={{marginBottom: 'var(--spacing-md)'}}>
                      <label className="section-label">Current Reference URL:</label>
                      <input
                        type="text"
                        value={imageGenUrl}
                        readOnly
                        style={{backgroundColor: '#2a2a2a', color: '#e0e0e0', cursor: 'default'}}
                      />
                    </div>
                  )}

                  {referenceImageHistory.length > 0 && (
                    <div>
                      <label className="section-label">Previously Uploaded References:</label>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                        gap: '10px',
                        marginTop: '10px'
                      }}>
                        {referenceImageHistory.map((item, index) => (
                          <div
                            key={index}
                            onClick={() => handleSelectReferenceFromHistory(item.url)}
                            style={{
                              cursor: 'pointer',
                              border: imageGenUrl === item.url ? '3px solid #007bff' : '2px solid #ddd',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              aspectRatio: '1',
                              position: 'relative'
                            }}
                          >
                            <img
                              src={formatMediaUrl(item.url)}
                              alt={`Reference ${index + 1}`}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Generation Table Section */}
              <div className="section-card">
                <div className="section-header">
                  <h3 className="section-title">Generate Images</h3>
                </div>

                <ImageGenerationTable
                  key={environment}
                  shots={scriptResponse}
                  onNewImageFromAI={handleNewImageFromAI}
                  onSetSelectedImage={handleSetSelectedImage}
                  onRemoveImage={handleRemoveImageFromShot}
                  artDirectionText={artDirectionResponse}
                  imageGenUrl={imageGenUrl}
                  webhookUrl={WEBHOOK_URLS[environment].imageGen}
                  imageGenPromptTemplate={imageGenPromptTemplate}
                  promptGenWebhookUrl={WEBHOOK_URLS[environment].promptGen}
                  onPromptChange={handleShotPromptChange}
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="main-container">
              {/* Template Section */}
              <div className="section-card">
                <div className="section-header">
                  <h3 className="section-title">AI Prompt Template</h3>
                  <button onClick={() => setShowVideoGenTemplateEditor(!showVideoGenTemplateEditor)}>
                    {showVideoGenTemplateEditor ? 'Hide Template' : 'Choose Template'}
                  </button>
                </div>

                {selectedVideoGenTemplateName && <p className="template-info">Selected: {selectedVideoGenTemplateName}</p>}
                {!selectedVideoGenTemplateName && videoGenTemplateList.length === 0 && <p className="template-info">No template selected</p>}

                {showVideoGenTemplateEditor && (
                  <div className="template-editor-container">
                    <textarea
                      value={videoGenPromptTemplate}
                      onChange={(e) => setVideoGenPromptTemplate(e.target.value)}
                      rows="6"
                      style={{width: '100%', marginBottom: '10px'}}
                    />
                    <div className="button-group">
                      <button onClick={() => handleSaveTemplate('video_generation')}>Save Template</button>
                      <button onClick={() => handleOpenTemplate('video_generation')}>Open Template</button>
                    </div>
                    {showVideoGenTemplateList && (
                      <div className="template-list-modal">
                        <h4>Select a Template</h4>
                        {videoGenTemplateList.length > 0 ? (
                          <>
                            <div className="button-group">
                              {videoGenTemplateList.map(name => (
                                <button
                                  key={name}
                                  onClick={() => handleLoadTemplate(name, 'video_generation')}
                                  className={name === selectedVideoGenTemplateName ? 'primary' : ''}
                                >
                                  {name} {defaultTemplates.video_generation === name && '⭐'}
                                </button>
                              ))}
                            </div>
                            {selectedVideoGenTemplateName && (
                              <button
                                onClick={() => handleSetDefaultTemplate(selectedVideoGenTemplateName, 'video_generation')}
                                style={{marginTop: '10px'}}
                              >
                                Set "{selectedVideoGenTemplateName}" as Default
                              </button>
                            )}
                          </>
                        ) : (
                          <p>No templates available.</p>
                        )}
                        <button onClick={() => setShowVideoGenTemplateList(false)}>Close</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Generation Table Section */}
              <div className="section-card">
                <div className="section-header">
                  <h3 className="section-title">Generate Videos</h3>
                </div>

                <VideoGenerationTable
                  shots={scriptResponse}
                  videoGenPromptTemplate={videoGenPromptTemplate}
                  videoPromptGenWebhookUrl={WEBHOOK_URLS[environment].videoPromptGen}
                  videoGenWebhookUrl={WEBHOOK_URLS[environment].videoGen}
                  artDirectionText={artDirectionResponse}
                  onVideoPromptChange={handleVideoPromptChange}
                  onNewVideoFromAI={handleNewVideoFromAI}
                  onSetSelectedVideo={handleSetSelectedVideo}
                  onRemoveVideo={handleRemoveVideoFromShot}
                />
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="main-container">
              {/* Template Section */}
              <div className="section-card">
                <div className="section-header">
                  <h3 className="section-title">AI Prompt Template</h3>
                  <button onClick={() => setShowSoundFXGenTemplateEditor(!showSoundFXGenTemplateEditor)}>
                    {showSoundFXGenTemplateEditor ? 'Hide Template' : 'Choose Template'}
                  </button>
                </div>

                {selectedSoundFXGenTemplateName && <p className="template-info">Selected: {selectedSoundFXGenTemplateName}</p>}
                {!selectedSoundFXGenTemplateName && soundFXGenTemplateList.length === 0 && <p className="template-info">No template selected</p>}

                {showSoundFXGenTemplateEditor && (
                  <div className="template-editor-container">
                    <textarea
                      value={soundFXPromptTemplate}
                      onChange={(e) => setSoundFXPromptTemplate(e.target.value)}
                      rows="6"
                      style={{width: '100%', marginBottom: '10px'}}
                    />
                    <div className="button-group">
                      <button onClick={() => handleSaveTemplate('sound_fx')}>Save Template</button>
                      <button onClick={() => handleOpenTemplate('sound_fx')}>Open Template</button>
                    </div>
                    {showSoundFXGenTemplateList && (
                      <div className="template-list-modal">
                        <h4>Select a Template</h4>
                        {soundFXGenTemplateList.length > 0 ? (
                          <>
                            <div className="button-group">
                              {soundFXGenTemplateList.map(name => (
                                <button
                                  key={name}
                                  onClick={() => handleLoadTemplate(name, 'sound_fx')}
                                  className={name === selectedSoundFXGenTemplateName ? 'primary' : ''}
                                >
                                  {name} {defaultTemplates.sound_fx === name && '⭐'}
                                </button>
                              ))}
                            </div>
                            {selectedSoundFXGenTemplateName && (
                              <button
                                onClick={() => handleSetDefaultTemplate(selectedSoundFXGenTemplateName, 'sound_fx')}
                                style={{marginTop: '10px'}}
                              >
                                Set "{selectedSoundFXGenTemplateName}" as Default
                              </button>
                            )}
                          </>
                        ) : (
                          <p>No templates available.</p>
                        )}
                        <button onClick={() => setShowSoundFXGenTemplateList(false)}>Close</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Generation Table Section */}
              <div className="section-card">
                <div className="section-header">
                  <h3 className="section-title">Generate SoundFX</h3>
                </div>

                <SoundFXGenerationTable
                  shots={scriptResponse}
                  soundFXPromptTemplate={soundFXPromptTemplate}
                  soundFXPromptGenWebhookUrl={WEBHOOK_URLS[environment].soundFXPromptGen}
                  soundFXGenWebhookUrl={WEBHOOK_URLS[environment].soundFXGen}
                  artDirectionText={artDirectionResponse}
                  onSoundFXPromptChange={handleSoundFXPromptChange}
                  onNewSoundFXFromAI={handleNewSoundFXFromAI}
                  onSetSelectedSoundFX={handleSetSelectedSoundFX}
                  onRemoveSoundFX={handleRemoveSoundFXFromShot}
                />
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="main-container">
              {/* Render Summary Section */}
              <div className="section-card">
                <div className="section-header">
                  <h3 className="section-title">Render Final Video</h3>
                </div>

                <div className="section-content">
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
                    Review your shots below. The final video will combine all selected assets in order.
                    Priority: SoundFX &gt; Video &gt; Image. Images will be displayed for 5 seconds each.
                  </p>

                  {/* Shots Summary */}
                  <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <h4 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-md)' }}>Shots Summary</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                      {scriptResponse.map((shot, index) => {
                        // Determine what will be used: SoundFX > Video > Image
                        let statusLabel = 'SKIPPED';
                        let statusColor = 'rgba(239, 68, 68, 0.3)'; // red
                        let statusTextColor = 'var(--color-error)';

                        if (shot.selectedSoundFXUrl) {
                          statusLabel = 'SOUNDFX';
                          statusColor = 'rgba(168, 85, 247, 0.3)'; // purple
                          statusTextColor = 'var(--color-primary)';
                        } else if (shot.selectedVideoUrl) {
                          statusLabel = 'VIDEO';
                          statusColor = 'rgba(74, 222, 128, 0.3)'; // green
                          statusTextColor = 'var(--color-success)';
                        } else if (shot.selectedImageUrl) {
                          statusLabel = 'IMAGE (5s)';
                          statusColor = 'rgba(251, 191, 36, 0.3)'; // yellow
                          statusTextColor = 'var(--color-warning)';
                        }

                        return (
                          <div
                            key={shot.id}
                            style={{
                              padding: 'var(--spacing-md)',
                              background: 'rgba(45, 53, 72, 0.4)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-md)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                              <span style={{ fontWeight: 'bold', color: 'var(--color-primary)', minWidth: '30px' }}>
                                #{index + 1}
                              </span>
                              <span style={{ flex: 1, color: 'var(--color-text-secondary)' }}>
                                {shot.script}
                              </span>
                              <span
                                style={{
                                  padding: '4px 12px',
                                  borderRadius: 'var(--radius-md)',
                                  fontSize: 'var(--font-size-xs)',
                                  fontWeight: 'bold',
                                  background: statusColor,
                                  color: statusTextColor,
                                }}
                              >
                                {statusLabel}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Render Button */}
                  <button
                    className="primary"
                    onClick={handleRender}
                    disabled={isRendering || scriptResponse.length === 0}
                    style={{ width: '100%', padding: 'var(--spacing-lg)' }}
                  >
                    {isRendering ? 'Rendering... ' : 'Render Final Video'}
                  </button>

                  {/* Rendered Video Result */}
                  {renderedVideoUrl && (
                    <div style={{ marginTop: 'var(--spacing-xl)' }}>
                      <h4 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-md)' }}>
                        Rendered Video
                      </h4>
                      <div
                        style={{
                          padding: 'var(--spacing-lg)',
                          background: 'rgba(30, 35, 51, 0.6)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-lg)',
                        }}
                      >
                        <video
                          src={renderedVideoUrl}
                          controls
                          style={{
                            width: '100%',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--spacing-md)',
                          }}
                        />
                        <a
                          href={renderedVideoUrl}
                          download
                          style={{
                            display: 'inline-block',
                            padding: '8px 16px',
                            background: 'var(--color-primary)',
                            color: 'white',
                            borderRadius: 'var(--radius-md)',
                            textDecoration: 'none',
                            fontSize: 'var(--font-size-sm)',
                          }}
                        >
                          Download Video
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
