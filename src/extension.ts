import * as vscode from 'vscode';
import * as fs from 'fs';
import * as tmp from 'tmp';
import * as child from 'child_process';
import path = require('path');

export function activate(context: vscode.ExtensionContext) {

	console.log('Activating "vscode-cppinsights"');


	registerCommands(context);
}

/**
 * Register all commands
 */
function registerCommands(context: vscode.ExtensionContext) {
	vscode.commands.registerTextEditorCommand('vscode-cppinsights.insights', () => {
		executeInsights();
	});

	vscode.commands.registerTextEditorCommand('vscode-cppinsights.insightsDiff', () => {
		executeInsights(true);
	});
	// TODO format, diff as parameter to command instead of extra commands, no-build-dir
}

/**
 * Create the skeleton insights command from the configuration
 */
export function createCall(config: vscode.WorkspaceConfiguration, cmake_build_dir: string | undefined, filePath: string): { path: string, args: (string)[] } {
	let build_dir = cmake_build_dir || config.get('buildDirectory');

	if (!config.get('path')) {
		vscode.window.showErrorMessage('Missing value for vscode-cppinsights.path');
		throw vscode.CancellationError;
	}

	let args: string[] = [filePath];
	if (build_dir && build_dir.length > 0)
		args.push("-p=\"" + build_dir + "\"");

	if (config.get<string[]>('args')) {
		args.push("--");
		args = [...args, ...config.get<string[]>('args')!];
	}

	return {
		path: config.get('path')!, args: args
	};
}

export function callToString(insights_call: { path: string, args: (string)[] }): string {
	return insights_call.path + ' ' + insights_call.args.join(' ');
}

/**
 * Execute insights command
 */
function executeInsights(show_diff: boolean = false) {
	// TODO on save

	// TODO Impl as TextDocumentProvider
	// TODO QuickDiffProvider?
	// TODO inhibit insights command exec when no editor active via enablement


	const input_editor = vscode.window.activeTextEditor;

	if (input_editor) {
		const options = input_editor!.options;
		const input_document = input_editor!.document;

		if (input_editor.document.isUntitled || input_editor.document.isDirty) {
			tmp.file({ prefix: path.basename("untitled"), postfix: '.cpp', keep: false }, function (err: string, input_path: string) {
				fs.writeFileSync(input_path, input_editor.document.getText());
				executeInsights2(show_diff, input_document, options, input_path);
			});
		}
		else {
			executeInsights2(show_diff, input_document, options, input_document.fileName);
		}
	}
}

function executeInsights2(show_diff: boolean = false, input_document: vscode.TextDocument, options: vscode.TextEditorOptions, input_path: string) {
	let configuration = vscode.workspace.getConfiguration('vscode-cppinsights');


	// TODO improve condition for cmake usage... getWorkspaceFolder b/c default is ${workspaceFolder}/build
	const insights_command = createCall(configuration, vscode.workspace.getWorkspaceFolder(input_document.uri) ? vscode.workspace.getConfiguration('cmake').get('buildDirectory') : undefined, input_path);

	console.log("Executing " + JSON.stringify(insights_command));

	// TODO code variables are probably not resloved, use vscode Task interface
	// TODO use execFile or sth else which allows for passing args as string[]
	const exec_command = callToString(insights_command);
	child.exec(exec_command, (error: child.ExecException | null, stdout: string, stderr: string) => {
		if (error) {
			vscode.window.showErrorMessage('insights failed:\n' + exec_command + '\n' + stderr + '\n' + stdout);
			console.error(error);
			console.error(stderr);
			return;
		}

		// store output in temporary as workaround for annoying save dialog on close
		tmp.file({ prefix: path.basename(input_path), postfix: '.cpp', keep: false }, function (err: string, output_path: string) {
			if (err) {
				vscode.window.showErrorMessage('Failed to create temporary file (' + err + ')');
				return;
			}
			fs.writeFileSync(output_path, stdout);

			let output_uri = vscode.Uri.file(output_path);

			// TODO clarify if formatting requires open TextEditor->visually bad, but seems more reliable
			let formatting = (doc: vscode.TextDocument) => { format(doc, options, configuration.get("experimental") != undefined ? configuration.get("experimental")! : false) };


			// was { language: vscode.window.activeTextEditor?.document.languageId, content: stdout }
			console.log("Openning insights output");
			vscode.workspace.openTextDocument(output_uri).then((output_document) => {
				if (!configuration.get("diff") && !show_diff) {
					show(output_document, formatting, options);
				}
				else {
					diff(input_document, output_document, formatting);
				}

			});
		});
	});
}

function format(doc: vscode.TextDocument, options: vscode.TextEditorOptions, experimental: boolean) {
	let format_options = experimental ? { tabSize: options.tabSize != undefined ? options.tabSize : 4, insertSpaces: options.insertSpaces || false } as vscode.FormattingOptions : { tabSize: 4, insertSpaces: false };
	console.log("Formatting " + doc.uri + ' ' + JSON.stringify(format_options));

	// TODO format options are ignored, only TextEditor options are applied, investigate
	vscode.commands.executeCommand('vscode.executeFormatDocumentProvider', doc.uri, format_options).then((textEdits) => {
		console.log("Format command");
		const edits = textEdits as vscode.TextEdit[] || undefined;
		let jobs: Thenable<boolean>[] = [];
		if (edits) {
			console.log("Applying format");
			const edit = new vscode.WorkspaceEdit();
			for (const textEdit of edits) {
				edit.replace(doc.uri, textEdit.range, textEdit.newText);
			}
			jobs.push(vscode.workspace.applyEdit(edit));
			if (experimental) {
				Promise.all(jobs).then(() => {
					console.log("Saving format");
					doc.save();
				});
			}
		}
		else {
			console.log("No format edits");
		}
	}, (rejection_reason) => {
		console.log("Format command failed");
		console.log(rejection_reason);
	});
}

function show(doc: vscode.TextDocument, format: (doc: vscode.TextDocument) => void, options: vscode.TextEditorOptions) {
	console.log("Showing " + doc.uri);

	// TODO preview gets lost when formatting
	vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true, preview: true }).then((editor) => {
		editor.options = options;
		format(doc);
	});
}

function diff(left: vscode.TextDocument, right: vscode.TextDocument, format: (doc: vscode.TextDocument) => void) {
	console.log("Diffing " + left.uri + ' - ' + right.uri);

	vscode.commands.executeCommand('vscode.diff', left.uri, right.uri).then((textEdits) => {
		format(right);
		console.log("Diff command");
	}, (rejection_reason) => {
		console.log(rejection_reason);
	});
}

export function deactivate() {
	console.log("Goodbye 👋");
}
