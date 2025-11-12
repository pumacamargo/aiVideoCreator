import React, { useState } from 'react';
import { VideoCarouselModal } from './VideoCarouselModal';

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
export function VideoGenerationTable({ shots, videoGenPromptTemplate, videoPromptGenWebhookUrl, videoGenWebhookUrl, artDirectionText, onVideoPromptChange, onNewVideoFromAI, onSetSelectedVideo }) {
  const [loadingShotId, setLoadingShotId] = useState(null);
  const [shotForVideoCarousel, setShotForVideoCarousel] = useState(null);
  const [generatingVideoPromptShotId, setGeneratingVideoPromptShotId] = useState(null);
  const [editingVideoPromptId, setEditingVideoPromptId] = useState(null);

  const handleGenerateVideoPrompt = async (shot) => {
    if (!videoPromptGenWebhookUrl) {
      alert('Please enter a Video Prompt Generation Webhook URL.');
      return;
    }
    setGeneratingVideoPromptShotId(shot.id);
    try {
      const payload = {
        shotDescription: shot.script,
        promptTemplate: videoGenPromptTemplate,
        thumbnail: shot.selectedImageUrl,
        artDirection: artDirectionText,
        imagePrompt: shot.prompt, // Assuming shot.prompt holds the image prompt
      };
      const response = await fetch(videoPromptGenWebhookUrl, {
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
        onVideoPromptChange(shot.id, generatedPrompt);
      } else {
        alert('Failed to generate video prompt. Check console for details.');
      }
    } catch (error) {
      alert('Error generating video prompt. Check console for details.');
      console.error('Error generating video prompt:', error);
    } finally {
      setGeneratingVideoPromptShotId(null);
    }
  };

  const handleGenerateVideo = async (shot) => {
    if (!videoGenWebhookUrl) {
      alert('Please enter a Video Generation Webhook URL.');
      return;
    }
    if (!shot.videoPrompt) {
      alert('Please generate a video prompt first.');
      return;
    }
    setLoadingShotId(shot.id);
    try {
      const payload = {
        prompt: shot.videoPrompt,
        thumbnail: shot.selectedImageUrl,
      };
      const response = await fetch(videoGenWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const responseData = await response.json();
        let generatedVideoUrl = null;
        if (responseData?.[0]?.data?.resultJson) {
          try {
            const resultJson = JSON.parse(responseData[0].data.resultJson);
            if (resultJson?.resultUrls?.[0]) {
              generatedVideoUrl = resultJson.resultUrls[0];
            }
          } catch (e) {
            console.error("Failed to parse resultJson:", e);
          }
        }

        if (generatedVideoUrl && onNewVideoFromAI) {
          onNewVideoFromAI(shot.id, generatedVideoUrl);
        } else {
          alert("Failed to get generated video from AI. Check console for details.");
          console.log("Unexpected response structure:", responseData);
        }
      } else {
        alert('Failed to generate video. Check console for details.');
      }
    } catch (error) {
      alert('Error generating video. Check console for details.');
      console.error('Error generating video:', error);
    } finally {
      setLoadingShotId(null);
    }
  };

  const handleSetSelectedVideo = (videoUrl) => {
    if (shotForVideoCarousel) {
      onSetSelectedVideo(shotForVideoCarousel.id, videoUrl);
    }
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
                  {shot.videoUrls && shot.videoUrls.length > 0 && (
                    <div style={videoCountBadgeStyle}>
                      {shot.videoUrls.length}
                    </div>
                  )}
                </div>
              </td>
              <td style={{...tdStyle, padding: '0'}}>
                <div style={{ height: '80px', borderBottom: '1px dashed #ccc', padding: '8px', overflowY: 'auto' }}>{shot.script}</div>
                <div style={{ height: '80px', padding: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <textarea
                    placeholder="Edit your video prompt or Generate Prompt with AI"
                    style={{ flex: 1, height: '100%', border: 'none', resize: 'none', outline: 'none', backgroundColor: editingVideoPromptId === shot.id ? '#fff' : '#f4f4f4' }}
                    value={shot.videoPrompt || ''}
                    onChange={(e) => onVideoPromptChange(shot.id, e.target.value)}
                    readOnly={editingVideoPromptId !== shot.id}
                  />
                  <button 
                    style={{...buttonStyle, padding: '5px 10px', fontSize: '0.8rem'}}
                    onClick={() => setEditingVideoPromptId(editingVideoPromptId === shot.id ? null : shot.id)}
                  >
                    {editingVideoPromptId === shot.id ? 'Save' : 'Edit'}
                  </button>
                </div>
              </td>
              <td style={{...tdStyle, padding: '0'}}>
                <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px dashed #ccc' }}>
                  <button
                    style={{...buttonStyle, width: '90%'}}
                    onClick={() => handleGenerateVideoPrompt(shot)}
                    disabled={generatingVideoPromptShotId === shot.id}
                  >
                    {generatingVideoPromptShotId === shot.id ? 'Generating...' : 'Generate Prompt'}
                  </button>
                </div>
                <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button
                    style={{...buttonStyle, width: '90%'}}
                    onClick={() => handleGenerateVideo(shot)}
                    disabled={loadingShotId === shot.id}
                  >
                    {loadingShotId === shot.id ? 'Generating...' : 'Generate AI Video'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {shotForVideoCarousel && (
        <VideoCarouselModal
          videoUrls={shotForVideoCarousel.videoUrls}
          initialVideoUrl={shotForVideoCarousel.selectedVideoUrl}
          onClose={() => setShotForVideoCarousel(null)}
          onSetSelected={handleSetSelectedVideo}
        />
      )}
    </>
  );
}
