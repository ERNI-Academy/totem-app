import {defineConfig} from '@playwright/test';
import {loadEnvFile} from 'node:process';
loadEnvFile('totem-backoffice/.env.local');
export default defineConfig({testDir:'.',timeout:120000,workers:1,reporter:'list',use:{actionTimeout:15000,baseURL:process.env.TOTEM_TEST_URL||'http://localhost:3000',headless:true,viewport:{width:1600,height:1100},launchOptions:{args:['--no-sandbox','--enable-unsafe-swiftshader']},screenshot:'only-on-failure'},outputDir:'test-results/backoffice'});
