import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { DndContext, closestCorners } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { DraggableScriptCard } from './components/DraggableScriptCard';
import { ArtDirectionCard } from './components/ArtDirectionCard';

function App() {
  const [currentView, setCurrentView] = useState('projectSelection');
  const [project, setProject] = useState(null);
  const [projectList, setProjectList] = useState([]);
  const [videoIdea, setVideoIdea] = useState('pomerania siendo un policia'); // New state for video idea
  const [artDirectionIdea, setArtDirectionIdea] = useState(''); // New state for art direction idea
  const [scriptResponse, setScriptResponse] = useState([]); // New state for n8n script response
  const [isLoading, setIsLoading] = useState(false); // New state for loading indicator
  const [isSaving, setIsSaving] = useState(false); // New state for saving indicator
  const [history, setHistory] = useState([]); // History of project states for undo/redo
  const [historyPointer, setHistoryPointer] = useState(-1); // Current position in history
  const [currentStep, setCurrentStep] = useState(0); // New state for current pipeline step (0-indexed)
  const pipelineSteps = ['Script', 'Art Direction', 'Image Generation', 'Video Generation', 'Trimming', 'Render']; // Define pipeline steps
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
        setProject({
          ...message.payload,
          characters: message.payload.characters || [],
          locations: message.payload.locations || [],
          outfits: message.payload.outfits || [],
        });
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

  const handleSendIdeaToN8N = async (webhookUrl, payload, processResponse) => {
    setIsLoading(true); // Set loading to true

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('N8N Webhook Response:', data);

        processResponse(data); // Use the callback to process the response

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '10px 0' }}>
            <button
              onClick={handlePreviousStep}
              disabled={currentStep === 0}
              style={{
                padding: '8px 15px',
                background: currentStep === 0 ? '#cccccc' : '#007bff', // Grey when disabled, blue otherwise
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: currentStep === 0 ? 'not-allowed' : 'pointer' // Change cursor when disabled
              }}
            >
              Previous
            </button>
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

          <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
            <h2 style={{ color: '#007bff', display: 'flex', alignItems: 'center', gap: '10px' }}>
              Project: {project?.projectName}
              <button onClick={() => setCurrentView('projectSelection')} style={{ padding: '2px 6px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.6em' }}>
                My Projects
              </button>
              {isSaving && <span style={{ marginLeft: '10px', fontSize: '0.9em', color: '#007bff' }}>Saving...</span>}
            </h2>
          </div>


          {/* Conditional rendering based on currentStep */}
          {currentStep === 0 && (
            <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <div className="generate-ai-section" style={{ width: '100%', marginBottom: '20px' }}>
                <h3 style={{ color: '#007bff', marginBottom: '10px', textAlign: 'left' }}>Generate AI Content:</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                  <textarea
                    value={videoIdea}
                    onChange={(e) => setVideoIdea(e.target.value)}
                    placeholder="Enter video idea"
                    disabled={isLoading}
                    rows="4"
                    style={{ flexGrow: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical' }}
                  />
                  <button onClick={() => handleSendIdeaToN8N(
                    'https://n8n.lemonsushi.com/webhook/scriptIdea',
                    { videoIdea: videoIdea },
                    (data) => {
                      let allShots = [];
                      if (data && Array.isArray(data) && data.length > 0) {
                        const scriptSections = data[0];
                        for (const sectionKey in scriptSections) {
                          if (Object.hasOwnProperty.call(scriptSections, sectionKey)) {
                            const sectionShots = scriptSections[sectionKey];
                            if (Array.isArray(sectionShots)) {
                              allShots = allShots.concat(sectionShots.map(shot => ({
                                id: `shot-${shot.shot_number}`,
                                script: shot.action_shot,
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
                        idea: videoIdea,
                        shots: allShots,
                      }));
                    }
                  )} disabled={isLoading} style={{ background: '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', height: 'fit-content' }}>
                    {isLoading ? 'Generating...' : 'Generate'}
                  </button>
                </div>
              </div>

              {isLoading && <p>Loading script from n8n...</p>} {/* Loading indicator */}

              {scriptResponse.length > 0 && (
                <div className="script-display">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <h3>Generated Script:</h3>
                    <div>
                      <button onClick={handleUndo} disabled={historyPointer <= 0} style={{ marginRight: '10px' }}>Undo</button>
                      <button onClick={handleRedo} disabled={historyPointer >= history.length - 1} style={{ marginRight: '10px' }}>Redo</button>
                      <button onClick={handleAddNewCard} style={{ background: '#28a745', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}>Add New Card</button>
                    </div>
                  </div>
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
            <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              {/* Generate AI Content Section */}
              <div className="generate-ai-section" style={{ width: '100%', marginBottom: '20px' }}>
                <h3 style={{ color: '#007bff', marginBottom: '10px', textAlign: 'left' }}>Generate AI Content:</h3>
                
                {/* Script Display */}
                <div style={{ marginBottom: '15px' }}>
                  <h5 style={{ marginBottom: '5px', textAlign: 'left' }}>Script:</h5>
                  <div style={{ border: '1px solid #e0e0e0', borderRadius: '4px', padding: '10px', background: '#f8f9fa', maxHeight: '150px', overflowY: 'auto' }}>
                    {scriptResponse.map(shot => (
                      <p key={shot.id} style={{ margin: 0, padding: '2px 0', fontSize: '0.8em' }}>{shot.script}</p>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                  <textarea
                    value={artDirectionIdea}
                    onChange={(e) => setArtDirectionIdea(e.target.value)}
                    placeholder="other than the script any other details you would like to add for Characters, Locations and outfits"
                    disabled={isLoading}
                    rows="4"
                    style={{ flexGrow: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical' }}
                  />
                  <button onClick={() => handleSendIdeaToN8N(
                    'https://n8n.lemonsushi.com/webhook/artdirection',
                    { videoIdea: artDirectionIdea, script: scriptResponse.map(shot => shot.script).join('\n') }, // Pass script as well
                    (data) => {
                      if (data && data.characters && data.locations && data.outfits) {
                        setProject(prevProject => ({
                          ...prevProject,
                          idea: artDirectionIdea, // Update the idea with the artDirectionIdea
                          characters: data.characters,
                          locations: data.locations,
                          outfits: data.outfits,
                        }));
                      }
                    }
                  )} disabled={isLoading} style={{ background: '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', height: 'fit-content' }}>
                    {isLoading ? 'Generating...' : 'Generate'}
                  </button>
                </div>
              </div>

              {/* Characters, Locations, Outfits Sections */}
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '20px' }}>
                {/* Characters Section */}
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ color: '#007bff', marginBottom: '10px', textAlign: 'left' }}>Characters</h3>
                  <div>
                    {project?.characters?.map(char => (
                      <ArtDirectionCard key={char.name} name={char.name} description={char.description} />
                    ))}
                  </div>
                </div>

                {/* Locations Section */}
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ color: '#007bff', marginBottom: '10px', textAlign: 'left' }}>Locations</h3>
                  <div>
                    {project?.locations?.map(loc => (
                      <ArtDirectionCard key={loc.name} name={loc.name} description={loc.description} />
                    ))}
                  </div>
                </div>

                {/* Outfits Section */}
                <div>
                  <h3 style={{ color: '#007bff', marginBottom: '10px', textAlign: 'left' }}>Outfits</h3>
                  <div>
                    {project?.outfits?.map(outfit => (
                      <ArtDirectionCard key={outfit.name} name={outfit.name} description={outfit.description} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h3>2D Image Generation Step</h3>
              <p>Content for 2D Image Generation will go here.</p>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h3>Video Generation Step</h3>
              <p>Content for Video Generation will go here.</p>
            </div>
          )}

          {currentStep === 4 && (
            <div>
              <h3>Trimming Step</h3>
              <p>Content for Trimming will go here.</p>
            </div>
          )}

          {currentStep === 5 && (
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