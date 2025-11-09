import React, { useState, useRef, useContext, useEffect } from 'react';
import { getFortune, readPalmOrFace, generateImageWithFlash, textToSpeech, generateVideo, checkVideoStatus, getDailyAdvice, fetchVideoBlob } from '../services/geminiService';
import { fileToBase64, decode, decodeAudioData, encodeWAV } from '../utils/helpers';
import Spinner from './common/Spinner';
import FileUpload from './common/FileUpload';
import { VEO_LOADING_MESSAGES } from '../constants';
import { LanguageContext } from '../LanguageContext';
import GuideWelcome from './common/GuideWelcome';
import { Operation } from '@google/genai';

const FortuneTeller: React.FC = () => {
  const [birthDate, setBirthDate] = useState('');
  const [userName, setUserName] = useState('');
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [userImagePreviewUrl, setUserImagePreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentDate, setCurrentDate] = useState('');
  const [angelName, setAngelName] = useState('');
  const [fortuneText, setFortuneText] = useState('');
  
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [angelImageUrl, setAngelImageUrl] = useState('');

  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [fortuneAudio, setFortuneAudio] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [showWelcome, setShowWelcome] = useState(false);
  
  // Summary state
  const [summaryText, setSummaryText] = useState('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  
  // Share state
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  // features state
  const [downloadableAudioUrl, setDownloadableAudioUrl] = useState('');
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoError, setVideoError] = useState<string | null>(null);
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [videoLoadingMessage, setVideoLoadingMessage] = useState(VEO_LOADING_MESSAGES[0]);
  
  // Daily advice state
  const [adviceText, setAdviceText] = useState('');
  const [adviceAudio, setAdviceAudio] = useState<AudioBuffer | null>(null);
  const [isAdvicePlaying, setIsAdvicePlaying] = useState(false);
  const [isAdviceLoading, setIsAdviceLoading] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  
  // Help Modal State
  const [showHelp, setShowHelp] = useState(false);
  const [helpAudio, setHelpAudio] = useState<AudioBuffer | null>(null);
  const [isHelpAudioLoading, setIsHelpAudioLoading] = useState(false);
  const [isHelpPlaying, setIsHelpPlaying] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const adviceAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const helpAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  
  const { t, language } = useContext(LanguageContext);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('hasSeenWelcomeMessage');
    if (!hasSeenWelcome) {
        setShowWelcome(true);
    }
    const checkApiKey = async () => {
        if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
            setApiKeySelected(true);
        }
    };
    checkApiKey();
  }, []);

  useEffect(() => {
    let interval: number;
    if (isVideoLoading) {
        interval = window.setInterval(() => {
            setVideoLoadingMessage(prev => {
                const currentIndex = VEO_LOADING_MESSAGES.indexOf(prev);
                return VEO_LOADING_MESSAGES[(currentIndex + 1) % VEO_LOADING_MESSAGES.length];
            });
        }, 3000);
    }
    return () => clearInterval(interval);
  }, [isVideoLoading]);

  const handleDismissWelcome = () => {
      setShowWelcome(false);
      localStorage.setItem('hasSeenWelcomeMessage', 'true');
  };

  const handleFileUpload = (file: File) => {
    setUploadedImage(file);
    setBirthDate('');
    if (userImagePreviewUrl) {
      URL.revokeObjectURL(userImagePreviewUrl);
    }
    setUserImagePreviewUrl(URL.createObjectURL(file));
  };
  
  const resetState = () => {
    setError(null);
    setVideoError(null);
    setCurrentDate('');
    setAngelName('');
    setFortuneText('');
    setAngelImageUrl('');
    setFortuneAudio(null);
    setDownloadableAudioUrl('');
    setVideoUrl('');
    setIsPlaying(false);
    // Reset advice state as well
    setAdviceText('');
    setAdviceAudio(null);
    setIsAdvicePlaying(false);
    setAdviceError(null);
    // Reset summary state
    setSummaryText('');
    setSummaryError(null);
  };
  
  const handleFortuneRequest = async () => {
    if (!birthDate && !uploadedImage) {
      setError(t('error_no_input'));
      return;
    }
    setIsLoading(true);
    resetState();

    try {
      const today = new Date();
      const locale = language === 'fa' ? 'fa-IR' : language;
      const formattedDate = today.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
      setCurrentDate(formattedDate);
      
      const datePromptPrefix = t('prompt_date_prefix', { date: formattedDate });
      const nameForPrompt = userName.trim() || t('name_fallback');

      let fortuneResponseText = '';
      if (uploadedImage) {
        const base64 = await fileToBase64(uploadedImage);
        const prompt = datePromptPrefix + t('prompt_readPalmOrFace', { userName: nameForPrompt });
        const response = await readPalmOrFace(base64, uploadedImage.type, prompt);
        fortuneResponseText = response.text;
      } else if (birthDate) {
        if(userImagePreviewUrl) URL.revokeObjectURL(userImagePreviewUrl);
        setUserImagePreviewUrl(null);
        setUploadedImage(null);
        const prompt = datePromptPrefix + t('prompt_getFortune', { birthDate, userName: nameForPrompt });
        const response = await getFortune(prompt);
        fortuneResponseText = response.text;
      }

      const guidePrefix = t('guideResponsePrefix');
      const guideSuffix = t('guideResponseSuffix');
      const escapedGuidePrefix = guidePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedGuideSuffix = guideSuffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const angelMatchRegex = new RegExp(`${escapedGuidePrefix}\\s*(.*?)${escapedGuideSuffix}`);
      const angelMatch = fortuneResponseText.match(angelMatchRegex);
      const currentAngelName = angelMatch ? angelMatch[1].trim() : t('mysterious_guide');
      
      setAngelName(currentAngelName);
      setFortuneText(fortuneResponseText);
      
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("API quota exceeded")) {
        setError(t('error_quota_exceeded'));
      } else {
        setError(t('error_stars_clouded'));
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGenerateImage = async () => {
    if (!angelName) return;
    setIsImageLoading(true);
    setError(null);
    try {
      const nameForPrompt = userName.trim() || t('name_fallback');
      const imagePrompt = t('prompt_generate_image', { angelName, userName: nameForPrompt });
      const imageResponse = await generateImageWithFlash(imagePrompt);
      const imagePart = imageResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      
      if (imageResponse.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new Error("IMAGE_SAFETY_BLOCKED");
      }
      
      const base64ImageBytes: string | undefined = imagePart?.inlineData?.data;
      if (base64ImageBytes) {
        const mimeType = imagePart?.inlineData?.mimeType || 'image/jpeg';
        setAngelImageUrl(`data:${mimeType};base64,${base64ImageBytes}`);
      } else {
        throw new Error("No image data returned from API.");
      }
    } catch (err: any) {
      console.error(err);
      if (err.message === "IMAGE_SAFETY_BLOCKED") {
        setError(t('error_image_safety'));
      } else if (err.message === "IMAGEN_BILLING_REQUIRED") {
        setError(t('error_imagen_billing'));
      } else if (err.message?.includes("API quota exceeded")) {
        setError(t('error_quota_exceeded'));
      } else {
        setError(t('error_stars_clouded'));
      }
    } finally {
      setIsImageLoading(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!fortuneText) return;
    setIsAudioLoading(true);
    setError(null);
    try {
      const dateAnnouncement = t('date_announcement', { date: currentDate });
      const fullTextToSpeak = `${dateAnnouncement} ${fortuneText}`;
      const ttsResponse = await textToSpeech(fullTextToSpeak);

      const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const audioCtx = audioContextRef.current;
        const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
        
        setFortuneAudio(audioBuffer);
        if (audioBuffer) {
          const wavBlob = encodeWAV(audioBuffer.getChannelData(0), audioBuffer.sampleRate);
          setDownloadableAudioUrl(URL.createObjectURL(wavBlob));
        }
      } else {
         throw new Error("No audio data returned from API.");
      }
    } catch (err: any) {
      if (err.message?.includes("API quota exceeded")) {
        setError(t('error_quota_exceeded'));
      } else {
        setError(t('error_stars_clouded'));
      }
    } finally {
      setIsAudioLoading(false);
    }
  };
  
  const handleSummarizeFortune = async () => {
      if (!fortuneText) return;
      setIsSummaryLoading(true);
      setSummaryError(null);
      setSummaryText('');
      try {
        const prompt = t('prompt_summarize') + ` "${fortuneText}"`;
        const response = await getFortune(prompt); // Re-using getFortune service call
        setSummaryText(response.text);
      } catch (err: any) {
        console.error("Summarization failed:", err);
        setSummaryError(t('summary_error'));
      } finally {
        setIsSummaryLoading(false);
      }
    };

  const handleAnimateGuide = async () => {
    if (!angelImageUrl || !angelName) return;
    setIsVideoLoading(true);
    setVideoError(null);
    setVideoUrl('');

    try {
        const base64Image = angelImageUrl.split(',')[1];
        const imagePayload = { base64: base64Image, mimeType: 'image/jpeg' };
        const nameForPrompt = userName.trim() || t('name_fallback');
        const videoPrompt = t('prompt_animate_angel', { angelName, fortune: fortuneText, userName: nameForPrompt });
        
        let operation: Operation = await generateVideo(videoPrompt, '9:16', imagePayload);
        
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await checkVideoStatus(operation);
        }
        
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (downloadLink) {
            const blob = await fetchVideoBlob(downloadLink);
            setVideoUrl(URL.createObjectURL(blob));
        } else {
            throw new Error("Video generation completed, but no download link was found.");
        }
    } catch (err: any) {
        let message = t('error_video_failed');
        if(err.message?.includes("Requested entity was not found")) {
            message = t('error_api_key_invalid');
            setApiKeySelected(false);
        }
        setVideoError(message);
        console.error(err);
    } finally {
        setIsVideoLoading(false);
    }
  };

  const handleGetAdvice = async () => {
    setIsAdviceLoading(true);
    setAdviceError(null);
    setAdviceText('');
    setAdviceAudio(null);
    try {
        const advicePrompt = t('prompt_getAdvice');
        const response = await getDailyAdvice(advicePrompt);
        const advice = response.text;
        setAdviceText(advice);

        const ttsResponse = await textToSpeech(advice);
        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (base64Audio) {
           if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
            const audioBuffer = await decodeAudioData(decode(base64Audio), audioContextRef.current, 24000, 1);
            setAdviceAudio(audioBuffer);
        }
    } catch (err: any) {
        console.error(err);
        if (err.message?.includes("API quota exceeded")) {
            setAdviceError(t('error_quota_exceeded'));
        } else {
            setAdviceError(t('advice_error'));
        }
    } finally {
        setIsAdviceLoading(false);
    }
  };

  const toggleAudio = () => {
    if (!fortuneAudio || !audioContextRef.current) return;
    
    adviceAudioSourceRef.current?.stop();
    setIsAdvicePlaying(false);
    helpAudioSourceRef.current?.stop();
    setIsHelpPlaying(false);

    if (isPlaying) {
      audioSourceRef.current?.stop();
      setIsPlaying(false);
    } else {
      const source = audioContextRef.current.createBufferSource();
      source.buffer = fortuneAudio;
      source.connect(audioContextRef.current.destination);
      source.start();
      source.onended = () => setIsPlaying(false);
      audioSourceRef.current = source;
      setIsPlaying(true);
    }
  };

  const toggleAdviceAudio = () => {
    if (!adviceAudio || !audioContextRef.current) return;

    audioSourceRef.current?.stop();
    setIsPlaying(false);
    helpAudioSourceRef.current?.stop();
    setIsHelpPlaying(false);
    
    if (isAdvicePlaying) {
      adviceAudioSourceRef.current?.stop();
      setIsAdvicePlaying(false);
    } else {
      const source = audioContextRef.current.createBufferSource();
      source.buffer = adviceAudio;
      source.connect(audioContextRef.current.destination);
      source.start();
      source.onended = () => setIsAdvicePlaying(false);
      adviceAudioSourceRef.current = source;
      setIsAdvicePlaying(true);
    }
  };

  const toggleHelpAudio = async () => {
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }

    audioSourceRef.current?.stop();
    setIsPlaying(false);
    adviceAudioSourceRef.current?.stop();
    setIsAdvicePlaying(false);

    if(isHelpPlaying) {
        helpAudioSourceRef.current?.stop();
        setIsHelpPlaying(false);
        return;
    }

    const playAudio = (buffer: AudioBuffer) => {
        const source = audioContextRef.current!.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current!.destination);
        source.start();
        source.onended = () => setIsHelpPlaying(false);
        helpAudioSourceRef.current = source;
        setIsHelpPlaying(true);
    };

    if (helpAudio) {
        playAudio(helpAudio);
    } else {
        setIsHelpAudioLoading(true);
        try {
            const ttsResponse = await textToSpeech(t('help_modal_content'));
            const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                const audioBuffer = await decodeAudioData(decode(base64Audio), audioContextRef.current, 24000, 1);
                setHelpAudio(audioBuffer);
                playAudio(audioBuffer);
            }
        } catch (e) {
            console.error("Failed to generate help audio", e);
        } finally {
            setIsHelpAudioLoading(false);
        }
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // For blobs, we should revoke the URL after download
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  };
  
  const handleDownloadText = () => {
    if (!fortuneText) return;
    const blob = new Blob([fortuneText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    handleDownload(url, 'fortune.txt');
  };

  const handleDownloadImageWithTextOverlay = async (imageUrl: string, textToOverlay: string, outputFilename: string) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const image = new Image();
    image.crossOrigin = 'anonymous'; // Important for images from other origins (like blob URLs)
    image.src = imageUrl;

    image.onload = () => {
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);

        const padding = canvas.width * 0.05;
        const maxWidth = canvas.width - (padding * 2);
        // Constrain the text block to be in the vertical center 70% of the image
        const maxHeight = canvas.height * 0.7; 

        const wrapText = (context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
            const words = text.split(' ');
            let lines: string[] = [];
            let currentLine = words[0] || '';
            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const testLine = currentLine + " " + word;
                const metrics = context.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth < maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);
            return lines;
        };

        let fontSize = Math.max(20, canvas.width / 30);
        let lines: string[] = [];
        let textBlockHeight = 0;
        let lineHeight = 0;

        // Find the largest font size that fits within the maxHeight
        while (fontSize > 10) {
            ctx.font = `bold ${fontSize}px 'Times New Roman', serif`;
            lineHeight = fontSize * 1.3; // A bit of extra spacing for readability
            const currentLines = wrapText(ctx, textToOverlay, maxWidth);
            const currentTextBlockHeight = currentLines.length * lineHeight;
            if (currentTextBlockHeight < maxHeight) {
                lines = currentLines;
                textBlockHeight = currentTextBlockHeight;
                break; // Found a font size that fits
            }
            fontSize -= 2; // Decrease font size and try again
        }

        // If even the smallest font size overflows, use it anyway.
        if (lines.length === 0) {
            fontSize = 10;
            ctx.font = `bold ${fontSize}px 'Times New Roman', serif`;
            lineHeight = fontSize * 1.3;
            lines = wrapText(ctx, textToOverlay, maxWidth);
            textBlockHeight = lines.length * lineHeight;
        }

        // Center the text block vertically.
        const rectHeight = textBlockHeight + padding; // Total height of the background rectangle
        const rectY = (canvas.height - rectHeight) / 2; // Top position for vertical centering

        // Draw the semi-transparent background rectangle for readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        // The rectangle starts at `padding` from the left edge and spans `maxWidth`
        ctx.fillRect(padding, rectY, maxWidth, rectHeight);

        // Set text properties for drawing the fortune
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Calculate the starting Y position for the first line of text
        const textStartY = rectY + (padding / 2);

        // Draw each line of text centered on the canvas
        lines.forEach((line, index) => {
            // x-coordinate is the center of the canvas
            const x = canvas.width / 2;
            // y-coordinate is the start position + offset for the current line
            const y = textStartY + (index * lineHeight);
            ctx.fillText(line, x, y);
        });

        // Trigger the download
        const dataUrl = canvas.toDataURL('image/jpeg');
        handleDownload(dataUrl, outputFilename);
    };
    image.onerror = () => {
        console.error("Failed to load image for canvas operation.");
    };
  };

  const handleShare = async () => {
    const shareText = t('share_text_template', { angelName, fortune: fortuneText });

    if (navigator.share) {
      try {
        const shareData: ShareData = {
          title: t('share_title'),
          text: shareText,
        };

        if (angelImageUrl) {
          const response = await fetch(angelImageUrl);
          const blob = await response.blob();
          const file = new File([blob], 'fortune-image.jpg', { type: blob.type });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            shareData.files = [file];
          }
        }
        
        await navigator.share(shareData);
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: copy text to clipboard
      navigator.clipboard.writeText(shareText).then(() => {
        setShowCopySuccess(true);
        setTimeout(() => setShowCopySuccess(false), 2000);
      });
    }
  };


  const handleSelectKey = async () => {
    if (window.aistudio) {
        await window.aistudio.openSelectKey();
        setApiKeySelected(true); // Assume success
    }
  };

  const HelpIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
  );

  const DownloadIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
  );

  const SummaryIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
  );

  const ShareIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
  );

  const renderFormView = () => (
    <div className="mt-8">
      {isLoading ? (
        <Spinner text={t('spinner_unveiling')} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mb-6">
            <div>
              <label htmlFor="birthdate" className="block text-sm font-medium text-slate-300 mb-2">{t('birthDateLabel')}</label>
              <input
                id="birthdate"
                type="date"
                value={birthDate}
                onChange={(e) => { setBirthDate(e.target.value); setUploadedImage(null); if (userImagePreviewUrl) URL.revokeObjectURL(userImagePreviewUrl); setUserImagePreviewUrl(null); setError(null); }}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              {error &&
                <div className="text-red-400 p-4 bg-red-900/50 rounded-lg flex items-center justify-center text-center">
                  {error}
                </div>
              }
            </div>
          </div>

          <div className="flex items-center text-slate-500 my-6">
            <hr className="flex-grow border-slate-600" />
            <span className="px-4">{t('or')}</span>
            <hr className="flex-grow border-slate-600" />
          </div>

          <div className="space-y-6">
            <div>
              <FileUpload
                onFileUpload={(file) => { handleFileUpload(file); setError(null); }}
                accept="image/*"
                label={t('uploadLabel')}
              />
              {userImagePreviewUrl && (
                <div className="mt-4">
                  <p className="text-sm text-center text-slate-400 mb-2">{t('image_preview')}</p>
                  <img src={userImagePreviewUrl} alt={t('image_preview_alt')} className="rounded-lg max-h-40 mx-auto shadow-lg" />
                </div>
              )}
            </div>
            <div>
              <label htmlFor="userName" className="block text-sm font-medium text-slate-300 mb-2">{t('name_label')}</label>
              <input
                id="userName"
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder={t('name_placeholder')}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <button onClick={handleFortuneRequest} disabled={isLoading} className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:from-indigo-600 hover:to-purple-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
              {isLoading ? t('consultingButton') : t('revealButton')}
            </button>
          </div>
        </>
      )}
    </div>
  );

  const renderResultView = () => (
    <div className="mt-8 grid md:grid-cols-2 gap-8 items-start">
        <div className="space-y-6">
          <div>
            <label htmlFor="birthdate" className="block text-sm font-medium text-slate-300 mb-2">{t('birthDateLabel')}</label>
            <input
              id="birthdate"
              type="date"
              value={birthDate}
              onChange={(e) => { setBirthDate(e.target.value); setUploadedImage(null); if (userImagePreviewUrl) URL.revokeObjectURL(userImagePreviewUrl); setUserImagePreviewUrl(null); }}
              className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center text-slate-500">
            <hr className="flex-grow border-slate-600" />
            <span className="px-4">{t('or')}</span>
            <hr className="flex-grow border-slate-600" />
          </div>
          <div>
            <FileUpload
              onFileUpload={handleFileUpload}
              accept="image/*"
              label={t('uploadLabel')}
            />
            {userImagePreviewUrl && (
                <div className="mt-4">
                    <p className="text-sm text-center text-slate-400 mb-2">{t('image_preview')}</p>
                    <img src={userImagePreviewUrl} alt={t('image_preview_alt')} className="rounded-lg max-h-40 mx-auto shadow-lg" />
                </div>
            )}
          </div>
          <div>
            <label htmlFor="userName" className="block text-sm font-medium text-slate-300 mb-2">{t('name_label')}</label>
            <input
              id="userName"
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder={t('name_placeholder')}
              className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <button onClick={handleFortuneRequest} disabled={isLoading} className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:from-indigo-600 hover:to-purple-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
            {isLoading ? t('consultingButton') : t('revealButton')}
          </button>
        </div>
        <div className="mt-8 md:mt-0">
            <div className="p-6 bg-slate-900 rounded-lg border border-slate-700 space-y-4 animate-fade-in-up">
                <p className="text-center font-semibold text-purple-300">{currentDate}</p>
                <h3 className="text-xl font-semibold text-indigo-300 pt-4 border-t border-slate-700">{t('guide_title', { angelName })}</h3>
                
                {!angelImageUrl && !isImageLoading && (
                    <button onClick={handleGenerateImage} className="w-full text-sm bg-slate-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-600 transition duration-300">
                        {t('visualize_guide_button')}
                    </button>
                )}
                {isImageLoading && <Spinner text={t('generating_image')} />}

                {angelImageUrl && !videoUrl && (
                    <img src={angelImageUrl} alt={`Image of ${angelName}`} className="rounded-lg w-full h-auto object-cover shadow-lg shadow-black/30" />
                )}
                {videoUrl && <video src={videoUrl} controls autoPlay loop className="rounded-lg w-full h-auto" />}
                
                <p className="text-slate-300 leading-relaxed">{fortuneText.replace(`${t('guideResponsePrefix')} ${angelName}${t('guideResponseSuffix')}`, '').trim()}</p>
                
                <div className="flex flex-wrap gap-4 items-center pt-4 border-t border-slate-700">
                    {!fortuneAudio && !isAudioLoading && (
                        <button onClick={handleGenerateAudio} className="flex items-center gap-2 text-indigo-300 hover:text-indigo-200 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>{t('listen_button')}</span>
                        </button>
                    )}
                    {isAudioLoading && <Spinner text={t('generating_audio')} />}
                    {fortuneAudio && (
                        <button onClick={toggleAudio} className="flex items-center gap-2 text-indigo-300 hover:text-indigo-200 transition-colors">
                            {isPlaying ? (
                                <><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg><span>{t('pause_button')}</span></>
                            ) : (
                                <><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>{t('listen_button')}</span></>
                            )}
                        </button>
                    )}
                    {!summaryText && !isSummaryLoading && (
                        <button onClick={handleSummarizeFortune} className="flex items-center gap-2 text-purple-300 hover:text-purple-200 transition-colors">
                        <SummaryIcon />
                        <span>{t('summarize_button')}</span>
                        </button>
                    )}
                    <button onClick={handleShare} className="flex items-center gap-2 text-teal-300 hover:text-teal-200 transition-colors relative">
                        <ShareIcon />
                        <span>{t('share_button')}</span>
                        {showCopySuccess && (
                            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-600 text-white text-xs px-2 py-1 rounded animate-fade-in-up">
                            {t('copy_success')}
                            </span>
                        )}
                    </button>
                </div>
                
                {isSummaryLoading && <Spinner text={t('summarize_loading')} />}
                {summaryError && <p className="text-red-400 text-sm text-center mt-2">{summaryError}</p>}
                {summaryText && (
                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                        <h4 className="text-lg font-semibold text-purple-300">{t('summary_title')}</h4>
                        <p className="text-slate-300 italic leading-relaxed">"{summaryText}"</p>
                    </div>
                )}

                {fortuneText && (
                    <div className="pt-4 border-t border-slate-700 space-y-3">
                        <h4 className="text-sm font-semibold text-purple-300">Downloads</h4>
                        <div className="flex flex-wrap gap-3">
                        <button onClick={handleDownloadText} className="flex items-center gap-2 text-purple-300 hover:text-purple-200 transition-colors text-sm">
                            <DownloadIcon />{t('download_text')}
                        </button>
                        {downloadableAudioUrl && fortuneAudio && (
                            <button onClick={() => handleDownload(downloadableAudioUrl, 'fortune-audio.wav')} className="flex items-center gap-2 text-purple-300 hover:text-purple-200 transition-colors text-sm">
                                <DownloadIcon />{t('download_audio')}
                            </button>
                        )}
                        {angelImageUrl && (
                            <button onClick={() => handleDownloadImageWithTextOverlay(angelImageUrl, fortuneText, 'fortune-image.jpg')} className="flex items-center gap-2 text-purple-300 hover:text-purple-200 transition-colors text-sm">
                                <DownloadIcon />{t('download_image_fortune')}
                            </button>
                        )}
                        {userImagePreviewUrl && (
                                <button onClick={() => handleDownloadImageWithTextOverlay(userImagePreviewUrl, fortuneText, 'my-fortune-photo.jpg')} className="flex items-center gap-2 text-purple-300 hover:text-purple-200 transition-colors text-sm">
                                    <DownloadIcon />{t('download_user_image_fortune')}
                                </button>
                        )}
                        </div>
                    </div>
                )}

                {angelImageUrl && !videoUrl && !isVideoLoading && (
                    apiKeySelected ? (
                        <button onClick={handleAnimateGuide} className="w-full mt-4 text-sm bg-gradient-to-r from-purple-600 to-rose-500 text-white font-bold py-2 px-4 rounded-lg hover:from-purple-700 hover:to-rose-600 transition duration-300">
                            {t('animate_guide_button')}
                        </button>
                    ) : (
                        <div className="text-center p-4 mt-4 bg-slate-800 rounded-lg">
                            <p className="text-slate-300 mb-3 text-sm">{t('api_key_required')}</p>
                            <button onClick={handleSelectKey} className="bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-600 transition-colors text-sm">{t('select_api_key')}</button>
                        </div>
                    )
                )}
                {isVideoLoading && <Spinner text={videoLoadingMessage} />}
                {videoError && <p className="text-red-400 text-sm text-center mt-2">{videoError}</p>}
                {videoUrl && (
                    <div className="text-center mt-4">
                        <button onClick={() => handleDownload(videoUrl, 'fortune-video.mp4')} className="flex items-center justify-center w-full gap-2 text-purple-300 hover:text-purple-200 transition-colors bg-slate-800 py-2 rounded-lg">
                            <DownloadIcon />{t('download_video')}
                        </button>
                    </div>
                )}
                
                {fortuneText && !adviceText && !isAdviceLoading && (
                    <div className="mt-6 text-center">
                    <button onClick={handleGetAdvice} className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold py-2 px-6 rounded-lg hover:from-yellow-600 hover:to-orange-600 transition duration-300 shadow-lg">
                        {t('get_advice_button')}
                    </button>
                    </div>
                )}

                {isAdviceLoading && <Spinner text={t('advice_loading')} />}
                {adviceError && <div className="mt-4 text-center text-red-400 p-3 bg-red-900/50 rounded-lg">{adviceError}</div>}
                
                {adviceText && (
                    <div className="mt-6 pt-6 border-t border-slate-700 space-y-3">
                    <h4 className="text-lg font-semibold text-yellow-300 text-center">{t('advice_title')}</h4>
                    <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">{adviceText}</div>
                    {adviceAudio && (
                        <button onClick={toggleAdviceAudio} className="flex items-center gap-2 text-yellow-300 hover:text-yellow-200 transition-colors">
                        {isAdvicePlaying ? (
                            <><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg><span>{t('pause_advice')}</span></>
                        ) : (
                            <><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>{t('listen_advice')}</span></>
                        )}
                        </button>
                    )}
                    </div>
                )}
            </div>
        </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6 bg-slate-800/50 rounded-2xl shadow-2xl shadow-indigo-900/20 border border-slate-700">
      {showWelcome && <GuideWelcome onDismiss={handleDismissWelcome} />}
      <div className="flex justify-between items-start mb-2">
        <div>
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300">{t('title')}</h2>
            <p className="text-slate-400 mt-1">{t('description')}</p>
        </div>
        <button onClick={() => setShowHelp(true)} title={t('help_button')} className="flex items-center gap-2 text-slate-300 bg-slate-700/50 hover:bg-slate-700 transition-colors px-3 py-2 rounded-lg border border-slate-600">
            <HelpIcon />
            <span>{t('help_button')}</span>
        </button>
      </div>
      
      {fortuneText ? renderResultView() : renderFormView()}

      {showHelp && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-lg w-full relative shadow-2xl shadow-indigo-900/40">
                <h3 className="text-xl font-bold text-indigo-300 mb-4">{t('help_modal_title')}</h3>
                <p className="text-slate-300 leading-relaxed whitespace-pre-line mb-6">{t('help_modal_content')}</p>
                <div className="flex items-center justify-between">
                    <button onClick={toggleHelpAudio} disabled={isHelpAudioLoading} className="flex items-center gap-2 text-indigo-300 hover:text-indigo-200 transition-colors disabled:opacity-50">
                        {isHelpAudioLoading ? <Spinner text="" /> : (isHelpPlaying ? 
                          <><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg><span>{t('help_modal_pause')}</span></>
                          : <><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>{t('help_modal_listen')}</span></>
                        )}
                    </button>
                    <button onClick={() => setShowHelp(false)} className="bg-slate-700 text-slate-200 px-4 py-2 rounded-md text-sm font-semibold hover:bg-slate-600 transition-colors">{t('help_modal_close')}</button>
                </div>
                 <button onClick={() => setShowHelp(false)} className="absolute top-3 right-3 text-slate-500 hover:text-white transition-colors">
                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                 </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default FortuneTeller;