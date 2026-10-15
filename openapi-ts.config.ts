import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  // Synced from the upstream API spec by CI. Do not edit by hand.
  input: './openapi/openapi.json',
  output: './src/client',
  plugins: [
    '@hey-api/client-fetch',
    '@hey-api/typescript',
    '@hey-api/sdk',
  ],
});
