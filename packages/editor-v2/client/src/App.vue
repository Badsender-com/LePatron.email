<template>
  <div class="h-screen flex flex-col">
    <!-- Header -->
    <header class="bg-gray-800 text-white p-4 flex items-center justify-between">
      <h1 class="text-xl font-bold">LePatron.email - Éditeur v2 POC</h1>
      <div class="text-sm text-gray-300">
        Design System: <span class="font-semibold">Demo</span>
      </div>
    </header>

    <!-- Main Layout -->
    <main class="flex-1 flex overflow-hidden">
      <!-- Left Sidebar: Component Library -->
      <div class="w-64 bg-gray-100 p-4 border-r overflow-y-auto">
        <h2 class="font-bold text-lg mb-4">Composants</h2>
        <div class="space-y-2">
          <div class="p-3 bg-white rounded border cursor-pointer hover:border-blue-500 transition">
            <div class="flex items-center gap-2">
              <span class="text-2xl">🔘</span>
              <div>
                <div class="font-medium">Bouton</div>
                <div class="text-xs text-gray-500">core</div>
              </div>
            </div>
          </div>
          <div class="p-3 bg-white rounded border cursor-pointer hover:border-blue-500 transition">
            <div class="flex items-center gap-2">
              <span class="text-2xl">📝</span>
              <div>
                <div class="font-medium">Titre</div>
                <div class="text-xs text-gray-500">core</div>
              </div>
            </div>
          </div>
          <div class="p-3 bg-white rounded border cursor-pointer hover:border-blue-500 transition">
            <div class="flex items-center gap-2">
              <span class="text-2xl">📦</span>
              <div>
                <div class="font-medium">Conteneur</div>
                <div class="text-xs text-gray-500">core</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Center: Canvas -->
      <div class="flex-1 p-6 overflow-y-auto">
        <h2 class="font-bold text-lg mb-4">Canvas</h2>
        <div class="bg-white rounded-lg border-2 border-dashed border-gray-300 p-8 text-center text-gray-400">
          <p>Glissez un composant ici</p>
          <p class="text-sm mt-2">(Drag & drop à venir)</p>
        </div>
      </div>

      <!-- Right Sidebar: Config Panel -->
      <div class="w-80 bg-gray-50 p-4 border-l overflow-y-auto">
        <h2 class="font-bold text-lg mb-4">Configuration</h2>
        <div class="text-center text-gray-400 py-8">
          <p>Sélectionnez un composant</p>
          <p class="text-sm mt-2">pour voir ses options</p>
        </div>
      </div>
    </main>

    <!-- Footer / Status Bar -->
    <footer class="bg-gray-100 border-t px-4 py-2 text-sm text-gray-600 flex justify-between">
      <div>
        POC Éditeur v2 - Phase 1 Jour 2
      </div>
      <div>
        Backend API: <span class="text-green-600 font-semibold">✓ Connected</span>
      </div>
    </footer>
  </div>
</template>

<script setup>
// POC structure basique
// Les composants seront ajoutés dans les phases suivantes
</script>
