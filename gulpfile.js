'use strict';

// this GulpFile mirror & enhance the GruntFile
// • another build tool was chosen to add more control & flexibility
//   AND to keep as much as possible the original files untouched

/* spell-checker: disable */

const gulp = require('gulp');
const path = require('path');
const $ = require('gulp-load-plugins')();
const del = require('del');
const args = require('yargs').argv;
const _ = require('lodash');
const beeper = require('beeper');
const log = require('fancy-log');
const colors = require('ansi-colors');
const Vinyl = require('vinyl');
const mergeStream = require('merge-stream');
const { pipeline } = require('stream');
const {
  CODEMIRROR_LIBS,
  CODEMIRROR_MIN_BUNDLE,
} = require('./packages/editor/codemirror-libs.js');

const isWatch = args.watch === true;
const isProd = args.prod === true;
const isDev = !isProd;
const env = isDev ? 'development' : 'production';
const SERVER_DIR = 'packages/server';
const BUILD_DIR = 'public/dist';
const BUILD_DIR_LIB = `${BUILD_DIR}/lib`;

function reportError(err) {
  if (!err) return;
  beeper();
  if (err.annotated) {
    log(err.annotated);
  } else if (err.message) {
    log(err.message);
  } else {
    log(err);
  }
}

// gulp only hears of the errors of the stream a task returns, and `pipe`
// forwards none: a broken bundle or stylesheet used to end with a success,
// and no file. `pipeline` hands the first error of any of its streams to
// the task, which fails the build with a non-zero exit. A watch only reports
// it and keeps watching: the next save is the fix.
function runPipeline(done, ...streams) {
  pipeline(...streams, (err) => {
    if (err && isWatch) {
      reportError(err);
      return done();
    }
    return done(err);
  });
}

log(
  'environment is',
  colors.magenta(env),
  'watch is',
  isWatch ? colors.magenta('enable') : 'disable'
);

function bump() {
  return gulp
    .src('./*.json')
    .pipe(
      $.bump({
        version: args.pkg,
      })
    )
    .pipe(gulp.dest('./'));
}
bump.description = 'Bump versions on package.json. Used only in release script';

/// /////
// CSS
/// /////

const autoprefixer = require('autoprefixer');
const csswring = require('csswring');

// Lists of streams rather than lazypipes: a lazypipe is an old-style stream
// that never emits 'finish', and `pipeline` would wait on it forever.
const cssDev = () => [
  $.postcss([
    autoprefixer({ overrideBrowserslist: ['ie 10', 'last 2 versions'] }),
  ]),
  $.beautify.css({ indent_size: 2 }),
  $.sourcemaps.write(),
];
const cssProd = () => [
  $.purgeSourcemaps(),
  $.postcss([csswring({ removeAllComments: true })]),
  $.rename({ suffix: '.min' }),
];

function cleanCss(cb) {
  if (isDev) return cb();
  return del([BUILD_DIR + '/*.css', BUILD_DIR + '/*.css.map'], cb);
}

function cssEditor(done) {
  runPipeline(
    done,
    gulp.src('packages/editor/src/css/badsender-editor.less'),
    $.sourcemaps.init(),
    $.less(),
    ...cssDev(),
    $.rename('badsender-editor.css'),
    gulp.dest(BUILD_DIR),
    ...cssProd(),
    gulp.dest(BUILD_DIR)
  );
}
cssEditor.description = 'build CSS for mosaico editor';
exports['css:mosaico'] = cssEditor;

const css = gulp.series(cleanCss, cssEditor);
css.description = 'Build CSS for the mosaico editor';

/// /////
// JS
/// /////

// ----- LIBRARIES

function cleanLib(cb) {
  if (isDev) return cb();
  return del(BUILD_DIR, '/**/*.js');
}

