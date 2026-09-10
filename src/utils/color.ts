// Team colors, flash colors, and light colors throughout LightSync are chosen
// freely by the organizer via a color picker. Several places in the UI put
// that color directly behind text (buttons, selected poll options, the
// full-screen flash state) with a hardcoded text color that only looks right
// for *some* chosen colors - e.g. near-black text reads fine on a bright red
// team color, but is nearly invisible on a dark navy one; white text reads
// fine on navy, but disappears on white/yellow/silver.
//
// This picks whichever of near-black or white has higher WCAG contrast
// against the given background, so text stays legible no matter what color
// the organizer picks.
export function getReadableTextColor(hex: string | undefined | null, fallback: string = '#0a0a0a'): string {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return fallback;
  
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const bgLuminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  
    // WCAG contrast ratio = (L_lighter + 0.05) / (L_darker + 0.05).
    // Near-black text luminance ~0.0033; white text luminance = 1.
    const contrastWithDarkText = (bgLuminance + 0.05) / (0.0033 + 0.05);
    const contrastWithLightText = (1 + 0.05) / (bgLuminance + 0.05);
  
    return contrastWithLightText > contrastWithDarkText ? '#ffffff' : '#0a0a0a';
  }