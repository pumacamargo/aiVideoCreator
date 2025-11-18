import React, { useState } from 'react';
import { VideoCarouselModal } from './VideoCarouselModal';

const placeholderImage = 'https://wpmedia-lj.s3.amazonaws.com/wp-content/uploads/2023/10/Placeholder_01.jpg';

export function SoundFXGenerationTable({ shots, soundFXPromptTemplate, soundFXPromptGenWebhookUrl, soundFXGenWebhookUrl, artDirectionText, onSoundFXPromptChange, onNewSoundFXFromAI, onSetSelectedSoundFX, onRemoveSoundFX }) {
  const [loadingShotIds, setLoadingShotIds] = useState(new Set());
  const [shotForSoundFXCarousel, setShotForSoundFXCarousel] = useState(null);
  const [generatingSoundFXPromptShotIds, setGeneratingSoundFXPromptShotIds] = useState(new Set());
  const [editingSoundFXPromptId, setEditingSoundFXPromptId] = useState(null);

  const handleGenerateSoundFXPrompt = async (shot) => {
    if (!soundFXPromptGenWebhookUrl) {
      alert('Please enter a SoundFX Prompt Generation Webhook URL.');
      return;
    }
    setGeneratingSoundFXPromptShotIds(prev => new Set([...prev, shot.id]));
    try {
      const payload = {
        shotDescription: shot.script,
        promptTemplate: soundFXPromptTemplate,
        thumbnail: shot.selectedImageUrl,
        video: shot.selectedVideoUrl, // Video URL from AI-generated video
        artDirection: artDirectionText,
        imagePrompt: shot.prompt, // Image prompt used for image generation
      };
      const response = await fetch(soundFXPromptGenWebhookUrl, {
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
        onSoundFXPromptChange(shot.id, generatedPrompt);
      } else {
        alert('Failed to generate SoundFX prompt. Check console for details.');
      }
    } catch (error) {
      alert('Error generating SoundFX prompt. Check console for details.');
      console.error('Error generating SoundFX prompt:', error);
    } finally {
      setGeneratingSoundFXPromptShotIds(prev => {
        const next = new Set(prev);
        next.delete(shot.id);
        return next;
      });
    }
  };

  const handleGenerateSoundFX = async (shot) => {
    if (!soundFXGenWebhookUrl) {
      alert('Please enter a SoundFX Generation Webhook URL.');
      return;
    }
    if (!shot.soundFXPrompt) {
      alert('Please generate a SoundFX prompt first.');
      return;
    }
    setLoadingShotIds(prev => new Set([...prev, shot.id]));
    try {
      const payload = {
        prompt: shot.soundFXPrompt,
        thumbnail: shot.selectedImageUrl,
      };
      const response = await fetch(soundFXGenWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const responseData = await response.json();
        let generatedSoundFXUrl = null;
        if (responseData?.[0]?.data?.resultJson) {
          try {
            const resultJson = JSON.parse(responseData[0].data.resultJson);
            if (resultJson?.resultUrls?.[0]) {
              generatedSoundFXUrl = resultJson.resultUrls[0];
            }
          } catch (e) {
            console.error("Failed to parse resultJson:", e);
          }
        }

        if (generatedSoundFXUrl && onNewSoundFXFromAI) {
          onNewSoundFXFromAI(shot.id, generatedSoundFXUrl);
        } else {
          alert("Failed to get generated SoundFX from AI. Check console for details.");
          console.log("Unexpected response structure:", responseData);
        }
      } else {
        alert('Failed to generate SoundFX. Check console for details.');
      }
    } catch (error) {
      alert('Error generating SoundFX. Check console for details.');
      console.error('Error generating SoundFX:', error);
    } finally {
      setLoadingShotIds(prev => {
        const next = new Set(prev);
        next.delete(shot.id);
        return next;
      });
    }
  };

  const handleSetSelectedSoundFX = (soundFXUrl) => {
    if (shotForSoundFXCarousel) {
      onSetSelectedSoundFX(shotForSoundFXCarousel.id, soundFXUrl);
    }
  };

  const handleRemoveSoundFX = (soundFXUrl) => {
    if (shotForSoundFXCarousel && onRemoveSoundFX) {
      onRemoveSoundFX(shotForSoundFXCarousel.id, soundFXUrl);
    }
  };

  const handleBatchGenerateSoundFXPrompts = async () => {
    const shotsWithoutSoundFXPrompt = shots.filter(shot => !shot.soundFXPrompt || shot.soundFXPrompt.trim() === '');

    for (const shot of shotsWithoutSoundFXPrompt) {
      console.log(`[Batch] Generating SoundFX prompt for shot ${shot.id}`);
      await handleGenerateSoundFXPrompt(shot);
    }

    console.log('[Batch] All SoundFX prompts generated');
  };

  const handleBatchGenerateSoundFX = async () => {
    const shotsWithPromptButNoSoundFX = shots.filter(shot =>
      shot.soundFXPrompt && shot.soundFXPrompt.trim() !== '' && (!shot.soundFXUrls || shot.soundFXUrls.length === 0)
    );

    for (const shot of shotsWithPromptButNoSoundFX) {
      console.log(`[Batch] Generating SoundFX for shot ${shot.id}`);
      await handleGenerateSoundFX(shot);
    }

    console.log('[Batch] All SoundFX generated');
  };

  return (
    <>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <button onClick={handleBatchGenerateSoundFXPrompts} className="primary-button">
          Batch Generate SoundFX Prompts (Empty Only)
        </button>
        <button onClick={handleBatchGenerateSoundFX} className="primary-button">
          Batch Generate SoundFX (Empty Only)
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
                <div className="table-thumbnail-container" onClick={() => shot.soundFXUrls && shot.soundFXUrls.length > 0 && setShotForSoundFXCarousel(shot)}>
                  <img
                    src={shot.selectedImageUrl || placeholderImage}
                    alt="Shot visualization"
                  />
                  {shot.soundFXUrls && shot.soundFXUrls.length > 0 && (
                    <div className="count-badge">
                      {shot.soundFXUrls.length}
                    </div>
                  )}
                </div>
              </td>
              <td className="cell-split">
                <div className="cell-top">{shot.script}</div>
                <div className="cell-bottom">
                  <textarea
                    className="prompt-textarea"
                    placeholder="Edit your SoundFX prompt or Generate Prompt with AI"
                    value={shot.soundFXPrompt || ''}
                    onChange={(e) => onSoundFXPromptChange(shot.id, e.target.value)}
                    readOnly={editingSoundFXPromptId !== shot.id}
                  />
                  <button
                    className="button-small"
                    onClick={() => setEditingSoundFXPromptId(editingSoundFXPromptId === shot.id ? null : shot.id)}
                  >
                    {editingSoundFXPromptId === shot.id ? 'Save' : 'Edit'}
                  </button>
                </div>
              </td>
              <td className="cell-split">
                <div className="button-container">
                  <button
                    className="button-full"
                    onClick={() => handleGenerateSoundFXPrompt(shot)}
                    disabled={generatingSoundFXPromptShotIds.has(shot.id)}
                  >
                    {generatingSoundFXPromptShotIds.has(shot.id) ? 'Generating...' : 'Generate Prompt'}
                  </button>
                </div>
                <div className="button-container">
                  <button
                    className="button-full"
                    onClick={() => handleGenerateSoundFX(shot)}
                    disabled={loadingShotIds.has(shot.id)}
                  >
                    {loadingShotIds.has(shot.id) ? 'Generating...' : 'Generate SoundFX'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {shotForSoundFXCarousel && (
        <VideoCarouselModal
          videoUrls={shotForSoundFXCarousel.soundFXUrls}
          initialVideoUrl={shotForSoundFXCarousel.selectedSoundFXUrl}
          onClose={() => setShotForSoundFXCarousel(null)}
          onSetSelected={handleSetSelectedSoundFX}
          onRemove={handleRemoveSoundFX}
        />
      )}
    </>
  );
}
