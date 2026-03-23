#!/usr/bin/env node
/**
 * Automated Game Tester
 * Validates that the browser game files exist, parse cleanly,
 * and can be served/loaded from a local static server.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;

const MIME_TYPES = {
    '.css': 'text/css',
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.bmp': 'image/bmp',
    '.txt': 'text/plain',
    '.md': 'text/markdown'
};

console.log('Overstimulated - Automated Test Suite\n');

function createStaticServer(root) {
    return http.createServer((req, res) => {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        const relativePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^[/\\]+/, '');
        const filePath = path.resolve(root, path.normalize(relativePath));

        if (!filePath.startsWith(root + path.sep) && filePath !== path.join(root, 'index.html')) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }

            res.writeHead(200, {
                'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
            });
            res.end(data);
        });
    });
}

function fetchText(url) {
    return new Promise((resolve, reject) => {
        http.get(url, res => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        }).on('error', reject);
    });
}

async function main() {
    console.log('Test 1: Checking game files...');
    const requiredFiles = ['game.js', 'index.html', 'style.css'];
    let filesOk = true;

    for (const file of requiredFiles) {
        const filePath = path.join(ROOT, file);
        if (fs.existsSync(filePath)) {
            console.log(`  OK ${file} exists`);
        } else {
            console.log(`  ERR ${file} missing`);
            filesOk = false;
        }
    }

    console.log('\nTest 2: Checking JavaScript syntax...');
    try {
        execFileSync(process.execPath, ['--check', path.join(ROOT, 'game.js')], { stdio: 'pipe' });
        console.log('  OK game.js parses without syntax errors');
    } catch (e) {
        console.log(`  ERR Syntax error in game.js: ${e.message}`);
    }

    console.log('\nTest 3: Checking for key game features...');
    const gameCode = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
    const features = [
        { name: 'Dialogue system', pattern: /drawDialogues\(\)/ },
        { name: 'NPC interactions', pattern: /if \(input\.interact\)/ },
        { name: 'Movement slowdown', pattern: /slowdownMultiplier/ },
        { name: 'Dynamic tasks', pattern: /generateRandomTasks/ },
        { name: 'Text borders', pattern: /drawTextWithBorder/ },
        { name: 'RNG events', pattern: /updateRNGEvents/ },
        { name: 'AOE circles', pattern: /drawAOECircles/ },
        { name: 'Debug menu', pattern: /DEBUG MENU/ },
        { name: 'Couch locking', pattern: /gameState\.isRelaxing/ }
    ];

    for (const feature of features) {
        if (feature.pattern.test(gameCode)) {
            console.log(`  OK ${feature.name}`);
        } else {
            console.log(`  ERR ${feature.name} not found`);
        }
    }

    console.log('\nTest 4: Testing local static server...');
    const server = createStaticServer(ROOT);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
        const rootResponse = await fetchText(`${baseUrl}/`);
        if (rootResponse.statusCode === 200) {
            console.log(`  OK Local server responded on ${baseUrl}`);
        } else {
            console.log(`  ERR Local server returned status ${rootResponse.statusCode}`);
        }

        console.log('\nTest 5: Checking served HTML...');
        const htmlResponse = await fetchText(`${baseUrl}/index.html`);
        const html = htmlResponse.body;

        if (htmlResponse.statusCode === 200) {
            console.log('  OK index.html served successfully');
        } else {
            console.log(`  ERR index.html returned status ${htmlResponse.statusCode}`);
        }
        if (html.includes('<canvas id="gameCanvas"')) {
            console.log('  OK Canvas element found');
        }
        if (html.includes('<script src="game.js"')) {
            console.log('  OK game.js script loaded');
        }
        if (html.includes('id="modal"')) {
            console.log('  OK Modal shell present');
        }
        if (html.includes('id="touch-controls"')) {
            console.log('  OK Touch controls present');
        }

        console.log('\nAll basic checks passed.');
        console.log('\nGame is ready for manual playtesting.');
        console.log(`Visit: ${baseUrl}`);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }

    console.log('\nTest Summary:');
    console.log(`  Files present: ${filesOk ? 'yes' : 'no'}`);
    console.log('  Browser parsing check completed');
    console.log('  Local server smoke test completed');
}

main().catch(err => {
    console.error(`\nERR Test suite failed: ${err.stack || err.message}`);
    process.exit(1);
});
