import React, { useState, useEffect } from 'react';

export function ImageCarouselModal({ imageUrls, initialImageUrl, onClose, onSetSelected }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const initialIndex = imageUrls.indexOf(initialImageUrl);
    if (initialIndex !== -1) {
      setCurrentIndex(initialIndex);
    }
  }, [imageUrls, initialImageUrl]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowLeft') goToPrevious(e);
      if (e.key === 'ArrowRight') goToNext(e);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  const handleClose = () => {
    onClose();
  };

  const handleSetSelected = (e) => {
    e.stopPropagation();
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
    <div className="carousel-modal-overlay" onClick={handleClose}>
      <button
        className="carousel-close-button"
        onClick={handleClose}
      >
        ×
      </button>

      <div className="carousel-content-container" onClick={(e) => e.stopPropagation()}>
        {imageUrls.length > 1 && (
          <button
            className="carousel-nav-button left"
            onClick={goToPrevious}
          >
            ‹
          </button>
        )}

        <img
          src={imageUrls[currentIndex]}
          alt={`Image ${currentIndex + 1} of ${imageUrls.length}`}
          className="carousel-media carousel-media-image"
        />

        {imageUrls.length > 1 && (
          <button
            className="carousel-nav-button right"
            onClick={goToNext}
          >
            ›
          </button>
        )}

        <div className="carousel-counter">
          {currentIndex + 1} / {imageUrls.length}
        </div>

        <button
          className="carousel-select-button"
          onClick={handleSetSelected}
        >
          Set as Selected
        </button>
      </div>
    </div>
  );
}
