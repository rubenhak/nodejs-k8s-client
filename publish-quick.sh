#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd $MY_DIR

rm -rf ./dist

./build.sh
RESULT=$?
if [ $RESULT -ne 0 ]; then
  echo "BUILD failed"
  exit 1;
fi

npm version patch
RESULT=$?
if [ $RESULT -ne 0 ]; then
  echo "VERSION PATCH failed"
  exit 1;
fi

git pull --rebase
git push --follow-tags