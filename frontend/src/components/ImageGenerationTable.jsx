import React, { useState } from 'react';
import { ImageCarouselModal } from './ImageCarouselModal';

const placeholderImage = 'https://wpmedia-lj.s3.amazonaws.com/wp-content/uploads/2023/10/Placeholder_01.jpg';

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: '20px',
};

const thStyle = {
  border: '1px solid #999',
  padding: '8px',
  textAlign: 'left',
  backgroundColor: '#f2f2f2',
};

const tdStyle = {
  border: '1px solid #999',
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

export function ImageGenerationTable({ shots, onNewImageFromAI, onSetSelectedImage, artDirectionText, imageGenUrl, webhookUrl, imageGenPromptTemplate, promptGenWebhookUrl, onPromptChange }) {
  const [loadingShotId, setLoadingShotId] = useState(null);
  const [shotForCarousel, setShotForCarousel] = useState(null);
  const [generatingPromptShotId, setGeneratingPromptShotId] = useState(null);
  const [editingPromptId, setEditingPromptId] = useState(null);

  const handleGeneratePrompt = async (shot) => {
    if (!promptGenWebhookUrl) {
      alert('Please enter a Prompt Generation Webhook URL.');
      return;
    }
    setGeneratingPromptShotId(shot.id);
    try {
      const payload = {
        script: shot.script,
        promptTemplate: imageGenPromptTemplate,
        artDirection: artDirectionText,
        image: imageGenUrl,
      };
      const response = await fetch(promptGenWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const responseData = await response.json();
        let generatedPrompt = '';
        if (Array.isArray(responseData) && responseData.length > 0 && responseData[0].output) {
          generatedPrompt = responseData[0].output;
        } else {
          // Fallback if the expected structure is not found
          generatedPrompt = JSON.stringify(responseData, null, 2);
        }
        onPromptChange(shot.id, generatedPrompt);
      } else {
        alert('Failed to generate prompt. Check console for details.');
      }
    } catch (error) {
      alert('Error generating prompt. Check console for details.');
      console.error('Error generating prompt:', error);
    } finally {
      setGeneratingPromptShotId(null);
    }
  };

  const handleGenerateImage = async (shot) => {
    const promptText = shot.prompt;
    if (!promptText) {
      alert('Please generate or enter a prompt for this shot first.');
      return;
    }
    if (!imageGenUrl) {
      alert('Please enter an image reference URL before generating an image.');
      return;
    }
    setLoadingShotId(shot.id);
    try {
      const payload = { 
        prompt: promptText,
        image: imageGenUrl 
      };
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
              <td style={{...tdStyle, padding: '0'}}>
                <div style={{ height: '80px', borderBottom: '1px dashed #ccc', padding: '8px', overflowY: 'auto' }}>{shot.script}</div>
                <div style={{ height: '80px', padding: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <textarea
                    placeholder="Edit your image prompt or Generate Prompt with AI"
                    style={{ flex: 1, height: '100%', border: 'none', resize: 'none', outline: 'none', backgroundColor: editingPromptId === shot.id ? '#fff' : '#f4f4f4' }}
                    value={shot.prompt || ''}
                    onChange={(e) => onPromptChange(shot.id, e.target.value)}
                    readOnly={editingPromptId !== shot.id}
                  />
                  <button 
                    style={{...buttonStyle, padding: '5px 10px', fontSize: '0.8rem'}}
                    onClick={() => setEditingPromptId(editingPromptId === shot.id ? null : shot.id)}
                  >
                    {editingPromptId === shot.id ? 'Save' : 'Edit'}
                  </button>
                </div>
              </td>
              <td style={{...tdStyle, padding: '0'}}>
                <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px dashed #ccc' }}>
                  <button
                    style={{...buttonStyle, width: '90%'}}
                    onClick={() => handleGeneratePrompt(shot)}
                    disabled={generatingPromptShotId === shot.id}
                  >
                    {generatingPromptShotId === shot.id ? 'Generating...' : 'Generate Prompt'}
                  </button>
                </div>
                <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button
                    style={{...buttonStyle, width: '90%'}}
                    onClick={() => handleGenerateImage(shot)}
                    disabled={loadingShotId === shot.id}
                  >
                    {loadingShotId === shot.id ? 'Generating...' : 'Generate AI Image'}
                  </button>
                </div>
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