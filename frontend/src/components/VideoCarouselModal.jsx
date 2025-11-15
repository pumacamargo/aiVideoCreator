import React, { useState, useEffect } from 'react';

export function VideoCarouselModal({ videoUrls, initialVideoUrl, onClose, onSetSelected, onRemove }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const initialIndex = videoUrls.indexOf(initialVideoUrl);
    if (initialIndex !== -1) {
      setCurrentIndex(initialIndex);
    }
  }, [videoUrls, initialVideoUrl]);

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
    if (onSetSelected) {
      onSetSelected(videoUrls[currentIndex]);
    }
    onClose();
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    if (window.confirm('Remove this video from the carousel? (File will not be deleted)')) {
      const urlToRemove = videoUrls[currentIndex];
      onRemove(urlToRemove);

      // Close modal if this was the last video
      if (videoUrls.length === 1) {
        onClose();
      } else {
        // Adjust index if needed
        if (currentIndex >= videoUrls.length - 1) {
          setCurrentIndex(Math.max(0, currentIndex - 1));
        }
      }
    }
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
    <div className="carousel-modal-overlay" onClick={handleClose}>
      <button
        className="carousel-close-button"
        onClick={handleClose}
      >
        ×
      </button>

      <div className="carousel-content-container" onClick={(e) => e.stopPropagation()}>
        {videoUrls.length > 1 && (
          <button
            className="carousel-nav-button left"
            onClick={goToPrevious}
          >
            ‹
          </button>
        )}

        <video
          key={videoUrls[currentIndex]}
          src={videoUrls[currentIndex]}
          className="carousel-media"
          controls
          autoPlay
        />

        {videoUrls.length > 1 && (
          <button
            className="carousel-nav-button right"
            onClick={goToNext}
          >
            ›
          </button>
        )}

        <div className="carousel-counter">
          {currentIndex + 1} / {videoUrls.length}
        </div>

        {onSetSelected && (
          <div className="carousel-button-group">
            <button
              className="carousel-select-button"
              onClick={handleSetSelected}
            >
              Set as Selected
            </button>
            <button
              className="carousel-remove-button"
              onClick={handleRemove}
            >
              Remove from Carousel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
