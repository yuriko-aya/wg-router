#!/bin/zsh

/opt/homebrew/bin/rsync -azP --exclude-from=.gitignore --delete . root@172.20.22.112:/opt/wgrouter/
