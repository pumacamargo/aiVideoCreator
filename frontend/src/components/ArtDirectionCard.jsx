import React from 'react';

export function ArtDirectionCard({ name, description }) {
  const style = {
    padding: '15px',
    margin: '5px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    backgroundColor: '#f8f9fa',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
  };

  return (
    <div style={style}>
      <h5 style={{ marginBottom: '5px' }}>{name}</h5>
      <p style={{ margin: 0 }}>{description}</p>
    </div>
  );
}
