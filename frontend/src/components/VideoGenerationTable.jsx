import React, { useState } from 'react';
import { VideoCarouselModal } from './VideoCarouselModal';

const placeholderImage = 'https://wpmedia-lj.s3.amazonaws.com/wp-content/uploads/2023/10/Placeholder_01.jpg';

export function VideoGenerationTable({ shots, videoGenPromptTemplate, videoPromptGenWebhookUrl, videoGenWebhookUrl, artDirectionText, onVideoPromptChange, onNewVideoFromAI, onSetSelectedVideo, onRemoveVideo, onCleanVideos }) {
  const [loadingShotIds, setLoadingShotIds] = useState(new Set());
  const [shotForVideoCarousel, setShotForVideoCarousel] = useState(null);
  const [generatingVideoPromptShotIds, setGeneratingVideoPromptShotIds] = useState(new Set());
  const [editingVideoPromptId, setEditingVideoPromptId] = useState(null);

  const handleGenerateVideoPrompt = async (shot) => {
    if (!videoPromptGenWebhookUrl) {
      alert('Please enter a Video Prompt Generation Webhook URL.');
      return;
    }
    setGeneratingVideoPromptShotIds(prev => new Set([...prev, shot.id]));
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
      setGeneratingVideoPromptShotIds(prev => {
        const next = new Set(prev);
        next.delete(shot.id);
        return next;
      });
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
    setLoadingShotIds(prev => new Set([...prev, shot.id]));
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
      setLoadingShotIds(prev => {
        const next = new Set(prev);
        next.delete(shot.id);
        return next;
      });
    }
  };

  const handleSetSelectedVideo = (videoUrl) => {
    if (shotForVideoCarousel) {
      onSetSelectedVideo(shotForVideoCarousel.id, videoUrl);
    }
  };

  const handleRemoveVideo = (videoUrl) => {
    if (shotForVideoCarousel && onRemoveVideo) {
      onRemoveVideo(shotForVideoCarousel.id, videoUrl);
    }
  };

  const handleBatchGenerateVideoPrompts = async () => {
    const shotsWithoutVideoPrompt = shots.filter(shot => !shot.videoPrompt || shot.videoPrompt.trim() === '');

    for (const shot of shotsWithoutVideoPrompt) {
      console.log(`[Batch] Generating video prompt for shot ${shot.id}`);
      await handleGenerateVideoPrompt(shot);
    }

    console.log('[Batch] All video prompts generated');
  };

  const handleBatchGenerateVideos = async () => {
    const shotsWithPromptButNoVideo = shots.filter(shot =>
      shot.videoPrompt && shot.videoPrompt.trim() !== '' && (!shot.videoUrls || shot.videoUrls.length === 0)
    );

    for (const shot of shotsWithPromptButNoVideo) {
      console.log(`[Batch] Generating video for shot ${shot.id}`);
      await handleGenerateVideo(shot);
    }

    console.log('[Batch] All videos generated');
  };

  return (
    <>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <button onClick={handleBatchGenerateVideoPrompts} className="primary-button">
          Batch Generate Video Prompts (Empty Only)
        </button>
        <button onClick={handleBatchGenerateVideos} className="primary-button">
          Batch Generate AI Videos (Empty Only)
        </button>
      </div>
      <table className="generation-table">
        <thead>
          <tr>
            <th>Thumbnail</th>
            <th>Shot Description</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {shots.map((shot) => (
            <tr key={shot.id}>
              <td>
                <div className="table-thumbnail-container" onClick={() => shot.videoUrls && shot.videoUrls.length > 0 && setShotForVideoCarousel(shot)}>
                  <img
                    src={shot.selectedImageUrl || placeholderImage}
                    alt="Shot visualization"
                  />
                  {shot.videoUrls && shot.videoUrls.length > 0 && (
                    <div className="count-badge">
                      {shot.videoUrls.length}
                    </div>
                  )}
                </div>
              </td>
              <td className="cell-split">
                <div className="cell-top">
                  {shot.script}
                  <button
                    className="button-small"
                    onClick={() => onCleanVideos(shot.id)}
                  >
                    Clean
                  </button>
                </div>
                <div className="cell-bottom">
                  <textarea
                    className="prompt-textarea"
                    placeholder="Edit your video prompt or Generate Prompt with AI"
                    value={shot.videoPrompt || ''}
                    onChange={(e) => onVideoPromptChange(shot.id, e.target.value)}
                    readOnly={editingVideoPromptId !== shot.id}
                  />
                  <button
                    className="button-small"
                    onClick={() => setEditingVideoPromptId(editingVideoPromptId === shot.id ? null : shot.id)}
                  >
                    {editingVideoPromptId === shot.id ? 'Save' : 'Edit'}
                  </button>
                </div>
              </td>
              <td className="cell-split">
                <div className="button-container">
                  <button
                    className="button-full"
                    onClick={() => handleGenerateVideoPrompt(shot)}
                    disabled={generatingVideoPromptShotIds.has(shot.id)}
                  >
                    {generatingVideoPromptShotIds.has(shot.id) ? 'Generating...' : 'Generate Prompt'}
                  </button>
                </div>
                <div className="button-container">
                  <button
                    className="button-full"
                    onClick={() => handleGenerateVideo(shot)}
                    disabled={loadingShotIds.has(shot.id)}
                  >
                    {loadingShotIds.has(shot.id) ? 'Generating...' : 'Generate AI Video'}
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
          onRemove={handleRemoveVideo}
        />
      )}
    </>
  );
}
