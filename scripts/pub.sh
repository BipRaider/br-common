#!/bin/sh
echo [Git add ]
git add .

echo "Add a message to a commit?"
read namespace

echo [Git commit]
git commit -m "Updates into package. ${namespace}"

echo [up version package]
npm version patch

echo [build package]
npm run build

echo [push package to npm]
npm publish

