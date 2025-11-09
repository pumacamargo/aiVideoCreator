import React, { useState } from 'react';
import { ImageCarouselModal } from './ImageCarouselModal';

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

const imageCountBadgeStyle = {
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

export function ImageGenerationTable({ shots, onNewImageFromAI, onSetSelectedImage, artDirectionText, imageGenUrl, webhookUrl }) {
  const [loadingShotId, setLoadingShotId] = useState(null);
  const [shotForCarousel, setShotForCarousel] = useState(null);

  const handleGenerateImage = async (shot) => {
    if (!imageGenUrl) {
      alert('Please enter an image reference URL before generating an image.');
      return;
    }
    setLoadingShotId(shot.id);
    try {
      const payload = { script: shot.script, artDirection: artDirectionText, image: imageGenUrl };
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const responseData = await response.json();
        let generatedImageUrl = null;
        if (responseData?.[0]?.data?.resultJson) {
          try {
            const resultJson = JSON.parse(responseData[0].data.resultJson);
            if (resultJson?.resultUrls?.[0]) {
              generatedImageUrl = resultJson.resultUrls[0];
            }
          } catch (e) {
            console.error("Failed to parse resultJson:", e);
          }
        }
        if (generatedImageUrl && onNewImageFromAI) {
          onNewImageFromAI(shot.id, generatedImageUrl);
        } else {
          alert("Failed to get generated image from AI. Check console for details.");
        }
      } else {
        alert('Failed to generate image. Check console for details.');
      }
    } catch (error) {
      alert('Error generating image. Check console for details.');
    } finally {
      setLoadingShotId(null);
    }
  };

  const handleSetSelected = (imageUrl) => {
    if (shotForCarousel) {
      onSetSelectedImage(shotForCarousel.id, imageUrl);
    }
  };

  return (
    <>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Image</th>
            <th style={thStyle}>Shot Description</th>
            <th style={thStyle}>Action</th>
          </tr>
        </thead>
        <tbody>
          {shots.map((shot) => (
            <tr key={shot.id}>
              <td style={tdStyle}>
                <div style={thumbnailContainerStyle} onClick={() => shot.imageUrls && shot.imageUrls.length > 0 && setShotForCarousel(shot)}>
                  <img
                    src={shot.selectedImageUrl || placeholderImage}
                    alt="Shot visualization"
                    style={imageStyle}
                  />
                  {shot.imageUrls && shot.imageUrls.length > 1 && (
                    <div style={imageCountBadgeStyle}>
                      {shot.imageUrls.length}
                    </div>
                  )}
                </div>
              </td>
              <td style={tdStyle}>{shot.script}</td>
              <td style={tdStyle}>
                <button
                  style={buttonStyle}
                  onClick={() => handleGenerateImage(shot)}
                  disabled={loadingShotId === shot.id}
                >
                  {loadingShotId === shot.id ? 'Generating...' : 'Generate AI Image'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {shotForCarousel && (
        <ImageCarouselModal
          imageUrls={shotForCarousel.imageUrls}
          initialImageUrl={shotForCarousel.selectedImageUrl}
          onClose={() => setShotForCarousel(null)}
          onSetSelected={handleSetSelected}
        />
      )}
    </>
  );
}