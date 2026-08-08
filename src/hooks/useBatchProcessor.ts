import { useState } from 'react';

export function useBatchProcessor() {
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const processBatch = async (items: any[]) => {
    setIsProcessing(true);
    const results = [];

    for (let i = 0; i < items.length; i++) {
      try {
        // Process ONE item at a time
        const response = await fetch('/api/generate-listing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photos: items[i].photos || [items[i].url] }),
        });
        
        const data = await response.json();
        results.push(data);
        
        // Update progress bar
        setProgress(Math.round(((i + 1) / items.length) * 100));
        
        // FRANK'S RATE LIMIT PROTECTOR:
        // Wait 2 seconds between items to stay under Gemini's free tier limit
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`Item ${i} failed`, error);
      }
    }

    setIsProcessing(false);
    return results;
  };

  return { processBatch, progress, isProcessing };
}
