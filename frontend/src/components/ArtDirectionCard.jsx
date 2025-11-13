import React, { useState, useEffect } from 'react';

export function ArtDirectionCard({ name, description, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');

  useEffect(() => {
    setEditedDescription(description);
  }, [description]);

  const handleSave = () => {
    if (onSave) {
      onSave(editedDescription);
    }
    setIsEditing(false);
  };

  return (
    <div className="art-direction-card">
      <div className="art-direction-header">
        <h5>{name}</h5>
        {isEditing ? (
          <button className="button-small" onClick={handleSave}>Save</button>
        ) : (
          <button className="button-small" onClick={() => setIsEditing(true)}>Edit</button>
        )}
      </div>
      {isEditing ? (
        <textarea
          className="art-direction-textarea"
          value={editedDescription}
          onChange={(e) => setEditedDescription(e.target.value)}
        />
      ) : (
        <p className="art-direction-content" dangerouslySetInnerHTML={{ __html: editedDescription.replace(/\n/g, '<br />') }}></p>
      )}
    </div>
  );
}
