import React, { useEffect, useState } from 'react';
import { Film } from 'lucide-react';
import { getTmdbImageUrl } from '../services/tmdbService';

interface MediaPosterImageProps {
  path: string | null | undefined;
  fallbackSrc?: string;
  size?: 'w185' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original';
  alt: string;
  titleForFallback?: string;
  className?: string;
}

export const MediaPosterImage: React.FC<MediaPosterImageProps> = ({
  path,
  fallbackSrc,
  size = 'w500',
  alt,
  titleForFallback,
  className = '',
}) => {
  const primaryUrl = getTmdbImageUrl(path, size) || fallbackSrc || null;
  const [currentSrc, setCurrentSrc] = useState<string | null>(primaryUrl);
  const [failedCompletely, setFailedCompletely] = useState(false);

  useEffect(() => {
    setCurrentSrc((prev) => (prev === primaryUrl ? prev : primaryUrl));
    setFailedCompletely(false);
  }, [primaryUrl]);

  const handleError = () => {
    if (currentSrc && fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    } else {
      setFailedCompletely(true);
    }
  };

  if (!currentSrc || failedCompletely) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#1B2232] via-[#121620] to-[#0B0D12] p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Film className="h-8 w-8 text-slate-500" />
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={handleError}
      className={className}
    />
  );
};