const mosaicoLibList = [
  'node_modules/jquery/dist/jquery.js',
  'node_modules/jquery-migrate/dist/jquery-migrate.js',
  'node_modules/knockout/build/output/knockout-latest.js', // don't use knockout-latest.debug as it breaks the editor
  'node_modules/jquery-ui-package/jquery-ui.js',
  'node_modules/jquery-ui-touch-punch/jquery.ui.touch-punch.js',
  'node_modules/default-passive-events/dist/index.js',
  // NOTE: include these 2 BEFORE the fileupload libs
  // using npm5 we can get sub-dependencies from nested paths, but npm3 does flatten them, so let's depend on them explicitly.
  // 'node_modules/blueimp-file-upload/node_modules/blueimp-canvas-to-blob/js/canvas-to-blob.js',
  // 'node_modules/blueimp-file-upload/node_modules/blueimp-load-image/js/load-image.all.min.js',
  'node_modules/blueimp-canvas-to-blob/js/canvas-to-blob.js',
  'node_modules/blueimp-load-image/js/load-image.all.min.js',
  // 'node_modules/blueimp-file-upload/js/jquery.iframe-transport.js',
  'node_modules/blueimp-file-upload/js/jquery.fileupload.js',
  'node_modules/blueimp-file-upload/js/jquery.fileupload-process.js',
  'node_modules/blueimp-file-upload/js/jquery.fileupload-image.js',
  'node_modules/blueimp-file-upload/js/jquery.fileupload-validate.js',
  'node_modules/knockout-jqueryui/dist/knockout-jqueryui.js',
  'node_modules/tinymce/tinymce.js',
  // Global, like tinymce above: used to neutralize the canvas preview of the
  // synthetic blocks (see ext/synthetic-blocks/neutralize-html.js). Not bundled
  // through browserify so it stays out of the editor bundle's require graph.
  'node_modules/dompurify/dist/purify.js',
  // CodeMirror 5 for the HTML code block editor. Concatenated as globals rather
  // than required through browserify: it must load before its own modes and
  // addons, which register themselves on the global CodeMirror.
  ...CODEMIRROR_LIBS,
];

// CodeMirror ships no minified build, and its ~500KB of source would otherwise
// land unminified in every editor load, whether or not the template enables the
// HTML code block. mosaicoLib minifies it into CODEMIRROR_MIN_BUNDLE.
// TODO: minifiy not minfied libs!
const mosaicoLibListMin = [
  'node_modules/jquery/dist/jquery.min.js',
  'node_modules/jquery-migrate/dist/jquery-migrate.min.js', // min existe but not minified
  'node_modules/knockout/build/output/knockout-latest.js', // already min
  'node_modules/jquery-ui-package/jquery-ui.min.js',
  'node_modules/jquery-ui-touch-punch/jquery.ui.touch-punch.min.js',
  'node_modules/default-passive-events/dist/index.js', // already min
  // NOTE: include these 2 BEFORE the fileupload libs
  'node_modules/blueimp-canvas-to-blob/js/canvas-to-blob.min.js',
  'node_modules/blueimp-load-image/js/load-image.all.min.js',
  'node_modules/blueimp-file-upload/js/jquery.fileupload.js', // no min files
  'node_modules/blueimp-file-upload/js/jquery.fileupload-process.js', // no min files
  'node_modules/blueimp-file-upload/js/jquery.fileupload-image.js', // no min files
  'node_modules/blueimp-file-upload/js/jquery.fileupload-validate.js', // no min files
  'node_modules/knockout-jqueryui/dist/knockout-jqueryui.js', // no min files
  'node_modules/tinymce/tinymce.min.js',
  'node_modules/dompurify/dist/purify.min.js',
  // CodeMirror, minified by mosaicoLib below into this single file.
  CODEMIRROR_MIN_BUNDLE,
];

const orderLibs = (lib) => /[^/]*\.js$/.exec(lib)[0];

