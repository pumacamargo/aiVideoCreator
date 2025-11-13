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
  };

  const handleSaveEdit = () => {
    if (editedScript !== script) { // Only save if content has changed
      onScriptChange(id, editedScript);
    }
    setIsEditing(false);
  };

  return (
    <div ref={setNodeRef} style={style} className="DraggableScriptCard">
      <div className="card-content">
        <span {...listeners} {...attributes} style={{ cursor: 'grab', paddingRight: '10px', color: 'var(--color-text-tertiary)' }}>
          &#x22EE;
        </span>
        {isEditing ? (
          <input
            type="text"
            value={editedScript}
            onChange={(e) => setEditedScript(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSaveEdit();
              }
            }}
            autoFocus
          />
        ) : (
          <>
            <span style={{ flexGrow: 1 }}>{script}</span>
            <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="button-small">Edit</button>
          </>
        )}
        <button onClick={(e) => { e.stopPropagation(); onDelete(id); }} className="delete-button">
          &#x1F5D1;
        </button>
      </div>
    </div>
  );
}
