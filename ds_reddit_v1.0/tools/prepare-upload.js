#!/usr/bin/env node

/**
 * prepare-upload.js
 *
 * Reads .geojson shape files from a folder and copies them to your clipboard
 * as a JSON payload ready to paste into the Daily Shapes upload form on Reddit.
 *
 * Usage:
 *   node prepare-upload.js <folder-path>
 *   node prepare-upload.js C:\Users\benka\Documents\Daily Shapes\shapes
 *
 * File naming: YYMMDD-01.geojson, YYMMDD-02.geojson, YYMMDD-03.geojson
 *
 * The script will:
 *   1. Scan the folder for matching .geojson files
 *   2. Group them by day key (YYMMDD)
 *   3. Validate each file is valid GeoJSON
 *   4. Package them into a JSON payload
 *   5. Copy to clipboard (or save to a .txt file if clipboard fails)
 *
 * Then go to your subreddit, use the "Upload Shapes (Daily Shapes)" menu action,
 * and paste the payload into the form.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================
// Parse args
// ============================================================

const args = process.argv.slice(2);
if (args.length === 0) {
    console.log('Usage: node prepare-upload.js <folder-path> [--max-days N]');
    console.log('');
    console.log('Examples:');
    console.log('  node prepare-upload.js ./shapes');
    console.log('  node prepare-upload.js "C:\\Users\\benka\\Documents\\Daily Shapes\\shapes"');
    console.log('  node prepare-upload.js ./shapes --max-days 5');
    console.log('');
    console.log('Reads YYMMDD-01.geojson files and prepares them for the Reddit upload form.');
    process.exit(1);
}

const folderPath = args[0];
let maxDays = 7; // Default: 7 days per batch to keep payload size reasonable

const maxDaysIdx = args.indexOf('--max-days');
if (maxDaysIdx !== -1 && args[maxDaysIdx + 1]) {
    maxDays = parseInt(args[maxDaysIdx + 1], 10);
}

if (!fs.existsSync(folderPath)) {
    console.error(`Error: Folder not found: ${folderPath}`);
    process.exit(1);
}

// ============================================================
// Scan for .geojson files
// ============================================================

const filePattern = /^(\d{6})-0?(\d)\.(geojson|json)$/i;
const entries = fs.readdirSync(folderPath);

const shapes = {}; // dayKey -> { 0: content, 1: content, 2: content }
let fileCount = 0;
let errorCount = 0;

for (const filename of entries) {
    const match = filename.match(filePattern);
    if (!match) continue;

    const dayKey = match[1];
    const shapeIndex = parseInt(match[2], 10) - 1; // Convert to 0-based

    if (shapeIndex < 0 || shapeIndex > 2) {
        console.warn(`  Skipped ${filename} - shape index out of range (1-3)`);
        continue;
    }

    const filePath = path.join(folderPath, filename);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Validate JSON
    try {
        const parsed = JSON.parse(content);
        if (!parsed.features && !parsed.type) {
            console.warn(`  Warning: ${filename} - no 'features' or 'type' property`);
            errorCount++;
            continue;
        }
    } catch (e) {
        console.warn(`  Error: ${filename} - invalid JSON: ${e.message}`);
        errorCount++;
        continue;
    }

    if (!shapes[dayKey]) shapes[dayKey] = {};
    shapes[dayKey][shapeIndex] = content;
    fileCount++;
}

// ============================================================
// Report what was found
// ============================================================

const dayKeys = Object.keys(shapes).sort();

if (dayKeys.length === 0) {
    console.log('No valid shape files found.');
    console.log(`Looked in: ${folderPath}`);
    console.log('Expected format: YYMMDD-01.geojson, YYMMDD-02.geojson, YYMMDD-03.geojson');
    process.exit(1);
}

console.log(`Found ${fileCount} shape files across ${dayKeys.length} days:`);
for (const dk of dayKeys) {
    const indices = Object.keys(shapes[dk]).sort();
    const complete = indices.length === 3 ? 'complete' : `${indices.length}/3`;
    console.log(`  ${dk}: shapes ${indices.map(i => parseInt(i) + 1).join(', ')} (${complete})`);
}
if (errorCount > 0) {
    console.log(`  ${errorCount} file(s) skipped due to errors`);
}

// ============================================================
// Build batches
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

console.log('');

if (batches.length === 1) {
    // Single batch - copy to clipboard
    const payload = JSON.stringify(batches[0]);
    const outputFile = path.join(folderPath, '_upload-payload.txt');

    try {
        // Try clipboard (Windows)
        if (process.platform === 'win32') {
            execSync('clip', { input: payload });
            console.log(`Copied to clipboard! (${(payload.length / 1024).toFixed(1)} KB)`);
            console.log('');
            console.log('Next steps:');
            console.log('  1. Go to your subreddit on Reddit');
            console.log('  2. Three-dot menu > "Upload Shapes (Daily Shapes)"');
            console.log('  3. Paste into the text field');
            console.log('  4. Submit');
        } else {
            // Fallback: save to file
            fs.writeFileSync(outputFile, payload);
            console.log(`Saved to: ${outputFile} (${(payload.length / 1024).toFixed(1)} KB)`);
            console.log('Copy the contents and paste into the upload form.');
        }
    } catch (e) {
        // Fallback: save to file
        fs.writeFileSync(outputFile, payload);
        console.log(`Saved to: ${outputFile} (${(payload.length / 1024).toFixed(1)} KB)`);
        console.log('Copy the contents and paste into the upload form.');
    }
} else {
    // Multiple batches
    console.log(`Shapes split into ${batches.length} batches (${maxDays} days each):`);
    for (let b = 0; b < batches.length; b++) {
        const payload = JSON.stringify(batches[b]);
        const batchDays = Object.keys(batches[b]).sort();
        const outputFile = path.join(folderPath, `_upload-batch-${b + 1}.txt`);
        fs.writeFileSync(outputFile, payload);
        console.log(`  Batch ${b + 1}: days ${batchDays[0]}-${batchDays[batchDays.length - 1]} -> ${outputFile} (${(payload.length / 1024).toFixed(1)} KB)`);
    }
    console.log('');
    console.log('Paste each batch file into the upload form one at a time.');
}
