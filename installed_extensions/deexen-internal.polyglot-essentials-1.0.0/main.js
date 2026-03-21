const deexen = require('deexen');
const { exec } = require('child_process');

function runCommand(cmd, label) {
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            deexen.window.showErrorMessage(`${label} Error: ${error.message}`);
            return;
        }
        deexen.window.showInformationMessage(`${label}: ${stdout.trim()}`);
    });
}

function activate(context) {
    console.log('Polyglot extension activated');

    context.subscriptions.push(deexen.commands.registerCommand('polyglot.python.info', () => {
        runCommand('python --version', 'Python');
    }));

    context.subscriptions.push(deexen.commands.registerCommand('polyglot.node.info', () => {
        runCommand('node --version', 'Node.js');
    }));

    context.subscriptions.push(deexen.commands.registerCommand('polyglot.java.info', () => {
        runCommand('java -version', 'Java');
    }));

    context.subscriptions.push(deexen.commands.registerCommand('polyglot.html.preview', () => {
        deexen.window.showInformationMessage('HTML Preview command triggered (Preview UI to be implemented)');
    }));
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
}
