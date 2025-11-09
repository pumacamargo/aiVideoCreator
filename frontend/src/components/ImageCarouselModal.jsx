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

const imageContainerStyle = {
  position: 'relative',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  width: '90vw',
  height: '90vh',
};

const imageStyle = {
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain',
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

export function ImageCarouselModal({ imageUrls, initialImageUrl, onClose, onSetSelected }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const initialIndex = imageUrls.indexOf(initialImageUrl);
    if (initialIndex !== -1) {
      setCurrentIndex(initialIndex);
    }
  }, [imageUrls, initialImageUrl]);

  const handleClose = () => {
    onSetSelected(imageUrls[currentIndex]);
    onClose();
  };

  const goToPrevious = (e) => {
    e.stopPropagation();
    const isFirstSlide = currentIndex === 0;
    const newIndex = isFirstSlide ? imageUrls.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
  };

  const goToNext = (e) => {
    e.stopPropagation();
    const isLastSlide = currentIndex === imageUrls.length - 1;
    const newIndex = isLastSlide ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
  };

  return (
    <div style={modalStyle} onClick={handleClose}>
      <span style={closeButtonStyle} onClick={handleClose}>&times;</span>
      <div style={imageContainerStyle}>
        <button style={{ ...navButtonStyle, left: '10px' }} onClick={goToPrevious}>&#10094;</button>
        <img src={imageUrls[currentIndex]} alt="Carousel view" style={imageStyle} />
        <button style={{ ...navButtonStyle, right: '10px' }} onClick={goToNext}>&#10095;</button>
        <div style={counterStyle}>{currentIndex + 1} / {imageUrls.length}</div>
      </div>
    </div>
  );
}
