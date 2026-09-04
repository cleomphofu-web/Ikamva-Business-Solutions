import React from "react";
import "./GlassIcons.css";

export function GlassIcons({ items, className = "" }) {
  return (
    <div className={`glass-icons-container ${className}`}>
      {items.map((item, idx) => (
        <button
          key={idx}
          className="glass-icon-wrapper group"
          onClick={item.action}
          type="button"
        >
          <div className="glass-icon-bg" />
          <div className="glass-icon-content">
            <span className="glass-icon-svg">{item.icon}</span>
            <span className="glass-icon-label">{item.label}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
