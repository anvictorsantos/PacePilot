/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        primary: '#ECECEF',
        primaryBright: '#FFFFFF',
        accent: '#F97316',
        accentBright: '#FB923C',
        background: '#0A0A0D',
        card: '#141419',
        cardSecondary: '#1A1A21',
        muted: '#9B9BA4',
        ink: '#C9C9CE',
        faint: '#7D7D86',
        success: '#7FBF8F',
        warning: '#E0A85C',
        danger: '#E4443C',
        dangerBright: '#F0605A',
        border: '#27272A',
        band: '#0E0E13',
        strava: '#FC4C02',
        panel: '#0C0C10',
        track: '#1D1D24',
        bar: '#303037',
        info: '#A9A9B2',
        infoBright: '#C9C9CE',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontWeight: {
        normal: '400',
        medium: '500',
      },
      letterSpacing: {
        wide: '0.02em',
        widest: '0.06em',
      },
      // Above every teleported modal/overlay (all z-50) so a toast is never
      // painted behind a dialog.
      zIndex: {
        toast: '60',
      },
      // Project type scale (Figma lockups) — use these, never text-[Npx].
      fontSize: {
        micro: '9px',
        caption: '10px',
        label: '11px',
        body: '13px',
        lead: '15px',
        title: '22px',
        page: '27px',
        stat: '26px',
        section: '38px',
        figure: '46px',
        h3: '25px',
        hero: '64px',
      },
      // label/caption pair with the type scale above; display/body/loose for %.
      lineHeight: {
        caption: '12px',
        label: '13px',
        display: '108%',
        body: '160%',
        loose: '165%',
      },
      borderRadius: {
        none: '0',
        sm: '4px',
        xs: '6px',
        DEFAULT: '8px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '14px',
        '3xl': '16px',
        card: '12px',
        full: '9999px',
      },
      spacing: {
        4.5: '1.125rem',
        5.5: '1.375rem',
        6.5: '1.625rem',
      },
      maxWidth: {
        shell: '1440px',
        narrow: '480px',
        mid: '540px',
      },
      minHeight: {
        touch: '44px',
      },
    },
  },
  plugins: [],
}
