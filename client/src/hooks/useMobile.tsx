import * as React from "react";

/** Mobile: abaixo de 768px */
const MOBILE_MAX = 767;

/** Desktop: 768px até 2560px+ (todo o sistema) */
const DESKTOP_MIN = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth <= MOBILE_MAX);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth <= MOBILE_MAX);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = React.useState(
    () =>
      typeof window !== "undefined" && window.innerWidth >= DESKTOP_MIN
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_MIN}px)`);
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener("change", onChange);
    setIsDesktop(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}
