/* ========================================================================
   JANNAT BAKING TOOLS 2.0 — SHARED TAILWIND THEME
   Loaded as a classic (non-module) script right after the Tailwind CDN so
   every page shares exactly the same design tokens.
   ======================================================================== */
(function () {
    var theme = {
        theme: {
            extend: {
                colors: {
                    primary: {
                        DEFAULT: '#E85A4F',
                        dark: '#C94A40',
                        darker: '#A63A31',
                        light: '#F5A5A0',
                        subtle: '#FEF2F1'
                    },
                    secondary: {
                        DEFAULT: '#D4A574',
                        dark: '#B88B5E',
                        light: '#E8D4BC',
                        subtle: '#FBF4EB'
                    },
                    accent: {
                        DEFAULT: '#4A90A4',
                        dark: '#37707F',
                        light: '#E8F4F7'
                    },
                    surface: '#FFFFFF',
                    background: '#FFFBF7',
                    'bg-alt': '#FDF8F3',
                    border: '#F0E6DC',
                    'border-strong': '#E3D4C5',
                    text: {
                        DEFAULT: '#2D2420',
                        secondary: '#6B5B52',
                        muted: '#A89B93'
                    },
                    success: { DEFAULT: '#22C55E', dark: '#15803D', light: '#DCFCE7' },
                    warning: { DEFAULT: '#F59E0B', dark: '#B45309', light: '#FEF3C7' },
                    error: { DEFAULT: '#EF4444', dark: '#B91C1C', light: '#FEE2E2' },
                    info: { DEFAULT: '#3B82F6', light: '#DBEAFE' }
                },
                fontFamily: {
                    sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
                    serif: ['"Playfair Display"', 'Georgia', 'serif']
                },
                borderRadius: {
                    '4xl': '2rem',
                    '5xl': '2.5rem'
                },
                boxShadow: {
                    soft: '0 4px 20px -2px rgba(45, 36, 32, 0.08)',
                    lift: '0 18px 40px -16px rgba(45, 36, 32, 0.22)',
                    glow: '0 10px 30px -8px rgba(232, 90, 79, 0.45)',
                    ring: '0 0 0 1px rgba(240, 230, 220, 1)'
                },
                transitionTimingFunction: {
                    smooth: 'cubic-bezier(0.16, 1, 0.3, 1)'
                },
                maxWidth: {
                    '8xl': '88rem'
                }
            }
        }
    };

    if (typeof window !== 'undefined' && window.tailwind) {
        window.tailwind.config = theme;
    } else if (typeof window !== 'undefined') {
        // Tailwind CDN not ready yet — apply as soon as it is.
        var tries = 0;
        var timer = setInterval(function () {
            tries++;
            if (window.tailwind) {
                window.tailwind.config = theme;
                clearInterval(timer);
            } else if (tries > 100) {
                clearInterval(timer);
            }
        }, 20);
    }
})();
