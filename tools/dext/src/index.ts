#!/usr/bin/env node
import { Command } from 'commander';
import { pack } from './package';
import { publish } from './publish';

const program = new Command();

program
    .name('dext')
    .description('Deexen Extension CLI')
    .version('1.0.0');

program.command('package')
    .description('Package the extension into a .dex file')
    .action(pack);

program.command('publish')
    .description('Publish the extension to the marketplace')
    .action(publish);

program.parse(process.argv);
