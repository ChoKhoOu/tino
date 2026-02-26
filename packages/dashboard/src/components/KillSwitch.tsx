import React, { useState } from 'react';

interface KillSwitchProps {
  onActivate: () => Promise<void>;
}

export function KillSwitch({ onActivate }: KillSwitchProps) {
  const [confirming, setConfirming] = useState(false);
  const [activating, setActivating] = useState(false);

  async function handleActivate() {
    setActivating(true);
    try {
      await onActivate();
    } finally {
      setActivating(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="bg-red-900/50 border-2 border-red-500 rounded-lg p-4 text-center">
        <p className="text-red-300 font-bold mb-3">
          This will cancel ALL orders and flatten ALL positions immediately.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={handleActivate}
            disabled={activating}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded disabled:opacity-50"
          >
            {activating ? 'Activating...' : 'CONFIRM KILL SWITCH'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-6 rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg w-full"
    >
      KILL SWITCH
    </button>
  );
}
