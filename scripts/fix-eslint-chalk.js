#!/usr/bin/env node

/**
 * Work around a packaging issue where eslint's bundled chalk dependency
 * is missing its source files after install. When the nested directory
 * is empty we mirror the files from the top-level chalk package so that
 * eslint can resolve its formatter without crashing.
 */

const fs = require('node:fs');
const path = require('node:path');

const rootDir = process.cwd();
const rootChalkDir = path.join(rootDir, 'node_modules', 'chalk', 'source');
const eslintChalkDir = path.join(rootDir, 'node_modules', 'eslint', 'node_modules', 'chalk', 'source');

const hasFiles = (dirPath) => {
	try {
		return fs.readdirSync(dirPath).some((entry) => !entry.startsWith('.'));
	} catch (error) {
		return false;
	}
};

const copyDir = (src, dest) => {
	if (!fs.existsSync(dest)) {
		fs.mkdirSync(dest, { recursive: true });
	}

	for (const entry of fs.readdirSync(src)) {
		if (entry.startsWith('.')) continue;
		const srcPath = path.join(src, entry);
		const destPath = path.join(dest, entry);
		const stats = fs.statSync(srcPath);
		if (stats.isDirectory()) {
			copyDir(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
};

if (!fs.existsSync(rootChalkDir) || !fs.existsSync(eslintChalkDir)) {
	process.exit(0);
}

if (!hasFiles(eslintChalkDir) && hasFiles(rootChalkDir)) {
	copyDir(rootChalkDir, eslintChalkDir);
	// eslint-disable-next-line no-console
	console.log('patched eslint chalk dependency');
}