function mosaicoLib() {
  const devLibs = gulp
    .src(mosaicoLibList)
    .pipe($.order(mosaicoLibList.map(orderLibs)))
    .pipe($.concat('badsender-lib-editor.js'));
  const codemirrorMin = gulp
    .src(CODEMIRROR_LIBS)
    .pipe($.order(CODEMIRROR_LIBS.map(orderLibs)))
    .pipe($.concat(CODEMIRROR_MIN_BUNDLE))
    .pipe($.uglify());
  const prodLibs = mergeStream(
    gulp.src(mosaicoLibListMin.filter((lib) => lib !== CODEMIRROR_MIN_BUNDLE)),
    codemirrorMin
  )
    .pipe($.order(mosaicoLibListMin.map(orderLibs)))
    .pipe($.concat('badsender-lib-editor.min.js'));

  const sourceMaps = gulp.src(
    'node_modules/blueimp-load-image/js/load-image.all.min.js.map'
  );

  return mergeStream(devLibs, prodLibs, sourceMaps).pipe(
    gulp.dest(BUILD_DIR_LIB)
  );
}
mosaicoLib.description = 'concat all mosaico lib files';
exports['js:mosaico-lib'] = mosaicoLib;

function copyTinymceFiles() {
  const base = 'node_modules/tinymce';
  // only copy necessary tinymce plugins
  // keep only minified files
  const src = [
    `${base}/tinymce.js`,
    `${base}/themes/modern/theme.js`,
    `${base}/plugins/paste/plugin.js`,
    `${base}/plugins/hr/plugin.js`,
    `${base}/plugins/lists/plugin.js`,
    `${base}/plugins/textcolor/plugin.js`,
    `${base}/plugins/colorpicker/plugin.js`,
    `${base}/plugins/code/plugin.js`,
  ];
  const srcMin = src.map((filePath) => {
    return filePath.replace(/\.js$/, '.min.js');
  });
  const all = [...src, ...srcMin];
  return gulp.src(all, { base: base }).pipe(gulp.dest(BUILD_DIR_LIB));
}
copyTinymceFiles.description =
  'copy all related tinymce files to the right place';

exports['js:tinymce'] = copyTinymceFiles;

// Bundling mosaico libs is just a concat…
const editorLib = gulp.series(
  cleanLib,
  gulp.parallel(mosaicoLib, copyTinymceFiles)
);
editorLib.description = 'build JS for the mosaico editor';

// ----- MOSAICO APPLICATION

const browserify = require('browserify');
const source = require('vinyl-source-stream');
const vinylBuffer = require('vinyl-buffer');
const aliasify = require('aliasify');
const shim = require('browserify-shim');
const babelify = require('babelify');
const envify = require('envify/custom');
const watchify = require('watchify');

const badsenderEditorLibs = ['lodash.find', 'lodash.debounce', 'cropperjs'];
const basedir = path.join(__dirname, '/packages/editor/src/js');

function mosaicoBadsenderLib(done) {
  const b = browserify({
    basedir,
    noParse: badsenderEditorLibs,
    debug: true,
  }).require(badsenderEditorLibs);
  runPipeline(
    done,
    b.bundle(),
    source('badsender-editor-libraries.js'),
    gulp.dest(BUILD_DIR_LIB),
    vinylBuffer(),
    $.stripDebug(),
    $.uglify(),
    $.rename({ suffix: '.min' }),
    gulp.dest(BUILD_DIR_LIB)
  );
}

