import React from 'react';

export const MODELS = {
  // Text
  FLASH: 'gemini-2.5-flash',
  PRO: 'gemini-2.5-pro',
  // Image
  IMAGEN: 'imagen-4.0-generate-001',
  FLASH_IMAGE: 'gemini-2.5-flash-image',
  // Video
  VEO: 'veo-3.1-fast-generate-preview',
  // Audio
  TTS: 'gemini-2.5-flash-preview-tts',
  LIVE: 'gemini-2.5-flash-native-audio-preview-09-2025',
};

// SVG Icons
export const CelestialIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 1 0 10 10"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.9 19.1 1.4-1.4"/><path d="m17.7 6.3 1.4-1.4"/></svg>
);

export const VEO_LOADING_MESSAGES = [
  "Summoning digital spirits...",
  "Consulting the cosmic servers...",
  "Weaving the visual tapestry...",
  "Polishing the pixels of fate...",
  "Rendering your destiny...",
  "This can take a few minutes, the spirits are busy today...",
  "Aligning the celestial data streams...",
  "Finalizing the prophecy...",
];

// Fix: Add aspect ratio constants for Creative Studio
export const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"];
export const VIDEO_ASPECT_RATIOS = ["16:9", "9:16"];
