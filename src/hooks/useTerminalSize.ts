import { useState, useEffect } from 'react';
import { useStdout } from 'ink';

export function useTerminalSize(): { rows: number; columns: number } {
  const { stdout } = useStdout();
  const [size, setSize] = useState({
    rows: stdout?.rows || process.stdout.rows || 24,
    columns: stdout?.columns || process.stdout.columns || 80,
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        rows: stdout?.rows || process.stdout.rows || 24,
        columns: stdout?.columns || process.stdout.columns || 80,
      });
    };
    
    if (process.stdout.on) {
      process.stdout.on('resize', handleResize);
    }
    
    return () => { 
      if (process.stdout.off) {
        process.stdout.off('resize', handleResize); 
      }
    };
  }, [stdout]);

  return size;
}
