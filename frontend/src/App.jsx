import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { DndContext, closestCorners } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { DraggableScriptCard } from './components/DraggableScriptCard';

function App() {
  const [currentView, setCurrentView] = useState('projectSelection');
  const [project, setProject] = useState(null);
  const [projectList, setProjectList] = useState([]);
  const [videoIdea, setVideoIdea] = useState('pomerania siendo un policia'); // New state for video idea
  const [scriptResponse, setScriptResponse] = useState([]); // New state for n8n script response
  const [isLoading, setIsLoading] = useState(false); // New state for loading indicator
  const [isSaving, setIsSaving] = useState(false); // New state for saving indicator
  const [history, setHistory] = useState([]); // History of project states for undo/redo
  const [historyPointer, setHistoryPointer] = useState(-1); // Current position in history
  const [currentStep, setCurrentStep] = useState(0); // New state for current pipeline step (0-indexed)
  const pipelineSteps = ['Script', 'Art Direction (Global)', 'Art Direction (Shots)', '2D Image Generation', 'Video Generation', 'Trimming', 'Render']; // Define pipeline steps
  const websocket = useRef(null);

  // Debounce function for auto-saving
  const debounce = (func, delay) => {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), delay);
    };
  };

  // Function to send save message to backend
  const sendSaveProject = useCallback((projectToSave) => {
    if (websocket.current && websocket.current.readyState === WebSocket.OPEN && projectToSave) {
      setIsSaving(true); // Set saving to true when save is initiated
      const message = {
        action: 'save_project',
        payload: projectToSave,
      };
      console.log('Sending save_project message:', message); // Log the payload being sent
      websocket.current.send(JSON.stringify(message));
      console.log('Auto-saving project:', projectToSave.projectName);
    } else {
      console.warn('WebSocket not open or project not defined, cannot auto-save.');
    }
  }, []);

  const debouncedSaveProject = useCallback(debounce(sendSaveProject, 3000), [sendSaveProject]);

  // Effect to manage project history for undo/redo
  useEffect(() => {
    if (project && (history.length === 0 || project !== history[historyPointer])) {
      // Only add to history if it's a new state, not an undo/redo operation
      const newHistory = history.slice(0, historyPointer + 1);
      newHistory.push(project);

      // Enforce 50-step limit
      if (newHistory.length > 50) {
        newHistory.shift(); // Remove the oldest state
        setHistoryPointer(prev => prev - 1); // Adjust pointer
      }

      setHistory(newHistory);
      setHistoryPointer(newHistory.length - 1);
    }
  }, [project]); // Depend on project state

  useEffect(() => {
    // Connect to the WebSocket server
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
        console.log('Project loaded successfully:', message.payload); // Log the loaded project data
        setProject(message.payload);
        setScriptResponse(message.payload.shots || []); // Also update scriptResponse from loaded project
        setCurrentView('mainApp');
      } else if (message.action === 'project_saved' && message.status === 'success') {
        console.log('Project saved successfully!');
        setIsSaving(false); // Set saving to false when save is confirmed
      } else if (message.status === 'error') {
        alert(`Error: ${message.message}`);
        setIsSaving(false); // Also set to false on error
      }
    };

    websocket.current.onclose = () => {
      console.log('WebSocket connection closed');
    };

    // Cleanup on component unmount
    return () => {
      if (websocket.current) {
        websocket.current.close();
      }
    };
  }, []); // Empty dependency array means this runs once on mount

  // Effect to auto-save project when it changes
  useEffect(() => {
    if (project) {
      debouncedSaveProject(project);
    }
  }, [project, debouncedSaveProject]);

  const handleNewProject = () => {
    const projectName = prompt('Please enter a name for your new project:');
    if (projectName && websocket.current) {
      const message = {
        action: 'new_project',
        payload: { projectName }
      };
      websocket.current.send(JSON.stringify(message));
    }
  };

  const handleOpenProject = () => {
    if (websocket.current) {
      const message = { action: 'list_projects' };
      websocket.current.send(JSON.stringify(message));
    }
  };

  const handleSelectProject = (projectName) => {
    if (websocket.current) {
      const message = {
        action: 'load_project',
        payload: { projectName }
      };
      websocket.current.send(JSON.stringify(message));
    }
  };

  const handleSendIdeaToN8N = async () => {
    setIsLoading(true); // Set loading to true
    const n8nWebhookUrl = 'https://n8n.lemonsushi.com/webhook/scriptIdea';
    const payload = {
      videoIdea: videoIdea,
    };

    try {
      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('N8N Webhook Response:', data);

        // Process the n8n response to extract shots
        let allShots = [];
        if (data && Array.isArray(data) && data.length > 0) {
          const scriptSections = data[0]; // Assuming the first element contains the sections
          for (const sectionKey in scriptSections) {
            if (Object.hasOwnProperty.call(scriptSections, sectionKey)) {
              const sectionShots = scriptSections[sectionKey];
              if (Array.isArray(sectionShots)) {
                allShots = allShots.concat(sectionShots.map(shot => ({
                  id: `shot-${shot.shot_number}`,
                  script: shot.action_shot,
                  // Initialize other fields as per planApp.md if needed
                  imageUrl: '',
                  videoUrl: '',
                })));
              }
            }
          }
        }
        setScriptResponse(allShots);
        setProject(prevProject => ({
          ...prevProject,
          idea: videoIdea, // Save the idea that generated the script
          shots: allShots,
        }));

        alert('Idea sent to n8n successfully! Check console for response and script displayed.');
      } else {
        console.error('Failed to send idea to n8n:', response.status, response.statusText);
        alert('Failed to send idea to n8n. Check console for details.');
      }
    } catch (error) {
      console.error('Error sending idea to n8n:', error);
      alert('Error sending idea to n8n. Check console for details.');
    } finally {
      setIsLoading(false); // Set loading to false regardless of success or error
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setScriptResponse((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        // Update project state as well
        setProject(prevProject => ({
          ...prevProject,
          shots: newOrder,
        }));

        return newOrder;
      });
    }
  };

  const handleScriptChange = (id, newScript) => {
    setScriptResponse(prevScripts =>
      prevScripts.map(script =>
        script.id === id ? { ...script, script: newScript } : script
      )
    );
    setProject(prevProject => {
      if (!prevProject) return null;
      const updatedShots = prevProject.shots.map(shot =>
        shot.id === id ? { ...shot, script: newScript } : shot
      );
      const newProject = { ...prevProject, shots: updatedShots };
      return newProject;
    });
  };

  const handleAddNewCard = () => {
    const newId = `shot-${Date.now()}`;
    const newCard = {
      id: newId,
      script: 'New script idea...',
      imageUrl: '',
      videoUrl: '',
    };

    setScriptResponse(prevScripts => [...prevScripts, newCard]);
    setProject(prevProject => {
      if (!prevProject) return null;
      return { ...prevProject, shots: [...prevProject.shots, newCard] };
    });
  };

  const handleUndo = () => {
    if (historyPointer > 0) {
      const newPointer = historyPointer - 1;
      setHistoryPointer(newPointer);
      const previousProject = history[newPointer];
      setProject(previousProject);
      setScriptResponse(previousProject.shots || []);
    }
  };

  const handleRedo = () => {
    if (historyPointer < history.length - 1) {
      const newPointer = historyPointer + 1;
      setHistoryPointer(newPointer);
      const nextProject = history[newPointer];
      setProject(nextProject);
      setScriptResponse(nextProject.shots || []);
    }
  };

  const handleDeleteScriptCard = (id) => {
    setScriptResponse(prevScripts => {
      const updatedScripts = prevScripts.filter(script => script.id !== id);
      return updatedScripts;
    });
    setProject(prevProject => {
      if (!prevProject) return null;
      const updatedShots = prevProject.shots.filter(shot => shot.id !== id);
      const newProject = { ...prevProject, shots: updatedShots };
      return newProject;
    });
  };

  const handleUpdateProjectElement = (category, id, newDescription) => {
    setProject(prevProject => {
      if (!prevProject) return null;
      const updatedCategory = prevProject[category].map(item =>
        item.id === id ? { ...item, description: newDescription } : item
      );
      return { ...prevProject, [category]: updatedCategory };
    });
  };

  const handleDeleteProjectElement = (category, id) => {
    setProject(prevProject => {
      if (!prevProject) return null;
      const updatedCategory = prevProject[category].filter(item => item.id !== id);
      return { ...prevProject, [category]: updatedCategory };
    });
  };

  const handleAddProjectElement = (category) => {
    setProject(prevProject => {
      if (!prevProject) return null;
      const newId = `${category}-${Date.now()}`;
      const newItem = { id: newId, description: 'New item...' };
      return { ...prevProject, [category]: [...prevProject[category], newItem] };
    });
  };

  const handleGenerateProjectElementsAI = async (category) => {
    console.log(`Generating AI for ${category}...`);
    setIsLoading(true);
    try {
      const n8nWebhookUrl = `https://n8n.lemonsushi.com/webhook/generate${category.charAt(0).toUpperCase() + category.slice(1)}`;
      const payload = { idea: project?.idea, existingElements: project?.[category] };

      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`N8N AI Response for ${category}:`, data);
        // Assuming data is an array of { id, description } objects
        setProject(prevProject => ({
          ...prevProject,
          [category]: data.map(item => ({ id: item.id || `${category}-${Date.now()}`, description: item.description })),
        }));
      } else {
        console.error(`Failed to generate AI for ${category}:`, response.status, response.statusText);
        alert(`Failed to generate AI for ${category}. Check console for details.`);
      }
    } catch (error) {
      console.error(`Error generating AI for ${category}:`, error);
      alert(`Error generating AI for ${category}. Check console for details.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextStep = () => {
    setCurrentStep(prevStep => Math.min(prevStep + 1, pipelineSteps.length - 1));
  };

  const handlePreviousStep = () => {
    setCurrentStep(prevStep => Math.max(prevStep - 1, 0));
  };
  
  const handleUpdateShotDetails = (id, field, value) => {
    setScriptResponse(prevScripts =>
      prevScripts.map(shot =>
        shot.id === id ? { ...shot, [field]: value } : shot
      )
    );
    setProject(prevProject => {
      if (!prevProject) return null;
      const updatedShots = prevProject.shots.map(shot =>
        shot.id === id ? { ...shot, [field]: value } : shot
      );
      return { ...prevProject, shots: updatedShots };
    });
  };

  const handleGenerateArtDirectionAI = async (shotId, script) => {
    // Placeholder for AI generation webhook
    console.log(`Generating AI for shot ${shotId} with script: ${script}`);
    // Simulate AI response
    setIsLoading(true);
    try {
      const n8nWebhookUrl = 'https://n8n.lemonsushi.com/webhook/generateArtDirection'; // New webhook
      const payload = { script };

      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('N8N Art Direction AI Response:', data);
        // Assuming data contains shotType, location, outfit
        setProject(prevProject => {
          if (!prevProject) return null;
          const updatedShots = prevProject.shots.map(shot =>
            shot.id === shotId ? { ...shot, shotType: data.shotType, location: data.location, outfit: data.outfit } : shot
          );
          setScriptResponse(updatedShots); // Keep scriptResponse in sync
          return { ...prevProject, shots: updatedShots };
        });
      } else {
        console.error('Failed to generate AI art direction:', response.status, response.statusText);
        alert('Failed to generate AI art direction. Check console for details.');
      }
    } catch (error) {
      console.error('Error generating AI art direction:', error);
      alert('Error generating AI art direction. Check console for details.');
    } finally {
      setIsLoading(false);
    }
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
              projectList.map(name => (
                <button key={name} onClick={() => handleSelectProject(name)}>
                  {name}
                </button>
              ))
            ) : (
              <p>No projects found.</p>
            )}
          </div>
          <button onClick={() => setCurrentView('projectSelection')}>Back</button>
        </div>
      )}

      {currentView === 'mainApp' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '1400px', padding: '10px 0' }}>
            <button onClick={handlePreviousStep} disabled={currentStep === 0} style={{ padding: '8px 15px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Previous</button>
            <div style={{ display: 'flex', gap: '10px' }}>
              {pipelineSteps.map((step, index) => (
                <span key={step} style={{
                  padding: '5px 10px',
                  borderRadius: '15px',
                  backgroundColor: index === currentStep ? '#007bff' : '#e0e0e0',
                  color: index === currentStep ? 'white' : '#333',
                  fontWeight: index === currentStep ? 'bold' : 'normal',
                  fontSize: '0.9em',
                }}>
                  {step}
                </span>
              ))}
            </div>
            <button onClick={handleNextStep} disabled={currentStep === pipelineSteps.length - 1} style={{ padding: '8px 15px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Next</button>
          </div>

          <h2>
            Project: {project?.projectName}
            {isSaving && <span style={{ marginLeft: '10px', fontSize: '0.9em', color: '#007bff' }}>Saving...</span>}
          </h2>
          <p>Main application view will go here.</p>

          {/* Conditional rendering based on currentStep */}
          {currentStep === 0 && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ marginBottom: '20px' }}>
                <button onClick={handleUndo} disabled={historyPointer <= 0} style={{ marginRight: '10px' }}>Undo</button>
                <button onClick={handleRedo} disabled={historyPointer >= history.length - 1}>Redo</button>
              </div>
              <div>
                <input
                  type="text"
                  value={videoIdea}
                  onChange={(e) => setVideoIdea(e.target.value)}
                  placeholder="Enter video idea"
                  disabled={isLoading} // Disable input while loading
                />
                <button onClick={handleSendIdeaToN8N} disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send Idea to n8n'} {/* Change button text while loading */}
                </button>
                <button onClick={handleAddNewCard} style={{ marginLeft: '10px' }}>Add New Card</button>
              </div>

              {isLoading && <p>Loading script from n8n...</p>} {/* Loading indicator */}

              {scriptResponse.length > 0 && (
                <div className="script-display">
                  <h3>Generated Script:</h3>
                  <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
                    <SortableContext items={scriptResponse.map(item => item.id)} strategy={verticalListSortingStrategy}>
                      {
                        scriptResponse.map((shot) => (
                          <DraggableScriptCard
                            key={shot.id}
                            id={shot.id}
                            script={shot.script}
                            onScriptChange={handleScriptChange}
                            onDelete={handleDeleteScriptCard}
                          />
                        ))
                      }
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </div>
          )}

          {currentStep === 1 && (
            <div className="art-direction-global-elements" style={{ width: '100%', maxWidth: '1400px', margin: '20px auto', textAlign: 'left' }}>
              <h3>Art Direction: Global Elements</h3>

              {/* Characters Section */}
              <div style={{ marginBottom: '30px', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '15px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)' }}>
                <h4>Characters</h4>
                {project?.characters.map(char => (
                  <div key={char.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <input
                      type="text"
                      value={char.description}
                      onChange={(e) => handleUpdateProjectElement('characters', char.id, e.target.value)}
                      style={{ flexGrow: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                    <button onClick={() => handleDeleteProjectElement('characters', char.id)} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
                  </div>
                ))}
                <button onClick={() => handleAddProjectElement('characters')} style={{ background: '#28a745', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', marginRight: '10px' }}>Add Character</button>
                <button onClick={() => handleGenerateProjectElementsAI('characters')} disabled={isLoading} style={{ background: '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}>
                  {isLoading ? 'Generating...' : 'Generate Characters with AI'}
                </button>
              </div>

              {/* Outfits Section */}
              <div style={{ marginBottom: '30px', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '15px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)' }}>
                <h4>Outfits</h4>
                {project?.outfits.map(outfit => (
                  <div key={outfit.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <input
                      type="text"
                      value={outfit.description}
                      onChange={(e) => handleUpdateProjectElement('outfits', outfit.id, e.target.value)}
                      style={{ flexGrow: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                    <button onClick={() => handleDeleteProjectElement('outfits', outfit.id)} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
                  </div>
                ))}
                <button onClick={() => handleAddProjectElement('outfits')} style={{ background: '#28a745', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', marginRight: '10px' }}>Add Outfit</button>
                <button onClick={() => handleGenerateProjectElementsAI('outfits')} disabled={isLoading} style={{ background: '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}>
                  {isLoading ? 'Generating...' : 'Generate Outfits with AI'}
                </button>
              </div>

              {/* Locations Section */}
              <div style={{ marginBottom: '30px', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '15px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)' }}>
                <h4>Locations</h4>
                {project?.locations.map(location => (
                  <div key={location.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <input
                      type="text"
                      value={location.description}
                      onChange={(e) => handleUpdateProjectElement('locations', location.id, e.target.value)}
                      style={{ flexGrow: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                    <button onClick={() => handleDeleteProjectElement('locations', location.id)} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
                  </div>
                ))}
                <button onClick={() => handleAddProjectElement('locations')} style={{ background: '#28a745', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', marginRight: '10px' }}>Add Location</button>
                <button onClick={() => handleGenerateProjectElementsAI('locations')} disabled={isLoading} style={{ background: '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}>
                  {isLoading ? 'Generating...' : 'Generate Locations with AI'}
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="art-direction-step" style={{ width: '100%', maxWidth: '1400px', margin: '20px auto' }}>
              <h3>Art Direction: Define Shot Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '10px', borderBottom: '1px solid #ccc', paddingBottom: '10px', marginBottom: '10px' }}>
                <strong>Image</strong>
                <strong>Description</strong>
                <strong>Actions</strong>
              </div>
              {project?.shots.length > 0 ? (
                project.shots.map(shot => (
                  <div key={shot.id} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '10px', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '10px' }}>
                    <div style={{ width: '100px', height: '100px', backgroundColor: '#f0f0f0', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                      {shot.imageUrl ? (
                        <img src={shot.imageUrl} alt="Shot" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      ) : (
                        <span>Placeholder</span>
                      )}
                    </div>
                    <div>
                      <p><strong>Script:</strong> {shot.script}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '10px' }}>
                        <label>Shot Type:
                          <input
                            type="text"
                            value={shot.shotType}
                            onChange={(e) => handleUpdateShotDetails(shot.id, 'shotType', e.target.value)}
                            style={{ width: 'calc(100% - 80px)', marginLeft: '5px', padding: '5px', border: '1px solid #ccc', borderRadius: '4px' }}
                          />
                        </label>
                        <label>Location:
                          <input
                            type="text"
                            value={shot.location}
                            onChange={(e) => handleUpdateShotDetails(shot.id, 'location', e.target.value)}
                            style={{ width: 'calc(100% - 80px)', marginLeft: '5px', padding: '5px', border: '1px solid #ccc', borderRadius: '4px' }}
                          />
                        </label>
                        <label>Outfit:
                          <input
                            type="text"
                            value={shot.outfit}
                            onChange={(e) => handleUpdateShotDetails(shot.id, 'outfit', e.target.value)}
                            style={{ width: 'calc(100% - 80px)', marginLeft: '5px', padding: '5px', border: '1px solid #ccc', borderRadius: '4px' }}
                          />
                        </label>
                      </div>
                    </div>
                    <div>
                      <button onClick={() => handleGenerateArtDirectionAI(shot.id, shot.script)} disabled={isLoading} style={{ background: '#28a745', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}>
                        {isLoading ? 'Generating...' : 'Generate AI Values'}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p>No shots defined for Art Direction. Please go back to the Script step.</p>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h3>2D Image Generation Step</h3>
              <p>Content for 2D Image Generation will go here.</p>
            </div>
          )}

          {currentStep === 4 && (
            <div>
              <h3>Video Generation Step</h3>
              <p>Content for Video Generation will go here.</p>
            </div>
          )}

          {currentStep === 5 && (
            <div>
              <h3>Trimming Step</h3>
              <p>Content for Trimming will go here.</p>
            </div>
          )}

          {currentStep === 6 && (
            <div>
              <h3>Render Step</h3>
              <p>Content for Render will go here.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;