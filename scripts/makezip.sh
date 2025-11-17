#!/bin/bash

NAME=screentospace@dilzhan.dev
DIR=src

# Create build directory
mkdir -p build

# Build the extension package
cd $DIR
zip -r ../$NAME.zip *
cd ..

# Move to build directory
mv $NAME.zip build/$NAME.zip

echo "✓ Extension package created: build/$NAME.zip"

