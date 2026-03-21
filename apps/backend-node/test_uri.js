const { vscodeMock } = require('./dist/terminal/vscode-mock.js');

try {
    const uri = vscodeMock.Uri.file('/hello/world');
    console.log("URI path is:", uri.fsPath);
    const uri2 = uri.with({ path: '/new/path' });
    console.log("URI with path is:", uri2.fsPath);
} catch (err) {
    console.error(err);
}
