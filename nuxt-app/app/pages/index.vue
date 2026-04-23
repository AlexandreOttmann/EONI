<script setup lang="ts">
definePageMeta({ layout: 'marketing' })

useSeoMeta({
  title: 'Eoni — Turn any website into an AI-powered storefront',
  description: 'Paste your URL. Our AI crawls your catalog, builds a smart chat widget, and makes your products discoverable by ChatGPT, Perplexity, and Claude.',
  ogTitle: 'Eoni — AI-powered storefronts for every merchant',
  ogDescription: 'Turn any website into an AI-discoverable storefront.',
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <div>
    <MarketingHeroSection />
    <MarketingLogoCloud />
    <MarketingHowItWorks />
    <MarketingFeatureBento />
    <MarketingProductShowcase />
    <MarketingTestimonials />
    <MarketingPricingSection />
    <MarketingCTASection />
    <MarketingFooter />
  </div>
</template>
