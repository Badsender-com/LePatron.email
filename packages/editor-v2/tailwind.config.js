export default {
  content: [
    './components/**/*.html',
    './client/src/**/*.{vue,js}',
  ],
  theme: {
    extend: {
      // Sera étendu avec tokens du Design System
    },
  },
  corePlugins: {
    preflight: false,  // Email compatibility
  },
}
