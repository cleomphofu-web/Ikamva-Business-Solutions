import React, { useEffect, useRef, useState } from "react";
import "./ScrollFloat.css";

function getInitialTransform(direction, distance) {
  if (direction === "left") return `translate3d(${distance}px, 0, 0)`;
  if (direction === "right") return `translate3d(${-distance}px, 0, 0)`;
  if (direction === "down") return `translate3d(0, ${-distance}px, 0)`;
  return `translate3d(0, ${distance}px, 0)`;
}

export function ScrollFloat({
  children,
  className = "",
  direction = "up",
  distance = 30,
  duration = 0.8,
  delay = 0,
}) {
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  const style = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? "translate3d(0, 0, 0)" : getInitialTransform(direction, distance),
    filter: isVisible ? "blur(0px)" : "blur(4px)",
    transitionProperty: "transform, opacity, filter",
    transitionDuration: `${duration}s`,
    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
    transitionDelay: `${delay}s`,
    willChange: "transform, opacity, filter",
  };

  return (
    <div ref={containerRef} className={`scroll-float-container ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}