function mosaicoEditor(debug = false) {
  const b = browserify({
    basedir,
    cache: {},
    packageCache: {},
    debug,
    entries: ['./app.js', '../../build/templates.js'],
    standalone: 'Badsender',
  })
    .external(badsenderEditorLibs)
    .transform(
      babelify.configure({
        presets: ['@babel/preset-env'],
        // Optional only regex - if any filenames **don't** match this regex
        // then they aren't compiled
        only: [/badsender-/, /packages/],
      })
    )
    .transform(aliasify)
    // Every plugin of the editor loads the full Vue build, vue/dist/vue.common
    // (templates are inline strings, compiled in the browser). A dependency
    // doing `require('vue')` gets the runtime-only build instead (the `main`
    // of the vue package), which bundled a second copy of Vue for
    // vue-virtual-scroller alone. Global, because the aliases in package.json
    // only apply to this package's own files, never to node_modules. A
    // `replacements` regexp rather than an alias: an alias also rewrites
    // `vue/<path>`, which would break every `require('vue/dist/vue.common')`.
    .transform(aliasify, {
      global: true,
      replacements: { '^vue$': 'vue/dist/vue.common' },
    })
    .transform(shim, { global: true })
    // Global, so `process.env.NODE_ENV` is also replaced in node_modules:
    // `vue/dist/vue.common` picks its development or production build on it,
    // and left unreplaced the minified bundle shipped both, running the
    // development one (warnings, devtools hook) in production. The option
    // belongs to browserify's `transform`, not to envify's own settings.
    //
    // The minified bundle is the one the server serves outside development
    // (mosaico-editor.pug), and the deployment runs `gulp build` without
    // `--prod`: so it is production whatever the flag says.
    .transform(
      envify({
        _: 'purge',
        NODE_ENV: debug ? 'development' : 'production',
        BADSENDER: true,
        MOSAICO: false,
      }),
      { global: true }
    );
  // use uglifyify instead of gulp.uglify
  // • when RELEASING ONLY purge wasn't done properly by envify
  //   and gulp.uglify was breaking
  if (!debug) {
    b.transform('uglifyify', {
      global: true,
      sourceMap: false,
    });
  }
  return b;
}

function bundleShareDev(b, done) {
  runPipeline(
    done,
    b.bundle(),
    source('badsender-editor.js'),
    vinylBuffer(),
    gulp.dest(BUILD_DIR)
  );
}

function jsMosaicoDev(done) {
  let b = mosaicoEditor(true);
  if (isWatch) {
    b = watchify(b);
    // a rebuild runs outside any gulp task: nothing to fail but the report
    b.on('update', function () {
      console.log(`bundle ${colors.magenta('editor')} app`);
      bundleShareDev(b, reportError);
    });
  }
  bundleShareDev(b, done);
}

function jsMosaicoProd(done) {
  runPipeline(
    done,
    mosaicoEditor().bundle(),
    source('badsender-editor.min.js'),
    vinylBuffer(),
    $.stripDebug(),
    $.uglify(),
    gulp.dest(BUILD_DIR)
  );
}
const jsEditor = gulp.series(
  templates,
  !isWatch
    ? gulp.parallel(mosaicoBadsenderLib, jsMosaicoDev, jsMosaicoProd)
    : gulp.parallel(mosaicoBadsenderLib, jsMosaicoDev)
);
jsEditor.description = 'Bundle mosaico app, without libraries';

exports['js:mosaico-editor'] = jsEditor;
exports['js:mosaico-editor:badsender-libraries'] = mosaicoBadsenderLib;
exports['js:mosaico'] = gulp.parallel(editorLib, jsEditor);

// ----- MOSAICO'S KNOCKOUT TEMPLATES: see -> /packages/editor/tasks/combineKOTemplates.js

const through = require('through2');
const StringDecoder = require('string_decoder').StringDecoder;
const decoder = new StringDecoder('utf8');

