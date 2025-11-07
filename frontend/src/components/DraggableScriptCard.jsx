import React, { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function DraggableScriptCard({ id, script, onScriptChange, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const [isEditing, setIsEditing] = useState(false);
  const [editedScript, setEditedScript] = useState(script);

  // Update editedScript when the prop changes (e.g., on project load)
  useEffect(() => {
    setEditedScript(script);
  }, [script]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    padding: '15px',
    margin: '5px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    backgroundColor: '#f8f9fa',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
  };

  const handleSaveEdit = () => {
    if (editedScript !== script) { // Only save if content has changed
      onScriptChange(id, editedScript);
    }
    setIsEditing(false);
  };

  return (
    <div ref={setNodeRef} style={style} className="DraggableScriptCard">
      <span {...listeners} {...attributes} style={{ cursor: 'grab', paddingRight: '10px' }}>
        &#x22EE; {/* Unicode for vertical ellipsis, often used as a grab handle */}
      </span>
      {isEditing ? (
        <input
          type="text"
          value={editedScript}
          onChange={(e) => setEditedScript(e.target.value)}
          onBlur={handleSaveEdit} // Save on blur
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleSaveEdit();
            }
          }}
          style={{ flexGrow: 1, border: '1px solid #007bff', outline: 'none', backgroundColor: '#ffffff', color: '#333333', padding: '8px', borderRadius: '4px' }}
          autoFocus
        />
      ) : (
        <>
          <span style={{ flexGrow: 1, padding: '8px 0', color: '#333333' }}>{script}</span>
          <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} style={{ background: '#007bff', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Edit</button>
        </>
      )}
      <button onClick={(e) => { e.stopPropagation(); onDelete(id); }} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', marginLeft: '10px' }}>
        &#x1F5D1; {/* Trash can icon */}
      </button>
    </div>
  );
}
