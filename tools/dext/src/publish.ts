import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import inquirer from 'inquirer';

const DEFAULT_REGISTRY = 'http://localhost:8000';

export async function publish(args: any) {
    const cwd = process.cwd();
    const manifestPath = path.join(cwd, 'extension.json');

    if (!fs.existsSync(manifestPath)) {
        console.error('Error: extension.json not found in current directory.');
        process.exit(1);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const packagePath = path.join(cwd, `${manifest.name}-${manifest.version}.dex`);

    if (!fs.existsSync(packagePath)) {
        console.error(`Error: Package file ${packagePath} not found. Run 'dext package' first.`);
        process.exit(1);
    }

    // In a real CLI, we'd look for a stored token or prompt for login
    // For this POC, we'll prompt for email/password to get a token on the fly
    console.log('Authenticating with Deexen Marketplace...');

    const credentials = await inquirer.prompt([
        { type: 'input', name: 'email', message: 'Email:' },
        { type: 'password', name: 'password', message: 'Password:' }
    ]);

    try {
        // 1. Login
        const loginRes = await axios.post(`${DEFAULT_REGISTRY}/auth/login`, {
            email: credentials.email,
            password: credentials.password
        });

        const token = loginRes.data.access_token;
        console.log('Authentication successful.');
        console.log(`Publishing ${manifest.name}@${manifest.version}...`);

        // 2. Upload
        const form = new FormData();
        form.append('file', fs.createReadStream(packagePath));

        const publishRes = await axios.post(`${DEFAULT_REGISTRY}/marketplace/publish`, form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Successfully published extension!');
        console.log('Registry Response:', publishRes.data);

    } catch (error: any) {
        if (error.response) {
            console.error('Publish Failed:', error.response.status, error.response.data);
        } else {
            console.error('Publish Failed:', error.message);
        }
    }
}
