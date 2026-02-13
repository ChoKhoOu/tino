import { useState, useMemo, useEffect } from 'react';
import { useFileSearch } from './useFileSearch.js';

export function useAutocomplete(text: string, cursorPosition: number) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const query = useMemo(() => {
    const left = text.slice(0, cursorPosition);
    const match = left.match(/@([\w\-\.\/]*)$/);
    return match ? match[1] : null;
  }, [text, cursorPosition]);

  const { files, loading } = useFileSearch(query);

  const fileCount = files.length;
  useEffect(() => {
    setSelectedIndex(0);
  }, [fileCount]);

  return {
    query,
    files,
    loading,
    selectedIndex,
    setSelectedIndex,
  };
}
