import { useState, useEffect } from 'react';
import { scanFiles } from '@/utils/file-reference.js';

export function useFileSearch(query: string | null) {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setFiles([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await scanFiles(query);
        setFiles(results);
      } catch (error) {
        console.error('File search failed:', error);
        setFiles([]);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  return { files, loading };
}
