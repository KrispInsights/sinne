/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Core palette
        bg: '#F7F3EE',
        surface: '#FFFFFF',
        border: '#EAE4DC',
        accent: '#6B5E4E',
        'text-primary': '#3a2e25',
        'text-secondary': '#a09580',
        'text-tertiary': '#c4b8a8',
        destructive: '#C0392B',

        // Nervous system state colours
        settled: {
          bg: '#EAF5EF',
          text: '#2a6645',
          border: '#a8d5bc',
          dot: '#2a6645',
        },
        activated: {
          bg: '#FEF3EA',
          text: '#7a4020',
          border: '#f2c49a',
          dot: '#7a4020',
        },
        shutdown: {
          bg: '#EEEAF8',
          text: '#3d3565',
          border: '#c0b8e0',
          dot: '#3d3565',
        },

        // Emotion cluster colours
        'cluster-grief': { bg: '#EEEAF8', text: '#3C3489' },
        'cluster-fear': { bg: '#EAF3DE', text: '#27500A' },
        'cluster-anger': { bg: '#FAECE7', text: '#712B13' },
        'cluster-shame': { bg: '#FBEAF0', text: '#72243E' },
        'cluster-positive': { bg: '#E1F5EE', text: '#085041' },
        'cluster-neutral': { bg: '#F1EFE8', text: '#444441' },
        'cluster-release': { bg: '#E6F1FB', text: '#0C447C' },

        // Integration dot colour
        integration: '#8a7a68',

        // Dark mode
        'dark-base': '#18181b',
        'dark-surface': 'rgba(255,255,255,0.04)',
        'dark-text-primary': '#e8e0d4',
        'dark-text-secondary': '#a09d96',
        'dark-text-tertiary': '#52504c',
        'dark-accent': '#8a7a68',
      },
      fontFamily: {
        sans: ['Inter', 'System'],
      },
      fontSize: {
        'wordmark': ['22px', { fontWeight: '500', letterSpacing: '-0.5px' }],
        'title': ['20px', { fontWeight: '500' }],
        'prompt': ['16px', { fontWeight: '500', lineHeight: '1.4' }],
        'body': ['15px', { fontWeight: '400', lineHeight: '1.5' }],
        'label': ['11px', { fontWeight: '500', letterSpacing: '0.07em' }],
        'chip': ['13px', { fontWeight: '500' }],
        'disclaimer': ['11px', { fontWeight: '400' }],
      },
      borderRadius: {
        card: '12px',
        chip: '20px',
        input: '10px',
        btn: '12px',
      },
      spacing: {
        'screen': '20px',
        'section': '20px',
        'chip-gap': '4px',
        'card-gap': '8px',
      },
    },
  },
  plugins: [],
};
