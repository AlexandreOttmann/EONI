<template>
  <!-- Drifting orb layer — below all content -->
  <div
    aria-hidden="true"
    class="dashboard-bg pointer-events-none fixed inset-0 z-0 overflow-hidden"
  >
    <div class="orb orb-violet" />
    <div class="orb orb-cyan" />
    <div class="orb orb-violet-2" />
  </div>

  <!-- Noise grain layer — above orbs, below content -->
  <div
    aria-hidden="true"
    class="noise pointer-events-none fixed inset-[-200%] z-[1] size-[400%] bg-[url('/noise.png')] opacity-[3%]"
  />
</template>
