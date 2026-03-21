const deexen = require('deexen');

/**
 * @param {deexen.ExtensionContext} context
 */
function activate(context) {
    console.log('Congratulations, your extension "hello-world" is now active!');

    let disposable = deexen.commands.registerCommand('hello-world.hello', () => {
        deexen.window.showInformationMessage('Hello from Deexen Extension!');
    });

    context.subscriptions.push(disposable);
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
}
