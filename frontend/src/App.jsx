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
    imageGen: 'https://n8n.lemonsushi.com/webhook-test/imageGen',
  },
  production: {
    script: 'https://n8n.lemonsushi.com/webhook/scriptIdea',
    artDirection: 'https://n8n.lemonsushi.com/webhook/artdirection',
    imageGen: 'https://n8n.lemonsushi.com/webhook/imageGen',
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

  const pipelineSteps = ['Script', 'Art Direction', 'Image Generation', 'Video Generation', 'Trimming', 'Render'];
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
      const templateContent = templateType === 'script' ? promptTemplate : artDirectionPromptTemplate;
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '10px 0' }}>
            <button onClick={handlePreviousStep} disabled={currentStep === 0}>Previous</button>
            <div style={{ display: 'flex', gap: '10px' }}>
              {pipelineSteps.map((step, index) => (
                <span key={step} style={{ padding: '5px 10px', borderRadius: '15px', backgroundColor: index === currentStep ? '#007bff' : '#e0e0e0', color: index === currentStep ? 'white' : '#333' }}>{step}</span>
              ))}
            </div>
            <button onClick={handleNextStep} disabled={currentStep === pipelineSteps.length - 1}>Next</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
            <h2 style={{ color: '#007bff' }}>Project: {project?.projectName}</h2>
            <button onClick={() => setCurrentView('projectSelection')} style={{ marginLeft: '10px' }}>My Projects</button>
            <button onClick={toggleEnvironment} style={{ marginLeft: 'auto' }}>
              Switch to {environment === 'production' ? 'Test' : 'Production'}
            </button>
            {isSaving && <span style={{ marginLeft: '10px' }}>Saving...</span>}
          </div>

          {currentStep === 0 && (
            <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{ width: '100%', marginBottom: '20px' }}>
                <h3 style={{ color: '#007bff', marginBottom: '10px', textAlign: 'left' }}>Generate AI Content</h3>
                
                <h5 style={{textAlign: 'left', marginBottom: '10px'}}>AI prompt</h5>
                {selectedTemplateName && <p style={{marginTop: '-5px', marginBottom: '10px', fontSize: '0.9em', color: '#666'}}>Selected: {selectedTemplateName}</p>}
                {!selectedTemplateName && templateList.length === 0 && <p style={{marginTop: '-5px', marginBottom: '10px', fontSize: '0.9em', color: '#666'}}>No template selected</p>}
                <button onClick={() => setShowTemplateEditor(!showTemplateEditor)}>choose template</button>
                {showTemplateEditor && (
                  <div style={{border: '1px solid #e0e0e0', borderRadius: '4px', padding: '10px', marginTop: '10px'}}>
                    <textarea 
                      value={promptTemplate} 
                      onChange={(e) => setPromptTemplate(e.target.value)} 
                      rows="6" 
                      style={{width: '100%', marginBottom: '10px'}} 
                    />
                    <button onClick={() => handleSaveTemplate('script')}>Save Template</button>
                    <button onClick={() => handleOpenTemplate('script')} style={{marginLeft: '10px'}}>Open Template</button>
                    {showTemplateList && (
                      <div className="template-list-modal" style={{marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px'}}>
                        <h4>Select a Template</h4>
                        {templateList.length > 0 ? (
                          templateList.map(name => (
                            <button 
                              key={name} 
                              onClick={() => handleLoadTemplate(name, 'script')} 
                              style={{
                                marginRight: '5px', 
                                marginBottom: '5px',
                                backgroundColor: name === selectedTemplateName ? '#007bff' : '#f0f0f0',
                                color: name === selectedTemplateName ? 'white' : '#333'
                              }}
                            >
                              {name}
                            </button>
                          ))
                        ) : (
                          <p>No templates available.</p>
                        )}
                        <button onClick={() => setShowTemplateList(false)} style={{marginTop: '10px'}}>Close</button>
                      </div>
                    )}
                  </div>
                )}

                <h5 style={{textAlign: 'left', marginTop: '20px', marginBottom: '10px'}}>Idea for the script:</h5>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                  <textarea value={videoIdea} onChange={(e) => setVideoIdea(e.target.value)} placeholder="Enter video idea" disabled={isLoading} rows="4" style={{ flexGrow: 1 }} />
                  <button onClick={() => {
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
                  }} disabled={isLoading}>{isLoading ? 'Generating...' : 'Generate'}</button>
                </div>
              </div>
              {isLoading && <p>Loading script from n8n...</p>}
              {scriptResponse.length > 0 && (
                <div className="script-display" style={{width: '100%'}}>
                  <h3 style={{ color: '#007bff', marginBottom: '10px', textAlign: 'left' }}>Generated Script</h3>
                  <button onClick={handleUndo} disabled={historyPointer <= 0}>Undo</button>
                  <button onClick={handleRedo} disabled={historyPointer >= history.length - 1}>Redo</button>
                  <button onClick={handleAddNewCard}>Add New Card</button>
                  <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
                    <SortableContext items={scriptResponse.map(item => item.id)} strategy={verticalListSortingStrategy}>
                      {scriptResponse.map(shot => <DraggableScriptCard key={shot.id} id={shot.id} script={shot.script} onScriptChange={handleScriptChange} onDelete={handleDeleteScriptCard} />)}
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </div>
          )}

          {currentStep === 1 && (
            <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{ width: '100%', marginBottom: '20px' }}>
                <h3 style={{ color: '#007bff', marginBottom: '10px', textAlign: 'left' }}>Generate AI Content</h3>
                
                <h5 style={{textAlign: 'left', marginBottom: '10px'}}>AI prompt for Art Direction</h5>
                {selectedArtDirectionTemplateName && <p style={{marginTop: '-5px', marginBottom: '10px', fontSize: '0.9em', color: '#666'}}>Selected: {selectedArtDirectionTemplateName}</p>}
                {!selectedArtDirectionTemplateName && artDirectionTemplateList.length === 0 && <p style={{marginTop: '-5px', marginBottom: '10px', fontSize: '0.9em', color: '#666'}}>No template selected</p>}
                <button onClick={() => setShowArtDirectionTemplateEditor(!showArtDirectionTemplateEditor)}>choose template</button>
                {showArtDirectionTemplateEditor && (
                  <div style={{border: '1px solid #e0e0e0', borderRadius: '4px', padding: '10px', marginTop: '10px'}}>
                    <textarea 
                      value={artDirectionPromptTemplate} 
                      onChange={(e) => setArtDirectionPromptTemplate(e.target.value)} 
                      rows="6" 
                      style={{width: '100%', marginBottom: '10px'}} 
                    />
                    <button onClick={() => handleSaveTemplate('art_direction')}>Save Template</button>
                    <button onClick={() => handleOpenTemplate('art_direction')} style={{marginLeft: '10px'}}>Open Template</button>
                    {showArtDirectionTemplateList && (
                      <div className="template-list-modal" style={{marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px'}}>
                        <h4>Select a Template</h4>
                        {artDirectionTemplateList.length > 0 ? (
                          artDirectionTemplateList.map(name => (
                            <button 
                              key={name} 
                              onClick={() => handleLoadTemplate(name, 'art_direction')} 
                              style={{
                                marginRight: '5px', 
                                marginBottom: '5px',
                                backgroundColor: name === selectedArtDirectionTemplateName ? '#007bff' : '#f0f0f0',
                                color: name === selectedArtDirectionTemplateName ? 'white' : '#333'
                              }}
                            >
                              {name}
                            </button>
                          ))
                        ) : (
                          <p>No templates available.</p>
                        )}
                        <button onClick={() => setShowArtDirectionTemplateList(false)} style={{marginTop: '10px'}}>Close</button>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: '20px', marginBottom: '15px' }}>
                  <h5 style={{textAlign: 'left'}}>Script:</h5>
                  <div style={{ border: '1px solid #e0e0e0', borderRadius: '4px', padding: '10px', background: '#f8f9fa', maxHeight: '150px', overflowY: 'auto' }}>
                    {scriptResponse.map(shot => <p key={shot.id} style={{ margin: 0 }}>{shot.script}</p>)}
                  </div>
                </div>
                <div>
                  <h5 style={{textAlign: 'left'}}>More information:</h5>
                  <textarea value={artDirectionIdea} onChange={(e) => setArtDirectionIdea(e.target.value)} placeholder="Characters, Locations, Outfits..." disabled={isLoading} rows="4" style={{width: '100%'}} />
                  <h5 style={{textAlign: 'left'}}>Image Reference:</h5>
                  <input type="file" accept="image/*" onChange={handleImageChange} />
                  <button onClick={handleGenerateArtDirection} disabled={isLoading}>{isLoading ? 'Generating...' : 'Generate'}</button>
                </div>
              </div>
              <div style={{ width: '100%', marginTop: '20px' }}>
                <h3 style={{ color: '#007bff', marginBottom: '10px', textAlign: 'left' }}>Art Direction:</h3>
                <ArtDirectionCard name="Art Direction" description={artDirectionResponse} onSave={handleArtDirectionChange} />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{ width: '100%', marginBottom: '20px' }}>
                <h3 style={{ color: '#007bff', marginBottom: '10px', textAlign: 'left' }}>Image Generation</h3>

                <h5 style={{textAlign: 'left', marginBottom: '10px'}}>AI prompt for Image Generation</h5>
                {selectedImageGenTemplateName && <p style={{marginTop: '-5px', marginBottom: '10px', fontSize: '0.9em', color: '#666'}}>Selected: {selectedImageGenTemplateName}</p>}
                {!selectedImageGenTemplateName && imageGenTemplateList.length === 0 && <p style={{marginTop: '-5px', marginBottom: '10px', fontSize: '0.9em', color: '#666'}}>No template selected</p>}
                <button onClick={() => setShowImageGenTemplateEditor(!showImageGenTemplateEditor)}>choose template</button>
                {showImageGenTemplateEditor && (
                  <div style={{border: '1px solid #e0e0e0', borderRadius: '4px', padding: '10px', marginTop: '10px'}}>
                    <textarea 
                      value={imageGenPromptTemplate} 
                      onChange={(e) => setImageGenPromptTemplate(e.target.value)} 
                      rows="6" 
                      style={{width: '100%', marginBottom: '10px'}} 
                    />
                    <button onClick={() => handleSaveTemplate('image_generation')}>Save Template</button>
                    <button onClick={() => handleOpenTemplate('image_generation')} style={{marginLeft: '10px'}}>Open Template</button>
                    {showImageGenTemplateList && (
                      <div className="template-list-modal" style={{marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px'}}>
                        <h4>Select a Template</h4>
                        {imageGenTemplateList.length > 0 ? (
                          imageGenTemplateList.map(name => (
                            <button 
                              key={name} 
                              onClick={() => handleLoadTemplate(name, 'image_generation')} 
                              style={{
                                marginRight: '5px', 
                                marginBottom: '5px',
                                backgroundColor: name === selectedImageGenTemplateName ? '#007bff' : '#f0f0f0',
                                color: name === selectedImageGenTemplateName ? 'white' : '#333'
                              }}
                            >
                              {name}
                            </button>
                          ))
                        ) : (
                          <p>No templates available.</p>
                        )}
                        <button onClick={() => setShowImageGenTemplateList(false)} style={{marginTop: '10px'}}>Close</button>
                      </div>
                    )}
                  </div>
                )}

                <h5 style={{textAlign: 'left', marginTop: '20px'}}>Image Reference URL:</h5>
                <input type="text" placeholder="Enter image URL" value={imageGenUrl} onChange={handleImageGenUrlChange} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '20px' }} />
                <ImageGenerationTable
                  key={environment}
                  shots={scriptResponse}
                  onNewImageFromAI={handleNewImageFromAI}
                  onSetSelectedImage={handleSetSelectedImage}
                  artDirectionText={artDirectionResponse}
                  imageGenUrl={imageGenUrl}
                  webhookUrl={WEBHOOK_URLS[environment].imageGen}
                  imageGenPromptTemplate={imageGenPromptTemplate}
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{ width: '100%', marginBottom: '20px' }}>
                <h3 style={{ color: '#007bff', marginBottom: '10px', textAlign: 'left' }}>Video Generation</h3>
                <VideoGenerationTable
                  shots={scriptResponse}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