function templates() {
  const templates = [];
  function passThrough(file, encoding, cb) {
    let name = path.basename(file.path);
    name = /^([^.]*)/.exec(name)[1];
    let content = decoder.write(file.contents);
    content = content.replace(/"/g, '\\x22');
    content = content.replace(/(\r\n|\n|\r)/gm, '');
    content = `  templateSystem.addTemplate("${name}", "${content}");`;
    templates.push(content);
    return cb(null);
  }
  function flush(cb) {
    const result = `var templateSystem = require('../src/js/bindings/choose-template.js');
document.addEventListener('DOMContentLoaded', function(event) {
${templates.join('\n')}
});`;
    this.push(
      new Vinyl({
        cwd: './',
        base: './',
        path: 'templates.js',
        contents: Buffer.from(result),
      })
    );
    return cb();
  }
  return (
    gulp
      .src([
        'packages/editor/src/tmpl/*.html',
        // replace some original templates by custome ones
        'packages/editor/src/tmpl-badsender/*.html',
        // the gallery grid is a Vue panel now (vue/galleryPlugin.js)
        '!packages/editor/src/tmpl/gallery-images.tmpl.html',
        '!packages/editor/src/tmpl/toolbox.tmpl.html',
      ])
      .pipe(through.obj(passThrough, flush))
      // templates has to be build on "build" folder
      // they will be require by editor app application
      .pipe(gulp.dest('packages/editor/build'))
  );
}
templates.description = 'Bundle mosaico templates';
exports['js:mosaico:templates'] = templates;

// ----- ALL JS

const js = jsEditor;
js.description = 'build js for mosaico app';

/// /////
// ASSETS
/// /////

// ----- FONTS

function fonts() {
  return gulp
    .src('node_modules/font-awesome/fonts/*')
    .pipe(gulp.dest('public/fa/fonts'));
}

const assets = fonts;
assets.description = 'Copy font-awesome in the right place';

// ----- MAINTENANCE

const MAINTENANCE_SRC = 'packages/server/html-templates/maintenance-pages';
const MAINTENANCE_DIST = 'build/maintenance-pages';

const cleanMaintenance = (cb) => del([`${MAINTENANCE_DIST}/*.html`], cb);

function maintenance() {
  return gulp
    .src([`${MAINTENANCE_SRC}/*.pug`, `!${MAINTENANCE_SRC}/_maintenance-*.pug`])
    .pipe($.pug())
    .pipe(gulp.dest(MAINTENANCE_DIST));
}
maintenance.description = 'build maintenance pages for Heroku';

// ----- REVS

const crypto = require('crypto');

function rev() {
  const revs = [];
  function sortByName(a, b) {
    const nameA = a.name.toUpperCase();
    const nameB = b.name.toUpperCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  }
  function passThrough(file, enc, callback) {
    const key = path.relative(file.base, file.path);
    const md5 = crypto.createHash('md5');
    if (!file.contents) return callback(null);
    const hash = md5.update(file.contents.toString()).digest('hex');
    revs.push({ name: '/' + key, hash });
    callback(null);
  }
  function flush(cb) {
    const md5Object = {};
    // keep the json in alphabetical order
    revs.sort(sortByName).forEach((r) => {
      md5Object[r.name] = r.hash;
    });
    const file = new Vinyl({
      path: 'md5public.json',
      contents: Buffer.from(JSON.stringify(md5Object, null, '   ')),
    });
    this.push(file);
    cb();
  }

  return gulp
    .src([`${BUILD_DIR}/**/*.*`, 'public/**/*.*', '!public/lang/*.*'])
    .pipe(through.obj(passThrough, flush))
    .pipe(gulp.dest(SERVER_DIR));
}
rev.description =
  "generate hash from mosaico's build files. This will help us to leverage browser caching";

/// /////
// DEV
/// /////

const cleanAll = (cb) => del([BUILD_DIR, 'build'], cb);
const build = gulp.series(
  cleanAll,
  gulp.parallel(editorLib, js, css, assets),
  rev
);
build.description = 'rebuild all assets';

function watchNonBrowserifyMosaicoAssets(done) {
  gulp.watch(['packages/editor/src/css/**/*.less'], css);
  gulp.watch(
    [
      'packages/editor/src/tmpl/*.html',
      'packages/editor/src/tmpl-badsender/*.html',
    ],
    templates
  );
  done();
}

gulp.task('css', css);
gulp.task('js', js);
gulp.task('assets', assets);
gulp.task('rev', rev);
gulp.task('templates', templates);
gulp.task('build', build);
gulp.task('maintenance', gulp.series(cleanMaintenance, maintenance));
gulp.task('dev', gulp.series(build, watchNonBrowserifyMosaicoAssets));
gulp.task('bump', bump);
