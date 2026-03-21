import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';

export async function pack(args: any) {
    const cwd = process.cwd();
    const manifestPath = path.join(cwd, 'extension.json');

    if (!fs.existsSync(manifestPath)) {
        console.error('Error: extension.json not found in current directory.');
        process.exit(1);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const outputName = `${manifest.name}-${manifest.version}.dex`;
    const outputPath = path.join(cwd, outputName);

    console.log(`Packaging extension: ${manifest.name} version ${manifest.version}...`);

    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
        console.log(`Extension packaged successfully: ${outputName} (${archive.pointer()} bytes)`);
    });

    archive.on('error', (err: any) => {
        throw err;
    });

    archive.pipe(output);

    // Append manifest
    archive.file(manifestPath, { name: 'extension.json' });

    // Append main entry file
    if (manifest.main) {
        archive.file(path.join(cwd, manifest.main), { name: manifest.main });
    }

    // Append README
    const readmeCandidates = ['README.md', 'readme.md', 'README.txt'];
    for (const file of readmeCandidates) {
        if (fs.existsSync(path.join(cwd, file))) {
            archive.file(path.join(cwd, file), { name: file });
            break;
        }
    }

    // TODO: Respect .vscodeignore or .gitignore

    await archive.finalize();
}
