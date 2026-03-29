import { useEffect, useRef } from "react";

/**
 * Registers keydown handlers for multiple keys simultaneously.
 * Keys are `event.key` values (e.g. "ArrowUp", " ", "Enter").
 * Uses the latest-ref pattern so an updated keyMap doesn't require
 * re-registering the listener.
 */
export function useKeyboard(keyMap: Record<string, () => void>): void {
  const keyMapRef = useRef(keyMap);

  // Keep the ref up to date on every render
  useEffect(() => {
    keyMapRef.current = keyMap;
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const action = keyMapRef.current[event.key];
      if (action) {
        event.preventDefault();
        action();
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, []); // register once; handler always reads the fresh ref
}

/**
 * Convenience wrapper for a single key listener.
 */
export function useKeyPress(key: string, callback: () => void): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === key) {
        event.preventDefault();
        callbackRef.current();
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [key]); // re-register if the key itself changes
}
