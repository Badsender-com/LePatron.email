module.exports = {
  id: 'demo',
  name: 'Demo Design System',
  version: '1.0.0',

  // 🎨 Tokens de design
  tokens: {
    colors: {
      primary: '#007bff',
      secondary: '#6c757d',
      success: '#28a745',
      danger: '#dc3545',
      warning: '#ffc107',
      info: '#17a2b8',

      text: '#333333',
      textLight: '#666666',
      background: '#ffffff',
      backgroundLight: '#f8f9fa',

      border: '#dee2e6',
    },

    typography: {
      fontFamily: {
        primary: 'Arial, Helvetica, sans-serif',
        heading: 'Georgia, "Times New Roman", serif',
      },
      fontSize: {
        small: '14px',
        base: '16px',
        large: '18px',
        h1: '32px',
        h2: '24px',
        h3: '20px',
      },
      lineHeight: {
        tight: '1.2',
        normal: '1.5',
        relaxed: '1.8',
      },
      fontWeight: {
        normal: '400',
        bold: '700',
      },
    },

    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
      xxl: '48px',
    },

    borderRadius: {
      none: '0',
      sm: '4px',
      md: '8px',
      lg: '16px',
      full: '9999px',
    },
  },

  // 📏 Règles et contraintes
  rules: {
    accessibility: {
      minContrast: 4.5,              // WCAG AA
      requireAltText: true,           // Images
      maxHeadingLevel: 3,             // SEO email
    },

    ecoDesign: {
      maxEmailWeight: 102,            // Ko (recommandation)
      maxImageWeight: 200,            // Ko par image
      preferredImageFormat: 'webp',
    },

    branding: {
      logoRequired: true,
      colorPaletteOnly: false,        // Autoriser couleurs custom
    },
  },

  // 🧩 Composants disponibles
  components: {
    core: ['button', 'heading', 'container'],
  },

  // 🔧 Valeurs par défaut pour composants CORE
  componentDefaults: {
    button: {
      backgroundColor: '{{tokens.colors.primary}}',
      textColor: '#ffffff',
      borderRadius: '{{tokens.borderRadius.sm}}',
      padding: '12px 24px',
      fontFamily: '{{tokens.typography.fontFamily.primary}}',
    },

    heading: {
      fontFamily: '{{tokens.typography.fontFamily.heading}}',
      color: '{{tokens.colors.text}}',
      lineHeight: '{{tokens.typography.lineHeight.tight}}',
    },

    container: {
      padding: '{{tokens.spacing.md}}',
      backgroundColor: '{{tokens.colors.background}}',
    },
  },
}
