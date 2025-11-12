import React, { useState, useEffect } from 'react';

const modalStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};

const videoContainerStyle = {
  position: 'relative',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  width: '90vw',
  height: '90vh',
};

const videoStyle = {
  maxWidth: '100%',
  maxHeight: '100%',
};

const navButtonStyle = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  color: 'white',
  border: 'none',
  fontSize: '3rem',
  cursor: 'pointer',
  padding: '0 20px',
  userSelect: 'none',
};

const closeButtonStyle = {
  position: 'absolute',
  top: '10px',
  right: '25px',
  fontSize: '3rem',
  color: 'white',
  cursor: 'pointer',
};

const counterStyle = {
  position: 'absolute',
  top: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  color: 'white',
  fontSize: '1.2rem',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  padding: '5px 15px',
  borderRadius: '15px',
};

export function VideoCarouselModal({ videoUrls, initialVideoUrl, onClose, onSetSelected }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const initialIndex = videoUrls.indexOf(initialVideoUrl);
    if (initialIndex !== -1) {
      setCurrentIndex(initialIndex);
    }
  }, [videoUrls, initialVideoUrl]);

  const handleClose = () => {
    if (onSetSelected) {
      onSetSelected(videoUrls[currentIndex]);
    }
    onClose();
  };

  const goToPrevious = (e) => {
    e.stopPropagation();
    const isFirstSlide = currentIndex === 0;
    const newIndex = isFirstSlide ? videoUrls.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
  };

  const goToNext = (e) => {
    e.stopPropagation();
    const isLastSlide = currentIndex === videoUrls.length - 1;
    const newIndex = isLastSlide ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
  };

  if (!videoUrls || videoUrls.length === 0) {
    return null;
  }

  return (
    <div style={modalStyle} onClick={handleClose}>
      <span style={closeButtonStyle} onClick={handleClose}>&times;</span>
      <div style={videoContainerStyle}>
        <button style={{ ...navButtonStyle, left: '10px' }} onClick={goToPrevious}>&#10094;</button>
        <video src={videoUrls[currentIndex]} style={videoStyle} controls autoPlay />
        <button style={{ ...navButtonStyle, right: '10px' }} onClick={goToNext}>&#10095;</button>
        <div style={counterStyle}>{currentIndex + 1} / {videoUrls.length}</div>
      </div>
    </div>
  );
}
