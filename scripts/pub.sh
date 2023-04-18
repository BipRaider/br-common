#!/bin/sh
echo [Git add ]
git add .

echo [Git commit]
git commit -m "Updates"

echo [up version package]
npm version patch

echo [build package]
npm run build

echo [push package to npm]
npm publish