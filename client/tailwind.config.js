/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        primary: '#F97316',
        primaryBright: '#FB923C',
        background: '#0B0B0F',
        card: '#141419',
        cardSecondary: '#1A1A21',
        muted: '#A1A1AA',
        ink: '#CECED3',
        faint: '#9CA3AF',
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        border: '#27272A',
        strava: '#FC4C02',
        stravaDark: '#E34400',
        panel: '#101014',
        track: '#1D1D24',
        bar: '#303037',
        info: '#3B82F6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      // Project type scale (Figma lockups) — use these, never text-[Npx].
      fontSize: {
        micro: '9px',
        caption: '10px',
        label: '11px',
        body: '13px',
        lead: '15px',
        title: '22px',
        h3: '25px',
        h2: '32px',
        h1: '44px',
        hero: '64px',
        display: '80px',
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
        card: '10px',
      },
      spacing: {
        4.5: '1.125rem',
        5.5: '1.375rem',
        6.5: '1.625rem',
      },
      // card widths: DayCard size variants (sm/md/lg)
      minWidth: {
        cardWide: '340px',
        cardMid: '240px',
        cardDay: '200px',
      },
      maxWidth: {
        shell: '1440px',
        narrow: '480px',
        mid: '540px',
      },
      minHeight: {
        touch: '44px',
      },
      backgroundImage: {
        'editorial-scrim':
          'linear-gradient(180deg, rgba(11, 11, 15, 0.501961) 0%, rgba(11, 11, 15, 0.0627451) 40%, rgba(11, 11, 15, 0.960784) 100%)',
        'card-scrim':
          'linear-gradient(180deg, rgba(11, 11, 15, 0) 15%, rgba(11, 11, 15, 0.937255) 100%)',
      },
    },
  },
  plugins: [],
}
