import React, { useState } from 'react';
import { ImageCarouselModal } from './ImageCarouselModal';

const placeholderImage = 'https://wpmedia-lj.s3.amazonaws.com/wp-content/uploads/2023/10/Placeholder_01.jpg';

export function ImageGenerationTable({ shots, onNewImageFromAI, onSetSelectedImage, artDirectionText, imageGenUrl, webhookUrl, imageGenPromptTemplate, promptGenWebhookUrl, onPromptChange }) {
  const [loadingShotIds, setLoadingShotIds] = useState(new Set());
  const [shotForCarousel, setShotForCarousel] = useState(null);
  const [generatingPromptShotIds, setGeneratingPromptShotIds] = useState(new Set());
  const [editingPromptId, setEditingPromptId] = useState(null);

  const handleGeneratePrompt = async (shot) => {
    console.log(`[handleGeneratePrompt] BUTTON CLICKED for shot ${shot.id}`);
    if (!promptGenWebhookUrl) {
      alert('Please enter a Prompt Generation Webhook URL.');
      return;
    }
    console.log(`[handleGeneratePrompt] Starting generation for shot ${shot.id}`);
    setGeneratingPromptShotIds(prev => new Set([...prev, shot.id]));
    try {
      const payload = {
        script: shot.script,
        promptTemplate: imageGenPromptTemplate,
        artDirection: artDirectionText,
        image: imageGenUrl,
      };
      console.log(`[handleGeneratePrompt] Sending webhook request for shot ${shot.id}`);
      const response = await fetch(promptGenWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      console.log(`[handleGeneratePrompt] Webhook response received for shot ${shot.id}, status: ${response.status}`);
      if (response.ok) {
        const responseData = await response.json();
        console.log(`[handleGeneratePrompt] Response data:`, responseData);
        let generatedPrompt = '';
        if (Array.isArray(responseData) && responseData.length > 0 && responseData[0].output) {
          generatedPrompt = responseData[0].output;
        } else {
          // Fallback if the expected structure is not found
          generatedPrompt = JSON.stringify(responseData, null, 2);
        }
        console.log(`[ImageGenerationTable] About to call onPromptChange for shot ${shot.id}, prompt length: ${generatedPrompt?.length}`);
        onPromptChange(shot.id, generatedPrompt);
        console.log(`[ImageGenerationTable] onPromptChange called for shot ${shot.id}`);
      } else {
        console.log(`[handleGeneratePrompt] Webhook failed with status ${response.status}`);
        alert('Failed to generate prompt. Check console for details.');
      }
    } catch (error) {
      console.log(`[handleGeneratePrompt] Error caught:`, error);
      alert('Error generating prompt. Check console for details.');
      console.error('Error generating prompt:', error);
    } finally {
      setGeneratingPromptShotIds(prev => {
        const next = new Set(prev);
        next.delete(shot.id);
        return next;
      });
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
    setLoadingShotIds(prev => new Set([...prev, shot.id]));
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
      setLoadingShotIds(prev => {
        const next = new Set(prev);
        next.delete(shot.id);
        return next;
      });
    }
  };

  const handleSetSelected = (imageUrl) => {
    if (shotForCarousel) {
      onSetSelectedImage(shotForCarousel.id, imageUrl);
    }
  };

  const handleBatchGeneratePrompts = async () => {
    const shotsWithoutPrompt = shots.filter(shot => !shot.prompt || shot.prompt.trim() === '');

    for (const shot of shotsWithoutPrompt) {
      console.log(`[Batch] Generating prompt for shot ${shot.id}`);
      await handleGeneratePrompt(shot);
    }

    console.log('[Batch] All prompts generated');
  };

  const handleBatchGenerateImages = async () => {
    const shotsWithPromptButNoImage = shots.filter(shot =>
      shot.prompt && shot.prompt.trim() !== '' && (!shot.imageUrls || shot.imageUrls.length === 0)
    );

    for (const shot of shotsWithPromptButNoImage) {
      console.log(`[Batch] Generating image for shot ${shot.id}`);
      await handleGenerateImage(shot);
    }

    console.log('[Batch] All images generated');
  };

  return (
    <>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <button onClick={handleBatchGeneratePrompts} className="primary-button">
          Batch Generate Prompts (Empty Only)
        </button>
        <button onClick={handleBatchGenerateImages} className="primary-button">
          Batch Generate AI Images (Empty Only)
        </button>
      </div>
      <table className="generation-table">
        <thead>
          <tr>
            <th>Image</th>
            <th>Shot Description</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {shots.map((shot) => (
            <tr key={shot.id}>
              <td>
                <div className="table-thumbnail-container" onClick={() => shot.imageUrls && shot.imageUrls.length > 0 && setShotForCarousel(shot)}>
                  <img
                    src={shot.selectedImageUrl || placeholderImage}
                    alt="Shot visualization"
                  />
                  {shot.imageUrls && shot.imageUrls.length > 1 && (
                    <div className="count-badge">
                      {shot.imageUrls.length}
                    </div>
                  )}
                </div>
              </td>
              <td className="cell-split">
                <div className="cell-top">{shot.script}</div>
                <div className="cell-bottom">
                  <textarea
                    className="prompt-textarea"
                    placeholder="Edit your image prompt or Generate Prompt with AI"
                    value={shot.prompt || ''}
                    onChange={(e) => onPromptChange(shot.id, e.target.value)}
                    readOnly={editingPromptId !== shot.id}
                  />
                  <button
                    className="button-small"
                    onClick={() => setEditingPromptId(editingPromptId === shot.id ? null : shot.id)}
                  >
                    {editingPromptId === shot.id ? 'Save' : 'Edit'}
                  </button>
                </div>
              </td>
              <td className="cell-split">
                <div className="button-container">
                  <button
                    className="button-full"
                    onClick={() => handleGeneratePrompt(shot)}
                    disabled={generatingPromptShotIds.has(shot.id)}
                  >
                    {generatingPromptShotIds.has(shot.id) ? 'Generating...' : 'Generate Prompt'}
                  </button>
                </div>
                <div className="button-container">
                  <button
                    className="button-full"
                    onClick={() => handleGenerateImage(shot)}
                    disabled={loadingShotIds.has(shot.id)}
                  >
                    {loadingShotIds.has(shot.id) ? 'Generating...' : 'Generate AI Image'}
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