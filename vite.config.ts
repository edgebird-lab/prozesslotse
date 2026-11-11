/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
    // Modellierung und Compliance-Doku zusammen: Mehrere Prüfungen über 300 Zufallsprozesse laufen gleichzeitig
    // und brauchen unter Last länger als die üblichen 5 s; schwere Tests setzen ihre Grenze weiter selbst.
    testTimeout: 30_000,
  },
})
