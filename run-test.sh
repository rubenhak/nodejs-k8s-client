#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd $MY_DIR

./run-k3s.sh
RESULT=$?
if [ $RESULT -ne 0 ]; then
  echo "Failed to start k3s"
  exit 1;
fi

./run-test-k3s.sh
RESULT=$?
if [ $RESULT -ne 0 ]; then
  echo "TESTS Failed"
  exit 1;
fi

./stop-k3s.sh
RESULT=$?
if [ $RESULT -ne 0 ]; then
  echo "Failed to stop k3s"
  exit 1;
fi
