"use client";

import { useEffect } from "react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="p-6">
      <h2 className="text-lg font-bold text-red-700 mb-2">שגיאה בטעינת הדף</h2>
      <pre className="text-xs text-red-600 bg-red-50 rounded p-3 mb-4 overflow-auto max-h-64">
        {error.message}
        {error.digest ? `\n\ndigest: ${error.digest}` : ""}
      </pre>
      <button
        onClick={reset}
        className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700"
      >
        נסה שוב
      </button>
    </main>
  );
}
