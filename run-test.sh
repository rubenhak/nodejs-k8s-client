#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd $MY_DIR

./run-kind.sh
RESULT=$?
if [ $RESULT -ne 0 ]; then
  echo "Failed to start KIND"
  exit 1;
fi

./run-test-kind.sh
RESULT=$?
if [ $RESULT -ne 0 ]; then
  echo "TESTS Failed"
  exit 1;
fi

./stop-kind.sh
RESULT=$?
if [ $RESULT -ne 0 ]; then
  echo "Failed to stop KIND"
  exit 1;
fi
