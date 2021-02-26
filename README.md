# Code Packer

Packs a codebase to zip and distribute it automatically for updates

![GIF preview](preview.gif)
<sub>I'm lazy don't ask</sub>

## How it works

1. Packs a directory defined on `packer.config.json` to a zip file
2. Express `(server)` will have serve the file for clients to download
3. Client will download the file and unzipped it to a folder set
4. Client loader/runner will run the downloaded code
