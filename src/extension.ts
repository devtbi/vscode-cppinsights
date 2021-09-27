import * as vscode from 'vscode';
import * as fs from 'fs';
import * as tmp from 'tmp';
import path = require('path');

const taskSource = "C++ insights";

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
export function createCall(config: vscode.WorkspaceConfiguration, cmake_build_dir: string | undefined, filePath: string, outputPath: string | undefined): { path: string, args: (string)[] } {
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

	if (outputPath) {
		args.push(">");
		args.push(outputPath);
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

/**
 * Execute insights command
 */
function executeInsights2(show_diff: boolean = false, input_document: vscode.TextDocument, options: vscode.TextEditorOptions, input_path: string) {
	let configuration = vscode.workspace.getConfiguration('vscode-cppinsights');

	// TODO are code variables resolved, e.g. workspaceFolder?

	// discardDescriptor is required, otherwise cmd is not executed b/c file is used by another process
	// TODO maybe delete tmp file
	tmp.file({ prefix: path.basename(input_path), postfix: '.cpp', keep: false, discardDescriptor: true }, function (err, output_path) {
		const insights_command = createCall(configuration, vscode.workspace.getWorkspaceFolder(input_document.uri) && configuration.get("buildDirectoryPrioritizeCMake") ? vscode.workspace.getConfiguration('cmake').get('buildDirectory') : undefined, input_path, output_path);

		console.log("Executing " + JSON.stringify(insights_command));

		const sh = new vscode.ShellExecution(insights_command.path, insights_command.args);
		//const sh = new vscode.ProcessExecution(insights_command.path, insights_command.args)

		const tsk = new vscode.Task({} as vscode.TaskDefinition, vscode.TaskScope.Global, "insights task", taskSource, sh, undefined /*matcher*/);
		tsk.runOptions = { reevaluateOnRerun: true } as vscode.RunOptions;
		tsk.presentationOptions = { reveal: vscode.TaskRevealKind.Silent } as vscode.TaskPresentationOptions;

		vscode.tasks.executeTask(tsk).then(() => {
			console.log("Task executeTask");
		}, (rejection_reason) => {
			console.error(rejection_reason);
		});

		const disposable = vscode.tasks.onDidEndTaskProcess((event) => {
			if (event.execution.task.source === taskSource) {
				console.log("Task onDidEndTaskProcess")
				try {
					if (event.exitCode != 0) {
						vscode.window.showErrorMessage("Insights task failed \nCheck task pane for more info.");
						console.error("Task failed");
						return;
					} else {
						openInsightsOutput(input_document, output_path, configuration, options, show_diff);
					}
				} finally {
					disposable.dispose();
				}
			}
		});
	});
	// child.exec(exec_command, (error: child.ExecException | null, stdout: string, stderr: string) => {
	// 	if (error) {
	// 		vscode.window.showErrorMessage('insights failed:\n' + exec_command + '\n' + stderr + '\n' + stdout);
	// 		console.error(error);
	// 		console.error(stderr);
	// 		return;
	// 	}

	// 	// store output in temporary as workaround for annoying save dialog on close
	// 	tmp.file({ prefix: path.basename(input_path), postfix: '.cpp', keep: false }, function (err: string, output_path: string) {
	// 		if (err) {
	// 			vscode.window.showErrorMessage('Failed to create temporary file (' + err + ')');
	// 			return;
	// 		}
	// 		fs.writeFileSync(output_path, stdout);
	// 		openInsightsOutput(input_document, output_path, configuration, options, show_diff);
	// 	});
	// });
}

/**
 * Open the output. Either show it in an editor besides the source, or open a diff.
 */
function openInsightsOutput(input_document: vscode.TextDocument, output_path: string, configuration: vscode.WorkspaceConfiguration, options: vscode.TextEditorOptions, show_diff: boolean) {
	let output_uri = vscode.Uri.file(output_path);

	// TODO clarify if formatting requires open TextEditor->visually bad, but seems more reliable
	let formatting = (doc: vscode.TextDocument) => { configuration.get("format")! ? format(doc, options, configuration.get("experimental")!) : () => { } };


	// was { language: vscode.window.activeTextEditor?.document.languageId, content: stdout }
	console.log("Openning insights output");
	vscode.workspace.openTextDocument(output_uri).then((output_document) => {
		if (!show_diff) {
			show(output_document, formatting, options);
		}
		else {
			diff(input_document, output_document, formatting);
		}

	});
}

/**
 * Format the output.
 */
function format(doc: vscode.TextDocument, options: vscode.TextEditorOptions, experimental: boolean) {
	let format_options = { tabSize: options.tabSize != undefined ? options.tabSize : 4, insertSpaces: options.insertSpaces || false } as vscode.FormattingOptions;
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
			Promise.all(jobs).then(() => {
				console.log("Saving format");
				doc.save();
			});
		}
		else {
			console.log("No format edits");
		}
	}, (rejection_reason) => {
		console.log("Format command failed");
		console.log(rejection_reason);
	});
}

/**
 * Show the output.
 */
function show(doc: vscode.TextDocument, format: (doc: vscode.TextDocument) => void, options: vscode.TextEditorOptions) {
	console.log("Showing " + doc.uri);

	// TODO preview gets lost when formatting
	vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true, preview: true }).then((editor) => {
		editor.options = options;
		format(doc);
	});
}

/**
 * Diff the source and output.
 */
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
