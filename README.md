# C++ Insights for Visual Studio Code (VSCode)

<!-- ## Introduction -->

<!-- ## Features

For example if there is an image subfolder under your extension project workspace:

\!\[feature X\]\(images/feature-x.png\)

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow. -->

## Features
This extension allows you to view C++ Insights inside of vscode:
<p>
  <img src="image/show.png" alt="Show C++ insights" />
</p>

or diff the Insights with your original source:
<p>
  <img src="image/diff.png" alt="Diff source with C++ insights" />
</p>

The extension can utilize a compilation database/compile commands for easy use in existing environments. You can specify a directory containing the compilation database, aka the  build directory, with `vscode-cppinsights.buildDirectory`.
If the active file is part of a workspace, and `vscode-cppinsights.buildDirectoryPrioritizeCMake` is set, the `cmake.buildDirectory` is used to determine the build directory.

## Requirements
This extension requires @andreasfertig's C++ Insights.
C++ Insights can be found here:
https://github.com/andreasfertig/cppinsights.
Build or download the latest release and specify the path to the cppinsights binary in `vscode-cppinsights.path`.

## Commands
* `vscode-cppinsights.insights`: Show C++ insights
* `vscode-cppinsights.insightsDiff`: Show C++ insights diff with original

## Extension Settings
This extension contributes the following settings:
(You can find descriptions in the settings UI)
* `vscode-cppinsights.path`
* `vscode-cppinsights.buildDirectory`
* `vscode-cppinsights.buildDirectoryPrioritizeCMake`
* `vscode-cppinsights.args`
* `vscode-cppinsights.format`
* `vscode-cppinsights.experimental`

## Contribute
If you want to contribute, have an idea for a feature, or want to report an issue, please visit the [GitHub repository](https://github.com/devtbi/vscode-cppinsights).

## Known Issues
### Compiler Error on Windows
* Using Microsoft/Visual Studio STL with C++ Insights might report "#error STL1000: Unexpected compiler version". You can define _ALLOW_COMPILER_AND_STL_VERSION_MISMATCH (before any includes) as a workaround ([C++ Insights Issue](https://github.com/andreasfertig/cppinsights/issues/422)).
### Formatting (`vscode-cppinsights.format`)
* Enabling the option disables the "preview" property of the output editor
* When using the `insightsDiff` command, the output is not formatted like the original source
