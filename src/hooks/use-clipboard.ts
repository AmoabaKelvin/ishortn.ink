import { useState } from "react";

const useClipboard = (callBack: CallableFunction) => {
  const [copied, setCopied] = useState(false);

  const writeToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      callBack();
    });
  };

  return { copied, writeToClipboard };
};

export default useClipboard;
