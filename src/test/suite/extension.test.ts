import * as assert from 'assert';
import * as child from 'child_process';
import * as tmp from 'tmp';
import * as path from 'path';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as ins from '../../extension';
import { EIDRM } from 'constants';

export function getCppFile(): vscode.Uri {
	const configuration = vscode.workspace.getConfiguration('vscode-cppinsights');
	const doc = vscode.workspace.textDocuments.find((doc) => {
		return doc.fileName.endsWith("cpp");
	});
	return doc!.uri;
}

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Execute command', () => {
		return vscode.commands.executeCommand('vscode-cppinsights.insights').then(() => {
			console.log("Command success");
		}, (rejection_reason) => {
			assert.fail("Unable to run command");
		});
	});

	test('Run executable', () => {
		const configuration = vscode.workspace.getConfiguration('vscode-cppinsights');
		const uri = getCppFile();

		const insights_command = ins.createCall(configuration, undefined, uri.path, undefined);

		const exec_command = ins.callToString(insights_command);
		return child.exec(exec_command, (error: child.ExecException | null, stdout: string, stderr: string) => {
			if (error) {
				assert.fail("Unable to run insights");
			}
		});
	});

	test('Run executable tmp path', () => {
		const configuration = vscode.workspace.getConfiguration('vscode-cppinsights');
		const uri = getCppFile();

		tmp.file({ prefix: path.basename("test"), postfix: '.cpp', keep: false, discardDescriptor: true }, function (err, output_path) {
			const insights_command = ins.createCall(configuration, undefined, uri.path, output_path);

			const exec_command = ins.callToString(insights_command);
			return child.exec(exec_command, (error: child.ExecException | null, stdout: string, stderr: string) => {
				if (error) {
					assert.fail("Unable to run insights");
				}
			});
		});
	});

});
