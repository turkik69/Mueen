const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({testDir:'./tests',testMatch:'*.spec.cjs',fullyParallel:true,use:{...devices['iPhone 13'],browserName:'chromium'},webServer:{command:'python3 -m http.server 4173 --bind 127.0.0.1',port:4173},reporter:'list'});
