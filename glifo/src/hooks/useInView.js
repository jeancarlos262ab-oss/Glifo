import { useEffect, useRef, useState } from 'react';

/**
 * useInView — dispara cuando el elemento entra al viewport.
 *
 * @param {object} options
 * @param {number}  options.threshold   - porcentaje visible para disparar (default 0.12)
 * @param {string}  options.rootMargin  - margen de anticipación (default '0px 0px -40px 0px')
 *                                        Usa '200px 0px 0px 0px' para pre-activar animaciones
 *                                        antes de que el elemento llegue al viewport.
 */
export function useInView(options = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(el);
        }
      },
      {
        threshold:  0.08,
        rootMargin: '0px 0px -40px 0px',
        ...options,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, inView];
}
