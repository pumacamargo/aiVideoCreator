import React, { useState } from 'react';

// Placeholder for the future VideoCarouselModal
// import { VideoCarouselModal } from './VideoCarouselModal';

const placeholderImage = 'https://wpmedia-lj.s3.amazonaws.com/wp-content/uploads/2023/10/Placeholder_01.jpg';

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: '20px',
};

const thStyle = {
  border: '1px solid #ddd',
  padding: '8px',
  textAlign: 'left',
  backgroundColor: '#f2f2f2',
};

const tdStyle = {
  border: '1px solid #ddd',
  padding: '8px',
  textAlign: 'left',
  verticalAlign: 'middle',
};

const thumbnailContainerStyle = {
  position: 'relative',
  width: '150px',
  height: '100px',
  cursor: 'pointer',
};

const imageStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const videoCountBadgeStyle = {
  position: 'absolute',
  top: '5px',
  right: '5px',
  background: 'rgba(0, 0, 0, 0.7)',
  color: 'white',
  padding: '2px 6px',
  borderRadius: '10px',
  fontSize: '0.8rem',
};

const buttonStyle = {
  padding: '8px 15px',
  background: '#007bff',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
};

export function VideoGenerationTable({ shots }) {
  const [loadingShotId, setLoadingShotId] = useState(null);
  // Placeholder state for video carousel
  const [shotForVideoCarousel, setShotForVideoCarousel] = useState(null);

  const handleGenerateVideo = async (shot) => {
    // Placeholder function
    console.log('Generating video for shot:', shot.id);
    setLoadingShotId(shot.id);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setLoadingShotId(null);
    alert('Video generation is not implemented yet.');
  };

  return (
    <>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Thumbnail</th>
            <th style={thStyle}>Shot Description</th>
            <th style={thStyle}>Action</th>
          </tr>
        </thead>
        <tbody>
          {shots.map((shot) => (
            <tr key={shot.id}>
              <td style={tdStyle}>
                <div style={thumbnailContainerStyle} onClick={() => shot.videoUrls && shot.videoUrls.length > 0 && setShotForVideoCarousel(shot)}>
                  <img
                    src={shot.selectedImageUrl || placeholderImage}
                    alt="Shot visualization"
                    style={imageStyle}
                  />
                  {/* Placeholder for video count */}
                  {shot.videoUrls && shot.videoUrls.length > 1 && (
                    <div style={videoCountBadgeStyle}>
                      {shot.videoUrls.length}
                    </div>
                  )}
                </div>
              </td>
              <td style={tdStyle}>{shot.script}</td>
              <td style={tdStyle}>
                <button
                  style={buttonStyle}
                  onClick={() => handleGenerateVideo(shot)}
                  disabled={loadingShotId === shot.id}
                >
                  {loadingShotId === shot.id ? 'Generating...' : 'Generate AI Video'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Placeholder for VideoCarouselModal */}
      {/* {shotForVideoCarousel && (
        <VideoCarouselModal
          videoUrls={shotForVideoCarousel.videoUrls}
          initialVideoUrl={shotForVideoCarousel.selectedVideoUrl}
          onClose={() => setShotForVideoCarousel(null)}
          onSetSelected={handleSetSelectedVideo}
        />
      )} */}
    </>
  );
}
