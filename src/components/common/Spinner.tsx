

import React from 'react';

interface SpinnerProps {
  text?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ text = "Thinking..." }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 my-4">
      <div className="w-12 h-12 border-4 border-slate-500 border-t-indigo-400 rounded-full animate-spin"></div>
      {text && <p className="text-indigo-300 animate-pulse">{text}</p>}
    </div>
  );
};

export default Spinner;
