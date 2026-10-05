#!/bin/sh
# Builds the app and publishes it to the gh-pages branch, which GitHub Pages serves.
set -eu

REMOTE=https://github.com/mikelewis-au/atlas.git

npm test
BASE_PATH=/atlas/ npm run build

# Without this, GitHub's Jekyll step can drop files it does not recognise.
touch dist/.nojekyll

# The throwaway repo in dist would otherwise fall back to the global git identity.
NAME=$(git config user.name)
EMAIL=$(git config user.email)

cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="$NAME" -c user.email="$EMAIL" commit -q -m "Deploy"
git push -f "$REMOTE" gh-pages
rm -rf .git
