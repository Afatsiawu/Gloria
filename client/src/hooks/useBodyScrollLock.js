import { useEffect } from 'react';

/**
 * Locks body scrolling while `locked` is true and restores the exact scroll
 * position afterwards. Fixed positioning is used because it also stops
 * scrolling on iOS Safari, where `overflow: hidden` alone can be ignored.
 */
export function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined;
    const { body } = document;
    const scrollY = window.scrollY;
    const href = window.location.href;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);

      // A same-page history traversal (closing the menu with Back) can reset
      // the scroll after this cleanup runs, so restore it again once settled.
      const restore = () => {
        if (window.location.href === href && document.body.style.position !== 'fixed') {
          window.scrollTo(0, scrollY);
        }
      };
      requestAnimationFrame(restore);
      setTimeout(restore, 200);
    };
  }, [locked]);
}
