#!/bin/sh

NAME=screentospace@dilzhan.dev
DIR=src
rm -rf ~/.local/share/gnome-shell/extensions/$NAME
cp -r src ~/.local/share/gnome-shell/extensions/$NAME
