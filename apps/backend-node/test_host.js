const path = require('path');
const { ExtensionHostService } = require('./dist/terminal/extension-host.service');

async function main() {
    console.log("Starting script.");
    // Use the absolute path
    const extractedPluginsDir = path.resolve('C:\\Users\\aggam\\Documents\\deexen\\project_1\\experimental\\apps\\backend\\storage\\plugins\\extracted');
    const host = new ExtensionHostService();
    await host.onModuleInit();

    const commands = host.getRegisteredCommands();
    console.log("Registered commands:", commands);

    console.log('Detected Run Command for .py:', host.getRunCommandForExtension('.py'));
    console.log('Detected Run Command for .go:', host.getRunCommandForExtension('.go'));

    // Check if python.execInTerminal is registered
    if (commands.includes('python.execInTerminal')) {
        console.log("SUCCESS: Python extension commands successfully loaded via Mock.");
    } else {
        console.log("FAILURE: Python extension commands not found.");
    }
}

main().catch(console.error);
