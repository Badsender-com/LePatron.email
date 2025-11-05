#!/usr/bin/env node
/**
 * Script de test pour Phase 4 - Rendering Service
 * Usage: node test-render.js
 */

const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3200';

// Couleurs pour le terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

async function fetchAPI(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    return await response.json();
  } catch (err) {
    log(`❌ Fetch error: ${err.message}`, 'red');
    return null;
  }
}

async function test1_listComponents() {
  section('Test 1: Liste des composants disponibles');
  log('GET /api/v2/components', 'cyan');

  const data = await fetchAPI(`${API_BASE}/v2/components`);
  if (data && data.success) {
    log(`✅ ${data.count} composants trouvés`, 'green');
    data.components.forEach(comp => {
      console.log(`   ${comp.icon} ${comp.label} (${comp.name})`);
    });
  } else {
    log('❌ Échec', 'red');
  }
}

async function test2_getComponentDetails() {
  section('Test 2: Détails du composant Button');
  log('GET /api/v2/components/button', 'cyan');

  const data = await fetchAPI(`${API_BASE}/v2/components/button`);
  if (data && data.success) {
    log(`✅ Composant chargé: ${data.component.schema.label}`, 'green');
    console.log(`   Propriétés configurables:`, Object.keys(data.component.schema.configurableProperties).join(', '));
  } else {
    log('❌ Échec', 'red');
  }
}

