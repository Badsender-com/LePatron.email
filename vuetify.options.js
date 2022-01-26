import fr from './node_modules/vuetify/lib/locale/fr';
import en from './node_modules/vuetify/lib/locale/en';
import config from './packages/server/node.config.js';

console.log('called vuetify options');
console.log({ fr, en });
export default {
  breakpoint: {},
  lang: {
    locales: { fr, en },
    current: 'fr',
  },
  icons: { iconfont: 'md' },
  theme: {
    options: {
      customProperties: true,
    },
    themes: {
      light: {
        ...config.brandOptions.colors,
      },
    },
  },
};
