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

  const style = {
    padding: '15px',
    margin: '5px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    backgroundColor: '#f8f9fa',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
    position: 'relative',
  };

  const buttonStyle = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    padding: '5px 10px',
    border: 'none',
    borderRadius: '5px',
    backgroundColor: '#007bff',
    color: 'white',
    cursor: 'pointer',
  };

  const textareaStyle = {
    width: '100%',
    minHeight: '100px',
    marginTop: '10px',
    fontSize: '1em',
    fontFamily: 'inherit',
    lineHeight: '1.5',
  };

  return (
    <div style={style}>
      <h5 style={{ marginBottom: '5px' }}>{name}</h5>
      {isEditing ? (
        <>
          <textarea
            style={textareaStyle}
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
          />
          <button style={buttonStyle} onClick={handleSave}>Save</button>
        </>
      ) : (
        <>
          <p style={{ margin: 0 }} dangerouslySetInnerHTML={{ __html: editedDescription.replace(/\n/g, '<br />') }}></p>
          <button style={buttonStyle} onClick={() => setIsEditing(true)}>Edit</button>
        </>
      )}
    </div>
  );
}