async function test3_renderComponent() {
  section('Test 3: Rendu d\'un composant individuel');
  log('POST /api/v2/render/component', 'cyan');

  const payload = {
    component: 'button',
    props: {
      text: 'Test Button',
      url: 'https://example.com',
      backgroundColor: '#007bff',
      textColor: '#ffffff',
      borderRadius: '8px',
    },
    mode: 'preview',
  };

  const data = await fetchAPI(`${API_BASE}/v2/render/component`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (data && data.success) {
    log(`✅ Composant rendu (${data.html.length} chars)`, 'green');
    console.log('   HTML snippet:', data.html.substring(0, 150) + '...');
  } else {
    log('❌ Échec', 'red');
  }
}

async function test4_renderEmailPreview() {
  section('Test 4: Rendu email complet (mode preview)');
  log('POST /api/v2/render/preview', 'cyan');

  // Charger l'exemple d'email
  const emailPath = path.join(__dirname, 'test-data', 'example-email.json');
  const emailData = JSON.parse(fs.readFileSync(emailPath, 'utf8'));

  log(`   Email: ${emailData.metadata.title}`, 'blue');
  log(`   Blocks: ${emailData.blocks.length}`, 'blue');

  const startTime = Date.now();
  const data = await fetchAPI(`${API_BASE}/v2/render/preview`, {
    method: 'POST',
    body: JSON.stringify(emailData),
  });

  if (data && data.success) {
    const duration = Date.now() - startTime;
    log(`✅ Email rendu en ${duration}ms (renderTime: ${data.renderTime}ms)`, 'green');
    log(`   Cached: ${data.cached ? 'OUI' : 'NON'}`, data.cached ? 'yellow' : 'blue');
    log(`   HTML size: ${data.html.length} chars`, 'blue');

    // Sauvegarder le HTML
    const outputPath = path.join(__dirname, 'test-data', 'output-preview.html');
    fs.writeFileSync(outputPath, data.html);
    log(`   💾 Sauvegardé: ${outputPath}`, 'green');
  } else {
    log('❌ Échec', 'red');
  }
}

async function test5_renderEmailPreviewCached() {
  section('Test 5: Rendu email (test du cache)');
  log('POST /api/v2/render/preview (même email)', 'cyan');

  const emailPath = path.join(__dirname, 'test-data', 'example-email.json');
  const emailData = JSON.parse(fs.readFileSync(emailPath, 'utf8'));

  const startTime = Date.now();
  const data = await fetchAPI(`${API_BASE}/v2/render/preview`, {
    method: 'POST',
    body: JSON.stringify(emailData),
  });

  if (data && data.success) {
    const duration = Date.now() - startTime;
    log(`✅ Email rendu en ${duration}ms (renderTime: ${data.renderTime}ms)`, 'green');
    log(`   Cached: ${data.cached ? 'OUI' : 'NON'}`, data.cached ? 'yellow' : 'blue');

    if (data.cached && data.renderTime < 50) {
      log(`   🎯 Performance cible atteinte (< 50ms)`, 'green');
    } else if (data.cached && data.renderTime < 80) {
      log(`   ✅ Performance acceptable (50-80ms)`, 'yellow');
    } else if (!data.cached && data.renderTime < 200) {
      log(`   ✅ Cold render acceptable (< 200ms)`, 'yellow');
    } else {
      log(`   ⚠️  Performance hors cible`, 'red');
    }
  } else {
    log('❌ Échec', 'red');
  }
}

async function test6_renderEmailExport() {
  section('Test 6: Rendu email (mode export optimisé)');
  log('POST /api/v2/render/export', 'cyan');

  const emailPath = path.join(__dirname, 'test-data', 'example-email.json');
  const emailData = JSON.parse(fs.readFileSync(emailPath, 'utf8'));

  const startTime = Date.now();
  const data = await fetchAPI(`${API_BASE}/v2/render/export`, {
    method: 'POST',
    body: JSON.stringify(emailData),
  });

  if (data && data.success) {
    const duration = Date.now() - startTime;
    log(`✅ Export rendu en ${duration}ms (renderTime: ${data.renderTime}ms)`, 'green');
    log(`   HTML size: ${data.html.length} chars`, 'blue');
    log(`   Optimizations:`, 'blue');
    console.log(`     - Inline CSS: ${data.optimizations.inlineCSS ? '✓' : '✗'}`);
    console.log(`     - Remove unused CSS: ${data.optimizations.removeUnusedCSS ? '✓' : '✗'}`);
    console.log(`     - Minify: ${data.optimizations.minify ? '✓' : '✗'}`);

    // Sauvegarder le HTML
    const outputPath = path.join(__dirname, 'test-data', 'output-export.html');
    fs.writeFileSync(outputPath, data.html);
    log(`   💾 Sauvegardé: ${outputPath}`, 'green');
  } else {
    log('❌ Échec', 'red');
  }
}

async function test7_cacheStatus() {
  section('Test 7: Status du cache');
  log('GET /api/v2/render/status', 'cyan');

  const data = await fetchAPI(`${API_BASE}/v2/render/status`);
  if (data && data.success) {
    log(`✅ Status récupéré`, 'green');
    console.log(`   Cache entries: ${data.cache.total} (${data.cache.valid} valid, ${data.cache.expired} expired)`);
    console.log(`   Templates cached: ${data.cache.templates}`);
    console.log(`   TTL: ${data.cache.ttl}ms (${data.cache.ttl / 1000}s)`);
    console.log(`   Uptime: ${Math.round(data.uptime)}s`);
  } else {
    log('❌ Échec', 'red');
  }
}

async function test8_clearCache() {
  section('Test 8: Vider le cache');
  log('DELETE /api/v2/render/cache', 'cyan');

  const data = await fetchAPI(`${API_BASE}/v2/render/cache`, {
    method: 'DELETE',
  });

  if (data && data.success) {
    log(`✅ Cache vidé (${data.cleared} entrées)`, 'green');
  } else {
    log('❌ Échec', 'red');
  }
}

async function runAllTests() {
  log('\n🧪 Tests Phase 4 - Rendering Service', 'bright');
  log(`API: ${API_BASE}`, 'cyan');

  try {
    await test1_listComponents();
    await test2_getComponentDetails();
    await test3_renderComponent();
    await test4_renderEmailPreview();
    await test5_renderEmailPreviewCached();
    await test6_renderEmailExport();
    await test7_cacheStatus();
    await test8_clearCache();

    section('✅ Tous les tests terminés');
    log('\nFichiers générés:', 'bright');
    log('  - test-data/output-preview.html', 'blue');
    log('  - test-data/output-export.html', 'blue');
    log('\nOuvrez-les dans un navigateur pour voir le résultat !', 'yellow');
  } catch (err) {
    log(`\n❌ Erreur globale: ${err.message}`, 'red');
    console.error(err);
  }
}

// Run tests
runAllTests();
