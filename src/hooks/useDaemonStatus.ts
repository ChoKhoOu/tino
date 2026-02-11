import { useState, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { DaemonManager } from '../daemon/manager.js';
import { DaemonClient } from '../grpc/daemon-client.js';

export type DaemonStatus = 'not-configured' | 'starting' | 'connected' | 'error' | 'stopped';

export interface DaemonInfo {
  pythonVersion: string;
  nautilusVersion: string;
}

export function useDaemonStatus(daemonRef: RefObject<DaemonManager | null>) {
  const [status, setStatus] = useState<DaemonStatus>('not-configured');
  const [info, setInfo] = useState<DaemonInfo | undefined>();
  
  // Keep track of previous status to handle transitions correctly
  const statusRef = useRef<DaemonStatus>('not-configured');
  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    const client = new DaemonClient();
    let mounted = true;

    // Initial check - if ref is already set (unlikely on first mount but possible on remount)
    if (daemonRef.current) {
      setStatus('starting');
    }

    const checkStatus = async () => {
      if (!mounted) return;

      if (!daemonRef.current) {
        if (statusRef.current !== 'not-configured') {
          setStatus('not-configured');
        }
        return;
      }

      // If we were not configured but now have a ref, we are starting
      if (statusRef.current === 'not-configured') {
        setStatus('starting');
      }

      const sysInfo = await client.getSystemInfo();
      
      if (!mounted) return;

      if (sysInfo) {
        setStatus('connected');
        setInfo(sysInfo);
      } else {
        // Connection failed
        if (statusRef.current === 'connected') {
          setStatus('error');
        }
        // If 'starting', we stay 'starting' until success
        // If 'error', stay 'error'
      }
    };

    // Run immediately then interval
    void checkStatus();
    const interval = setInterval(checkStatus, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [daemonRef]);

  return { status, info };
}
