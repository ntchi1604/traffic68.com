import { useState, useEffect, useRef } from 'react';

/**
 * LazyImage component with IntersectionObserver
 * Prevents CLS by reserving space and lazy loads images
 */
export default function LazyImage({
  src,
  alt,
  width,
  height,
  className = '',
  style = {},
  priority = false,
  onLoad,
  ...props
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef(null);

  useEffect(() => {
    if (priority) return; // Skip observer for priority images

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = (e) => {
    setIsLoaded(true);
    onLoad?.(e);
  };

  // Calculate aspect ratio to prevent CLS
  const aspectRatio = width && height ? (height / width) * 100 : null;

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        paddingBottom: aspectRatio ? `${aspectRatio}%` : undefined,
        ...style,
      }}
    >
      {isInView && (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          fetchpriority={priority ? 'high' : 'auto'}
          onLoad={handleLoad}
          className={`${aspectRatio ? 'absolute inset-0 w-full h-full object-cover' : 'w-full h-auto'} transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          {...props}
        />
      )}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
    </div>
  );
}
