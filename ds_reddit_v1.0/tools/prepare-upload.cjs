#!/usr/bin/env node

/**
 * prepare-upload.cjs
 *
 * Reads .geojson shape files from a folder, minifies them, and outputs
 * batch payloads ready to paste into the Daily Shapes upload form on Reddit.
 *
 * Usage:
 *   node tools/prepare-upload.cjs <folder-path>
 *   node tools/prepare-upload.cjs <folder-path> --max-days 3
 *
 * File naming: YYMMDD-01.geojson through YYMMDD-10.geojson
 *
 * The script:
 *   1. Scans the folder for matching .geojson files
 *   2. Minifies each (rounds coords to integers, strips whitespace)
 *   3. Packages into batch JSON payloads (no double-encoding)
 *   4. Copies to clipboard or saves to files
 *
 * Then: subreddit menu > "Upload Shapes (Daily Shapes)" > paste > submit.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================
// Parse args
// ============================================================

const args = process.argv.slice(2);
if (args.length === 0) {
    console.log('Usage: node tools/prepare-upload.cjs <folder-path> [--max-days N]');
    console.log('');
    console.log('Examples:');
    console.log('  node tools/prepare-upload.cjs ./shapes');
    console.log('  node tools/prepare-upload.cjs "G:\\My Drive\\Shapes\\geojson"');
    console.log('  node tools/prepare-upload.cjs ./shapes --max-days 2');
    console.log('');
    console.log('Reads YYMMDD-01.geojson through YYMMDD-10.geojson, minifies, and prepares for Reddit upload.');
    process.exit(1);
}

const folderPath = args[0];
let maxDays = 1; // Default: 1 day per batch (10 shapes per day = ~150-250 KB)

const maxDaysIdx = args.indexOf('--max-days');
if (maxDaysIdx !== -1 && args[maxDaysIdx + 1]) {
    maxDays = parseInt(args[maxDaysIdx + 1], 10);
}

if (!fs.existsSync(folderPath)) {
    console.error(`Error: Folder not found: ${folderPath}`);
    process.exit(1);
}

// ============================================================
// Minify GeoJSON - round coordinates to integers (380x380 canvas)
// ============================================================

function minifyGeoJSON(geojson) {
    // Deep-walk the object and round any coordinate arrays
    function roundCoords(obj) {
        if (Array.isArray(obj)) {
            // If it's a coordinate pair [x, y], round to 1 decimal
            if (obj.length >= 2 && typeof obj[0] === 'number' && typeof obj[1] === 'number') {
                // Check if this looks like a coordinate (not a ring of coordinates)
                if (obj.length <= 3 && !Array.isArray(obj[0])) {
                    return obj.map(v => Math.round(v * 10) / 10);
                }
            }
            return obj.map(roundCoords);
        }
        if (obj && typeof obj === 'object') {
            const result = {};
            for (const key of Object.keys(obj)) {
                result[key] = roundCoords(obj[key]);
            }
            return result;
        }
        return obj;
    }

    return roundCoords(geojson);
}

// ============================================================
// Scan for .geojson files
// ============================================================

const filePattern = /^(\d{6})-0?(\d{1,2})\.(geojson|json)$/i;
const entries = fs.readdirSync(folderPath);

const shapes = {}; // dayKey -> [geojsonObj0, ..., geojsonObj9]
let fileCount = 0;
let errorCount = 0;
let originalSize = 0;

for (const filename of entries) {
    const match = filename.match(filePattern);
    if (!match) continue;

    const dayKey = match[1];
    const shapeIndex = parseInt(match[2], 10) - 1; // 0-based

    if (shapeIndex < 0 || shapeIndex > 9) {
        console.warn(`  Skipped ${filename} - shape index out of range (1-10)`);
        continue;
    }

    const filePath = path.join(folderPath, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    originalSize += content.length;

    try {
        const parsed = JSON.parse(content);
        if (!parsed.features && !parsed.type) {
            console.warn(`  Warning: ${filename} - no 'features' or 'type' property`);
            errorCount++;
            continue;
        }

        // Minify: round coordinates, will be serialized without whitespace
        const minified = minifyGeoJSON(parsed);

        if (!shapes[dayKey]) shapes[dayKey] = Array(10).fill(null);
        shapes[dayKey][shapeIndex] = minified;
        fileCount++;
    } catch (e) {
        console.warn(`  Error: ${filename} - invalid JSON: ${e.message}`);
        errorCount++;
    }
}

// ============================================================
// Report
// ============================================================

const dayKeys = Object.keys(shapes).sort();

if (dayKeys.length === 0) {
    console.log('No valid shape files found.');
    console.log(`Looked in: ${folderPath}`);
    console.log('Expected format: YYMMDD-01.geojson through YYMMDD-10.geojson');
    process.exit(1);
}

console.log(`Found ${fileCount} shapes across ${dayKeys.length} days.`);
if (errorCount > 0) console.log(`  ${errorCount} file(s) skipped due to errors.`);

// ============================================================
// Build batches - store GeoJSON objects directly (no double-encoding)
// Batch format: { "YYMMDD": [geojson0, ..., geojson9], ... }
// ============================================================

const batches = [];
for (let i = 0; i < dayKeys.length; i += maxDays) {
    const batchDays = dayKeys.slice(i, i + maxDays);
    const batch = {};
    for (const dk of batchDays) {
        batch[dk] = shapes[dk];
    }
    batches.push(batch);
}

let totalMinified = 0;
console.log('');

if (batches.length === 1) {
    const payload = JSON.stringify(batches[0]);
    totalMinified = payload.length;

    try {
        if (process.platform === 'win32') {
            execSync('clip', { input: payload });
            console.log(`Copied to clipboard! (${(payload.length / 1024).toFixed(1)} KB)`);
        } else {
            const outputFile = path.join(folderPath, '_upload-payload.txt');
            fs.writeFileSync(outputFile, payload);
            console.log(`Saved to: ${outputFile} (${(payload.length / 1024).toFixed(1)} KB)`);
        }
    } catch (e) {
        const outputFile = path.join(folderPath, '_upload-payload.txt');
        fs.writeFileSync(outputFile, payload);
        console.log(`Saved to: ${outputFile} (${(payload.length / 1024).toFixed(1)} KB)`);
    }

    console.log('');
    console.log('Next steps:');
    console.log('  1. Go to your subreddit on Reddit');
    console.log('  2. Three-dot menu > "Upload Shapes (Daily Shapes)"');
    console.log('  3. Paste into the text field and submit');
} else {
    console.log(`Split into ${batches.length} batches (${maxDays} days each):`);
    for (let b = 0; b < batches.length; b++) {
        const payload = JSON.stringify(batches[b]);
        totalMinified += payload.length;
        const batchDays = Object.keys(batches[b]).sort();
        const outputFile = path.join(folderPath, `_upload-batch-${b + 1}.txt`);
        fs.writeFileSync(outputFile, payload);
        console.log(`  Batch ${b + 1}: days ${batchDays[0]}-${batchDays[batchDays.length - 1]} (${(payload.length / 1024).toFixed(1)} KB) -> ${outputFile}`);
    }
    console.log('');
    console.log('Paste each batch into the upload form one at a time.');
}

console.log('');
console.log(`Size: ${(originalSize / 1024).toFixed(0)} KB original -> ${(totalMinified / 1024).toFixed(0)} KB minified (${Math.round((1 - totalMinified / originalSize) * 100)}% reduction)`);
