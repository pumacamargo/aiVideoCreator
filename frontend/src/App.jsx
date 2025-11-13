import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { DndContext, closestCorners } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { DraggableScriptCard } from './components/DraggableScriptCard';
import { ArtDirectionCard } from './components/ArtDirectionCard';
import { ImageGenerationTable } from './components/ImageGenerationTable';
import { VideoGenerationTable } from './components/VideoGenerationTable';

const WEBHOOK_URLS = {
  test: {
    script: 'https://n8n.lemonsushi.com/webhook-test/scriptIdea',
    artDirection: 'https://n8n.lemonsushi.com/webhook-test/artdirection',
    imageGen: 'https://n8n.lemonsushi.com/webhook-test/ImageGenFromPrompt',
    promptGen: 'https://n8n.lemonsushi.com/webhook-test/promptImageGen',
    videoPromptGen: 'https://n8n.lemonsushi.com/webhook-test/prompVideoGen',
    videoGen: 'https://n8n.lemonsushi.com/webhook-test/VideoGenFromPrompt',
    render: 'http://localhost:3001/render',
  },
  production: {
    script: 'https://n8n.lemonsushi.com/webhook/scriptIdea',
    artDirection: 'https://n8n.lemonsushi.com/webhook/artdirection',
    imageGen: 'https://n8n.lemonsushi.com/webhook/ImageGenFromPrompt',
    promptGen: 'https://n8n.lemonsushi.com/webhook/promptImageGen',
    videoPromptGen: 'https://n8n.lemonsushi.com/webhook/prompVideoGen',
    videoGen: 'https://n8n.lemonsushi.com/webhook/VideoGenFromPrompt',
    render: 'http://localhost:3001/render',
  }
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

  // State for Render Section
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState(null);

  const pipelineSteps = ['Script', 'Art Direction', 'Image Generation', 'Video Generation', 'Render'];
  const websocket = useRef(null);

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
    if (currentView === 'mainApp' && websocket.current && websocket.current.readyState === WebSocket.OPEN) {
      websocket.current.send(JSON.stringify({ action: 'list_templates', payload: { templateType: 'script' } }));
      websocket.current.send(JSON.stringify({ action: 'list_templates', payload: { templateType: 'art_direction' } }));
      websocket.current.send(JSON.stringify({ action: 'list_templates', payload: { templateType: 'image_generation' } }));
      websocket.current.send(JSON.stringify({ action: 'list_templates', payload: { templateType: 'video_generation' } }));
    }
  }, [currentView]);

  useEffect(() => {
    websocket.current = new WebSocket('ws://localhost:3001');
    websocket.current.onopen = () => {
      console.log('WebSocket connection established');
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
            imageUrls: shot.imageUrls || (shot.imageUrl ? [shot.imageUrl] : []),
            selectedImageUrl: shot.selectedImageUrl || shot.imageUrl || ''
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
        }
      } else if (message.action === 'template_list' && message.status === 'success') {
        if (message.payload.templateType === 'script') {
          setTemplateList(message.payload.templates);
          if (!selectedTemplateName && message.payload.templates.length > 0) {
            handleLoadTemplate(message.payload.templates[0], 'script');
          }
        } else if (message.payload.templateType === 'art_direction') {
          setArtDirectionTemplateList(message.payload.templates);
          if (!selectedArtDirectionTemplateName && message.payload.templates.length > 0) {
            handleLoadTemplate(message.payload.templates[0], 'art_direction');
          }
        } else if (message.payload.templateType === 'image_generation') {
          setImageGenTemplateList(message.payload.templates);
          if (!selectedImageGenTemplateName && message.payload.templates.length > 0) {
            handleLoadTemplate(message.payload.templates[0], 'image_generation');
          }
        } else if (message.payload.templateType === 'video_generation') {
          setVideoGenTemplateList(message.payload.templates);
          if (!selectedVideoGenTemplateName && message.payload.templates.length > 0) {
            handleLoadTemplate(message.payload.templates[0], 'video_generation');
          }
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
        }
      } else if (message.action === 'image_saved_to_project' && message.status === 'success') {
        const { externalImageUrl, localImageUrl } = message.payload;
        const newScripts = scriptResponse.map(shot => {
          const newImageUrls = shot.imageUrls.map(url => url === externalImageUrl ? localImageUrl : url);
          const newSelectedImageUrl = shot.selectedImageUrl === externalImageUrl ? localImageUrl : shot.selectedImageUrl;
          return { ...shot, imageUrls: newImageUrls, selectedImageUrl: newSelectedImageUrl };
        });
        setScriptResponse(newScripts);
        setProject(p => ({ ...p, shots: newScripts }));
      } else if (message.action === 'video_saved_to_project' && message.status === 'success') {
        const { externalVideoUrl, localVideoUrl } = message.payload;
        const newScripts = scriptResponse.map(shot => {
          const newVideoUrls = shot.videoUrls.map(url => url === externalVideoUrl ? localVideoUrl : url);
          const newSelectedVideoUrl = shot.selectedVideoUrl === externalVideoUrl ? localVideoUrl : shot.selectedVideoUrl;
          return { ...shot, videoUrls: newVideoUrls, selectedVideoUrl: newSelectedVideoUrl };
        });
        setScriptResponse(newScripts);
        setProject(p => ({ ...p, shots: newScripts }));
      } else if (message.status === 'error') {
        alert(`Error: ${message.message}`);
        setIsSaving(false);
      }
    };
    websocket.current.onclose = () => console.log('WebSocket connection closed');
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
    }
  };

  const handleLoadTemplate = (templateName, templateType) => {
    if (websocket.current) {
      websocket.current.send(JSON.stringify({ action: 'load_template', payload: { templateName, templateType } }));
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

    if (artDirectionImage) {
      const formData = new FormData();
      formData.append('artDirectionPromptTemplate', artDirectionPromptTemplate);
      formData.append('artDirectionIdea', artDirectionIdea);
      formData.append('script', scriptText);
      formData.append('image', artDirectionImage);
      handleSendFormDataToN8N(n8nWebhookUrl, formData, processResponse);
    } else {
      handleSendIdeaToN8N(n8nWebhookUrl, { 
        artDirectionPromptTemplate: artDirectionPromptTemplate,
        artDirectionIdea: artDirectionIdea, 
        script: scriptText 
      }, processResponse);
    }
  };

  const handleNewImageFromAI = (shotId, externalImageUrl) => {
    const updatedScripts = scriptResponse.map(s => {
      if (s.id === shotId) {
        const newImageUrls = [...s.imageUrls, externalImageUrl];
        return { ...s, imageUrls: newImageUrls, selectedImageUrl: externalImageUrl };
      }
      return s;
    });
    setScriptResponse(updatedScripts);
    setProject(p => ({ ...p, shots: updatedScripts }));

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
    const updatedScripts = scriptResponse.map(s => 
      s.id === shotId ? { ...s, selectedImageUrl: imageUrl } : s
    );
    setScriptResponse(updatedScripts);
    setProject(p => ({ ...p, shots: updatedScripts }));
  };

  const handleShotPromptChange = (shotId, newPrompt) => {
    const updatedScripts = scriptResponse.map(s => 
      s.id === shotId ? { ...s, prompt: newPrompt } : s
    );
    setScriptResponse(updatedScripts);
    setProject(p => ({ ...p, shots: updatedScripts }));
  };

  const handleVideoPromptChange = (shotId, newVideoPrompt) => {
    const updatedScripts = scriptResponse.map(s => 
      s.id === shotId ? { ...s, videoPrompt: newVideoPrompt } : s
    );
    setScriptResponse(updatedScripts);
    setProject(p => ({ ...p, shots: updatedScripts }));
  };

  const handleNewVideoFromAI = (shotId, newVideoUrl) => {
    const updatedScripts = scriptResponse.map(s => {
      if (s.id === shotId) {
        const newVideoUrls = [...(s.videoUrls || []), newVideoUrl];
        return { ...s, videoUrls: newVideoUrls, selectedVideoUrl: newVideoUrl };
      }
      return s;
    });
    setScriptResponse(updatedScripts);
    setProject(p => ({ ...p, shots: updatedScripts }));

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
    const updatedScripts = scriptResponse.map(s =>
      s.id === shotId ? { ...s, selectedVideoUrl: videoUrl } : s
    );
    setScriptResponse(updatedScripts);
    setProject(p => ({ ...p, shots: updatedScripts }));
  };

  const handleRender = async () => {
    setIsRendering(true);
    setRenderProgress(0);

    try {
      // Prepare render data - filter shots that have video or image
      const shotsForRender = scriptResponse
        .filter(shot => shot.selectedVideoUrl || shot.selectedImageUrl)
        .map(shot => ({
          id: shot.id,
          video: shot.selectedVideoUrl || null,
          image: shot.selectedImageUrl || null,
        }));

      if (shotsForRender.length === 0) {
        alert('No videos or images selected to render. Please select at least one video or image.');
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
        const videoUrl = responseData?.videoUrl || responseData?.data?.videoUrl;

        if (videoUrl) {
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
                          <div className="button-group">
                            {templateList.map(name => (
                              <button
                                key={name}
                                onClick={() => handleLoadTemplate(name, 'script')}
                                className={name === selectedTemplateName ? 'primary' : ''}
                              >
                                {name}
                              </button>
                            ))}
                          </div>
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
                          <div className="button-group">
                            {artDirectionTemplateList.map(name => (
                              <button
                                key={name}
                                onClick={() => handleLoadTemplate(name, 'art_direction')}
                                className={name === selectedArtDirectionTemplateName ? 'primary' : ''}
                              >
                                {name}
                              </button>
                            ))}
                          </div>
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

                  <label className="section-label" style={{marginTop: 'var(--spacing-lg)'}}>Image Reference:</label>
                  <div className="input-group">
                    <input type="file" accept="image/*" onChange={handleImageChange} />
                    <button className="primary" onClick={handleGenerateArtDirection} disabled={isLoading}>
                      {isLoading ? 'Generating...' : 'Generate Art Direction'}
                    </button>
                  </div>
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
                          <div className="button-group">
                            {imageGenTemplateList.map(name => (
                              <button
                                key={name}
                                onClick={() => handleLoadTemplate(name, 'image_generation')}
                                className={name === selectedImageGenTemplateName ? 'primary' : ''}
                              >
                                {name}
                              </button>
                            ))}
                          </div>
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
                  <label className="section-label">Image Reference URL:</label>
                  <input
                    type="text"
                    placeholder="Enter image URL for style reference"
                    value={imageGenUrl}
                    onChange={handleImageGenUrlChange}
                  />
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
                          <div className="button-group">
                            {videoGenTemplateList.map(name => (
                              <button
                                key={name}
                                onClick={() => handleLoadTemplate(name, 'video_generation')}
                                className={name === selectedVideoGenTemplateName ? 'primary' : ''}
                              >
                                {name}
                              </button>
                            ))}
                          </div>
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
                />
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="main-container">
              {/* Render Summary Section */}
              <div className="section-card">
                <div className="section-header">
                  <h3 className="section-title">Render Final Video</h3>
                </div>

                <div className="section-content">
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
                    Review your shots below. The final video will combine all selected videos and images in order.
                    Images will be displayed for 5 seconds each.
                  </p>

                  {/* Shots Summary */}
                  <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <h4 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-md)' }}>Shots Summary</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                      {scriptResponse.map((shot, index) => (
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
                                background: shot.selectedVideoUrl
                                  ? 'rgba(74, 222, 128, 0.3)'
                                  : shot.selectedImageUrl
                                  ? 'rgba(251, 191, 36, 0.3)'
                                  : 'rgba(239, 68, 68, 0.3)',
                                color: shot.selectedVideoUrl
                                  ? 'var(--color-success)'
                                  : shot.selectedImageUrl
                                  ? 'var(--color-warning)'
                                  : 'var(--color-error)',
                              }}
                            >
                              {shot.selectedVideoUrl ? 'VIDEO' : shot.selectedImageUrl ? 'IMAGE (5s)' : 'SKIPPED'}
                            </span>
                          </div>
                        </div>
                      ))}
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
