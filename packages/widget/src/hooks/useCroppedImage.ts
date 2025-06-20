import { useEffect, useState, useCallback } from "react";

const MAX_CACHE_ENTRIES = 20;

type CachedImageEntry = {
  value: string;
  hits: number;
};

const croppedImageCache = new Map<string, CachedImageEntry>();

const getCache = (url: string) => {
  const entry = croppedImageCache.get(url);
  if (entry) {
    entry.hits += 1;
    return entry.value;
  }
};

const setCache = (url: string, value: string) => {
  if (croppedImageCache.size >= MAX_CACHE_ENTRIES) {
    let keyToEvict: string | null = null;
    let lowestHits = Infinity;

    for (const [key, entry] of croppedImageCache.entries()) {
      if (entry.hits < lowestHits) {
        lowestHits = entry.hits;
        keyToEvict = key;
      }
    }

    if (keyToEvict) {
      croppedImageCache.delete(keyToEvict);
    }
  }

  croppedImageCache.set(url, { value, hits: 1 });
};

export function useCroppedImage(imageUrl?: string): string | undefined {
  const [croppedSrc, setCroppedSrc] = useState<string | undefined>(undefined);

  const safeSetCroppedSrc = useCallback((url: string | undefined) => {
    try {
      setCroppedSrc(url);
    } catch (error) {
      console.error('Error setting cropped source:', error);
    }
  }, []);

  const safeCropImage = useCallback((img: HTMLImageElement): string | null => {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      const { naturalWidth: width, naturalHeight: height } = img;
      
      // Skip processing if the image is not properly loaded
      if (width === 0 || height === 0) {
        return null;
      }

      canvas.width = width;
      canvas.height = height;
      
      try {
        ctx.drawImage(img, 0, 0);
      } catch (e) {
        console.error('Error drawing image to canvas:', e);
        return null;
      }

      let imageData;
      try {
        imageData = ctx.getImageData(0, 0, width, height);
      } catch (e) {
        console.error('Error getting image data:', e);
        return null;
      }
      
      const pixels = imageData.data;
      let top: number | null = null;
      let left: number | null = null;
      let right: number | null = null;
      let bottom: number | null = null;

      try {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const alpha = pixels[(y * width + x) * 4 + 3];
            if (alpha !== 0) {
              if (top === null) top = y;
              if (left === null || x < left) left = x;
              if (right === null || x > right) right = x;
              bottom = y;
            }
          }
        }
      } catch (e) {
        console.error('Error processing image pixels:', e);
        return null;
      }

      if (top === null || left === null || right === null || bottom === null) {
        console.warn("Image is fully transparent or could not be processed");
        return null;
      }

      const trimmedWidth = right - left + 1;
      const trimmedHeight = bottom - top + 1;
      
      // Ensure dimensions are valid
      if (trimmedWidth <= 0 || trimmedHeight <= 0) {
        console.warn('Invalid image dimensions after trimming');
        return null;
      }

      let trimmed;
      try {
        trimmed = ctx.getImageData(left, top, trimmedWidth, trimmedHeight);
      } catch (e) {
        console.error('Error getting trimmed image data:', e);
        return null;
      }

      canvas.width = trimmedWidth;
      canvas.height = trimmedHeight;

      const newCtx = canvas.getContext("2d");
      if (!newCtx) return null;

      try {
        newCtx.putImageData(trimmed, 0, 0);
        return canvas.toDataURL();
      } catch (e) {
        console.error('Error creating cropped image:', e);
        return null;
      }
    } catch (error) {
      console.error('Error in safeCropImage:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!imageUrl) {
      safeSetCroppedSrc(undefined);
      return;
    }

    // Skip processing data URLs as they might cause CORS issues
    if (imageUrl.startsWith('data:')) {
      safeSetCroppedSrc(imageUrl);
      return;
    }

    if (croppedImageCache.has(imageUrl)) {
      safeSetCroppedSrc(getCache(imageUrl));
      return;
    }

    let isCancelled = false;
    let img: HTMLImageElement | null = null;

    const loadImage = (url: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        try {
          img = new Image();
          img.crossOrigin = "anonymous";
          
          const onLoad = () => {
            cleanup();
            resolve(img!);
          };
          
          const onError = (error: ErrorEvent) => {
            cleanup();
            reject(error || new Error(`Failed to load image: ${url}`));
          };
          
          const cleanup = () => {
            if (img) {
              img.removeEventListener('load', onLoad);
              img.removeEventListener('error', onError as any);
            }
          };
          
          img.addEventListener('load', onLoad);
          img.addEventListener('error', onError as any);
          
          try {
            img.src = url;
          } catch (e) {
            cleanup();
            reject(e);
          }
        } catch (e) {
          reject(e);
        }
      });

    const processImage = async () => {
      if (isCancelled) return;
      
      try {
        const img = await loadImage(imageUrl);
        if (isCancelled) return;
        
        const cropped = safeCropImage(img) ?? imageUrl;
        if (isCancelled) return;
        
        setCache(imageUrl, cropped);
        safeSetCroppedSrc(cropped);
      } catch (error) {
        console.error('Error processing image:', error);
        if (!isCancelled) {
          safeSetCroppedSrc(imageUrl);
        }
      }
    };

    safeSetCroppedSrc(undefined);
    processImage();

    return () => {
      isCancelled = true;
      // Clean up any pending image loads
      if (img) {
        img.src = '';
      }
    };
  }, [imageUrl, safeCropImage, safeSetCroppedSrc]);

  return croppedSrc;
}
