import React from 'react';

const modalStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};

const modalContentStyle = {
  maxWidth: '90vw',
  maxHeight: '90vh',
};

const closeButtonStyle = {
  position: 'absolute',
  top: '20px',
  right: '30px',
  fontSize: '30px',
  color: 'white',
  cursor: 'pointer',
};

export function ImageModal({ imageUrl, onClose }) {
  return (
    <div style={modalStyle} onClick={onClose}>
      <span style={closeButtonStyle} onClick={onClose}>&times;</span>
      <img src={imageUrl} alt="Enlarged view" style={modalContentStyle} />
    </div>
  );
}
