import * as vscode from 'vscode';
import * as fs from 'fs';
import * as tmp from 'tmp';
import * as child from 'child_process';
import path = require('path');

export function activate(context: vscode.ExtensionContext) {

	console.log('Activating "cppinsights-vscode"');


	registerCommands(context);
}

/**
 * Register all commands
 */
function registerCommands(context: vscode.ExtensionContext) {
	vscode.commands.registerTextEditorCommand('cppinsights-vscode.insights', () => {
		executeInsights();
	});

	vscode.commands.registerTextEditorCommand('cppinsights-vscode.insightsDiff', () => {
		executeInsights(true);
	});
	// TODO format, diff as parameter to command instead of extra commands, no-build-dir

	// TODO check register result
}

/**
 * Create the skeleton insights command from the configuration
 */
function createExecutableBase(config: vscode.WorkspaceConfiguration, cmake_build_dir: string | undefined): { path: string, args: (string)[] } {

	let build_dir = cmake_build_dir || config.get('buildDirectory');

	if (!config.get('path')) {
		vscode.window.showErrorMessage('Missing value for cppinsights-vscode.path');
		throw vscode.CancellationError;
	}

	let args: string[] = [];
	if (build_dir)
		args.push("-p=\"" + build_dir + "\"");

	if (config.get<string[]>('args')) {
		args.push("--");
		args = [...args, ...config.get<string[]>('args')!];
	}

	return {
		path: config.get('path')!, args: args
	};
}

/**
 * Execute insights command
 */
function executeInsights(show_diff: boolean = false) {
	let configuration = vscode.workspace.getConfiguration('cppinsights-vscode');

	// TODO on save
	// TODO formatter use configured settings

	// TODO Impl as TextDocumentProvider
	// TODO QuickDiffProvider?
	// TODO Support unsaved docs: vscode.window.activeTextEditor?.document.getText()
	// TODO inhibit insights command exec when no editor active via enablement


	let input_editor = vscode.window.activeTextEditor;
	if (input_editor && !input_editor.document.isUntitled && input_editor.document.fileName) {
		let input_document = input_editor!.document;

		// TODO improve condition for cmake usage... getWorkspaceFolder b/c default is ${workspaceFolder}/build
		let insights_command = createExecutableBase(configuration, vscode.workspace.getWorkspaceFolder(input_document.uri) ? vscode.workspace.getConfiguration('cmake').get('buildDirectory') : undefined);
		insights_command.args = [input_document.fileName!, ...insights_command.args];

		console.log("Executing " + JSON.stringify(insights_command));

		// TODO code variables are probably not resloved, use vscode Task interface
		// TODO use execFile or sth else which allows for passing args as string[]
		const exec_command = insights_command.path + ' ' + insights_command.args.join(' ');
		child.exec(exec_command, (error: child.ExecException | null, stdout: string, stderr: string) => {
			if (error) {
				vscode.window.showErrorMessage('insights failed:\n' + exec_command + '\n' + stderr + '\n' + stdout);
				console.error(error);
				console.error(stderr);
				return;
			}

			// store output in temporary as workaround for annoying save dialog on close
			tmp.file({ prefix: path.basename(input_document.fileName), postfix: '.cpp', keep: false }, function (err: string, output_path: string) {
				if (err) {
					vscode.window.showErrorMessage('Failed to create temporary file (' + err + ')');
					return;
				}
				fs.writeFileSync(output_path, stdout);

				let output_uri = vscode.Uri.file(output_path);

				// was { language: vscode.window.activeTextEditor?.document.languageId, content: stdout }
				vscode.workspace.openTextDocument(output_uri).then((output_document) => {

					format(output_document.uri);

					if (!configuration.get("diff") && !show_diff) {
						vscode.window.showTextDocument(output_document, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true, preview: true }).then((editor: vscode.TextEditor) => {
						});
					}
					else {
						diff(input_document.uri, output_document.uri)
					}
				});
			});
		});

	} else {
		// TODO improve
		vscode.window.showWarningMessage('Currencly cannot process unsaved files');
	}
}

function format(uri: vscode.Uri) {
	console.log("Formatting document")

	// TODO read format options form settings
	vscode.commands.executeCommand('vscode.executeFormatDocumentProvider', uri, { tabSize: 4, insertSpaces: false }).then((textEdits) => {
		const edits = textEdits as vscode.TextEdit[] || undefined;
		if (edits) {
			const edit = new vscode.WorkspaceEdit();
			for (const textEdit of edits) {
				edit.replace(uri, textEdit.range, textEdit.newText);
			}
			vscode.workspace.applyEdit(edit); // TODO need to save document after application of all async edits, to get rid of save dialog
		}
	}, (rejection_reason) => {
		console.log(rejection_reason);
	});
}

function diff(uri: vscode.Uri, uri2: vscode.Uri) {

	vscode.commands.executeCommand('vscode.diff', uri, uri2).then((textEdits) => {

	}, (rejection_reason) => {
		console.log(rejection_reason);
	});
}

export function deactivate() {
	console.log("Goodbye 👋");
}
