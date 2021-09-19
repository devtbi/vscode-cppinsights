import * as assert from 'assert';
import * as child from 'child_process';
import * as tmp from 'tmp';
import * as path from 'path';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as ins from '../../extension';

export async function getExtension() {
	const ext = vscode.extensions.getExtension('vscode-cppinsights');
	if (!ext) {
		throw new Error('Extension doesn\'t exist');
	}
	return ext.isActive ? Promise.resolve(ext.exports) : ext.activate();
}

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	// test('Load extension', () => {
	// 	getExtension();
	// });

	test('Execute command', () => {
		return vscode.commands.executeCommand('vscode-cppinsights.insights').then(() => {
			console.log("Command success");
		}, (rejection_reason) => {
			assert.fail("Unable to run command");
		});
	});

	test('Run executable', () => {
		let configuration = vscode.workspace.getConfiguration('vscode-cppinsights');

		let uri = vscode.window.visibleTextEditors[0].document.uri;

		let insights_command = ins.createCall(configuration, undefined, uri.path, undefined);

		const exec_command = ins.callToString(insights_command);
		return child.exec(exec_command, (error: child.ExecException | null, stdout: string, stderr: string) => {
			if (error) {
				assert.fail("Unable to run insights");
			}
		});
	});

	test('Run executable tmp path', () => {
		let configuration = vscode.workspace.getConfiguration('vscode-cppinsights');

		let uri = vscode.window.visibleTextEditors[0].document.uri;

		tmp.file({ prefix: path.basename("test"), postfix: '.cpp', keep: false, discardDescriptor: true }, function (err, output_path) {
			let insights_command = ins.createCall(configuration, undefined, uri.path, output_path);

			const exec_command = ins.callToString(insights_command);
			return child.exec(exec_command, (error: child.ExecException | null, stdout: string, stderr: string) => {
				if (error) {
					assert.fail("Unable to run insights");
				}
			});
		});
	});

});
