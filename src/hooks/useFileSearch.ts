import { useState, useEffect, useRef } from 'react';
import { scanFiles } from '@/utils/file-reference.js';

const EMPTY_FILES: string[] = [];

export function useFileSearch(query: string | null) {
  const [files, setFiles] = useState<string[]>(EMPTY_FILES);
  const [loading, setLoading] = useState(false);
  const prevQueryRef = useRef<string | null>(null);

  useEffect(() => {
    if (!query) {
      if (prevQueryRef.current !== null) {
        setFiles(EMPTY_FILES);
      }
      prevQueryRef.current = query;
      return;
    }
    prevQueryRef.current = query;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await scanFiles(query);
        setFiles(results);
      } catch (error) {
        console.error('File search failed:', error);
        setFiles(EMPTY_FILES);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  return { files, loading };
}
