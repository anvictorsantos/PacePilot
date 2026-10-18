export default {
  plugins: {
    // Tailwind 4 ships its own PostCSS plugin and handles vendor prefixes, so
    // `tailwindcss` and `autoprefixer` are no longer separate plugins.
    '@tailwindcss/postcss': {},
  },
}
