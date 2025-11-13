import React from 'react';

export function ImageModal({ imageUrl, onClose }) {
  return (
    <div className="simple-image-modal" onClick={onClose}>
      <span className="simple-modal-close" onClick={onClose}>&times;</span>
      <img src={imageUrl} alt="Enlarged view" />
    </div>
  );
}
