<template>
  <div
    class="pointer-events-none fixed inset-0 z-50 opacity-[0.035]"
    aria-hidden="true"
    :style="{
      backgroundImage: `url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E&quot;)`,
      backgroundRepeat: 'repeat',
      backgroundSize: '256px 256px',
    }"
  />
</template>
