import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';

interface DishImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function DishImage({ src, alt, className = '' }: DishImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#231B15] via-[#1A1410] to-[#120E0B] text-[#9E8B73] p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <UtensilsCrossed className="w-7 h-7 text-[#C99A4E]/70 mb-2" strokeWidth={1.5} />
        <span className="text-xs font-medium text-[#D6C8B4] line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
