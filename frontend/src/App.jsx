import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('projectSelection');
  const [project, setProject] = useState(null);
  const [projectList, setProjectList] = useState([]);
  const websocket = useRef(null);

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
        setProject(message.payload);
        setCurrentView('mainApp');
      } else if (message.status === 'error') {
        alert(`Error: ${message.message}`);
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
          <h2>Project: {project?.projectName}</h2>
          <p>Main application view will go here.</p>
          {/* This is where the pipeline stepper will go */}
        </div>
      )}
    </div>
  );
}

export default App;
