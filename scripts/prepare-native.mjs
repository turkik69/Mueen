// Recreate binary resources from versioned SVG and Capacitor's pinned template.
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
await mkdir('assets', { recursive: true });
await mkdir('android/gradle/wrapper', { recursive: true });
await writeFile('android/gradle/wrapper/gradle-wrapper.jar', execFileSync('tar', ['-xOf', 'node_modules/@capacitor/cli/assets/android-template.tar.gz', 'gradle/wrapper/gradle-wrapper.jar']));
const icon = await sharp('icon.svg', { density: 288 }).resize(1024, 1024).flatten({ background: '#F7F0EA' }).png().toBuffer();
await writeFile('assets/icon-only.png', icon);
await writeFile('assets/icon-foreground.png', await sharp(icon).resize(640,640).extend({top:192,bottom:192,left:192,right:192,background:'#F7F0EA'}).png().toBuffer());
await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#F7F0EA' } }).png().toFile('assets/icon-background.png');
await sharp({ create: { width: 2732, height: 2732, channels: 3, background: '#F7F0EA' } }).composite([{ input: await sharp(icon).resize(720, 720).toBuffer(), gravity: 'centre' }]).png().toFile('assets/splash.png');
execFileSync('node', ['node_modules/@capacitor/assets/bin/capacitor-assets', 'generate', '--assetPath', 'assets', '--android', '--ios'], { stdio: 'inherit' });
